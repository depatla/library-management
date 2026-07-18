"""WhatsApp module repository — raw SQL via SQLAlchemy Core."""

from uuid import UUID

from psycopg.types.json import Jsonb
from sqlalchemy import text
from sqlalchemy.orm import Session


def get_config(db: Session, library_id: UUID) -> dict | None:
    row = db.execute(
        text(
            """
            SELECT id, library_id, account_sid, auth_token, whatsapp_number, is_active
            FROM library_twilio_configs
            WHERE library_id = :library_id
            """
        ),
        {"library_id": str(library_id)},
    ).mappings().first()
    return dict(row) if row else None


def upsert_config(db: Session, *, library_id: UUID, account_sid: str, auth_token: str, whatsapp_number: str, is_active: bool) -> dict:
    row = db.execute(
        text(
            """
            INSERT INTO library_twilio_configs (library_id, account_sid, auth_token, whatsapp_number, is_active)
            VALUES (:library_id, :account_sid, :auth_token, :whatsapp_number, :is_active)
            ON CONFLICT (library_id) DO UPDATE
                SET account_sid = EXCLUDED.account_sid,
                    auth_token = EXCLUDED.auth_token,
                    whatsapp_number = EXCLUDED.whatsapp_number,
                    is_active = EXCLUDED.is_active
            RETURNING id, library_id, account_sid, auth_token, whatsapp_number, is_active
            """
        ),
        {
            "library_id": str(library_id),
            "account_sid": account_sid,
            "auth_token": auth_token,
            "whatsapp_number": whatsapp_number,
            "is_active": is_active,
        },
    ).mappings().first()
    return dict(row)


_SELECT_TEMPLATE = """
    SELECT id, library_id, type, name, content, content_sid, variable_mapping, is_active
    FROM whatsapp_templates
"""


