"""Health and diagnostic endpoints — not tenant-scoped, no auth required."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/db")
def health_db(db: Session = Depends(get_db)) -> dict[str, object]:
    result = db.execute(text("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"))
    (table_count,) = result.one()
    version = db.execute(text("SELECT version()")).scalar_one()
    return {"status": "ok", "table_count": table_count, "postgres_version": version}
