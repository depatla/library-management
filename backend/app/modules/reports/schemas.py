"""Pydantic response models for reports."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class RevenueExpenseMonth(BaseModel):
    month: date
    revenue: Decimal
    expenses: Decimal


class RevenueExpenseReport(BaseModel):
    series: list[RevenueExpenseMonth]


class OccupancyCategory(BaseModel):
    room_category_id: UUID
    room_category_name: str
    total_cabins: int
    occupied_cabins: int


class OccupancyReport(BaseModel):
    categories: list[OccupancyCategory]
    total_lockers: int
    occupied_lockers: int


class StudentsSummaryMonth(BaseModel):
    month: date
    new_count: int
    active_count: int
    expired_count: int


class StudentsSummaryReport(BaseModel):
    series: list[StudentsSummaryMonth]


class ContributionMonth(BaseModel):
    month: date
    user_id: UUID
    full_name: str
    collected_amount: Decimal
    spent_amount: Decimal


class ContributionsReport(BaseModel):
    series: list[ContributionMonth]
