from fastapi import APIRouter, Depends

from ..models.schemas import SafetyRequest
from ..security import require_internal_key
from ..services import safety_service
from ..services.llm import LLMClient, get_llm_optional

router = APIRouter(prefix="/v1", dependencies=[Depends(require_internal_key)])


@router.post("/safety")
async def safety(body: SafetyRequest, llm: LLMClient | None = Depends(get_llm_optional)):
    return {"success": True, "data": await safety_service.check(llm, body)}
