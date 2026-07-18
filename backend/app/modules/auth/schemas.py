"""Pydantic request/response models for the Auth module."""

from uuid import UUID

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class MembershipOut(BaseModel):
    library_id: UUID
    library_name: str
    library_status: str
    role: str


class UserOut(BaseModel):
    id: UUID
    full_name: str
    email: str
    is_super_admin: bool
    memberships: list[MembershipOut]


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
