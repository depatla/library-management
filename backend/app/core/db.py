"""
Database engine/session setup.

Implements the tenant-context propagation described in docs/ARCHITECTURE.md §2:
every request-scoped session runs `SET LOCAL app.current_library_id = ...` so
PostgreSQL RLS policies enforce tenant isolation at the engine level, as a
defense-in-depth backstop to the repository-layer library_id filtering.
"""

from collections.abc import Generator
from contextlib import contextmanager
from uuid import UUID

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, future=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: a plain session, no tenant context set.

    Used for platform-global endpoints (auth, super-admin) that are not
    scoped to a single library.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def tenant_session(library_id: UUID) -> Generator[Session, None, None]:
    """Session with the Postgres session variable set for RLS enforcement.

    Every tenant-scoped repository call must go through a session obtained
    this way (see app.core.deps.get_tenant_db) — never the raw get_db().
    """
    db = SessionLocal()
    try:
        db.execute(text("SELECT set_config('app.current_library_id', :library_id, true)"), {"library_id": str(library_id)})
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
