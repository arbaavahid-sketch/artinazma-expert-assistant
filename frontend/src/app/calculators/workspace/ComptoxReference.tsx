'use client';
import {useTextExport} from './use-text-export';
import {useEffect,useRef,useState} from 'react';
import s from './preview.module.css';
import ComptoxDatasets from './ComptoxDatasets';
type RecordData={id:string;name:string;cas:string|null;dtxcid:string|null;smiles:string|null;source:string;sourceUrl:string;fetchedAt:string;sourceUpdatedAt:null;sourceVersion:null;adapterVersion:string;scope:string;structuralMatch:'unverified'};
export default function ComptoxReference({en,initialId=''}:{en:boolean;initialId?:string}){
 const textExport=useTextExport(en);
 const t=(fa:string,e:string)=>en?e:fa;
 const [configured,setConfigured]=useState<boolean>(),[id,setId]=useState(initialId),[record,setRecord]=useState<RecordData>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [statusRetry,setStatusRetry]=useState(0),[statusFailed,setStatusFailed]=useState(false);
 const active=useRef<AbortController|null>(null);
 useEffect(()=>{const c=new AbortController();setStatusFailed(false);fetch('/api/chemicals/comptox',{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(c.signal.aborted)return;if(typeof d.configured!=='boolean')throw Error();setConfigured(d.configured);}).catch(()=>{if(!c.signal.aborted)setStatusFailed(true);});return()=>{c.abort();active.current?.abort();};},[statusRetry]);
 const valid=/^DTXSID[0-9]{7,10}$/i.test(id.trim());
 async function load(){if(!valid||busy)return;active.current?.abort();const c=new AbortController();active.current=c;const requested=id.trim().toUpperCase();setBusy(true);setError('');setRecord(undefined);
  try{const r=await fetch('/api/chemicals/comptox?'+new URLSearchParams({dtxsid:requested}),{signal:c.signal});if(!r.ok)throw Error(String(r.status));const d=await r.json();if(c.signal.aborted)return;if(d.id!==requested||d.scope!=='explicit_dtxsid_identity'||!d.fetchedAt)throw Error();setRecord(d);}
  catch(e){if(!c.signal.aborted)setError(e instanceof Error&&e.message==='503'?'key':e instanceof Error&&e.message==='429'?'busy':e instanceof Error&&e.message==='404'?'missing':'unavailable');}
  finally{if(!c.signal.aborted)setBusy(false);}
 }
 useEffect(()=>{if(configured&&initialId&&/^DTXSID[0-9]{7,10}$/i.test(initialId))void load();},[configured,initialId]); // eslint-disable-line react-hooks/exhaustive-deps
 function edit(value:string){active.current?.abort();setBusy(false);setRecord(undefined);setError('');setId(value);}
 async function download(){if(!record)return;await textExport.save(JSON.stringify(record,null,2),`artin-${record.id}.json`,'json');}
 return <section aria-label={t('مرجع CompTox','CompTox reference')}><h2>{t('CompTox؛ شناسهٔ ماده در EPA','CompTox · EPA substance identity')}</h2>
 <p className={s.muted}>{t('شناسهٔ DTXSID را وارد کنید تا رکورد ماده و بخش‌های دادهٔ EPA باز شوند.','Enter a DTXSID to open the substance record and its EPA datasets.')}</p>
 <div className={s.solutionPanel} role="status">{configured===false?t('اتصال زنده فعال نیست؛ کلید CompTox هنوز روی سرور تنظیم نشده است.','Live connection is inactive; the CompTox key is not configured on the server.'):configured===true?t('کلید روی سرور تنظیم شده است؛ پاسخ‌گویی منبع با دریافت رکورد مشخص می‌شود.','A server key is configured; retrieving a record will check source availability.'):statusFailed?t('وضعیت اتصال مشخص نشد.','Connection status could not be checked.'):t('در حال بررسی وضعیت اتصال…','Checking connection status…')}</div>
 {statusFailed&&<button type="button" className={s.secondary} onClick={()=>setStatusRetry(v=>v+1)}>{t('بررسی دوبارهٔ اتصال','Check connection again')}</button>}
 {configured===false&&<p>{t('کلید شخصی را باید از EPA دریافت و در تنظیمات سرور ثبت کرد. در این صفحه کلید وارد نمی‌شود.','A personal key must be obtained from EPA and configured on the server. This page does not collect keys.')} <a href="https://www.epa.gov/comptox-tools/computational-toxicology-and-exposure-apis-about" target="_blank" rel="noreferrer">{t('راهنمای رسمی دریافت کلید ↗','Official API key instructions ↗')}</a></p>}
 <label>DTXSID<input className="ui-input" dir="ltr" value={id} maxLength={16} placeholder="DTXSID…" onChange={e=>edit(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&configured)void load();}}/></label>
 <button type="button" className={s.primary} disabled={!configured||!valid||busy} onClick={()=>void load()}>{t('دریافت رکورد EPA','Retrieve EPA record')}</button>
 {valid&&<p><a href={`https://comptox.epa.gov/dashboard/chemical/details/${id.trim().toUpperCase()}`} target="_blank" rel="noreferrer">{t('بازکردن همین شناسه در داشبورد EPA ↗','Open this identifier in the EPA Dashboard ↗')}</a></p>}
 {busy&&<p role="status">{t('در حال دریافت از EPA…','Retrieving from EPA…')}</p>}{error&&<p role="alert">{error==='key'?t('اتصال آماده نیست؛ تنظیم یا اعتبار کلید سرور باید بررسی شود.','Connection not ready; check the server key configuration or validity.'):error==='missing'?t('رکوردی از منبع دریافت نشد؛ این نتیجه، نبود خطر را تأیید نمی‌کند.','No source record was retrieved; this does not establish absence of hazard.'):error==='busy'?t('منبع مشغول است؛ کمی بعد دوباره تلاش کنید.','Source busy; try again shortly.'):t('ارتباط با مرجع برقرار نشد؛ دوباره تلاش کنید.','The source could not be reached; try again.')}</p>}
 {record&&<article className={s.solutionPanel} aria-label={t('رکورد CompTox','CompTox record')}><h3>{record.name}</h3><dl className={s.precisionResults}>{[['DTXSID',record.id],['CAS',record.cas],['DTXCID',record.dtxcid],['SMILES',record.smiles],[t('زمان دریافت','Fetched at'),record.fetchedAt]].map(([label,value])=><div key={label}><dt>{label}</dt><dd><bdi>{value??t('ثبت نشده','Not reported')}</bdi></dd></div>)}</dl><details><summary>{t('دربارهٔ تطبیق رکورد','About record matching')}</summary><p>{t('این کارت مربوط به شناسهٔ EPA است. برای تطبیق با محصول مصرفی، شکل ماده و خلوص را از مدارک همان محصول بررسی کنید.','This card identifies the EPA record. Check the actual product documentation for its form and purity.')}</p></details><p><a href={`https://comptox.epa.gov/dashboard/chemical/details/${record.id}`} target="_blank" rel="noreferrer">US EPA · CompTox ↗</a></p><button type="button" className={s.secondary} onClick={download}>{t('دانلود رکورد و منشأ (JSON)','Download record and provenance (JSON)')}</button></article>}
 {record&&<ComptoxDatasets key={record.id} id={record.id} en={en}/>}
 {textExport.notice}</section>;
}
