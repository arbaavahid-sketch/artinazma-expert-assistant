"""Read-only, paginated access to the imported chemical identity index."""
import json
import sqlite3
import threading
from pathlib import Path

CATALOG = Path(__file__).parent / 'storage/chemical_catalog.sqlite3'
_build_lock=threading.Lock()


def browse_catalog(query='', offset=0, limit=20, letter=''):
    if not CATALOG.exists():
        with _build_lock:
            if not CATALOG.exists():
                from eval.build_chemical_catalog import build, BUNDLE
                if not BUNDLE.exists():
                    raise FileNotFoundError('Chemical identity index is not installed')
                build(source=None,target=CATALOG,write_notice=False)
    with sqlite3.connect(CATALOG.resolve().as_uri()+'?mode=ro',uri=True) as db:
        db.row_factory=sqlite3.Row
        q=query.strip().casefold()
        escaped=q.replace('\\','\\\\').replace('%','\\%').replace('_','\\_')
        clause=''
        args=[]
        if q:
            clause=" WHERE (search_text LIKE ? ESCAPE '\\' OR lower(formula)=? OR cas=? OR CAST(cid AS TEXT)=?)"
            args=['%'+escaped+'%',q,q,q]
        if letter:
            clause+=(' AND ' if clause else ' WHERE ')+"substr(lower(ltrim(name,'0123456789-+[]() ,')),1,1)=?"
            args.append(letter)
        total=db.execute('SELECT COUNT(*) FROM compounds'+clause,args).fetchone()[0]
        sort="lower(ltrim(name,'0123456789-+[]() ,'))"
        records=[dict(row) for row in db.execute('SELECT cid,cas,formula,name,iupac FROM compounds'+clause+f" ORDER BY (cas=? OR CAST(cid AS TEXT)=? OR lower(name)=? OR lower(formula)=?) DESC,CASE WHEN substr({sort},1,1) BETWEEN 'a' AND 'z' THEN 0 ELSE 1 END,{sort},name COLLATE NOCASE,cid LIMIT ? OFFSET ?",args+[q,q,q,q,limit,offset])]
        metadata={row['key']:json.loads(row['value']) for row in db.execute("SELECT key,value FROM metadata WHERE key IN ('source','version','records','compounds','imported_on')")}
    return {'records':records,'total':total,'offset':offset,'limit':limit,'metadata':metadata}
