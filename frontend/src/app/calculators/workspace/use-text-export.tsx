'use client';
import {useRef,useState} from 'react';
import {saveTextFile} from '@/lib/save-text-file';
import {ProjectExportUnavailable} from '@/lib/save-project-file';
export function useTextExport(en:boolean){
 const pending=useRef(false);
 const [status,setStatus]=useState<'saved'|'cancelled'|'unsupported'|'failed'|undefined>(),[busy,setBusy]=useState(false);
 async function save(content:string,name:string,kind:'html'|'json'){
  if(pending.current)return false;
  pending.current=true;setBusy(true);setStatus(undefined);
  try{const result=await saveTextFile(content,name,kind);if(result!=='download-started')setStatus(result);return result!=='cancelled';}
  catch(error){setStatus(error instanceof ProjectExportUnavailable?'unsupported':'failed');return false;}
  finally{pending.current=false;setBusy(false);}
 }
 const notice=status?<p role={status==='failed'||status==='unsupported'?'alert':'status'}>{status==='saved'?(en?'The file was saved.':'فایل ذخیره شد.'):status==='cancelled'?(en?'File save cancelled; you can try again.':'ذخیرهٔ فایل لغو شد؛ می‌توانید دوباره اقدام کنید.'):status==='unsupported'?(en?'This app version cannot save this export; use the web version or update the app package.':'این نسخهٔ برنامه ذخیرهٔ این خروجی را پشتیبانی نمی‌کند؛ از نسخهٔ وب استفاده کنید یا بستهٔ برنامه را به‌روزرسانی کنید.'):(en?'File save failed. Keep your current inputs and try again.':'ذخیرهٔ فایل انجام نشد؛ ورودی‌های فعلی را نگه دارید و دوباره تلاش کنید.')}</p>:null;
 return {save,notice,busy,clear:()=>setStatus(undefined)};
}
