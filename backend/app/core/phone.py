import re

_CLEAN = re.compile(r"[\s\-\.\(\)]")
_DZ = re.compile(r"^(?:\+213|00213|0)([567]\d{8})$")


def normalize_dz_phone(raw: str) -> str:
    """Return +213XXXXXXXXX for valid Algerian mobiles (05/06/07), else raise ValueError."""
    m = _DZ.match(_CLEAN.sub("", raw or ""))
    if not m:
        raise ValueError("phone_invalid")
    return "+213" + m.group(1)
