"""Pydantic request/response models for the Libraries module."""

from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class CreateLibraryOwnerRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    phone: str | None = None
    password: str = Field(min_length=8)


class CreateLibraryRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    address_line1: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    primary_color: str = "#1976d2"
    secondary_color: str = "#9c27b0"
    theme_mode: str = "light"
    owner: CreateLibraryOwnerRequest


class LibraryOut(BaseModel):
    id: UUID
    name: str
    slug: str
    city: str | None
    status: str
    primary_color: str
    secondary_color: str
    theme_mode: str
    owner_id: UUID
    owner_name: str
    created_at: str


class UpdateLibraryThemeRequest(BaseModel):
    primary_color: str | None = None
    secondary_color: str | None = None
    theme_mode: str | None = None
