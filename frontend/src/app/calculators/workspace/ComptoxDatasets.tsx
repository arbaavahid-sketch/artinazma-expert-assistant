'use client';
import {useEffect,useState} from 'react';
import LaboratoryReferenceLink from '@/components/LaboratoryReferenceLink';
import s from './preview.module.css';

const sections = {
 hazard: ['سمیت','Toxicity','hazard'],
 exposure: ['پایش مواجهه','Exposure monitoring','exposure'],
 predictions: ['پیش‌بینی مدل‌ها','Model predictions','chemical'],
} as const;
const headings: Record<string,[string,string]> = {
 toxvalType:['شاخص سمیت','Endpoint'],qualifier:['علامت مقدار','Qualifier'],toxvalNumeric:['مقدار','Value'],toxvalUnits:['واحد','Unit'],
 speciesCommon:['گونه','Species'],exposureRoute:['مسیر مواجهه','Exposure route'],studyDurationValue:['مدت مطالعه','Study duration'],studyDurationUnits:['واحد مدت','Duration unit'],source:['منبع','Source'],subsource:['زیرمنبع','Subsource'],year:['سال','Year'],doi:['DOI','DOI'],
 nhanesCohort:['دورهٔ NHANES','NHANES cohort'],demographic:['گروه جمعیتی','Demographic'],median:['میانه','Median'],lowerBound:['کران پایین','Lower bound'],upperBound:['کران بالا','Upper bound'],unit:['واحد','Unit'],units:['واحد','Units'],
 propName:['ویژگی','Property'],propValue:['مقدار پیش‌بینی','Predicted value'],propValueString:['نتیجهٔ متنی','Text result'],propUnit:['واحد','Unit'],modelName:['مدل','Model'],sourceName:['منبع و نسخه','Source and version'],adConclusion:['دامنهٔ کاربرد مدل','Applicability domain'],adReasoning:['توضیح دامنه','Applicability rationale'],propValueError:['پیام مدل','Model message'],
};
type Section=keyof typeof sections;
type Data={rows:Record<string,string|number>[];total:number;fetchedAt:string};

export default function ComptoxDatasets({id,en}:{id:string;en:boolean}){
 const [section,setSection]=useState<Section>();
 const [records,setRecords]=useState<Partial<Record<Section,Data>>>({});
 const [error,setError]=useState(false);
 const [retry,setRetry]=useState(0);
 const [page,setPage]=useState(0);
 const data=section?records[section]:undefined;
 const t=(fa:string,english:string)=>en?english:fa;
 useEffect(()=>{
  if(!section||data)return;
  const controller=new AbortController();
  fetch('/api/chemicals/comptox?'+new URLSearchParams({dtxsid:id,section}),{signal:controller.signal})
   .then(async response=>{
    if(!response.ok)throw Error();
    const result=await response.json();
    if(result.id!==id||result.section!==section||!Array.isArray(result.rows))throw Error();
    if(!controller.signal.aborted)setRecords(previous=>({...previous,[section]:result}));
   }).catch(()=>{if(!controller.signal.aborted)setError(true);});
  return ()=>controller.abort();
 },[id,section,data,retry]);
 const visible=data?.rows.slice(page*10,page*10+10)??[];
 const columns=Object.keys(headings).filter(key=>visible.some(row=>key in row));
 return <section className={s.solutionPanel} aria-label={t('داده‌های مرجع EPA','EPA reference datasets')}>
  <h3>{t('داده‌های مرجع EPA','EPA reference datasets')}</h3>
  <div className={s.referencePaging}>{(Object.keys(sections) as Section[]).map(key=><button type="button" key={key} aria-pressed={section===key} onClick={()=>{setSection(section===key?undefined:key);setPage(0);setError(false);setRetry(0);}}>{sections[key][en?1:0]}</button>)}</div>
  {section&&<>
   <p className={s.muted}>{section==='hazard'?t('مقادیر ToxValDB با گونه و مسیر مواجههٔ مطالعه نمایش داده می‌شوند.','ToxValDB values are shown with the study species and exposure route.'):section==='exposure'?t('داده‌های پایش جمعیت. واحدهایی که EPA در پاسخ ارائه نکرده، نامشخص‌اند.','Population monitoring data. Units omitted by EPA are unspecified.'):t('این مقادیر برآورد مدل‌اند. ستون دامنهٔ کاربرد نشان می‌دهد مدل برای این رکورد چه ارزیابی‌ای گزارش کرده است.','These are model estimates. The applicability column reports the model’s assessment for this record.')}</p>
   {error?<p role="alert">{t('دریافت این بخش از EPA انجام نشد.','Could not retrieve this dataset from EPA.')} <button type="button" onClick={()=>{setError(false);setRetry(n=>n+1);}}>{t('تلاش دوباره','Retry')}</button></p>:!data?<p role="status">{t('در حال دریافت…','Loading…')}</p>:!visible.length?<p role="status">{t('EPA برای این شناسه در این بخش رکوردی برنگرداند.','EPA returned no records in this dataset for this identifier.')}</p>:<>
    <div className={s.tableScroll} role="region" aria-label={sections[section][en?1:0]} tabIndex={0}><table className={s.precisionAnova}><thead><tr>{columns.map(key=><th scope="col" key={key}>{headings[key][en?1:0]}</th>)}</tr></thead><tbody>{visible.map((row,index)=><tr key={index}>{columns.map(key=><td key={key}><bdi>{row[key]??'—'}</bdi></td>)}</tr>)}</tbody></table></div>
    <div className={s.referencePaging}><button type="button" disabled={!page} onClick={()=>setPage(p=>p-1)}>{t('قبلی','Previous')}</button><span>{page+1} / {Math.ceil(data.rows.length/10)}</span><button type="button" disabled={(page+1)*10>=data.rows.length} onClick={()=>setPage(p=>p+1)}>{t('بعدی','Next')}</button></div>
    {data.total>data.rows.length&&<p>{t(`نمایش ${data.rows.length} رکورد از ${data.total} رکورد EPA`,`Showing ${data.rows.length} of ${data.total} EPA records`)}</p>}
   </>}
   {data&&<p className={s.muted}>{t('زمان دریافت','Retrieved')} · {new Date(data.fetchedAt).toLocaleString(en?'en':'fa-IR',{timeZone:'Asia/Tehran'})}</p>}
   <p><a href={`https://comptox.epa.gov/ctx-api/docs/${sections[section][2]}.html`} target="_blank" rel="noreferrer">{t('مستندات منبع EPA ↗','EPA dataset documentation ↗')}</a>{section==='exposure'&&<> · <LaboratoryReferenceLink href="/calculators?section=materials&material=occupational">{t('مرجع مواجههٔ شغلی NIOSH','NIOSH occupational reference')}</LaboratoryReferenceLink></>}</p>
  </>}
 </section>;
}
