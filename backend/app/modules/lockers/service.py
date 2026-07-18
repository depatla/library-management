"""Lockers business logic."""

import csv
import io
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationDomainError
from app.core.pagination import Page, PageParams, make_page
from app.modules.lockers import repository
from app.modules.lockers.schemas import LockerBulkUploadResult, LockerOut

CSV_COLUMNS = ["locker_number", "monthly_rent"]


def _out(row: dict) -> LockerOut:
    return LockerOut(**row)


def list_lockers(db: Session, *, library_id: UUID, status: str | None, params: PageParams) -> Page[LockerOut]:
    rows, total = repository.list_lockers(db, library_id=library_id, status=status, limit=params.limit, offset=params.offset)
    return make_page([_out(r) for r in rows], total, params)


def create_locker(db: Session, *, library_id: UUID, payload) -> LockerOut:
    if repository.locker_number_exists(db, library_id=library_id, locker_number=payload.locker_number):
        raise ConflictError(f"Locker number '{payload.locker_number}' already exists")
    locker_id = repository.create_locker(db, library_id=library_id, payload=payload)
    db.commit()
    return _out(repository.get_locker(db, library_id=library_id, locker_id=locker_id))


def update_locker(db: Session, *, library_id: UUID, locker_id: UUID, payload) -> LockerOut:
    existing = repository.get_locker(db, library_id=library_id, locker_id=locker_id)
    if not existing:
        raise NotFoundError("Locker not found")
    if payload.status and payload.status != existing["status"] and repository.has_active_student(db, locker_id):
        raise ConflictError("Locker has an active student assigned; unassign the student first")
    if (
        payload.locker_number
        and payload.locker_number != existing["locker_number"]
        and repository.locker_number_exists(db, library_id=library_id, locker_number=payload.locker_number)
    ):
        raise ConflictError(f"Locker number '{payload.locker_number}' already exists")
    repository.update_locker(db, library_id=library_id, locker_id=locker_id, payload=payload)
    db.commit()
    return _out(repository.get_locker(db, library_id=library_id, locker_id=locker_id))


def delete_locker(db: Session, *, library_id: UUID, locker_id: UUID) -> None:
    existing = repository.get_locker(db, library_id=library_id, locker_id=locker_id)
    if not existing:
        raise NotFoundError("Locker not found")
    if repository.has_active_student(db, locker_id):
        raise ConflictError("Locker has an active student assigned; unassign the student first")
    repository.delete_locker(db, library_id=library_id, locker_id=locker_id)
    db.commit()


def build_locker_sample_csv() -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(CSV_COLUMNS)
    writer.writerow(["1", "500"])
    writer.writerow(["2", "500"])
    writer.writerow(["3", "500"])
    return buffer.getvalue()


def bulk_upload_lockers(db: Session, *, library_id: UUID, file_bytes: bytes) -> LockerBulkUploadResult:
    try:
        text_content = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationDomainError("CSV file must be UTF-8 encoded") from exc

    reader = csv.DictReader(io.StringIO(text_content))
    if reader.fieldnames is None or {"locker_number"} - {(name or "").strip().lower() for name in reader.fieldnames}:
        raise ValidationDomainError(f"CSV must have columns: {', '.join(CSV_COLUMNS)}")

    raw_rows = list(reader)
    file_locker_numbers = [(row.get("locker_number") or "").strip() for row in raw_rows if (row.get("locker_number") or "").strip()]
    existing_numbers = repository.existing_locker_numbers(db, library_id=library_id, locker_numbers=file_locker_numbers)

    errors: list[dict] = []
    to_create: list[dict] = []
    seen_in_file: dict[str, int] = {}

    for row_number, row in enumerate(raw_rows, start=2):
        locker_number = (row.get("locker_number") or "").strip()
        rent_raw = (row.get("monthly_rent") or "0").strip()

        if not locker_number:
            errors.append({"row_number": row_number, "locker_number": None, "error": "locker_number is required"})
            continue
        if len(locker_number) > 20:
            errors.append({"row_number": row_number, "locker_number": locker_number, "error": "locker_number must be 20 characters or fewer"})
            continue

        try:
            monthly_rent = float(rent_raw) if rent_raw else 0.0
            if monthly_rent < 0:
                raise ValueError
        except ValueError:
            errors.append({"row_number": row_number, "locker_number": locker_number, "error": "monthly_rent must be a non-negative number"})
            continue

        if locker_number in existing_numbers:
            errors.append({"row_number": row_number, "locker_number": locker_number, "error": "locker_number already exists in this library"})
            continue
        if locker_number in seen_in_file:
            errors.append({"row_number": row_number, "locker_number": locker_number, "error": f"Duplicate locker_number in file (also on row {seen_in_file[locker_number]})"})
            continue

        seen_in_file[locker_number] = row_number
        to_create.append({"locker_number": locker_number, "monthly_rent": monthly_rent})

    created_count = 0
    if to_create:
        try:
            created_count = repository.bulk_create_lockers(db, library_id=library_id, rows=to_create)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise ConflictError("Bulk upload failed due to a data conflict — no lockers were created, please retry") from exc

    return LockerBulkUploadResult(created_count=created_count, error_count=len(errors), errors=errors)
