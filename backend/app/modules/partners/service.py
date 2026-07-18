"""Partners & settlements business logic."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationDomainError
from app.core.pagination import Page, PageParams, make_page
from app.core.security import hash_password
from app.modules.libraries import repository as libraries_repository
from app.modules.partners import repository
from app.modules.partners.schemas import PartnerOut, SettlementOut
from app.modules.settings.repository import get_role_id


def list_partners(db: Session, *, library_id: UUID, params: PageParams) -> Page[PartnerOut]:
    rows, total = repository.list_partners(db, library_id=library_id, limit=params.limit, offset=params.offset)
    return make_page([PartnerOut(**r) for r in rows], total, params)


def get_partner(db: Session, *, library_id: UUID, partner_id: UUID) -> PartnerOut:
    row = repository.get_partner(db, library_id=library_id, partner_id=partner_id)
    if not row:
        raise NotFoundError("Partner not found")
    return PartnerOut(**row)


def create_partner(db: Session, *, library_id: UUID, payload) -> PartnerOut:
    existing_total = repository.active_share_percentage_total(db, library_id=library_id)
    if existing_total + payload.share_percentage > 100:
        raise ValidationDomainError("Total active partner share percentage cannot exceed 100")

    user_id = payload.user_id
    if payload.email and not user_id:
        if libraries_repository.get_user_by_email(db, payload.email):
            raise ConflictError(f"A user with email {payload.email} already exists")
        role_id = get_role_id(db, "partner")
        user = libraries_repository.create_user(
            db,
            full_name=payload.name,
            email=payload.email,
            phone=payload.phone,
            password_hash=hash_password(payload.password),
        )
        user_id = user["id"]
        libraries_repository.create_membership(db, user_id=user_id, library_id=library_id, role_id=role_id)

    row = repository.create_partner(db, library_id=library_id, payload=payload, user_id=user_id)
    db.commit()
    return PartnerOut(**row)


def update_partner(db: Session, *, library_id: UUID, partner_id: UUID, payload) -> PartnerOut:
    existing = repository.get_partner(db, library_id=library_id, partner_id=partner_id)
    if not existing:
        raise NotFoundError("Partner not found")

    will_be_active = payload.is_active if payload.is_active is not None else existing["is_active"]
    new_share = payload.share_percentage if payload.share_percentage is not None else existing["share_percentage"]
    if will_be_active:
        other_total = repository.active_share_percentage_total(db, library_id=library_id, exclude_partner_id=partner_id)
        if other_total + new_share > 100:
            raise ValidationDomainError("Total active partner share percentage cannot exceed 100")

    repository.update_partner(db, library_id=library_id, partner_id=partner_id, payload=payload)
    db.commit()
    return get_partner(db, library_id=library_id, partner_id=partner_id)


def delete_partner(db: Session, *, library_id: UUID, partner_id: UUID) -> None:
    existing = repository.get_partner(db, library_id=library_id, partner_id=partner_id)
    if not existing:
        raise NotFoundError("Partner not found")
    repository.delete_partner(db, library_id=library_id, partner_id=partner_id)
    db.commit()


def grant_login(db: Session, *, library_id: UUID, partner_id: UUID, email: str, password: str) -> PartnerOut:
    existing = repository.get_partner(db, library_id=library_id, partner_id=partner_id)
    if not existing:
        raise NotFoundError("Partner not found")
    if existing["user_id"]:
        raise ConflictError("This partner already has login access")
    if libraries_repository.get_user_by_email(db, email):
        raise ConflictError(f"A user with email {email} already exists")

    role_id = get_role_id(db, "partner")
    user = libraries_repository.create_user(
        db, full_name=existing["name"], email=email, phone=existing["phone"], password_hash=hash_password(password)
    )
    libraries_repository.create_membership(db, user_id=user["id"], library_id=library_id, role_id=role_id)
    repository.link_user(db, library_id=library_id, partner_id=partner_id, user_id=user["id"])
    db.commit()
    return get_partner(db, library_id=library_id, partner_id=partner_id)


def list_settlements(db: Session, *, library_id: UUID, partner_id: UUID, params: PageParams) -> Page[SettlementOut]:
    if not repository.get_partner(db, library_id=library_id, partner_id=partner_id):
        raise NotFoundError("Partner not found")
    rows, total = repository.list_settlements(db, library_id=library_id, partner_id=partner_id, limit=params.limit, offset=params.offset)
    return make_page([SettlementOut(**r) for r in rows], total, params)


def generate_settlements(db: Session, *, library_id: UUID, period_month: date) -> list[SettlementOut]:
    if period_month != period_month.replace(day=1):
        raise ValidationDomainError("period_month must be the first day of a month")

    revenue = repository.revenue_for_month(db, library_id=library_id, period_month=period_month)
    expenses_total = repository.expenses_for_month(db, library_id=library_id, period_month=period_month)
    net_profit = revenue - expenses_total

    partners = repository.list_active_partners(db, library_id)
    results = []
    for partner in partners:
        share_amount = (net_profit * partner["share_percentage"] / Decimal(100)).quantize(Decimal("0.01"))
        repository.upsert_settlement(db, partner_id=partner["id"], library_id=library_id, period_month=period_month, share_amount=share_amount)
        row = repository.get_settlement_for_partner_month(db, partner_id=partner["id"], period_month=period_month)
        results.append(SettlementOut(**row))
    db.commit()
    return results


def record_receipt(db: Session, *, library_id: UUID, settlement_id: UUID, amount: Decimal) -> SettlementOut:
    settlement = repository.get_settlement(db, library_id=library_id, settlement_id=settlement_id)
    if not settlement:
        raise NotFoundError("Settlement not found")
    if settlement["settled_at"] is not None:
        raise ConflictError("Settlement is already fully settled")
    repository.record_receipt(db, settlement_id=settlement_id, amount=amount)
    db.commit()
    row = repository.get_settlement(db, library_id=library_id, settlement_id=settlement_id)
    return SettlementOut(**row)
