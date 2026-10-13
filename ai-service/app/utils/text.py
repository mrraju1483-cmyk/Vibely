import re

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def clean_text(s: str, max_len: int) -> str:
    """Strip control characters and trim. Keeps newlines."""
    return _CONTROL.sub("", s or "").replace("\r\n", "\n").strip()[:max_len]


def clean_line(s: str, max_len: int) -> str:
    """One line: control characters removed, whitespace collapsed."""
    return re.sub(r"\s+", " ", _CONTROL.sub("", s or "")).strip()[:max_len]


def dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        key = item.lower()
        if item and key not in seen:
            seen.add(key)
            out.append(item)
    return out
