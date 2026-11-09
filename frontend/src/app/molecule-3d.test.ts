import {it,expect} from 'vitest';
import {readMolecule3D} from './calculators/workspace/molecule-3d';
const example=()=>({PC_Compounds:[{id:{id:{cid:887}},atoms:{aid:[10,20],element:[6,8]},bonds:{aid1:[10],aid2:[20],order:[1]},coords:[{aid:[20,10],conformers:[{x:[2,1],y:[0,0],z:[.5,-.5]}]}]}]});
it('maps coordinates by atom ID instead of array position and preserves bond order',()=>{
 const molecule=readMolecule3D(example(),887);expect(molecule.conformers[0]).toEqual([{x:1,y:0,z:-.5},{x:2,y:0,z:.5}]);expect(molecule.bonds[0]).toEqual({a:10,b:20,order:1});
});
it('rejects absent 3D coordinates instead of inventing a structure',()=>{
 const value=example();value.PC_Compounds[0].coords[0].conformers[0].z=[];expect(()=>readMolecule3D(value,887)).toThrow();expect(()=>readMolecule3D(example(),702)).toThrow();
});
it('rejects duplicated atoms, unknown bonds and nonfinite coordinates',()=>{
 const a=example();a.PC_Compounds[0].atoms.aid=[10,10];expect(()=>readMolecule3D(a,887)).toThrow();
 const b=example();b.PC_Compounds[0].bonds.aid2=[99];expect(()=>readMolecule3D(b,887)).toThrow();
 const c=example();c.PC_Compounds[0].coords[0].conformers[0].x=[NaN,0];expect(()=>readMolecule3D(c,887)).toThrow();
});
