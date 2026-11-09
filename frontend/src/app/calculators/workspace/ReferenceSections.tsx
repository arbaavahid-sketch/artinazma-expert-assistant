'use client';
import {useEffect,useState} from 'react';
import s from './preview.module.css';
export type ReferenceRow={heading:string;name:string;value:string;unit:string;source:string;url:string;reference:string;original?:string;sourceMissing?:boolean;kind?:'experimental'|'computed'|'predicted'|'unknown';kindBasis?:string|null;fetchedAt?:string|null;sourceUpdatedAt?:string|null};
const labels:Record<string,string>={
 'Record Description':'شرح ماده','Computed Properties':'خواص محاسباتی','Experimental Properties':'خواص تجربی',
 'Molecular Weight':'جرم مولی','Molecular Formula':'فرمول مولکولی','IUPAC Name':'نام آیوپاک',
 'Synonyms':'نام‌های دیگر','Depositor-Supplied Synonyms':'نام‌های ثبت‌شده توسط تأمین‌کنندگان',
 'Density':'چگالی','Solubility':'حلالیت','Melting Point':'نقطهٔ ذوب','Boiling Point':'نقطهٔ جوش',
 'Flash Point':'نقطهٔ اشتعال','Vapor Pressure':'فشار بخار','Vapor Density':'چگالی بخار',
 'Viscosity':'گرانروی','Color/Form':'رنگ و شکل','Odor':'بو','Physical Description':'توصیف ظاهری',
 'GHS Classification':'طبقه‌بندی GHS','Hazard Statements':'عبارت‌های خطر','Precautionary Statements':'عبارت‌های احتیاطی',
 'First Aid Measures':'کمک‌های اولیه','Fire Fighting Measures':'اقدامات اطفای حریق',
 'Handling and Storage':'کاربری و نگهداری','CAS':'شمارهٔ CAS','Related Compounds':'ترکیبات مرتبط',
 'Chemical Safety':'ایمنی شیمیایی','Safety and Hazard Properties':'خواص ایمنی و خطرات',
 'Related CAS':'شماره‌های CAS مرتبط','European Community (EC) Number':'شمارهٔ جامعهٔ اروپا',
 'UN Number':'شمارهٔ سازمان ملل','UNII':'شناسهٔ یکتای ماده','UN Globally Harmonized System of Classification and Labelling of Chemicals (GHS)':'سامانهٔ هماهنگ جهانی طبقه‌بندی و برچسب‌گذاری مواد شیمیایی',
 'Other Identifiers':'شناسه‌های دیگر','Chemical Vendors':'فروشندگان مواد شیمیایی',
 'Appearance':'ظاهر','pH':'پی‌اچ','Decomposition':'تجزیه','Stability/Shelf Life':'پایداری و عمر نگهداری',
 'Autoignition Temperature':'دمای خوداشتعالی','Explosive Limits and Potential':'حدود و احتمال انفجار',
 'Corrosivity':'خورندگی','Surface Tension':'کشش سطحی','Refractive Index':'ضریب شکست',
 'LogP':'ضریب تقسیم لگاریتمی','Dissociation Constants':'ثابت‌های تفکیک','Heat of Combustion':'گرمای احتراق',
 'Heat of Vaporization':'گرمای تبخیر','Fire Hazards':'خطرات آتش‌سوزی','Health Hazards':'خطرات سلامت',
 'Hazard Classes and Categories':'رده‌ها و دسته‌های خطر','Hazardous Reactivities and Incompatibilities':'واکنش‌پذیری خطرناک و ناسازگاری‌ها',
 'Fire Potential':'احتمال آتش‌سوزی','NFPA Hazard Classification':'طبقه‌بندی خطر NFPA',
 'Hazards Summary':'خلاصهٔ خطرات','Protective Equipment and Clothing':'تجهیزات و پوشش حفاظتی',
};
const translations=new Map<string,string[]>();
const headingTranslations=new Map<string,string>();
function Page({rows,en}:{rows:ReferenceRow[];en:boolean}){
 const [translated,setTranslated]=useState<string[]>(),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const key=JSON.stringify(rows.map(r=>`${r.name}: ${r.value}`));
 useEffect(()=>{
  if(en)return;const cached=translations.get(key);if(cached){setTranslated(cached);return;}
  const controller=new AbortController();setError(false);setTranslated(undefined);
  fetch('/api/chemicals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texts:JSON.parse(key)}),signal:controller.signal})
   .then(async r=>{if(!r.ok)throw new Error();const data=await r.json();if(!Array.isArray(data.translations)||data.translations.length!==rows.length)throw new Error();return data.translations as string[];})
   .then(values=>{if(controller.signal.aborted)return;if(translations.size>=128)translations.delete(translations.keys().next().value!);translations.set(key,values);setTranslated(values);})
   .catch(()=>{if(!controller.signal.aborted)setError(true);});
  return ()=>controller.abort();
 },[key,en,retry,rows.length]);
 return <>{!en&&!translated&&!error&&<p role="status">در حال ترجمهٔ فارسی این صفحه…</p>}
 {error&&<p role="alert">ترجمه دریافت نشد. متن اصلی در دسترس است. <button type="button" className={s.secondary} onClick={()=>setRetry(v=>v+1)}>تلاش دوباره</button></p>}
 {!en&&translated&&<p className={s.muted}>ترجمهٔ ماشینیِ متن منبع؛ برای بررسی عدد و شرایط، اصل متن را هم ببینید.</p>}
 {rows.map((row,i)=><div className={s.annotation} key={i}><span>{en?row.name:labels[row.name]??'دادهٔ مرجع'}</span>
 <small>{en?({experimental:'Experimental (source section)',computed:'Computed (source section)',predicted:'Predicted (source section)',unknown:'Data type not stated'}[row.kind??'unknown']):({experimental:'تجربی، بر اساس بخش منبع',computed:'محاسباتی، بر اساس بخش منبع',predicted:'پیش‌بینی‌شده، بر اساس بخش منبع',unknown:'نوع داده در منبع مشخص نشده'}[row.kind??'unknown'])}</small>
 {row.fetchedAt&&<small>{en?'Originally fetched: ':'دریافت اصلی: '}<bdi>{row.fetchedAt}</bdi></small>}
 {!en&&translated?.[i]&&<p dir="rtl">{translated[i]} {row.unit&&<bdi>{row.unit}</bdi>}</p>}
 {en?<p dir="auto">{row.value} <bdi>{row.unit}</bdi></p>:<details open={error||undefined}><summary>متن اصلی و واحد</summary><p dir="auto">{row.value} <bdi>{row.unit}</bdi></p></details>}
 {row.original&&<details><summary>{en?'Complete original text and conditions':'متن کامل اصلی و شرایط'}</summary><p dir="auto">{row.original} <bdi>{row.unit}</bdi></p></details>}
 {row.sourceMissing&&<small>{en?'No independent data provider is specified for this entry.':'برای این رکورد تأمین‌کنندهٔ مستقل داده ذکر نشده است.'}</small>}
 <a href={row.url} target="_blank" rel="noreferrer">{row.source} ↗</a>{row.reference&&<small dir="ltr">{row.reference}</small>}</div>)}</>;
}
function Group({heading,rows,en,title}:{heading:string;rows:ReferenceRow[];en:boolean;title?:string}){
 const [open,setOpen]=useState(false),[page,setPage]=useState(0),name=heading.split(' / ').at(-1)!;
 return <details className={s.referenceGroup} onToggle={e=>setOpen(e.currentTarget.open)}><summary>{en?name:title??labels[name]??'اطلاعات تکمیلی'} <small>({rows.length})</small></summary>
 {open&&<><Page key={page} rows={rows.slice(page*2,page*2+2)} en={en}/>{rows.length>2&&<div className={s.referencePaging}><button type="button" disabled={!page} onClick={()=>setPage(p=>p-1)}>{en?'Previous':'قبلی'}</button><span>{page+1} / {Math.ceil(rows.length/2)}</span><button type="button" disabled={(page+1)*2>=rows.length} onClick={()=>setPage(p=>p+1)}>{en?'Next':'بعدی'}</button></div>}</>}
 </details>;
}
export default function ReferenceSections({rows,en}:{rows:ReferenceRow[];en:boolean}){
 const [filter,setFilter]=useState(''),[page,setPage]=useState(0);
 const [translatedLabels,setTranslatedLabels]=useState<Record<string,string>>(()=>Object.fromEntries(headingTranslations));
 const groups=Array.from(new Set(rows.map(r=>r.heading))).filter(h=>(h+' '+(translatedLabels[h.split(' / ').at(-1)!]??labels[h.split(' / ').at(-1)!]??'')).toLowerCase().includes(filter.toLowerCase()));
 const missingKey=JSON.stringify(groups.slice(page*8,page*8+8).map(h=>h.split(' / ').at(-1)!));
 useEffect(()=>{if(en)return;const missing:string[]=(JSON.parse(missingKey) as string[]).filter(name=>!labels[name]&&!headingTranslations.has(name));if(!missing.length)return;const controller=new AbortController();
  void (async()=>{for(let i=0;i<missing.length;i+=4){const batch=missing.slice(i,i+4);try{const r=await fetch('/api/chemicals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texts:batch}),signal:controller.signal});if(!r.ok)break;const data=await r.json();if(controller.signal.aborted)return;if(data.translations?.length===batch.length){batch.forEach((name,j)=>headingTranslations.set(name,data.translations[j]));while(headingTranslations.size>256)headingTranslations.delete(headingTranslations.keys().next().value!);setTranslatedLabels(old=>({...old,...Object.fromEntries(batch.map((name,j)=>[name,data.translations[j]]))}));}}catch{return;}}})();return ()=>controller.abort();
 },[missingKey,en]);
 return <div className={s.annotationSections}><label>{en?'Find a property or section':'پیداکردن خاصیت یا بخش'}<input className="ui-input" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}/></label>
 <p className={s.muted}>{en?'These are attributed reference records, not product measurements. Temperature, pressure, phase and experimental or computed status must be checked in the original text. Unstated conditions are unknown; conflicting entries remain separate. Values are not transferred automatically to preparation calculations.':'این‌ها رکوردهای مرجع با انتساب منبع‌اند، نه اندازه‌گیری محصول مصرفی. دما، فشار، فاز و تجربی یا محاسباتی‌بودن را در متن اصلی بررسی کنید. شرایط ذکرنشده نامشخص‌اند؛ رکوردهای متفاوت جدا می‌مانند و خودکار به محاسبهٔ تهیه منتقل نمی‌شوند.'}</p>
 <p className={s.muted}>{en?'Open a section to read it; up to two records per page.':'بخش موردنیاز را باز کنید؛ در هر صفحه حداکثر دو رکورد نمایش داده می‌شود.'}</p>
 {groups.slice(page*8,page*8+8).map(h=><Group key={h} heading={h} title={translatedLabels[h.split(' / ').at(-1)!]} rows={rows.filter(r=>r.heading===h)} en={en}/>)}
 {!groups.length&&<p>{en?'No matching sections.':'بخش مطابقی پیدا نشد.'}</p>}
 {groups.length>8&&<div className={s.referencePaging}><button type="button" disabled={!page} onClick={()=>setPage(p=>p-1)}>{en?'Previous sections':'بخش‌های قبلی'}</button><span>{page+1} / {Math.ceil(groups.length/8)}</span><button type="button" disabled={(page+1)*8>=groups.length} onClick={()=>setPage(p=>p+1)}>{en?'Next sections':'بخش‌های بعدی'}</button></div>}
 </div>;
}
