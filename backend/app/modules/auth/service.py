"""Auth business logic: login, refresh rotation, logout, current-user resolution."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import UnauthorizedError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)
from app.modules.auth import repository
from app.modules.auth.schemas import LoginResponse, MembershipOut, UserOut


def _memberships_for_claims(memberships: list[dict]) -> list[dict]:
    return [{"library_id": str(m["library_id"]), "role": m["role"]} for m in memberships]


def login(db: Session, *, email: str, password: str, device_info: str | None, ip_address: str | None) -> tuple[LoginResponse, str]:
    user = repository.get_user_by_email(db, email)
    if not user or not verify_password(password, user["password_hash"]):
        raise UnauthorizedError("Invalid email or password")
    if not user["is_active"]:
        raise UnauthorizedError("This account has been deactivated")

    memberships = repository.get_active_memberships(db, user["id"])
    access_token = create_access_token(
        user_id=user["id"], is_super_admin=user["is_super_admin"], memberships=_memberships_for_claims(memberships)
    )

    raw_refresh_token, refresh_hash = generate_refresh_token()
    repository.store_refresh_token(
        db,
        user_id=user["id"],
        token_hash=refresh_hash,
        expires_at=refresh_token_expiry(),
        device_info=device_info,
        ip_address=ip_address,
    )
    repository.touch_last_login(db, user["id"])

    response = LoginResponse(
        access_token=access_token,
        user=UserOut(
            id=user["id"],
            full_name=user["full_name"],
            email=user["email"],
            is_super_admin=user["is_super_admin"],
            memberships=[MembershipOut(**m) for m in memberships],
        ),
    )
    return response, raw_refresh_token


def refresh(db: Session, *, raw_refresh_token: str) -> tuple[str, str]:
    """Rotates the refresh token; returns (new_access_token, new_raw_refresh_token)."""
    token_hash = hash_refresh_token(raw_refresh_token)
    stored = repository.get_active_refresh_token(db, token_hash)
    if not stored or stored["revoked_at"] is not None:
        raise UnauthorizedError("Invalid refresh token")

    if stored["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise UnauthorizedError("Refresh token expired")

    repository.revoke_refresh_token(db, token_hash)

    user = repository.get_user_by_id(db, stored["user_id"])
    if not user or not user["is_active"]:
        raise UnauthorizedError("Account no longer active")

    memberships = repository.get_active_memberships(db, user["id"])
    access_token = create_access_token(
        user_id=user["id"], is_super_admin=user["is_super_admin"], memberships=_memberships_for_claims(memberships)
    )
    new_raw_refresh_token, new_hash = generate_refresh_token()
    repository.store_refresh_token(
        db, user_id=user["id"], token_hash=new_hash, expires_at=refresh_token_expiry(), device_info=None, ip_address=None
    )
    return access_token, new_raw_refresh_token


def logout(db: Session, *, raw_refresh_token: str) -> None:
    repository.revoke_refresh_token(db, hash_refresh_token(raw_refresh_token))


def get_current_user(db: Session, *, user_id: UUID) -> UserOut:
    user = repository.get_user_by_id(db, user_id)
    if not user:
        raise UnauthorizedError("User no longer exists")
    memberships = repository.get_active_memberships(db, user_id)
    return UserOut(
        id=user["id"],
        full_name=user["full_name"],
        email=user["email"],
        is_super_admin=user["is_super_admin"],
        memberships=[MembershipOut(**m) for m in memberships],
    )
