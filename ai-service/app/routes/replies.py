from fastapi import APIRouter, Depends

from ..models.schemas import ReplyRequest
from ..security import require_internal_key
from ..services import reply_service
from ..services.llm import LLMClient, get_llm

router = APIRouter(prefix="/v1", dependencies=[Depends(require_internal_key)])


@router.post("/smart-replies")
async def smart_replies(body: ReplyRequest, llm: LLMClient = Depends(get_llm)):
    return {"success": True, "data": await reply_service.suggest(llm, body)}
