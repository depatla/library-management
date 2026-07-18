"""Gathers a small, fixed-shape context struct for the Grok assistant —
scalar aggregates only, never raw rows, to keep token cost and data exposure
minimal (the assistant should answer from a summary, not the whole schema)."""

from datetime import date
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def gather_context(db: Session, library_id: UUID) -> dict:
    row = db.execute(
        text(
            """
            SELECT
                lib.name AS library_name,
                (SELECT count(*) FROM students WHERE library_id = :library_id AND status = 'active' AND deleted_at IS NULL) AS active_students,
                (SELECT count(*) FROM cabins WHERE library_id = :library_id) AS total_cabins,
                (SELECT count(*) FROM cabins WHERE library_id = :library_id AND status = 'occupied') AS occupied_cabins,
                (SELECT count(*) FROM lockers WHERE library_id = :library_id) AS total_lockers,
                (SELECT count(*) FROM lockers WHERE library_id = :library_id AND status = 'occupied') AS occupied_lockers,
                (SELECT COALESCE(SUM(allocated_amount), 0) FROM payment_allocations
                    WHERE library_id = :library_id AND period_month = date_trunc('month', CURRENT_DATE)) AS revenue_this_month,
                (SELECT COALESCE(SUM(amount), 0) FROM expenses
                    WHERE library_id = :library_id AND date_trunc('month', expense_date) = date_trunc('month', CURRENT_DATE)) AS expenses_this_month,
                (SELECT count(*) FROM students s
                    JOIN (
                        SELECT student_id, MAX(period_end) AS expiry_date
                        FROM payments
                        GROUP BY student_id
                    ) pay ON pay.student_id = s.id
                    WHERE s.library_id = :library_id AND s.status = 'active' AND s.deleted_at IS NULL
                      AND pay.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS students_expiring_7d
            FROM libraries lib
            WHERE lib.id = :library_id
            """
        ),
        {"library_id": str(library_id)},
    ).mappings().first()

    context = dict(row)
    context["revenue_this_month"] = float(context["revenue_this_month"])
    context["expenses_this_month"] = float(context["expenses_this_month"])
    context["as_of"] = date.today().isoformat()
    return context
