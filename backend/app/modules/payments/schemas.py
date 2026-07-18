"""Pydantic request/response models for payments.

A single "record payment" request can produce several `payments` rows: when
frequency is 'monthly' with number_of_months > 1, one payment is created per
calendar month (each independently editable/deletable), rather than a single
payment spanning multiple months.
"""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class PaymentCreate(BaseModel):
    student_id: UUID
    amount: Decimal = Field(gt=0)
    frequency: str
    period_start: date
    period_end: date | None = None
    number_of_months: int | None = Field(default=None, ge=1, le=6)
    payment_method: str
    transaction_reference: str | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _check_period(self) -> "PaymentCreate":
        if self.frequency == "monthly":
            if self.number_of_months is None:
                raise ValueError("number_of_months is required for monthly payments")
        elif self.period_end is None:
            raise ValueError("period_end is required for daily payments")
        return self


class AllocationOut(BaseModel):
    period_month: date
    allocated_amount: Decimal
    is_prorated: bool


class PaymentOut(BaseModel):
    id: UUID
    library_id: UUID
    student_id: UUID
    student_name: str
    amount: Decimal
    frequency: str
    period_start: date
    period_end: date
    payment_method: str
    transaction_reference: str | None
    notes: str | None
    collected_by: UUID
    collected_by_name: str | None
    paid_at: str
    allocations: list[AllocationOut]

