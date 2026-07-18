"""Pydantic request/response models for WhatsApp (Twilio) integration."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

TEMPLATE_TYPES = ("welcome", "payment_reminder", "renewal_reminder", "expiry_reminder", "thank_you", "custom")


class TwilioConfigCreate(BaseModel):
    account_sid: str = Field(min_length=1)
    auth_token: str = Field(min_length=1)
    whatsapp_number: str = Field(min_length=1, max_length=20)
    is_active: bool = True


class TwilioConfigUpdate(BaseModel):
    account_sid: str | None = None
    auth_token: str | None = None
    whatsapp_number: str | None = None
    is_active: bool | None = None


class TwilioConfigOut(BaseModel):
    id: UUID
    library_id: UUID
    account_sid: str
    auth_token_masked: str
    whatsapp_number: str
    is_active: bool


class TemplateCreate(BaseModel):
    type: str = Field(pattern="^(welcome|payment_reminder|renewal_reminder|expiry_reminder|thank_you|custom)$")
    name: str = Field(min_length=1, max_length=100)
    content: str = ""
    content_sid: str | None = None
    variable_mapping: dict[str, str | dict] = {}
    is_active: bool = True

    @model_validator(mode="after")
    def _require_content_or_template(self) -> "TemplateCreate":
        if not self.content.strip() and not self.content_sid:
            raise ValueError("Provide freeform content or a content_sid")
        return self


class TemplateUpdate(BaseModel):
    name: str | None = None
    content: str | None = None
    content_sid: str | None = None
    variable_mapping: dict[str, str | dict] | None = None
    is_active: bool | None = None


class TemplateOut(BaseModel):
    id: UUID
    library_id: UUID
    type: str
    name: str
    content: str
    content_sid: str | None
    variable_mapping: dict[str, str | dict]
    is_active: bool


class ContentTemplateOut(BaseModel):
    sid: str
    friendly_name: str
    language: str
    variables: dict
    body: str
    approval_status: str | None


class SendMessageRequest(BaseModel):
    student_id: UUID
    template_type: str = Field(pattern="^(welcome|payment_reminder|renewal_reminder|expiry_reminder|thank_you|custom)$")


class MessageOut(BaseModel):
    id: UUID
    library_id: UUID
    student_id: UUID | None
    template_id: UUID | None
    phone: str
    message_body: str
    status: str
    provider_message_sid: str | None
    error_message: str | None
    direction: str
    retry_count: int
    sent_at: datetime | None
