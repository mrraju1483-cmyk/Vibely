import json
import re

_FENCE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.S | re.I)


def extract_json(text: str):
    """Parse JSON from model output, tolerating code fences and a little text around it. Raises ValueError."""
    s = (text or "").strip()
    fence = _FENCE.match(s)
    if fence:
        s = fence.group(1)
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass
    for open_c, close_c in (("{", "}"), ("[", "]")):
        start, end = s.find(open_c), s.rfind(close_c)
        if start != -1 and end > start:
            try:
                return json.loads(s[start : end + 1])
            except json.JSONDecodeError:
                continue
    raise ValueError("no JSON found in model output")
