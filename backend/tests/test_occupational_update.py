import copy
import json
import subprocess
import sys
from pathlib import Path
import pytest
from occupational_reference import catalog, reference, validate_snapshot
from eval.review_occupational_snapshot import review


def candidate():
    data=copy.deepcopy(catalog())
    data['version']+='-candidate'
    return data


def test_new_materials_preserve_distinct_periods_and_annotations():
    ethanol=reference(query='اتانول')['records'][0]
    assert ethanol['id']=='0262'
    assert '10%LEL' in reference(identity='0262')['record']['limits'][2]['raw']
    assert 'ST 15 ppm' in reference(identity='0002')['record']['limits'][0]['raw']
    nitric=reference(identity='0447')['record']
    assert 'ST 4 ppm' in nitric['limits'][0]['raw'] and 'ST' not in nitric['limits'][1]['raw']
    soda=reference(query='1310-73-2')['records'][0]
    rel,pel,idlh=reference(identity=soda['id'])['record']['limits']
    assert rel['raw']=='C 2 mg/m³' and pel['raw']=='TWA 2 mg/m³; See Appendix G'
    assert idlh['raw']=='10 mg/m³'


def test_review_reports_removal_and_exact_changed_limit_without_mutating_baseline():
    baseline=copy.deepcopy(catalog())
    proposed=candidate()
    proposed['records'].pop()
    proposed['records'][0]['limits'][0]['raw']='TWA 201 ppm (test candidate only)'
    result=review(baseline,proposed)
    assert result['removed'][0]['id']=='0565'
    assert result['changed'][0]['fields']['limits']['before'][0]['raw'].startswith('TWA 200')
    assert result['changed'][0]['fields']['limits']['after'][0]['raw'].startswith('TWA 201')
    assert baseline==catalog() and result['promotion'].startswith('Not performed')


@pytest.mark.parametrize('mutation',[
    lambda d:d.update(fetchedAt='2026-11-07T00:00:00Z'),
    lambda d:d.update(checkedOn='2026-02-30'),
    lambda d:d['records'].append(copy.deepcopy(d['records'][0])),
    lambda d:d['records'][0].update(cas='67-56-2'),
    lambda d:d['records'][0]['limits'][0].update(agency='OSHA'),
    lambda d:d['records'][0]['limits'][0].update(raw=''),
    lambda d:d['records'][0]['references'][0].update(url='https://evil.example/'),
    lambda d:d['records'][0].update(checkedOn='2026-11-08'),
])
def test_invalid_candidate_never_validates(mutation):
    proposed=candidate()
    mutation(proposed)
    with pytest.raises(ValueError):
        validate_snapshot(proposed)


def test_review_requires_new_version_and_rejects_identity_reassignment():
    with pytest.raises(ValueError):
        review(catalog(),copy.deepcopy(catalog()))
    proposed=candidate()
    proposed['records'][0]['cas']='64-18-6'
    with pytest.raises(ValueError,match='identity changed'):
        review(catalog(),proposed)


def test_cli_only_writes_report_and_rejects_active_file_as_report(tmp_path):
    script=Path(__file__).resolve().parents[1]/'eval'/'review_occupational_snapshot.py'
    base=tmp_path/'base.json'
    new=tmp_path/'candidate.json'
    report=tmp_path/'report.json'
    base.write_text(json.dumps(catalog()),encoding='utf-8')
    new.write_text(json.dumps(candidate()),encoding='utf-8')
    original=base.read_bytes()
    args=[sys.executable,str(script),'--baseline',str(base),'--candidate',str(new),'--report']
    completed=subprocess.run(args+[str(report)],capture_output=True,text=True)
    assert completed.returncode==0,completed.stderr
    data=json.loads(report.read_text('utf-8'))
    assert len(data['candidateSha256'])==64 and data['coverageCount']==12
    assert base.read_bytes()==original
    rejected=subprocess.run(args+[str(base)],capture_output=True,text=True)
    assert rejected.returncode==2 and base.read_bytes()==original
