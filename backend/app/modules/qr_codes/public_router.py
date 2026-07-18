"""Public, unauthenticated endpoints hit by physical QR-code scans — no login,
scoped by explicit library_id path param rather than RLS session."""

from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.db import get_db
from app.core.exceptions import NotFoundError
from app.modules.qr_codes import repository
from app.modules.qr_codes.schemas import PublicAvailabilityOut, PublicComplaintCreate

router = APIRouter(prefix="/public/libraries/{library_id}", tags=["public"])


@router.get("/availability", response_model=PublicAvailabilityOut)
def get_availability(library_id: UUID, db=Depends(get_db)) -> PublicAvailabilityOut:
    if not repository.library_exists(db, library_id):
        raise NotFoundError("Library not found")
    return PublicAvailabilityOut(**repository.public_availability(db, library_id))


@router.post("/complaints", status_code=201)
def create_complaint(library_id: UUID, payload: PublicComplaintCreate, db=Depends(get_db)) -> dict:
    if not repository.library_exists(db, library_id):
        raise NotFoundError("Library not found")
    repository.create_public_complaint(db, library_id=library_id, payload=payload)
    return {"status": "received"}
