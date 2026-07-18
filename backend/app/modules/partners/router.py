"""Partners & settlements endpoints. Tenant-scoped under /libraries/{library_id}."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter

from app.core.deps import TenantDb
from app.core.pagination import Page, PageQuery
from app.modules.partners import service
from app.modules.partners.schemas import (
    GrantLoginRequest,
    PartnerCreate,
    PartnerOut,
    PartnerUpdate,
    RecordReceiptRequest,
    SettlementOut,
)

router = APIRouter(prefix="/libraries/{library_id}/partners", tags=["partners"])


@router.get("", response_model=Page[PartnerOut])
def list_partners(library_id: UUID, db: TenantDb, page_params: PageQuery) -> Page[PartnerOut]:
    return service.list_partners(db, library_id=library_id, params=page_params)


@router.post("", response_model=PartnerOut, status_code=201)
def create_partner(library_id: UUID, payload: PartnerCreate, db: TenantDb) -> PartnerOut:
    return service.create_partner(db, library_id=library_id, payload=payload)


@router.get("/{partner_id}", response_model=PartnerOut)
def get_partner(library_id: UUID, partner_id: UUID, db: TenantDb) -> PartnerOut:
    return service.get_partner(db, library_id=library_id, partner_id=partner_id)


@router.patch("/{partner_id}", response_model=PartnerOut)
def update_partner(library_id: UUID, partner_id: UUID, payload: PartnerUpdate, db: TenantDb) -> PartnerOut:
    return service.update_partner(db, library_id=library_id, partner_id=partner_id, payload=payload)


@router.delete("/{partner_id}", status_code=204)
def delete_partner(library_id: UUID, partner_id: UUID, db: TenantDb) -> None:
    service.delete_partner(db, library_id=library_id, partner_id=partner_id)


@router.post("/{partner_id}/grant-login", response_model=PartnerOut)
def grant_login(library_id: UUID, partner_id: UUID, payload: GrantLoginRequest, db: TenantDb) -> PartnerOut:
    return service.grant_login(db, library_id=library_id, partner_id=partner_id, email=payload.email, password=payload.password)


@router.get("/{partner_id}/settlements", response_model=Page[SettlementOut])
def list_settlements(library_id: UUID, partner_id: UUID, db: TenantDb, page_params: PageQuery) -> Page[SettlementOut]:
    return service.list_settlements(db, library_id=library_id, partner_id=partner_id, params=page_params)


@router.post("/settlements/generate", response_model=list[SettlementOut])
def generate_settlements(library_id: UUID, db: TenantDb, period_month: date) -> list[SettlementOut]:
    return service.generate_settlements(db, library_id=library_id, period_month=period_month)


@router.post("/settlements/{settlement_id}/record-receipt", response_model=SettlementOut)
def record_receipt(library_id: UUID, settlement_id: UUID, payload: RecordReceiptRequest, db: TenantDb) -> SettlementOut:
    return service.record_receipt(db, library_id=library_id, settlement_id=settlement_id, amount=payload.amount)
