import {Blob as NodeBlob} from 'node:buffer';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const native=vi.hoisted(()=>({enabled:false,available:true,getDocumentCapabilities:vi.fn(),saveCertificate:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>native.enabled,getPlatform:()=> 'android',isPluginAvailable:()=>native.available},registerPlugin:()=>native}));
import {saveCertificateFile} from './calculators/workspace/save-certificate-file';
import {ProjectExportUnavailable} from '@/lib/save-project-file';
const files=[
 {name:'گواهی بچ ۱۲.pdf',mime:'application/pdf',bytes:[37,80,68,70,45,0,128,255]},
 {name:'گواهی.png',mime:'image/png',bytes:[137,80,78,71,13,10,26,10,0,255]},
 {name:'lot certificate.jpeg',mime:'image/jpeg',bytes:[255,216,255,128,0,255]},
].map(f=>({...f,base64:btoa(String.fromCharCode(...f.bytes))}));
beforeEach(()=>{native.enabled=false;native.available=true;native.getDocumentCapabilities.mockReset().mockResolvedValue({protocol:1,saveCertificate:true});native.saveCertificate.mockReset().mockResolvedValue({status:'saved',uri:'content://documents/certificate'});vi.stubGlobal('Blob',NodeBlob);vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn(()=> 'blob:certificate'),revokeObjectURL:vi.fn()}));vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});vi.useFakeTimers();});
afterEach(()=>{vi.runOnlyPendingTimers();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('preserves PDF, PNG and JPEG bytes, MIME and original Unicode filename on the web',async()=>{
 for(const file of files){vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function(this:HTMLAnchorElement){expect(this.download).toBe(file.name);});expect(await saveCertificateFile(file)).toBe('download-started');const blob=vi.mocked(URL.createObjectURL).mock.lastCall![0] as Blob;expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual(file.bytes);expect(blob.type).toBe(file.mime);expect(document.querySelector('a[download]')).toBeNull();}
 vi.advanceTimersByTime(30000);expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);expect(native.saveCertificate).not.toHaveBeenCalled();
});
it('passes the validated original name, MIME and exact base64 to Android for all three types',async()=>{
 native.enabled=true;for(const {name,mime,base64} of files){expect(await saveCertificateFile({name,mime,base64})).toBe('saved');expect(native.saveCertificate).toHaveBeenLastCalledWith({fileName:name,mime,base64});}expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('distinguishes cancellation and refuses old, absent or unsupported native capabilities',async()=>{
 native.enabled=true;native.saveCertificate.mockResolvedValueOnce({status:'cancelled'});expect(await saveCertificateFile(files[0])).toBe('cancelled');native.getDocumentCapabilities.mockResolvedValueOnce({protocol:1,savePdf:true});await expect(saveCertificateFile(files[0])).rejects.toBeInstanceOf(ProjectExportUnavailable);native.getDocumentCapabilities.mockRejectedValueOnce(Error('UNIMPLEMENTED'));await expect(saveCertificateFile(files[0])).rejects.toBeInstanceOf(ProjectExportUnavailable);native.available=false;await expect(saveCertificateFile(files[0])).rejects.toBeInstanceOf(ProjectExportUnavailable);expect(native.saveCertificate).toHaveBeenCalledTimes(1);expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('requires a completed content URI and propagates write failure without a fallback download',async()=>{
 native.enabled=true;for(const result of [{status:'saved'},{status:'saved',uri:'file:///bad'}]){native.saveCertificate.mockResolvedValueOnce(result);await expect(saveCertificateFile(files[0])).rejects.toThrow();}native.saveCertificate.mockRejectedValueOnce(Error('provider write failed'));await expect(saveCertificateFile(files[0])).rejects.toThrow();expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('rejects malformed, disguised, unsafe and oversized attachments before invoking Android',async()=>{
 native.enabled=true;for(const patch of [{name:'../certificate.pdf'},{name:'bad\u0000.pdf'},{mime:'text/html'},{mime:'image/png'},{base64:'%%%%'},{base64:btoa('not PDF')},{base64:btoa('%PDF-'+'a'.repeat(1024*1024))}])await expect(saveCertificateFile({...files[0],...patch})).rejects.toThrow();expect(native.getDocumentCapabilities).not.toHaveBeenCalled();
});
