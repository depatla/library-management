"""Aggregates all v1 feature routers. Each module (auth, users, libraries, ...)
adds its own router here as it's built in subsequent modules."""

from fastapi import APIRouter

from app.api.v1 import health
from app.modules.ai_assistant.router import router as ai_assistant_router
from app.modules.auth.router import router as auth_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.expenses.router import router as expenses_router
from app.modules.libraries.router import router as libraries_router
from app.modules.lockers.router import router as lockers_router
from app.modules.partners.router import router as partners_router
from app.modules.payments.router import router as payments_router
from app.modules.qr_codes.public_router import router as qr_codes_public_router
from app.modules.qr_codes.router import router as qr_codes_router
from app.modules.reports.router import router as reports_router
from app.modules.rooms_cabins.router import router as rooms_cabins_router
from app.modules.settings.router import router as settings_router
from app.modules.students.router import router as students_router
from app.modules.whatsapp.router import router as whatsapp_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth_router)
api_router.include_router(libraries_router)
api_router.include_router(rooms_cabins_router)
api_router.include_router(lockers_router)
api_router.include_router(students_router)
api_router.include_router(payments_router)
api_router.include_router(expenses_router)
api_router.include_router(partners_router)
api_router.include_router(reports_router)
api_router.include_router(dashboard_router)
api_router.include_router(qr_codes_router)
api_router.include_router(qr_codes_public_router)
api_router.include_router(whatsapp_router)
api_router.include_router(ai_assistant_router)
api_router.include_router(settings_router)
