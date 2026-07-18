"""Reports business logic — thin wrappers over aggregation queries."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.reports import repository
from app.modules.reports.schemas import (
    ContributionsReport,
    OccupancyReport,
    RevenueExpenseReport,
    StudentsSummaryReport,
)


def revenue_expense(db: Session, *, library_id: UUID, months: int) -> RevenueExpenseReport:
    rows = repository.revenue_expense_series(db, library_id=library_id, months=months)
    return RevenueExpenseReport(series=rows)


def occupancy(db: Session, library_id: UUID) -> OccupancyReport:
    categories = repository.occupancy_by_category(db, library_id)
    lockers = repository.locker_occupancy(db, library_id)
    return OccupancyReport(
        categories=categories,
        total_lockers=lockers["total_lockers"],
        occupied_lockers=lockers["occupied_lockers"],
    )


def students_summary(db: Session, *, library_id: UUID, months: int) -> StudentsSummaryReport:
    rows = repository.students_summary_series(db, library_id=library_id, months=months)
    return StudentsSummaryReport(series=rows)


def contributions(db: Session, *, library_id: UUID, months: int) -> ContributionsReport:
    rows = repository.contributions_series(db, library_id=library_id, months=months)
    return ContributionsReport(series=rows)
