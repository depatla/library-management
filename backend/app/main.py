"""FastAPI application entrypoint.

Run locally with:
    uvicorn app.main:app --reload --port 8000
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.error_handlers import register_exception_handlers
from app.core.logging import configure_logging
from app.core.scheduler import start_scheduler

settings = get_settings()
configure_logging(debug=settings.DEBUG)

Path(settings.STATIC_ROOT, "qr").mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    debug=settings.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.mount("/static", StaticFiles(directory=settings.STATIC_ROOT), name="static")

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.on_event("startup")
def _start_scheduler() -> None:
    start_scheduler()


@app.get("/")
def root() -> dict[str, str]:
    return {"service": settings.APP_NAME, "status": "running"}
