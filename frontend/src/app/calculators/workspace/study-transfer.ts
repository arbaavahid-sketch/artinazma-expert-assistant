import {readPrecisionStudy,calculatePrecisionStudy,type PrecisionStudy} from './precision-study';
import {readIntermediateStudy,calculateIntermediateStudy,type IntermediateStudy} from './intermediate-study';
import {readCalibrationStudy,calculateCalibrationStudy,type CalibrationStudy} from './calibration-study';
import {readBiasStudy,calculateBiasStudy,type BiasStudy} from './bias-study';
import {readControlStudy,calculateControlStudy,type ControlStudy} from './control-study';
import {numeric,gcInputKey,prepareGCBudget,type GCData} from './gc-workflow';
import {reportFontCSS} from '@/lib/report-font';

export type TransferSources={precisionStudy?:PrecisionStudy;intermediateStudy?:IntermediateStudy;calibrationStudy?:CalibrationStudy;biasStudy?:BiasStudy;controlStudy?:ControlStudy};
export type TransferPlan={precision:'none'|'repeatability'|'intermediate';repetitions:string;calibration:boolean;overlapNote:string;applicabilityNote:string;biasDecision:string;controlDecision:string;reviewed:boolean};
export type TransferIdentity={title:string;sample:string;sop:string;edition:string;matrix:string};
const emptyIdentity:TransferIdentity={title:'',sample:'',sop:'',edition:'',matrix:''};
function readIdentity(raw:unknown):TransferIdentity{const v=raw as TransferIdentity;if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid target identity');return Object.fromEntries(Object.keys(emptyIdentity).map(k=>{const key=k as keyof TransferIdentity;if(typeof v[key]!=='string'||v[key].length>2000)throw Error('Invalid target identity');return [key,v[key]];})) as TransferIdentity;}
export type StudyTransfer={version:1;identity:TransferIdentity;at:string;plan:TransferPlan;sources:TransferSources;inputKey:string};
export const transferPrecisionId='validation-method-precision';
export function emptyTransferPlan():TransferPlan{return {precision:'none',repetitions:'1',calibration:false,overlapNote:'',applicabilityNote:'',biasDecision:'',controlDecision:'',reviewed:false};}
export function readStudyTransfer(raw:unknown):StudyTransfer{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid transfer');const d=raw as StudyTransfer,p=d.plan;
 if(d.version!==1||typeof d.at!=='string'||d.at.length>50||!Number.isFinite(Date.parse(d.at))||typeof d.inputKey!=='string'||d.inputKey.length>600000||!p||!['none','repeatability','intermediate'].includes(p.precision)||typeof p.calibration!=='boolean'||p.reviewed!==true)throw Error('Invalid transfer review');
 for(const k of ['repetitions','overlapNote','applicabilityNote','biasDecision','controlDecision'] as const)if(typeof p[k]!=='string'||p[k].length>(k==='repetitions'?200:2000))throw Error('Invalid transfer text');
 const s=d.sources;if(!s||typeof s!=='object'||Array.isArray(s))throw Error('Invalid transfer sources');
 const sources:TransferSources={...(s.precisionStudy!==undefined?{precisionStudy:readPrecisionStudy(s.precisionStudy)}:{}),...(s.intermediateStudy!==undefined?{intermediateStudy:readIntermediateStudy(s.intermediateStudy)}:{}),...(s.calibrationStudy!==undefined?{calibrationStudy:readCalibrationStudy(s.calibrationStudy)}:{}),...(s.biasStudy!==undefined?{biasStudy:readBiasStudy(s.biasStudy)}:{}),...(s.controlStudy!==undefined?{controlStudy:readControlStudy(s.controlStudy)}:{})};
 return {version:1,identity:readIdentity(d.identity===undefined?emptyIdentity:d.identity),at:d.at,inputKey:d.inputKey,plan:{precision:p.precision,repetitions:p.repetitions,calibration:p.calibration,overlapNote:p.overlapNote,applicabilityNote:p.applicabilityNote,biasDecision:p.biasDecision,controlDecision:p.controlDecision,reviewed:true},sources};
}
export function transferProposal(s:TransferSources,p:TransferPlan,rows:string[][],data:GCData,at:string,identity:TransferIdentity=emptyIdentity){
 if(!p.reviewed||!p.applicabilityNote.trim()||!p.overlapNote.trim()||p.precision==='none'&&!p.calibration||!Number.isFinite(Date.parse(at)))throw Error('Explicit transfer review required');
 if(s.biasStudy){calculateBiasStudy(s.biasStudy);if(!p.biasDecision.trim())throw Error('Bias disposition required');}
 if(s.controlStudy){calculateControlStudy(s.controlStudy);if(!p.controlDecision.trim())throw Error('Control disposition required');}
 let nextRows=structuredClone(rows);const next=structuredClone(data);const sources:TransferSources={};
 if(s.biasStudy)sources.biasStudy=readBiasStudy(s.biasStudy);if(s.controlStudy)sources.controlStudy=readControlStudy(s.controlStudy);
 if(p.calibration){
  if(!s.calibrationStudy)throw Error('Calibration study required');const c=readCalibrationStudy(s.calibrationStudy),r=calculateCalibrationStudy(c);
  if(c.xUnit.trim()!=='mg/L'||c.yUnit.trim()!=='area'||c.rows.length>20||r.slope<=0||c.rows.some(row=>numeric(row.x)<0))throw Error('GC calibration needs mg/L, area, positive slope and 3–20 nonnegative levels');
  nextRows=c.rows.map(row=>[row.x,row.y]);sources.calibrationStudy=c;
 }
 const previous=next.additional??[];
 if(p.precision!=='none'){
  if(previous.some(item=>item.preset==='methodPrecision'&&item.id!==transferPrecisionId))throw Error('Existing method precision must be reviewed and removed first');
  let spread:number,title:string,source:string;
  if(p.precision==='repeatability'){
   if(!s.precisionStudy)throw Error('Repeatability required');const study=readPrecisionStudy(s.precisionStudy),r=calculatePrecisionStudy(study),n=numeric(p.repetitions);
   if(study.scope!=='whole-method'||study.unit.trim()!=='mg/kg'||!Number.isInteger(n)||n<1||n>1000000)throw Error('Whole-method mg/kg study and independent result count required');
   spread=r.s/Math.sqrt(n);title=study.title;source=study.source;sources.precisionStudy=study;
  }else{
   if(!s.intermediateStudy)throw Error('Intermediate study required');const study=readIntermediateStudy(s.intermediateStudy),r=calculateIntermediateStudy(study);
   if(study.scope!=='whole-method'||study.unit.trim()!=='mg/kg'||numeric(p.repetitions)!==1)throw Error('Intermediate precision transfers only to a single result in mg/kg');
   spread=r.intermediateSD;title=study.title;source=study.source;sources.intermediateStudy=study;
  }
  if(!Number.isFinite(spread)||spread<=0)throw Error('Positive studied spread required');
  const description=`Study transfer v1 · ${title} · ${at}; raw study/source and review: validationTransfer in project JSON`;
  if(!source.trim())throw Error('Source required');
  next.additional=[...previous.filter(item=>item.id!==transferPrecisionId),{id:transferPrecisionId,preset:'methodPrecision',name:title,target:'result',basis:'absolute',value:String(spread),kind:'standard',divisor:'',source:description,overlapNote:p.overlapNote,independent:true}];
 }else if(previous.some(item=>item.id===transferPrecisionId))throw Error('Remove the previous transferred precision explicitly first');
 // Base input uncertainties remain explicit. None is silently set to zero or removed.
 prepareGCBudget(nextRows,next);
 const transfer=readStudyTransfer({version:1,identity:readIdentity(identity),at,plan:p,sources,inputKey:gcInputKey(nextRows,next)});
 return {rows:nextRows,data:next,transfer};
}
export function transferIsCurrent(t:StudyTransfer,rows:string[][],data:GCData,identity:TransferIdentity=emptyIdentity){
 try{const d=readStudyTransfer(t);if(JSON.stringify(d.identity)!==JSON.stringify(readIdentity(identity)))return false;if(d.inputKey!==gcInputKey(rows,data))return false;
 const rebuilt=transferProposal(d.sources,d.plan,rows,data,d.at,identity);return rebuilt.transfer.inputKey===d.inputKey;
 }catch{return false;}
}
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function buildTransferReport(t:StudyTransfer,rows:string[][],data:GCData,en:boolean,identity:TransferIdentity=emptyIdentity){
 if(!transferIsCurrent(t,rows,data,identity))throw Error('Stale transfer');const d=readStudyTransfer(t),x=prepareGCBudget(rows,data),text=(fa:string,eng:string)=>en?eng:fa;
 return `<!doctype html><html lang="${en?'en':'fa'}" dir="${en?'ltr':'rtl'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"><style>${reportFontCSS}body{font-family:Vazir,Tahoma,sans-serif;max-width:950px;padding:24px;margin:auto;line-height:1.9;color:#172d3d}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbcbd4;padding:8px;text-align:start}@media print{@page{size:A4;margin:15mm}}</style><title>ARTIN - GUM transfer</title></head><body><h1>${text('بازبینی انتقال مطالعه به GUM','Study-to-GUM transfer review')}</h1><p>ARTIN LAB · v1 · <bdi>${esc(d.at)}</bdi></p><p>${text('وضعیت: تطبیق با ورودی فعلی؛ نتیجهٔ نهایی باید از موتور محاسبه شود.','Status: matches current inputs; calculate the final budget using the engine.')}</p><p>${esc(d.plan.applicabilityNote)}</p><h2>${text('بررسی هم‌پوشانی','Overlap review')}</h2><p>${esc(d.plan.overlapNote)}</p><p>${text('تصمیم بایاس','Bias disposition')}: ${esc(d.plan.biasDecision)}</p><p>${text('تصمیم کنترل','Control disposition')}: ${esc(d.plan.controlDecision)}</p><p>${text('این سند، پذیرش روش یا ادعای نبود هم‌پوشانی نیست؛ تصمیم و استقلال را بازبین ثبت کرده است. بایاس و حدود کنترل به مؤلفهٔ عددی تبدیل نشده‌اند. فرض پوشش k یا درجهٔ آزادی جدید از این انتقال ساخته نمی‌شود.','This records the reviewer’s applicability, independence and overlap decisions; it does not establish method acceptance. Bias and control limits are not converted into numeric uncertainty components. The transfer does not invent a coverage factor or new degrees of freedom.')}</p><table><thead><tr><th>${text('مؤلفه','Component')}</th><th>u</th><th>c</th></tr></thead><tbody>${x.request.components.map(c=>`<tr><td>${esc(c.name)}</td><td dir="ltr">${esc(c.value)}</td><td dir="ltr">${esc(c.sensitivity)}</td></tr>`).join('')}</tbody></table><p>${text('در جدول، مقدار استاندارد برای نوع standard و مقدار خام برای سایر انواع است؛ نوع توزیع و مقسوم‌علیه در دادهٔ کامل زیر ثبت‌اند.','Values are standard u for kind standard and raw input values for other kinds; distributions and divisors are recorded below.')}</p><h2>${text('نسخهٔ کامل داده، منابع، طرح و بودجهٔ مقصد','Complete raw sources, study design and destination inputs')}</h2><pre dir="ltr">${esc(JSON.stringify({transfer:d,rows,data,request:x.request},null,2))}</pre><p><a href="https://www.bipm.org/documents/20126/2071204/JCGM_100_2008_E.pdf">JCGM 100:2008 · 4.2, 5.1–5.2</a></p></body></html>`;
}
