'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowUpFromLine,Check,Copy,Download,Plus,Smartphone} from 'lucide-react';
import {Capacitor} from '@capacitor/core';
import {useI18n} from '@/lib/i18n';
import s from './install.module.css';

export default function InstallPage(){
 const {locale,dir}=useI18n(),en=locale==='en',t=(fa:string,e:string)=>en?e:fa;
 const [platform,setPlatform]=useState<'ios'|'android'>('ios'),[installed,setInstalled]=useState(false),[native,setNative]=useState(false),[copy,setCopy]=useState<'ok'|'error'|''>('');
 useEffect(()=>{
  const media=window.matchMedia('(display-mode: standalone)');
  const sync=()=>setInstalled(media.matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone));
  sync();setNative(Capacitor.isNativePlatform());if(/Android/i.test(navigator.userAgent))setPlatform('android');
  media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);
 },[]);
 async function copyLink(){try{await navigator.clipboard.writeText(`${window.location.origin}/install`);setCopy('ok');}catch{setCopy('error');}}
 const steps=platform==='ios'?[
  [t('با Safari وارد شوید','Open in Safari'),t('آرتین را در مرورگر Safari آیفون یا آیپد باز کنید. اگر داخل تلگرام یا برنامهٔ دیگری هستید، لینک را در Safari باز کنید.','Open Artin in Safari on your iPhone or iPad. If you are inside another app, open the link in Safari.')],
  [t('اشتراک‌گذاری را بزنید','Tap Share'),t('از منوی مرورگر، دکمهٔ Share با نماد مربع و فلش رو به بالا را انتخاب کنید.','Open the browser menu and choose Share, shown as a square with an upward arrow.')],
  [t('به صفحهٔ اصلی اضافه کنید','Add to Home Screen'),t('گزینهٔ Add to Home Screen را بزنید. اگر این گزینه را نمی‌بینید، در فهرست Share بخش Edit Actions را بررسی کنید.','Choose Add to Home Screen. If it is missing, check Edit Actions in the Share menu.')],
  [t('افزودن را تأیید کنید','Confirm Add'),t('اگر گزینهٔ Open as Web App دیده می‌شود، آن را روشن نگه دارید و Add را بزنید. سپس از آیکون آرتین روی صفحهٔ اصلی وارد شوید.','If Open as Web App appears, keep it enabled and tap Add. Then open Artin from its Home Screen icon.')],
 ]:[
  [t('با Chrome وارد شوید','Open in Chrome'),t('آرتین را در مرورگر Chrome گوشی باز کنید.','Open Artin in Chrome on your phone.')],
  [t('منوی مرورگر را باز کنید','Open the browser menu'),t('منوی سه‌نقطه را بزنید و Install app یا Add to Home screen را انتخاب کنید. نام گزینه با نسخهٔ مرورگر فرق می‌کند.','Open the three-dot menu and select Install app or Add to Home screen. The wording varies by browser version.')],
  [t('نصب یا افزودن را تأیید کنید','Confirm installation'),t('در پنجرهٔ مرورگر، نصب یا افزودن را تأیید کنید و آرتین را از آیکون صفحهٔ اصلی باز کنید.','Confirm the browser prompt, then open Artin from its Home Screen icon.')],
 ];
 return <section className={s.page} dir={dir} aria-labelledby="install-title">
  <header className={s.hero}><img src="/icons/apple-touch-icon.png" width="88" height="88" alt=""/><span>ARTIN · WEB APP</span><h1 id="install-title">{t('آرتین روی صفحهٔ اصلی گوشی','Artin on your Home Screen')}</h1><p>{t('دستیار تخصصی و محیط آزمایشگاه را از آیکون آرتین باز کنید؛ بدون نیاز به اپ‌استور.','Open the expert assistant and laboratory workspace from the Artin icon, without an app store.')}</p></header>
  {installed||native?<section className={s.status} role="status"><Check size={20}/><div><strong>{native?t('آرتین را داخل برنامه باز کرده‌اید','You are using the native app'):t('آرتین در حالت مستقل باز شده است','Artin is open as a standalone app')}</strong><p>{t('برای استفاده از این نسخه، افزودن دوباره لازم نیست.','You do not need to add this version again.')}</p></div></section>:<section className={s.guide}>
   <div className={s.tabs} role="group" aria-label={t('نوع گوشی','Phone type')}><button type="button" aria-pressed={platform==='ios'} onClick={()=>setPlatform('ios')}>iPhone / iPad</button><button type="button" aria-pressed={platform==='android'} onClick={()=>setPlatform('android')}>{t('اندروید','Android')}</button></div>
   <h2>{t('روش افزودن به صفحهٔ اصلی','How to add Artin')}</h2><ol>{steps.map(([title,description],i)=><li key={title}><span className={s.number}>{new Intl.NumberFormat(en?'en':'fa').format(i+1)}</span><div><h3>{title}{platform==='ios'&&i===1&&<ArrowUpFromLine size={18} aria-hidden="true"/>}{platform==='ios'&&i===2&&<Plus size={18} aria-hidden="true"/>}</h3><p>{description}</p></div></li>)}</ol>
  </section>}
  <div className={s.actions}><Link href="/assistant?source=pwa"><Smartphone size={17}/>{t('ورود به آرتین','Open Artin')}</Link><Link href="/calculators"><Download size={17}/>{t('محیط آزمایشگاه','Laboratory workspace')}</Link><button type="button" onClick={()=>void copyLink()}><Copy size={17}/>{t('کپی لینک راهنمای نصب','Copy installation link')}</button></div>
  {copy&&<p role={copy==='ok'?'status':'alert'}>{copy==='ok'?t('لینک راهنمای نصب کپی شد.','Installation link copied.'):t('کپی خودکار ممکن نشد؛ آدرس همین صفحه را از مرورگر کپی کنید.','Could not copy automatically. Copy this page’s address from your browser.')}</p>}
  <p className={s.note}>{t('این نسخه به همان سرویس وب آرتین متصل است. برای گفت‌وگو با هوش مصنوعی و محاسبات سرور، اینترنت لازم است. فایل پرونده‌ها را پیش از خروج ذخیره کنید.','This version connects to the same Artin web service. AI conversations and server calculations require internet access. Save your project files before leaving.')}</p>
 </section>;
}
