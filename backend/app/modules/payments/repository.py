"""Payments module repository — raw SQL via SQLAlchemy Core."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def student_belongs_to_library(db: Session, *, library_id: UUID, student_id: UUID) -> bool:
    return bool(
        db.execute(
            text("SELECT 1 FROM students WHERE id = :id AND library_id = :library_id AND deleted_at IS NULL"),
            {"id": str(student_id), "library_id": str(library_id)},
        ).first()
    )


def create_payment(
    db: Session,
    *,
    library_id: UUID,
    collected_by: UUID,
    student_id: UUID,
    amount,
    frequency: str,
    period_start,
    period_end,
    payment_method: str,
    transaction_reference: str | None,
    notes: str | None,
) -> UUID:
    row = db.execute(
        text(
            """
            INSERT INTO payments (
                library_id, student_id, amount, frequency, period_start, period_end,
                payment_method, transaction_reference, collected_by, notes
            ) VALUES (
                :library_id, :student_id, :amount, :frequency, :period_start, :period_end,
                :payment_method, :transaction_reference, :collected_by, :notes
            )
            RETURNING id
            """
        ),
        {
            "library_id": str(library_id),
            "student_id": str(student_id),
            "amount": amount,
            "frequency": frequency,
            "period_start": period_start,
            "period_end": period_end,
            "payment_method": payment_method,
            "transaction_reference": transaction_reference,
            "collected_by": str(collected_by),
            "notes": notes,
        },
    ).mappings().first()
    return row["id"]


def create_allocation(db: Session, *, payment_id: UUID, library_id: UUID, student_id: UUID, period_month, allocated_amount, is_prorated: bool) -> None:
    db.execute(
        text(
            """
            INSERT INTO payment_allocations (payment_id, library_id, student_id, period_month, allocated_amount, is_prorated)
            VALUES (:payment_id, :library_id, :student_id, :period_month, :allocated_amount, :is_prorated)
            """
        ),
        {
            "payment_id": str(payment_id),
            "library_id": str(library_id),
            "student_id": str(student_id),
            "period_month": period_month,
            "allocated_amount": allocated_amount,
            "is_prorated": is_prorated,
        },
    )


_SELECT_PAYMENT = """
    SELECT p.id, p.library_id, p.student_id, s.full_name AS student_name, p.amount, p.frequency,
           p.period_start, p.period_end, p.payment_method, p.transaction_reference, p.notes,
           p.collected_by, cu.full_name AS collected_by_name, p.paid_at
    FROM payments p
    JOIN students s ON s.id = p.student_id
    LEFT JOIN users cu ON cu.id = p.collected_by
"""


def get_payment(db: Session, *, library_id: UUID, payment_id: UUID) -> dict | None:
    row = db.execute(
        text(_SELECT_PAYMENT + " WHERE p.id = :id AND p.library_id = :library_id"),
        {"id": str(payment_id), "library_id": str(library_id)},
    ).mappings().first()
    return dict(row) if row else None


def get_allocations(db: Session, payment_id: UUID) -> list[dict]:
    rows = db.execute(
        text("SELECT period_month, allocated_amount, is_prorated FROM payment_allocations WHERE payment_id = :id ORDER BY period_month"),
        {"id": str(payment_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def list_payments(
    db: Session, *, library_id: UUID, student_id: UUID | None, search: str | None, date_from, date_to, limit: int, offset: int
) -> tuple[list[dict], int]:
    """Lists payments with `amount` reduced to the portion allocated within
    [date_from, date_to] (by coverage month, not transaction date) — a payment
    spanning two calendar months shows only the slice that falls in range.
    Payments with no allocation in range are excluded via the INNER JOIN."""
    rows = db.execute(
        text(
            """
            SELECT p.id, p.library_id, p.student_id, s.full_name AS student_name, agg.amount, p.frequency,
                   p.period_start, p.period_end, p.payment_method, p.transaction_reference, p.notes,
                   p.collected_by, cu.full_name AS collected_by_name, p.paid_at,
                   count(*) OVER() AS total_count
            FROM payments p
            JOIN students s ON s.id = p.student_id
            LEFT JOIN users cu ON cu.id = p.collected_by
            JOIN (
                SELECT payment_id, SUM(allocated_amount) AS amount
                FROM payment_allocations
                WHERE (CAST(:date_from AS DATE) IS NULL OR period_month >= CAST(:date_from AS DATE))
                  AND (CAST(:date_to AS DATE) IS NULL OR period_month <= CAST(:date_to AS DATE))
                GROUP BY payment_id
            ) agg ON agg.payment_id = p.id
            WHERE p.library_id = :library_id
              AND (CAST(:student_id AS UUID) IS NULL OR p.student_id = CAST(:student_id AS UUID))
              AND (CAST(:search AS TEXT) IS NULL OR s.full_name ILIKE :search_pattern)
            ORDER BY p.paid_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {
            "library_id": str(library_id),
            "student_id": str(student_id) if student_id else None,
            "search": search,
            "search_pattern": f"%{search}%" if search else None,
            "date_from": date_from,
            "date_to": date_to,
            "limit": limit,
            "offset": offset,
        },
    ).mappings().all()
    total = rows[0]["total_count"] if rows else 0
    return [dict(r) for r in rows], total


def any_allocation_month_settled(db: Session, payment_id: UUID) -> bool:
    """A payment cannot be deleted if any of its allocation months already has a
    finalized (settled) partner settlement for this library — keeps settlement
    history auditable/immutable once paid out."""
    return bool(
        db.execute(
            text(
                """
                SELECT 1
                FROM payment_allocations pa
                JOIN partner_settlements ps ON ps.library_id = pa.library_id AND ps.period_month = pa.period_month
                WHERE pa.payment_id = :payment_id AND ps.settled_at IS NOT NULL
                """
            ),
            {"payment_id": str(payment_id)},
        ).first()
    )


def delete_payment(db: Session, *, library_id: UUID, payment_id: UUID) -> None:
    db.execute(text("DELETE FROM payments WHERE id = :id AND library_id = :library_id"), {"id": str(payment_id), "library_id": str(library_id)})


def revenue_for_month(db: Session, *, library_id: UUID, period_month) -> float:
    row = db.execute(
        text("SELECT COALESCE(SUM(allocated_amount), 0) FROM payment_allocations WHERE library_id = :library_id AND period_month = :period_month"),
        {"library_id": str(library_id), "period_month": period_month},
    ).first()
    return float(row[0])


def revenue_this_month_count_and_sum(db: Session, library_id: UUID) -> float:
    row = db.execute(
        text(
            """
            SELECT COALESCE(SUM(allocated_amount), 0) FROM payment_allocations
            WHERE library_id = :library_id AND period_month = date_trunc('month', CURRENT_DATE)::date
            """
        ),
        {"library_id": str(library_id)},
    ).first()
    return float(row[0])
