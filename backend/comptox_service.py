"""Read selected identity and reference datasets from EPA CTX."""
import copy
import hashlib
import json
import os
import re
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from pubchem_gate import PubChemGate, ReferenceBusy

BASE = 'https://comptox.epa.gov/ctx-api/chemical/search/equal/'
DATASETS = {
    'hazard': ('hazard/toxval/search/by-dtxsid/', ('toxvalType','qualifier','toxvalNumeric','toxvalUnits','speciesCommon','exposureRoute','studyDurationValue','studyDurationUnits','source','subsource','year','doi')),
    'exposure': ('exposure/ccd/monitoring-data/search/by-dtxsid/', ('nhanesCohort','demographic','median','lowerBound','upperBound','unit','units')),
    'predictions': ('chemical/property/predicted/search/by-dtxsid/', ('propName','propValue','propValueString','propUnit','modelName','sourceName','adConclusion','adReasoning','propValueError')),
}
DOCS = 'https://www.epa.gov/comptox-tools/computational-toxicology-and-exposure-apis-about'
ID = re.compile(r'DTXSID[0-9]{7,10}')
gate = PubChemGate(Path(__file__).resolve().parent/'storage'/'comptox_gate.sqlite3')
_slots = threading.BoundedSemaphore(4)
_lock = threading.Lock()
_cache = OrderedDict()


def api_key():
    # This variable belongs only to the Python server, never NEXT_PUBLIC_*.
    value = os.getenv('COMPTOX_API_KEY', '').strip()
    return value if re.fullmatch(r'[!-~]{1,512}', value) else ''


def status():
    return {'configured': bool(api_key()), 'liveVerified': False,
            'scope': 'explicit_dtxsid_identity', 'documentationUrl': DOCS}


def identifier(value):
    value = value.strip().upper()
    if not ID.fullmatch(value):
        raise HTTPException(400, 'Invalid DTXSID')
    return value


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward the API credential to a redirect target.
        raise urllib.error.URLError('CTX redirect rejected')


def normalize(raw, identity, fetched_at):
    if not isinstance(raw, list) or len(raw) != 1 or not isinstance(raw[0], dict):
        raise ValueError('Unexpected CTX response shape')
    record = raw[0]
    if record.get('dtxsid') != identity:
        raise ValueError('CTX identity mismatch')
    def text(field, maximum=2000):
        value = record.get(field)
        if value is None:
            return None
        if not isinstance(value, str) or len(value)>maximum or re.search(r'[\x00-\x1f]',value):
            raise ValueError('Invalid CTX field')
        return value or None
    name = text('preferredName')
    if not name:
        raise ValueError('Missing CTX name')
    dtxcid = text('dtxcid', 32)
    if dtxcid and not re.fullmatch(r'DTXCID[0-9]{5,10}', dtxcid):
        raise ValueError('Invalid CTX structure identifier')
    return {'id': identity, 'name': name, 'cas': text('casrn', 100),
            'dtxcid': dtxcid, 'smiles': text('smiles'),
            'structuralMatch': 'unverified',
            'source': 'US EPA · CompTox / CTX Chemical API',
            'sourceUrl': 'https://comptox.epa.gov/dashboard/chemical/details/'+identity,
            'fetchedAt': fetched_at, 'sourceUpdatedAt': None, 'sourceVersion': None,
            'adapterVersion': 'artin-ctx-identity-v1',
            'scope': 'explicit_dtxsid_identity',
            'changes': 'Selected identity fields only; no toxicity, exposure or QSAR values are imported.'}


def normalize_dataset(raw, identity, section, fetched_at):
    if not isinstance(raw, list):
        raise ValueError('Unexpected CTX dataset')
    rows = []
    for item in raw:
        if not isinstance(item, dict) or item.get('dtxsid') != identity:
            raise ValueError('CTX dataset identity mismatch')
        row = {field: item[field] for field in DATASETS[section][1]
               if type(item.get(field)) in (str, int, float) and item[field] != ''}
        if row:
            rows.append(row)
    return {'id': identity, 'section': section, 'rows': rows[:500], 'total': len(rows),
            'fetchedAt': fetched_at, 'sourceUrl': 'https://comptox.epa.gov/ctx-api/'+DATASETS[section][0]+identity}


def compound(value, section='identity'):
    identity = identifier(value)
    if section != 'identity' and section not in DATASETS:
        raise HTTPException(400, 'Invalid CompTox dataset')
    key = api_key()
    if not key:
        raise HTTPException(503, 'CompTox API key is not configured')
    cache_key = (hashlib.sha256(key.encode()).digest(), identity, section)
    with _lock:
        cached = _cache.get(cache_key)
        if cached and time.monotonic()-cached[0] < 3600:
            _cache.move_to_end(cache_key)
            return copy.deepcopy(cached[1])
    if not _slots.acquire(blocking=False):
        raise HTTPException(429, 'CompTox busy', headers={'Retry-After':'10'})
    token = None
    try:
        token = gate.acquire()
        gate.wait_for_dispatch()
        base = BASE if section == 'identity' else 'https://comptox.epa.gov/ctx-api/'+DATASETS[section][0]
        request = urllib.request.Request(base+identity, headers={'Accept':'application/json', 'x-api-key':key})
        try:
            with urllib.request.build_opener(NoRedirect()).open(request, timeout=15) as response:
                payload = response.read(2_000_001)
                if len(payload)>2_000_000:
                    raise ValueError('CTX response too large')
                raw = json.loads(payload, parse_constant=lambda _: None)
                if raw == [] and section == 'identity':
                    raise HTTPException(404, 'DTXSID not found in CTX')
                fetched_at = datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
                result = normalize(raw, identity, fetched_at) if section == 'identity' else normalize_dataset(raw, identity, section, fetched_at)
        except urllib.error.HTTPError as error:
            if error.code in (429,503):
                from routes.chemicals import retry_delay
                delay = retry_delay(error.headers)
                gate.block(delay)
                raise HTTPException(429, 'CompTox busy', headers={'Retry-After':str(int(delay)+1)}) from None
            if error.code in (401,403):
                raise HTTPException(503, 'CompTox authentication unavailable') from None
            raise HTTPException(404 if error.code==404 else 502, 'CompTox unavailable') from None
        except (OSError, ValueError, urllib.error.URLError):
            raise HTTPException(502, 'CompTox unavailable') from None
        with _lock:
            if len(_cache)>=64:
                _cache.popitem(last=False)
            _cache[cache_key] = (time.monotonic(), result)
        return copy.deepcopy(result)
    except (ReferenceBusy, sqlite3.Error) as error:
        raise HTTPException(429 if isinstance(error,ReferenceBusy) else 503, 'CompTox busy',
                            headers={'Retry-After':str(error.retry_after if isinstance(error,ReferenceBusy) else 10)}) from None
    finally:
        if token:
            try:
                gate.release(token)
            except sqlite3.Error:
                pass
        _slots.release()
