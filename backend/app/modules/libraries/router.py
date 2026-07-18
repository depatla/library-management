"""Library endpoints.

Creation, global listing, and activate/deactivate are super-admin only
(requirements #15/#16 — admin-provisioned, no public signup). `/mine` backs
the post-login redirect logic (requirement #13/#14): the frontend calls it
once after login to decide whether to show a picker or go straight to a
single library's dashboard."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import CurrentClaims, SuperAdminClaims
from app.modules.libraries import service
from app.modules.libraries.schemas import CreateLibraryRequest, LibraryOut, UpdateLibraryThemeRequest

router = APIRouter(prefix="/libraries", tags=["libraries"])


@router.post("", response_model=LibraryOut, status_code=201)
def create_library(payload: CreateLibraryRequest, claims: SuperAdminClaims, db: Session = Depends(get_db)) -> LibraryOut:
    return service.create_library_with_owner(db, payload)


@router.get("", response_model=list[LibraryOut])
def list_all_libraries(claims: SuperAdminClaims, db: Session = Depends(get_db)) -> list[LibraryOut]:
    return service.list_libraries(db)


@router.get("/mine", response_model=list[LibraryOut])
def list_my_libraries(claims: CurrentClaims, db: Session = Depends(get_db)) -> list[LibraryOut]:
    return service.list_my_libraries(db, UUID(claims["sub"]))


@router.get("/{library_id}", response_model=LibraryOut)
def get_library(library_id: UUID, claims: CurrentClaims, db: Session = Depends(get_db)) -> LibraryOut:
    return service.get_library(db, library_id)


@router.post("/{library_id}/activate", response_model=LibraryOut)
def activate_library(library_id: UUID, claims: SuperAdminClaims, db: Session = Depends(get_db)) -> LibraryOut:
    return service.set_active(db, library_id=library_id, is_active=True)


@router.post("/{library_id}/deactivate", response_model=LibraryOut)
def deactivate_library(library_id: UUID, claims: SuperAdminClaims, db: Session = Depends(get_db)) -> LibraryOut:
    return service.set_active(db, library_id=library_id, is_active=False)


@router.patch("/{library_id}/theme", response_model=LibraryOut)
def update_theme(library_id: UUID, payload: UpdateLibraryThemeRequest, claims: CurrentClaims, db: Session = Depends(get_db)) -> LibraryOut:
    return service.update_theme(db, library_id=library_id, payload=payload)
