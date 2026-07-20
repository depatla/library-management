"""Students module repository — raw SQL via SQLAlchemy Core.

`joined_date`/`expiry_date` are not columns on `students` — they're derived
live from `payments` (MIN(period_start)/MAX(period_end) per student), since
students pay under different cadences (daily/monthly/multi-month) and a
student with no payments yet has no expiry and stays active.
"""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

_PAYMENT_DATES_JOIN = """
    LEFT JOIN (
        SELECT student_id, MIN(period_start) AS joined_date, MAX(period_end) AS expiry_date
        FROM payments
        GROUP BY student_id
    ) pay ON pay.student_id = s.id
"""

_SELECT_STUDENT = f"""
    SELECT s.id, s.library_id, s.cabin_id, c.cabin_number, rc.name AS room_category_name, s.locker_id, l.locker_number,
           s.full_name, s.phone, s.whatsapp_number, s.email, s.gender, s.address,
           s.photo_url, s.id_proof_url, s.emergency_contact_name, s.emergency_contact_phone,
           pay.joined_date, pay.expiry_date, s.status, s.created_by, cu.full_name AS created_by_name
    FROM students s
    LEFT JOIN cabins c ON c.id = s.cabin_id
    LEFT JOIN room_categories rc ON rc.id = c.room_category_id
    LEFT JOIN lockers l ON l.id = s.locker_id
    LEFT JOIN users cu ON cu.id = s.created_by
    {_PAYMENT_DATES_JOIN}
"""


def list_students(
    db: Session, *, library_id: UUID, status: str | None, search: str | None, expiring_before, limit: int, offset: int
) -> tuple[list[dict], int]:
    rows = db.execute(
        text(
            f"""
            SELECT s.id, s.library_id, s.cabin_id, c.cabin_number, rc.name AS room_category_name, s.locker_id, l.locker_number,
                   s.full_name, s.phone, s.whatsapp_number, s.email, s.gender, s.address,
                   s.photo_url, s.id_proof_url, s.emergency_contact_name, s.emergency_contact_phone,
                   pay.joined_date, pay.expiry_date, s.status, s.created_by, cu.full_name AS created_by_name,
                   count(*) OVER() AS total_count
            FROM students s
            LEFT JOIN cabins c ON c.id = s.cabin_id
            LEFT JOIN room_categories rc ON rc.id = c.room_category_id
            LEFT JOIN lockers l ON l.id = s.locker_id
            LEFT JOIN users cu ON cu.id = s.created_by
            {_PAYMENT_DATES_JOIN}
            WHERE s.library_id = :library_id AND s.deleted_at IS NULL
              AND (CAST(:status AS student_status) IS NULL OR s.status = CAST(:status AS student_status))
              AND (CAST(:search AS TEXT) IS NULL OR s.full_name ILIKE :search_pattern OR s.phone ILIKE :search_pattern)
              AND (CAST(:expiring_before AS DATE) IS NULL OR pay.expiry_date <= CAST(:expiring_before AS DATE))
            ORDER BY (pay.expiry_date IS NOT NULL AND pay.expiry_date < CURRENT_DATE) DESC, s.full_name
            LIMIT :limit OFFSET :offset
            """
        ),
        {
            "library_id": str(library_id),
            "status": status,
            "search": search,
            "search_pattern": f"%{search}%" if search else None,
            "expiring_before": expiring_before,
            "limit": limit,
            "offset": offset,
        },
    ).mappings().all()
    total = rows[0]["total_count"] if rows else 0
    return [dict(r) for r in rows], total


def get_student(db: Session, *, library_id: UUID, student_id: UUID) -> dict | None:
    row = db.execute(
        text(_SELECT_STUDENT + " WHERE s.id = :id AND s.library_id = :library_id AND s.deleted_at IS NULL"),
        {"id": str(student_id), "library_id": str(library_id)},
    ).mappings().first()
    return dict(row) if row else None


def phone_exists(db: Session, *, library_id: UUID, phone: str) -> bool:
    return bool(
        db.execute(
            text("SELECT 1 FROM students WHERE library_id = :library_id AND phone = :phone AND deleted_at IS NULL"),
            {"library_id": str(library_id), "phone": phone},
        ).first()
    )


