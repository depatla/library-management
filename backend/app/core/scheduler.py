"""Background jobs: daily expiry sweep + expiry-reminder WhatsApp sends.

Started once from app.main's startup event. Job functions import their
module-level dependencies lazily (inside the function body) to avoid
circular imports at app startup (scheduler -> students/whatsapp -> ... -> app).
"""

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.logging import get_logger

logger = get_logger(__name__)

_scheduler: BackgroundScheduler | None = None


def _run_daily_sweep() -> None:
    from app.core.db import SessionLocal
    from app.modules.students import repository as students_repository
    from app.modules.whatsapp import service as whatsapp_service

    db = SessionLocal()
    try:
        expired_count = students_repository.expire_overdue_students(db)
        db.commit()
        if expired_count:
            logger.info("students_expired", count=expired_count)
    except Exception as exc:  # pragma: no cover - best-effort background job
        db.rollback()
        logger.error("daily_sweep_expire_failed", error=str(exc))
    finally:
        db.close()

    db = SessionLocal()
    try:
        whatsapp_service.send_expiry_reminders(db)
        db.commit()
    except Exception as exc:  # pragma: no cover - best-effort background job
        db.rollback()
        logger.error("daily_sweep_reminders_failed", error=str(exc))
    finally:
        db.close()


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(_run_daily_sweep, "cron", hour=0, minute=0, id="daily_sweep")
    _scheduler.start()
