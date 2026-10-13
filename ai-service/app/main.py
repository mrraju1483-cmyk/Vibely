import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .config import get_settings
from .routes import captions, chat, health, replies, safety
from .services.errors import AIError

log = logging.getLogger("vibely.ai")
MAX_BODY_BYTES = 64 * 1024


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    if len(s.service_key) < 16:
        raise RuntimeError("AI_SERVICE_KEY must be set to a secret of at least 16 characters (see .env.example)")
    log.info("Vibely AI service started. Model configured: %s", s.configured)  # never logs keys
    yield


settings = get_settings()
# No CORS middleware on purpose: only the Node backend calls this service, browsers never do.
app = FastAPI(title="Vibely AI Service", lifespan=lifespan, docs_url=None if settings.env == "production" else "/docs", redoc_url=None)


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"success": False, "code": code, "message": message})


@app.middleware("http")
async def limit_body(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
        return _error(413, "AI_BAD_REQUEST", "Request too large")
    return await call_next(request)


@app.exception_handler(AIError)
async def ai_error_handler(request: Request, exc: AIError):
    return _error(exc.status, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return _error(400, "AI_BAD_REQUEST", "Invalid request")  # never echoes the input back


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception):
    log.error("unhandled error: %s", type(exc).__name__)
    return _error(500, "AI_INTERNAL", "Something went wrong in the AI service")


for module in (health, chat, captions, replies, safety):
    app.include_router(module.router)
