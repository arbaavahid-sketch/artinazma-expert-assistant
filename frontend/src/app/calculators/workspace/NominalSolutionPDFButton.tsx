'use client';
import {usePDFExport} from './use-pdf-export';
import {nominalPDFPayload} from './solution-pdf-payload';
import {useEffect,useRef,useState} from 'react';
import {apiUrl,customerFetch} from '@/lib/api';
import {type SolutionDraft,readSolutionDraft} from './chemical-library';
import {calculateSolution} from './chemical-library';
import s from './preview.module.css';
export default function NominalSolutionPDFButton({draft,en}:{draft:SolutionDraft;en:boolean}){
 const {savePDF,notice,clearNotice}=usePDFExport(en);
 const [busy,setBusy]=useState(false),[error,setError]=useState(false);const abortRef=useRef<AbortController|null>(null);const key=JSON.stringify({draft,en}),latest=useRef(key);
 useEffect(()=>{latest.current=key;return()=>abortRef.current?.abort();},[key]);
 let valid=false;try{readSolutionDraft(draft);calculateSolution(draft);valid=true;}catch{}
 async function download(){const abort=new AbortController();abortRef.current?.abort();abortRef.current=abort;const timer=setTimeout(()=>abort.abort(),20000);setBusy(true);setError(false);clearNotice();
 try{const response=await customerFetch(apiUrl('/uncertainty/nominal-solution-report.pdf'),{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify(nominalPDFPayload(draft,en))});
 if(!response.ok||!response.headers.get('content-type')?.includes('application/pdf'))throw Error();const blob=await response.blob();if(blob.size>5*1024*1024||await blob.slice(0,5).text()!=='%PDF-')throw Error();if(abort.signal.aborted||latest.current!==key)return;clearTimeout(timer);await savePDF(blob,`artin-nominal-solution-${en?'en':'fa'}.pdf`);
 }catch{if(latest.current===key&&abortRef.current===abort)setError(true);}finally{clearTimeout(timer);if(abortRef.current===abort)setBusy(false);}}
 return <><button className={s.secondary} type="button" disabled={!valid||busy} onClick={()=>void download()}>{busy?(en?'Preparing PDF…':'در حال ساخت PDF…'):(en?'Download nominal molar preparation PDF':'دانلود PDF جرم لازم و منابع')}</button>{notice}{error&&<p role="alert">{en?'PDF could not be generated. Check the inputs and connection.':'PDF ساخته نشد؛ ورودی‌ها و اتصال را بررسی کنید.'}</p>}</>;
}
