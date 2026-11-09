import copy
import json
import urllib.error
from pathlib import Path
from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException
import chebi_service as service
from pubchem_gate import PubChemGate

FIXTURES=Path(__file__).parent/'fixtures'
def fixture(name):return json.loads((FIXTURES/f'chebi-{name}.json').read_text(encoding='utf-8'))
STAMP='2026-11-07T10:00:00Z'
KEY='OKKJLVBELUTLKV-UHFFFAOYSA-N'

@pytest.fixture(autouse=True)
def isolated(tmp_path,monkeypatch):
    monkeypatch.setattr(service,'gate',PubChemGate(tmp_path/'gate.sqlite3'))
    service._cache.clear()
    yield
    service._cache.clear()

def mock_data(monkeypatch,name='methanol'):
    data=fixture(name)
    monkeypatch.setattr(service,'_fetch',lambda path:(copy.deepcopy(data),STAMP))
    return data

def test_real_record_normalization_keeps_provenance_and_relation_direction(monkeypatch):
    mock_data(monkeypatch)
    r=service.compound_chebi('17790',KEY)
    assert r['id']=='CHEBI:17790' and r['charge']==0 and r['formula']=='CH4O'
    assert r['match']=='exact' and r['sourceUpdatedAt']=='2018-07-19T14:41:20Z'
    assert r['fetchedAt']==STAMP and r['sourceVersion'] is None and r['license']=='CC BY 4.0'
    assert any(x['relation']=='is a' and x['toName']=='primary alcohol' and x['direction']=='outgoing' for x in r['relations'])
    assert any(x['fromName']=='methoxide' and x['toId']==r['id'] and x['direction']=='incoming' for x in r['relations'])
    assert all('<' not in x['name'] for x in r['synonyms'])

def test_full_structure_key_distinguishes_salt_hydrate_stereo_and_unverified(monkeypatch):
    mock_data(monkeypatch)
    for key in ['AAAAAAAAAAAAAA-UHFFFAOYSA-N','OKKJLVBELUTLKV-AAAAAAAAAA-N','OKKJLVBELUTLKV-UHFFFAOYSA-M']:
        assert service.compound_chebi('17790',key)['match']=='different'
    assert service.compound_chebi('17790')['match']=='unverified'
    with pytest.raises(HTTPException):service.compound_chebi('17790',KEY[:14])

def test_classes_with_no_structure_and_zero_charge_are_not_invented(monkeypatch):
    d=mock_data(monkeypatch);d['default_structure']=None;d['chemical_data']={}
    r=service.compound_chebi('17790',KEY)
    assert r['inchiKey'] is None and r['charge'] is None and r['match']=='unverified'

def test_secondary_identifier_redirect_is_explicit_and_other_identity_rejected(monkeypatch):
    mock_data(monkeypatch)
    assert service.compound_chebi('CHEBI:6816')['requestedId']=='CHEBI:6816'
    with pytest.raises(HTTPException) as e:service.compound_chebi('CHEBI:999')
    assert e.value.status_code==502

def test_name_search_retains_all_candidates_and_index_without_auto_selection(monkeypatch):
    mock_data(monkeypatch,'search')
    r=service.search_chebi('methanol')
    assert len(r['records'])==5 and r['selectionRequired'] and r['total']==1000
    assert r['records'][0]['searchIndex']=='chebi-prod-compounds-07112026'
    assert r['sourceVersion'] is None
    assert r['records'][1]['inchiKey']!=r['records'][0]['inchiKey']

@pytest.mark.parametrize('value',['../x','https://evil.example','CHEBI:1/','CHEBI:0','CHEBI:0001','CHEBI:1234567890123'])
def test_invalid_ids_do_not_reach_network(value,monkeypatch):
    mock=MagicMock();monkeypatch.setattr(service,'_fetch',mock)
    with pytest.raises(HTTPException):service.compound_chebi(value)
    mock.assert_not_called()

def test_request_encoding_prevents_query_injection(monkeypatch):
    data=fixture('search');seen=[]
    def fetch(path):seen.append(path);return data,STAMP
    monkeypatch.setattr(service,'_fetch',fetch)
    service.search_chebi('methanol&size=999')
    assert seen==['es_search/?term=methanol%26size%3D999&size=10&page=1']

def test_transport_keeps_original_timestamp_and_bounds_response(monkeypatch):
    opener=MagicMock();opener.open.return_value.__enter__.return_value.read.return_value=b'{"results":[],"total":0}'
    monkeypatch.setattr(service.urllib.request,'build_opener',lambda *a:opener)
    first=service._fetch('es_search/?term=methanol&size=10&page=1')
    assert service._fetch('es_search/?term=methanol&size=10&page=1') is first
    assert opener.open.call_count==1
    opener.open.return_value.__enter__.return_value.read.return_value=b'x'*2_000_001
    with pytest.raises(HTTPException) as e:service._fetch('compound/CHEBI:17790/')
    assert e.value.status_code==502 and not service._pending

def test_redirect_stays_within_https_public_api():
    for url in ['https://evil.example/','http://www.ebi.ac.uk/chebi/backend/api/public/x','https://www.ebi.ac.uk/private/']:
        with pytest.raises(urllib.error.URLError):service.SafeRedirect().redirect_request(None,None,302,'',{},url)

def test_chat_retrieves_only_single_explicit_id_and_does_not_choose_by_name(monkeypatch):
    mock_data(monkeypatch)
    assert service.chebi_chat_context('explain methanol')==('',None)
    assert service.chebi_chat_context('CHEBI:17790 vs CHEBI:6816')==('',None)
    context,r=service.chebi_chat_context('درباره CHEBI:17790 توضیح بده')
    assert r['id']=='CHEBI:17790' and 'CC BY 4.0' in context and 'not instructions' in context
    monkeypatch.setattr(service,'compound_chebi',MagicMock(side_effect=HTTPException(503,'busy')))
    assert service.chebi_chat_context('CHEBI:17790')==('',None)


def test_shared_chat_pipeline_includes_reference_and_skips_transform(monkeypatch):
    import routes.chat as chat
    from schemas.models import ChatRequest
    mock_data(monkeypatch)
    monkeypatch.setattr(chat,'detect_user_language',lambda *a:'en')
    monkeypatch.setattr(chat,'detect_question_intent',lambda **k:{'intent':'technical_general','label':'Technical'})
    monkeypatch.setattr(chat,'local_search_knowledge_base',lambda *a,**k:[])
    monkeypatch.setattr(chat,'search_knowledge_base',lambda *a,**k:[])
    monkeypatch.setattr(chat,'find_artinazma_resources',lambda *a,**k:[])
    monkeypatch.setattr(chat,'is_web_search_configured',lambda:False)
    monkeypatch.setattr(chat,'ENABLE_DEEP_RESEARCH',False)
    p=chat._build_chat_pipeline(ChatRequest(message='Explain CHEBI:17790'))
    assert 'ChEBI reference data' in p['context'] and '+chebi' in p['search_mode']
    assert any(s.get('url')=='https://www.ebi.ac.uk/chebi/CHEBI:17790' for s in p['sources'])
    monkeypatch.setattr(chat,'is_followup_transform_request',lambda *a:True)
    p=chat._build_chat_pipeline(ChatRequest(message='Summarize CHEBI:17790'))
    assert 'ChEBI reference data' not in p['context']
    assert not any(s.get('category')=='chemical_reference' for s in p['sources'])
