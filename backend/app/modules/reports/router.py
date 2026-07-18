"""Reports endpoints. Tenant-scoped, read-only under /libraries/{library_id}/reports."""

from uuid import UUID

from fastapi import APIRouter, Query

from app.core.deps import TenantDb
from app.modules.reports import service
from app.modules.reports.schemas import (
    ContributionsReport,
    OccupancyReport,
    RevenueExpenseReport,
    StudentsSummaryReport,
)

router = APIRouter(prefix="/libraries/{library_id}/reports", tags=["reports"])


@router.get("/revenue-expense", response_model=RevenueExpenseReport)
def revenue_expense(library_id: UUID, db: TenantDb, months: int = Query(default=6, ge=1, le=24)) -> RevenueExpenseReport:
    return service.revenue_expense(db, library_id=library_id, months=months)


@router.get("/occupancy", response_model=OccupancyReport)
def occupancy(library_id: UUID, db: TenantDb) -> OccupancyReport:
    return service.occupancy(db, library_id)


@router.get("/students-summary", response_model=StudentsSummaryReport)
def students_summary(library_id: UUID, db: TenantDb, months: int = Query(default=6, ge=1, le=24)) -> StudentsSummaryReport:
    return service.students_summary(db, library_id=library_id, months=months)


@router.get("/contributions", response_model=ContributionsReport)
def contributions(library_id: UUID, db: TenantDb, months: int = Query(default=6, ge=1, le=24)) -> ContributionsReport:
    return service.contributions(db, library_id=library_id, months=months)
