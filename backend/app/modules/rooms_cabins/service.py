"""Rooms & Cabins business logic."""

import csv
import io
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationDomainError
from app.core.pagination import Page, PageParams, make_page
from app.modules.rooms_cabins import repository
from app.modules.rooms_cabins.schemas import CabinBulkUploadResult, CabinOut, RoomCategoryOut

CSV_COLUMNS = ["room_category", "cabin_number"]


def _category_out(row: dict) -> RoomCategoryOut:
    return RoomCategoryOut(**row)


def _cabin_out(row: dict) -> CabinOut:
    return CabinOut(**row)


def list_room_categories(db: Session, library_id: UUID) -> list[RoomCategoryOut]:
    return [_category_out(r) for r in repository.list_room_categories(db, library_id)]


def create_room_category(db: Session, *, library_id: UUID, payload) -> RoomCategoryOut:
    if payload.is_ac_locked and payload.is_ac:
        raise ValidationDomainError("A seasonally-locked category must be non-AC")
    if repository.category_name_exists(db, library_id=library_id, name=payload.name):
        raise ConflictError(f"A room category named '{payload.name}' already exists")
    row = repository.create_room_category(db, library_id=library_id, payload=payload)
    db.commit()
    return _category_out(row)


def update_room_category(db: Session, *, library_id: UUID, category_id: UUID, payload) -> RoomCategoryOut:
    existing = repository.get_room_category(db, library_id=library_id, category_id=category_id)
    if not existing:
        raise NotFoundError("Room category not found")
    repository.update_room_category(db, library_id=library_id, category_id=category_id, payload=payload)
    db.commit()
    return _category_out(repository.get_room_category(db, library_id=library_id, category_id=category_id))


def delete_room_category(db: Session, *, library_id: UUID, category_id: UUID) -> None:
    existing = repository.get_room_category(db, library_id=library_id, category_id=category_id)
    if not existing:
        raise NotFoundError("Room category not found")
    if repository.count_cabins_in_category(db, category_id) > 0:
        raise ConflictError("Cannot delete a room category that still has cabins")
    repository.delete_room_category(db, library_id=library_id, category_id=category_id)
    db.commit()


def toggle_ac(db: Session, *, library_id: UUID, category_id: UUID, is_ac: bool) -> RoomCategoryOut:
    existing = repository.get_room_category(db, library_id=library_id, category_id=category_id)
    if not existing:
        raise NotFoundError("Room category not found")
    if existing["is_ac_locked"]:
        raise ConflictError("This room category's AC status is locked and cannot be changed")
    repository.toggle_ac(db, library_id=library_id, category_id=category_id, is_ac=is_ac)
    db.commit()
    return _category_out(repository.get_room_category(db, library_id=library_id, category_id=category_id))


def bulk_seasonal_flip(db: Session, *, library_id: UUID, set_ac: bool) -> list[RoomCategoryOut]:
    repository.bulk_seasonal_flip(db, library_id=library_id, set_ac=set_ac)
    db.commit()
    return list_room_categories(db, library_id)


def list_cabins(
    db: Session, *, library_id: UUID, room_category_id: UUID | None, status: str | None, search: str | None, params: PageParams
) -> Page[CabinOut]:
    rows, total = repository.list_cabins(
        db, library_id=library_id, room_category_id=room_category_id, status=status, search=search, limit=params.limit, offset=params.offset
    )
    return make_page([_cabin_out(r) for r in rows], total, params)


def create_cabin(db: Session, *, library_id: UUID, payload) -> CabinOut:
    if not repository.category_belongs_to_library(db, library_id=library_id, category_id=payload.room_category_id):
        raise NotFoundError("Room category not found")
    if repository.cabin_number_exists(db, library_id=library_id, cabin_number=payload.cabin_number):
        raise ConflictError(f"Cabin number '{payload.cabin_number}' already exists in this library")
    try:
        cabin_id = repository.create_cabin(db, library_id=library_id, payload=payload)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("Cabin could not be created due to a data conflict") from exc
    return _cabin_out(repository.get_cabin(db, library_id=library_id, cabin_id=cabin_id))


