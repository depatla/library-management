"""Pydantic response models for the dashboard summary."""

from decimal import Decimal

from pydantic import BaseModel

from app.modules.reports.schemas import RevenueExpenseMonth


class DashboardSummary(BaseModel):
    new_students_this_month: int
    amount_collected_this_month: Decimal
    expenses_this_month: Decimal
    monthly_series: list[RevenueExpenseMonth]
