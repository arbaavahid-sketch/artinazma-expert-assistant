"""Offline candidate review: validate and report changes, never replace active data.

Run from the repository root with backend/venv/Scripts/python.exe.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from occupational_reference import validate_snapshot, DATA


def read_snapshot(path):
    raw = Path(path).read_bytes()
    if len(raw) > 5_000_000:
        raise ValueError('Snapshot exceeds 5 MB')
    return validate_snapshot(json.loads(raw.decode('utf-8-sig'))), hashlib.sha256(raw).hexdigest()


def review(baseline, candidate):
    validate_snapshot(baseline)
    validate_snapshot(candidate)
    if candidate['version'] == baseline['version']:
        raise ValueError('Candidate needs a new snapshot version')
    if candidate['checkedOn'] < baseline['checkedOn']:
        raise ValueError('Candidate review date cannot go backwards')
    before = {r['id']: r for r in baseline['records']}
    after = {r['id']: r for r in candidate['records']}
    changed = []
    for identity in sorted(before.keys() & after.keys()):
        old, new = before[identity], after[identity]
        if old['cas'] != new['cas']:
            raise ValueError(f'CAS identity changed for NPG {identity}; resolve separately')
        if new['checkedOn'] < old['checkedOn']:
            raise ValueError(f'Record review date went backwards: {identity}')
        fields = {k: {'before': old.get(k), 'after': new.get(k)}
                  for k in sorted(old.keys() | new.keys()) if old.get(k) != new.get(k)}
        if fields:
            changed.append({'id': identity, 'fields': fields})
    return {
        'status': 'validated_candidate_requires_source_review',
        'baselineVersion': baseline['version'], 'candidateVersion': candidate['version'],
        'checkedOn': candidate['checkedOn'], 'coverageCount': len(after),
        'metadataChanges': {k: {'before': baseline.get(k), 'after': candidate.get(k)}
                            for k in sorted(baseline.keys() | candidate.keys())
                            if k != 'records' and baseline.get(k) != candidate.get(k)},
        'added': [after[k] for k in sorted(after.keys() - before.keys())],
        'removed': [before[k] for k in sorted(before.keys() - after.keys())],
        'changed': changed,
        'promotion': 'Not performed. Review official sources and this diff before replacing active data; restart workers afterwards.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', type=Path, default=DATA)
    parser.add_argument('--candidate', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.report.resolve() in {args.baseline.resolve(), args.candidate.resolve(), DATA.resolve()}:
            raise ValueError('Report must not overwrite a snapshot')
        baseline, baseline_hash = read_snapshot(args.baseline)
        candidate, candidate_hash = read_snapshot(args.candidate)
        report = review(baseline, candidate)
        report.update(baselineSha256=baseline_hash, candidateSha256=candidate_hash)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    except (ValueError, KeyError, TypeError, OSError) as exc:
        parser.exit(2, f'Snapshot review failed: {exc}\n')
    print(json.dumps({'status': report['status'], 'coverageCount': report['coverageCount'],
                      'added': len(report['added']), 'removed': len(report['removed']),
                      'changed': len(report['changed'])}))


if __name__ == '__main__':
    main()
