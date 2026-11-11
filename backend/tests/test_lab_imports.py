"""Reviewed source calculation tests: no external network or real customer files."""
import io
import json
import pytest
import pandas as pd
from PIL import Image
import lab_import_service as service
from laboratory_chat import LabTools, LaboratorySnapshot


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    import repositories.base as base
    monkeypatch.setattr(base, 'DB_PATH', tmp_path/'imports.db')
    monkeypatch.setattr(service, 'ROOT', tmp_path/'private')


def review(preview, **overrides):
    table = preview['tables'][0]
    return service.ReviewedImport.model_validate(dict(
        table_id=table['id'], rows=[r['row'] for r in table['rows']], mode='statistics',
        mappings=[{'input': 0, 'column': 'c0', 'unit': 'mg'}], unit='g',
        review_confirmed=True, review_note='Compared every selected cell against source', **overrides))


def test_owned_immutable_source_units_and_chat_recalculation():
    preview = service.create_import(7, 'replicates.csv', 'mass\n۹۸۰۰\n۱۰۰۰۰\n۱۰۲۰۰'.encode())
    result = service.confirm_import(preview['id'], 7, review(preview))
    assert result['result']['mean'] == 10
    assert result['result']['sample_sd'] == pytest.approx(.2)
    assert result['result']['standard_error'] is None
    assert 'storage_name' not in result
    assert result['id'] != preview['id'] and result['sourceId'] == preview['id']
    with pytest.raises(LookupError):
        service.recalculate_import(result['id'], 8)
    snapshot = LaboratorySnapshot(project={'dataImport': {'id': result['id'], 'result': {'mean': 999}}})
    checked = LabTools(snapshot, 7).execute('recalculate_import', {})
    assert checked['result']['mean'] == 10 and checked['inputs']['sha256'] == result['sha256']
    with pytest.raises(ValueError):
        LabTools(snapshot).execute('recalculate_import', {})
    with pytest.raises(ValueError):
        LabTools(snapshot, 8).execute('recalculate_import', {})


def test_edits_and_exclusions_are_explicit_and_audited():
    preview = service.create_import(7, 'source.csv', b'mass\n9.8\nND\n10.2\n')
    request = review(preview, **{})
    with pytest.raises(ValueError, match='Row 3'):
        service.confirm_import(preview['id'], 7, request)
    request.edits = {'3:c0': '10.0'}
    result = service.confirm_import(preview['id'], 7, request)
    assert result['edits'] == [{'row': 3, 'column': 'c0', 'before': 'ND', 'after': '10.0'}]
    assert service.load_import(preview['id'], 7)['tables'][0]['rows'][1]['cells'] == ['ND']
    request.edits = {}
    request.rows = [2, 4]
    result2 = service.confirm_import(preview['id'], 7, request)
    assert result2['result']['n'] == 2
    assert result2['id'] != result['id']


@pytest.mark.parametrize('raw', ['ND', '<0.1', '1,000', '', 'nan', 'inf', '1.2.3', None])
def test_ambiguous_numerical_values_rejected(raw):
    with pytest.raises(ValueError):
        service.number(raw)


def test_decimal_comma_requires_explicit_choice():
    assert service.number('۱,۲۵', 'comma') == 1.25
    with pytest.raises(ValueError):
        service.number('1,25')


def test_row_limit_never_silently_truncates():
    with pytest.raises(ValueError, match='No rows were silently dropped'):
        service.create_import(7, 'too-many.csv', ('mass\n'+'1\n'*1001).encode())


def test_excel_sheets_and_model_contract():
    stream = io.BytesIO()
    with pd.ExcelWriter(stream, engine='openpyxl') as writer:
        pd.DataFrame({'mass': [50, 100], 'volume': [25, 50]}).to_excel(writer, sheet_name='density', index=False)
        pd.DataFrame({'mass': [1, 2]}).to_excel(writer, sheet_name='other', index=False)
    preview = service.create_import(7, 'data.xlsx', stream.getvalue())
    assert len(preview['tables']) == 2
    data = review(preview).model_dump()
    data.update(mode='model', model='density', unit='g/mL', mappings=[{'input': 0, 'column': 'c0', 'unit': 'g'}, {'input': 1, 'column': 'c1', 'unit': 'mL'}])
    result = service.confirm_import(preview['id'], 7, service.ReviewedImport.model_validate(data))
    assert [r['measured'] for r in result['result']['rows']] == [2, 2]
    data['mappings'][1]['unit'] = 'g'
    with pytest.raises(ValueError, match='Incompatible'):
        service.confirm_import(preview['id'], 7, service.ReviewedImport.model_validate(data))


