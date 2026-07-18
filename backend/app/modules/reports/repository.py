"""Reports module repository — pure read/aggregation queries, no writes."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def revenue_expense_series(db: Session, *, library_id: UUID, months: int) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT m.month,
                   COALESCE(rev.revenue, 0) AS revenue,
                   COALESCE(exp.expenses, 0) AS expenses
            FROM generate_series(
                date_trunc('month', CURRENT_DATE) - ((:months - 1) || ' months')::interval,
                date_trunc('month', CURRENT_DATE),
                '1 month'::interval
            ) AS m(month)
            LEFT JOIN (
                SELECT period_month, SUM(allocated_amount) AS revenue
                FROM payment_allocations
                WHERE library_id = :library_id
                GROUP BY period_month
            ) rev ON rev.period_month = m.month::date
            LEFT JOIN (
                SELECT date_trunc('month', expense_date) AS month, SUM(amount) AS expenses
                FROM expenses
                WHERE library_id = :library_id
                GROUP BY date_trunc('month', expense_date)
            ) exp ON exp.month = m.month
            ORDER BY m.month
            """
        ),
        {"library_id": str(library_id), "months": months},
    ).mappings().all()
    return [dict(r) for r in rows]


def occupancy_by_category(db: Session, library_id: UUID) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT rc.id AS room_category_id, rc.name AS room_category_name,
                   count(c.id) AS total_cabins,
                   count(c.id) FILTER (WHERE c.status = 'occupied') AS occupied_cabins
            FROM room_categories rc
            LEFT JOIN cabins c ON c.room_category_id = rc.id
            WHERE rc.library_id = :library_id
            GROUP BY rc.id, rc.name, rc.display_order
            ORDER BY rc.display_order, rc.name
            """
        ),
        {"library_id": str(library_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def locker_occupancy(db: Session, library_id: UUID) -> dict:
    row = db.execute(
        text(
            """
            SELECT count(*) AS total_lockers,
                   count(*) FILTER (WHERE status = 'occupied') AS occupied_lockers
            FROM lockers
            WHERE library_id = :library_id
            """
        ),
        {"library_id": str(library_id)},
    ).mappings().first()
    return dict(row)


def students_summary_series(db: Session, *, library_id: UUID, months: int) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT m.month,
                   count(s.id) FILTER (
                       WHERE date_trunc('month', pay.joined_date) = m.month
                   ) AS new_count,
                   count(s.id) FILTER (
                       WHERE s.status = 'active' AND date_trunc('month', pay.joined_date) <= m.month
                   ) AS active_count,
                   count(s.id) FILTER (
                       WHERE s.status = 'expired' AND date_trunc('month', pay.expiry_date) = m.month
                   ) AS expired_count
            FROM generate_series(
                date_trunc('month', CURRENT_DATE) - ((:months - 1) || ' months')::interval,
                date_trunc('month', CURRENT_DATE),
                '1 month'::interval
            ) AS m(month)
            LEFT JOIN students s ON s.library_id = :library_id AND s.deleted_at IS NULL
            LEFT JOIN (
                SELECT student_id, MIN(period_start) AS joined_date, MAX(period_end) AS expiry_date
                FROM payments
                GROUP BY student_id
            ) pay ON pay.student_id = s.id
            GROUP BY m.month
            ORDER BY m.month
            """
        ),
        {"library_id": str(library_id), "months": months},
    ).mappings().all()
    return [dict(r) for r in rows]


def contributions_series(db: Session, *, library_id: UUID, months: int) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT m.month, u.id AS user_id, u.full_name,
                   COALESCE(collected.amount, 0) AS collected_amount,
                   COALESCE(spent.amount, 0) AS spent_amount
            FROM generate_series(
                date_trunc('month', CURRENT_DATE) - ((:months - 1) || ' months')::interval,
                date_trunc('month', CURRENT_DATE),
                '1 month'::interval
            ) AS m(month)
            CROSS JOIN (
                SELECT DISTINCT u.id, u.full_name
                FROM users u
                JOIN user_library_memberships mem ON mem.user_id = u.id
                WHERE mem.library_id = :library_id
            ) u
            LEFT JOIN (
                SELECT collected_by, date_trunc('month', paid_at) AS month, SUM(amount) AS amount
                FROM payments
                WHERE library_id = :library_id
                GROUP BY collected_by, date_trunc('month', paid_at)
            ) collected ON collected.collected_by = u.id AND collected.month = m.month
            LEFT JOIN (
                SELECT recorded_by, date_trunc('month', expense_date) AS month, SUM(amount) AS amount
                FROM expenses
                WHERE library_id = :library_id
                GROUP BY recorded_by, date_trunc('month', expense_date)
            ) spent ON spent.recorded_by = u.id AND spent.month = m.month
            WHERE collected.amount IS NOT NULL OR spent.amount IS NOT NULL
            ORDER BY m.month, u.full_name
            """
        ),
        {"library_id": str(library_id), "months": months},
    ).mappings().all()
    return [dict(r) for r in rows]
