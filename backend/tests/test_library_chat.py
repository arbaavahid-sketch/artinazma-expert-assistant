import json
from types import SimpleNamespace
import pytest
from chemical_chat import explicit_query, chemical_chat_context
from library_chat import library_chat_context


def fetched(value):
    return SimpleNamespace(value=value, fetched_at='2026-11-09T00:00:00Z')


def fake_reference(path):
    if '/fastformula/' in path:
        return fetched({'IdentifierList': {'CID': [198139, 123456]}})
    if '/property/' in path:
        ids = path.split('/cid/')[1].split('/')[0].split(',')
        return fetched({'PropertyTable': {'Properties': [{'CID': int(cid), 'Title': 'Synthetic reference '+cid, 'MolecularFormula': 'C12H14ClN3O', 'MolecularWeight': '251.71', 'IUPACName': 'Synthetic IUPAC'} for cid in ids]}})
    raise RuntimeError('Reference section unavailable')


@pytest.mark.parametrize('text,expected', [('درباره C12H14ClN3O توضیح بده', ('formula','C12H14ClN3O')), ('C₁₂H₁₄ClN₃O',('formula','C12H14ClN3O')), ('CID 198139',('cid','198139')), ('متانول چیست؟',('cid','887')), ('ASTM D524',None), ('ISO15597',None), ('Summarize this answer',None)])
def test_explicit_queries_do_not_confuse_standards_with_formulas(text, expected):
    assert explicit_query(text) == expected


def test_formula_results_remain_candidates_not_a_selected_identity():
    context, result = chemical_chat_context('C12H14ClN3O', fetch=fake_reference)
    assert result['status']=='candidates' and len(result['records'])==2
    assert result['properties']==[]
    assert 'Never infer physical state, solubility' in context and 'do not choose the first' in context
    assert result['records'][0]['sourceUrl'].endswith('/198139')


def test_selected_card_resolves_its_cid_and_keeps_missing_properties_unknown():
    context, result = chemical_chat_context('Explain this material', 198139, fake_reference)
    assert result['status']=='exact' and [r['cid'] for r in result['records']]==[198139]
    assert result['properties']==[] and 'Missing data remain unknown' in context


def test_reference_identity_mismatch_never_becomes_verified(monkeypatch):
    monkeypatch.setattr('chemical_catalog.lookup_identity',lambda *a:{'records':[],'total':0,'metadata':{}})
    context, result = chemical_chat_context('CID 198139', fetch=lambda _:fetched({'PropertyTable':{'Properties':[{'CID':887}]}}))
    assert result['status']=='unavailable' and not result['records']


def test_offline_directory_preserves_exact_cid_and_labels_snapshot():
    def unavailable(_): raise RuntimeError('offline')
    _, result = chemical_chat_context('CID 198139', fetch=unavailable)
    assert result['status']=='catalogue-identity'
    assert [r['cid'] for r in result['records']]==[198139]
    assert result['records'][0]['formula']=='C12H14ClN3O'
    assert not result['properties'] and not result['records'][0]['computedMolarMass']


def test_elements_and_isotopes_use_same_versioned_snapshot():
    context, result = library_chat_context('Tell me about the isotope Carbon-14')
    assert result['links'][0]['kind']=='elements' and 'element=6' in result['links'][0]['href']
    assert 'mendeleev-1.3.0-v1' in context and '"mass_number": 14' in context
    assert '"mass_number": 12' not in context
    assert 'half_life_unit' in context and 'not current CIAAW verification' in context


def test_occupational_question_uses_snapshot_without_needing_niosh_keyword():
    context, result = library_chat_context('حد مجاز مواجهه شغلی بنزن چقدر است؟', chemical_fetch=lambda _: (_ for _ in ()).throw(RuntimeError('offline')))
    assert result['occupational']['record']['id']=='0049'
    assert 'United States reference only' in context
    assert result['links'][-1]['kind']=='occupational'


def test_comptox_missing_key_and_private_certificates_are_not_fabricated(monkeypatch):
    monkeypatch.delenv('COMPTOX_API_KEY',raising=False)
    context, result = library_chat_context('DTXSID7020182')
    assert '"configured": false' in context and result['links'][0]['kind']=='comptox'
    context, result = library_chat_context('گواهی خلوص بطری من را بررسی کن')
    assert 'private user project data' in context and 'reagents' in result['links'][0]['href']


def test_ordinary_chat_receives_the_same_material_cards(monkeypatch):
    import routes.chat as chat
    from schemas.models import ChatRequest
    monkeypatch.setattr('routes.chemicals.fetch_pubchem_record',fake_reference)
    monkeypatch.setattr(chat,'detect_user_language',lambda *a:'en')
    monkeypatch.setattr(chat,'detect_question_intent',lambda **k:{'intent':'technical_general','label':'Technical'})
    monkeypatch.setattr(chat,'local_search_knowledge_base',lambda *a,**k:[])
    monkeypatch.setattr(chat,'search_knowledge_base',lambda *a,**k:[])
    monkeypatch.setattr(chat,'find_artinazma_resources',lambda *a,**k:[])
    monkeypatch.setattr(chat,'is_web_search_configured',lambda:False)
    monkeypatch.setattr(chat,'ENABLE_DEEP_RESEARCH',False)
    pipeline=chat._build_chat_pipeline(ChatRequest(message='C12H14ClN3O'))
    assert pipeline['library_resources']['chemical']['status']=='candidates'
    assert 'CHEMICAL REFERENCE DATA' in pipeline['context']
    assert chat._build_chat_metadata(pipeline)['library_resources']['chemical']['records'][0]['cid']==198139


def test_laboratory_conversation_returns_reference_cards_and_retrieved_context():
    from laboratory_chat import ask_laboratory
    from unittest.mock import patch
    def transport(payload):
        assert any('CHEMICAL REFERENCE DATA' in item.get('content','') for item in payload['input'])
        return {'output':[{'type':'message','content':[{'type':'output_text','text':'Choose the intended compound card.'}]}]}
    with patch('routes.chemicals.fetch_pubchem_record',fake_reference):
        reply=ask_laboratory('C12H14ClN3O',[],transport=transport)
    assert reply['library_resources']['chemical']['status']=='candidates'
