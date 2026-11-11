import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import Mock


@pytest.fixture
def client(tmp_path,monkeypatch):
    import repositories.base as base
    from routes import uncertainty,laboratory_chat,calculation_activity,customers
    from utils.deps import limiter
    monkeypatch.setattr(base,'DB_PATH',tmp_path/'access.db')
    monkeypatch.setattr(limiter,'enabled',False)
    app=FastAPI()
    for router in (uncertainty.router,laboratory_chat.router,calculation_activity.router,customers.router):
        app.include_router(router)
    with TestClient(app) as instance:
        yield instance


@pytest.mark.parametrize('kind',['anonymous','pending','blocked','invalid'])
def test_every_calculation_entry_rejects_unapproved_access_before_execution(client,monkeypatch,kind):
    import db_service
    import routes.uncertainty as numerical
    import routes.laboratory_chat as chat
    from auth_service import create_access_token
    row={'id':7,'full_name':'Synthetic','email':'qa@example.invalid','approval_status':'pending' if kind=='pending' else 'approved','is_blocked':kind=='blocked'}
    monkeypatch.setattr(db_service,'get_customer_by_id',lambda _:row)
    if kind!='anonymous':
        client.headers['Authorization']='Bearer '+('invalid' if kind=='invalid' else create_access_token(7,'qa@example.invalid'))
    calculate=Mock(side_effect=AssertionError('Numerical engine must not run'))
    monkeypatch.setattr(numerical,'calculate_budget',calculate)
    monkeypatch.setattr(chat,'ask_laboratory',calculate)
    for path,payload in [('/uncertainty/budget',{'measured':1,'coverage':2,'components':[{'name':'x','value':.1}]}),('/uncertainty/mc-study',{}),('/uncertainty/physical-report.pdf',{}),('/chat/laboratory',{'message':'calculate','customer_id':7}),('/calculation-activity',{'event_id':'a'*32,'tool':'quick-0','status':'success'})]:
        result=client.post(path,json=payload)
        assert result.status_code in (401,403),(kind,path,result.text)
    assert client.get('/customers/access').status_code in (401,403)
    assert client.get('/calculation-activity/access').status_code in (401,403)
    calculate.assert_not_called()


def test_approved_account_uses_engine_and_receives_identity_from_token(client,monkeypatch):
    import db_service
    from auth_service import create_access_token
    monkeypatch.setattr(db_service,'get_customer_by_id',lambda _: {'id':7,'full_name':'Synthetic','email':'qa@example.invalid','approval_status':'approved'})
    client.headers['Authorization']='Bearer '+create_access_token(7,'qa@example.invalid')
    assert client.get('/customers/access').json()=={'approved':True,'customer_id':7}
    assert client.get('/calculation-activity/access').status_code==200
    response=client.post('/uncertainty/budget',json={'measured':10,'coverage':2,'components':[{'name':'Synthetic','value':.1,'sensitivity':1}]})
    assert response.status_code==200 and response.json()['expanded_uncertainty']==pytest.approx(.2)
