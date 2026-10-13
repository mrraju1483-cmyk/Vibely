"""Fast, transparent rule checks. They are a safety net, not a replacement for a model: they only catch obvious cases."""
import re
from dataclasses import dataclass

SEVERITY_ORDER = {"none": 0, "low": 1, "medium": 2, "high": 3}


@dataclass(frozen=True)
class Flag:
    category: str
    severity: str
    reason: str


_PATTERNS = [
    ("self_harm", "medium", re.compile(r"\b(kill myself|end my life|want to die|suicide|self[- ]?harm)\b", re.I), "Mentions self-harm or suicide."),
    ("violence", "high", re.compile(r"\b(?:i(?:'ll| will| am going to|'m going to|'m gonna)|gonna|going to)\s+(?:kill|murder|stab|shoot|hurt)\s+(?:you|him|her|them)\b", re.I), "Contains a possible threat of violence."),
    ("spam", "low", re.compile(r"\b(free money|click here|guaranteed winner|earn \$?\d+ (?:a|per) day|dm for promo)\b", re.I), "Looks like spam or a scam."),
]
_URL = re.compile(r"https?://\S+|www\.\S+", re.I)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"(?<!\d)(?:\+?\d[\s-]?){10,13}(?!\d)")
_REPEAT = re.compile(r"(.)\1{11,}")


def run_rules(text: str) -> list[Flag]:
    flags: list[Flag] = []
    for category, severity, pattern, reason in _PATTERNS:
        if pattern.search(text):
            flags.append(Flag(category, severity, reason))
    if len(_URL.findall(text)) >= 3 or _REPEAT.search(text):
        flags.append(Flag("spam", "low", "Many links or repeated characters."))
    if _EMAIL.search(text) or _PHONE.search(text):
        flags.append(Flag("personal_info", "low", "Contains an email address or phone number."))
    return flags


def worst(flags: list[Flag]) -> str:
    return max((f.severity for f in flags), key=lambda s: SEVERITY_ORDER[s], default="none")
