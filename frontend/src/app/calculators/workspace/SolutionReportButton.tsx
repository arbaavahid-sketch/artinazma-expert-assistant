'use client';
import {useTextExport} from './use-text-export';
import {useState} from 'react';
import {type SolutionDraft} from './chemical-library';
import {calculateStockPreparation} from './gc-workflow';
import {buildSolutionReport} from './solution-report';
import s from './preview.module.css';
export default function SolutionReportButton({draft,en}:{draft:SolutionDraft;en:boolean}){
 const textExport=useTextExport(en);
 const [failed,setFailed]=useState(false);let valid=false;try{if(draft.preparation){calculateStockPreparation(draft.preparation);valid=true;}}catch{}
 return <><button type="button" disabled={!valid} className={s.secondary} onClick={async()=>{textExport.clear();try{const html=buildSolutionReport(draft,en,new Date().toISOString());await textExport.save(html,`artin-solution-${en?'en':'fa'}.html`,'html');setFailed(false);}catch{setFailed(true);}}}>{en?'Download preparation report (HTML)':'دانلود گزارش تهیهٔ محلول (HTML)'}</button>{failed&&<p role="alert">{en?'Report could not be generated; review the input data.':'گزارش ساخته نشد؛ ورودی‌ها را بررسی کنید.'}</p>}{textExport.notice}</>;
}
