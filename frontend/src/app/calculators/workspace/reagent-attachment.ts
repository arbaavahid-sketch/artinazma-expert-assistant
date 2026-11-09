export type CertificateAttachment={name:string;mime:'application/pdf'|'image/png'|'image/jpeg';base64:string};
export const MAX_CERTIFICATE_BYTES=1024*1024;
export function readCertificateAttachment(raw:unknown):CertificateAttachment{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid certificate file');const r=raw as CertificateAttachment;
 if(typeof r.name!=='string'||!r.name.trim()||r.name.length>200||/[\\/\x00-\x1f]/.test(r.name)||!['application/pdf','image/png','image/jpeg'].includes(r.mime)||typeof r.base64!=='string'||r.base64.length>Math.ceil(MAX_CERTIFICATE_BYTES/3)*4||!r.base64.length||(r.base64.length%4!==0||!(/^[A-Za-z0-9+/]*={0,2}$/).test(r.base64)))throw Error('Invalid certificate file');
 const bytes=Uint8Array.from(atob(r.base64),c=>c.charCodeAt(0));if(bytes.length>MAX_CERTIFICATE_BYTES)throw Error('Certificate file too large');
 const signature=r.mime==='application/pdf'?[37,80,68,70,45]:r.mime==='image/png'?[137,80,78,71,13,10,26,10]:[255,216,255];
 if(!signature.every((b,i)=>bytes[i]===b))throw Error('Certificate file type mismatch');
 return {name:r.name,mime:r.mime,base64:r.base64};
}
export async function certificateFromFile(file:File){if(file.size>MAX_CERTIFICATE_BYTES)throw Error('Certificate file too large');const bytes=new Uint8Array(await file.arrayBuffer());let data='';for(let i=0;i<bytes.length;i+=8192)data+=String.fromCharCode(...bytes.subarray(i,i+8192));return readCertificateAttachment({name:file.name,mime:file.type,base64:btoa(data)});}
