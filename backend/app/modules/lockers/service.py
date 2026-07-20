"""Lockers business logic."""

import csv
import io
from datetime import date
from uuid import UUID

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationDomainError
from app.core.pagination import Page, PageParams, make_page
from app.modules.lockers import repository
from app.modules.lockers.schemas import AvailableLockerOut, LockerBulkUploadResult, LockerOut

CSV_COLUMNS = ["locker_number", "monthly_rent"]

_PAGE_W, _PAGE_H = 1240, 1754
_MARGIN = 70
_CONTENT_W = _PAGE_W - 2 * _MARGIN


def _out(row: dict) -> LockerOut:
    return LockerOut(**row)


def list_lockers(db: Session, *, library_id: UUID, status: str | None, params: PageParams) -> Page[LockerOut]:
    rows, total = repository.list_lockers(db, library_id=library_id, status=status, limit=params.limit, offset=params.offset)
    return make_page([_out(r) for r in rows], total, params)


def list_available_lockers(db: Session, library_id: UUID) -> list[AvailableLockerOut]:
    rows = repository.list_available_lockers(db, library_id=library_id)
    return [AvailableLockerOut(locker_number=r["locker_number"], monthly_rent=r["monthly_rent"]) for r in rows]


def build_available_lockers_pdf(db: Session, library_id: UUID) -> bytes:
    """Renders via Pillow, same approach as rooms_cabins.build_available_cabins_pdf —
    no dedicated PDF library available in this environment. Lockers have no
    category grouping, so available numbers are tiled in a fixed-size grid
    instead of category-banded columns."""
    library = repository.get_library_header(db, library_id) or {}
    lockers = list_available_lockers(db, library_id)

    title_font = ImageFont.load_default(size=40)
    city_font = ImageFont.load_default(size=20)
    subtitle_font = ImageFont.load_default(size=26)
    meta_font = ImageFont.load_default(size=16)
    chip_font = ImageFont.load_default(size=18)
    empty_font = ImageFont.load_default(size=18)

    pages: list[Image.Image] = []

    def new_page() -> tuple[Image.Image, ImageDraw.ImageDraw]:
        page = Image.new("RGB", (_PAGE_W, _PAGE_H), "white")
        return page, ImageDraw.Draw(page)

    img, draw = new_page()
    y = _MARGIN

    def draw_centered(text: str, font: ImageFont.FreeTypeFont, y: int, fill: tuple[int, int, int], bold: bool = False) -> int:
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        draw.text(((_PAGE_W - w) / 2, y - bbox[1]), text, font=font, fill=fill, stroke_width=1 if bold else 0, stroke_fill=fill)
        return bbox[3] - bbox[1]

    y += draw_centered(library.get("name") or "Library", title_font, y, fill=(26, 35, 126), bold=True) + 10
    if library.get("city"):
        y += draw_centered(library["city"], city_font, y, fill=(110, 110, 110)) + 14
    y += draw_centered("Available Lockers", subtitle_font, y, fill=(30, 30, 30), bold=True) + 6
    y += draw_centered(f"Generated on {date.today().strftime('%d %b %Y')}", meta_font, y, fill=(140, 140, 140)) + 20

    if not lockers:
        draw.text((_MARGIN, y + 10), "No lockers are currently available.", font=empty_font, fill=(30, 30, 30))
    else:
        y += draw_centered(f"{len(lockers)} locker{'s' if len(lockers) != 1 else ''} available", meta_font, y, fill=(90, 90, 90)) + 24

        cols = 6
        col_gap = 16
        col_w = (_CONTENT_W - (cols - 1) * col_gap) / cols
        item_h = 46
        row_gap = 12

        col = 0
        for locker in lockers:
            if col == 0 and y + item_h > _PAGE_H - _MARGIN and y > _MARGIN:
                pages.append(img)
                img, draw = new_page()
                y = _MARGIN

            x = _MARGIN + col * (col_w + col_gap)
            draw.rounded_rectangle([x, y, x + col_w, y + item_h], radius=6, outline=(69, 90, 100), width=2, fill=(245, 247, 250))
            bbox = draw.textbbox((0, 0), locker.locker_number, font=chip_font)
            tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
            draw.text((x + (col_w - tw) / 2, y + (item_h - th) / 2 - bbox[1]), locker.locker_number, font=chip_font, fill=(30, 30, 30))

            col += 1
            if col == cols:
                col = 0
                y += item_h + row_gap

    pages.append(img)
    buffer = io.BytesIO()
    pages[0].save(buffer, format="PDF", save_all=True, append_images=pages[1:])
    return buffer.getvalue()


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
