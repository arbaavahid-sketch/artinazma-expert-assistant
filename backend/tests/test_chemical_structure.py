from unittest.mock import patch
import pytest
from fastapi import HTTPException
from starlette.requests import Request
from chemical_structure import analyze_smiles, InvalidStructure, StructureUnavailable
from routes.chemicals import chemical_structure


def test_methanol_structure_and_independent_mass_reference():
    result=analyze_smiles('CO')
    assert result['formula']=='CH4O'
    assert result['molarMass']==pytest.approx(12.011+4*1.008+15.999)
    assert result['exactMass']==pytest.approx(12+4*1.00782503223+15.99491461957,abs=1e-7)
    assert result['atomCount']==6 and result['hydrogenCount']==4
    assert result['heavyAtomCount']==2 and result['formalCharge']==0
    assert '<svg' in result['svg'] and '<script' not in result['svg']


def test_ions_and_disconnected_components_are_not_neutralized():
    result=analyze_smiles('[Na+].[Cl-]')
    assert result['formula']=='ClNa' and result['fragmentCount']==2
    assert result['formalCharge']==0 and result['hydrogenCount']==0
    assert analyze_smiles('[NH4+]')['formalCharge']==1


def test_isotopes_and_stereochemistry_survive_input_processing():
    ordinary=analyze_smiles('CO')
    labeled=analyze_smiles('[2H]OC([2H])([2H])[2H]')
    assert labeled['exactMass']>ordinary['exactMass']+4
    assert '[2H]' in labeled['canonicalSmiles']
    assert '@' in analyze_smiles('N[C@@H](C)C(=O)O')['canonicalSmiles']


@pytest.mark.parametrize('smiles',['','invalid','C(C)(C)(C)(C)C','C'*2001,'CO\n','é'])
def test_invalid_or_oversized_structures_are_rejected(smiles):
    with pytest.raises(InvalidStructure):
        analyze_smiles(smiles)


def call(cid=887):
    request=Request({'type':'http','method':'GET','path':'/chemicals/structure','headers':[], 'client':('127.0.0.1',1),'query_string':b''})
    return chemical_structure.__wrapped__(request,cid)


def test_route_uses_complete_smiles_and_keeps_source_cid():
    with patch('routes.chemicals.fetch_pubchem_record',return_value=fetched_record({'PropertyTable':{'Properties':[{'CID':887,'SMILES':'CO','ConnectivitySMILES':'wrong'}]}})) as source:
        result=call()
    assert source.call_args.args[0]=='pug/compound/cid/887/property/SMILES/JSON'
    assert result['inputSmiles']=='CO' and result['cid']==887
    assert result['sourceUrl'].endswith('/887')
    assert result['fetchedAt']=='2026-11-01T10:00:00Z'
    assert result['retrievedOn']=='2026-11-01' and result['sourceUpdatedAt'] is None


def test_route_rejects_connectivity_only_or_wrong_identity():
    for record in [{'CID':887,'ConnectivitySMILES':'CO'},{'CID':702,'SMILES':'CO'}]:
        with patch('routes.chemicals.fetch_pubchem_record',return_value=fetched_record({'PropertyTable':{'Properties':[record]}})):
            with pytest.raises(HTTPException) as error:
                call()
        assert error.value.status_code in (404,422)


def test_route_reports_engine_unavailable_without_fabricating_results():
    with patch('routes.chemicals.fetch_pubchem_record',return_value=fetched_record({'PropertyTable':{'Properties':[{'CID':887,'SMILES':'CO'}]}})),patch('chemical_structure.analyze_smiles',side_effect=StructureUnavailable):
        with pytest.raises(HTTPException) as error:
            call()
    assert error.value.status_code==503


def fetched_record(value):
    from routes.chemicals import PubChemRecord
    return PubChemRecord(value, '2026-11-01T10:00:00Z', 'https://pubchem.ncbi.nlm.nih.gov/rest/test')
