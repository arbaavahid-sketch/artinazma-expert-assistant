import {readLabProject,type ProjectIdentity} from './project-file';
import {gcInputKey,numeric,prepareGCBudget,standardComponentValue,validatedGCRun,type GCData,type GCRun} from './gc-workflow';
import {reportFontCSS} from '@/lib/report-font';

export const decisionRuleId='artin-gc-interval-v1';
export const decisionSource='https://www.bipm.org/documents/20126/2071204/JCGM_106_2012_E.pdf';
export type DecisionSnapshot={identity:ProjectIdentity;rows:string[][];data:GCData;run:GCRun};
export type DecisionStudy={version:1;rule:typeof decisionRuleId;lower:string;upper:string;specification:string;scope:string;coverageNote:string;agreement:string;reviewer:string;reviewDate:string;reviewed:boolean;snapshot?:DecisionSnapshot};
export type DecisionStatus='inside'|'outside'|'indeterminate';
export function emptyDecisionStudy():DecisionStudy{return {version:1,rule:decisionRuleId,lower:'',upper:'',specification:'',scope:'',coverageNote:'',agreement:'',reviewer:'',reviewDate:'',reviewed:false};}
const rec=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid decision record');return v as Record<string,unknown>;};
const str=(v:unknown,max=2000)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid decision text');return v;};
const near=(a:number,b:number)=>Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(a),Math.abs(b));
export function readDecisionSnapshot(raw:unknown):DecisionSnapshot{
  const d=rec(raw),p=readLabProject({format:'artin-lab-project',version:1,id:'decision-snapshot',savedAt:'2026-11-07T00:00:00Z',workflow:'gc-external-extraction',identity:d.identity,standards:d.rows,gc:{data:d.data,run:d.run},stage:4,evidence:[]});
  const run=p.gc!.run;if(!run||run.inputKey!==gcInputKey(p.standards,p.gc!.data))throw Error('Stale decision source');
  const {request}=prepareGCBudget(p.standards,p.gc!.data);
  validatedGCRun({measured:run.measured,standard_uncertainty:run.standard,expanded_uncertainty:run.expanded,coverage:run.coverage,engine:run.engine,engine_version:run.engineVersion},p.standards,p.gc!.data,run.calculatedAt);
  // Independently check the stored standard uncertainty, including covariance.
  const c=request.components.map(x=>standardComponentValue(x)*x.sensitivity),scale=Math.max(...c.map(Math.abs));
  let variance=scale===0?0:c.reduce((sum,x)=>sum+(x/scale)**2,0);
  if(scale!==0)for(const r of request.correlations)variance+=2*(c[r.first]/scale)*(c[r.second]/scale)*r.coefficient;
  const expected=scale*Math.sqrt(Math.max(0,variance));
  if(!Number.isFinite(expected)||!near(run.standard,expected))throw Error('Invalid decision uncertainty');
  return {identity:p.identity,rows:p.standards,data:p.gc!.data,run};
}
export function readDecisionStudy(raw:unknown):DecisionStudy{
  const d=rec(raw);if(d.version!==1||d.rule!==decisionRuleId||typeof d.reviewed!=='boolean')throw Error('Unsupported decision rule');
  return {version:1,rule:decisionRuleId,lower:str(d.lower,200),upper:str(d.upper,200),specification:str(d.specification),scope:str(d.scope),coverageNote:str(d.coverageNote),agreement:str(d.agreement),reviewer:str(d.reviewer,200),reviewDate:str(d.reviewDate,30),reviewed:d.reviewed,...(d.snapshot===undefined?{}:{snapshot:readDecisionSnapshot(d.snapshot)})};
}
export function intervalDecision(y:number,U:number,L?:number,H?:number){
  if(!Number.isFinite(y)||!Number.isFinite(U)||U<0||(L===undefined&&H===undefined)||L!==undefined&&!Number.isFinite(L)||H!==undefined&&!Number.isFinite(H)||L!==undefined&&H!==undefined&&L>=H)throw Error('Invalid decision limits');
  const low=y-U,high=y+U;if(!Number.isFinite(low)||!Number.isFinite(high))throw Error('Interval overflow');
  const status:DecisionStatus=(L===undefined||low>=L)&&(H===undefined||high<=H)?'inside':(L!==undefined&&high<L)||(H!==undefined&&low>H)?'outside':'indeterminate';
  return {status,low,high,L,H,y,U};
}
export function calculateDecision(raw:DecisionStudy){
  const d=readDecisionStudy(raw);
  if(!d.snapshot||!d.reviewed||[d.specification,d.scope,d.coverageNote,d.agreement,d.reviewer].some(x=>!x.trim())||!/^\d{4}-\d{2}-\d{2}$/.test(d.reviewDate)||!Number.isFinite(Date.parse(d.reviewDate))||new Date(d.reviewDate).toISOString().slice(0,10)!==d.reviewDate)throw Error('Documented review required');
  return intervalDecision(d.snapshot.run.measured,d.snapshot.run.expanded,d.lower.trim()?numeric(d.lower):undefined,d.upper.trim()?numeric(d.upper):undefined);
}
export function decisionIsCurrent(snapshot:DecisionSnapshot|undefined,current:DecisionSnapshot|undefined){return !!snapshot&&!!current&&JSON.stringify(snapshot)===JSON.stringify(current);}
export const decisionLabel=(status:DecisionStatus,en:boolean)=>en?({inside:'Conformity demonstrated under this rule',outside:'Nonconformity demonstrated under this rule',indeterminate:'Indeterminate — interval overlaps a limit'}[status]):({inside:'انطباق بر اساس این قاعده نشان داده شد',outside:'عدم‌انطباق بر اساس این قاعده نشان داده شد',indeterminate:'نامعین؛ بازه با حد مشخصات تداخل دارد'}[status]);
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function buildDecisionReport(raw:DecisionStudy,en:boolean,verified:boolean,at:string){
  if(!verified||!Number.isFinite(Date.parse(at)))throw Error('Verify current GC result first');
  const d=readDecisionStudy(raw),r=calculateDecision(d),t=(fa:string,e:string)=>en?e:fa;
  return `<!doctype html><html lang="${en?'en':'fa'}" dir="${en?'ltr':'rtl'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"><title>ARTIN LAB · Decision review</title><style>${reportFontCSS}body{font-family:Vazir,Tahoma,sans-serif;max-width:950px;margin:auto;padding:24px;line-height:1.9;color:#172e3d}p,pre{white-space:pre-wrap;overflow-wrap:anywhere}pre{font-size:11px}dt{font-weight:bold}dd{margin-bottom:12px}@media print{@page{size:A4;margin:15mm}}</style></head><body><h1>${t('بازبینی قاعدهٔ تصمیم','Decision rule review')}</h1><p>${esc(at)} · ${decisionRuleId}</p><h2>${decisionLabel(r.status,en)}</h2><p dir="ltr">y = ${r.y} mg/kg; U = ${r.U} mg/kg; k = ${d.snapshot!.run.coverage}<br>[y − U, y + U] = [${r.low}, ${r.high}] mg/kg<br>TL = [${r.L??'−∞'}, ${r.H??'+∞'}] mg/kg</p><dl>${([[t('مرجع حدود مشخصات','Specification reference'),d.specification],[t('دامنه و یکسانی واحد','Scope and unit agreement'),d.scope],[t('مبنای پوشش بازه','Interval coverage basis'),d.coverageNote],[t('مستند توافق و بررسی ریسک','Agreement and risk review'),d.agreement],[t('بازبین و تاریخ ثبت‌شده','Recorded reviewer and date'),`${d.reviewer} · ${d.reviewDate}`]]).map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl><p>${t('قاعدهٔ منتخب برنامه: بازهٔ کاملاً داخل حدود شامل مرزها، انطباق؛ بازهٔ کاملاً بیرون، عدم‌انطباق؛ سایر حالت‌ها نامعین. تماس از بیرون با مرز، نامعین است. مقایسه پیش از گردکردن انجام می‌شود.','Selected application rule: an interval wholly within inclusive limits demonstrates conformity; a wholly outside interval demonstrates nonconformity; otherwise indeterminate. Touching a boundary from outside is indeterminate. Comparisons use unrounded values.')}</p><p>${t('این بازبینی برای نتیجهٔ GC خطی GUM است. k دستی احتمال دقیق ۹۵٪ یا ریسک عددی را ثابت نمی‌کند. توافق قاعده و تناسب عدم‌قطعیت با کاربرد باید توسط آزمایشگاه تعیین شوند. ثبت نام بازبین امضای دیجیتال نیست و این خروجی گواهی تأییدشده یا ادعای انطباق کامل با ISO/ILAC نیست.','This review applies to the linear GC GUM result. Manual k does not establish exact 95% coverage or a numerical risk. The laboratory must establish rule agreement and uncertainty fitness for use. A recorded reviewer name is not a digital signature; this is not an approved certificate or a claim of full ISO/ILAC conformity.')}</p><h2>${t('شناسنامه، داده‌ها، بودجه و مستندات خام','Identity, raw data, budget and documentation')}</h2><pre dir="ltr">${esc(JSON.stringify(d,null,2))}</pre><p><a href="${decisionSource}">JCGM 106:2012 · 8.3</a> · ${t('مبنای عمومی گاردبند؛ قاعدهٔ سه‌حالته، انتخاب مستند برنامه است.','General guard-band basis; the three-state rule is the documented application choice.')}</p></body></html>`;
}
