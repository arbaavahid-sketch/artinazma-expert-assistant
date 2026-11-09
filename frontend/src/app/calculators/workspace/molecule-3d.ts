export type Molecule3D={atoms:{id:number;element:number}[];bonds:{a:number;b:number;order:number}[];conformers:{x:number;y:number;z:number}[][]};
// PubChem atom IDs are identifiers, not offsets into coordinate arrays.
export function readMolecule3D(value:unknown,cid:number):Molecule3D{
 const data=value as {PC_Compounds?:{id?:{id?:{cid?:number}};atoms?:{aid:number[];element:number[]};bonds?:{aid1:number[];aid2:number[];order:number[]};coords?:{type?:number[];aid:number[];conformers?:{x:number[];y:number[];z:number[]}[]}[]}[]};
 const compound=data?.PC_Compounds?.find(c=>c.id?.id?.cid===cid),atoms=compound?.atoms;
 if(!atoms||!Array.isArray(atoms.aid)||atoms.aid.length<1||atoms.aid.length>1000||!Array.isArray(atoms.element)||atoms.element.length!==atoms.aid.length||new Set(atoms.aid).size!==atoms.aid.length)throw new Error('Invalid atoms');
 if(atoms.aid.some(id=>!Number.isSafeInteger(id)||id<1)||atoms.element.some(e=>!Number.isInteger(e)||e<1||e>118))throw new Error('Invalid atom identity');
 const ids=new Set(atoms.aid),bonds:Molecule3D['bonds']=[],raw=compound.bonds;
 if(raw){if(!Array.isArray(raw.aid1)||!Array.isArray(raw.aid2)||!Array.isArray(raw.order)||raw.aid1.length>4000||raw.aid1.length!==raw.aid2.length||raw.aid1.length!==raw.order.length)throw new Error('Invalid bonds');
  raw.aid1.forEach((a,i)=>{const b=raw.aid2[i],order=raw.order[i];if(!ids.has(a)||!ids.has(b)||a===b||!Number.isInteger(order)||order<1||order>4)throw new Error('Invalid bond');bonds.push({a,b,order});});}
 const conformers:Molecule3D['conformers']=[];
 for(const coords of compound.coords??[]){if(!Array.isArray(coords.aid)||coords.aid.length!==atoms.aid.length||new Set(coords.aid).size!==atoms.aid.length||coords.aid.some(id=>!ids.has(id)))continue;
  for(const c of coords.conformers??[]){if(conformers.length>=10)break;if(![c.x,c.y,c.z].every(a=>Array.isArray(a)&&a.length===coords.aid.length&&a.every(n=>Number.isFinite(n)&&Math.abs(n)<100000)))continue;
   const points=new Map(coords.aid.map((id,i)=>[id,{x:c.x[i],y:c.y[i],z:c.z[i]}]));conformers.push(atoms.aid.map(id=>points.get(id)!));}
 }
 if(!conformers.length)throw new Error('No 3D coordinates');
 return {atoms:atoms.aid.map((id,i)=>({id,element:atoms.element[i]})),bonds,conformers};
}
