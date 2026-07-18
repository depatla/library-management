"""Password hashing and JWT issuance/verification (Module 1 §9 security posture)."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

# Argon2id — stronger than bcrypt against GPU/ASIC attacks (Module 1 §9).
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(*, user_id: UUID, is_super_admin: bool, memberships: list[dict[str, Any]]) -> str:
    """memberships: [{"library_id": str, "role": str}, ...] for the JWT claim set."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "is_super_admin": is_super_admin,
        "memberships": memberships,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc


def generate_refresh_token() -> tuple[str, str]:
    """Returns (raw_token, token_hash). Only the hash is persisted (DB §4.3)."""
    raw_token = secrets.token_urlsafe(48)
    return raw_token, hash_refresh_token(raw_token)


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
