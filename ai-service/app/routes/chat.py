from fastapi import APIRouter, Depends

from ..models.schemas import ChatRequest
from ..security import require_internal_key
from ..services import chat_service
from ..services.llm import LLMClient, get_llm

router = APIRouter(prefix="/v1", dependencies=[Depends(require_internal_key)])


@router.post("/chat")
async def chat(body: ChatRequest, llm: LLMClient = Depends(get_llm)):
    return {"success": True, "data": await chat_service.reply(llm, body.messages)}