def create_student(db: Session, *, library_id: UUID, created_by: UUID, payload) -> UUID:
    row = db.execute(
        text(
            """
            INSERT INTO students (
                library_id, cabin_id, locker_id, full_name, phone, whatsapp_number, email, gender, address,
                photo_url, id_proof_url, emergency_contact_name, emergency_contact_phone, created_by
            ) VALUES (
                :library_id, :cabin_id, :locker_id, :full_name, :phone, :whatsapp_number, :email, :gender, :address,
                :photo_url, :id_proof_url, :emergency_contact_name, :emergency_contact_phone, :created_by
            )
            RETURNING id
            """
        ),
        {
            "library_id": str(library_id),
            "cabin_id": str(payload.cabin_id) if payload.cabin_id else None,
            "locker_id": str(payload.locker_id) if payload.locker_id else None,
            "full_name": payload.full_name,
            "phone": payload.phone,
            "whatsapp_number": payload.whatsapp_number,
            "email": payload.email,
            "gender": payload.gender,
            "address": payload.address,
            "photo_url": payload.photo_url,
            "id_proof_url": payload.id_proof_url,
            "emergency_contact_name": payload.emergency_contact_name,
            "emergency_contact_phone": payload.emergency_contact_phone,
            "created_by": str(created_by),
        },
    ).mappings().first()
    return row["id"]


def update_student(db: Session, *, library_id: UUID, student_id: UUID, payload) -> None:
    db.execute(
        text(
            """
            UPDATE students SET
                full_name = COALESCE(:full_name, full_name),
                phone = COALESCE(:phone, phone),
                whatsapp_number = COALESCE(:whatsapp_number, whatsapp_number),
                email = COALESCE(:email, email),
                gender = COALESCE(:gender, gender),
                address = COALESCE(:address, address),
                photo_url = COALESCE(:photo_url, photo_url),
                id_proof_url = COALESCE(:id_proof_url, id_proof_url),
                emergency_contact_name = COALESCE(:emergency_contact_name, emergency_contact_name),
                emergency_contact_phone = COALESCE(:emergency_contact_phone, emergency_contact_phone)
            WHERE id = :id AND library_id = :library_id
            """
        ),
        {
            "full_name": payload.full_name,
            "phone": payload.phone,
            "whatsapp_number": payload.whatsapp_number,
            "email": payload.email,
            "gender": payload.gender,
            "address": payload.address,
            "photo_url": payload.photo_url,
            "id_proof_url": payload.id_proof_url,
            "emergency_contact_name": payload.emergency_contact_name,
            "emergency_contact_phone": payload.emergency_contact_phone,
            "id": str(student_id),
            "library_id": str(library_id),
        },
    )


def set_status(db: Session, *, library_id: UUID, student_id: UUID, status: str) -> None:
    db.execute(
        text("UPDATE students SET status = :status WHERE id = :id AND library_id = :library_id"),
        {"status": status, "id": str(student_id), "library_id": str(library_id)},
    )


def soft_delete_student(db: Session, *, library_id: UUID, student_id: UUID) -> None:
    db.execute(
        text("UPDATE students SET deleted_at = now() WHERE id = :id AND library_id = :library_id"),
        {"id": str(student_id), "library_id": str(library_id)},
    )


def assign_cabin(db: Session, *, library_id: UUID, student_id: UUID, cabin_id: UUID | None, previous_cabin_id: UUID | None) -> None:
    db.execute(
        text("UPDATE students SET cabin_id = :cabin_id WHERE id = :id AND library_id = :library_id"),
        {"cabin_id": str(cabin_id) if cabin_id else None, "id": str(student_id), "library_id": str(library_id)},
    )
    if previous_cabin_id:
        db.execute(text("UPDATE cabins SET status = 'available' WHERE id = :id"), {"id": str(previous_cabin_id)})
    if cabin_id:
        db.execute(text("UPDATE cabins SET status = 'occupied' WHERE id = :id"), {"id": str(cabin_id)})


def assign_locker(db: Session, *, library_id: UUID, student_id: UUID, locker_id: UUID | None, previous_locker_id: UUID | None) -> None:
    db.execute(
        text("UPDATE students SET locker_id = :locker_id WHERE id = :id AND library_id = :library_id"),
        {"locker_id": str(locker_id) if locker_id else None, "id": str(student_id), "library_id": str(library_id)},
    )
    if previous_locker_id:
        db.execute(text("UPDATE lockers SET status = 'available' WHERE id = :id"), {"id": str(previous_locker_id)})
    if locker_id:
        db.execute(text("UPDATE lockers SET status = 'occupied' WHERE id = :id"), {"id": str(locker_id)})


