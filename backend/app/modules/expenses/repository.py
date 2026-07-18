"""Expenses module repository — raw SQL via SQLAlchemy Core."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def list_categories(db: Session, library_id: UUID) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT id, library_id, name, is_default
            FROM expense_categories
            WHERE library_id = :library_id OR library_id IS NULL
            ORDER BY is_default DESC, name
            """
        ),
        {"library_id": str(library_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def category_belongs_to_library_or_global(db: Session, *, library_id: UUID, category_id: UUID) -> bool:
    return bool(
        db.execute(
            text("SELECT 1 FROM expense_categories WHERE id = :id AND (library_id = :library_id OR library_id IS NULL)"),
            {"id": str(category_id), "library_id": str(library_id)},
        ).first()
    )


def create_category(db: Session, *, library_id: UUID, name: str) -> dict:
    row = db.execute(
        text(
            """
            INSERT INTO expense_categories (library_id, name, is_default)
            VALUES (:library_id, :name, false)
            RETURNING id, library_id, name, is_default
            """
        ),
        {"library_id": str(library_id), "name": name},
    ).mappings().first()
    return dict(row)


_SELECT_EXPENSE = """
    SELECT e.id, e.library_id, e.category_id, c.name AS category_name, e.amount, e.expense_date,
           e.description, e.receipt_url, e.paid_to, e.recorded_by, ru.full_name AS recorded_by_name
    FROM expenses e
    JOIN expense_categories c ON c.id = e.category_id
    LEFT JOIN users ru ON ru.id = e.recorded_by
"""

_SELECT_EXPENSE_WITH_COUNT = """
    SELECT e.id, e.library_id, e.category_id, c.name AS category_name, e.amount, e.expense_date,
           e.description, e.receipt_url, e.paid_to, e.recorded_by, ru.full_name AS recorded_by_name,
           count(*) OVER() AS total_count
    FROM expenses e
    JOIN expense_categories c ON c.id = e.category_id
    LEFT JOIN users ru ON ru.id = e.recorded_by
"""


def list_expenses(db: Session, *, library_id: UUID, category_id: UUID | None, date_from, date_to, limit: int, offset: int) -> tuple[list[dict], int]:
    rows = db.execute(
        text(
            _SELECT_EXPENSE_WITH_COUNT
            + """
            WHERE e.library_id = :library_id
              AND (CAST(:category_id AS UUID) IS NULL OR e.category_id = CAST(:category_id AS UUID))
              AND (CAST(:date_from AS DATE) IS NULL OR e.expense_date >= CAST(:date_from AS DATE))
              AND (CAST(:date_to AS DATE) IS NULL OR e.expense_date <= CAST(:date_to AS DATE))
            ORDER BY e.expense_date DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {
            "library_id": str(library_id),
            "category_id": str(category_id) if category_id else None,
            "date_from": date_from,
            "date_to": date_to,
            "limit": limit,
            "offset": offset,
        },
    ).mappings().all()
    total = rows[0]["total_count"] if rows else 0
    return [dict(r) for r in rows], total


def get_expense(db: Session, *, library_id: UUID, expense_id: UUID) -> dict | None:
    row = db.execute(
        text(_SELECT_EXPENSE + " WHERE e.id = :id AND e.library_id = :library_id"),
        {"id": str(expense_id), "library_id": str(library_id)},
    ).mappings().first()
    return dict(row) if row else None


def create_expense(db: Session, *, library_id: UUID, recorded_by: UUID, payload) -> UUID:
    row = db.execute(
        text(
            """
            INSERT INTO expenses (library_id, category_id, amount, expense_date, description, receipt_url, paid_to, recorded_by)
            VALUES (:library_id, :category_id, :amount, :expense_date, :description, :receipt_url, :paid_to, :recorded_by)
            RETURNING id
            """
        ),
        {
            "library_id": str(library_id),
            "category_id": str(payload.category_id),
            "amount": payload.amount,
            "expense_date": payload.expense_date,
            "description": payload.description,
            "receipt_url": payload.receipt_url,
            "paid_to": payload.paid_to,
            "recorded_by": str(recorded_by),
        },
    ).mappings().first()
    return row["id"]


def update_expense(db: Session, *, library_id: UUID, expense_id: UUID, payload) -> None:
    db.execute(
        text(
            """
            UPDATE expenses SET
                category_id = COALESCE(:category_id, category_id),
                amount = COALESCE(:amount, amount),
                expense_date = COALESCE(:expense_date, expense_date),
                description = COALESCE(:description, description),
                receipt_url = COALESCE(:receipt_url, receipt_url),
                paid_to = COALESCE(:paid_to, paid_to)
            WHERE id = :id AND library_id = :library_id
            """
        ),
        {
            "category_id": str(payload.category_id) if payload.category_id else None,
            "amount": payload.amount,
            "expense_date": payload.expense_date,
            "description": payload.description,
            "receipt_url": payload.receipt_url,
            "paid_to": payload.paid_to,
            "id": str(expense_id),
            "library_id": str(library_id),
        },
    )


def delete_expense(db: Session, *, library_id: UUID, expense_id: UUID) -> None:
    db.execute(text("DELETE FROM expenses WHERE id = :id AND library_id = :library_id"), {"id": str(expense_id), "library_id": str(library_id)})


def expenses_for_month(db: Session, *, library_id: UUID, period_month) -> float:
    row = db.execute(
        text(
            """
            SELECT COALESCE(SUM(amount), 0) FROM expenses
            WHERE library_id = :library_id AND date_trunc('month', expense_date) = :period_month
            """
        ),
        {"library_id": str(library_id), "period_month": period_month},
    ).first()
    return float(row[0])


def expenses_this_month(db: Session, library_id: UUID) -> float:
    row = db.execute(
        text(
            """
            SELECT COALESCE(SUM(amount), 0) FROM expenses
            WHERE library_id = :library_id AND date_trunc('month', expense_date) = date_trunc('month', CURRENT_DATE)
            """
        ),
        {"library_id": str(library_id)},
    ).first()
    return float(row[0])
