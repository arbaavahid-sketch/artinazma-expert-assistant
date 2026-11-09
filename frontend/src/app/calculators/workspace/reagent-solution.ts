import {numeric} from './gc-workflow';
import {type Reagent,readReagents} from './reagents';
export function reagentPurity(r:Reagent):number|null{
 const basis=r.purityBasis.trim().toLowerCase();
 if(!['جرمی','جرمی درصد','w/w','% w/w','mass','mass fraction'].includes(basis))return null;
 const text=r.purity.trim().replace(/[%٪]\s*$/,'').trim();
 if(!/^[۰-۹٠-٩0-9.٫]+$/.test(text))return null;
 const n=numeric(text);return Number.isFinite(n)&&n>0&&n<=100?n:null;
}
export function reagentReference(r:Reagent){return [r.name,r.manufacturer,r.catalogue,r.lot,r.certificate].filter(Boolean).join(' · ').slice(0,2000);}
export function reagentSnapshot(value:unknown){return readReagents([value])[0];}
