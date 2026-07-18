"""Pydantic request/response models for partners and settlements."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, model_validator


class PartnerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    phone: str | None = None
    share_percentage: Decimal = Field(gt=0, le=100)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8)
    user_id: UUID | None = None

    @model_validator(mode="after")
    def _check_credentials(self) -> "PartnerCreate":
        if self.email and not self.password and not self.user_id:
            raise ValueError("password is required to create login credentials for a new partner")
        return self


class PartnerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    phone: str | None = None
    share_percentage: Decimal | None = Field(default=None, gt=0, le=100)
    is_active: bool | None = None


class PartnerOut(BaseModel):
    id: UUID
    library_id: UUID
    user_id: UUID | None
    name: str
    phone: str | None
    share_percentage: Decimal
    is_active: bool
    email: str | None = None


class SettlementOut(BaseModel):
    id: UUID
    partner_id: UUID
    library_id: UUID
    period_month: date
    share_amount: Decimal
    received_amount: Decimal
    balance: Decimal
    settled_at: datetime | None
    notes: str | None


class RecordReceiptRequest(BaseModel):
    amount: Decimal = Field(gt=0)


class GrantLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
