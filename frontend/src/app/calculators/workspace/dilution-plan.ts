import {numeric} from './gc-workflow';
export const concentrationUnits=['mol/L','mmol/L','µmol/L','g/L','mg/L','µg/L'] as const;
export type ConcentrationUnit=typeof concentrationUnits[number];
export type DilutionStep={target:string;unit:ConcentrationUnit;volume:string;volumeUnit:'mL'|'L'};
export const labelFields=['solutionId','preparedBy','preparedOn','expires','storage','notes'] as const;
export type DilutionLabel=Record<typeof labelFields[number],string>;
export function emptyDilutionLabel():DilutionLabel{return {solutionId:'',preparedBy:'',preparedOn:'',expires:'',storage:'',notes:''};}
export type DilutionPlan={stock:string;unit:ConcentrationUnit;source:string;steps:DilutionStep[];label?:DilutionLabel};
export function emptyDilution():DilutionPlan{return {stock:'',unit:'mg/L',source:'',steps:[{target:'',unit:'mg/L',volume:'',volumeUnit:'mL'}]};}
export function readDilution(value:unknown):DilutionPlan{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid dilution');const r=value as DilutionPlan;
 const text=(v:unknown,max=200)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid dilution text');return v;};
 if(!concentrationUnits.includes(r.unit)||!Array.isArray(r.steps)||r.steps.length<1||r.steps.length>12)throw Error('Invalid dilution steps');
 let label:DilutionLabel|undefined;
 if(r.label!==undefined){if(!r.label||typeof r.label!=='object'||Array.isArray(r.label))throw Error('Invalid label');label=Object.fromEntries(labelFields.map(k=>[k,text(r.label![k],k==='notes'?300:200)])) as DilutionLabel;}
 return {...(label?{label}:{}),stock:text(r.stock),source:text(r.source,2000),unit:r.unit,steps:r.steps.map(s=>{if(!s||!concentrationUnits.includes(s.unit)||!['mL','L'].includes(s.volumeUnit))throw Error('Invalid dilution unit');return {target:text(s.target),volume:text(s.volume),unit:s.unit,volumeUnit:s.volumeUnit};})};
}
const scales:Record<ConcentrationUnit,number>={'mol/L':1,'mmol/L':1e-3,'µmol/L':1e-6,'g/L':1,'mg/L':1e-3,'µg/L':1e-6};
function family(unit:ConcentrationUnit){return unit.includes('mol')?'molar':'mass';}
export function calculateDilution(raw:DilutionPlan){
 const p=readDilution(raw);let current=numeric(p.stock)*scales[p.unit];
 if(!Number.isFinite(current)||current<=0||!p.source.trim())throw Error('Stock concentration and source required');
 let previousVolume:number|undefined;
 return p.steps.map((s,index)=>{const target=numeric(s.target)*scales[s.unit],volume=numeric(s.volume)*(s.volumeUnit==='L'?1000:1);
 if(family(s.unit)!==family(p.unit)||!Number.isFinite(target)||!Number.isFinite(volume)||target<=0||target>=current||volume<=0)throw Error('Invalid dilution target or volume');
 const aliquot=target/current*volume,factor=current/target;
 if(!Number.isFinite(aliquot)||aliquot<=0||!Number.isFinite(factor)||previousVolume!==undefined&&aliquot>previousVolume*(1+1e-12))throw Error('Insufficient previous solution or numeric overflow');
 const result={stage:index+1,stockBase:current,targetBase:target,aliquotML:aliquot,finalML:volume,factor,unit:s.unit,target:s.target};
 current=target;previousVolume=volume;return result;});
}

/** Scale all stages together, preserving their concentration and dilution ratios. */
export function scaleDilution(raw:DilutionPlan,finalVolume:string,volumeUnit:'mL'|'L'){
 const plan=readDilution(raw),before=calculateDilution(plan);
 if(!['mL','L'].includes(volumeUnit))throw Error('Invalid scaling unit');
 const desired=numeric(finalVolume)*(volumeUnit==='L'?1000:1);
 const factor=desired/before.at(-1)!.finalML;
 if(!Number.isFinite(desired)||desired<=0||!Number.isFinite(factor)||factor<=0)throw Error('Invalid scaling factor');
 const scaled:DilutionPlan={...plan,steps:plan.steps.map(s=>{const volume=numeric(s.volume)*factor;if(!Number.isFinite(volume)||volume<=0)throw Error('Scaled volume outside numeric range');return {...s,volume:String(Number(volume.toPrecision(15)))};})};
 const after=calculateDilution(scaled);
 if(Math.abs(after.at(-1)!.finalML-desired)>1e-12*desired)throw Error('Scaling precision exceeded');
 return {plan:scaled,factor,before,after};
}
