"""Settings business logic — theme and Twilio config are intentionally not
duplicated here (see app.modules.libraries.router and app.modules.whatsapp.router);
this module only owns staff management, which has no other home."""

import secrets
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationDomainError
from app.core.security import hash_password
from app.modules.settings import repository
from app.modules.settings.schemas import StaffMemberOut


def list_staff(db: Session, library_id: UUID) -> list[StaffMemberOut]:
    return [StaffMemberOut(**row) for row in repository.list_staff(db, library_id)]


def invite_staff(db: Session, *, library_id: UUID, payload) -> StaffMemberOut:
    role_id = repository.get_role_id(db, payload.role_name)
    if not role_id:
        raise ValidationDomainError(f"Role '{payload.role_name}' is not assignable")

    user = repository.get_user_by_email(db, payload.email)
    if user:
        user_id = user["id"]
    else:
        temp_password_hash = hash_password(secrets.token_urlsafe(24))
        user_id = repository.create_placeholder_user(db, full_name=payload.full_name, email=payload.email, password_hash=temp_password_hash)

    if repository.membership_exists(db, library_id=library_id, user_id=user_id):
        raise ConflictError("This user is already a member of this library")

    repository.create_membership(db, library_id=library_id, user_id=user_id, role_id=role_id)
    db.commit()

    rows = repository.list_staff(db, library_id)
    return next(StaffMemberOut(**row) for row in rows if row["user_id"] == user_id)


def update_role(db: Session, *, library_id: UUID, user_id: UUID, role_name: str) -> StaffMemberOut:
    role_id = repository.get_role_id(db, role_name)
    if not role_id:
        raise ValidationDomainError(f"Role '{role_name}' is not assignable")
    if not repository.membership_exists(db, library_id=library_id, user_id=user_id):
        raise NotFoundError("Staff member not found in this library")

    repository.update_role(db, library_id=library_id, user_id=user_id, role_id=role_id)
    db.commit()

    rows = repository.list_staff(db, library_id)
    return next(StaffMemberOut(**row) for row in rows if row["user_id"] == user_id)


def remove_staff(db: Session, *, library_id: UUID, user_id: UUID) -> None:
    if not repository.membership_exists(db, library_id=library_id, user_id=user_id):
        raise NotFoundError("Staff member not found in this library")
    repository.remove_membership(db, library_id=library_id, user_id=user_id)
    db.commit()
