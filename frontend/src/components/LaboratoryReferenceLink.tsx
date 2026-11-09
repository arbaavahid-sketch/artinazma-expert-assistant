'use client';
import Link from 'next/link';
import type {ComponentProps} from 'react';
/** Open another reference without unloading a current unsaved laboratory project. */
export default function LaboratoryReferenceLink(props:ComponentProps<typeof Link>){
 return <Link {...props} onClick={event=>{
  props.onClick?.(event);if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  if(typeof props.href!=='string')return;
  const url=new URL(props.href,window.location.origin);
  if(url.origin!==window.location.origin)return;
  if(['/calculators','/calculators/workspace'].includes(window.location.pathname)&&url.pathname==='/calculators'&&url.searchParams.get('section')==='materials'){
   event.preventDefault();window.dispatchEvent(new CustomEvent('artin-material-reference',{detail:url.href}));
  }else if(window.location.pathname==='/assistant'&&new URLSearchParams(window.location.search).get('lab')==='1'&&url.pathname==='/assistant'&&url.searchParams.get('lab')==='1'&&url.searchParams.has('chemical')){
   event.preventDefault();window.dispatchEvent(new CustomEvent('artin-chemical-question',{detail:url.searchParams.get('chemical')}));
  }
 }}/>;
}
