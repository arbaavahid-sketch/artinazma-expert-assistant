'use client';
import {useEffect,useRef,useState} from 'react';
import {calculatePhysicalOnServer,physicalKey,preparePhysical,type PhysicalKind,type PhysicalRun} from './physical-run';
import type {DensityData} from './density';
import type {WeighingData} from './weighing';
import type {ProjectIdentity} from './project-file';
export function usePhysicalCalculation(kind:PhysicalKind,data:DensityData|WeighingData,identity:ProjectIdentity,onRun?:(run:PhysicalRun)=>void){
  const key=physicalKey(data,identity),[busy,setBusy]=useState(false),[failure,setFailure]=useState(false),[verified,setVerified]=useState<PhysicalRun>();
  const controller=useRef<AbortController|null>(null),latest=useRef(key);
  useEffect(()=>{latest.current=key;controller.current?.abort();setBusy(false);setFailure(false);return ()=>controller.current?.abort();},[key]);
  async function calculate(){
    controller.current?.abort();const abort=new AbortController();controller.current=abort;
    setFailure(false);setVerified(undefined);setBusy(true);
    const timer=setTimeout(()=>abort.abort(),15000);
    try{preparePhysical(kind,data);const run=await calculatePhysicalOnServer(kind,data,identity,abort.signal);if(!abort.signal.aborted&&latest.current===key){setVerified(run);onRun?.(run);}}
    catch{if(latest.current===key&&controller.current===abort)setFailure(true);}
    finally{clearTimeout(timer);if(controller.current===abort)setBusy(false);}
  }
  return {busy,failure,verified,current:Boolean(verified&&verified.inputKey===key),calculate};
}
