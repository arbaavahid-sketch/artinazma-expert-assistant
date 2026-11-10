import json
import uuid
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
import calculation_activity as service


@pytest.fixture
def client(tmp_path, monkeypatch):
    import repositories.base as base
    import db_service
    from routes import calculation_activity, uncertainty, laboratory_chat, lab_imports
    from utils.deps import limiter
    monkeypatch.setattr(base,'DB_PATH',tmp_path/'activity.db')
    monkeypatch.setattr(limiter,'enabled',False)
    monkeypatch.setenv('COOKIE_SECURE','false')
    monkeypatch.setattr(db_service,'get_customer_by_id',lambda key:{'id':key,'full_name':'Synthetic customer','email':'qa@example.invalid','phone':'09120000000','approval_status':'approved'})
    app=FastAPI()
    for router in (calculation_activity.router,uncertainty.router,laboratory_chat.router,lab_imports.router):
        app.include_router(router)
    with TestClient(app) as instance:
        yield instance


def admin():
    import os
    return {'X-Admin-Key':os.environ['ADMIN_API_KEY']}


def customer(client, key=7):
    from auth_service import create_access_token
    client.headers['Authorization']='Bearer '+create_access_token(key,'qa@example.invalid')


def event(**changes):
    return {'event_id':uuid.uuid4().hex,'tool':'quick-0','title':'Synthetic dilution','status':'success',**changes}


def test_admin_only_and_empty_report(client):
    for path in ('/admin/calculation-activity','/admin/calculation-activity/stats'):
        assert client.get(path).status_code in (401,403)
    result=client.get('/admin/calculation-activity',headers=admin())
    assert result.status_code==200 and result.headers['cache-control']=='no-store'
    assert result.json()['items']==[] and result.json()['summary']['total']==0


def test_identity_is_server_owned_and_client_reports_are_not_verified(client):
    customer(client)
    assert client.post('/calculation-activity',json=event(customer_id=999,full_name='spoof',execution='server')).status_code==422
    payload=event()
    assert client.post('/calculation-activity',json=payload).status_code==200
    assert client.post('/calculation-activity',json=payload).status_code==200
    result=client.get('/admin/calculation-activity',headers=admin()).json()
    assert result['summary']['total']==1
    row=result['items'][0]
    assert row['customer_id']==7 and row['full_name']=='Synthetic customer'
    assert row['email']=='qa@example.invalid' and row['execution']=='client'
    assert row['summary']=={} and 'actor_key' not in row and 'dedupe_key' not in row
    customer(client,8)
    client.post('/calculation-activity',json=payload)
    assert client.get('/admin/calculation-activity/stats',headers=admin()).json()['customers']==2


def test_anonymous_usage_is_denied_and_not_archived(client):
    assert client.get('/calculation-activity/access').status_code==401
    assert client.post('/calculation-activity',json=event()).status_code==401
    assert client.get('/admin/calculation-activity',headers=admin()).json()['items']==[]


def test_real_budget_logs_once_and_validation_failure_is_not_success(client):
    customer(client)
    payload={'measured':10,'coverage':2,'components':[{'name':'Synthetic input','value':.1,'sensitivity':1}]}
    response=client.post('/uncertainty/budget',json=payload)
    assert response.status_code==200 and response.json()['expanded_uncertainty']==pytest.approx(.2)
    assert client.post('/uncertainty/budget',json={'components':[]}).status_code==422
    rows=client.get('/admin/calculation-activity',headers=admin()).json()
    assert rows['summary']['total']==2 and rows['summary']['success']==1 and rows['summary']['errors']==1
    successful=next(r for r in rows['items'] if r['status']=='success')
    assert successful['execution']=='server' and successful['tool']=='gum-budget'
    assert successful['summary']['measured']==10 and successful['customer_id']==7
    assert 'Synthetic input' not in json.dumps(successful)


def test_file_and_chat_calculations_are_recorded_without_counting_reference_chat(client, monkeypatch):
    customer(client)
    import routes.lab_imports as imports
    monkeypatch.setattr(imports.service,'confirm_import',lambda *a:{'id':'a'*32,'result':{'mean':10,'n':3},'unit':'g','selection':{'mode':'statistics'}})
    selection={'table_id':'x','rows':[1,2,3],'mode':'statistics','mappings':[{'input':0,'column':'c0','unit':'g'}],'unit':'g','review_confirmed':True,'review_note':'Synthetic reviewed source'}
    assert client.post('/laboratory/imports/'+'b'*32+'/confirm',json=selection).status_code==200
    import routes.laboratory_chat as chat
    monkeypatch.setattr(chat,'ask_laboratory',lambda *args:{'answer':'Synthetic','calculations':[{'kind':'dilution','result':{'aliquot_volume':25},'unit':'mL'}]})
    assert client.post('/chat/laboratory',json={'message':'Synthetic dilution'}).status_code==200
    monkeypatch.setattr(chat,'ask_laboratory',lambda *args:{'answer':'Reference only','calculations':[]})
    assert client.post('/chat/laboratory',json={'message':'Reference only'}).status_code==200
    rows=client.get('/admin/calculation-activity',headers=admin()).json()['items']
    assert len(rows)==2 and {r['source'] for r in rows}=={'file_import','laboratory_chat'}


def test_filters_pagination_and_summary_use_same_selection(client):
    customer(client)
    for _ in range(3):client.post('/calculation-activity',json=event())
    client.post('/calculation-activity',json=event(status='error',tool='precision'))
    result=client.get('/admin/calculation-activity?q=qa%40example.invalid&status=success&limit=2&offset=2',headers=admin()).json()
    assert len(result['items'])==1 and result['summary']['total']==3 and result['summary']['errors']==0
    assert client.get('/admin/calculation-activity?q=%25',headers=admin()).json()['items']==[]
    assert client.get('/admin/calculation-activity?since=2026-01-01T00:00:00',headers=admin()).status_code==422
    assert client.get('/admin/calculation-activity?since=2999-01-01T00:00:00Z',headers=admin()).json()['items']==[]


def test_tracking_failure_does_not_change_numerical_result(client,monkeypatch):
    customer(client)
    monkeypatch.setattr(service,'record',lambda *args,**kwargs:(_ for _ in ()).throw(RuntimeError('Synthetic storage failure')))
    response=client.post('/uncertainty/budget',json={'measured':10,'coverage':2,'components':[{'name':'Synthetic','value':.1,'sensitivity':1}]})
    assert response.status_code==200 and response.json()['measured']==10


def test_summary_is_allowlisted_and_does_not_include_private_values():
    assert service.safe_summary({'model':'density','certificate':'private','password':'secret','raw_file':'bytes','measured':float('nan')})=={'model':'density'}
