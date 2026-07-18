"""Pydantic request/response models for the AI assistant."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


class AskResponse(BaseModel):
    answer: str
    matched_intent: str


class AiQueryLogOut(BaseModel):
    id: UUID
    library_id: UUID
    user_id: UUID
    question: str
    matched_intent: str
    answer: str
    created_at: datetime
