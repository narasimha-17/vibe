"""Email one-time-code (OTP) verification for changing a password.

Flow: POST /auth/password-otp/send emails a 6-digit code (valid for a few minutes),
then POST /auth/password-otp/confirm checks it and sets the new password.
Codes are stored only as an HMAC digest, are single-use, expire, and lock after
too many wrong attempts.
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.core.config import get_settings
from app.core.db import get_db
from app.core.mailer import send_email
from app.core.security import hash_password
from app.models.models import User
from app.schemas.schemas import PasswordOtpConfirm, PasswordOtpSent

router = APIRouter(prefix="/auth/password-otp", tags=["auth"])
settings = get_settings()

EMAIL_HTML = """
<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px">
  <h2 style="color:#3b2d5a">Verify it's you</h2>
  <p style="color:#7a6d96">Use this code to change your VIBE password:</p>
  <p style="font-size:34px;letter-spacing:10px;font-weight:800;color:#6b4d9a;margin:18px 0">{code}</p>
  <p style="color:#7a6d96;font-size:13px">Expires in {minutes} minutes. Didn't request it? You can ignore this email.</p>
</div>
"""


def _digest(user: User, code: str) -> str:
    return hmac.new(settings.jwt_secret.encode(), f"{user.id}:{code}".encode(), hashlib.sha256).hexdigest()


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _mask(email: str) -> str:
    local, _, domain = email.partition("@")
    return f"{local[:1]}{'*' * max(len(local) - 1, 2)}@{domain}"


@router.post("/send", response_model=PasswordOtpSent)
async def send_code(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    if user.otp_sent_at:
        wait = settings.otp_resend_seconds - (now - _aware(user.otp_sent_at)).total_seconds()
        if wait > 0:
            raise HTTPException(status_code=429, detail=f"Please wait {int(wait) + 1}s before requesting another code.")

    code = f"{secrets.randbelow(10**6):06d}"
    user.otp_hash = _digest(user, code)
    user.otp_expires_at = now + timedelta(seconds=settings.otp_ttl_seconds)
    user.otp_sent_at = now
    user.otp_attempts = 0
    await db.commit()

    minutes = settings.otp_ttl_seconds // 60
    delivered = await send_email(
        user.email,
        "Your VIBE verification code",
        f"Your VIBE verification code is {code}.\n\nIt expires in {minutes} minutes. "
        "If you didn't request this, ignore this email - your password won't change.",
        EMAIL_HTML.format(code=code, minutes=minutes),
    )
    return PasswordOtpSent(
        email=_mask(user.email),
        expires_in=settings.otp_ttl_seconds,
        resend_in=settings.otp_resend_seconds,
        delivery="email" if delivered else "console",
        dev_code=code if (settings.dev_expose_otp and not delivered) else None,
    )


@router.post("/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def confirm_code(payload: PasswordOtpConfirm, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    if not user.otp_hash or not user.otp_expires_at or _aware(user.otp_expires_at) < now:
        raise HTTPException(status_code=400, detail="That code has expired. Request a new one.")
    if user.otp_attempts >= settings.otp_max_attempts:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Request a new code.")

    if not hmac.compare_digest(user.otp_hash, _digest(user, payload.code)):
        user.otp_attempts += 1
        left = settings.otp_max_attempts - user.otp_attempts
        await db.commit()
        raise HTTPException(status_code=400, detail=f"Incorrect code. {left} attempt{'s' if left != 1 else ''} left.")

    user.hashed_password = hash_password(payload.new_password)
    user.otp_hash = None
    user.otp_expires_at = None
    user.otp_sent_at = None
    user.otp_attempts = 0
    await db.commit()
