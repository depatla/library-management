"""Auth module repository — raw SQL via SQLAlchemy Core (no ORM models yet;
matches the pattern established in app/api/v1/health.py). Uses the plain
(non-tenant) session since users/roles/libraries lookups here span tenants."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def get_user_by_email(db: Session, email: str) -> dict | None:
    row = db.execute(
        text(
            """
            SELECT id, full_name, email, password_hash, is_super_admin, is_active
            FROM users
            WHERE email = :email AND deleted_at IS NULL
            """
        ),
        {"email": email},
    ).mappings().first()
    return dict(row) if row else None


def get_user_by_id(db: Session, user_id: UUID) -> dict | None:
    row = db.execute(
        text(
            """
            SELECT id, full_name, email, is_super_admin, is_active
            FROM users
            WHERE id = :user_id AND deleted_at IS NULL
            """
        ),
        {"user_id": str(user_id)},
    ).mappings().first()
    return dict(row) if row else None


def get_active_memberships(db: Session, user_id: UUID) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT l.id AS library_id, l.name AS library_name, l.status AS library_status,
                   r.name AS role
            FROM user_library_memberships m
            JOIN libraries l ON l.id = m.library_id AND l.deleted_at IS NULL
            JOIN roles r ON r.id = m.role_id
            WHERE m.user_id = :user_id AND m.status = 'active'
            ORDER BY l.name
            """
        ),
        {"user_id": str(user_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def touch_last_login(db: Session, user_id: UUID) -> None:
    db.execute(
        text("UPDATE users SET last_login_at = now() WHERE id = :user_id"),
        {"user_id": str(user_id)},
    )
    db.commit()


def store_refresh_token(
    db: Session, *, user_id: UUID, token_hash: str, expires_at, device_info: str | None, ip_address: str | None
) -> None:
    db.execute(
        text(
            """
            INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
            VALUES (:user_id, :token_hash, :device_info, :ip_address, :expires_at)
            """
        ),
        {
            "user_id": str(user_id),
            "token_hash": token_hash,
            "device_info": device_info,
            "ip_address": ip_address,
            "expires_at": expires_at,
        },
    )
    db.commit()


def get_active_refresh_token(db: Session, token_hash: str) -> dict | None:
    row = db.execute(
        text(
            """
            SELECT id, user_id, expires_at, revoked_at
            FROM refresh_tokens
            WHERE token_hash = :token_hash
            """
        ),
        {"token_hash": token_hash},
    ).mappings().first()
    return dict(row) if row else None


def revoke_refresh_token(db: Session, token_hash: str) -> None:
    db.execute(
        text("UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = :token_hash AND revoked_at IS NULL"),
        {"token_hash": token_hash},
    )
    db.commit()
