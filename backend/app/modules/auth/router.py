"""Auth endpoints. Access token returned in the JSON body (held in-memory on
the frontend); refresh token set as an httpOnly cookie, rotated on every use.

No public /register endpoint — per requirement #15, accounts are always
created by a super admin, together with the library they belong to
(see app.modules.libraries)."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import CurrentClaims
from app.core.exceptions import UnauthorizedError
from app.modules.auth import service
from app.modules.auth.schemas import LoginRequest, LoginResponse, RefreshResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

settings = get_settings()
REFRESH_COOKIE_NAME = "refresh_token"


def _set_refresh_cookie(response: Response, raw_refresh_token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_refresh_token,
        httponly=True,
        secure=settings.ENVIRONMENT != "development",
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/v1/auth",
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> LoginResponse:
    result, raw_refresh_token = service.login(
        db,
        email=payload.email,
        password=payload.password,
        device_info=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    _set_refresh_cookie(response, raw_refresh_token)
    return result


@router.post("/refresh", response_model=RefreshResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> RefreshResponse:
    raw_refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw_refresh_token:
        raise UnauthorizedError("Missing refresh token")
    access_token, new_raw_refresh_token = service.refresh(db, raw_refresh_token=raw_refresh_token)
    _set_refresh_cookie(response, new_raw_refresh_token)
    return RefreshResponse(access_token=access_token)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    raw_refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if raw_refresh_token:
        service.logout(db, raw_refresh_token=raw_refresh_token)
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/api/v1/auth")


@router.get("/me", response_model=UserOut)
def me(claims: CurrentClaims, db: Session = Depends(get_db)) -> UserOut:
    return service.get_current_user(db, user_id=UUID(claims["sub"]))
