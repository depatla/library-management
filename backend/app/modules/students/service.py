"""Students business logic: enrollment, seat/locker assignment, status."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.core.logging import get_logger
from app.core.pagination import Page, PageParams, make_page
from app.modules.students import repository
from app.modules.students.schemas import StudentOut

logger = get_logger(__name__)


def _out(row: dict) -> StudentOut:
    return StudentOut(**row)


def list_students(db: Session, *, library_id: UUID, status: str | None, search: str | None, expiring_before, params: PageParams) -> Page[StudentOut]:
    rows, total = repository.list_students(
        db, library_id=library_id, status=status, search=search, expiring_before=expiring_before, limit=params.limit, offset=params.offset
    )
    return make_page([_out(r) for r in rows], total, params)


def get_student(db: Session, *, library_id: UUID, student_id: UUID) -> StudentOut:
    row = repository.get_student(db, library_id=library_id, student_id=student_id)
    if not row:
        raise NotFoundError("Student not found")
    return _out(row)


def create_student(db: Session, *, library_id: UUID, created_by: UUID, payload) -> StudentOut:
    if repository.phone_exists(db, library_id=library_id, phone=payload.phone):
        raise ConflictError(f"A student with phone '{payload.phone}' already exists")
    if payload.cabin_id and not repository.cabin_available(db, library_id=library_id, cabin_id=payload.cabin_id):
        raise ConflictError("Selected cabin is not available")
    if payload.locker_id and not repository.locker_available(db, library_id=library_id, locker_id=payload.locker_id):
        raise ConflictError("Selected locker is not available")

    student_id = repository.create_student(db, library_id=library_id, created_by=created_by, payload=payload)
    if payload.cabin_id:
        repository.assign_cabin(db, library_id=library_id, student_id=student_id, cabin_id=payload.cabin_id, previous_cabin_id=None)
    if payload.locker_id:
        repository.assign_locker(db, library_id=library_id, student_id=student_id, locker_id=payload.locker_id, previous_locker_id=None)
    db.commit()

    student = repository.get_student(db, library_id=library_id, student_id=student_id)

    try:
        from app.modules.whatsapp import service as whatsapp_service

        whatsapp_service.send_template(db, library_id=library_id, student_id=student_id, template_type="welcome")
        db.commit()
    except Exception as exc:  # best-effort — student creation must succeed regardless
        db.rollback()
        logger.warning("welcome_message_failed", student_id=str(student_id), error=str(exc))

    return _out(student)


def update_student(db: Session, *, library_id: UUID, student_id: UUID, payload) -> StudentOut:
    existing = repository.get_student(db, library_id=library_id, student_id=student_id)
    if not existing:
        raise NotFoundError("Student not found")
    if payload.phone and payload.phone != existing["phone"] and repository.phone_exists(db, library_id=library_id, phone=payload.phone):
        raise ConflictError(f"A student with phone '{payload.phone}' already exists")
    repository.update_student(db, library_id=library_id, student_id=student_id, payload=payload)
    db.commit()
    return _out(repository.get_student(db, library_id=library_id, student_id=student_id))


def set_status(db: Session, *, library_id: UUID, student_id: UUID, status: str) -> StudentOut:
    existing = repository.get_student(db, library_id=library_id, student_id=student_id)
    if not existing:
        raise NotFoundError("Student not found")
    repository.set_status(db, library_id=library_id, student_id=student_id, status=status)
    db.commit()
    return _out(repository.get_student(db, library_id=library_id, student_id=student_id))


def delete_student(db: Session, *, library_id: UUID, student_id: UUID) -> None:
    existing = repository.get_student(db, library_id=library_id, student_id=student_id)
    if not existing:
        raise NotFoundError("Student not found")
    if existing["cabin_id"]:
        repository.assign_cabin(db, library_id=library_id, student_id=student_id, cabin_id=None, previous_cabin_id=existing["cabin_id"])
    if existing["locker_id"]:
        repository.assign_locker(db, library_id=library_id, student_id=student_id, locker_id=None, previous_locker_id=existing["locker_id"])
    repository.soft_delete_student(db, library_id=library_id, student_id=student_id)
    db.commit()


def assign_cabin(db: Session, *, library_id: UUID, student_id: UUID, cabin_id: UUID | None) -> StudentOut:
    existing = repository.get_student(db, library_id=library_id, student_id=student_id)
    if not existing:
        raise NotFoundError("Student not found")
    if cabin_id and not repository.cabin_available(db, library_id=library_id, cabin_id=cabin_id):
        raise ConflictError("Selected cabin is not available")
    repository.assign_cabin(db, library_id=library_id, student_id=student_id, cabin_id=cabin_id, previous_cabin_id=existing["cabin_id"])
    db.commit()
    return _out(repository.get_student(db, library_id=library_id, student_id=student_id))


def assign_locker(db: Session, *, library_id: UUID, student_id: UUID, locker_id: UUID | None) -> StudentOut:
    existing = repository.get_student(db, library_id=library_id, student_id=student_id)
    if not existing:
        raise NotFoundError("Student not found")
    if locker_id and not repository.locker_available(db, library_id=library_id, locker_id=locker_id):
        raise ConflictError("Selected locker is not available")
    repository.assign_locker(db, library_id=library_id, student_id=student_id, locker_id=locker_id, previous_locker_id=existing["locker_id"])
    db.commit()
    return _out(repository.get_student(db, library_id=library_id, student_id=student_id))
