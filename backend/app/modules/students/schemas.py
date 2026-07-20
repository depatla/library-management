"""Pydantic request/response models for students."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class StudentCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=1, max_length=20)
    whatsapp_number: str | None = None
    email: str | None = None
    gender: str | None = None
    address: str | None = None
    photo_url: str | None = None
    id_proof_url: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    cabin_id: UUID | None = None
    locker_id: UUID | None = None


class StudentUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    whatsapp_number: str | None = None
    email: str | None = None
    gender: str | None = None
    address: str | None = None
    photo_url: str | None = None
    id_proof_url: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None


class StudentStatusUpdate(BaseModel):
    status: str


class AssignCabinRequest(BaseModel):
    cabin_id: UUID | None = None


class AssignLockerRequest(BaseModel):
    locker_id: UUID | None = None


class StudentBulkUploadRowError(BaseModel):
    row_number: int
    name: str | None
    error: str


class StudentBulkUploadResult(BaseModel):
    created_count: int
    error_count: int
    errors: list[StudentBulkUploadRowError]


class PendingPaymentStudentOut(BaseModel):
    id: UUID
    full_name: str
    phone: str
    whatsapp_number: str | None
    cabin_number: str | None
    expiry_date: date


class StudentOut(BaseModel):
    id: UUID
    library_id: UUID
    cabin_id: UUID | None
    cabin_number: str | None
    room_category_name: str | None
    locker_id: UUID | None
    locker_number: str | None
    full_name: str
    phone: str
    whatsapp_number: str | None
    email: str | None
    gender: str | None
    address: str | None
    photo_url: str | None
    id_proof_url: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    joined_date: date | None
    expiry_date: date | None
    status: str
    created_by: UUID | None
    created_by_name: str | None
