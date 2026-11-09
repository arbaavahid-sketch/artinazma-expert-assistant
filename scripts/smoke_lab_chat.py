"""Explicit live smoke: sends synthetic lab data using the configured API key."""
import json
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / 'backend/.env')
sys.path.insert(0, str(ROOT / 'backend'))
from laboratory_chat import LaboratorySnapshot, ask_laboratory


if __name__ == '__main__':
    snapshot = LaboratorySnapshot(project={'id': 'synthetic-live-smoke', 'workflow': 'weighing',
        'identity': {'title': 'Synthetic live smoke', 'sample': 'QA-1', 'sop': '', 'edition': '', 'matrix': ''}},
        unit='g', budget={'measured': 10, 'coverage': 2, 'components': [
            {'name': 'Synthetic balance certificate', 'value': .1, 'sensitivity': 1}]})
    answer = ask_laboratory(
        'این داده‌ها فرضی‌اند. بودجه فعلی را با ابزار سرور دوباره محاسبه کن و توضیح کوتاه بده. '
        'همچنین فقط پیشنهاد بده که شناسه نمونه به QA-2 تغییر کند؛ هیچ تغییری اعمال نکن.', [], snapshot)
    assert any(c['kind'] == 'uncertainty' and abs(c['result']['expanded_uncertainty']-.2) < 1e-12 for c in answer['calculations'])
    assert any(c['path'] == 'identity.sample' and c['value'] == 'QA-2' for p in answer['proposals'] for c in p['changes'])
    assert snapshot.project['identity']['sample'] == 'QA-1'
    missing = ask_laboratory('جرم نمونه فرضی 50 گرم است. حجم را هنوز اندازه نگرفته‌ام. چگالی چقدر می‌شود؟', [])
    assert not missing['calculations'], 'Missing volume must not produce a calculated density'
    output = ROOT / 'output/lab-chat-live-smoke.json'
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps({'budget_and_proposal': answer, 'missing_input': missing}, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Live smoke passed: real budget calculation, proposal without mutation, and missing-input handling.')
