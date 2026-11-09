'use client';
import {useState} from 'react';
import {savePDFFile} from '@/lib/save-pdf-file';
import {ProjectExportUnavailable} from '@/lib/save-project-file';
export function usePDFExport(en:boolean){
 const [status,setStatus]=useState<'saved'|'cancelled'|'unsupported'|undefined>();
 async function savePDF(blob:Blob,name:string){
  setStatus(undefined);
  try{const result=await savePDFFile(blob,name);if(result!=='download-started')setStatus(result);}
  catch(error){if(error instanceof ProjectExportUnavailable){setStatus('unsupported');return;}throw error;}
 }
 const notice=status?<p role={status==='unsupported'?'alert':'status'}>{status==='saved'?(en?'The selected PDF was saved.':'PDF انتخاب‌شده ذخیره شد.'):status==='cancelled'?(en?'PDF save cancelled; you can try again.':'ذخیرهٔ PDF لغو شد؛ می‌توانید دوباره اقدام کنید.'):(en?'This app version cannot save laboratory PDFs; use the web version or update the app package.':'این نسخهٔ برنامه ذخیرهٔ PDF آزمایشگاهی را پشتیبانی نمی‌کند؛ از نسخهٔ وب استفاده کنید یا بستهٔ برنامه را به‌روزرسانی کنید.')}</p>:null;
 return {savePDF,notice,clearNotice:()=>setStatus(undefined)};
}
