import pytest
from chemical_catalog import browse_catalog, CATALOG

pytestmark=pytest.mark.skipif(not CATALOG.exists(),reason='Identity snapshot not installed')


def test_catalog_has_real_identities_and_bounded_pages():
    first=browse_catalog(limit=2)
    second=browse_catalog(offset=2,limit=2)
    assert first['metadata']['compounds']==73162
    assert first['total']==73162
    assert len(first['records'])==2
    assert {r['cid'] for r in first['records']}.isdisjoint({r['cid'] for r in second['records']})


def test_exact_cas_and_name_synonyms_resolve_without_guessing_properties():
    ethanol=browse_catalog('64-17-5')['records']
    assert any(r['cid']==702 for r in ethanol)
    methanol=browse_catalog('methyl alcohol')['records']
    assert any(r['cid']==887 for r in methanol)
    assert all('molarMass' not in row for row in methanol)


def test_literal_search_does_not_treat_wildcards_or_sql_as_queries():
    assert browse_catalog("%' OR 1=1 --")['total']==0
    # Some source synonyms contain literal concentration percentages.
    assert browse_catalog('%')['total']<browse_catalog()['total']


def test_alphabet_filter_applies_to_every_page():
    result=browse_catalog(limit=12,letter='m')
    assert result['total']>12
    assert all(row['name'].lstrip('0123456789-+[]() ,').lower().startswith('m') for row in result['records'])


def test_installation_rebuilds_from_bundled_snapshot_without_network(tmp_path,monkeypatch):
    import chemical_catalog
    monkeypatch.setattr(chemical_catalog,'CATALOG',tmp_path/'identities.sqlite3')
    assert chemical_catalog.browse_catalog('64-17-5')['records'][0]['cid']==702
    assert chemical_catalog.CATALOG.exists()
