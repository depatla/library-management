"""Lockers module repository — raw SQL via SQLAlchemy Core."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def list_lockers(db: Session, *, library_id: UUID, status: str | None, limit: int, offset: int) -> tuple[list[dict], int]:
    rows = db.execute(
        text(
            """
            SELECT id, library_id, locker_number, monthly_rent, status, count(*) OVER() AS total_count
            FROM lockers
            WHERE library_id = :library_id AND (CAST(:status AS cabin_status) IS NULL OR status = CAST(:status AS cabin_status))
            ORDER BY locker_number
            LIMIT :limit OFFSET :offset
            """
        ),
        {"library_id": str(library_id), "status": status, "limit": limit, "offset": offset},
    ).mappings().all()
    total = rows[0]["total_count"] if rows else 0
    return [dict(r) for r in rows], total


def get_locker(db: Session, *, library_id: UUID, locker_id: UUID) -> dict | None:
    row = db.execute(
        text("SELECT id, library_id, locker_number, monthly_rent, status FROM lockers WHERE id = :id AND library_id = :library_id"),
        {"id": str(locker_id), "library_id": str(library_id)},
    ).mappings().first()
    return dict(row) if row else None


def locker_number_exists(db: Session, *, library_id: UUID, locker_number: str) -> bool:
    return bool(
        db.execute(
            text("SELECT 1 FROM lockers WHERE library_id = :library_id AND locker_number = :locker_number"),
            {"library_id": str(library_id), "locker_number": locker_number},
        ).first()
    )


def create_locker(db: Session, *, library_id: UUID, payload) -> UUID:
    row = db.execute(
        text(
            """
            INSERT INTO lockers (library_id, locker_number, monthly_rent)
            VALUES (:library_id, :locker_number, :monthly_rent)
            RETURNING id
            """
        ),
        {"library_id": str(library_id), "locker_number": payload.locker_number, "monthly_rent": payload.monthly_rent},
    ).mappings().first()
    return row["id"]


def update_locker(db: Session, *, library_id: UUID, locker_id: UUID, payload) -> None:
    db.execute(
        text(
            """
            UPDATE lockers SET
                locker_number = COALESCE(:locker_number, locker_number),
                monthly_rent = COALESCE(:monthly_rent, monthly_rent),
                status = COALESCE(:status, status)
            WHERE id = :id AND library_id = :library_id
            """
        ),
        {
            "locker_number": payload.locker_number,
            "monthly_rent": payload.monthly_rent,
            "status": payload.status,
            "id": str(locker_id),
            "library_id": str(library_id),
        },
    )


def has_active_student(db: Session, locker_id: UUID) -> bool:
    return bool(
        db.execute(
            text("SELECT 1 FROM students WHERE locker_id = :id AND deleted_at IS NULL"), {"id": str(locker_id)}
        ).first()
    )


def existing_locker_numbers(db: Session, *, library_id: UUID, locker_numbers: list[str]) -> set[str]:
    if not locker_numbers:
        return set()
    rows = db.execute(
        text("SELECT locker_number FROM lockers WHERE library_id = :library_id AND locker_number = ANY(:locker_numbers)"),
        {"library_id": str(library_id), "locker_numbers": locker_numbers},
    ).all()
    return {r[0] for r in rows}


def bulk_create_lockers(db: Session, *, library_id: UUID, rows: list[dict]) -> int:
    """Insert many lockers in one round-trip. Each row dict has
    locker_number, monthly_rent. Caller must have already validated
    uniqueness."""
    if not rows:
        return 0
    db.execute(
        text(
            """
            INSERT INTO lockers (library_id, locker_number, monthly_rent)
            VALUES (:library_id, :locker_number, :monthly_rent)
            """
        ),
        [
            {
                "library_id": str(library_id),
                "locker_number": row["locker_number"],
                "monthly_rent": row["monthly_rent"],
            }
            for row in rows
        ],
    )
    return len(rows)


def delete_locker(db: Session, *, library_id: UUID, locker_id: UUID) -> None:
    db.execute(
        text("DELETE FROM lockers WHERE id = :id AND library_id = :library_id"),
        {"id": str(locker_id), "library_id": str(library_id)},
    )
