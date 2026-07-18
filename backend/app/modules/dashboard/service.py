"""Dashboard summary business logic — composes data from existing modules,
no new tables or queries of its own."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.dashboard.schemas import DashboardSummary
from app.modules.expenses import repository as expenses_repository
from app.modules.payments import repository as payments_repository
from app.modules.reports import repository as reports_repository
from app.modules.students import repository as students_repository


def get_summary(db: Session, library_id: UUID) -> DashboardSummary:
    new_students = students_repository.new_students_this_month_count(db, library_id)
    amount_collected = payments_repository.revenue_this_month_count_and_sum(db, library_id)
    expenses_total = expenses_repository.expenses_this_month(db, library_id)
    series = reports_repository.revenue_expense_series(db, library_id=library_id, months=4)

    return DashboardSummary(
        new_students_this_month=new_students,
        amount_collected_this_month=amount_collected,
        expenses_this_month=expenses_total,
        monthly_series=series,
    )
