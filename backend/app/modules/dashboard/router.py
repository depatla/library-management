"""Dashboard summary endpoint. Tenant-scoped under /libraries/{library_id}/dashboard."""

from uuid import UUID

from fastapi import APIRouter

from app.core.deps import TenantDb
from app.modules.dashboard import service
from app.modules.dashboard.schemas import DashboardSummary

router = APIRouter(prefix="/libraries/{library_id}/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(library_id: UUID, db: TenantDb) -> DashboardSummary:
    return service.get_summary(db, library_id)
