"""Pydantic request/response models for lockers."""

from uuid import UUID

from pydantic import BaseModel, Field


class LockerCreate(BaseModel):
    locker_number: str = Field(min_length=1, max_length=20)
    monthly_rent: float = Field(default=0, ge=0)


class LockerUpdate(BaseModel):
    locker_number: str | None = None
    monthly_rent: float | None = Field(default=None, ge=0)
    status: str | None = None


class LockerOut(BaseModel):
    id: UUID
    library_id: UUID
    locker_number: str
    monthly_rent: float
    status: str


class AvailableLockerOut(BaseModel):
    locker_number: str
    monthly_rent: float


class LockerBulkUploadRowError(BaseModel):
    row_number: int
    locker_number: str | None
    error: str


class LockerBulkUploadResult(BaseModel):
    created_count: int
    error_count: int
    errors: list[LockerBulkUploadRowError]
