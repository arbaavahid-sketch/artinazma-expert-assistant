import json
import subprocess
import sys
import threading
import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException, Request
from pubchem_gate import PubChemGate, ReferenceBusy
from routes import chemicals

PATH = 'pug/compound/name/aspirin/cids/JSON'


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(chemicals, 'gate', PubChemGate(tmp_path/'gate.sqlite3'))
    with chemicals._lock:
        chemicals._cache.clear()
        assert not chemicals._pending
    yield
    chemicals._cache.clear()


def opener(monkeypatch, payload=None):
    mock = MagicMock()
    mock.open.return_value.__enter__.return_value.read.return_value = payload or b'{"IdentifierList":{"CID":[2244]}}'
    monkeypatch.setattr(chemicals.urllib.request, 'build_opener', lambda *args: mock)
    return mock


def test_original_timestamp_survives_cache_and_route_header(monkeypatch):
    mock = opener(monkeypatch)
    first = chemicals.fetch_pubchem_record(PATH)
    assert first.fetched_at.endswith('Z')
    assert chemicals.fetch_pubchem_record(PATH) is first
    request = Request({'type':'http','method':'GET','path':'/chemicals/pubchem','headers':[],'client':('127.0.0.1',1)})
    response = chemicals.pubchem_transport.__wrapped__(request, PATH)
    assert response.headers['X-Artin-Fetched-At'] == first.fetched_at
    assert json.loads(response.body) == first.value
    assert mock.open.call_count == 1
    # Force expiration of just this cache entry, not the source timestamp.
    chemicals._cache[PATH] = (time.monotonic()-3601, first)
    second = chemicals.fetch_pubchem_record(PATH)
    assert second is not first
    assert second.fetched_at > first.fetched_at


def test_slow_network_does_not_hold_state_lock_and_same_path_is_coalesced(monkeypatch):
    mock = opener(monkeypatch)
    entered, finish = threading.Event(), threading.Event()
    def read(*args):
        entered.set()
        assert finish.wait(3)
        return b'{"IdentifierList":{"CID":[2244]}}'
    mock.open.return_value.__enter__.return_value.read.side_effect = read
    with ThreadPoolExecutor(3) as pool:
        first = pool.submit(chemicals.fetch_pubchem_record, PATH)
        assert entered.wait(2)
        second = pool.submit(chemicals.fetch_pubchem_record, PATH)
        assert chemicals._lock.acquire(timeout=.1)
        chemicals._lock.release()
        finish.set()
        assert first.result() is second.result()
    assert mock.open.call_count == 1


@pytest.mark.parametrize('payload',[b'[]',b'invalid',b'x'*10_000_001],ids=['array','invalid-json','over-size'])
def test_invalid_and_oversized_payloads_are_not_cached_and_release_admission(monkeypatch,payload):
    opener(monkeypatch,payload)
    with pytest.raises(HTTPException) as error:
        chemicals.fetch_pubchem_record(PATH)
    assert error.value.status_code == 502
    assert not chemicals._cache and not chemicals._pending
    with chemicals.gate.transaction() as db:
        assert db.execute('SELECT count(*) FROM leases').fetchone()[0] == 0


def test_throttle_is_shared_and_a_cache_hit_remains_available(monkeypatch):
    mock = opener(monkeypatch)
    record = chemicals.fetch_pubchem_record(PATH)
    mock.open.side_effect = urllib.error.HTTPError('https://pubchem.ncbi.nlm.nih.gov',503,'busy',{'Retry-After':'120'},None)
    with pytest.raises(HTTPException) as error:
        chemicals.fetch_pubchem_record(PATH.replace('aspirin','ethanol'))
    assert error.value.status_code == 429 and error.value.headers['Retry-After'] == '120'
    with pytest.raises(ReferenceBusy) as busy:
        PubChemGate(chemicals.gate.path).acquire()
    assert 118 <= busy.value.retry_after <= 120
    assert chemicals.fetch_pubchem_record(PATH) is record
    assert mock.open.call_count == 2


def test_retry_after_dates_and_malformed_values(monkeypatch):
    monkeypatch.setattr(chemicals.time,'time',lambda:0)
    assert chemicals.retry_delay({'Retry-After':'Thu, 01 Jan 1970 00:02:00 GMT'}) == 120
    for value in ['nan','inf','bad','-1']:
        assert chemicals.retry_delay({'Retry-After':value}) == 10


def test_gate_bounds_shared_admission_and_recovers_expired_leases(tmp_path):
    now=[100.]
    a=PubChemGate(tmp_path/'shared.sqlite3',clock=lambda:now[0])
    b=PubChemGate(a.path,clock=lambda:now[0])
    leases=[a.acquire() for _ in range(24)]
    with pytest.raises(ReferenceBusy):
        b.acquire()
    b.release(leases[0])
    b.acquire()
    now[0]+=46
    assert b.acquire()
    with b.transaction() as db:
        assert db.execute('SELECT count(*) FROM leases').fetchone()[0] == 1


def test_dispatch_releases_database_before_sleep_and_rechecks_backoff(tmp_path):
    now=[100.]
    b=PubChemGate(tmp_path/'pacing.sqlite3',clock=lambda:now[0])
    def sleep(delay):
        # A different coordinator can write while this one waits.
        PubChemGate(b.path,clock=lambda:now[0]).block(30)
        now[0]+=delay
    b.sleep=sleep
    b.wait_for_dispatch()
    with pytest.raises(ReferenceBusy):
        b.wait_for_dispatch()


def test_independent_worker_processes_share_dispatch_rate(tmp_path):
    path=str(tmp_path/'workers.sqlite3')
    script="from pubchem_gate import PubChemGate; import sys,time; g=PubChemGate(sys.argv[1]); t=g.acquire(); g.wait_for_dispatch(); print(time.time(),flush=True); g.release(t)"
    workers=[subprocess.Popen([sys.executable,'-c',script,path],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True) for _ in range(3)]
    results=[p.communicate(timeout=10) for p in workers]
    assert all(p.returncode==0 for p in workers),results
    starts=sorted(float(out.strip()) for out,_ in results)
    assert min(b-a for a,b in zip(starts,starts[1:])) >= .32


def test_redirect_cannot_leave_https_pubchem():
    handler=chemicals.SameHostRedirect()
    for url in ['http://pubchem.ncbi.nlm.nih.gov/rest/x','https://evil.example/','https://pubchem.ncbi.nlm.nih.gov@evil.example/']:
        with pytest.raises(urllib.error.URLError):
            handler.redirect_request(None,None,302,'',{},url)
