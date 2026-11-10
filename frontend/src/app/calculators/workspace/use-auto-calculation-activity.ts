import {useEffect,useRef} from 'react';
import {trackCalculation} from '@/lib/calculation-activity';
/** A valid edited auto-calculation, not initial display of a saved project. */
export function useAutoCalculationActivity(key:string,valid:boolean){
 const previous=useRef(key);
 useEffect(()=>{
  if(previous.current===key)return;
  previous.current=key;if(!valid)return;
  const timer=setTimeout(()=>trackCalculation('stock-preparation','success'),800);
  return()=>clearTimeout(timer);
 },[key,valid]);
}
