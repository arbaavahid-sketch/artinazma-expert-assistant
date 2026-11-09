import bank from '../method-bank.json';
import {methodProfile} from '../method-profiles';
import {readGumProject,type GumProject} from '../gum-project';
export type MethodStudy={methodId:number;outcome:string;conditions:string;evidence:string;decision:string;budget?:GumProject};
export function emptyMethodStudy(methodId:number):MethodStudy{
 if(!bank.some(m=>m.id===methodId))throw Error('Unknown method');
 return {methodId,outcome:'',conditions:'',evidence:'',decision:''};
}
export function readMethodStudy(value:unknown):MethodStudy{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid method study');
 const r=value as Record<string,unknown>,method=bank.find(m=>m.id===r.methodId);
 if(!method)throw Error('Unknown method');
 const text=(key:string)=>{const v=r[key];if(typeof v!=='string'||v.length>5000)throw Error('Invalid method text');return v;};
 const profile=methodProfile(method);
 const budget=r.budget===undefined?undefined:readGumProject(r.budget);
 if(budget){
  if(profile.kind==='qualitative'||profile.kind==='sampling')throw Error('Unexpected numeric budget');
  if(budget.template!=='general'&&!profile.models.some(key=>budget.template===`family:${key}`))throw Error('Method/model mismatch');
  if(budget.inputs.activeMethodId&&budget.inputs.activeMethodId!==String(method.id))throw Error('Method identity mismatch');
 }
 return {methodId:method.id,outcome:text('outcome'),conditions:text('conditions'),evidence:text('evidence'),decision:text('decision'),...(budget?{budget}:{})};
}
