'use client';
import {Component,Suspense,lazy,useState,type ComponentType,type ReactNode} from 'react';
import {useI18n} from '@/lib/i18n';
import s from './preview.module.css';

class SectionFailure extends Component<{children:ReactNode;en:boolean;retry:()=>void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){
  if(!this.state.failed)return this.props.children;
  const {en,retry}=this.props;
  return <section className={s.formPanel} role="alert"><h2>{en?'This section could not open':'این بخش باز نشد'}</h2>
   <p>{en?'Check your connection and try this section again. You can still save your project using the file bar above.':'ارتباط را بررسی کنید و همین بخش را دوباره باز کنید. می‌توانید فایل پرونده را از نوار بالای صفحه ذخیره کنید.'}</p>
   <p>{en?'If retrying fails, save the project file before reloading the page.':'اگر تلاش دوباره موفق نشد، پیش از بازخوانی صفحه فایل پرونده را ذخیره کنید.'}</p>
   <button type="button" className={s.secondary} onClick={retry}>{en?'Retry this section':'تلاش دوباره برای این بخش'}</button>
  </section>;
 }
}

/** Call at module scope with a fixed import. Failure stays below the project owner. */
export function deferredSection<P extends object>(loader:()=>Promise<{default:ComponentType<P>}>){
 // A rejected React.lazy instance cannot be retried by merely resetting its boundary.
 // Replace it explicitly on retry; later mounts then share the latest attempt.
 let Current=lazy(loader);
 return function DeferredSection(props:P){
  const {locale}=useI18n(),en=locale==='en';
  const [attempt,setAttempt]=useState(()=>({Content:Current,revision:0}));
  const Content=attempt.Content;
  function retry(){Current=lazy(loader);setAttempt(previous=>({Content:Current,revision:previous.revision+1}));}
  return <SectionFailure key={attempt.revision} en={en} retry={retry}><Suspense fallback={<p className={s.formPanel} role="status">{en?'Loading this section…':'در حال آماده‌کردن این بخش…'}</p>}><Content {...props}/></Suspense></SectionFailure>;
 };
}
