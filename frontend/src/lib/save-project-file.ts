import {Capacitor} from '@capacitor/core';
import {NativeExport as documents} from './native-export';

export type ProjectSaveHandler=()=>boolean|null|Promise<boolean|null>;
export class ProjectExportUnavailable extends Error{}
export async function saveProjectJSON(json:string,fileName:string):Promise<'download-started'|'saved'|'cancelled'>{
 if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,90}\.json$/.test(fileName)||new TextEncoder().encode(json).length>12*1024*1024)throw Error('Invalid project export');
 const parsed=JSON.parse(json);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Invalid project export');
 if(Capacitor.isNativePlatform()){
  if(Capacitor.getPlatform()!=='android'||!Capacitor.isPluginAvailable('NativeExport'))throw new ProjectExportUnavailable();
  let capability;
  try{capability=await documents.getDocumentCapabilities();}catch{throw new ProjectExportUnavailable();}
  if(capability.protocol!==1||capability.saveJson!==true)throw new ProjectExportUnavailable();
  const result=await documents.saveJson({json,fileName});
  if(result.status==='cancelled')return 'cancelled';
  if(result.status!=='saved'||!result.uri?.startsWith('content://'))throw Error('Native save was not confirmed');
  return 'saved';
 }
 const url=URL.createObjectURL(new Blob([json],{type:'application/json;charset=utf-8'}));
 try{const anchor=document.createElement('a');anchor.href=url;anchor.download=fileName;document.body.append(anchor);try{anchor.click();}finally{anchor.remove();}}finally{setTimeout(()=>URL.revokeObjectURL(url),30_000);}
 return 'download-started';
}
