'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import s from './preview.module.css';
export default function CompoundViewer({title,en,onClose,children,label,backLabel}:{title:string;en:boolean;onClose:()=>void;children:ReactNode;label?:string;backLabel?:string}){
 const ref=useRef<HTMLDialogElement>(null);
 // Capture before React applies autoFocus to the close button during commit.
 const [opener]=useState(()=>typeof document==='undefined'?null:document.activeElement);
 useEffect(()=>{const dialog=ref.current;if(dialog&&!dialog.open)dialog.showModal();return()=>{if(dialog?.open)dialog.close();if(opener instanceof HTMLElement&&opener.isConnected)opener.focus({preventScroll:true});};},[opener]);
 return <dialog ref={ref} className={s.compoundViewer} aria-label={label??(en?'Compound details':'اطلاعات ماده')} onCancel={e=>{e.preventDefault();onClose();}}>
 <header className={s.viewerBar}><strong>{title}</strong><button type="button" className={s.secondary} autoFocus onClick={onClose}>{backLabel??(en?'Back to compounds':'بازگشت به فهرست')} <span aria-hidden="true">×</span></button></header>
 <div className={s.viewerContent}>{children}</div></dialog>;
}
