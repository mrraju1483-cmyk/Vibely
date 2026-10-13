import logging

import httpx

from ..config import Settings, get_settings
from .errors import AIError

log = logging.getLogger("vibely.ai")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
OPENAI_URL = "https://api.openai.com/v1"


class LLMClient:
    """Calls a real model. Providers: Anthropic Messages API, or any OpenAI-compatible chat API."""

    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None):
        self.s = settings
        self._transport = transport  # tests can pass httpx.MockTransport

    @property
    def model(self) -> str:
        return self.s.model

    async def complete(self, *, system: str, messages: list[dict], max_tokens: int | None = None, temperature: float = 0.7) -> str:
        max_tokens = min(max_tokens or self.s.max_output_tokens, self.s.max_output_tokens)
        try:
            async with httpx.AsyncClient(timeout=self.s.timeout_s, transport=self._transport) as client:
                if self.s.provider == "anthropic":
                    resp = await client.post(
                        self.s.base_url or ANTHROPIC_URL,
                        headers={"x-api-key": self.s.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                        json={"model": self.s.model, "max_tokens": max_tokens, "temperature": temperature, "system": system, "messages": messages},
                    )
                else:
                    headers = {"content-type": "application/json"}
                    if self.s.api_key:
                        headers["authorization"] = f"Bearer {self.s.api_key}"
                    resp = await client.post(
                        f"{self.s.base_url or OPENAI_URL}/chat/completions",
                        headers=headers,
                        json={"model": self.s.model, "max_tokens": max_tokens, "temperature": temperature,
                              "messages": [{"role": "system", "content": system}, *messages]},
                    )
        except httpx.TimeoutException:
            raise AIError(504, "AI_TIMEOUT", "The AI model took too long to respond.")
        except httpx.HTTPError as exc:
            log.warning("provider connection failed: %s", type(exc).__name__)
            raise AIError(502, "AI_PROVIDER_ERROR", "Could not reach the AI model.")

        if resp.status_code in (401, 403):
            log.error("provider rejected our credentials (HTTP %s)", resp.status_code)  # details are never sent to clients
            raise AIError(502, "AI_PROVIDER_AUTH", "The AI model rejected this service's credentials.")
        if resp.status_code == 429:
            raise AIError(429, "AI_PROVIDER_RATE_LIMIT", "The AI model is busy. Try again shortly.")
        if resp.status_code >= 400:
            log.warning("provider error: HTTP %s", resp.status_code)
            raise AIError(502, "AI_PROVIDER_ERROR", "The AI model could not complete this request.")

        try:
            data = resp.json()
            if self.s.provider == "anthropic":
                text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
            else:
                text = data["choices"][0]["message"]["content"] or ""
        except (ValueError, KeyError, IndexError, TypeError, AttributeError):
            raise AIError(502, "AI_BAD_OUTPUT", "The AI model returned an unexpected response.")
        text = text.strip()
        if not text:
            raise AIError(502, "AI_BAD_OUTPUT", "The AI model returned an empty response.")
        return text


def get_llm() -> LLMClient:
    """FastAPI dependency. Fails with 503 when no model is configured (a reply is never invented)."""
    settings = get_settings()
    if not settings.configured:
        raise AIError(503, "AI_NOT_CONFIGURED", "No AI model is configured on this service.")
    return LLMClient(settings)


def get_llm_optional() -> LLMClient | None:
    settings = get_settings()
    return LLMClient(settings) if settings.configured else None
