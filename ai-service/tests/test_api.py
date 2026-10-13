"""API tests with a stub model (tests only). Needs: pip install -r requirements-dev.txt, then: pytest"""
import os

os.environ["AI_SERVICE_KEY"] = "test-key-test-key-1234"
os.environ["AI_PROVIDER"] = "anthropic"
os.environ["AI_API_KEY"] = "x"
os.environ["AI_MODEL"] = "stub-model"

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from app.services.errors import AIError  # noqa: E402
from app.services.llm import LLMClient, get_llm, get_llm_optional  # noqa: E402

KEY = {"X-Internal-Key": "test-key-test-key-1234"}


class StubLLM:
    model = "stub-model"

    def __init__(self, text='{"captions": ["Sunny vibes #beach", "Good times"], "replies": ["Sure!", "Sounds good", "On my way"]}'):
        self.text = text

    async def complete(self, **kwargs):
        return self.text


def use(llm):
    app.dependency_overrides[get_llm] = lambda: llm
    app.dependency_overrides[get_llm_optional] = lambda: llm


@pytest.fixture(autouse=True)
def reset():
    yield
    app.dependency_overrides.clear()


client = TestClient(app, raise_server_exceptions=False)


def test_health_is_public_and_minimal():
    assert client.get("/health").json() == {"status": "ok"}


def test_key_required():
    assert client.post("/v1/chat", json={"messages": [{"role": "user", "content": "hi"}]}).status_code == 401
    assert client.post("/v1/chat", headers={"X-Internal-Key": "wrong"}, json={"messages": [{"role": "user", "content": "hi"}]}).status_code == 401


def test_chat():
    use(StubLLM("Hello there!"))
    r = client.post("/v1/chat", headers=KEY, json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 200 and r.json()["data"]["reply"] == "Hello there!"


def test_chat_validation():
    use(StubLLM())
    assert client.post("/v1/chat", headers=KEY, json={"messages": []}).status_code == 400
    assert client.post("/v1/chat", headers=KEY, json={"messages": [{"role": "assistant", "content": "x"}]}).status_code == 400


def test_captions():
    use(StubLLM())
    r = client.post("/v1/captions", headers=KEY, json={"topic": "beach day", "count": 2})
    assert r.status_code == 200 and len(r.json()["data"]["captions"]) == 2


def test_captions_bad_model_output():
    use(StubLLM("sorry I cannot"))
    r = client.post("/v1/captions", headers=KEY, json={"topic": "beach day"})
    assert r.status_code == 502 and r.json()["code"] == "AI_BAD_OUTPUT"


def test_smart_replies():
    use(StubLLM())
    r = client.post("/v1/smart-replies", headers=KEY, json={"messages": [{"who": "them", "text": "Coming tonight?"}]})
    assert r.status_code == 200 and r.json()["data"]["replies"] == ["Sure!", "Sounds good", "On my way"]


def test_not_configured_is_503_never_fake():
    def nope():
        raise AIError(503, "AI_NOT_CONFIGURED", "No AI model is configured on this service.")
    app.dependency_overrides[get_llm] = nope
    r = client.post("/v1/chat", headers=KEY, json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 503 and r.json()["code"] == "AI_NOT_CONFIGURED" and "reply" not in r.text


def test_safety_rules_only_when_no_model():
    app.dependency_overrides[get_llm_optional] = lambda: None
    r = client.post("/v1/safety", headers=KEY, json={"text": "I'm going to kill you"})
    d = r.json()["data"]
    assert d["flagged"] and d["severity"] == "high" and d["method"] == "rules" and d["degraded"] is True and d["model"] is None


def test_safety_with_model():
    use(StubLLM('{"flagged": true, "categories": ["harassment"], "severity": "medium", "reason": "Insulting"}'))
    d = client.post("/v1/safety", headers=KEY, json={"text": "you are awful"}).json()["data"]
    assert d["method"] == "llm+rules" and "harassment" in d["categories"] and d["degraded"] is False


def test_safety_model_failure_falls_back_honestly():
    use(StubLLM("not json"))
    d = client.post("/v1/safety", headers=KEY, json={"text": "hello friends"}).json()["data"]
    assert d["method"] == "rules" and d["degraded"] is True


def test_safety_needs_input():
    assert client.post("/v1/safety", headers=KEY, json={}).status_code == 400


def test_provider_payloads_and_errors():
    """The real client against a mocked HTTP transport (no network)."""
    import asyncio
    from app.config import Settings

    def settings(provider):
        return Settings("k" * 16, provider, "secret", "m", "", 5, 600, "test")

    seen = {}

    def handler(request: httpx.Request):
        seen["url"], seen["headers"] = str(request.url), dict(request.headers)
        return httpx.Response(200, json={"content": [{"type": "text", "text": "hi"}], "choices": [{"message": {"content": "hi"}}]})

    ok = LLMClient(settings("anthropic"), httpx.MockTransport(handler))
    assert asyncio.run(ok.complete(system="s", messages=[{"role": "user", "content": "x"}])) == "hi"
    assert "x-api-key" in seen["headers"]
    oa = LLMClient(settings("openai"), httpx.MockTransport(handler))
    assert asyncio.run(oa.complete(system="s", messages=[{"role": "user", "content": "x"}])) == "hi"
    assert seen["url"].endswith("/chat/completions") and seen["headers"]["authorization"] == "Bearer secret"

    for status, code in ((401, "AI_PROVIDER_AUTH"), (429, "AI_PROVIDER_RATE_LIMIT"), (500, "AI_PROVIDER_ERROR")):
        bad = LLMClient(settings("anthropic"), httpx.MockTransport(lambda r, s=status: httpx.Response(s, json={"error": "secret details"})))
        with pytest.raises(AIError) as exc:
            asyncio.run(bad.complete(system="s", messages=[{"role": "user", "content": "x"}]))
        assert exc.value.code == code and "secret details" not in exc.value.message
