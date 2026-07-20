"""Rooms & Cabins module repository — raw SQL via SQLAlchemy Core."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def list_room_categories(db: Session, library_id: UUID) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT id, library_id, name, color_code, is_ac, is_ac_locked, is_default, display_order
            FROM room_categories
            WHERE library_id = :library_id
            ORDER BY display_order, name
            """
        ),
        {"library_id": str(library_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def get_room_category(db: Session, *, library_id: UUID, category_id: UUID) -> dict | None:
    row = db.execute(
        text(
            """
            SELECT id, library_id, name, color_code, is_ac, is_ac_locked, is_default, display_order
            FROM room_categories
            WHERE id = :id AND library_id = :library_id
            """
        ),
        {"id": str(category_id), "library_id": str(library_id)},
    ).mappings().first()
    return dict(row) if row else None


def category_name_exists(db: Session, *, library_id: UUID, name: str) -> bool:
    return bool(
        db.execute(
            text("SELECT 1 FROM room_categories WHERE library_id = :library_id AND name = :name"),
            {"library_id": str(library_id), "name": name},
        ).first()
    )


def create_room_category(db: Session, *, library_id: UUID, payload) -> dict:
    row = db.execute(
        text(
            """
            INSERT INTO room_categories (library_id, name, color_code, is_ac, is_ac_locked, is_default, display_order)
            VALUES (:library_id, :name, :color_code, :is_ac, :is_ac_locked, false, :display_order)
            RETURNING id, library_id, name, color_code, is_ac, is_ac_locked, is_default, display_order
            """
        ),
        {
            "library_id": str(library_id),
            "name": payload.name,
            "color_code": payload.color_code,
            "is_ac": payload.is_ac,
            "is_ac_locked": payload.is_ac_locked,
            "display_order": payload.display_order,
        },
    ).mappings().first()
    return dict(row)


def update_room_category(db: Session, *, library_id: UUID, category_id: UUID, payload) -> None:
    db.execute(
        text(
            """
            UPDATE room_categories SET
                name = COALESCE(:name, name),
                color_code = COALESCE(:color_code, color_code),
                display_order = COALESCE(:display_order, display_order)
            WHERE id = :id AND library_id = :library_id
            """
        ),
        {
            "name": payload.name,
            "color_code": payload.color_code,
            "display_order": payload.display_order,
            "id": str(category_id),
            "library_id": str(library_id),
        },
    )


def count_cabins_in_category(db: Session, category_id: UUID) -> int:
    row = db.execute(
        text("SELECT count(*) FROM cabins WHERE room_category_id = :id"), {"id": str(category_id)}
    ).first()
    return row[0]


def delete_room_category(db: Session, *, library_id: UUID, category_id: UUID) -> None:
    db.execute(
        text("DELETE FROM room_categories WHERE id = :id AND library_id = :library_id"),
        {"id": str(category_id), "library_id": str(library_id)},
    )


def toggle_ac(db: Session, *, library_id: UUID, category_id: UUID, is_ac: bool) -> None:
    db.execute(
        text(
            """
            UPDATE room_categories SET is_ac = :is_ac
            WHERE id = :id AND library_id = :library_id AND is_ac_locked = false
            """
        ),
        {"is_ac": is_ac, "id": str(category_id), "library_id": str(library_id)},
    )


def bulk_seasonal_flip(db: Session, *, library_id: UUID, set_ac: bool) -> None:
    db.execute(
        text(
            """
            UPDATE room_categories SET is_ac = :is_ac
            WHERE library_id = :library_id AND is_ac_locked = false
            """
        ),
        {"is_ac": set_ac, "library_id": str(library_id)},
    )


def list_cabins(
    db: Session, *, library_id: UUID, room_category_id: UUID | None, status: str | None, search: str | None, limit: int, offset: int
) -> tuple[list[dict], int]:
    rows = db.execute(
        text(
            """
            SELECT c.id, c.library_id, c.room_category_id, rc.name AS room_category_name,
                   c.cabin_number, c.capacity, c.status,
                   count(*) OVER() AS total_count
            FROM cabins c
            JOIN room_categories rc ON rc.id = c.room_category_id
            WHERE c.library_id = :library_id
              AND (CAST(:room_category_id AS UUID) IS NULL OR c.room_category_id = CAST(:room_category_id AS UUID))
              AND (CAST(:status AS cabin_status) IS NULL OR c.status = CAST(:status AS cabin_status))
              AND (CAST(:search AS TEXT) IS NULL OR c.cabin_number ILIKE '%' || CAST(:search AS TEXT) || '%' OR rc.name ILIKE '%' || CAST(:search AS TEXT) || '%')
            ORDER BY rc.display_order, c.cabin_number
            LIMIT :limit OFFSET :offset
            """
        ),
        {
            "library_id": str(library_id),
            "room_category_id": str(room_category_id) if room_category_id else None,
            "status": status,
            "search": search,
            "limit": limit,
            "offset": offset,
        },
    ).mappings().all()
    total = rows[0]["total_count"] if rows else 0
    return [dict(r) for r in rows], total


def list_available_cabins(db: Session, *, library_id: UUID) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT rc.name AS category_name, rc.color_code, rc.is_ac,
                   c.cabin_number, c.capacity
            FROM cabins c
            JOIN room_categories rc ON rc.id = c.room_category_id
            WHERE c.library_id = :library_id AND c.status = 'available'
            ORDER BY rc.display_order, c.cabin_number
            """
        ),
        {"library_id": str(library_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def get_library_header(db: Session, library_id: UUID) -> dict | None:
    row = db.execute(
        text("SELECT name, city FROM libraries WHERE id = :id"),
        {"id": str(library_id)},
    ).mappings().first()
    return dict(row) if row else None


def get_cabin(db: Session, *, library_id: UUID, cabin_id: UUID) -> dict | None:
    row = db.execute(
        text(
            """
            SELECT c.id, c.library_id, c.room_category_id, rc.name AS room_category_name,
                   c.cabin_number, c.capacity, c.status
            FROM cabins c
            JOIN room_categories rc ON rc.id = c.room_category_id
            WHERE c.id = :id AND c.library_id = :library_id
            """
        ),
        {"id": str(cabin_id), "library_id": str(library_id)},
    ).mappings().first()
    return dict(row) if row else None


def category_belongs_to_library(db: Session, *, library_id: UUID, category_id: UUID) -> bool:
    return bool(
        db.execute(
            text("SELECT 1 FROM room_categories WHERE id = :id AND library_id = :library_id"),
            {"id": str(category_id), "library_id": str(library_id)},
        ).first()
    )


def categories_by_name(db: Session, *, library_id: UUID) -> dict[str, UUID]:
    """Case-insensitive name -> id map, for resolving CSV rows that reference
    a room category by its display name rather than UUID."""
    rows = db.execute(
        text("SELECT id, name FROM room_categories WHERE library_id = :library_id"),
        {"library_id": str(library_id)},
    ).all()
    return {r[1].strip().lower(): r[0] for r in rows}


def cabin_number_exists(db: Session, *, library_id: UUID, cabin_number: str) -> bool:
    return bool(
        db.execute(
            text("SELECT 1 FROM cabins WHERE library_id = :library_id AND cabin_number = :cabin_number"),
            {"library_id": str(library_id), "cabin_number": cabin_number},
        ).first()
    )


def existing_cabin_numbers(db: Session, *, library_id: UUID, cabin_numbers: list[str]) -> set[str]:
    if not cabin_numbers:
        return set()
    rows = db.execute(
        text("SELECT cabin_number FROM cabins WHERE library_id = :library_id AND cabin_number = ANY(:cabin_numbers)"),
        {"library_id": str(library_id), "cabin_numbers": cabin_numbers},
    ).all()
    return {r[0] for r in rows}


def bulk_create_cabins(db: Session, *, library_id: UUID, rows: list[dict]) -> int:
    """Insert many cabins in one round-trip. Each row dict has
    room_category_id, cabin_number, capacity. Caller must have already
    validated uniqueness and category ownership."""
    if not rows:
        return 0
    db.execute(
        text(
            """
            INSERT INTO cabins (library_id, room_category_id, cabin_number, capacity)
            VALUES (:library_id, :room_category_id, :cabin_number, :capacity)
            """
        ),
        [
            {
                "library_id": str(library_id),
                "room_category_id": str(row["room_category_id"]),
                "cabin_number": row["cabin_number"],
                "capacity": row["capacity"],
            }
            for row in rows
        ],
    )
    return len(rows)


def create_cabin(db: Session, *, library_id: UUID, payload) -> UUID:
    row = db.execute(
        text(
            """
            INSERT INTO cabins (library_id, room_category_id, cabin_number, capacity)
            VALUES (:library_id, :room_category_id, :cabin_number, :capacity)
            RETURNING id
            """
        ),
        {
            "library_id": str(library_id),
            "room_category_id": str(payload.room_category_id),
            "cabin_number": payload.cabin_number,
            "capacity": payload.capacity,
        },
    ).mappings().first()
    return row["id"]


def update_cabin(db: Session, *, library_id: UUID, cabin_id: UUID, payload) -> None:
    db.execute(
        text(
            """
            UPDATE cabins SET
                cabin_number = COALESCE(:cabin_number, cabin_number),
                capacity = COALESCE(:capacity, capacity),
                status = COALESCE(:status, status)
            WHERE id = :id AND library_id = :library_id
            """
        ),
        {
            "cabin_number": payload.cabin_number,
            "capacity": payload.capacity,
            "status": payload.status,
            "id": str(cabin_id),
            "library_id": str(library_id),
        },
    )


def has_active_student(db: Session, cabin_id: UUID) -> bool:
    return bool(
        db.execute(
            text("SELECT 1 FROM students WHERE cabin_id = :id AND deleted_at IS NULL"), {"id": str(cabin_id)}
        ).first()
    )


def delete_cabin(db: Session, *, library_id: UUID, cabin_id: UUID) -> None:
    db.execute(
        text("DELETE FROM cabins WHERE id = :id AND library_id = :library_id"),
        {"id": str(cabin_id), "library_id": str(library_id)},
    )
