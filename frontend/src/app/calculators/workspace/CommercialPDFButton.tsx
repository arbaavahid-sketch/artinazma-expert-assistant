'use client';
import {usePDFExport} from './use-pdf-export';
import {commercialPDFPayload} from './solution-pdf-payload';
import {useEffect,useRef,useState} from 'react';
import {apiUrl,customerFetch} from '@/lib/api';
import {type SolutionDraft,readSolutionDraft} from './chemical-library';
import {calculateCommercial} from './commercial-solution';
import s from './preview.module.css';
export default function CommercialPDFButton({draft,en}:{draft:SolutionDraft;en:boolean}){
 const {savePDF,notice,clearNotice}=usePDFExport(en);
 const [busy,setBusy]=useState(false),[error,setError]=useState(false);const abortRef=useRef<AbortController|null>(null);const key=JSON.stringify({draft,en}),latest=useRef(key);
 useEffect(()=>{latest.current=key;return()=>abortRef.current?.abort();},[key]);
 let valid=false;try{readSolutionDraft(draft);if(draft.commercial){calculateCommercial(draft.commercial,draft.material.record.molarMass);valid=true;}}catch{}
 async function download(){const abort=new AbortController();abortRef.current?.abort();abortRef.current=abort;const timer=setTimeout(()=>abort.abort(),20000);setBusy(true);setError(false);clearNotice();
 try{const response=await customerFetch(apiUrl('/uncertainty/commercial-report.pdf'),{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify(commercialPDFPayload(draft,en))});
 if(!response.ok||!response.headers.get('content-type')?.includes('application/pdf'))throw Error();const blob=await response.blob();if(blob.size>5*1024*1024||await blob.slice(0,5).text()!=='%PDF-')throw Error();if(abort.signal.aborted||latest.current!==key)return;clearTimeout(timer);await savePDF(blob,`artin-commercial-${en?'en':'fa'}.pdf`);
 }catch{if(latest.current===key&&abortRef.current===abort)setError(true);}finally{clearTimeout(timer);if(abortRef.current===abort)setBusy(false);}}
 return <><button className={s.secondary} type="button" disabled={!valid||busy} onClick={()=>void download()}>{busy?(en?'Preparing PDF…':'در حال ساخت PDF…'):(en?'Download commercial solution PDF':'دانلود PDF محلول تجاری')}</button>{notice}{error&&<p role="alert">{en?'PDF could not be generated. Check the inputs and connection.':'PDF ساخته نشد؛ ورودی‌ها و اتصال را بررسی کنید.'}</p>}</>;
}
