"""Pydantic request/response models for QR codes and the public surfaces they point to."""

from uuid import UUID

from pydantic import BaseModel, Field


class QrCodeGenerateRequest(BaseModel):
    type: str = Field(pattern="^(seat_availability|complaint)$")


class QrCodeOut(BaseModel):
    id: UUID
    library_id: UUID
    type: str
    target_path: str
    image_url: str | None
    is_active: bool


class QrCodeUpdate(BaseModel):
    is_active: bool


class PublicAvailabilityOut(BaseModel):
    total_cabins: int
    available_cabins: int
    total_lockers: int
    available_lockers: int


class PublicComplaintCreate(BaseModel):
    complaint_type: str = Field(pattern="^(complaint|suggestion)$")
    description: str = Field(min_length=1)
    student_id: UUID | None = None
    photo_url: str | None = None
