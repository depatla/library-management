"""Pydantic request/response models for expenses."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class ExpenseCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class ExpenseCategoryOut(BaseModel):
    id: UUID
    library_id: UUID | None
    name: str
    is_default: bool


class ExpenseCreate(BaseModel):
    category_id: UUID
    amount: Decimal = Field(gt=0)
    expense_date: date
    description: str | None = None
    receipt_url: str | None = None
    paid_to: str | None = None


class ExpenseUpdate(BaseModel):
    category_id: UUID | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    expense_date: date | None = None
    description: str | None = None
    receipt_url: str | None = None
    paid_to: str | None = None


class ExpenseOut(BaseModel):
    id: UUID
    library_id: UUID
    category_id: UUID
    category_name: str
    amount: Decimal
    expense_date: date
    description: str | None
    receipt_url: str | None
    paid_to: str | None
    recorded_by: UUID
    recorded_by_name: str | None
