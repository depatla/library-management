"""Settings module repository — staff management via existing users/roles/
user_library_memberships tables, no new tables of its own."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def list_staff(db: Session, library_id: UUID) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT u.id AS user_id, u.full_name, u.email, r.name AS role_name,
                   m.status, m.invited_at, m.joined_at
            FROM user_library_memberships m
            JOIN users u ON u.id = m.user_id
            JOIN roles r ON r.id = m.role_id
            WHERE m.library_id = :library_id
            ORDER BY m.invited_at
            """
        ),
        {"library_id": str(library_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def get_role_id(db: Session, role_name: str) -> UUID | None:
    row = db.execute(text("SELECT id FROM roles WHERE name = :name AND is_assignable = true"), {"name": role_name}).first()
    return row[0] if row else None


def get_user_by_email(db: Session, email: str) -> dict | None:
    row = db.execute(
        text("SELECT id, full_name, email FROM users WHERE email = :email AND deleted_at IS NULL"), {"email": email}
    ).mappings().first()
    return dict(row) if row else None


def create_placeholder_user(db: Session, *, full_name: str, email: str, password_hash: str) -> UUID:
    row = db.execute(
        text(
            """
            INSERT INTO users (full_name, email, password_hash)
            VALUES (:full_name, :email, :password_hash)
            RETURNING id
            """
        ),
        {"full_name": full_name, "email": email, "password_hash": password_hash},
    ).mappings().first()
    return row["id"]


def membership_exists(db: Session, *, library_id: UUID, user_id: UUID) -> bool:
    return bool(
        db.execute(
            text("SELECT 1 FROM user_library_memberships WHERE library_id = :library_id AND user_id = :user_id"),
            {"library_id": str(library_id), "user_id": str(user_id)},
        ).first()
    )


def create_membership(db: Session, *, library_id: UUID, user_id: UUID, role_id: UUID) -> None:
    db.execute(
        text(
            """
            INSERT INTO user_library_memberships (library_id, user_id, role_id, status)
            VALUES (:library_id, :user_id, :role_id, 'invited')
            """
        ),
        {"library_id": str(library_id), "user_id": str(user_id), "role_id": str(role_id)},
    )


def update_role(db: Session, *, library_id: UUID, user_id: UUID, role_id: UUID) -> None:
    db.execute(
        text(
            "UPDATE user_library_memberships SET role_id = :role_id WHERE library_id = :library_id AND user_id = :user_id"
        ),
        {"role_id": str(role_id), "library_id": str(library_id), "user_id": str(user_id)},
    )


def remove_membership(db: Session, *, library_id: UUID, user_id: UUID) -> None:
    db.execute(
        text("DELETE FROM user_library_memberships WHERE library_id = :library_id AND user_id = :user_id"),
        {"library_id": str(library_id), "user_id": str(user_id)},
    )
