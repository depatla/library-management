"""Pydantic request/response models for staff management."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class StaffInviteRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    role_name: str = Field(pattern="^(library_owner|manager|staff)$")


class StaffRoleUpdate(BaseModel):
    role_name: str = Field(pattern="^(library_owner|manager|staff)$")


class StaffMemberOut(BaseModel):
    user_id: UUID
    full_name: str
    email: str
    role_name: str
    status: str
    invited_at: datetime
    joined_at: datetime | None
