import gzip
import json
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def snapshot():
    with gzip.open(Path(__file__).parent/'data/lab-reference-context.json.gz', 'rt', encoding='utf-8') as source:
        return json.load(source)


def normalize(text):
    return str(text).casefold().replace('ي', 'ی').replace('ك', 'ک').replace('آ', 'ا').replace('\u200c', ' ')


def contains(text, term):
    import re
    return bool(re.search(r'(?<!\w)'+re.escape(normalize(term))+r'(?!\w)', normalize(text)))
