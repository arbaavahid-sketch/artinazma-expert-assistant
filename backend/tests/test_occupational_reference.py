import pytest
from fastapi import HTTPException
import occupational_reference as service


def test_reviewed_snapshot_has_real_identity_dates_and_separate_authorities():
    result=service.reference()
    assert result['delivery']=='reviewed_snapshot' and result['coverageCount']==12
    assert result['checkedOn']=='2026-11-07' and result['fetchedAt'] is None
    assert result['sourceVersion'] is None and result['selectionRequired']
    for candidate in result['records']:
        r=service.reference(identity=candidate['id'])['record']
        assert service.valid_cas(r['cas'])
        assert [(x['agency'],x['kind'],x['status']) for x in r['limits']]==[('NIOSH','REL','recommendation'),('OSHA','PEL','reported_by_NPG'),('NIOSH','IDLH','acute_reference')]
        assert r['fetchedAt'] is None and all(x['sourceUrl']==r['sourceUrl'] for x in r['limits'])


def test_methanol_preserves_distinct_short_term_skin_and_acute_values():
    r=service.reference(identity='0397')['record']
    rel,pel,idlh=r['limits']
    assert rel['raw']=='TWA 200 ppm (260 mg/m³); ST 250 ppm (325 mg/m³) [skin]'
    assert pel['raw']=='TWA 200 ppm (260 mg/m³)' and '250' not in pel['raw']
    assert idlh['raw']=='6000 ppm'
    assert r['sourceReviewedOn']=='2019-10-30' and r['checkedOn']!=r['sourceReviewedOn']


def test_special_cases_keep_ceiling_peak_carcinogen_and_unit_conditions():
    h2s=service.reference(identity='0337')['record']
    assert h2s['limits'][0]['raw']=='C 10 ppm (15 mg/m³) [10-minute]'
    assert '50 ppm [10-minute maximum peak]' in h2s['limits'][1]['raw']
    benzene=service.reference(identity='0049')['record']
    assert benzene['limits'][0]['raw'].startswith('Ca; TWA 0.1')
    assert '[1910.1028]' in benzene['limits'][1]['raw'] and benzene['notes']
    acid=service.reference(identity='0577')['record']
    assert all('ppm' not in x['raw'] and 'mg/m³' in x['raw'] for x in acid['limits'])
    hexane=service.reference(identity='0322')['record']
    assert '10%LEL' in hexane['limits'][2]['raw'] and hexane['notes']


def test_search_requires_selection_and_never_fills_uncovered_or_wrong_cas_with_zero():
    assert service.reference(query='methyl')['total']>1
    assert service.reference(query='methyl')['selectionRequired']
    assert service.reference(query='67-56-1')['records'][0]['id']=='0397'
    assert service.reference(query='۶۷-۵۶-۱')['records'][0]['id']=='0397'
    assert service.reference(query='٦٧-٥٦-١')['records'][0]['id']=='0397'
    assert service.reference(query='متانول')['records'][0]['id']=='0397'
    assert service.reference(query='ماده ناشناخته')['records']==[]
    assert service.reference(query='67-56-2')['records']==[]
    assert service.reference(query='1336-21-6')['records']==[]  # Not silently mapped to ammonia.


@pytest.mark.parametrize('value',['../x','https://evil.example','0397/','397','00000'])
def test_identifier_is_bounded_and_not_a_path(value):
    with pytest.raises(HTTPException) as e:
        service.reference(identity=value)
    assert e.value.status_code==400


def test_unknown_record_and_invalid_request_are_controlled():
    with pytest.raises(HTTPException) as e:
        service.reference(identity='9999')
    assert e.value.status_code==404
    for kwargs in [dict(query='x'*121),dict(query='x\n'),dict(query='methanol',identity='0397')]:
        with pytest.raises(HTTPException):
            service.reference(**kwargs)


def test_returned_snapshot_cannot_mutate_the_shared_reference():
    r=service.reference(identity='0397')
    r['record']['limits'][0]['raw']='wrong'
    assert service.reference(identity='0397')['record']['limits'][0]['raw'].startswith('TWA 200')


def test_assistant_requires_explicit_source_and_identity():
    for message in ['Methanol limits','NIOSH methanol','NIOSH 67-56-1 71-43-2','CAS 67-56-1','NIOSH 1336-21-6']:
        assert service.occupational_chat_context(message)==('',None)
    text,r=service.occupational_chat_context('NIOSH CAS 67-56-1')
    assert r['record']['id']=='0397' and 'not a live' in text and 'not an Iranian' in text
    assert service.occupational_chat_context('NIOSH CAS ۶۷-۵۶-۱')[1]['record']['id']=='0397'
    assert service.occupational_chat_context('NIOSH NPG:0337')[1]['record']['id']=='0337'


def test_chat_pipeline_records_snapshot_source_and_skips_transforms(monkeypatch):
    import routes.chat as chat
    from schemas.models import ChatRequest
    monkeypatch.setattr(chat,'detect_user_language',lambda *a:'en')
    monkeypatch.setattr(chat,'detect_question_intent',lambda **k:{'intent':'technical_general','label':'Technical'})
    monkeypatch.setattr(chat,'local_search_knowledge_base',lambda *a,**k:[])
    monkeypatch.setattr(chat,'search_knowledge_base',lambda *a,**k:[])
    monkeypatch.setattr(chat,'find_artinazma_resources',lambda *a,**k:[])
    monkeypatch.setattr(chat,'is_web_search_configured',lambda:False)
    monkeypatch.setattr(chat,'ENABLE_DEEP_RESEARCH',False)
    p=chat._build_chat_pipeline(ChatRequest(message='Explain NIOSH CAS 67-56-1'))
    assert '+niosh_snapshot' in p['search_mode'] and 'External occupational reference data' in p['context']
    assert any(s.get('category')=='occupational_reference' and s['checkedOn']=='2026-11-07' for s in p['sources'])
    monkeypatch.setattr(chat,'is_followup_transform_request',lambda *a:True)
    p=chat._build_chat_pipeline(ChatRequest(message='Summarize NIOSH CAS 67-56-1'))
    assert 'External occupational reference data' not in p['context']
