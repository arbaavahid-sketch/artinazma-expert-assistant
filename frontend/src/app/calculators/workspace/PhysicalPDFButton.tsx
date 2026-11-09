'use client';
import {usePDFExport} from './use-pdf-export';
import {useEffect,useRef,useState} from 'react';
import {apiUrl,customerFetch} from '@/lib/api';
import {physicalKey,validatePhysicalRun,type PhysicalKind,type PhysicalRun} from './physical-run';
import type {DensityData} from './density';
import type {WeighingData} from './weighing';
import type {ProjectIdentity} from './project-file';
import {buildGCReport} from './gc-report';
import type {GCData,GCRun} from './gc-workflow';
import s from './preview.module.css';
type PDFProps={identity:ProjectIdentity;en:boolean}&({kind:PhysicalKind;data:DensityData|WeighingData;run:PhysicalRun}|{kind:'gc';data:GCData;run:GCRun;rows:string[][];verified:boolean});
export default function PhysicalPDFButton(props:PDFProps){
  const {kind,data,identity,run,en}=props;
  const {savePDF,notice,clearNotice}=usePDFExport(en);
  const [busy,setBusy]=useState(false),[error,setError]=useState(false);
  const controller=useRef<AbortController|null>(null);
  const key=kind==='gc'?JSON.stringify({rows:props.rows,data,identity}):physicalKey(data,identity),latest=useRef(key);
  useEffect(()=>{latest.current=key;return ()=>controller.current?.abort();},[key,en]);
  async function download(){
    controller.current?.abort();const abort=new AbortController();controller.current=abort;
    setBusy(true);setError(false);clearNotice();const timer=setTimeout(()=>abort.abort(),20000);
    try{
      if(props.kind==='gc')buildGCReport({rows:props.rows,data:props.data,identity,run:props.run,verified:props.verified,en,generatedAt:new Date().toISOString()});
      else validatePhysicalRun(props.run,props.kind,props.data,identity);
      const payload=props.kind==='gc'?{locale:en?'en':'fa',rows:props.rows,data,identity,run}:{kind,locale:en?'en':'fa',data,identity,run};
      const response=await customerFetch(apiUrl(kind==='gc'?'/uncertainty/gc-report.pdf':'/uncertainty/physical-report.pdf'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:abort.signal});
      if(!response.ok||!response.headers.get('content-type')?.includes('application/pdf'))throw new Error('Invalid PDF response');
      const blob=await response.blob();
      if(blob.size>5*1024*1024||await blob.slice(0,5).text()!=='%PDF-')throw new Error('Invalid PDF');
      if(abort.signal.aborted||latest.current!==key)return;
      clearTimeout(timer);await savePDF(blob,`artin-${kind}-${en?'en':'fa'}.pdf`);
    }catch{if(controller.current===abort&&!abort.signal.aborted)setError(true);else if(controller.current===abort&&latest.current===key)setError(true);}
    finally{clearTimeout(timer);if(controller.current===abort)setBusy(false);}
  }
  return <><button type="button" className={s.secondary} disabled={busy} onClick={()=>void download()}>{busy?(en?'Preparing PDF…':'در حال ساخت PDF…'):(en?'Download PDF report':'دریافت گزارش PDF')}</button>{notice}{error&&<p role="alert" className={s.fieldError}>{en?'PDF could not be generated. Check connectivity and recalculate if the engine changed.':'PDF ساخته نشد. اتصال را بررسی کنید؛ اگر موتور تغییر کرده، دوباره محاسبه کنید.'}</p>}</>;
}
