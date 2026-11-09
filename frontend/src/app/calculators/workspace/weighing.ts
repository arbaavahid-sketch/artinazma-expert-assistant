import {numeric,uncertaintyComponent,standardComponentValue,type UncertaintyInput} from './gc-workflow';
export const weighingKeys=['calibration','resolution','repeatability'] as const;
export type WeighingData={mass:string;coverage:string;coverageSource:string;independent:boolean;components:Record<typeof weighingKeys[number],UncertaintyInput>};
export function emptyWeighing():WeighingData{return {mass:'',coverage:'2',coverageSource:'',independent:false,components:{calibration:{value:'',kind:'certificate',divisor:'',source:''},resolution:{value:'',kind:'resolution',divisor:'',source:''},repeatability:{value:'',kind:'repeatability',divisor:'1',source:''}}};}
export function calculateWeighing(data:WeighingData){
  if(data.components.calibration.kind!=='certificate'||data.components.resolution.kind!=='resolution'||data.components.repeatability.kind!=='repeatability')throw new Error('Unexpected weighing uncertainty kind');
  const mass=numeric(data.mass),k=numeric(data.coverage);
  if(!Number.isFinite(mass)||mass<=0||!Number.isFinite(k)||k<=0||!data.coverageSource.trim()||!data.independent)throw new Error('Incomplete weighing');
  const budget=weighingKeys.map(key=>({key,u:standardComponentValue(uncertaintyComponent(data.components[key]))}));
  const standard=Math.hypot(...budget.map(c=>c.u)),expanded=k*standard;
  if(!Number.isFinite(expanded))throw new Error('Invalid result');
  return {mass,standard,expanded,k,budget};
}
