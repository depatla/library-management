"""Libraries business logic: admin-provisioned creation (owner + library
together, requirement #15), activation toggle (#16), theme (#18)."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import hash_password
from app.modules.libraries import repository
from app.modules.libraries.schemas import CreateLibraryRequest, LibraryOut, UpdateLibraryThemeRequest


def _to_out(row: dict) -> LibraryOut:
    return LibraryOut(
        id=row["id"],
        name=row["name"],
        slug=row["slug"],
        city=row["city"],
        status=row["status"],
        primary_color=row["primary_color"],
        secondary_color=row["secondary_color"],
        theme_mode=row["theme_mode"],
        owner_id=row["owner_id"],
        owner_name=row["owner_name"],
        created_at=row["created_at"].isoformat(),
    )


def create_library_with_owner(db: Session, payload: CreateLibraryRequest) -> LibraryOut:
    existing = repository.get_user_by_email(db, payload.owner.email)
    if existing:
        raise ConflictError(f"A user with email {payload.owner.email} already exists")

    owner = repository.create_user(
        db,
        full_name=payload.owner.full_name,
        email=payload.owner.email,
        phone=payload.owner.phone,
        password_hash=hash_password(payload.owner.password),
    )
    slug = repository.unique_slug(db, payload.name)
    library = repository.create_library(db, owner_id=owner["id"], slug=slug, payload=payload)
    repository.seed_room_categories(db, library_id=library["id"])
    role_id = repository.get_owner_role_id(db)
    repository.create_membership(db, user_id=owner["id"], library_id=library["id"], role_id=role_id)
    db.commit()

    return _to_out({**library, "owner_name": owner["full_name"]})


def list_libraries(db: Session) -> list[LibraryOut]:
    return [_to_out(r) for r in repository.list_libraries(db)]


def list_my_libraries(db: Session, user_id: UUID) -> list[LibraryOut]:
    return [_to_out(r) for r in repository.list_libraries_for_user(db, user_id)]


def set_active(db: Session, *, library_id: UUID, is_active: bool) -> LibraryOut:
    library = repository.get_library(db, library_id)
    if not library:
        raise NotFoundError("Library not found")
    repository.set_library_status(db, library_id=library_id, status="active" if is_active else "suspended")
    db.commit()
    library = repository.get_library(db, library_id)
    return _to_out(library)


def update_theme(db: Session, *, library_id: UUID, payload: UpdateLibraryThemeRequest) -> LibraryOut:
    library = repository.get_library(db, library_id)
    if not library:
        raise NotFoundError("Library not found")
    repository.update_library_theme(
        db,
        library_id=library_id,
        primary_color=payload.primary_color,
        secondary_color=payload.secondary_color,
        theme_mode=payload.theme_mode,
    )
    db.commit()
    library = repository.get_library(db, library_id)
    return _to_out(library)


def get_library(db: Session, library_id: UUID) -> LibraryOut:
    library = repository.get_library(db, library_id)
    if not library:
        raise NotFoundError("Library not found")
    return _to_out(library)