def cabin_available(db: Session, *, library_id: UUID, cabin_id: UUID) -> bool:
    return bool(
        db.execute(
            text("SELECT 1 FROM cabins WHERE id = :id AND library_id = :library_id AND status = 'available'"),
            {"id": str(cabin_id), "library_id": str(library_id)},
        ).first()
    )


def locker_available(db: Session, *, library_id: UUID, locker_id: UUID) -> bool:
    return bool(
        db.execute(
            text("SELECT 1 FROM lockers WHERE id = :id AND library_id = :library_id AND status = 'available'"),
            {"id": str(locker_id), "library_id": str(library_id)},
        ).first()
    )


def existing_phones(db: Session, *, library_id: UUID, phones: list[str]) -> set[str]:
    if not phones:
        return set()
    rows = db.execute(
        text(
            "SELECT phone FROM students WHERE library_id = :library_id AND phone = ANY(:phones) AND deleted_at IS NULL"
        ),
        {"library_id": str(library_id), "phones": phones},
    ).all()
    return {r[0] for r in rows}


def bulk_create_students(db: Session, *, library_id: UUID, created_by: UUID, rows: list[dict]) -> int:
    """Insert many students in one round-trip. Each row dict has
    full_name, phone, email, gender. Caller must have already validated
    uniqueness."""
    if not rows:
        return 0
    db.execute(
        text(
            """
            INSERT INTO students (library_id, full_name, phone, email, gender, created_by)
            VALUES (:library_id, :full_name, :phone, :email, :gender, :created_by)
            """
        ),
        [
            {
                "library_id": str(library_id),
                "full_name": row["full_name"],
                "phone": row["phone"],
                "email": row["email"],
                "gender": row["gender"],
                "created_by": str(created_by),
            }
            for row in rows
        ],
    )
    return len(rows)


def new_students_this_month_count(db: Session, library_id: UUID) -> int:
    row = db.execute(
        text(
            """
            SELECT count(*) FROM (
                SELECT p.student_id, MIN(p.period_start) AS joined_date
                FROM payments p
                JOIN students s ON s.id = p.student_id
                WHERE s.library_id = :library_id AND s.deleted_at IS NULL
                GROUP BY p.student_id
            ) sub
            WHERE date_trunc('month', joined_date) = date_trunc('month', CURRENT_DATE)
            """
        ),
        {"library_id": str(library_id)},
    ).first()
    return row[0]


def expire_overdue_students(db: Session) -> int:
    """Cross-tenant maintenance query for the daily scheduler job — intentionally
    runs against a plain (non-RLS) session since it operates across all libraries.
    Students with no payments have no derived expiry and are never touched here."""
    result = db.execute(
        text(
            """
            UPDATE students s SET status = 'expired'
            FROM (
                SELECT student_id, MAX(period_end) AS expiry_date
                FROM payments
                GROUP BY student_id
            ) pay
            WHERE s.id = pay.student_id
              AND pay.expiry_date < CURRENT_DATE
              AND s.status = 'active'
              AND s.deleted_at IS NULL
            """
        )
    )
    return result.rowcount


def list_pending_payment_students(db: Session, *, library_id: UUID) -> list[dict]:
    """Students whose derived expiry_date has already passed — the same
    'pending payment' set the Students grid highlights in red."""
    rows = db.execute(
        text(
            """
            SELECT s.id, s.full_name, s.phone, s.whatsapp_number, c.cabin_number, pay.expiry_date
            FROM students s
            LEFT JOIN cabins c ON c.id = s.cabin_id
            JOIN (
                SELECT student_id, MAX(period_end) AS expiry_date
                FROM payments
                GROUP BY student_id
            ) pay ON pay.student_id = s.id
            WHERE s.library_id = :library_id AND s.deleted_at IS NULL AND pay.expiry_date < CURRENT_DATE
            ORDER BY pay.expiry_date, s.full_name
            """
        ),
        {"library_id": str(library_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def students_expiring_within(db: Session, *, library_id: UUID, days: int) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT s.id, s.library_id, s.full_name, s.whatsapp_number, s.phone, pay.expiry_date
            FROM students s
            JOIN (
                SELECT student_id, MAX(period_end) AS expiry_date
                FROM payments
                GROUP BY student_id
            ) pay ON pay.student_id = s.id
            WHERE s.library_id = :library_id AND s.status = 'active' AND s.deleted_at IS NULL
              AND pay.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (:days || ' days')::interval
            """
        ),
        {"library_id": str(library_id), "days": days},
    ).mappings().all()
    return [dict(r) for r in rows]
