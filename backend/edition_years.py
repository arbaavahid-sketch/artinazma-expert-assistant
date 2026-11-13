"""Drop standard edition years the answer cannot back up.

Web search makes the model write codes such as "ASTM D323-26" or "D5191-22"
when its own cited page says D5191-20, and edition years are exactly the kind
of number prompt wording did not hold. An edition year is kept only when the
same code-and-year appears in the internal context (retrieved standards,
catalog, web snippets) or in a link the answer itself cites, such as
store.astm.org/d4057-22.html. Otherwise the bare designation is kept: "D4057".
"""
import re

# D/E-series codes on their own (D4057-22, E200-23); other ASTM letters only after
# "ASTM", so part numbers such as "C10-40" are left alone. Optional revision letter,
# editorial "e1" and reapproval year: D445-24a, D6304-20e1, D4057-95(2011).
_CODE = re.compile(
    r"(?<![\w/.\-])(?P<prefix>ASTM\s?)?(?P<letter>[A-G])\s?(?P<number>\d{2,5})"
    r"-(?P<year>\d{2})(?:[a-c]|e\d)?(?:\(\d{4}\))?(?![\w\-])"
)
_URL = re.compile(r"https?://[^\s)\]>\"']+")
_DASHES = str.maketrans({"−": "-", "–": "-", "—": "-", "‐": "-"})


def _normalize(text):
    return re.sub(r"\s+", "", str(text or "").translate(_DASHES)).lower()


def strip_unsupported_editions(answer, evidence=""):
    """The answer with edition years removed unless `evidence` or the answer's own links contain them."""
    if not answer or "-" not in answer:
        return answer
    known = _normalize(evidence) + " " + _normalize(" ".join(_URL.findall(answer)))

    def replace(m):
        if not m["prefix"] and m["letter"] not in "DE":
            return m[0]
        if f"{m['letter']}{m['number']}-{m['year']}".lower() in known:
            return m[0]
        return f"{m['prefix'] or ''}{m['letter']}{m['number']}"

    # Links are left untouched: only the visible designations are rewritten.
    parts = re.split(f"({_URL.pattern})", answer)
    return "".join(p if i % 2 else _CODE.sub(replace, p) for i, p in enumerate(parts))
