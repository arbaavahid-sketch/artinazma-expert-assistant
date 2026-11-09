import json
import math
import pytest
from laboratory_chat import LabTools, LaboratorySnapshot, ask_laboratory, editable_fields, revision
from schemas.models import ChatHistoryMessage


def snapshot():
    return LaboratorySnapshot(project={'id': 'synthetic', 'identity': {'sample': 'QA-1'},
                                      'physicalRun': {'measured': 999}}, unit='g', budget={
        'measured': 10, 'coverage': 2, 'components': [{'name': 'balance', 'value': .1, 'sensitivity': 1}]})


def test_current_budget_recomputes_and_ignores_saved_claim():
    result = LabTools(snapshot()).execute('calculate_current_budget', {})
    assert result['result']['measured'] == 10
    assert result['result']['expanded_uncertainty'] == pytest.approx(.2)
    assert result['revision'] == revision(snapshot())


def test_quick_and_model_use_real_equations():
    tools = LabTools(None)
    assert tools.execute('calculate_quick', {'kind': 'dilution', 'values': [1, .1, 250], 'unit': 'mol/L; mL'})['result']['aliquot_volume'] == 25
    result = tools.execute('calculate_model', {'model': 'density', 'values': [50, 25]})
    assert result['result']['measured'] == 2
    stats = tools.execute('calculate_quick', {'kind': 'statistics', 'values': [9.8, 10, 10.2], 'unit': 'g'})
    assert stats['result']['sample_sd'] == pytest.approx(.2)


def test_unit_conversion_rejects_cross_dimensions():
    tools = LabTools(None)
    assert tools.execute('convert_lab_units', {'quantity': 'molarity', 'value': 1, 'from_unit': 'mol/L', 'to_unit': 'mmol/L'})['result']['converted'] == 1000
    assert tools.execute('convert_lab_units', {'quantity': 'temperature', 'value': 32, 'from_unit': 'degF', 'to_unit': 'degC'})['result']['converted'] == pytest.approx(0)
    with pytest.raises(ValueError):
        tools.execute('convert_lab_units', {'quantity': 'volume', 'value': 1, 'from_unit': 'g', 'to_unit': 'mL'})


@pytest.mark.parametrize('args', [
    {'kind': 'dilution', 'values': [1, 2, 250], 'unit': 'mL'},
    {'kind': 'statistics', 'values': [math.nan, 2], 'unit': 'g'},
    {'kind': 'statistics', 'values': [True, 2], 'unit': 'g'},
    {'kind': 'solution_mass', 'values': [1, 1, 50, 2], 'unit': 'g'},
    {'kind': 'dilution', 'values': [1, .1, 250], 'unit': ''},
])
def test_invalid_quick_inputs_rejected(args):
    with pytest.raises(ValueError):
        LabTools(None).execute('calculate_quick', args)


def test_proposals_cannot_modify_ids_results_or_prototype():
    context = snapshot()
    for path in ('id', 'physicalRun.measured', '__proto__.x', 'identity.constructor'):
        with pytest.raises(ValueError):
            LabTools(context).execute('propose_project_changes', {'changes': [{'path': path, 'value': 'x', 'reason': 'test'}]})
    tools = LabTools(context)
    result = tools.execute('propose_project_changes', {'changes': [{'path': 'identity.sample', 'value': 'QA-2', 'reason': 'user request'}]})
    assert result['status'] == 'awaiting_user_confirmation'
    assert result['changes'][0]['previous'] == 'QA-1'
    assert context.project['identity']['sample'] == 'QA-1'


def test_tool_continuation_preserves_reasoning_and_server_outputs():
    sent = []
    def transport(payload):
        sent.append(json.loads(json.dumps(payload)))
        if len(sent) == 1:
            return {'output': [{'type': 'reasoning', 'id': 'rs_1', 'summary': []},
                {'type': 'function_call', 'name': 'calculate_current_budget', 'arguments': '{}', 'call_id': 'call_1'}]}
        assert payload['input'][-1]['type'] == 'function_call_output'
        data = json.loads(payload['input'][-1]['output'])
        assert data['ok'] and data['data']['result']['measured'] == 10
        return {'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': 'Synthetic interpretation'}]}]}
    result = ask_laboratory('Recalculate', [], snapshot(), transport)
    assert result['calculations'][0]['result']['measured'] == 10
    assert any(x.get('type') == 'reasoning' for x in sent[1]['input'])
    assert '999' not in sent[0]['input'][0]['content']
    assert not sent[0]['store']


def test_tool_errors_are_returned_as_errors_not_success():
    sent = []
    def transport(payload):
        sent.append(payload)
        if len(sent) == 1:
            return {'output': [{'type': 'function_call', 'name': 'calculate_current_budget', 'arguments': '{}', 'call_id': '1'}]}
        assert json.loads(payload['input'][-1]['output'])['ok'] is False
        return {'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': 'Please attach a budget'}]}]}
    assert ask_laboratory('Calculate', [], None, transport)['calculations'] == []


def test_bounds_and_unknown_fields():
    with pytest.raises(ValueError):
        LaboratorySnapshot(project={'identity': {'title': 'x'*160001}})
    with pytest.raises(ValueError):
        LaboratorySnapshot(project={}, verified=True)
    with pytest.raises(RuntimeError):
        ask_laboratory('hi', [], transport=lambda p: {'status': 'incomplete', 'output': []})


def test_authenticated_route_and_sanitized_failure(authenticated_client, monkeypatch):
    monkeypatch.setattr('routes.laboratory_chat.ask_laboratory', lambda *a: {'answer': 'ok', 'calculations': [], 'proposals': [], 'revision': None})
    response = authenticated_client.post('/chat/laboratory', json={'message': 'help'})
    assert response.status_code == 200 and response.headers['cache-control'] == 'no-store'
    def fail(*args):
        raise RuntimeError('sensitive upstream detail')
    monkeypatch.setattr('routes.laboratory_chat.ask_laboratory', fail)
    response = authenticated_client.post('/chat/laboratory', json={'message': 'help'})
    assert response.status_code == 503 and 'sensitive upstream' not in response.text


def test_anonymous_route_keeps_existing_guest_gate(app_client):
    response = app_client.post('/chat/laboratory', json={'message': 'help', 'customer_id': 1})
    assert response.status_code in (401, 403)
