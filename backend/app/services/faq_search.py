"""Fuzzy FAQ search (typo tolerant, accent insensitive), no external service."""
import re
import unicodedata
from difflib import SequenceMatcher

STOP = set("""a au aux avec ce ces c est cest d de des du elle en et il ils je j l la le les leur lui ma me mes moi mon ne nos notre nous on ou
par pas pour qu que quel quelle quelles quels qui sa se ses son sont sur ta te tes toi ton tu un une vos votre vous y suis est etre
comment pourquoi quoi faire fait peut peux puis veux voudrais dois il y a ai as avez bonjour svp merci est-ce ca cela
في من على الى إلى عن ما هل كيف لماذا هو هي أنا انا""".split())


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", (s or "").lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^\w\s]", " ", s).split())


def tokens(s: str) -> list[str]:
    return [t for t in norm(s).split() if len(t) > 1 and t not in STOP]


def _tok_sim(a: str, b: str) -> float:
    if a == b:
        return 1.0
    if min(len(a), len(b)) < 4:
        return 0.0
    if a.startswith(b) or b.startswith(a):
        return 0.9
    return SequenceMatcher(None, a, b).ratio()


def score_text(query: str, text: str) -> float:
    q, t = tokens(query), tokens(text)
    if not q or not t:
        return 0.0
    m = 0.0
    for qt in q:
        best = max(_tok_sim(qt, tt) for tt in t)
        if best >= 0.75:
            m += best
    if not m:
        return 0.0
    recall, precision = m / len(q), m / len(t)
    overlap = 2 * recall * precision / (recall + precision)
    seq = SequenceMatcher(None, " ".join(q), " ".join(t)).ratio()
    return round(min(1.0, overlap * 0.8 + seq * 0.2), 3)


def search(query: str, entries: list[dict]) -> list[tuple[float, dict]]:
    scored = []
    for e in entries:
        texts = [e.get("question_fr"), e.get("question_ar"), *(e.get("variants") or [])]
        s = max((score_text(query, x) for x in texts if x), default=0.0)
        scored.append((s, e))
    return sorted(scored, key=lambda x: -x[0])
