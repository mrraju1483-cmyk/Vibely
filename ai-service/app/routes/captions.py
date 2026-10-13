from fastapi import APIRouter, Depends

from ..models.schemas import CaptionRequest
from ..security import require_internal_key
from ..services import caption_service
from ..services.llm import LLMClient, get_llm

router = APIRouter(prefix="/v1", dependencies=[Depends(require_internal_key)])


@router.post("/captions")
async def captions(body: CaptionRequest, llm: LLMClient = Depends(get_llm)):
    return {"success": True, "data": await caption_service.generate(llm, body)}
