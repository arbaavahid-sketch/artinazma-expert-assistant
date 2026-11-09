"""Bounded, same-host PubChem transport used by the compound explorer."""
import json
import re
import math
import sqlite3
from concurrent.futures import Future, TimeoutError as FutureTimeout
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pubchem_gate import gate, ReferenceBusy
import threading
import time
import urllib.error
import urllib.request
from collections import OrderedDict
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from utils.deps import limiter
from pydantic import BaseModel, Field

router = APIRouter(prefix='/chemicals', tags=['Chemical reference'])
_lock = threading.Lock()
_slots = threading.BoundedSemaphore(24)
_cache = OrderedDict()
_pending = {}

@dataclass(frozen=True)
class PubChemRecord:
    value: dict
    fetched_at: str
    source_url: str


_ALLOWED = re.compile(r'^(?:pug/compound/(?:cid/[1-9][0-9]{0,9}/JSON\?record_type=3d|cid/[1-9][0-9]{0,9}/property/SMILES/JSON|cid/[1-9][0-9,]{0,450}/property/Title,MolecularFormula,MolecularWeight,IUPACName,InChI,InChIKey,CanonicalSMILES/JSON|(?:name|cid)/[^/?#]{1,900}/cids/JSON|fastformula/[^/?#]{1,900}/cids/JSON\?MaxRecords=40&MaxSeconds=5)|autocomplete/compound/[^/?#]{1,900}/json\?limit=12|pug_view/data/compound/[1-9][0-9]{0,9}/JSON\?heading=(?:Chemical%20and%20Physical%20Properties|Safety%20and%20Hazards|Names%20and%20Identifiers))$')

class SameHostRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        from urllib.parse import urlsplit
        target = urlsplit(newurl)
        if target.scheme != 'https' or target.netloc != 'pubchem.ncbi.nlm.nih.gov':
            raise urllib.error.URLError('Unexpected redirect')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def retry_delay(headers):
    text = headers.get('Retry-After', '10') if headers else '10'
    try:
        delay = float(text)
    except (ValueError, TypeError):
        try:
            delay = parsedate_to_datetime(text).timestamp()-time.time()
        except (ValueError, TypeError, OverflowError):
            delay = 10
    return min(3600, max(10, delay)) if math.isfinite(delay) else 10


def fetch_pubchem_record(path):
    if not _ALLOWED.fullmatch(path):
        raise HTTPException(400, 'Unsupported PubChem request')
    with _lock:
        hit = _cache.get(path)
        if hit and time.monotonic()-hit[0] < 3600:
            _cache.move_to_end(path)
            return hit[1]
        future = _pending.get(path)
        leader = future is None
        if leader:
            if not _slots.acquire(blocking=False):
                raise HTTPException(429, 'Reference service busy', headers={'Retry-After':'10'})
            future = _pending[path] = Future()
    if not leader:
        try:
            return future.result(timeout=24)
        except FutureTimeout:
            raise HTTPException(429, 'Reference service busy', headers={'Retry-After':'10'}) from None
    token = None
    try:
        token = gate.acquire()
        gate.wait_for_dispatch()
        url = 'https://pubchem.ncbi.nlm.nih.gov/rest/'+path
        req = urllib.request.Request(url, headers={'Accept':'application/json', 'User-Agent':'ArtinLab/1.0 (chemical reference)'})
        try:
            with urllib.request.build_opener(SameHostRedirect()).open(req, timeout=15) as response:
                payload = response.read(10_000_001)
                if len(payload)>10_000_000:
                    raise ValueError('Response too large')
                value = json.loads(payload)
                if not isinstance(value, dict):
                    raise ValueError('Invalid response shape')
        except urllib.error.HTTPError as error:
            if error.code in (429,503):
                delay = retry_delay(error.headers)
                gate.block(delay)
                raise HTTPException(429, 'Reference service busy',headers={'Retry-After':str(math.ceil(delay))}) from None
            raise HTTPException(404 if error.code==404 else 502, 'PubChem response unavailable') from None
        except (urllib.error.URLError,TimeoutError,OSError,ValueError):
            raise HTTPException(502, 'PubChem connection unavailable') from None
        record = PubChemRecord(value, datetime.now(timezone.utc).isoformat().replace('+00:00','Z'), url)
        with _lock:
            if len(_cache)>=128:
                _cache.popitem(last=False)
            _cache[path]=(time.monotonic(),record)
        future.set_result(record)
        return record
    except (ReferenceBusy, sqlite3.Error) as error:
        response = HTTPException(429 if isinstance(error,ReferenceBusy) else 503, 'Reference service busy', headers={'Retry-After':str(error.retry_after if isinstance(error,ReferenceBusy) else 10)})
        future.set_exception(response)
        raise response from None
    except Exception as error:
        future.set_exception(error)
        raise
    finally:
        if token is not None:
            try:
                gate.release(token)
            except sqlite3.Error:
                pass  # The bounded lease expires after a worker/storage failure.
        with _lock:
            _pending.pop(path,None)
        _slots.release()


