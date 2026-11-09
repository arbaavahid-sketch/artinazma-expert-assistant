"""Versioned structural calculations. Never a source of experimental properties."""
from functools import lru_cache
import math
import threading

_slots=threading.BoundedSemaphore(2)


class StructureUnavailable(Exception):
    pass


class InvalidStructure(ValueError):
    pass


@lru_cache(maxsize=128)
def analyze_smiles(smiles):
    try:
        from rdkit import Chem, rdBase
        from rdkit.Chem import Descriptors, rdMolDescriptors, rdDepictor
        from rdkit.Chem.Draw import rdMolDraw2D
    except ImportError:
        raise StructureUnavailable('RDKit is not installed') from None
    if not isinstance(smiles,str) or not smiles or len(smiles)>2000 or not smiles.isascii() or any(c.isspace() for c in smiles):
        raise InvalidStructure('Unsupported SMILES')
    if not _slots.acquire(blocking=False):
        raise StructureUnavailable('Structure service is busy')
    try:
        try:
            molecule=Chem.MolFromSmiles(smiles,sanitize=True)
            if molecule is None or not 0<molecule.GetNumAtoms()<=500:
                raise InvalidStructure('Invalid or oversized molecule')
            explicit=Chem.AddHs(molecule)
            molar_mass=Descriptors.MolWt(molecule)
            exact_mass=rdMolDescriptors.CalcExactMolWt(molecule)
            if not all(math.isfinite(v) and v>0 for v in (molar_mass,exact_mass)):
                raise InvalidStructure('Invalid molecular mass')
            rdDepictor.Compute2DCoords(molecule)
            drawer=rdMolDraw2D.MolDraw2DSVG(560,300)
            drawer.DrawMolecule(molecule)
            drawer.FinishDrawing()
            return {'engine':'RDKit','engineVersion':rdBase.rdkitVersion,'modelVersion':1,
                    'inputSmiles':smiles,'canonicalSmiles':Chem.MolToSmiles(molecule,isomericSmiles=True),
                    'formula':rdMolDescriptors.CalcMolFormula(molecule),
                    'molarMass':molar_mass,'exactMass':exact_mass,
                    'atomCount':explicit.GetNumAtoms(),'heavyAtomCount':molecule.GetNumHeavyAtoms(),
                    'hydrogenCount':sum(a.GetAtomicNum()==1 for a in explicit.GetAtoms()),
                    'formalCharge':Chem.GetFormalCharge(molecule),'fragmentCount':len(Chem.GetMolFrags(molecule)),
                    'svg':drawer.GetDrawingText()}
        except InvalidStructure:
            raise
        except Exception:
            raise InvalidStructure('Structure could not be processed') from None
    finally:
        _slots.release()
