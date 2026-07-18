"""Payments business logic: creation with proration, immutable financial records.

Monthly payments create one `payments` row per calendar month covered (not a
single multi-month row) — each month is independently visible/deletable, since
`amount` is the recurring per-month rate and students may cancel or need a
refund on just one of several months paid upfront.
"""

from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.core.pagination import Page, PageParams, make_page
from app.modules.payments import repository
from app.modules.payments.proration import compute_allocations
from app.modules.payments.schemas import AllocationOut, PaymentOut


def _out(row: dict, allocations: list[dict]) -> PaymentOut:
    data = {**row, "paid_at": row["paid_at"].isoformat()}
    return PaymentOut(**data, allocations=[AllocationOut(**a) for a in allocations])


def _create_one_payment(db: Session, *, library_id: UUID, collected_by: UUID, student_id: UUID, amount, frequency, period_start, period_end, payment_method, transaction_reference, notes) -> PaymentOut:
    allocations = compute_allocations(amount, period_start, period_end)

    payment_id = repository.create_payment(
        db,
        library_id=library_id,
        collected_by=collected_by,
        student_id=student_id,
        amount=amount,
        frequency=frequency,
        period_start=period_start,
        period_end=period_end,
        payment_method=payment_method,
        transaction_reference=transaction_reference,
        notes=notes,
    )
    for period_month, allocated_amount, is_prorated in allocations:
        repository.create_allocation(
            db,
            payment_id=payment_id,
            library_id=library_id,
            student_id=student_id,
            period_month=period_month,
            allocated_amount=allocated_amount,
            is_prorated=is_prorated,
        )

    row = repository.get_payment(db, library_id=library_id, payment_id=payment_id)
    alloc_rows = repository.get_allocations(db, payment_id)
    return _out(row, alloc_rows)


def create_payment(db: Session, *, library_id: UUID, collected_by: UUID, payload) -> list[PaymentOut]:
    if not repository.student_belongs_to_library(db, library_id=library_id, student_id=payload.student_id):
        raise NotFoundError("Student not found")

    payments: list[PaymentOut] = []
    if payload.frequency == "monthly":
        per_month_amount = (payload.amount / payload.number_of_months).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        rounding_gap = payload.amount - per_month_amount * payload.number_of_months
        for i in range(payload.number_of_months):
            seg_start = payload.period_start + relativedelta(months=i)
            seg_end = payload.period_start + relativedelta(months=i + 1)
            seg_amount = per_month_amount + rounding_gap if i == payload.number_of_months - 1 else per_month_amount
            payments.append(
                _create_one_payment(
                    db,
                    library_id=library_id,
                    collected_by=collected_by,
                    student_id=payload.student_id,
                    amount=seg_amount,
                    frequency=payload.frequency,
                    period_start=seg_start,
                    period_end=seg_end,
                    payment_method=payload.payment_method,
                    transaction_reference=payload.transaction_reference,
                    notes=payload.notes,
                )
            )
    else:
        payments.append(
            _create_one_payment(
                db,
                library_id=library_id,
                collected_by=collected_by,
                student_id=payload.student_id,
                amount=payload.amount,
                frequency=payload.frequency,
                period_start=payload.period_start,
                period_end=payload.period_end,
                payment_method=payload.payment_method,
                transaction_reference=payload.transaction_reference,
                notes=payload.notes,
            )
        )

    db.commit()

    try:
        from app.modules.whatsapp import service as whatsapp_service

        whatsapp_service.send_template(db, library_id=library_id, student_id=payload.student_id, template_type="thank_you")
        db.commit()
    except Exception:
        db.rollback()

    return payments


def get_payment(db: Session, *, library_id: UUID, payment_id: UUID) -> PaymentOut:
    row = repository.get_payment(db, library_id=library_id, payment_id=payment_id)
    if not row:
        raise NotFoundError("Payment not found")
    return _out(row, repository.get_allocations(db, payment_id))


def list_payments(db: Session, *, library_id: UUID, student_id: UUID | None, search: str | None, date_from, date_to, params: PageParams) -> Page[PaymentOut]:
    rows, total = repository.list_payments(
        db, library_id=library_id, student_id=student_id, search=search, date_from=date_from, date_to=date_to, limit=params.limit, offset=params.offset
    )
    items = [_out(r, repository.get_allocations(db, r["id"])) for r in rows]
    return make_page(items, total, params)


def delete_payment(db: Session, *, library_id: UUID, payment_id: UUID) -> None:
    row = repository.get_payment(db, library_id=library_id, payment_id=payment_id)
    if not row:
        raise NotFoundError("Payment not found")
    if repository.any_allocation_month_settled(db, payment_id):
        raise ConflictError("Cannot delete a payment with a month that has already been settled with a partner")
    repository.delete_payment(db, library_id=library_id, payment_id=payment_id)
    db.commit()
