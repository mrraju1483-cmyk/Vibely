import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    service_key: str
    provider: str
    api_key: str
    model: str
    base_url: str
    timeout_s: float
    max_output_tokens: int
    env: str

    @property
    def configured(self) -> bool:
        """True only when a real model can be called. Without it the API answers 503, never a made-up reply."""
        if not self.model:
            return False
        if self.provider == "anthropic":
            return bool(self.api_key)
        if self.provider == "openai":
            return bool(self.api_key or self.base_url)
        return False


def _num(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


@lru_cache
def get_settings() -> Settings:
    return Settings(
        service_key=os.getenv("AI_SERVICE_KEY", "").strip(),
        provider=os.getenv("AI_PROVIDER", "anthropic").strip().lower(),
        api_key=os.getenv("AI_API_KEY", "").strip(),
        model=os.getenv("AI_MODEL", "").strip(),
        base_url=os.getenv("AI_BASE_URL", "").strip().rstrip("/"),
        timeout_s=_num("AI_TIMEOUT_SECONDS", 30),
        max_output_tokens=int(_num("AI_MAX_OUTPUT_TOKENS", 600)),
        env=os.getenv("AI_ENV", "development").strip().lower(),
    )
