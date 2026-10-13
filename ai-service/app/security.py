import hmac

from fastapi import Header, HTTPException

from .config import get_settings


async def require_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    """Only the Node backend (which knows the shared secret) may call this service. Browsers never reach it."""
    expected = get_settings().service_key
    if not expected or not x_internal_key or not hmac.compare_digest(x_internal_key.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="unauthorized")
