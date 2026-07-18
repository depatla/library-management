"""QR codes endpoints. Tenant-scoped CRUD under /libraries/{library_id}/qr-codes."""

from uuid import UUID

from fastapi import APIRouter

from app.core.deps import TenantDb
from app.modules.qr_codes import service
from app.modules.qr_codes.schemas import QrCodeGenerateRequest, QrCodeOut, QrCodeUpdate

router = APIRouter(prefix="/libraries/{library_id}/qr-codes", tags=["qr-codes"])


@router.get("", response_model=list[QrCodeOut])
def list_qr_codes(library_id: UUID, db: TenantDb) -> list[QrCodeOut]:
    return service.list_qr_codes(db, library_id)


@router.post("/generate", response_model=QrCodeOut, status_code=201)
def generate_qr_code(library_id: UUID, payload: QrCodeGenerateRequest, db: TenantDb) -> QrCodeOut:
    return service.generate(db, library_id=library_id, type=payload.type)


@router.patch("/{qr_code_id}", response_model=QrCodeOut)
def update_qr_code(library_id: UUID, qr_code_id: UUID, payload: QrCodeUpdate, db: TenantDb) -> QrCodeOut:
    return service.set_active(db, library_id=library_id, qr_code_id=qr_code_id, is_active=payload.is_active)
