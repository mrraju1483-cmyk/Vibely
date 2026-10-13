from ..models.schemas import ChatMessage
from ..utils.text import clean_text
from .llm import LLMClient

SYSTEM = (
    "You are Vibely AI, the friendly assistant inside Vibely, a social media app. "
    "Help with captions, content ideas, hashtags, profile bios, writing messages and general questions. "
    "Be concise, warm and practical. You cannot browse the web, see the user's feed or take actions in the app, so never claim to. "
    "Decline requests for illegal, hateful or sexual content, harassment, or anything that could seriously harm someone."
)


async def reply(llm: LLMClient, messages: list[ChatMessage]) -> dict:
    turns = [m.model_dump() for m in messages]
    while turns and turns[0]["role"] != "user":  # providers expect the conversation to start with the user
        turns.pop(0)
    text = await llm.complete(system=SYSTEM, messages=turns, temperature=0.7)
    return {"reply": clean_text(text, 4000), "model": llm.model}
