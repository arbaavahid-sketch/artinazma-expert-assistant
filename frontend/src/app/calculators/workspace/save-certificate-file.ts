import {Capacitor} from '@capacitor/core';
import {NativeExport} from '@/lib/native-export';
import {ProjectExportUnavailable} from '@/lib/save-project-file';
import {readCertificateAttachment} from './reagent-attachment';

export async function saveCertificateFile(raw:unknown):Promise<'download-started'|'saved'|'cancelled'>{
 const file=readCertificateAttachment(raw);
 if(Capacitor.isNativePlatform()){
  if(Capacitor.getPlatform()!=='android'||!Capacitor.isPluginAvailable('NativeExport'))throw new ProjectExportUnavailable();
  let capability;try{capability=await NativeExport.getDocumentCapabilities();}catch{throw new ProjectExportUnavailable();}
  if(capability.protocol!==1||capability.saveCertificate!==true)throw new ProjectExportUnavailable();
  const result=await NativeExport.saveCertificate({base64:file.base64,fileName:file.name,mime:file.mime});
  if(result.status==='cancelled')return 'cancelled';
  if(result.status!=='saved'||!result.uri?.startsWith('content://'))throw Error('Native certificate save was not confirmed');
  return 'saved';
 }
 const bytes=Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0));
 const url=URL.createObjectURL(new Blob([bytes],{type:file.mime}));
 try{const a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);try{a.click();}finally{a.remove();}}finally{setTimeout(()=>URL.revokeObjectURL(url),30_000);}
 return 'download-started';
}
