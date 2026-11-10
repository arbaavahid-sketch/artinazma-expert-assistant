'use client';
import {useEffect,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {apiUrl,backendFetch} from '@/lib/api';
import {CUSTOMER_AUTH_CHANGED_EVENT} from '@/lib/customer';
import {useI18n} from '@/lib/i18n';
export default function ApprovedCustomerGate({children}:{children:ReactNode}){
 const {locale,dir}=useI18n(),en=locale==='en';
 const [mounted,setMounted]=useState(false);
 const [state,setState]=useState<'checking'|'approved'|'signin'|'pending'|'error'>('checking'),[retry,setRetry]=useState(0),[next,setNext]=useState('/calculators');
 useEffect(()=>{let active:AbortController|null=null;setNext(location.pathname+location.search);
  async function check(){active?.abort();const controller=new AbortController();active=controller;try{const response=await backendFetch(apiUrl('/customers/access'),{cache:'no-store',signal:controller.signal});if(controller.signal.aborted)return;if(response.status===401){setState('signin');return;}if(response.status===403){setState('pending');return;}if(!response.ok)throw Error();const data=await response.json();if(!controller.signal.aborted){const approved=data.approved===true&&Number.isSafeInteger(data.customer_id);if(approved)setMounted(true);setState(approved?'approved':'signin');}}catch{if(!controller.signal.aborted)setState('error');}}
  void check();window.addEventListener(CUSTOMER_AUTH_CHANGED_EVENT,check);window.addEventListener('focus',check);return()=>{active?.abort();window.removeEventListener(CUSTOMER_AUTH_CHANGED_EVENT,check);window.removeEventListener('focus',check);};
 },[retry]);
 return <><div hidden={state!=='approved'}>{mounted?children:null}</div>{state!=='approved'&&<section dir={dir} className="mx-auto my-10 max-w-xl rounded-2xl border border-slate-200 bg-white p-7 text-center leading-8" aria-live="polite">{state==='checking'?<p role="status">{en?'Checking account access…':'در حال بررسی دسترسی حساب…'}</p>:<><h1 className="text-xl font-black">{en?'Approved account required':'حساب تأییدشده لازم است'}</h1><p className="my-4 text-sm text-slate-600">{state==='error'?(en?'Account access could not be checked. Retry when connected.':'بررسی دسترسی انجام نشد. اتصال را بررسی کنید و دوباره تلاش کنید.'):state==='pending'?(en?'This account has not been approved or its access has been restricted. Contact support.':'حساب هنوز تأیید نشده یا دسترسی آن محدود شده است. با پشتیبانی پیگیری کنید.'):(en?'Sign in with an approved account to use laboratory calculations. New users must register and await approval.':'برای استفاده از محاسبات آزمایشگاهی با حساب تأییدشده وارد شوید. اگر حساب ندارید، ابتدا ثبت‌نام کنید و منتظر تأیید مدیر بمانید.')}</p><div className="flex flex-wrap justify-center gap-3"><Link className="ui-btn ui-btn-primary" href={'/customer-login?next='+encodeURIComponent(next)}>{en?'Sign in':'ورود به حساب'}</Link><Link className="ui-btn ui-btn-ghost" href="/customer-register">{en?'Register':'ثبت‌نام'}</Link><button className="ui-btn ui-btn-ghost" onClick={()=>setRetry(r=>r+1)}>{en?'Check again':'بررسی دوباره'}</button></div></>}</section>}</>;
}
