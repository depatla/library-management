"""Shared FastAPI dependencies: auth claims extraction and tenant-scoped DB sessions."""

from collections.abc import Generator
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.db import tenant_session
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_token


def get_current_claims(authorization: Annotated[str | None, Header()] = None) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        claims = decode_token(token)
    except ValueError as exc:
        raise UnauthorizedError(str(exc)) from exc
    if claims.get("type") != "access":
        raise UnauthorizedError("Invalid token type")
    return claims


CurrentClaims = Annotated[dict, Depends(get_current_claims)]


def require_super_admin(claims: CurrentClaims) -> dict:
    if not claims.get("is_super_admin"):
        raise ForbiddenError("Super admin privileges required")
    return claims


SuperAdminClaims = Annotated[dict, Depends(require_super_admin)]


def get_tenant_db(library_id: UUID, claims: CurrentClaims) -> Generator[Session, None, None]:
    """Tenant-scoped DB session for routes with a `library_id` path parameter.

    Checks the caller is a super admin or an active member of the library
    before opening the RLS-scoped session — an application-layer check on top
    of the database-level RLS policy (defense-in-depth, docs/ARCHITECTURE.md §2).
    """
    if not claims.get("is_super_admin"):
        memberships = claims.get("memberships", [])
        if not any(m["library_id"] == str(library_id) for m in memberships):
            raise ForbiddenError("You are not a member of this library")
    with tenant_session(library_id) as db:
        yield db


TenantDb = Annotated[Session, Depends(get_tenant_db)]
