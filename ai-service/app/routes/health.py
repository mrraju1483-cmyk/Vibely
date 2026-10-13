from fastapi import APIRouter, Depends

from ..config import get_settings
from ..security import require_internal_key

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}  # public, reveals nothing


@router.get("/v1/status", dependencies=[Depends(require_internal_key)])
async def status():
    return {"success": True, "data": {"configured": get_settings().configured}}
