"""WhatsApp business logic: config/template CRUD, message sending, and the
scheduled expiry-reminder sweep.

`send_template` is called from two contexts with different failure semantics:
- automatic triggers (student creation, payment creation, scheduled reminders)
  catch exceptions themselves and swallow — a Twilio outage must never break
  the primary flow.
- manual `/whatsapp/send` calls let this function's ConflictError propagate,
  since the user directly asked for a send and should see the failure.
"""

import re
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from twilio.base.exceptions import TwilioRestException

from app.core.config import get_settings
from app.core.exceptions import ConflictError, NotFoundError
from app.core.pagination import Page, PageParams, make_page
from app.modules.whatsapp import repository
from app.modules.whatsapp.client import list_content_templates as _list_content_templates
from app.modules.whatsapp.client import send_whatsapp
from app.modules.whatsapp.schemas import ContentTemplateOut, MessageOut, TemplateOut, TwilioConfigOut

settings = get_settings()

_PLACEHOLDER_RE = re.compile(r"\{\{(\w+)\}\}")


def _mask_token(token: str) -> str:
    if len(token) <= 4:
        return "*" * len(token)
    return "*" * (len(token) - 4) + token[-4:]


def get_config(db: Session, library_id: UUID) -> TwilioConfigOut | None:
    row = repository.get_config(db, library_id)
    if not row:
        return None
    return TwilioConfigOut(
        id=row["id"],
        library_id=row["library_id"],
        account_sid=row["account_sid"],
        auth_token_masked=_mask_token(row["auth_token"]),
        whatsapp_number=row["whatsapp_number"],
        is_active=row["is_active"],
    )


def upsert_config(db: Session, *, library_id: UUID, payload) -> TwilioConfigOut:
    row = repository.upsert_config(
        db,
        library_id=library_id,
        account_sid=payload.account_sid,
        auth_token=payload.auth_token,
        whatsapp_number=payload.whatsapp_number,
        is_active=payload.is_active,
    )
    db.commit()
    return TwilioConfigOut(
        id=row["id"],
        library_id=row["library_id"],
        account_sid=row["account_sid"],
        auth_token_masked=_mask_token(row["auth_token"]),
        whatsapp_number=row["whatsapp_number"],
        is_active=row["is_active"],
    )


def list_templates(db: Session, library_id: UUID) -> list[TemplateOut]:
    return [TemplateOut(**row) for row in repository.list_templates(db, library_id)]


def create_template(db: Session, *, library_id: UUID, payload) -> TemplateOut:
    try:
        row = repository.create_template(db, library_id=library_id, payload=payload)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if "uq_whatsapp_template_system_type" in str(exc.orig):
            raise ConflictError(
                f"A '{payload.type}' template already exists for this library — edit the existing one instead of creating a new one."
            ) from exc
        raise
    return TemplateOut(**row)


def update_template(db: Session, *, library_id: UUID, template_id: UUID, payload) -> TemplateOut:
    existing = repository.get_template(db, library_id=library_id, template_id=template_id)
    if not existing:
        raise NotFoundError("Template not found")
    repository.update_template(db, library_id=library_id, template_id=template_id, payload=payload)
    db.commit()
    row = repository.get_template(db, library_id=library_id, template_id=template_id)
    return TemplateOut(**row)


def delete_template(db: Session, *, library_id: UUID, template_id: UUID) -> None:
    existing = repository.get_template(db, library_id=library_id, template_id=template_id)
    if not existing:
        raise NotFoundError("Template not found")
    repository.delete_template(db, library_id=library_id, template_id=template_id)
    db.commit()


def _placeholder_context(student: dict) -> dict[str, str]:
    """Source fields available to both freeform {{tokens}} and Content API variable_mapping."""
    return {
        "name": student["full_name"],
        "expiry_date": str(student.get("expiry_date") or ""),
        "cabin_number": student.get("cabin_number") or "",
    }


def _render(content: str, context: dict[str, str]) -> str:
    """Freeform path — named {{placeholder}} substitution."""
    return _PLACEHOLDER_RE.sub(lambda m: context.get(m.group(1), ""), content)


def _content_variables(variable_mapping: dict, context: dict[str, str]) -> dict[str, str]:
    """Content API path — resolve each Twilio numbered variable via the template's
    saved variable_mapping instead of guessing from {{tokens}} in `content`."""
    result = {}
    for number, source in variable_mapping.items():
        result[number] = source["custom"] if isinstance(source, dict) else context.get(source, "")
    return result