def list_templates(db: Session, library_id: UUID) -> list[dict]:
    rows = db.execute(
        text(_SELECT_TEMPLATE + " WHERE library_id = :library_id ORDER BY type, name"),
        {"library_id": str(library_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def get_template(db: Session, *, library_id: UUID, template_id: UUID) -> dict | None:
    row = db.execute(
        text(_SELECT_TEMPLATE + " WHERE id = :id AND library_id = :library_id"),
        {"id": str(template_id), "library_id": str(library_id)},
    ).mappings().first()
    return dict(row) if row else None


def get_active_template_for_type(db: Session, *, library_id: UUID, template_type: str) -> dict | None:
    row = db.execute(
        text(_SELECT_TEMPLATE + " WHERE library_id = :library_id AND type = :type AND is_active = true"),
        {"library_id": str(library_id), "type": template_type},
    ).mappings().first()
    return dict(row) if row else None


def create_template(db: Session, *, library_id: UUID, payload) -> dict:
    row = db.execute(
        text(
            """
            INSERT INTO whatsapp_templates (library_id, type, name, content, content_sid, variable_mapping, is_active)
            VALUES (:library_id, :type, :name, :content, :content_sid, :variable_mapping, :is_active)
            RETURNING id, library_id, type, name, content, content_sid, variable_mapping, is_active
            """
        ),
        {
            "library_id": str(library_id),
            "type": payload.type,
            "name": payload.name,
            "content": payload.content,
            "content_sid": payload.content_sid,
            "variable_mapping": Jsonb(payload.variable_mapping),
            "is_active": payload.is_active,
        },
    ).mappings().first()
    return dict(row)


def update_template(db: Session, *, library_id: UUID, template_id: UUID, payload) -> None:
    db.execute(
        text(
            """
            UPDATE whatsapp_templates SET
                name = COALESCE(:name, name),
                content = COALESCE(:content, content),
                content_sid = COALESCE(:content_sid, content_sid),
                variable_mapping = COALESCE(:variable_mapping, variable_mapping),
                is_active = COALESCE(:is_active, is_active)
            WHERE id = :id AND library_id = :library_id
            """
        ),
        {
            "name": payload.name,
            "content": payload.content,
            "content_sid": payload.content_sid,
            "variable_mapping": Jsonb(payload.variable_mapping) if payload.variable_mapping is not None else None,
            "is_active": payload.is_active,
            "id": str(template_id),
            "library_id": str(library_id),
        },
    )


def delete_template(db: Session, *, library_id: UUID, template_id: UUID) -> None:
    db.execute(
        text("DELETE FROM whatsapp_templates WHERE id = :id AND library_id = :library_id"),
        {"id": str(template_id), "library_id": str(library_id)},
    )


def get_student_for_message(db: Session, *, library_id: UUID, student_id: UUID) -> dict | None:
    row = db.execute(
        text(
            """
            SELECT s.id, s.full_name, s.phone, s.whatsapp_number, c.cabin_number, pay.expiry_date
            FROM students s
            LEFT JOIN cabins c ON c.id = s.cabin_id
            LEFT JOIN (
                SELECT student_id, MAX(period_end) AS expiry_date
                FROM payments
                GROUP BY student_id
            ) pay ON pay.student_id = s.id
            WHERE s.id = :id AND s.library_id = :library_id AND s.deleted_at IS NULL
            """
        ),
        {"id": str(student_id), "library_id": str(library_id)},
    ).mappings().first()
    return dict(row) if row else None


def create_message_log(db: Session, *, library_id: UUID, student_id: UUID | None, template_id: UUID | None, phone: str, message_body: str) -> UUID:
    row = db.execute(
        text(
            """
            INSERT INTO whatsapp_messages (library_id, student_id, template_id, phone, message_body, status)
            VALUES (:library_id, :student_id, :template_id, :phone, :message_body, 'queued')
            RETURNING id
            """
        ),
        {
            "library_id": str(library_id),
            "student_id": str(student_id) if student_id else None,
            "template_id": str(template_id) if template_id else None,
            "phone": phone,
            "message_body": message_body,
        },
    ).mappings().first()
    return row["id"]


def mark_sent(db: Session, *, message_id: UUID, provider_message_sid: str, content_variables: dict | None = None) -> None:
    db.execute(
        text(
            "UPDATE whatsapp_messages SET status = 'sent', provider_message_sid = :sid, "
            "content_variables = :content_variables, sent_at = now() WHERE id = :id"
        ),
        {
            "sid": provider_message_sid,
            "id": str(message_id),
            "content_variables": Jsonb(content_variables) if content_variables is not None else None,
        },
    )


def mark_failed(db: Session, *, message_id: UUID, error_message: str) -> None:
    db.execute(
        text("UPDATE whatsapp_messages SET status = 'failed', error_message = :error WHERE id = :id"),
        {"error": error_message, "id": str(message_id)},
    )


def get_message(db: Session, message_id: UUID) -> dict | None:
    row = db.execute(
        text(
            """
            SELECT id, library_id, student_id, template_id, phone, message_body, status,
                   provider_message_sid, error_message, direction, retry_count, sent_at
            FROM whatsapp_messages WHERE id = :id
            """
        ),
        {"id": str(message_id)},
    ).mappings().first()
    return dict(row) if row else None


def list_messages(db: Session, *, library_id: UUID, limit: int, offset: int) -> tuple[list[dict], int]:
    rows = db.execute(
        text(
            """
            SELECT id, library_id, student_id, template_id, phone, message_body, status,
                   provider_message_sid, error_message, direction, retry_count, sent_at, count(*) OVER() AS total_count
            FROM whatsapp_messages
            WHERE library_id = :library_id
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {"library_id": str(library_id), "limit": limit, "offset": offset},
    ).mappings().all()
    total = rows[0]["total_count"] if rows else 0
    return [dict(r) for r in rows], total


def already_sent_today(db: Session, *, student_id: UUID, template_type: str) -> bool:
    """Dedupe guard for the scheduled expiry-reminder job — one reminder per
    student per template per day, checked by joining to the template type."""
    return bool(
        db.execute(
            text(
                """
                SELECT 1
                FROM whatsapp_messages wm
                JOIN whatsapp_templates wt ON wt.id = wm.template_id
                WHERE wm.student_id = :student_id AND wt.type = :template_type
                  AND wm.created_at >= CURRENT_DATE AND wm.status != 'failed'
                """
            ),
            {"student_id": str(student_id), "template_type": template_type},
        ).first()
    )
