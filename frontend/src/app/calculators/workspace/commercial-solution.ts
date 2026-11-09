import {type Reagent} from './reagents';
import {reagentSnapshot,reagentPurity,reagentReference} from './reagent-solution';
import {numeric} from './gc-workflow';
export const commercialFields=['massPercent','percentSource','density','densityConditions','densitySource','productReference','target','volume'] as const;
export type CommercialDraft=Record<typeof commercialFields[number],string>&{volumeUnit:'mL'|'L';sameSpecies:boolean;reagent?:Reagent};
export function emptyCommercial():CommercialDraft{return {...Object.fromEntries(commercialFields.map(k=>[k,''])),volumeUnit:'mL',sameSpecies:false} as CommercialDraft;}
export function readCommercial(value:unknown):CommercialDraft{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid commercial solution');const r=value as CommercialDraft;
 if(typeof r.sameSpecies!=='boolean'||!['mL','L'].includes(r.volumeUnit))throw Error('Invalid commercial mode');
 const entries=commercialFields.map(k=>{const max=['massPercent','density','target','volume'].includes(k)?200:2000;if(typeof r[k]!=='string'||r[k].length>max)throw Error('Invalid commercial text');return [k,r[k]];});
 let reagent:Reagent|undefined;
 if(r.reagent!==undefined){reagent=reagentSnapshot(r.reagent);if(reagentPurity(reagent)===null||!reagent.lot.trim()||!reagent.certificate.trim()||numeric(r.massPercent)!==reagentPurity(reagent)||r.percentSource!==reagent.certificate||r.productReference!==reagentReference(reagent))throw Error('Commercial reagent snapshot mismatch');}
 return {...Object.fromEntries(entries),...(reagent?{reagent}:{}),volumeUnit:r.volumeUnit,sameSpecies:r.sameSpecies} as CommercialDraft;
}
export function calculateCommercial(raw:CommercialDraft,molarMass:string){
 const d=readCommercial(raw),p=numeric(d.massPercent),rho=numeric(d.density),M=numeric(molarMass),target=numeric(d.target),volumeML=numeric(d.volume)*(d.volumeUnit==='L'?1000:1);
 if(!d.sameSpecies||![p,rho,M,target,volumeML].every(v=>Number.isFinite(v)&&v>0)||p>100||!['percentSource','densityConditions','densitySource','productReference'].every(k=>d[k as typeof commercialFields[number]].trim()))throw Error('Incomplete or invalid commercial solution');
 const stockMolarity=10*rho*p/M;
 if(!Number.isFinite(stockMolarity)||stockMolarity<=target)throw Error('Target must be below stock concentration');
 const aliquotML=volumeML*target/stockMolarity,productMassG=aliquotML*rho,soluteMassG=productMassG*p/100;
 if(![aliquotML,productMassG,soluteMassG].every(v=>Number.isFinite(v)&&v>0)||aliquotML>=volumeML)throw Error('Commercial calculation exceeds numeric range');
 return {stockMolarity,aliquotML,productMassG,soluteMassG,volumeML,target,molarMass:M};
}

export function linkCommercialReagent(draft:CommercialDraft,value:Reagent):CommercialDraft{
 const r=reagentSnapshot(value),p=reagentPurity(r);
 if(p===null||!r.lot.trim()||!r.certificate.trim())throw Error('Sourced mass percentage and lot required');
 return {...draft,massPercent:String(p),percentSource:r.certificate,productReference:reagentReference(r),sameSpecies:false,reagent:r};
}
