import {apiUrl,backendFetch} from './api';
type Tool='precision'|'intermediate'|'calibration'|'bias'|'control'|'decision'|'top-down'|'solution'|'commercial-solution'|'dilution-plan'|'stock-preparation'|`quick-${number}`;
let queue:Promise<void>=Promise.resolve(),ready=false,initializing:Promise<boolean>|null=null;
export function prepareCalculationActivity():Promise<boolean>{
 if(ready)return Promise.resolve(true);
 if(!initializing)initializing=(async()=>{try{const response=await backendFetch(apiUrl('/calculation-activity/access'),{cache:'no-store',signal:AbortSignal.timeout(8000)});ready=response.ok;return ready;}catch{return false;}finally{initializing=null;}})();
 return initializing;
}
/** Advisory usage only. Never send input values, files, identity claims or secrets. */
export function trackCalculation(tool:Tool,status:'success'|'error',title=''){
 if(typeof window==='undefined')return;
 const event={event_id:crypto.randomUUID(),tool,status,title:title.slice(0,120)};
 queue=queue.catch(()=>{}).then(async()=>{
  try{
   if(!await prepareCalculationActivity())return;
   await backendFetch(apiUrl('/calculation-activity'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),keepalive:true,signal:AbortSignal.timeout(8000)});
  }catch{/* Usage recording must not change or block a calculation. */}
 });
}
/** Call only from an explicit calculation action, never during render or report export. */
export function observeCalculation<T>(tool:Tool,calculate:()=>T):T{
 try{const result=calculate();trackCalculation(tool,'success');return result;}
 catch(error){trackCalculation(tool,'error');throw error;}
}
