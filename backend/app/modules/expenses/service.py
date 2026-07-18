"""Expenses business logic."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.core.pagination import Page, PageParams, make_page
from app.modules.expenses import repository
from app.modules.expenses.schemas import ExpenseCategoryOut, ExpenseOut


def list_categories(db: Session, library_id: UUID) -> list[ExpenseCategoryOut]:
    return [ExpenseCategoryOut(**row) for row in repository.list_categories(db, library_id)]


def create_category(db: Session, *, library_id: UUID, name: str) -> ExpenseCategoryOut:
    row = repository.create_category(db, library_id=library_id, name=name)
    db.commit()
    return ExpenseCategoryOut(**row)


def list_expenses(db: Session, *, library_id: UUID, category_id: UUID | None, date_from, date_to, params: PageParams) -> Page[ExpenseOut]:
    rows, total = repository.list_expenses(
        db, library_id=library_id, category_id=category_id, date_from=date_from, date_to=date_to, limit=params.limit, offset=params.offset
    )
    return make_page([ExpenseOut(**r) for r in rows], total, params)


def get_expense(db: Session, *, library_id: UUID, expense_id: UUID) -> ExpenseOut:
    row = repository.get_expense(db, library_id=library_id, expense_id=expense_id)
    if not row:
        raise NotFoundError("Expense not found")
    return ExpenseOut(**row)


def create_expense(db: Session, *, library_id: UUID, recorded_by: UUID, payload) -> ExpenseOut:
    if not repository.category_belongs_to_library_or_global(db, library_id=library_id, category_id=payload.category_id):
        raise NotFoundError("Expense category not found")
    expense_id = repository.create_expense(db, library_id=library_id, recorded_by=recorded_by, payload=payload)
    db.commit()
    return get_expense(db, library_id=library_id, expense_id=expense_id)


def update_expense(db: Session, *, library_id: UUID, expense_id: UUID, payload) -> ExpenseOut:
    existing = repository.get_expense(db, library_id=library_id, expense_id=expense_id)
    if not existing:
        raise NotFoundError("Expense not found")
    if payload.category_id and not repository.category_belongs_to_library_or_global(db, library_id=library_id, category_id=payload.category_id):
        raise NotFoundError("Expense category not found")
    repository.update_expense(db, library_id=library_id, expense_id=expense_id, payload=payload)
    db.commit()
    return get_expense(db, library_id=library_id, expense_id=expense_id)


def delete_expense(db: Session, *, library_id: UUID, expense_id: UUID) -> None:
    existing = repository.get_expense(db, library_id=library_id, expense_id=expense_id)
    if not existing:
        raise NotFoundError("Expense not found")
    repository.delete_expense(db, library_id=library_id, expense_id=expense_id)
    db.commit()
