'use client';
import {useEffect,useRef,useState} from 'react';
import {certificateFromFile,type CertificateAttachment} from './reagent-attachment';
import {saveCertificateFile} from './save-certificate-file';
import {ProjectExportUnavailable} from '@/lib/save-project-file';
import {type Reagent} from './reagents';
export default function ReagentAttachment({value,en,onChange}:{value:Reagent;en:boolean;onChange:(r:Reagent)=>void}){
 const saving=useRef(false),[saveBusy,setSaveBusy]=useState(false),[saveNotice,setSaveNotice]=useState<{file:CertificateAttachment;status:'saved'|'cancelled'|'unsupported'|'failed'}>();
 const [error,setError]=useState(false),[busy,setBusy]=useState(false),token=useRef(0),latest=useRef(value);
 useEffect(()=>{latest.current=value;},[value]);
 useEffect(()=>()=>{token.current++;},[]);const t=(fa:string,english:string)=>en?english:fa;
 async function attach(file:File){const n=++token.current;setBusy(true);setError(false);try{const certificateFile=await certificateFromFile(file);if(n===token.current)onChange({...latest.current,certificateFile});}catch{if(n===token.current)setError(true);}finally{if(n===token.current)setBusy(false);}}
 async function download(){
  const file=value.certificateFile;if(!file||saving.current)return;
  const n=token.current;saving.current=true;setSaveBusy(true);setSaveNotice(undefined);
  try{const status=await saveCertificateFile(file);if(n===token.current&&status!=='download-started')setSaveNotice({file,status});}
  catch(e){if(n===token.current)setSaveNotice({file,status:e instanceof ProjectExportUnavailable?'unsupported':'failed'});}
  finally{saving.current=false;if(n===token.current)setSaveBusy(false);}
 }
 return <fieldset><legend>{t('فایل گواهی همین بچ','Certificate file for this lot')}</legend><p>{t('PDF، PNG یا JPEG تا ۱MB؛ داخل فایل پرونده ذخیره می‌شود و به سرور یا مترجم ارسال نمی‌شود. سقف کل پرونده ۱۲MB است؛ نسخه‌های کپی‌شدهٔ گواهی در محلول هم جزو آن هستند. فایل پیوست، تأیید گواهی نیست.','PDF, PNG or JPEG up to 1MB; stored inside the project file and not sent to the server or translator. The whole project is limited to 12MB, including certificate snapshots copied into recipes. Attaching does not verify a certificate.')}</p><label>{t('پیوست یا جایگزینی فایل گواهی','Attach or replace certificate file')}<input type="file" accept="application/pdf,image/png,image/jpeg" disabled={busy||saveBusy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void attach(f);}}/></label>{value.certificateFile&&<><p>{value.certificateFile.name}</p><button type="button" disabled={saveBusy||busy} onClick={()=>void download()}>{t('دریافت فایل گواهی','Download certificate file')}</button><button type="button" disabled={busy||saveBusy} onClick={()=>{token.current++;setSaveNotice(undefined);onChange({...value,certificateFile:undefined});}}>{t('برداشتن پیوست از پیش‌نویس','Remove draft attachment')}</button></>}{saveNotice&&saveNotice.file===value.certificateFile&&<p role={saveNotice.status==='failed'||saveNotice.status==='unsupported'?'alert':'status'}>{saveNotice.status==='saved'?t('فایل گواهی در محل انتخاب‌شده ذخیره شد.','The certificate file was saved to the selected destination.'):saveNotice.status==='cancelled'?t('ذخیرهٔ گواهی لغو شد؛ پیوست همچنان در پرونده موجود است.','Certificate save cancelled; the attachment remains in the project.'):saveNotice.status==='unsupported'?t('این نسخهٔ برنامه ذخیرهٔ گواهی را پشتیبانی نمی‌کند؛ از نسخهٔ وب استفاده کنید یا بستهٔ برنامه را به‌روزرسانی کنید.','This app version cannot save certificates; use the web version or update the app package.'):t('ذخیرهٔ گواهی انجام نشد؛ پیوست حفظ شده است. دوباره تلاش کنید.','Certificate save failed; the attachment is retained. Try again.')}</p>}{error&&<p role="alert">{t('فایل پذیرفته نشد؛ نوع و سقف ۱MB را بررسی کنید.','File not accepted; check its type and 1MB limit.')}</p>}</fieldset>;
}
