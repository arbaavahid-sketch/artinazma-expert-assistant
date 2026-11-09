"""Mirror the exact versioned UI snapshots for backend chat retrieval. No network."""
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def export():
    source = ROOT/'frontend/src/app/calculators/workspace'
    elements = json.loads((source/'element-data.json').read_text(encoding='utf-8'))
    version = elements['metadata']['version']
    isotopes = {str(e['atomic_number']): json.loads((ROOT/f'frontend/public/data/elements/{version}/{e["atomic_number"]}.json').read_text(encoding='utf-8'))['isotopes'] for e in elements['elements']}
    compounds = json.loads((source/'chemical-library.json').read_text(encoding='utf-8'))
    value = {'elements': elements, 'isotopes': isotopes, 'compounds': compounds}
    # Stable gzip bytes, so regenerating an unchanged snapshot creates no diff.
    payload = json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()
    (ROOT/'backend/data/lab-reference-context.json.gz').write_bytes(gzip.compress(payload, mtime=0))


if __name__ == '__main__':
    export()
