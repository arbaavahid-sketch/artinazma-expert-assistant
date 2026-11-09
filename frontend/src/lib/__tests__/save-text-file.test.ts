import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const native=vi.hoisted(()=>({enabled:false,getDocumentCapabilities:vi.fn(),saveHtmlDocument:vi.fn(),saveHtml:vi.fn(),saveJson:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>native.enabled,getPlatform:()=> 'android',isPluginAvailable:()=>true},registerPlugin:()=>native}));
import {saveTextFile} from '../save-text-file';
import {ProjectExportUnavailable} from '../save-project-file';
beforeEach(()=>{vi.restoreAllMocks();native.enabled=false;native.getDocumentCapabilities.mockReset().mockResolvedValue({protocol:1,saveHtmlDocument:true,saveJson:true});native.saveHtmlDocument.mockReset().mockResolvedValue({status:'saved',uri:'content://documents/46'});native.saveJson.mockReset().mockResolvedValue({status:'saved',uri:'content://documents/47'});vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn(()=> 'blob:html'),revokeObjectURL:vi.fn()}));vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});vi.useFakeTimers();});
afterEach(()=>{vi.runOnlyPendingTimers();vi.useRealTimers();vi.unstubAllGlobals();});
it('uses the published legacy Android HTML writer only when capability probing is unimplemented',async()=>{
 native.enabled=true;native.saveHtml.mockReset().mockResolvedValueOnce({uri:'content://media/external/downloads/48'}).mockResolvedValueOnce({uri:'file:///storage/emulated/0/Download/a.html'});
 const missing=Object.assign(new Error('Method not implemented'),{code:'UNIMPLEMENTED'});
 for(let i=0;i<2;i++){native.getDocumentCapabilities.mockRejectedValueOnce(missing);expect(await saveTextFile('<html>نمونهٔ فرضی ± ۰٫۱</html>','a.html','html')).toBe('saved');}
 expect(native.saveHtml).toHaveBeenCalledTimes(2);expect(native.saveHtml).toHaveBeenLastCalledWith({html:'<html>نمونهٔ فرضی ± ۰٫۱</html>',fileName:'a.html'});expect(native.saveHtmlDocument).not.toHaveBeenCalled();expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('does not retry modern cancellations, failed saves or handshake failures through the legacy writer',async()=>{
 native.enabled=true;native.saveHtml.mockReset();native.saveHtmlDocument.mockResolvedValueOnce({status:'cancelled'});expect(await saveTextFile('report','a.html','html')).toBe('cancelled');
 native.saveHtmlDocument.mockRejectedValueOnce(Error('write failed'));await expect(saveTextFile('report','a.html','html')).rejects.toThrow('write failed');
 native.getDocumentCapabilities.mockRejectedValueOnce(Error('bridge failed'));await expect(saveTextFile('report','a.html','html')).rejects.toThrow('bridge failed');expect(native.saveHtml).not.toHaveBeenCalled();
});
it('requires a confirmed legacy save and propagates its error without attempting a web download',async()=>{
 native.enabled=true;const missing={code:'UNIMPLEMENTED'};native.saveHtml.mockReset().mockResolvedValueOnce({}).mockRejectedValueOnce(Error('legacy write failed'));
 native.getDocumentCapabilities.mockRejectedValueOnce(missing);await expect(saveTextFile('report','a.html','html')).rejects.toThrow('not confirmed');
 native.getDocumentCapabilities.mockRejectedValueOnce(missing);await expect(saveTextFile('report','a.html','html')).rejects.toThrow('legacy write failed');expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('downloads UTF-8 HTML on the web and removes the temporary link',async()=>{
 expect(await saveTextFile('<html lang="fa">نمونهٔ فرضی</html>','artin-demo.html','html')).toBe('download-started');const blob=vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;expect(blob.type).toBe('text/html;charset=utf-8');expect(document.querySelector('a[download]')).toBeNull();vi.advanceTimersByTime(30000);expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:html');
});
it('preserves HTML and independent reference JSON exactly through their respective native methods',async()=>{
 native.enabled=true;const html='<html dir="rtl">نمونهٔ فرضی ± 0.01</html>',json=JSON.stringify({id:'CHEBI:17790',sourceUrl:'https://www.ebi.ac.uk/chebi/',license:'CC BY 4.0'});expect(await saveTextFile(html,'artin-demo.html','html')).toBe('saved');expect(native.saveHtmlDocument).toHaveBeenCalledWith({html,fileName:'artin-demo.html'});expect(await saveTextFile(json,'artin-CHEBI-17790.json','json')).toBe('saved');expect(native.saveJson).toHaveBeenCalledWith({json,fileName:'artin-CHEBI-17790.json'});expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('distinguishes cancellation, an old plugin and a failed or unconfirmed write',async()=>{
 native.enabled=true;native.saveHtmlDocument.mockResolvedValueOnce({status:'cancelled'});expect(await saveTextFile('report','a.html','html')).toBe('cancelled');native.getDocumentCapabilities.mockResolvedValueOnce({protocol:1,saveJson:true});await expect(saveTextFile('report','a.html','html')).rejects.toBeInstanceOf(ProjectExportUnavailable);native.saveHtmlDocument.mockResolvedValueOnce({status:'saved',uri:'file:///bad'});await expect(saveTextFile('report','a.html','html')).rejects.toThrow();native.saveHtmlDocument.mockRejectedValueOnce(Error('provider failed'));await expect(saveTextFile('report','a.html','html')).rejects.toThrow();expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('rejects empty, unsafe and oversized UTF-8 HTML before opening a picker',async()=>{
 native.enabled=true;for(const [content,name] of [[' ','a.html'],['report','../a.html'],['report','a.json'],['آ'.repeat(7*1024*1024),'a.html']])await expect(saveTextFile(content,name,'html')).rejects.toThrow();expect(native.getDocumentCapabilities).not.toHaveBeenCalled();
});
