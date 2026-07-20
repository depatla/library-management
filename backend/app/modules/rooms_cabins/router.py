"""Rooms & Cabins endpoints. All tenant-scoped under /libraries/{library_id}."""

from uuid import UUID

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import Response

from app.core.deps import TenantDb
from app.core.exceptions import ValidationDomainError
from app.core.pagination import Page, PageQuery
from app.modules.rooms_cabins import service
from app.modules.rooms_cabins.schemas import (
    AvailableCabinsGroupOut,
    BulkSeasonalFlipRequest,
    CabinBulkUploadResult,
    CabinCreate,
    CabinOut,
    CabinUpdate,
    RoomCategoryCreate,
    RoomCategoryOut,
    RoomCategoryUpdate,
)

router = APIRouter(prefix="/libraries/{library_id}", tags=["rooms-cabins"])


@router.get("/room-categories", response_model=list[RoomCategoryOut])
def list_room_categories(library_id: UUID, db: TenantDb) -> list[RoomCategoryOut]:
    return service.list_room_categories(db, library_id)


@router.post("/room-categories", response_model=RoomCategoryOut, status_code=201)
def create_room_category(library_id: UUID, payload: RoomCategoryCreate, db: TenantDb) -> RoomCategoryOut:
    return service.create_room_category(db, library_id=library_id, payload=payload)


@router.patch("/room-categories/{category_id}", response_model=RoomCategoryOut)
def update_room_category(library_id: UUID, category_id: UUID, payload: RoomCategoryUpdate, db: TenantDb) -> RoomCategoryOut:
    return service.update_room_category(db, library_id=library_id, category_id=category_id, payload=payload)


@router.delete("/room-categories/{category_id}", status_code=204)
def delete_room_category(library_id: UUID, category_id: UUID, db: TenantDb) -> None:
    service.delete_room_category(db, library_id=library_id, category_id=category_id)


@router.post("/room-categories/{category_id}/toggle-ac", response_model=RoomCategoryOut)
def toggle_ac(library_id: UUID, category_id: UUID, is_ac: bool, db: TenantDb) -> RoomCategoryOut:
    return service.toggle_ac(db, library_id=library_id, category_id=category_id, is_ac=is_ac)


@router.post("/room-categories/bulk-seasonal-flip", response_model=list[RoomCategoryOut])
def bulk_seasonal_flip(library_id: UUID, payload: BulkSeasonalFlipRequest, db: TenantDb) -> list[RoomCategoryOut]:
    return service.bulk_seasonal_flip(db, library_id=library_id, set_ac=payload.set_ac)


@router.get("/cabins", response_model=Page[CabinOut])
def list_cabins(
    library_id: UUID,
    db: TenantDb,
    page_params: PageQuery,
    room_category_id: UUID | None = None,
    status: str | None = None,
    search: str | None = None,
) -> Page[CabinOut]:
    return service.list_cabins(db, library_id=library_id, room_category_id=room_category_id, status=status, search=search, params=page_params)


@router.get("/cabins/available", response_model=list[AvailableCabinsGroupOut])
def list_available_cabins(library_id: UUID, db: TenantDb) -> list[AvailableCabinsGroupOut]:
    return service.list_available_cabins(db, library_id)


@router.get("/cabins/available/pdf", response_class=Response)
def download_available_cabins_pdf(library_id: UUID, db: TenantDb) -> Response:
    pdf_bytes = service.build_available_cabins_pdf(db, library_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=available-cabins.pdf"},
    )


@router.post("/cabins", response_model=CabinOut, status_code=201)
def create_cabin(library_id: UUID, payload: CabinCreate, db: TenantDb) -> CabinOut:
    return service.create_cabin(db, library_id=library_id, payload=payload)


@router.patch("/cabins/{cabin_id}", response_model=CabinOut)
def update_cabin(library_id: UUID, cabin_id: UUID, payload: CabinUpdate, db: TenantDb) -> CabinOut:
    return service.update_cabin(db, library_id=library_id, cabin_id=cabin_id, payload=payload)


@router.delete("/cabins/{cabin_id}", status_code=204)
def delete_cabin(library_id: UUID, cabin_id: UUID, db: TenantDb) -> None:
    service.delete_cabin(db, library_id=library_id, cabin_id=cabin_id)


@router.get("/cabins/bulk-upload/sample", response_class=Response)
def download_cabin_sample_csv(library_id: UUID, db: TenantDb) -> Response:
    csv_content = service.build_cabin_sample_csv(db, library_id)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cabins_sample.csv"},
    )


@router.post("/cabins/bulk-upload", response_model=CabinBulkUploadResult)
async def bulk_upload_cabins(library_id: UUID, db: TenantDb, file: UploadFile = File(...)) -> CabinBulkUploadResult:
    if not (file.filename or "").lower().endswith(".csv"):
        raise ValidationDomainError("File must be a .csv file")
    file_bytes = await file.read()
    if len(file_bytes) > 2 * 1024 * 1024:
        raise ValidationDomainError("CSV file must be smaller than 2MB")
    return service.bulk_upload_cabins(db, library_id=library_id, file_bytes=file_bytes)
