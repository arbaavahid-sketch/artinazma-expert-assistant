'use client';
import {usePDFExport} from './use-pdf-export';
import {useEffect,useRef,useState} from 'react';
import {apiUrl,customerFetch} from '@/lib/api';
import {calculateDilution,type DilutionPlan} from './dilution-plan';
import {type LabelMaterial} from './dilution-print';
import s from './preview.module.css';
export default function DilutionPDFButton({plan,material,en,ready}:{plan:DilutionPlan;material:LabelMaterial;en:boolean;ready:boolean}){
 const {savePDF,notice,clearNotice}=usePDFExport(en);
 const [busy,setBusy]=useState(false),[error,setError]=useState(false);const controller=useRef<AbortController|null>(null);const key=JSON.stringify({plan,material,en,ready}),latest=useRef(key);useEffect(()=>{latest.current=key;return()=>controller.current?.abort();},[key]);
 async function download(){const abort=new AbortController();controller.current?.abort();controller.current=abort;const timer=setTimeout(()=>abort.abort(),20000);setBusy(true);setError(false);clearNotice();try{if(!ready||!plan.label?.solutionId.trim())throw Error();const rows=calculateDilution(plan);const response=await customerFetch(apiUrl('/uncertainty/dilution-report.pdf'),{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify({locale:en?'en':'fa',plan,material,expectedAliquots:rows.map(r=>r.aliquotML)})});if(!response.ok||!response.headers.get('content-type')?.includes('application/pdf'))throw Error();const blob=await response.blob();if(blob.size>5*1024*1024||await blob.slice(0,5).text()!=='%PDF-')throw Error();if(abort.signal.aborted||latest.current!==key)return;clearTimeout(timer);await savePDF(blob,`artin-dilution-${en?'en':'fa'}.pdf`);}catch{if(latest.current===key&&controller.current===abort)setError(true);}finally{clearTimeout(timer);if(controller.current===abort)setBusy(false);}}
 return <><button className={s.secondary} type="button" disabled={busy||!ready||!plan.label?.solutionId.trim()} onClick={()=>void download()}>{busy?(en?'Preparing PDF…':'در حال ساخت PDF…'):(en?'Download instructions and labels PDF':'دانلود PDF دستور و برچسب')}</button>{notice}{error&&<p role="alert">{en?'PDF generation failed; review the inputs and connection.':'PDF ساخته نشد؛ ورودی‌ها و اتصال را بررسی کنید.'}</p>}</>;
}
