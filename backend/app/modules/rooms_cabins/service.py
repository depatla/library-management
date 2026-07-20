"""Rooms & Cabins business logic."""

import csv
import io
from datetime import date
from uuid import UUID

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationDomainError
from app.core.pagination import Page, PageParams, make_page
from app.modules.rooms_cabins import repository
from app.modules.rooms_cabins.schemas import AvailableCabinOut, AvailableCabinsGroupOut, CabinBulkUploadResult, CabinOut, RoomCategoryOut

CSV_COLUMNS = ["room_category", "cabin_number"]

_PAGE_W, _PAGE_H = 1240, 1754
_MARGIN = 70
_CONTENT_W = _PAGE_W - 2 * _MARGIN
_DEFAULT_BAR_COLOR = (69, 90, 100)


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


def list_available_cabins(db: Session, library_id: UUID) -> list[AvailableCabinsGroupOut]:
    rows = repository.list_available_cabins(db, library_id=library_id)
    groups: dict[str, AvailableCabinsGroupOut] = {}
    order: list[str] = []
    for row in rows:
        name = row["category_name"]
        if name not in groups:
            groups[name] = AvailableCabinsGroupOut(category_name=name, color_code=row["color_code"], is_ac=row["is_ac"], cabins=[])
            order.append(name)
        groups[name].cabins.append(AvailableCabinOut(cabin_number=row["cabin_number"], capacity=row["capacity"]))
    return [groups[name] for name in order]


def _parse_color(hex_code: str | None) -> tuple[int, int, int]:
    if hex_code:
        code = hex_code.lstrip("#")
        if len(code) == 6:
            try:
                return (int(code[0:2], 16), int(code[2:4], 16), int(code[4:6], 16))
            except ValueError:
                pass
    return _DEFAULT_BAR_COLOR


def _text_color_for(rgb: tuple[int, int, int]) -> tuple[int, int, int]:
    luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
    return (20, 20, 20) if luminance > 150 else (255, 255, 255)


def build_available_cabins_pdf(db: Session, library_id: UUID) -> bytes:
    """Renders a single- or multi-page PDF via Pillow (already a transitive
    dependency through qrcode[pil]) rather than adding a new PDF library —
    this sandbox has no PyPI access to install one."""
    library = repository.get_library_header(db, library_id) or {}
    groups = list_available_cabins(db, library_id)

    title_font = ImageFont.load_default(size=40)
    city_font = ImageFont.load_default(size=20)
    subtitle_font = ImageFont.load_default(size=26)
    meta_font = ImageFont.load_default(size=16)
    category_font = ImageFont.load_default(size=16)
    chip_font = ImageFont.load_default(size=17)
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
    y += draw_centered("Available Cabins", subtitle_font, y, fill=(30, 30, 30), bold=True) + 6
    y += draw_centered(f"Generated on {date.today().strftime('%d %b %Y')}", meta_font, y, fill=(140, 140, 140)) + 30

    if not groups:
        draw.text((_MARGIN, y), "No cabins are currently available.", font=empty_font, fill=(30, 30, 30))
    else:
        # Categories run as side-by-side columns (mirroring the spreadsheet
        # layout staff already use), banded so a whole row of columns
        # page-breaks together rather than splitting a column mid-header.
        cols = min(3, max(1, len(groups)))
        col_gap = 24
        col_w = (_CONTENT_W - (cols - 1) * col_gap) / cols
        header_h = 40
        item_h = 38
        band_gap = 26

        i = 0
        while i < len(groups):
            band = groups[i : i + cols]
            max_rows = max(len(g.cabins) for g in band)
            band_height = header_h + 10 + max_rows * item_h

            if y + min(band_height, header_h) > _PAGE_H - _MARGIN and y > _MARGIN:
                pages.append(img)
                img, draw = new_page()
                y = _MARGIN

            band_top = y
            for idx, group in enumerate(band):
                x = _MARGIN + idx * (col_w + col_gap)
                bar_color = _parse_color(group.color_code)
                text_color = _text_color_for(bar_color)
                draw.rounded_rectangle([x, band_top, x + col_w, band_top + header_h], radius=6, fill=bar_color)
                label = f"{group.category_name} ({'AC' if group.is_ac else 'Non-AC'})"
                bbox = draw.textbbox((0, 0), label, font=category_font)
                draw.text((x + 10, band_top + (header_h - (bbox[3] - bbox[1])) / 2 - bbox[1]), label, font=category_font, fill=text_color)

                cy = band_top + header_h + 10
                for row_idx, cabin in enumerate(group.cabins):
                    row_y = cy + row_idx * item_h
                    if row_y + item_h - 4 > _PAGE_H - _MARGIN:
                        break
                    draw.rectangle(
                        [x, row_y, x + col_w, row_y + item_h - 4],
                        outline=(224, 224, 224),
                        fill=(250, 250, 250) if row_idx % 2 == 0 else (255, 255, 255),
                    )
                    bbox = draw.textbbox((0, 0), cabin.cabin_number, font=chip_font)
                    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
                    draw.text((x + (col_w - tw) / 2, row_y + (item_h - 4 - th) / 2 - bbox[1]), cabin.cabin_number, font=chip_font, fill=(30, 30, 30))

            y = band_top + band_height + band_gap
            i += cols

    pages.append(img)
    buffer = io.BytesIO()
    pages[0].save(buffer, format="PDF", save_all=True, append_images=pages[1:])
    return buffer.getvalue()


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
