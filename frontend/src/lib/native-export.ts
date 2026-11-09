import {registerPlugin} from '@capacitor/core';
type NativeExportPlugin={
 saveHtml(options:{html:string;fileName:string}):Promise<{uri?:string}>;
 printHtml(options:{html:string;fileName:string}):Promise<void>;
 shareHtml(options:{html:string;fileName:string}):Promise<void>;
 getDocumentCapabilities():Promise<{protocol:number;saveJson:boolean;savePdf?:boolean;saveHtmlDocument?:boolean;saveCertificate?:boolean}>;
 saveJson(options:{json:string;fileName:string}):Promise<{status:'saved'|'cancelled';uri?:string}>;
 savePdf(options:{base64:string;fileName:string}):Promise<{status:'saved'|'cancelled';uri?:string}>;
 saveCertificate(options:{base64:string;fileName:string;mime:'application/pdf'|'image/png'|'image/jpeg'}):Promise<{status:'saved'|'cancelled';uri?:string}>;
 saveHtmlDocument(options:{html:string;fileName:string}):Promise<{status:'saved'|'cancelled';uri?:string}>;
};
export const NativeExport=registerPlugin<NativeExportPlugin>('NativeExport');
