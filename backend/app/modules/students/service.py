"""Students business logic: enrollment, seat/locker assignment, status."""

import csv
import io
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationDomainError
from app.core.logging import get_logger
from app.core.pagination import Page, PageParams, make_page
from app.modules.students import repository
from app.modules.students.schemas import PendingPaymentStudentOut, StudentBulkUploadResult, StudentOut

logger = get_logger(__name__)

CSV_COLUMNS = ["name", "mobile", "email", "gender"]
VALID_GENDERS = {"male", "female", "other"}


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


def list_pending_payment_students(db: Session, *, library_id: UUID) -> list[PendingPaymentStudentOut]:
    rows = repository.list_pending_payment_students(db, library_id=library_id)
    return [PendingPaymentStudentOut(**row) for row in rows]


def build_student_sample_csv() -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(CSV_COLUMNS)
    writer.writerow(["Rahul Sharma", "9876543210", "rahul@example.com", "male"])
    writer.writerow(["Priya Verma", "9876543211", "", "female"])
    writer.writerow(["Amit Kumar", "9876543212", "amit@example.com", "other"])
    return buffer.getvalue()


def bulk_upload_students(db: Session, *, library_id: UUID, created_by: UUID, file_bytes: bytes) -> StudentBulkUploadResult:
    try:
        text_content = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationDomainError("CSV file must be UTF-8 encoded") from exc

    reader = csv.DictReader(io.StringIO(text_content))
    header = {(name or "").strip().lower() for name in (reader.fieldnames or [])}
    if not {"name", "mobile"} <= header:
        raise ValidationDomainError(f"CSV must have columns: {', '.join(CSV_COLUMNS)}")

    raw_rows = list(reader)
    file_phones = [(row.get("mobile") or "").strip() for row in raw_rows if (row.get("mobile") or "").strip()]
    existing_phones = repository.existing_phones(db, library_id=library_id, phones=file_phones)

    errors: list[dict] = []
    to_create: list[dict] = []
    seen_in_file: dict[str, int] = {}

    for row_number, row in enumerate(raw_rows, start=2):
        name = (row.get("name") or "").strip()
        phone = (row.get("mobile") or "").strip()
        email = (row.get("email") or "").strip() or None
        gender_raw = (row.get("gender") or "").strip().lower() or None

        if not name:
            errors.append({"row_number": row_number, "name": None, "error": "name is required"})
            continue
        if len(name) > 150:
            errors.append({"row_number": row_number, "name": name, "error": "name must be 150 characters or fewer"})
            continue

        if not phone:
            errors.append({"row_number": row_number, "name": name, "error": "mobile is required"})
            continue
        if len(phone) > 20:
            errors.append({"row_number": row_number, "name": name, "error": "mobile must be 20 characters or fewer"})
            continue

        if email and "@" not in email:
            errors.append({"row_number": row_number, "name": name, "error": "email is not a valid email address"})
            continue

        if gender_raw and gender_raw not in VALID_GENDERS:
            errors.append({"row_number": row_number, "name": name, "error": f"gender must be one of: {', '.join(sorted(VALID_GENDERS))}"})
            continue

        if phone in existing_phones:
            errors.append({"row_number": row_number, "name": name, "error": "mobile already exists in this library"})
            continue
        if phone in seen_in_file:
            errors.append({"row_number": row_number, "name": name, "error": f"Duplicate mobile in file (also on row {seen_in_file[phone]})"})
            continue

        seen_in_file[phone] = row_number
        to_create.append({"full_name": name, "phone": phone, "email": email, "gender": gender_raw})

    created_count = 0
    if to_create:
        try:
            created_count = repository.bulk_create_students(db, library_id=library_id, created_by=created_by, rows=to_create)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise ConflictError("Bulk upload failed due to a data conflict — no students were created, please retry") from exc

    return StudentBulkUploadResult(created_count=created_count, error_count=len(errors), errors=errors)
