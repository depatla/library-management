"""Pure proration logic — no DB access, unit-testable in isolation.

Splits a payment's amount across the calendar months in [period_start,
period_end), weighted by the number of days each month is covered.
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal


def _month_start(d: date) -> date:
    return d.replace(day=1)


def _next_month_start(d: date) -> date:
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


def compute_allocations(amount: Decimal, period_start: date, period_end: date) -> list[tuple[date, Decimal, bool]]:
    """Returns [(period_month, allocated_amount, is_prorated), ...] summing exactly to `amount`."""
    total_days = (period_end - period_start).days
    if total_days <= 0:
        raise ValueError("period_end must be after period_start")

    months: list[date] = []
    cursor = _month_start(period_start)
    while cursor < period_end:
        months.append(cursor)
        cursor = _next_month_start(cursor)

    raw_allocations: list[tuple[date, Decimal, int]] = []
    for month_start in months:
        month_end_exclusive = _next_month_start(month_start)
        covered_start = max(period_start, month_start)
        covered_end = min(period_end, month_end_exclusive)
        days_in_month = max(0, (covered_end - covered_start).days)
        if days_in_month == 0:
            continue
        share = (amount * days_in_month / total_days).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        raw_allocations.append((month_start, share, days_in_month))

    rounding_gap = amount - sum(a for _, a, _ in raw_allocations)
    if rounding_gap != 0 and raw_allocations:
        last_month, last_amount, last_days = raw_allocations[-1]
        raw_allocations[-1] = (last_month, last_amount + rounding_gap, last_days)

    is_single_full_month = len(months) == 1 and period_start == months[0] and period_end == _next_month_start(months[0])

    return [(month, alloc_amount, not is_single_full_month) for month, alloc_amount, _ in raw_allocations]
