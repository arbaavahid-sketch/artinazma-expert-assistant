"""Build a versioned browse/search index from the existing chemicals wheel.

Only identity fields are imported; reference properties remain in PubChem.
Run from repository root. No dependency installation or external requests.
"""
import hashlib
import gzip
import json
import sqlite3
import zipfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'output/uncertainty-review/chemicals-1.5.2-py3-none-any.whl'
TARGET = ROOT / 'backend/storage/chemical_catalog.sqlite3'
BUNDLE = ROOT / 'backend/data/chemical-identities-v1.jsonl.gz'


def build(source=SOURCE, target=TARGET, write_notice=True):
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(prefix=target.stem+'-',suffix='.building',dir=target.parent,delete=False) as handle:
        temp=Path(handle.name)
    db = sqlite3.connect(temp)
    db.executescript('''
      CREATE TABLE compounds (id INTEGER PRIMARY KEY, cid INTEGER NOT NULL, cas TEXT NOT NULL,
        formula TEXT NOT NULL, name TEXT NOT NULL, iupac TEXT NOT NULL, search_text TEXT NOT NULL,
        source_file TEXT NOT NULL, UNIQUE(cid, cas));
      CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    ''')
    if source is None or not source.exists():
        with gzip.open(BUNDLE,'rt',encoding='utf-8') as bundle:
            db.executemany('INSERT INTO compounds(cid,cas,formula,name,iupac,search_text,source_file) VALUES(?,?,?,?,?,?,?)',(json.loads(line) for line in bundle))
        metadata=json.loads((ROOT/'docs/CHEMICAL_CATALOG_SOURCE.json').read_text(encoding='utf-8'))
        license_text=metadata['license']
    else:
      with zipfile.ZipFile(source) as archive:
        for size in ('small', 'large'):
            name = f'chemicals/Identifiers/chemical identifiers pubchem {size}.tsv'
            records = []
            for line in archive.read(name).decode('utf-8').splitlines():
                fields = line.split('\t')
                if len(fields)<9 or not fields[0].isdigit() or int(fields[0])<=0:
                    raise ValueError('Invalid identity row')
                cid, cas, formula = int(fields[0]), fields[1], fields[2]
                iupac, title = fields[7], fields[8]
                records.append((cid, cas, formula, title, iupac,
                                '\n'.join(fields[7:]).casefold(), name))
            db.executemany('INSERT OR IGNORE INTO compounds(cid,cas,formula,name,iupac,search_text,source_file) VALUES(?,?,?,?,?,?,?)', records)
        license_text = archive.read('chemicals-1.5.2.dist-info/licenses/LICENSE.txt').decode()
    db.executescript('CREATE INDEX compounds_name ON compounds(name COLLATE NOCASE,cid); CREATE INDEX compounds_cid ON compounds(cid); CREATE INDEX compounds_cas ON compounds(cas);')
    count, distinct = db.execute('SELECT COUNT(*),COUNT(DISTINCT cid) FROM compounds').fetchone()
    metadata = {'source': 'chemicals 1.5.2 / PubChem identifier tables', 'version': 'chemicals-1.5.2-identities-v1',
                'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest() if source is not None and source.exists() else metadata['source_sha256'], 'records': count,
                'compounds': distinct, 'license': license_text, 'imported_on': '2026-11-05',
                'scope': 'Identity index only; not the complete PubChem database. No physical properties imported.'}
    db.executemany('INSERT INTO metadata VALUES(?,?)', [(k,json.dumps(v,ensure_ascii=False)) for k,v in metadata.items()])
    db.commit()
    if source is not None and source.exists():
        BUNDLE.parent.mkdir(parents=True,exist_ok=True)
        with gzip.open(BUNDLE,'wt',encoding='utf-8') as bundle:
            for row in db.execute('SELECT cid,cas,formula,name,iupac,search_text,source_file FROM compounds ORDER BY cid'):
                bundle.write(json.dumps(row,ensure_ascii=False)+'\n')
    db.close()
    temp.replace(target)
    notice = ROOT / 'docs/CHEMICAL_CATALOG_SOURCE.json'
    if write_notice:
        notice.write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
    return metadata


if __name__ == '__main__':
    result = build()
    print(json.dumps({k:v for k,v in result.items() if k!='license'},indent=2))
