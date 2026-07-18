"""Lockers endpoints. Tenant-scoped under /libraries/{library_id}."""

from uuid import UUID

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import Response

from app.core.deps import TenantDb
from app.core.exceptions import ValidationDomainError
from app.core.pagination import Page, PageQuery
from app.modules.lockers import service
from app.modules.lockers.schemas import LockerBulkUploadResult, LockerCreate, LockerOut, LockerUpdate

router = APIRouter(prefix="/libraries/{library_id}/lockers", tags=["lockers"])


@router.get("", response_model=Page[LockerOut])
def list_lockers(library_id: UUID, db: TenantDb, page_params: PageQuery, status: str | None = None) -> Page[LockerOut]:
    return service.list_lockers(db, library_id=library_id, status=status, params=page_params)


@router.post("", response_model=LockerOut, status_code=201)
def create_locker(library_id: UUID, payload: LockerCreate, db: TenantDb) -> LockerOut:
    return service.create_locker(db, library_id=library_id, payload=payload)


@router.patch("/{locker_id}", response_model=LockerOut)
def update_locker(library_id: UUID, locker_id: UUID, payload: LockerUpdate, db: TenantDb) -> LockerOut:
    return service.update_locker(db, library_id=library_id, locker_id=locker_id, payload=payload)


@router.delete("/{locker_id}", status_code=204)
def delete_locker(library_id: UUID, locker_id: UUID, db: TenantDb) -> None:
    service.delete_locker(db, library_id=library_id, locker_id=locker_id)


@router.get("/bulk-upload/sample", response_class=Response)
def download_locker_sample_csv() -> Response:
    csv_content = service.build_locker_sample_csv()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=lockers_sample.csv"},
    )


@router.post("/bulk-upload", response_model=LockerBulkUploadResult)
async def bulk_upload_lockers(library_id: UUID, db: TenantDb, file: UploadFile = File(...)) -> LockerBulkUploadResult:
    if not (file.filename or "").lower().endswith(".csv"):
        raise ValidationDomainError("File must be a .csv file")
    file_bytes = await file.read()
    if len(file_bytes) > 2 * 1024 * 1024:
        raise ValidationDomainError("CSV file must be smaller than 2MB")
    return service.bulk_upload_lockers(db, library_id=library_id, file_bytes=file_bytes)
