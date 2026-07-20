"""Students endpoints. Tenant-scoped under /libraries/{library_id}/students."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import Response

from app.core.deps import CurrentClaims, TenantDb
from app.core.exceptions import ValidationDomainError
from app.core.pagination import Page, PageQuery
from app.modules.students import service
from app.modules.students.schemas import (
    AssignCabinRequest,
    AssignLockerRequest,
    PendingPaymentStudentOut,
    StudentBulkUploadResult,
    StudentCreate,
    StudentOut,
    StudentStatusUpdate,
    StudentUpdate,
)

router = APIRouter(prefix="/libraries/{library_id}/students", tags=["students"])


@router.get("", response_model=Page[StudentOut])
def list_students(
    library_id: UUID,
    db: TenantDb,
    page_params: PageQuery,
    status: str | None = None,
    search: str | None = None,
    expiring_before: date | None = None,
) -> Page[StudentOut]:
    return service.list_students(db, library_id=library_id, status=status, search=search, expiring_before=expiring_before, params=page_params)


@router.post("", response_model=StudentOut, status_code=201)
def create_student(library_id: UUID, payload: StudentCreate, claims: CurrentClaims, db: TenantDb) -> StudentOut:
    return service.create_student(db, library_id=library_id, created_by=UUID(claims["sub"]), payload=payload)


@router.get("/pending-payment", response_model=list[PendingPaymentStudentOut])
def list_pending_payment_students(library_id: UUID, db: TenantDb) -> list[PendingPaymentStudentOut]:
    return service.list_pending_payment_students(db, library_id=library_id)


@router.get("/{student_id}", response_model=StudentOut)
def get_student(library_id: UUID, student_id: UUID, db: TenantDb) -> StudentOut:
    return service.get_student(db, library_id=library_id, student_id=student_id)


@router.patch("/{student_id}", response_model=StudentOut)
def update_student(library_id: UUID, student_id: UUID, payload: StudentUpdate, db: TenantDb) -> StudentOut:
    return service.update_student(db, library_id=library_id, student_id=student_id, payload=payload)


@router.delete("/{student_id}", status_code=204)
def delete_student(library_id: UUID, student_id: UUID, db: TenantDb) -> None:
    service.delete_student(db, library_id=library_id, student_id=student_id)


@router.post("/{student_id}/assign-cabin", response_model=StudentOut)
def assign_cabin(library_id: UUID, student_id: UUID, payload: AssignCabinRequest, db: TenantDb) -> StudentOut:
    return service.assign_cabin(db, library_id=library_id, student_id=student_id, cabin_id=payload.cabin_id)


@router.post("/{student_id}/assign-locker", response_model=StudentOut)
def assign_locker(library_id: UUID, student_id: UUID, payload: AssignLockerRequest, db: TenantDb) -> StudentOut:
    return service.assign_locker(db, library_id=library_id, student_id=student_id, locker_id=payload.locker_id)


@router.post("/{student_id}/status", response_model=StudentOut)
def set_status(library_id: UUID, student_id: UUID, payload: StudentStatusUpdate, db: TenantDb) -> StudentOut:
    return service.set_status(db, library_id=library_id, student_id=student_id, status=payload.status)


@router.get("/bulk-upload/sample", response_class=Response)
def download_student_sample_csv() -> Response:
    csv_content = service.build_student_sample_csv()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=students_sample.csv"},
    )


@router.post("/bulk-upload", response_model=StudentBulkUploadResult)
async def bulk_upload_students(library_id: UUID, claims: CurrentClaims, db: TenantDb, file: UploadFile = File(...)) -> StudentBulkUploadResult:
    if not (file.filename or "").lower().endswith(".csv"):
        raise ValidationDomainError("File must be a .csv file")
    file_bytes = await file.read()
    if len(file_bytes) > 2 * 1024 * 1024:
        raise ValidationDomainError("CSV file must be smaller than 2MB")
    return service.bulk_upload_students(db, library_id=library_id, created_by=UUID(claims["sub"]), file_bytes=file_bytes)
