"""Extra account endpoints: forgot / reset password, one-time-code sign-in, profile update, change password.

Codes are 6 digits, stored hashed, valid 15 minutes, limited to 5 attempts and one send per 30 seconds per email.
Sending email is intentionally not built in: with AUTH_DEV_EXPOSE_CODES=1 the code is returned in the response
(handy for local testing), otherwise it is only logged. Plug your email provider into `deliver_code`.
"""

import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import Boolean, Column, DateTime, Integer, String, func
from sqlalchemy.orm import Session

from app import models
from app.auth import current_user, make_token, pwd
from app.database import Base, get_db

log = logging.getLogger("auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

TTL = timedelta(minutes=15)
COOLDOWN = timedelta(seconds=30)
MAX_ATTEMPTS = 5


class AuthCode(Base):
    __tablename__ = "auth_codes"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), index=True, nullable=False)
    kind = Column(String(20), nullable=False)  # reset | otp
    code_hash = Column(String(64), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, default=0)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EmailIn(BaseModel):
    email: EmailStr


class CodeIn(EmailIn):
    code: str = Field(pattern=r"^[0-9]{6}$")


class ResetIn(CodeIn):
    password: str = Field(min_length=8)


class ProfileIn(BaseModel):
    name: str = Field(default="", max_length=255)


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


def _hash(email: str, kind: str, code: str) -> str:
    secret = os.getenv("JWT_SECRET", "")
    return hashlib.sha256(f"{secret}|{email}|{kind}|{code}".encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def deliver_code(email: str, kind: str, code: str) -> None:
    """Replace with your email provider. For now the code is only logged."""
    log.warning("Auth code for %s (%s): %s", email, kind, code)


def _issue(db: Session, email: str, kind: str) -> str:
    email = email.lower()
    last = db.query(AuthCode).filter(AuthCode.email == email, AuthCode.kind == kind).order_by(AuthCode.id.desc()).first()
    if last and _now() - _aware(last.created_at) < COOLDOWN:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Please wait a few seconds before requesting another code.")
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(AuthCode(email=email, kind=kind, code_hash=_hash(email, kind, code), expires_at=_now() + TTL))
    db.commit()
    deliver_code(email, kind, code)
    return code


def _consume(db: Session, email: str, kind: str, code: str) -> None:
    email = email.lower()
    row = db.query(AuthCode).filter(AuthCode.email == email, AuthCode.kind == kind, AuthCode.used == False).order_by(AuthCode.id.desc()).first()  # noqa: E712
    if not row or _aware(row.expires_at) < _now():
        raise HTTPException(400, "That code has expired. Please request a new one.")
    if (row.attempts or 0) >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many attempts. Please request a new code.")
    if _hash(email, kind, code) != row.code_hash:
        row.attempts = (row.attempts or 0) + 1
        db.commit()
        raise HTTPException(400, "That code isn't right.")
    row.used = True
    db.commit()


def _dev(code: str) -> dict:
    return {"sent": True, "dev_code": code} if os.getenv("AUTH_DEV_EXPOSE_CODES") == "1" else {"sent": True}


@router.post("/forgot")
def forgot(data: EmailIn, db: Session = Depends(get_db)):
    """Always answers the same, so it can't be used to discover which emails have accounts."""
    user = db.query(models.User).filter(models.User.email == data.email.lower()).first()
    if not user:
        return {"sent": True}
    return _dev(_issue(db, data.email, "reset"))


@router.post("/reset")
def reset(data: ResetIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email.lower()).first()
    if not user:
        raise HTTPException(400, "That code isn't right.")
    _consume(db, data.email, "reset", data.code)
    user.password_hash = pwd.hash(data.password)
    db.commit()
    return {"ok": True}


@router.post("/otp/send")
def otp_send(data: EmailIn, db: Session = Depends(get_db)):
    return _dev(_issue(db, data.email, "otp"))


@router.post("/otp/verify")
def otp_verify(data: CodeIn, db: Session = Depends(get_db)):
    _consume(db, data.email, "otp", data.code)
    user = db.query(models.User).filter(models.User.email == data.email.lower()).first()
    if not user:  # passwordless sign-up: a random password nobody knows
        user = models.User(email=data.email.lower(), name="", password_hash=pwd.hash(secrets.token_urlsafe(24)))
        db.add(user)
        db.commit()
        db.refresh(user)
    return {"access_token": make_token(user.id), "token_type": "bearer"}


@router.patch("/me")
def update_me(data: ProfileIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    user.name = data.name
    db.commit()
    return {"id": user.id, "email": user.email, "name": user.name}


@router.post("/change-password")
def change_password(data: ChangePasswordIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    if not pwd.verify(data.current_password, user.password_hash):
        raise HTTPException(400, "Your current password is wrong.")
    user.password_hash = pwd.hash(data.new_password)
    db.commit()
    return {"ok": True}
