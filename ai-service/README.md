# Vibely AI service (FastAPI)

Internal service used by the Vibely Node backend. Browsers never call it: every request needs the shared `X-Internal-Key`.

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | public liveness check |
| GET | `/v1/status` | `{configured}`: is a real model set up? |
| POST | `/v1/chat` | assistant conversation |
| POST | `/v1/captions` | caption suggestions for a topic |
| POST | `/v1/smart-replies` | short reply suggestions from recent chat lines |
| POST | `/v1/safety` | content safety check (rules, plus a model when configured) |

If no model is configured, the AI endpoints answer **503 `AI_NOT_CONFIGURED`**. Nothing is ever invented. `/v1/safety` falls back to
simple rules and reports `method: "rules"` and `degraded: true` so the caller can tell.

## Setup
    cd ai-service
    python -m venv .venv
    source .venv/bin/activate            # Windows: .venv\Scripts\activate
    pip install -r requirements-dev.txt
    cp .env.example .env                 # set AI_SERVICE_KEY, AI_API_KEY, AI_MODEL
    uvicorn app.main:app --reload --port 8001

Providers: `AI_PROVIDER=anthropic` (Anthropic Messages API) or `openai` (any OpenAI-compatible chat API: set `AI_BASE_URL` for Groq, OpenRouter, Ollama...).

## Tests
    python -m unittest discover -s tests     # utilities, no installs needed
    pytest                                    # API tests with a stub model (needs requirements-dev.txt)
