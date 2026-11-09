import {Blob as NodeBlob} from 'node:buffer';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const native=vi.hoisted(()=>({enabled:false,available:true,getDocumentCapabilities:vi.fn(),savePdf:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>native.enabled,getPlatform:()=> 'android',isPluginAvailable:()=>native.available},registerPlugin:()=>native}));
import {savePDFFile} from '../save-pdf-file';
import {ProjectExportUnavailable} from '../save-project-file';
const bytes=new Uint8Array([37,80,68,70,45,49,46,55,10,0,255,128]);
function pdf(){return new NodeBlob([bytes],{type:'application/pdf'}) as unknown as Blob;}
beforeEach(()=>{vi.restoreAllMocks();native.enabled=false;native.available=true;native.getDocumentCapabilities.mockReset().mockResolvedValue({protocol:1,savePdf:true});native.savePdf.mockReset().mockResolvedValue({status:'saved',uri:'content://documents/41'});URL.createObjectURL=vi.fn(()=> 'blob:pdf');URL.revokeObjectURL=vi.fn();vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});vi.useFakeTimers();});
afterEach(()=>{vi.runOnlyPendingTimers();vi.useRealTimers();});
it('starts a browser download with the original binary blob and cleans up its temporary link',async()=>{
 const blob=pdf();expect(await savePDFFile(blob,'artin-report.pdf')).toBe('download-started');expect(URL.createObjectURL).toHaveBeenCalledWith(blob);expect(native.savePdf).not.toHaveBeenCalled();expect(document.querySelector('a[download]')).toBeNull();vi.advanceTimersByTime(30_000);expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf');
});
it('preserves non-text PDF bytes through native base64 transport',async()=>{
 native.enabled=true;expect(await savePDFFile(pdf(),'artin-report.pdf')).toBe('saved');const payload=native.savePdf.mock.calls[0][0];expect(payload.fileName).toBe('artin-report.pdf');expect(Uint8Array.from(atob(payload.base64),(v:string)=>v.charCodeAt(0))).toEqual(bytes);expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('distinguishes cancellation and refuses to silently download through an old Android webview',async()=>{
 native.enabled=true;native.savePdf.mockResolvedValueOnce({status:'cancelled'});expect(await savePDFFile(pdf(),'artin-report.pdf')).toBe('cancelled');native.getDocumentCapabilities.mockResolvedValueOnce({protocol:1,saveJson:true});await expect(savePDFFile(pdf(),'artin-report.pdf')).rejects.toBeInstanceOf(ProjectExportUnavailable);expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('requires a confirmed content URI and propagates native write failure',async()=>{
 native.enabled=true;native.savePdf.mockResolvedValueOnce({status:'saved',uri:'file:///not-accepted'});await expect(savePDFFile(pdf(),'a.pdf')).rejects.toThrow();native.savePdf.mockRejectedValueOnce(Error('provider write failed'));await expect(savePDFFile(pdf(),'a.pdf')).rejects.toThrow('provider write failed');
});
it('rejects incorrect signatures, oversized data and unsafe filenames before opening a picker',async()=>{
 native.enabled=true;for(const [blob,name] of [[new NodeBlob(['not a PDF']),'a.pdf'],[pdf(),'../a.pdf'],[pdf(),'a.html'],[new NodeBlob(['%PDF-',new Uint8Array(5*1024*1024)]),'a.pdf']] as const)await expect(savePDFFile(blob as unknown as Blob,name)).rejects.toThrow();expect(native.getDocumentCapabilities).not.toHaveBeenCalled();expect(native.savePdf).not.toHaveBeenCalled();
});
