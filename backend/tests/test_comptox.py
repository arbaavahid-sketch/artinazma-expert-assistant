"""Synthetic transport contracts; these are not captured live EPA records."""
import io
import json
import urllib.error
from email.message import Message
from unittest.mock import Mock
import pytest
from fastapi import HTTPException
import comptox_service as service

IDENTITY='DTXSID7020182'
RAW=[{'dtxsid':IDENTITY,'preferredName':'Synthetic contract example','casrn':None,'dtxcid':None,'smiles':None}]


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    monkeypatch.delenv('COMPTOX_API_KEY',raising=False)
    service._cache.clear()
    monkeypatch.setattr(service,'gate',Mock())


def transport(monkeypatch,raw=RAW):
    response=Mock();response.__enter__=Mock(return_value=response);response.__exit__=Mock(return_value=False)
    response.read.return_value=json.dumps(raw).encode()
    opener=Mock();opener.open.return_value=response
    monkeypatch.setattr(service.urllib.request,'build_opener',Mock(return_value=opener))
    monkeypatch.setenv('COMPTOX_API_KEY','synthetic-test-secret')
    return opener,response


def test_missing_key_is_explicit_and_never_requests_or_creates_reference(monkeypatch):
    network=Mock();monkeypatch.setattr(service.urllib.request,'build_opener',network)
    assert service.status()['configured'] is False
    with pytest.raises(HTTPException) as e:service.compound(IDENTITY)
    assert e.value.status_code==503
    network.assert_not_called();service.gate.acquire.assert_not_called()


@pytest.mark.parametrize('value',['https://evil.example','../DTXSID7020182','DTXSID7020182?x=1','DTXCID7020182','DTXSID１２３４５６７'])
def test_untrusted_path_is_rejected(value):
    with pytest.raises(HTTPException) as e:service.compound(value)
    assert e.value.status_code==400


def test_server_only_header_fixed_host_cache_preserves_original_provenance(monkeypatch):
    opener,response=transport(monkeypatch)
    first=service.compound(IDENTITY)
    request=opener.open.call_args.args[0]
    assert request.full_url==service.BASE+IDENTITY
    assert request.get_header('X-api-key')=='synthetic-test-secret'
    assert 'synthetic-test-secret' not in json.dumps(first)
    assert first['sourceUpdatedAt'] is None and first['sourceVersion'] is None
    assert first['structuralMatch']=='unverified' and first['cas'] is None
    first['name']='mutated caller'
    second=service.compound(IDENTITY)
    assert second['name']=='Synthetic contract example' and second['fetchedAt']==first['fetchedAt']
    assert opener.open.call_count==1 and response.read.call_args.args==(2_000_001,)
    monkeypatch.setenv('COMPTOX_API_KEY','rotated-test-secret');service.compound(IDENTITY)
    assert opener.open.call_count==2
    monkeypatch.delenv('COMPTOX_API_KEY')
    with pytest.raises(HTTPException):service.compound(IDENTITY)


@pytest.mark.parametrize('raw',[{},[{'dtxsid':'DTXSID0000000'}],RAW+RAW,[dict(RAW[0],preferredName=None)],[dict(RAW[0],smiles='x'*2001)]])
def test_mismatched_or_malformed_success_never_becomes_an_identity(monkeypatch,raw):
    transport(monkeypatch,raw)
    with pytest.raises(HTTPException) as e:service.compound(IDENTITY)
    assert e.value.status_code==502 and not service._cache
    service.gate.release.assert_called_once()


@pytest.mark.parametrize('code,expected',[(401,503),(403,503),(404,404),(500,502),(429,429),(503,429)])
def test_remote_errors_are_sanitized_and_rate_backoff_is_shared(monkeypatch,code,expected):
    opener,_=transport(monkeypatch);headers=Message();headers['Retry-After']='60'
    opener.open.side_effect=urllib.error.HTTPError(service.BASE+IDENTITY,code,'synthetic-test-secret',headers,io.BytesIO())
    with pytest.raises(HTTPException) as e:service.compound(IDENTITY)
    assert e.value.status_code==expected and 'synthetic-test-secret' not in e.value.detail
    if code in (429,503):service.gate.block.assert_called_once_with(60)
    service.gate.release.assert_called_once()


def test_redirect_never_receives_credential():
    for url in ['https://evil.example/','https://comptox.epa.gov/elsewhere','http://comptox.epa.gov/ctx-api/']:
        with pytest.raises(urllib.error.URLError):service.NoRedirect().redirect_request(None,None,302,'',{},url)


def test_empty_and_oversize_responses_are_not_fabricated_records(monkeypatch):
    _,response=transport(monkeypatch,[])
    with pytest.raises(HTTPException) as e:service.compound(IDENTITY)
    assert e.value.status_code==404
    response.read.return_value=b'x'*2_000_001
    with pytest.raises(HTTPException) as e:service.compound(IDENTITY)
    assert e.value.status_code==502


def test_invalid_header_is_not_configured(monkeypatch):
    monkeypatch.setenv('COMPTOX_API_KEY','x\nInjected: header')
    assert not service.status()['configured']


def test_public_status_route_never_returns_a_credential(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from routes.chemicals import router
    monkeypatch.setenv('COMPTOX_API_KEY','synthetic-test-secret')
    app=FastAPI();app.include_router(router)
    with TestClient(app) as client:
        response=client.get('/chemicals/comptox')
    assert response.status_code==200 and response.json()['configured']
    assert 'synthetic-test-secret' not in response.text
