"""WhatsApp endpoints. Tenant-scoped under /libraries/{library_id}/whatsapp."""

from uuid import UUID

from fastapi import APIRouter

from app.core.deps import TenantDb
from app.core.pagination import Page, PageQuery
from app.modules.whatsapp import service
from app.modules.whatsapp.schemas import (
    ContentTemplateOut,
    MessageOut,
    SendMessageRequest,
    TemplateCreate,
    TemplateOut,
    TemplateUpdate,
    TwilioConfigCreate,
    TwilioConfigOut,
)

router = APIRouter(prefix="/libraries/{library_id}/whatsapp", tags=["whatsapp"])


@router.get("/config", response_model=TwilioConfigOut | None)
def get_config(library_id: UUID, db: TenantDb) -> TwilioConfigOut | None:
    return service.get_config(db, library_id)


@router.put("/config", response_model=TwilioConfigOut)
def upsert_config(library_id: UUID, payload: TwilioConfigCreate, db: TenantDb) -> TwilioConfigOut:
    return service.upsert_config(db, library_id=library_id, payload=payload)


@router.get("/content-templates", response_model=list[ContentTemplateOut])
def list_content_templates(library_id: UUID, db: TenantDb) -> list[ContentTemplateOut]:
    return service.list_content_templates(db, library_id=library_id)


@router.get("/templates", response_model=list[TemplateOut])
def list_templates(library_id: UUID, db: TenantDb) -> list[TemplateOut]:
    return service.list_templates(db, library_id)


@router.post("/templates", response_model=TemplateOut, status_code=201)
def create_template(library_id: UUID, payload: TemplateCreate, db: TenantDb) -> TemplateOut:
    return service.create_template(db, library_id=library_id, payload=payload)


@router.patch("/templates/{template_id}", response_model=TemplateOut)
def update_template(library_id: UUID, template_id: UUID, payload: TemplateUpdate, db: TenantDb) -> TemplateOut:
    return service.update_template(db, library_id=library_id, template_id=template_id, payload=payload)


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(library_id: UUID, template_id: UUID, db: TenantDb) -> None:
    service.delete_template(db, library_id=library_id, template_id=template_id)


@router.post("/send", response_model=MessageOut, status_code=201)
def send_message(library_id: UUID, payload: SendMessageRequest, db: TenantDb) -> MessageOut:
    return service.send_template(db, library_id=library_id, student_id=payload.student_id, template_type=payload.template_type)


@router.get("/messages", response_model=Page[MessageOut])
def list_messages(library_id: UUID, db: TenantDb, page_params: PageQuery) -> Page[MessageOut]:
    return service.list_messages(db, library_id=library_id, params=page_params)