def test_calibration_assumptions_and_units():
    preview = service.create_import(7, 'calibration.csv', b'x,y\n1,3\n2,5\n3,7\n')
    data = review(preview).model_dump()
    data.update(mode='calibration', unit='signal', mappings=[{'input': 0, 'column': 'c0', 'unit': 'mg/L'}, {'input': 1, 'column': 'c1', 'unit': 'signal'}])
    out = service.calculate_review(service.load_import(preview['id'], 7), service.ReviewedImport.model_validate(data))
    assert out['result']['slope'] == 2 and out['result']['intercept'] == 1
    assert 'x uncertainty not included' in out['result']['assumption']


def test_image_extraction_is_unverified_and_missing_cells_require_review():
    stream = io.BytesIO()
    Image.new('RGB', (40, 40), 'white').save(stream, format='PNG')
    def transport(payload):
        assert payload['store'] is False and payload['text']['format']['strict'] is True
        text = json.dumps({'tables': [{'label': 'Printed table', 'page': 1, 'columns': ['mass'], 'rows': [['1.0'], [None]]}], 'warnings': ['Unreadable cell']})
        return {'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': text}]}]}
    preview = service.create_import(7, 'photo.png', stream.getvalue(), transport=transport)
    assert preview['extraction'] == 'unverified-transcription'
    with pytest.raises(ValueError, match='Row 3'):
        service.confirm_import(preview['id'], 7, review(preview))
    fallback = service.create_import(7, 'photo.png', stream.getvalue(), transport=lambda _: {'status': 'incomplete'})
    assert fallback['tables'] == [] and any('manually' in s for s in fallback['warnings'])


def test_routes_require_account_and_enforce_ownership(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from auth_service import get_current_customer
    from routes.lab_imports import router
    from utils.deps import limiter
    monkeypatch.setattr(limiter, 'enabled', False)
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        assert client.post('/laboratory/imports', files={'file': ('a.csv', b'a\n1\n2')}).status_code == 401
        app.dependency_overrides[get_current_customer] = lambda: {'customer_id': 7}
        preview = client.post('/laboratory/imports', files={'file': ('a.csv', b'a\n1\n2')}).json()
        confirmed = client.post(f"/laboratory/imports/{preview['id']}/confirm", json=review(preview).model_dump())
        assert confirmed.status_code == 200
        key = confirmed.json()['id']
        assert client.get(f'/laboratory/imports/{key}/source').content == b'a\n1\n2'
        app.dependency_overrides[get_current_customer] = lambda: {'customer_id': 8}
        for suffix in ('', '/source'):
            assert client.get(f'/laboratory/imports/{key}{suffix}').status_code == 404
        assert client.post(f'/laboratory/imports/{key}/recalculate').status_code == 404
        assert client.post(f"/laboratory/imports/{preview['id']}/confirm", json=review(preview).model_dump()).status_code == 404


def test_from_analysis_checks_owner_and_only_local_source(monkeypatch, tmp_path):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from auth_service import get_current_customer
    from routes.lab_imports import router
    from utils.deps import limiter
    import repositories.questions_repo as questions
    monkeypatch.setattr(limiter, 'enabled', False)
    monkeypatch.chdir(tmp_path)
    (tmp_path/'uploads').mkdir()
    (tmp_path/'uploads/data.csv').write_bytes(b'a\n1\n2')
    metadata = {'customer_id': 7, 'analysis_type': 'file', 'file_url': '/uploads/data.csv', 'file_name': 'source.csv'}
    monkeypatch.setattr(questions, 'get_question_by_id', lambda _: {'metadata': metadata})
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_customer] = lambda: {'customer_id': 7}
    with TestClient(app) as client:
        assert client.post('/laboratory/imports/from-analysis', json={'question_id': 1}).status_code == 200
        metadata['customer_id'] = 8
        assert client.post('/laboratory/imports/from-analysis', json={'question_id': 1}).status_code == 404
        metadata['customer_id'] = 7
        for source in ('https://example.invalid/data.csv', '/uploads/../secret.csv', '/uploads/..\\secret.csv'):
            metadata['file_url'] = source
            assert client.post('/laboratory/imports/from-analysis', json={'question_id': 1}).status_code == 404
