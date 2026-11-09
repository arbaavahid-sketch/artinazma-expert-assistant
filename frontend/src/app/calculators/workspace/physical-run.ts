import {apiUrl,customerFetch} from '@/lib/api';
import {calculateDensity,densityKeys,type DensityData} from './density';
import {calculateWeighing,weighingKeys,type WeighingData} from './weighing';
import {numeric,uncertaintyComponent} from './gc-workflow';
import type {ProjectIdentity} from './project-file';
export type PhysicalKind='density'|'weighing';
export type PhysicalRun={kind:PhysicalKind;modelVersion:1;inputKey:string;calculatedAt:string;measured:number;standard:number;expanded:number;coverage:number;engine:string;engineVersion:string};
export const physicalKey=(data:DensityData|WeighingData,identity:ProjectIdentity)=>JSON.stringify({data,identity});
export function preparePhysical(kind:PhysicalKind,data:DensityData|WeighingData){
  if(kind==='density'){
    const d=data as DensityData,r=calculateDensity(d);
    return {expected:{measured:r.density,standard:r.standard,expanded:r.expanded,coverage:r.k},request:{measured:r.density,coverage:r.k,coverage_mode:'manual',measurement_model:{kind:'density',nominals:densityKeys.map(key=>numeric(d.inputs[key].nominal))},components:densityKeys.map(key=>({name:key,...uncertaintyComponent(d.inputs[key].uncertainty),sensitivity:1})),correlations:[]}};
  }
  const d=data as WeighingData,r=calculateWeighing(d);
  // m = I: independent contributions to the corrected mass all have sensitivity 1.
  // The existing balance model has five fixed extras, so it is not used for this three-component budget.
  return {expected:{measured:r.mass,standard:r.standard,expanded:r.expanded,coverage:r.k},request:{measured:r.mass,coverage:r.k,coverage_mode:'manual',components:weighingKeys.map(key=>({name:key,...uncertaintyComponent(d.components[key]),sensitivity:1})),correlations:[]}};
}
export function readPhysicalRun(value:unknown):PhysicalRun{
  if(!value||typeof value!=='object')throw new Error('Invalid physical run');
  const r=value as Record<string,unknown>;
  if(!['density','weighing'].includes(r.kind as string)||r.modelVersion!==1||typeof r.inputKey!=='string'||r.inputKey.length>600000||typeof r.calculatedAt!=='string'||!Number.isFinite(Date.parse(r.calculatedAt)))throw new Error('Invalid physical run');
  for(const key of ['measured','standard','expanded','coverage'])if(typeof r[key]!=='number'||!Number.isFinite(r[key]))throw new Error('Invalid physical result');
  if((r.standard as number)<0||(r.expanded as number)<0||(r.coverage as number)<=0)throw new Error('Invalid physical result');
  for(const key of ['engine','engineVersion'])if(typeof r[key]!=='string'||!r[key].trim()||r[key].length>100)throw new Error('Invalid engine');
  return {kind:r.kind as PhysicalKind,modelVersion:1,inputKey:r.inputKey,calculatedAt:r.calculatedAt,measured:r.measured as number,standard:r.standard as number,expanded:r.expanded as number,coverage:r.coverage as number,engine:r.engine as string,engineVersion:r.engineVersion as string};
}
export function validatePhysicalRun(run:PhysicalRun,kind:PhysicalKind,data:DensityData|WeighingData,identity:ProjectIdentity){
  readPhysicalRun(run);
  if(run.kind!==kind||run.inputKey!==physicalKey(data,identity))throw new Error('Stale physical run');
  const {expected}=preparePhysical(kind,data);
  for(const field of ['measured','standard','expanded','coverage'] as const){const a=run[field],b=expected[field];if(Math.abs(a-b)>1e-10*Math.max(Math.abs(b),1e-100))throw new Error('Engine/reference mismatch');}
  return run;
}
export async function calculatePhysicalOnServer(kind:PhysicalKind,data:DensityData|WeighingData,identity:ProjectIdentity,signal:AbortSignal){
  const {request}=preparePhysical(kind,data);
  const response=await customerFetch(apiUrl('/uncertainty/budget'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const raw=await response.json();
  const run=readPhysicalRun({kind,modelVersion:1,inputKey:physicalKey(data,identity),calculatedAt:new Date().toISOString(),measured:raw?.measured,standard:raw?.standard_uncertainty,expanded:raw?.expanded_uncertainty,coverage:raw?.coverage,engine:raw?.engine,engineVersion:raw?.engine_version});
  return validatePhysicalRun(run,kind,data,identity);
}
