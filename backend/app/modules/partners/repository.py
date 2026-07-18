"""Partners & settlements module repository — raw SQL via SQLAlchemy Core."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

_SELECT_PARTNER = """
    SELECT lp.id, lp.library_id, lp.user_id, lp.name, lp.phone, lp.share_percentage, lp.is_active,
           u.email AS email
    FROM library_partners lp
    LEFT JOIN users u ON u.id = lp.user_id
"""

_SELECT_PARTNER_WITH_COUNT = """
    SELECT lp.id, lp.library_id, lp.user_id, lp.name, lp.phone, lp.share_percentage, lp.is_active,
           u.email AS email,
           count(*) OVER() AS total_count
    FROM library_partners lp
    LEFT JOIN users u ON u.id = lp.user_id
"""


def list_partners(db: Session, *, library_id: UUID, limit: int, offset: int) -> tuple[list[dict], int]:
    rows = db.execute(
        text(
            _SELECT_PARTNER_WITH_COUNT
            + """
            WHERE lp.library_id = :library_id
            ORDER BY lp.name
            LIMIT :limit OFFSET :offset
            """
        ),
        {"library_id": str(library_id), "limit": limit, "offset": offset},
    ).mappings().all()
    total = rows[0]["total_count"] if rows else 0
    return [dict(r) for r in rows], total


def get_partner(db: Session, *, library_id: UUID, partner_id: UUID) -> dict | None:
    row = db.execute(
        text(_SELECT_PARTNER + " WHERE lp.id = :id AND lp.library_id = :library_id"),
        {"id": str(partner_id), "library_id": str(library_id)},
    ).mappings().first()
    return dict(row) if row else None


def active_share_percentage_total(db: Session, *, library_id: UUID, exclude_partner_id: UUID | None = None) -> Decimal:
    row = db.execute(
        text(
            """
            SELECT COALESCE(SUM(share_percentage), 0) FROM library_partners
            WHERE library_id = :library_id AND is_active = true
              AND (CAST(:exclude_id AS UUID) IS NULL OR id != CAST(:exclude_id AS UUID))
            """
        ),
        {"library_id": str(library_id), "exclude_id": str(exclude_partner_id) if exclude_partner_id else None},
    ).first()
    return Decimal(row[0])


def create_partner(db: Session, *, library_id: UUID, payload, user_id: UUID | None) -> dict:
    row = db.execute(
        text(
            """
            INSERT INTO library_partners (library_id, user_id, name, phone, share_percentage)
            VALUES (:library_id, :user_id, :name, :phone, :share_percentage)
            RETURNING id, library_id, user_id, name, phone, share_percentage, is_active
            """
        ),
        {
            "library_id": str(library_id),
            "user_id": str(user_id) if user_id else None,
            "name": payload.name,
            "phone": payload.phone,
            "share_percentage": payload.share_percentage,
        },
    ).mappings().first()
    return dict(row)


def update_partner(db: Session, *, library_id: UUID, partner_id: UUID, payload) -> None:
    db.execute(
        text(
            """
            UPDATE library_partners SET
                name = COALESCE(:name, name),
                phone = COALESCE(:phone, phone),
                share_percentage = COALESCE(:share_percentage, share_percentage),
                is_active = COALESCE(:is_active, is_active)
            WHERE id = :id AND library_id = :library_id
            """
        ),
        {
            "name": payload.name,
            "phone": payload.phone,
            "share_percentage": payload.share_percentage,
            "is_active": payload.is_active,
            "id": str(partner_id),
            "library_id": str(library_id),
        },
    )


def delete_partner(db: Session, *, library_id: UUID, partner_id: UUID) -> None:
    db.execute(
        text("DELETE FROM library_partners WHERE id = :id AND library_id = :library_id"),
        {"id": str(partner_id), "library_id": str(library_id)},
    )


def link_user(db: Session, *, library_id: UUID, partner_id: UUID, user_id: UUID) -> None:
    db.execute(
        text("UPDATE library_partners SET user_id = :user_id WHERE id = :id AND library_id = :library_id"),
        {"user_id": str(user_id), "id": str(partner_id), "library_id": str(library_id)},
    )


_SELECT_SETTLEMENT = """
    SELECT id, partner_id, library_id, period_month, share_amount, received_amount,
           (share_amount - received_amount) AS balance, settled_at, notes
    FROM partner_settlements
