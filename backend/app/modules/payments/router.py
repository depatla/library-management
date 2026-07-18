"""Payments endpoints. Tenant-scoped under /libraries/{library_id}/payments.

Financial records are immutable once created — no PATCH on amount/period;
corrections happen via delete + recreate (see service.delete_payment guard)."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter

from app.core.deps import CurrentClaims, TenantDb
from app.core.pagination import Page, PageQuery
from app.modules.payments import service
from app.modules.payments.schemas import PaymentCreate, PaymentOut

router = APIRouter(prefix="/libraries/{library_id}/payments", tags=["payments"])


@router.get("", response_model=Page[PaymentOut])
def list_payments(
    library_id: UUID,
    db: TenantDb,
    page_params: PageQuery,
    student_id: UUID | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> Page[PaymentOut]:
    return service.list_payments(
        db, library_id=library_id, student_id=student_id, search=search, date_from=date_from, date_to=date_to, params=page_params
    )


@router.post("", response_model=list[PaymentOut], status_code=201)
def create_payment(library_id: UUID, payload: PaymentCreate, claims: CurrentClaims, db: TenantDb) -> list[PaymentOut]:
    return service.create_payment(db, library_id=library_id, collected_by=UUID(claims["sub"]), payload=payload)


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(library_id: UUID, payment_id: UUID, db: TenantDb) -> PaymentOut:
    return service.get_payment(db, library_id=library_id, payment_id=payment_id)


@router.delete("/{payment_id}", status_code=204)
def delete_payment(library_id: UUID, payment_id: UUID, db: TenantDb) -> None:
    service.delete_payment(db, library_id=library_id, payment_id=payment_id)
