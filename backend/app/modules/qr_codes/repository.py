"""QR codes module repository — raw SQL via SQLAlchemy Core.

Public-surface queries (availability, complaint creation) intentionally take a
plain `Session` (via `get_db`, no RLS session) since they're hit by
unauthenticated visitors scanning a physical QR code — isolation is enforced
by the explicit `library_id` filter in each query, not by RLS.
"""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

_SELECT_QR_CODE = """
    SELECT id, library_id, type, target_path, image_url, is_active
    FROM qr_codes
"""


def list_qr_codes(db: Session, library_id: UUID) -> list[dict]:
    rows = db.execute(
        text(_SELECT_QR_CODE + " WHERE library_id = :library_id ORDER BY type"),
        {"library_id": str(library_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def get_qr_code(db: Session, *, library_id: UUID, qr_code_id: UUID) -> dict | None:
    row = db.execute(
        text(_SELECT_QR_CODE + " WHERE id = :id AND library_id = :library_id"),
        {"id": str(qr_code_id), "library_id": str(library_id)},
    ).mappings().first()
    return dict(row) if row else None


def upsert_qr_code(db: Session, *, library_id: UUID, type: str, target_path: str, image_url: str) -> dict:
    row = db.execute(
        text(
            """
            INSERT INTO qr_codes (library_id, type, target_path, image_url, is_active)
            VALUES (:library_id, :type, :target_path, :image_url, true)
            ON CONFLICT (library_id, type) DO UPDATE
                SET target_path = EXCLUDED.target_path,
                    image_url = EXCLUDED.image_url,
                    is_active = true
            RETURNING id, library_id, type, target_path, image_url, is_active
            """
        ),
        {"library_id": str(library_id), "type": type, "target_path": target_path, "image_url": image_url},
    ).mappings().first()
    return dict(row)


def set_active(db: Session, *, library_id: UUID, qr_code_id: UUID, is_active: bool) -> None:
    db.execute(
        text("UPDATE qr_codes SET is_active = :is_active WHERE id = :id AND library_id = :library_id"),
        {"is_active": is_active, "id": str(qr_code_id), "library_id": str(library_id)},
    )


def library_exists(db: Session, library_id: UUID) -> bool:
    return bool(db.execute(text("SELECT 1 FROM libraries WHERE id = :id"), {"id": str(library_id)}).first())


def public_availability(db: Session, library_id: UUID) -> dict:
    row = db.execute(
        text(
            """
            SELECT
                (SELECT count(*) FROM cabins WHERE library_id = :library_id) AS total_cabins,
                (SELECT count(*) FROM cabins WHERE library_id = :library_id AND status = 'available') AS available_cabins,
                (SELECT count(*) FROM lockers WHERE library_id = :library_id) AS total_lockers,
                (SELECT count(*) FROM lockers WHERE library_id = :library_id AND status = 'available') AS available_lockers
            """
        ),
        {"library_id": str(library_id)},
    ).mappings().first()
    return dict(row)


def create_public_complaint(db: Session, *, library_id: UUID, payload) -> None:
    db.execute(
        text(
            """
            INSERT INTO complaints (library_id, student_id, complaint_type, description, photo_url)
            VALUES (:library_id, :student_id, :complaint_type, :description, :photo_url)
            """
        ),
        {
            "library_id": str(library_id),
            "student_id": str(payload.student_id) if payload.student_id else None,
            "complaint_type": payload.complaint_type,
            "description": payload.description,
            "photo_url": payload.photo_url,
        },
    )
    db.commit()
