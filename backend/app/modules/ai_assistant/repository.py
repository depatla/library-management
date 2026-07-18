"""Repository for the ai_query_logs audit trail — no other tables owned."""

import json
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def create_log(db: Session, *, library_id: UUID, user_id: UUID, question: str, matched_intent: str, context_data: dict, answer: str) -> UUID:
    row = db.execute(
        text(
            """
            INSERT INTO ai_query_logs (library_id, user_id, question, matched_intent, context_data, answer)
            VALUES (:library_id, :user_id, :question, :matched_intent, :context_data, :answer)
            RETURNING id
            """
        ),
        {
            "library_id": str(library_id),
            "user_id": str(user_id),
            "question": question,
            "matched_intent": matched_intent,
            "context_data": json.dumps(context_data),
            "answer": answer,
        },
    ).mappings().first()
    return row["id"]


def list_logs(db: Session, *, library_id: UUID, limit: int, offset: int) -> tuple[list[dict], int]:
    rows = db.execute(
        text(
            """
            SELECT id, library_id, user_id, question, matched_intent, answer, created_at, count(*) OVER() AS total_count
            FROM ai_query_logs
            WHERE library_id = :library_id
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {"library_id": str(library_id), "limit": limit, "offset": offset},
    ).mappings().all()
    total = rows[0]["total_count"] if rows else 0
    return [dict(r) for r in rows], total
