'use client';
import {useTextExport} from './use-text-export';
import {useState} from 'react';
import {type SolutionDraft} from './chemical-library';
import {buildCommercialReport} from './commercial-report';
import s from './preview.module.css';
export default function CommercialReportButton({draft,en}:{draft:SolutionDraft;en:boolean}){
 const textExport=useTextExport(en);
 const [failed,setFailed]=useState(false);
 return <><button className={s.secondary} type="button" onClick={async()=>{textExport.clear();try{const html=buildCommercialReport(draft,en,new Date().toISOString());await textExport.save(html,`artin-commercial-${en?'en':'fa'}.html`,'html');setFailed(false);}catch{setFailed(true);}}}>{en?'Download commercial solution report (HTML)':'دانلود گزارش محلول تجاری (HTML)'}</button>{failed&&<p role="alert">{en?'Unable to generate the report; review current inputs.':'گزارش ساخته نشد؛ ورودی‌های جاری را بررسی کنید.'}</p>}{textExport.notice}</>;
}
