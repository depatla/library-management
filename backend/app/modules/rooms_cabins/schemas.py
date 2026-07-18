"""Pydantic request/response models for room categories and cabins."""

from uuid import UUID

from pydantic import BaseModel, Field


class RoomCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color_code: str | None = None
    is_ac: bool = True
    is_ac_locked: bool = False
    display_order: int = 0


class RoomCategoryUpdate(BaseModel):
    name: str | None = None
    color_code: str | None = None
    display_order: int | None = None


class RoomCategoryOut(BaseModel):
    id: UUID
    library_id: UUID
    name: str
    color_code: str | None
    is_ac: bool
    is_ac_locked: bool
    is_default: bool
    display_order: int


class BulkSeasonalFlipRequest(BaseModel):
    set_ac: bool


class CabinCreate(BaseModel):
    room_category_id: UUID
    cabin_number: str = Field(min_length=1, max_length=20)
    capacity: int = Field(default=1, gt=0)


class CabinUpdate(BaseModel):
    cabin_number: str | None = None
    capacity: int | None = Field(default=None, gt=0)
    status: str | None = None


class CabinOut(BaseModel):
    id: UUID
    library_id: UUID
    room_category_id: UUID
    room_category_name: str
    cabin_number: str
    capacity: int
    status: str


class CabinBulkUploadRowError(BaseModel):
    row_number: int
    cabin_number: str | None
    room_category: str | None
    error: str


class CabinBulkUploadResult(BaseModel):
    created_count: int
    error_count: int
    errors: list[CabinBulkUploadRowError]
