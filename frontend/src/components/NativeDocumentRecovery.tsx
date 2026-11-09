'use client';
import {useEffect,useState} from 'react';
import {Capacitor} from '@capacitor/core';

export default function NativeDocumentRecovery({en}:{en:boolean}){
 const [result,setResult]=useState<'saved'|'cancelled'|'failed'>();
 useEffect(()=>{
  if(!Capacitor.isNativePlatform())return;
  let active=true,remove:(()=>void)|undefined;
  void import('@capacitor/app').then(async({App})=>{
   const handle=await App.addListener('appRestoredResult',event=>{
    if(!active||event.pluginId!=='NativeExport'||!['saveJson','savePdf','saveHtmlDocument','saveCertificate'].includes(event.methodName))return;
    const data=event.data as {status?:string;uri?:string}|undefined;
    setResult(event.success&&data?.status==='saved'&&data.uri?.startsWith('content://')?'saved':event.success&&data?.status==='cancelled'?'cancelled':'failed');
   });
   if(!active)await handle.remove();else remove=()=>void handle.remove();
  }).catch(()=>{});
  return()=>{active=false;remove?.();};
 },[]);
 if(!result)return null;
 return <section role={result==='failed'?'alert':'status'} className="ui-card" style={{padding:16,marginBottom:16}}>
  <p>{result==='saved'?(en?'The previous file export finished after the app restarted.':'ذخیرهٔ فایل قبلی پس از بازشدن دوبارهٔ برنامه کامل شد.'):result==='cancelled'?(en?'The previous file save was cancelled.':'ذخیرهٔ فایل قبلی لغو شد.'):(en?'The previous file save could not be confirmed.':'ذخیرهٔ فایل قبلی تأیید نشد.')}</p>
  <p>{en?'To resume editing, open your saved JSON project. Unsaved form inputs are not automatically restored.':'برای ادامهٔ ویرایش، پروندهٔ JSON ذخیره‌شده را باز کنید. ورودی‌های ذخیره‌نشدهٔ فرم خودکار بازیابی نمی‌شوند.'}</p>
  <button type="button" onClick={()=>setResult(undefined)}>{en?'Dismiss save notice':'بستن پیام ذخیره'}</button>
 </section>;
}
