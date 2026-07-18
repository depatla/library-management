"""AI assistant business logic: gathers a scalar context struct, sends it plus
the user's question to Groq via a plain chat-completions call (no tool
calling round-trip — context-stuffing is sufficient for v1), logs the
exchange to ai_query_logs."""

import json
from uuid import UUID

from groq import Groq
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import ConflictError
from app.core.pagination import Page, PageParams, make_page
from app.modules.ai_assistant import repository
from app.modules.ai_assistant.context import gather_context
from app.modules.ai_assistant.schemas import AiQueryLogOut, AskResponse

settings = get_settings()

_SYSTEM_PROMPT = (
    "You are a study-library management assistant. Answer only using the JSON "
    "context provided. If the answer isn't derivable from the context, say so. "
    "Be concise."
)

_INTENT_KEYWORDS = {
    "occupancy": ("occupancy", "cabin", "locker", "seat", "room"),
    "revenue": ("revenue", "income", "collected", "payment", "earning"),
    "expenses": ("expense", "spend", "cost", "expenditure"),
    "students": ("student", "enrollment", "enrolled"),
    "expiry": ("expiring", "expire", "renewal", "due"),
}


def _classify_intent(question: str) -> str:
    lowered = question.lower()
    for intent, keywords in _INTENT_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            return intent
    return "general"


def ask(db: Session, *, library_id: UUID, user_id: UUID, question: str) -> AskResponse:
    if not settings.GROQ_API_KEY:
        raise ConflictError("AI Assistant is not configured (missing GROQ_API_KEY)")

    context = gather_context(db, library_id)

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": f"Context: {json.dumps(context)}\n\nQuestion: {question}"},
    ]

    client = Groq(api_key=settings.GROQ_API_KEY)
    try:
        completion = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=messages,
            temperature=0.2,
        )
    except Exception as exc:
        raise ConflictError(f"AI request failed: {exc}") from exc

    answer = completion.choices[0].message.content
    matched_intent = _classify_intent(question)

    repository.create_log(
        db, library_id=library_id, user_id=user_id, question=question, matched_intent=matched_intent, context_data=context, answer=answer
    )
    db.commit()

    return AskResponse(answer=answer, matched_intent=matched_intent)


def list_history(db: Session, *, library_id: UUID, params: PageParams) -> Page[AiQueryLogOut]:
    rows, total = repository.list_logs(db, library_id=library_id, limit=params.limit, offset=params.offset)
    return make_page([AiQueryLogOut(**r) for r in rows], total, params)
