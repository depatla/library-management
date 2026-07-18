"""Libraries module repository — raw SQL via SQLAlchemy Core."""

import re
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

# Seeded per-library at creation time (requirement #3/#4): Entrance and Small
# are non-AC and locked that way; the rest default AC but may be flipped
# seasonally by staff (is_ac_locked = false for those).
DEFAULT_ROOM_CATEGORIES = [
    {"name": "Green", "color_code": "#2e7d32", "is_ac": True, "is_ac_locked": False, "display_order": 1},
    {"name": "Red", "color_code": "#c62828", "is_ac": True, "is_ac_locked": False, "display_order": 2},
    {"name": "Orange", "color_code": "#ef6c00", "is_ac": True, "is_ac_locked": False, "display_order": 3},
    {"name": "Yellow", "color_code": "#f9a825", "is_ac": True, "is_ac_locked": False, "display_order": 4},
    {"name": "Blue", "color_code": "#1565c0", "is_ac": True, "is_ac_locked": False, "display_order": 5},
    {"name": "Entrance", "color_code": "#6d4c41", "is_ac": False, "is_ac_locked": True, "display_order": 6},
    {"name": "Small", "color_code": "#757575", "is_ac": False, "is_ac_locked": True, "display_order": 7},
]


def slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return base or "library"


def get_user_by_email(db: Session, email: str) -> dict | None:
    row = db.execute(
        text("SELECT id, email FROM users WHERE email = :email AND deleted_at IS NULL"),
        {"email": email},
    ).mappings().first()
    return dict(row) if row else None


def create_user(db: Session, *, full_name: str, email: str, phone: str | None, password_hash: str) -> dict:
    row = db.execute(
        text(
            """
            INSERT INTO users (full_name, email, phone, password_hash)
            VALUES (:full_name, :email, :phone, :password_hash)
            RETURNING id, full_name, email
            """
        ),
        {"full_name": full_name, "email": email, "phone": phone, "password_hash": password_hash},
    ).mappings().first()
    return dict(row)


def unique_slug(db: Session, name: str) -> str:
    base = slugify(name)
    slug = base
    suffix = 1
    while db.execute(text("SELECT 1 FROM libraries WHERE slug = :slug"), {"slug": slug}).first():
        suffix += 1
        slug = f"{base}-{suffix}"
    return slug


def create_library(db: Session, *, owner_id: UUID, slug: str, payload) -> dict:
    row = db.execute(
        text(
            """
            INSERT INTO libraries (
                owner_id, name, slug, address_line1, city, state, postal_code,
                phone, email, primary_color, secondary_color, theme_mode, status
            )
            VALUES (
                :owner_id, :name, :slug, :address_line1, :city, :state, :postal_code,
                :phone, :email, :primary_color, :secondary_color, :theme_mode, 'trial'
            )
            RETURNING id, name, slug, city, status, primary_color, secondary_color, theme_mode,
                      owner_id, created_at
            """
        ),
        {
            "owner_id": str(owner_id),
            "name": payload.name,
            "slug": slug,
            "address_line1": payload.address_line1,
            "city": payload.city,
            "state": payload.state,
            "postal_code": payload.postal_code,
            "phone": payload.phone,
            "email": payload.email,
            "primary_color": payload.primary_color,
            "secondary_color": payload.secondary_color,
            "theme_mode": payload.theme_mode,
        },
    ).mappings().first()
    return dict(row)


def seed_room_categories(db: Session, *, library_id: UUID) -> None:
    for cat in DEFAULT_ROOM_CATEGORIES:
        db.execute(
            text(
                """
                INSERT INTO room_categories (library_id, name, color_code, is_ac, is_ac_locked, is_default, display_order)
                VALUES (:library_id, :name, :color_code, :is_ac, :is_ac_locked, true, :display_order)
                """
            ),
            {"library_id": str(library_id), **cat},
        )


def get_owner_role_id(db: Session) -> UUID:
    row = db.execute(text("SELECT id FROM roles WHERE name = 'library_owner'")).first()
    return row[0]


def create_membership(db: Session, *, user_id: UUID, library_id: UUID, role_id: UUID) -> None:
    db.execute(
        text(
            """
            INSERT INTO user_library_memberships (user_id, library_id, role_id, status, joined_at)
            VALUES (:user_id, :library_id, :role_id, 'active', now())
            """
        ),
        {"user_id": str(user_id), "library_id": str(library_id), "role_id": str(role_id)},
    )


def list_libraries(db: Session) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT l.id, l.name, l.slug, l.city, l.status, l.primary_color, l.secondary_color,
                   l.theme_mode, l.owner_id, u.full_name AS owner_name, l.created_at
            FROM libraries l
            JOIN users u ON u.id = l.owner_id
            WHERE l.deleted_at IS NULL
            ORDER BY l.created_at DESC
            """
        )
    ).mappings().all()
    return [dict(r) for r in rows]


def list_libraries_for_user(db: Session, user_id: UUID) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT l.id, l.name, l.slug, l.city, l.status, l.primary_color, l.secondary_color,
                   l.theme_mode, l.owner_id, u.full_name AS owner_name, l.created_at, r.name AS role
            FROM user_library_memberships m
            JOIN libraries l ON l.id = m.library_id AND l.deleted_at IS NULL
            JOIN users u ON u.id = l.owner_id
            JOIN roles r ON r.id = m.role_id
            WHERE m.user_id = :user_id AND m.status = 'active'
            ORDER BY l.name
            """
        ),
        {"user_id": str(user_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def get_library(db: Session, library_id: UUID) -> dict | None:
    row = db.execute(
        text(
            """
            SELECT l.id, l.name, l.slug, l.city, l.status, l.primary_color, l.secondary_color,
                   l.theme_mode, l.owner_id, u.full_name AS owner_name, l.created_at
            FROM libraries l
            JOIN users u ON u.id = l.owner_id
            WHERE l.id = :id AND l.deleted_at IS NULL
            """
        ),
        {"id": str(library_id)},
    ).mappings().first()
    return dict(row) if row else None


def set_library_status(db: Session, *, library_id: UUID, status: str) -> None:
    db.execute(
        text("UPDATE libraries SET status = :status WHERE id = :id"),
        {"status": status, "id": str(library_id)},
    )


def update_library_theme(db: Session, *, library_id: UUID, primary_color: str | None, secondary_color: str | None, theme_mode: str | None) -> None:
    db.execute(
        text(
            """
            UPDATE libraries SET
                primary_color = COALESCE(:primary_color, primary_color),
                secondary_color = COALESCE(:secondary_color, secondary_color),
                theme_mode = COALESCE(:theme_mode, theme_mode)
            WHERE id = :id
            """
        ),
        {"primary_color": primary_color, "secondary_color": secondary_color, "theme_mode": theme_mode, "id": str(library_id)},
    )
