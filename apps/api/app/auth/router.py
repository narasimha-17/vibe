from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import oauth
from app.auth.deps import get_current_user
from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.models import User
from app.schemas.schemas import (
    LoginRequest,
    ProfileUpdate,
    RegisterRequest,
    TokenResponse,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/register", response_model=TokenResponse)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        email=payload.email,
        name=payload.name or payload.email.split("@")[0],
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return TokenResponse(access_token=create_access_token(user.id))


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        plan=user.plan,
        has_password=bool(user.hashed_password),
        google_linked=bool(user.google_id),
        github_linked=bool(user.github_id),
        created_at=user.created_at,
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return _user_out(current_user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: ProfileUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    if payload.name is not None:
        current_user.name = payload.name.strip()
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url.strip() or None
    await db.commit()
    await db.refresh(current_user)
    return _user_out(current_user)


@router.post("/unlink/{provider}", response_model=UserOut)
async def unlink_provider(
    provider: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    if provider not in ("google", "github"):
        raise HTTPException(status_code=404, detail="Unknown provider")
    field = f"{provider}_id"
    if not getattr(current_user, field):
        raise HTTPException(status_code=400, detail=f"{provider.capitalize()} isn't linked")
    other = "github_id" if provider == "google" else "google_id"
    if not current_user.hashed_password and not getattr(current_user, other):
        raise HTTPException(status_code=400, detail="Set a password first so you can still sign in")
    setattr(current_user, field, None)
    await db.commit()
    await db.refresh(current_user)
    return _user_out(current_user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    confirm: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    if confirm.strip().lower() != current_user.email.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Confirmation email doesn't match")
    await db.delete(current_user)
    await db.commit()


@router.get("/providers")
async def providers():
    """Lets the frontend show/hide OAuth buttons instead of guessing."""
    return {"google": settings.google_configured, "github": settings.github_configured}


# ── Google OAuth login ───────────────────────────────────────────
@router.get("/google/start")
async def google_start():
    if not settings.google_configured:
        raise HTTPException(status_code=501, detail="Google sign-in isn't configured yet")
    redirect_uri = f"{settings.api_base_url}/auth/google/callback"
    return RedirectResponse(oauth.google_authorize_url(redirect_uri))


@router.get("/google/callback")
async def google_callback(code: str, db: AsyncSession = Depends(get_db)):
    redirect_uri = f"{settings.api_base_url}/auth/google/callback"
    profile = await oauth.google_exchange_and_fetch_user(code, redirect_uri)
    user = await _find_or_create_oauth_user(db, provider="google", profile=profile)
    token = create_access_token(user.id)
    return RedirectResponse(f"{settings.web_base_url}/api/auth/callback?token={token}")


# ── GitHub OAuth login ───────────────────────────────────────────
@router.get("/github/start")
async def github_start():
    if not settings.github_configured:
        raise HTTPException(status_code=501, detail="GitHub sign-in isn't configured yet")
    redirect_uri = f"{settings.api_base_url}/auth/github/callback"
    return RedirectResponse(oauth.github_authorize_url(redirect_uri))


@router.get("/github/callback")
async def github_callback(code: str, db: AsyncSession = Depends(get_db)):
    redirect_uri = f"{settings.api_base_url}/auth/github/callback"
    access_token = await oauth.github_exchange_code(code, redirect_uri)
    profile = await oauth.github_fetch_user(access_token)
    user = await _find_or_create_oauth_user(db, provider="github", profile=profile)
    token = create_access_token(user.id)
    return RedirectResponse(f"{settings.web_base_url}/api/auth/callback?token={token}")


async def _find_or_create_oauth_user(db: AsyncSession, provider: str, profile: dict) -> User:
    id_field = "google_id" if provider == "google" else "github_id"
    result = await db.execute(select(User).where(getattr(User, id_field) == profile["provider_id"]))
    user = result.scalar_one_or_none()
    if user:
        return user

    result = await db.execute(select(User).where(User.email == profile["email"]))
    user = result.scalar_one_or_none()
    if user:
        setattr(user, id_field, profile["provider_id"])
        await db.commit()
        await db.refresh(user)
        return user

    user = User(
        email=profile["email"],
        name=profile.get("name") or profile["email"].split("@")[0],
        avatar_url=profile.get("avatar_url"),
        **{id_field: profile["provider_id"]},
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