_SOURCE_LABELS = {"name": "Student name", "expiry_date": "Expiry date", "cabin_number": "Desk/cabin number"}


def _check_content_variables_filled(content_vars: dict[str, str], variable_mapping: dict) -> None:
    """Twilio rejects an approved template send if any {{N}} variable resolves to an
    empty string (error 21656) — catch that here with a specific, actionable message
    instead of letting the student hit Twilio's generic error."""
    for number, value in content_vars.items():
        if value.strip():
            continue
        source = variable_mapping.get(number)
        label = _SOURCE_LABELS.get(source, source) if isinstance(source, str) else "this field"
        raise ConflictError(f"Cannot send: '{label}' is empty for this student (template variable {{{{{number}}}}}).")


def send_template(db: Session, *, library_id: UUID, student_id: UUID, template_type: str) -> MessageOut:
    config = repository.get_config(db, library_id)
    if not config or not config["is_active"]:
        raise ConflictError("WhatsApp is not configured for this library")

    template = repository.get_active_template_for_type(db, library_id=library_id, template_type=template_type)
    if not template:
        raise ConflictError(f"No active template configured for {template_type}")

    student = repository.get_student_for_message(db, library_id=library_id, student_id=student_id)
    if not student:
        raise NotFoundError("Student not found")

    to_phone = student["whatsapp_number"] or student["phone"]
    ctx = _placeholder_context(student)
    body = _render(template["content"], ctx)
    content_vars = _content_variables(template["variable_mapping"], ctx) if template["content_sid"] else None
    if content_vars:
        _check_content_variables_filled(content_vars, template["variable_mapping"])
    message_id = repository.create_message_log(
        db, library_id=library_id, student_id=student_id, template_id=template["id"], phone=to_phone, message_body=body
    )

    try:
        sid = send_whatsapp(
            account_sid=config["account_sid"],
            auth_token=config["auth_token"],
            whatsapp_number=config["whatsapp_number"],
            to_phone=to_phone,
            body=body if not template["content_sid"] else None,
            content_sid=template["content_sid"],
            content_variables=content_vars,
        )
        repository.mark_sent(db, message_id=message_id, provider_message_sid=sid, content_variables=content_vars)
    except TwilioRestException as exc:
        repository.mark_failed(db, message_id=message_id, error_message=exc.msg)
        db.commit()
        raise ConflictError(f"WhatsApp send failed: {exc.msg} (Twilio error {exc.code})") from exc

    row = repository.get_message(db, message_id)
    return MessageOut(**row)


def list_messages(db: Session, *, library_id: UUID, params: PageParams) -> Page[MessageOut]:
    rows, total = repository.list_messages(db, library_id=library_id, limit=params.limit, offset=params.offset)
    return make_page([MessageOut(**r) for r in rows], total, params)


def send_expiry_reminders(db: Session) -> None:
    """Cross-tenant scheduled job: for every library with an active Twilio
    config, notify students expiring within EXPIRY_REMINDER_DAYS_BEFORE days,
    deduped so each student gets at most one reminder per day."""
    from app.modules.students import repository as students_repository

    library_ids = {
        row["library_id"]
        for row in db.execute(text("SELECT library_id FROM library_twilio_configs WHERE is_active = true")).mappings().all()
    }

    for library_id in library_ids:
        students = students_repository.students_expiring_within(db, library_id=library_id, days=settings.EXPIRY_REMINDER_DAYS_BEFORE)
        for student in students:
            if repository.already_sent_today(db, student_id=student["id"], template_type="expiry_reminder"):
                continue
            try:
                send_template(db, library_id=library_id, student_id=student["id"], template_type="expiry_reminder")
            except Exception:
                db.rollback()


def list_content_templates(db: Session, *, library_id: UUID) -> list[ContentTemplateOut]:
    """Fetches the library's approved Content API templates from Twilio so
    staff can pick a Content SID from a dropdown instead of copy-pasting it."""
    config = repository.get_config(db, library_id)
    if not config:
        raise ConflictError("WhatsApp is not configured for this library")
    templates = _list_content_templates(account_sid=config["account_sid"], auth_token=config["auth_token"])
    return [ContentTemplateOut(**t) for t in templates]
