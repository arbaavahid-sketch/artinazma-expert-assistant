import json
from unittest.mock import patch, MagicMock
import pytest
from fastapi import HTTPException
from routes import chemicals

@pytest.mark.parametrize('path',['https://evil.example','../health','pug_view/data/compound/1/JSON?heading=Unknown','pug/compound/cid/1/property/MolecularWeight/JSON','pug/compound/name/a/cids/JSON?url=http://localhost'])
def test_rejects_unrestricted_transport(path):
    with pytest.raises(HTTPException) as error: chemicals.fetch_pubchem(path)
    assert error.value.status_code==400

def test_transport_caches_and_only_uses_pubchem():
    chemicals._cache.clear()
    opener=MagicMock()
    opener.open.return_value.__enter__.return_value.read.return_value=json.dumps({'IdentifierList':{'CID':[2244]}}).encode()
    with patch.object(chemicals.urllib.request,'build_opener',return_value=opener):
        assert chemicals.fetch_pubchem('pug/compound/name/aspirin/cids/JSON')['IdentifierList']['CID']==[2244]
        chemicals.fetch_pubchem('pug/compound/name/aspirin/cids/JSON')
    assert opener.open.call_count==1
    assert opener.open.call_args.args[0].full_url.startswith('https://pubchem.ncbi.nlm.nih.gov/rest/')


def test_3d_transport_is_limited_to_one_cid_and_fixed_record_type():
    assert chemicals._ALLOWED.fullmatch('pug/compound/cid/887/JSON?record_type=3d')
    for path in ['pug/compound/cid/887,702/JSON?record_type=3d',
                 'pug/compound/cid/887/JSON?record_type=3d&url=http://localhost',
                 'pug/compound/cid/0/JSON?record_type=3d']:
        assert not chemicals._ALLOWED.fullmatch(path)


@pytest.fixture(autouse=True)
def isolated_transport(tmp_path, monkeypatch):
    from pubchem_gate import PubChemGate
    monkeypatch.setattr(chemicals, 'gate', PubChemGate(tmp_path/'gate.sqlite3'))
    chemicals._cache.clear()
    yield
    chemicals._cache.clear()