def update_cabin(db: Session, *, library_id: UUID, cabin_id: UUID, payload) -> CabinOut:
    existing = repository.get_cabin(db, library_id=library_id, cabin_id=cabin_id)
    if not existing:
        raise NotFoundError("Cabin not found")
    if payload.status and payload.status != existing["status"] and repository.has_active_student(db, cabin_id):
        raise ConflictError("Cabin has an active student assigned; unassign the student first")
    if (
        payload.cabin_number
        and payload.cabin_number != existing["cabin_number"]
        and repository.cabin_number_exists(db, library_id=library_id, cabin_number=payload.cabin_number)
    ):
        raise ConflictError(f"Cabin number '{payload.cabin_number}' already exists in this library")
    repository.update_cabin(db, library_id=library_id, cabin_id=cabin_id, payload=payload)
    db.commit()
    return _cabin_out(repository.get_cabin(db, library_id=library_id, cabin_id=cabin_id))


def delete_cabin(db: Session, *, library_id: UUID, cabin_id: UUID) -> None:
    existing = repository.get_cabin(db, library_id=library_id, cabin_id=cabin_id)
    if not existing:
        raise NotFoundError("Cabin not found")
    if repository.has_active_student(db, cabin_id):
        raise ConflictError("Cabin has an active student assigned; unassign the student first")
    repository.delete_cabin(db, library_id=library_id, cabin_id=cabin_id)
    db.commit()


def build_cabin_sample_csv(db: Session, library_id: UUID) -> str:
    categories = repository.list_room_categories(db, library_id)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(CSV_COLUMNS)
    if categories:
        for category in categories:
            writer.writerow([category["name"], "1"])
            writer.writerow([category["name"], "2"])
    else:
        writer.writerow(["Green", "1"])
        writer.writerow(["Green", "2"])
        writer.writerow(["Yellow", "31"])
        writer.writerow(["Entrance", "100"])
    return buffer.getvalue()


def bulk_upload_cabins(db: Session, *, library_id: UUID, file_bytes: bytes) -> CabinBulkUploadResult:
    try:
        text_content = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationDomainError("CSV file must be UTF-8 encoded") from exc

    reader = csv.DictReader(io.StringIO(text_content))
    if reader.fieldnames is None or {"room_category", "cabin_number"} - {
        (name or "").strip().lower() for name in reader.fieldnames
    }:
        raise ValidationDomainError(f"CSV must have columns: {', '.join(CSV_COLUMNS)}")

    category_map = repository.categories_by_name(db, library_id=library_id)
    raw_rows = list(reader)
    file_cabin_numbers = [(row.get("cabin_number") or "").strip() for row in raw_rows if (row.get("cabin_number") or "").strip()]
    existing_numbers = repository.existing_cabin_numbers(db, library_id=library_id, cabin_numbers=file_cabin_numbers)

    errors: list[dict] = []
    to_create: list[dict] = []
    seen_in_file: dict[str, int] = {}

    for row_number, row in enumerate(raw_rows, start=2):
        category_raw = (row.get("room_category") or "").strip()
        cabin_number = (row.get("cabin_number") or "").strip()

        if not category_raw:
            errors.append({"row_number": row_number, "cabin_number": cabin_number or None, "room_category": None, "error": "room_category is required"})
            continue
        if not cabin_number:
            errors.append({"row_number": row_number, "cabin_number": None, "room_category": category_raw, "error": "cabin_number is required"})
            continue
        if len(cabin_number) > 20:
            errors.append({"row_number": row_number, "cabin_number": cabin_number, "room_category": category_raw, "error": "cabin_number must be 20 characters or fewer"})
            continue

        category_id = category_map.get(category_raw.lower())
        if category_id is None:
            errors.append({"row_number": row_number, "cabin_number": cabin_number, "room_category": category_raw, "error": f"Room category '{category_raw}' does not exist"})
            continue

        if cabin_number in existing_numbers:
            errors.append({"row_number": row_number, "cabin_number": cabin_number, "room_category": category_raw, "error": "cabin_number already exists in this library"})
            continue
        if cabin_number in seen_in_file:
            errors.append({"row_number": row_number, "cabin_number": cabin_number, "room_category": category_raw, "error": f"Duplicate cabin_number in file (also on row {seen_in_file[cabin_number]})"})
            continue

        seen_in_file[cabin_number] = row_number
        to_create.append({"room_category_id": category_id, "cabin_number": cabin_number, "capacity": 1})

    created_count = 0
    if to_create:
        try:
            created_count = repository.bulk_create_cabins(db, library_id=library_id, rows=to_create)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise ConflictError("Bulk upload failed due to a data conflict — no cabins were created, please retry") from exc

    return CabinBulkUploadResult(created_count=created_count, error_count=len(errors), errors=errors)