def fetch_pubchem(path):
    return fetch_pubchem_record(path).value


@router.get('/pubchem')
@limiter.limit('60/minute')
def pubchem_transport(request: Request, path: str = Query(max_length=2000)):
    record = fetch_pubchem_record(path)
    return JSONResponse(record.value, headers={'X-Artin-Fetched-At':record.fetched_at, 'Cache-Control':'no-store'})


@router.get('/structure')
@limiter.limit('20/minute')
def chemical_structure(request: Request, cid: int = Query(ge=1,le=9999999999)):
    from chemical_structure import analyze_smiles, InvalidStructure, StructureUnavailable
    path=f'pug/compound/cid/{cid}/property/SMILES/JSON'
    fetched=fetch_pubchem_record(path)
    source=fetched.value
    properties=source.get('PropertyTable',{}).get('Properties',[])
    record=next((r for r in properties if r.get('CID')==cid),None)
    if not record:
        raise HTTPException(404,'Compound identity unavailable')
    smiles=record.get('SMILES') or record.get('IsomericSMILES')
    if not smiles:
        raise HTTPException(422,'Source SMILES unavailable')
    try:
        result=analyze_smiles(smiles)
    except StructureUnavailable:
        raise HTTPException(503,'Structure engine unavailable or busy') from None
    except InvalidStructure:
        raise HTTPException(422,'Structure is invalid or unsupported by this engine') from None
    return {**result,'cid':cid,'source':'PubChem PUG-REST',
            'sourceUrl':f'https://pubchem.ncbi.nlm.nih.gov/compound/{cid}',
            'retrievedOn':fetched.fetched_at[:10], 'fetchedAt':fetched.fetched_at, 'sourceUpdatedAt':None}


@router.get('/catalog')
@limiter.limit('60/minute')
def chemical_catalog(request: Request, q: str = Query(default='',max_length=120), offset: int = Query(default=0,ge=0,le=1000000), limit: int = Query(default=20,ge=1,le=40), letter: str = Query(default='',pattern='^[a-z]?$')):
    from chemical_catalog import browse_catalog
    try:
        return browse_catalog(q,offset,limit,letter)
    except FileNotFoundError:
        raise HTTPException(503,'Chemical identity index is not installed') from None


@router.get('/resolve-name')
@limiter.limit('10/minute')
def resolve_chemical_name(request: Request, q: str = Query(min_length=2, max_length=120)):
    from chemical_language import resolve_name
    try:
        return resolve_name(q)
    except Exception:
        raise HTTPException(503, 'Chemical language service unavailable') from None


class TranslationRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=4)


@router.get('/chebi')
@limiter.limit('30/minute')
def chebi_reference(request: Request, q: str = Query(default='', max_length=200), chebi_id: str = Query(default='', max_length=20), expected_key: str = Query(default='', max_length=27), page: int = Query(default=1,ge=1,le=99)):
    from chebi_service import search_chebi, compound_chebi
    if bool(q)==bool(chebi_id):
        raise HTTPException(400,'Use one ChEBI query or identifier')
    return compound_chebi(chebi_id,expected_key or None) if chebi_id else search_chebi(q,page)


@router.get('/occupational')
@limiter.limit('60/minute')
def occupational_reference(request: Request, q: str = Query(default='', max_length=120), record_id: str = Query(default='', max_length=4)):
    from occupational_reference import reference
    return reference(q,record_id)


@router.post('/translate')
@limiter.limit('10/minute')
def translate_chemical_rows(request: Request, body: TranslationRequest):
    if any(not text.strip() or len(text)>1000 for text in body.texts):
        raise HTTPException(400, 'Invalid reference excerpts')
    from chemical_language import translate_rows
    try:
        return translate_rows(tuple(body.texts))
    except Exception:
        raise HTTPException(503, 'Chemical translation unavailable') from None


@router.get('/comptox')
@limiter.limit('20/minute')
def comptox_reference(request: Request, dtxsid: str = Query(default='', max_length=16)):
    from comptox_service import status, compound
    return compound(dtxsid) if dtxsid else status()
