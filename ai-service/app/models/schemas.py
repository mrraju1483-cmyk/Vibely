from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)

    @field_validator("messages")
    @classmethod
    def last_is_user(cls, v: list[ChatMessage]) -> list[ChatMessage]:
        if v[-1].role != "user":
            raise ValueError("the last message must be from the user")
        return v


class CaptionRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=300)
    tone: Literal["fun", "professional", "inspiring", "casual", "witty"] = "fun"
    count: int = Field(default=3, ge=1, le=5)
    hashtags: bool = True


class ReplyLine(BaseModel):
    who: Literal["me", "them"]
    text: str = Field(min_length=1, max_length=300)


class ReplyRequest(BaseModel):
    messages: list[ReplyLine] = Field(min_length=1, max_length=12)


class MediaMeta(BaseModel):
    mediaType: Optional[Literal["image", "video", "text"]] = None
    filename: Optional[str] = Field(default=None, max_length=200)


class SafetyRequest(BaseModel):
    text: Optional[str] = Field(default=None, max_length=5000)
    metadata: Optional[MediaMeta] = None

    @model_validator(mode="after")
    def need_something(self):
        has_text = bool(self.text and self.text.strip())
        has_meta = bool(self.metadata and (self.metadata.filename or self.metadata.mediaType))
        if not (has_text or has_meta):
            raise ValueError("provide text or metadata to check")
        return self
