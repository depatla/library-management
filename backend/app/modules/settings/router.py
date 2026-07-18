"""Settings endpoints: staff management under /libraries/{library_id}/settings.
Theme lives on the existing /libraries/{library_id} PATCH endpoint; Twilio
config lives on /libraries/{library_id}/whatsapp/config — both re-exposed
here would just duplicate routes, so the frontend calls them directly."""

from uuid import UUID

from fastapi import APIRouter

from app.core.deps import TenantDb
from app.modules.settings import service
from app.modules.settings.schemas import StaffInviteRequest, StaffMemberOut, StaffRoleUpdate

router = APIRouter(prefix="/libraries/{library_id}/settings", tags=["settings"])


@router.get("/staff", response_model=list[StaffMemberOut])
def list_staff(library_id: UUID, db: TenantDb) -> list[StaffMemberOut]:
    return service.list_staff(db, library_id)


@router.post("/staff/invite", response_model=StaffMemberOut, status_code=201)
def invite_staff(library_id: UUID, payload: StaffInviteRequest, db: TenantDb) -> StaffMemberOut:
    return service.invite_staff(db, library_id=library_id, payload=payload)


@router.patch("/staff/{user_id}/role", response_model=StaffMemberOut)
def update_staff_role(library_id: UUID, user_id: UUID, payload: StaffRoleUpdate, db: TenantDb) -> StaffMemberOut:
    return service.update_role(db, library_id=library_id, user_id=user_id, role_name=payload.role_name)


@router.delete("/staff/{user_id}", status_code=204)
def remove_staff(library_id: UUID, user_id: UUID, db: TenantDb) -> None:
    service.remove_staff(db, library_id=library_id, user_id=user_id)
