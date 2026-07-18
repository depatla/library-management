"""AI assistant endpoints. Tenant-scoped under /libraries/{library_id}/ai."""

from uuid import UUID

from fastapi import APIRouter

from app.core.deps import CurrentClaims, TenantDb
from app.core.pagination import Page, PageQuery
from app.modules.ai_assistant import service
from app.modules.ai_assistant.schemas import AiQueryLogOut, AskRequest, AskResponse

router = APIRouter(prefix="/libraries/{library_id}/ai", tags=["ai-assistant"])


@router.post("/ask", response_model=AskResponse)
def ask(library_id: UUID, payload: AskRequest, claims: CurrentClaims, db: TenantDb) -> AskResponse:
    return service.ask(db, library_id=library_id, user_id=UUID(claims["sub"]), question=payload.question)


@router.get("/history", response_model=Page[AiQueryLogOut])
def history(library_id: UUID, db: TenantDb, page_params: PageQuery) -> Page[AiQueryLogOut]:
    return service.list_history(db, library_id=library_id, params=page_params)
