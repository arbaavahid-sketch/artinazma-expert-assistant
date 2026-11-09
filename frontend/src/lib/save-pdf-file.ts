import {Capacitor} from '@capacitor/core';
import {NativeExport} from './native-export';
import {ProjectExportUnavailable} from './save-project-file';
export async function savePDFFile(blob:Blob,fileName:string):Promise<'download-started'|'saved'|'cancelled'>{
 if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,90}\.pdf$/.test(fileName)||blob.size<5||blob.size>5*1024*1024||await blob.slice(0,5).text()!=='%PDF-')throw Error('Invalid PDF export');
 if(Capacitor.isNativePlatform()){
  if(Capacitor.getPlatform()!=='android'||!Capacitor.isPluginAvailable('NativeExport'))throw new ProjectExportUnavailable();
  let capability;try{capability=await NativeExport.getDocumentCapabilities();}catch{throw new ProjectExportUnavailable();}
  if(capability.protocol!==1||capability.savePdf!==true)throw new ProjectExportUnavailable();
  const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  const result=await NativeExport.savePdf({base64:btoa(binary),fileName});
  if(result.status==='cancelled')return 'cancelled';
  if(result.status!=='saved'||!result.uri?.startsWith('content://'))throw Error('Native PDF save was not confirmed');
  return 'saved';
 }
 const url=URL.createObjectURL(blob);try{const a=document.createElement('a');a.href=url;a.download=fileName;document.body.append(a);try{a.click();}finally{a.remove();}}finally{setTimeout(()=>URL.revokeObjectURL(url),30_000);}
 return 'download-started';
}