"""

_SELECT_SETTLEMENT_WITH_COUNT = """
    SELECT id, partner_id, library_id, period_month, share_amount, received_amount,
           (share_amount - received_amount) AS balance, settled_at, notes,
           count(*) OVER() AS total_count
    FROM partner_settlements
"""


def list_settlements(db: Session, *, library_id: UUID, partner_id: UUID, limit: int, offset: int) -> tuple[list[dict], int]:
    rows = db.execute(
        text(
            _SELECT_SETTLEMENT_WITH_COUNT
            + """
            WHERE library_id = :library_id AND partner_id = :partner_id
            ORDER BY period_month DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {"library_id": str(library_id), "partner_id": str(partner_id), "limit": limit, "offset": offset},
    ).mappings().all()
    total = rows[0]["total_count"] if rows else 0
    return [dict(r) for r in rows], total


def get_settlement(db: Session, *, library_id: UUID, settlement_id: UUID) -> dict | None:
    row = db.execute(
        text(_SELECT_SETTLEMENT + " WHERE id = :id AND library_id = :library_id"),
        {"id": str(settlement_id), "library_id": str(library_id)},
    ).mappings().first()
    return dict(row) if row else None


def get_settlement_for_partner_month(db: Session, *, partner_id: UUID, period_month: date) -> dict | None:
    row = db.execute(
        text(_SELECT_SETTLEMENT + " WHERE partner_id = :partner_id AND period_month = :period_month"),
        {"partner_id": str(partner_id), "period_month": period_month},
    ).mappings().first()
    return dict(row) if row else None


def list_active_partners(db: Session, library_id: UUID) -> list[dict]:
    rows = db.execute(
        text(_SELECT_PARTNER + " WHERE lp.library_id = :library_id AND lp.is_active = true"),
        {"library_id": str(library_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def revenue_for_month(db: Session, *, library_id: UUID, period_month: date) -> Decimal:
    row = db.execute(
        text(
            """
            SELECT COALESCE(SUM(allocated_amount), 0) FROM payment_allocations
            WHERE library_id = :library_id AND period_month = :period_month
            """
        ),
        {"library_id": str(library_id), "period_month": period_month},
    ).first()
    return Decimal(row[0])


def expenses_for_month(db: Session, *, library_id: UUID, period_month: date) -> Decimal:
    row = db.execute(
        text(
            """
            SELECT COALESCE(SUM(amount), 0) FROM expenses
            WHERE library_id = :library_id AND date_trunc('month', expense_date) = :period_month
            """
        ),
        {"library_id": str(library_id), "period_month": period_month},
    ).first()
    return Decimal(row[0])


def upsert_settlement(db: Session, *, partner_id: UUID, library_id: UUID, period_month: date, share_amount: Decimal) -> None:
    db.execute(
        text(
            """
            INSERT INTO partner_settlements (partner_id, library_id, period_month, share_amount)
            VALUES (:partner_id, :library_id, :period_month, :share_amount)
            ON CONFLICT (partner_id, period_month) DO UPDATE
                SET share_amount = EXCLUDED.share_amount
                WHERE partner_settlements.settled_at IS NULL
            """
        ),
        {
            "partner_id": str(partner_id),
            "library_id": str(library_id),
            "period_month": period_month,
            "share_amount": share_amount,
        },
    )


def record_receipt(db: Session, *, settlement_id: UUID, amount: Decimal) -> None:
    db.execute(
        text(
            """
            UPDATE partner_settlements SET
                received_amount = received_amount + :amount,
                settled_at = CASE WHEN received_amount + :amount >= share_amount THEN now() ELSE settled_at END
            WHERE id = :id
            """
        ),
        {"amount": amount, "id": str(settlement_id)},
    )
