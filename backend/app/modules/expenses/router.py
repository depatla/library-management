"""Expenses endpoints. Tenant-scoped under /libraries/{library_id}."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter

from app.core.deps import CurrentClaims, TenantDb
from app.core.pagination import Page, PageQuery
from app.modules.expenses import service
from app.modules.expenses.schemas import (
    ExpenseCategoryCreate,
    ExpenseCategoryOut,
    ExpenseCreate,
    ExpenseOut,
    ExpenseUpdate,
)

router = APIRouter(prefix="/libraries/{library_id}", tags=["expenses"])


@router.get("/expense-categories", response_model=list[ExpenseCategoryOut])
def list_expense_categories(library_id: UUID, db: TenantDb) -> list[ExpenseCategoryOut]:
    return service.list_categories(db, library_id)


@router.post("/expense-categories", response_model=ExpenseCategoryOut, status_code=201)
def create_expense_category(library_id: UUID, payload: ExpenseCategoryCreate, db: TenantDb) -> ExpenseCategoryOut:
    return service.create_category(db, library_id=library_id, name=payload.name)


@router.get("/expenses", response_model=Page[ExpenseOut])
def list_expenses(
    library_id: UUID,
    db: TenantDb,
    page_params: PageQuery,
    category_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> Page[ExpenseOut]:
    return service.list_expenses(db, library_id=library_id, category_id=category_id, date_from=date_from, date_to=date_to, params=page_params)


@router.post("/expenses", response_model=ExpenseOut, status_code=201)
def create_expense(library_id: UUID, payload: ExpenseCreate, claims: CurrentClaims, db: TenantDb) -> ExpenseOut:
    return service.create_expense(db, library_id=library_id, recorded_by=UUID(claims["sub"]), payload=payload)


@router.get("/expenses/{expense_id}", response_model=ExpenseOut)
def get_expense(library_id: UUID, expense_id: UUID, db: TenantDb) -> ExpenseOut:
    return service.get_expense(db, library_id=library_id, expense_id=expense_id)


@router.patch("/expenses/{expense_id}", response_model=ExpenseOut)
def update_expense(library_id: UUID, expense_id: UUID, payload: ExpenseUpdate, db: TenantDb) -> ExpenseOut:
    return service.update_expense(db, library_id=library_id, expense_id=expense_id, payload=payload)


@router.delete("/expenses/{expense_id}", status_code=204)
def delete_expense(library_id: UUID, expense_id: UUID, db: TenantDb) -> None:
    service.delete_expense(db, library_id=library_id, expense_id=expense_id)
