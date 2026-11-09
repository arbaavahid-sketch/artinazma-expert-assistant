'use client';
import {useEffect,useRef} from 'react';

// For dialogs without autoFocus children: capture the opener before showModal.
// Effect cleanup also runs when React removes an open dialog without close().
export function useModalDialog(){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const dialog=ref.current,opener=document.activeElement;
  if(dialog&&!dialog.open)dialog.showModal();
  return()=>{
   if(dialog?.open)dialog.close();
   if(opener instanceof HTMLElement&&opener.isConnected)opener.focus({preventScroll:true});
  };
 },[]);
 return ref;
}
