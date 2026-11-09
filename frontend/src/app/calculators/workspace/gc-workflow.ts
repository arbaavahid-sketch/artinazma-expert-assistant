import { gcExtraction } from '../gc-model';

export const sampleKeys = ['area', 'extract', 'dilution', 'mass', 'recovery'] as const;
export type SampleKey = typeof sampleKeys[number];
export const uncertaintyKinds = ['standard', 'certificate', 'rectangular', 'triangular', 'resolution', 'repeatability'] as const;
export type UncertaintyInput = { value: string; kind: typeof uncertaintyKinds[number]; divisor: string; source: string };
export const stockKeys=['mass','purity','volume','aliquot','finalVolume'] as const;
export type StockKey=typeof stockKeys[number];
export type StockPreparation={
  dilution:boolean; independent:boolean;
  inputs:Record<StockKey,{nominal:string;uncertainty:UncertaintyInput}>;
};
export function emptyStockPreparation():StockPreparation{
  return {dilution:false,independent:false,inputs:Object.fromEntries(stockKeys.map(key=>[key,{nominal:'',uncertainty:{value:'',kind:'standard',divisor:'',source:''}}])) as StockPreparation['inputs']};
}
export const additionalPresets = ['standardScale', 'methodPrecision', 'custom'] as const;
export type GCAdditional = UncertaintyInput & {
  id: string; preset: typeof additionalPresets[number]; name: string;
  target: SampleKey | 'result'; basis: 'absolute' | 'relative';
  overlapNote: string; independent: boolean;
  preparation?:StockPreparation;
};
export function newGCAdditional(preset: GCAdditional['preset'], id: string): GCAdditional {
  return {id,preset,name:'',target:'result',basis:preset==='custom'?'absolute':'relative',
    value:'',kind:'standard',divisor:'',source:'',overlapNote:'',independent:false};
}
export type GCData = {
  values: Record<SampleKey, string>;
  uncertainties: Record<SampleKey, UncertaintyInput>;
  coverage: string; coverageSource: string;
  additional?: GCAdditional[];
};
export type GCRun = { calculatedAt: string; inputKey: string; measured: number; standard: number; expanded: number; coverage: number; engine: string; engineVersion: string };
export function emptyGCData(): GCData {
  return { values: {area:'',extract:'',dilution:'',mass:'',recovery:''},
    uncertainties: Object.fromEntries(sampleKeys.map(key=>[key,{value:'',kind:'standard',divisor:'',source:''}])) as GCData['uncertainties'],
    coverage:'2',coverageSource:'' };
}
export class GCInputError extends Error {
  constructor(public code: 'standards' | 'sample' | 'range' | 'uncertainty' | 'coverage' | 'additional') { super(code); }
}
export function numeric(text: string): number {
  const value=text.trim().replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/٫/g,'.').replace(/−/g,'-');
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) && Number.isFinite(Number(value)) ? Number(value) : NaN;
}
export function fitGC(rows: string[][]) {
  const points=rows.filter(row=>row.some(v=>v.trim())).map(row=>row.map(numeric));
  if(points.length<3 || points.some(p=>p.length!==2 || p.some(v=>!Number.isFinite(v)) || p[0]<0))throw new GCInputError('standards');
  const n=points.length, mx=points.reduce((s,p)=>s+p[0]/n,0), my=points.reduce((s,p)=>s+p[1]/n,0);
  const xx=points.reduce((s,p)=>s+(p[0]-mx)**2,0);
  const slope=points.reduce((s,p)=>s+(p[0]-mx)*(p[1]-my),0)/xx;
  const intercept=my-slope*mx;
  const residual=points.reduce((s,p)=>s+(p[1]-slope*p[0]-intercept)**2,0);
  const yy=points.reduce((s,p)=>s+(p[1]-my)**2,0);
  const se=Math.sqrt(residual/(n-2)), us=se/Math.sqrt(xx), ub=se*Math.sqrt(1/n+mx**2/xx);
  const correlation=-mx/Math.sqrt(xx/n+mx**2);
  if(![slope,intercept,us,ub,correlation].every(Number.isFinite)||slope<=0||xx<=0)throw new GCInputError('standards');
  return {points,slope,intercept,us,ub,correlation,r2:1-residual/yy,min:Math.min(...points.map(p=>p[0])),max:Math.max(...points.map(p=>p[0]))};
}
export function gcInputKey(rows: string[][], data: GCData) { return JSON.stringify({rows,data}); }
export function uncertaintyComponent(input: UncertaintyInput, scale = 1) {
  const value=numeric(input.value), divisor=numeric(input.divisor);
  if(!Number.isFinite(value)||value<0||!input.source.trim()||!uncertaintyKinds.includes(input.kind))throw new GCInputError('uncertainty');
  if(input.kind==='certificate'&&(!Number.isFinite(divisor)||divisor<=0))throw new GCInputError('uncertainty');
  if(input.kind==='repeatability'&&(!Number.isInteger(divisor)||divisor<1||divisor>1000000))throw new GCInputError('uncertainty');
  if(!Number.isFinite(value*scale)||Math.abs(value*scale)>1e100)throw new GCInputError('uncertainty');
  return {value:value*scale,kind:input.kind,...(input.kind==='certificate'?{certificate_k:divisor}:{}),...(input.kind==='repeatability'?{repetitions:divisor}:{})};
}
export function standardComponentValue(input: {value:number;kind:string;certificate_k?:number;repetitions?:number}) {
  const divisor=input.kind==='certificate'?input.certificate_k!:input.kind==='repeatability'?Math.sqrt(input.repetitions!):input.kind==='rectangular'?Math.sqrt(3):input.kind==='triangular'?Math.sqrt(6):input.kind==='resolution'?Math.sqrt(12):1;
  return input.value/divisor;
}
export function calculateStockPreparation(data:StockPreparation){
  if(!data.independent)throw new GCInputError('additional');
  const active:StockKey[]=data.dilution?[...stockKeys]:['mass','purity','volume'];
  const components=active.map(key=>{
    const input=data.inputs[key],nominal=numeric(input.nominal);
    if(!Number.isFinite(nominal)||nominal<=0||key==='purity'&&nominal>100)throw new GCInputError('additional');
    const u=standardComponentValue(uncertaintyComponent(input.uncertainty));
    return {key,nominal,u,relative:u/nominal};
  });
  const values=Object.fromEntries(components.map(c=>[c.key,c.nominal])) as Record<StockKey,number>;
  if(data.dilution&&values.aliquot>values.finalVolume)throw new GCInputError('additional');
  // mg of substance, purity in %, mL of solution: mg/L = 10 m P / V.
  const concentration=10*values.mass*values.purity/values.volume*(data.dilution?values.aliquot/values.finalVolume:1);
  const relativePercent=100*Math.hypot(...components.map(c=>c.relative));
  if(!Number.isFinite(concentration)||concentration<=0||!Number.isFinite(relativePercent))throw new GCInputError('additional');
  return {concentration,relativePercent,components};
}
export function resolvedAdditional(item:GCAdditional):UncertaintyInput{
  if(!item.preparation)return item;
  if(item.preset!=='standardScale')throw new GCInputError('additional');
  const result=calculateStockPreparation(item.preparation);
  return {...item,value:String(result.relativePercent),kind:'standard',divisor:'',
    source:result.components.map(c=>item.preparation!.inputs[c.key].uncertainty.source).join(' · ')};
}
export function prepareGCBudget(rows: string[][], data: GCData) {
  const fit=fitGC(rows);
  const v=Object.fromEntries(sampleKeys.map(key=>[key,numeric(data.values[key])])) as Record<SampleKey,number>;
  const model=gcExtraction({...v,slope:fit.slope,intercept:fit.intercept});
  if(!model.valid||v.area<0)throw new GCInputError('sample');
  const extractConcentration=(v.area-fit.intercept)/fit.slope;
  if(extractConcentration<0 || extractConcentration<fit.min || extractConcentration>fit.max)throw new GCInputError('range');
  const inputs=['area','slope','intercept','extract','dilution','mass','recovery'] as const;
  const components: (ReturnType<typeof uncertaintyComponent>&{name:string;sensitivity:number})[]=inputs.map((key,index)=>{
    if(key==='slope'||key==='intercept')return {name:key,value:key==='slope'?fit.us:fit.ub,sensitivity:model.sensitivities[index],kind:'standard' as const};
    return {name:key,sensitivity:model.sensitivities[index],...uncertaintyComponent(data.uncertainties[key])};
  });
  const additional=data.additional??[];
  if(additional.length>20 || new Set(additional.map(item=>item.id)).size!==additional.length)throw new GCInputError('additional');
  const targets=additional.map(item=>{
    if(!additionalPresets.includes(item.preset)||!['absolute','relative'].includes(item.basis)||
      !['result',...sampleKeys].includes(item.target)||!item.overlapNote.trim()||item.independent!==true||
      (item.preset==='custom'&&!item.name.trim())||
      (item.preset!=='custom'&&item.target!=='result')||
      (item.preset==='standardScale'&&item.basis!=='relative'))throw new GCInputError('additional');
    const targetIndex=item.target==='result'?-1:inputs.indexOf(item.target);
    const nominal=item.target==='result'?model.concentration:v[item.target];
    const scale=item.basis==='relative'?Math.abs(nominal)/100:1;
    // A relative contribution at zero nominal would be silently discarded.
    if(item.basis==='relative'&&nominal===0)throw new GCInputError('additional');
    components.push({name:item.preset==='custom'?item.name:item.preset,sensitivity:targetIndex===-1?1:model.sensitivities[targetIndex],...uncertaintyComponent(resolvedAdditional(item),scale)});
    return targetIndex;
  });
  const coverage=numeric(data.coverage);
  if(!Number.isFinite(coverage)||coverage<=0||coverage>1e6||!data.coverageSource.trim())throw new GCInputError('coverage');
  return {fit,request:{measured:model.concentration,coverage,coverage_mode:'manual' as const,
    measurement_model:{kind:'gcExtraction',nominals:inputs.map(key=>key==='slope'?fit.slope:key==='intercept'?fit.intercept:v[key]),...(targets.length?{additional_targets:targets}:{})},
    components,correlations:[{first:1,second:2,coefficient:fit.correlation}]}};
}
export function validatedGCRun(response: unknown, rows: string[][], data: GCData, now: string): GCRun {
  const {request}=prepareGCBudget(rows,data);
  if(!response||typeof response!=='object')throw new Error('Invalid calculation response');
  const r=response as Record<string,unknown>;
  const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
  if(!finite(r.measured)||!finite(r.standard_uncertainty)||!finite(r.expanded_uncertainty)||!finite(r.coverage)||
    r.standard_uncertainty<0||r.expanded_uncertainty<0||r.coverage!==request.coverage||
    Math.abs(r.measured-request.measured)>1e-10*Math.max(1,Math.abs(request.measured))||
    Math.abs(r.expanded_uncertainty-r.coverage*r.standard_uncertainty)>1e-10*Math.max(1,r.expanded_uncertainty)||
    typeof r.engine!=='string'||typeof r.engine_version!=='string')throw new Error('Invalid calculation response');
  return {calculatedAt:now,inputKey:gcInputKey(rows,data),measured:r.measured,standard:r.standard_uncertainty,expanded:r.expanded_uncertainty,coverage:r.coverage,engine:r.engine,engineVersion:r.engine_version};
}
