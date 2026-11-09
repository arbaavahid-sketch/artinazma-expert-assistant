import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const native=vi.hoisted(()=>({enabled:false,available:true,platform:'android',getDocumentCapabilities:vi.fn(),saveJson:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>native.enabled,getPlatform:()=>native.platform,isPluginAvailable:()=>native.available},registerPlugin:()=>native}));
import {saveProjectJSON,ProjectExportUnavailable} from '../save-project-file';
beforeEach(()=>{vi.restoreAllMocks();native.enabled=false;native.available=true;native.platform='android';native.getDocumentCapabilities.mockReset().mockResolvedValue({protocol:1,saveJson:true});native.saveJson.mockReset().mockResolvedValue({status:'saved',uri:'content://documents/42'});vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn(()=> 'blob:project'),revokeObjectURL:vi.fn()}));vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});vi.useFakeTimers();});
afterEach(()=>{vi.runOnlyPendingTimers();vi.useRealTimers();vi.unstubAllGlobals();});
it('keeps web download behavior and labels it as started, not a confirmed filesystem save',async()=>{
 expect(await saveProjectJSON('{"sample":"فرضی"}','artin-demo.json')).toBe('download-started');expect(native.saveJson).not.toHaveBeenCalled();expect(URL.createObjectURL).toHaveBeenCalled();expect(document.querySelector('a[download]')).toBeNull();vi.advanceTimersByTime(30_000);expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:project');
});
it('passes exact Unicode JSON to the native picker and requires a confirmed saved content URI',async()=>{
 native.enabled=true;const json='{"sample":"نمونهٔ فرضی","value":"1.20"}';expect(await saveProjectJSON(json,'artin-demo.json')).toBe('saved');expect(native.saveJson).toHaveBeenCalledWith({json,fileName:'artin-demo.json'});expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('reports picker cancellation without initiating a browser download',async()=>{
 native.enabled=true;native.saveJson.mockResolvedValue({status:'cancelled'});expect(await saveProjectJSON('{}','artin-demo.json')).toBe('cancelled');expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('fails clearly for old or absent native plugins without attempting a silent webview fallback',async()=>{
 native.enabled=true;native.getDocumentCapabilities.mockRejectedValueOnce(Error('UNIMPLEMENTED'));await expect(saveProjectJSON('{}','artin-demo.json')).rejects.toBeInstanceOf(ProjectExportUnavailable);native.available=false;await expect(saveProjectJSON('{}','artin-demo.json')).rejects.toBeInstanceOf(ProjectExportUnavailable);expect(native.saveJson).not.toHaveBeenCalled();expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('does not report success for native errors, unsupported protocols or missing confirmations',async()=>{
 native.enabled=true;native.getDocumentCapabilities.mockResolvedValueOnce({protocol:2,saveJson:true});await expect(saveProjectJSON('{}','artin-demo.json')).rejects.toBeInstanceOf(ProjectExportUnavailable);
 native.saveJson.mockRejectedValueOnce(Error('provider failed'));await expect(saveProjectJSON('{}','artin-demo.json')).rejects.toThrow();native.saveJson.mockResolvedValueOnce({status:'saved'});await expect(saveProjectJSON('{}','artin-demo.json')).rejects.toThrow();expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('rejects non-JSON content, unsafe file paths and oversized UTF-8 payloads before opening a picker',async()=>{
 native.enabled=true;for(const [json,name] of [['[]','a.json'],['not JSON','a.json'],['{}','../a.json'],['{}','a.html'],['{"x":"'+'آ'.repeat(7*1024*1024)+'"}','a.json']])await expect(saveProjectJSON(json,name)).rejects.toThrow();expect(native.saveJson).not.toHaveBeenCalled();expect(native.getDocumentCapabilities).not.toHaveBeenCalled();
});
