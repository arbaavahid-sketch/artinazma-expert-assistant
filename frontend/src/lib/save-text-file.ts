import {Capacitor} from '@capacitor/core';
import {NativeExport} from './native-export';
import {saveProjectJSON,ProjectExportUnavailable} from './save-project-file';
export async function saveTextFile(content:string,name:string,kind:'html'|'json'):Promise<'download-started'|'saved'|'cancelled'>{
 if(kind==='json')return saveProjectJSON(content,name);
 if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,90}\.html$/.test(name)||!content.trim()||new TextEncoder().encode(content).length>12*1024*1024)throw Error('Invalid HTML export');
 if(Capacitor.isNativePlatform()){
  if(Capacitor.getPlatform()!=='android'||!Capacitor.isPluginAvailable('NativeExport'))throw new ProjectExportUnavailable();
  let capability;
  try{capability=await NativeExport.getDocumentCapabilities();}
  catch(error){
   // Published older Android shells have saveHtml, but no capability handshake.
   // Only a missing-method response selects that path. Never retry a failed write.
   if(!error||typeof error!=='object'||!('code' in error)||error.code!=='UNIMPLEMENTED')throw error;
   const result=await NativeExport.saveHtml({html:content,fileName:name});
   if(!result.uri||!(/^content:\/\/[^/\s]+\/.+/.test(result.uri)||/^file:\/\/(?:\/storage\/|\/sdcard\/)/.test(result.uri)))throw Error('Legacy HTML save was not confirmed');
   return 'saved';
  }
  if(capability.protocol!==1||capability.saveHtmlDocument!==true)throw new ProjectExportUnavailable();
  const result=await NativeExport.saveHtmlDocument({html:content,fileName:name});
  if(result.status==='cancelled')return 'cancelled';
  if(result.status!=='saved'||!result.uri?.startsWith('content://'))throw Error('Native HTML save was not confirmed');
  return 'saved';
 }
 const url=URL.createObjectURL(new Blob([content],{type:'text/html;charset=utf-8'}));
 try{const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);try{a.click();}finally{a.remove();}}finally{setTimeout(()=>URL.revokeObjectURL(url),30_000);}
 return 'download-started';
}
