"""QR codes business logic: PNG generation via the `qrcode` package, saved to
`static/qr/{library_id}_{type}.png` and served through the FastAPI StaticFiles
mount (see app.main). Deterministic filenames mean regeneration overwrites
in place — no orphaned files to clean up."""

from pathlib import Path
from uuid import UUID

import qrcode
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import NotFoundError
from app.modules.qr_codes import repository
from app.modules.qr_codes.schemas import QrCodeOut

settings = get_settings()

_TARGET_SEGMENT = {
    "seat_availability": "availability",
    "complaint": "complaint",
}


def list_qr_codes(db: Session, library_id: UUID) -> list[QrCodeOut]:
    return [QrCodeOut(**row) for row in repository.list_qr_codes(db, library_id)]


def generate(db: Session, *, library_id: UUID, type: str) -> QrCodeOut:
    target_path = f"{settings.FRONTEND_BASE_URL}/public/{library_id}/{_TARGET_SEGMENT[type]}"

    qr_dir = Path(settings.STATIC_ROOT, "qr")
    qr_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{library_id}_{type}.png"
    image = qrcode.make(target_path)
    image.save(qr_dir / filename)

    image_url = f"{settings.PUBLIC_BASE_URL}/static/qr/{filename}"
    row = repository.upsert_qr_code(db, library_id=library_id, type=type, target_path=target_path, image_url=image_url)
    db.commit()
    return QrCodeOut(**row)


def set_active(db: Session, *, library_id: UUID, qr_code_id: UUID, is_active: bool) -> QrCodeOut:
    existing = repository.get_qr_code(db, library_id=library_id, qr_code_id=qr_code_id)
    if not existing:
        raise NotFoundError("QR code not found")
    repository.set_active(db, library_id=library_id, qr_code_id=qr_code_id, is_active=is_active)
    db.commit()
    row = repository.get_qr_code(db, library_id=library_id, qr_code_id=qr_code_id)
    return QrCodeOut(**row)
