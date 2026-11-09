import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {RestoredListenerEvent} from '@capacitor/app';
const native=vi.hoisted(()=>({enabled:true,listen:vi.fn(),remove:vi.fn(),callback:undefined as undefined|((e:RestoredListenerEvent)=>void)}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>native.enabled}}));
vi.mock('@capacitor/app',()=>({App:{addListener:native.listen}}));
import NativeDocumentRecovery from './NativeDocumentRecovery';
beforeEach(()=>{native.enabled=true;native.callback=undefined;native.remove.mockReset();native.listen.mockReset().mockImplementation(async(_name:string,callback:(e:RestoredListenerEvent)=>void)=>{native.callback=callback;return {remove:native.remove};});});
afterEach(cleanup);
async function mount(en=false){const view=render(<NativeDocumentRecovery en={en}/>);await act(async()=>{});return view;}
it('announces a confirmed restored export and explains how to resume without claiming draft restoration',async()=>{
 await mount();act(()=>native.callback!({pluginId:'NativeExport',methodName:'saveJson',success:true,data:{status:'saved',uri:'content://documents/qa'}}));expect(screen.getByRole('status')).toHaveTextContent('ذخیرهٔ فایل قبلی');expect(screen.getByRole('status')).toHaveTextContent('ورودی‌های ذخیره‌نشدهٔ فرم خودکار بازیابی نمی‌شوند');fireEvent.click(screen.getByRole('button',{name:'بستن پیام ذخیره'}));expect(screen.queryByRole('status')).toBeNull();
});
it('ignores unrelated methods and does not announce success without a content URI',async()=>{
 await mount(true);act(()=>native.callback!({pluginId:'OtherPlugin',methodName:'saveJson',success:true,data:{status:'saved'}}));expect(screen.queryByRole('alert')).toBeNull();act(()=>native.callback!({pluginId:'NativeExport',methodName:'shareHtml',success:true,data:{status:'saved'}}));expect(screen.queryByRole('status')).toBeNull();act(()=>native.callback!({pluginId:'NativeExport',methodName:'savePdf',success:true,data:{status:'saved'}}));expect(screen.getByRole('alert')).toHaveTextContent('could not be confirmed');
});
it('distinguishes restored cancellation from failed saves and removes its listener on unmount',async()=>{
 const view=await mount(true);act(()=>native.callback!({pluginId:'NativeExport',methodName:'saveCertificate',success:true,data:{status:'cancelled'}}));expect(screen.getByRole('status')).toHaveTextContent('cancelled');act(()=>native.callback!({pluginId:'NativeExport',methodName:'saveHtmlDocument',success:false,data:{},error:{message:'private provider path'}}));expect(screen.getByRole('alert')).toHaveTextContent('could not be confirmed');expect(screen.queryByText(/private provider/)).toBeNull();view.unmount();expect(native.remove).toHaveBeenCalledTimes(1);
});
it('does not register a native listener in the web browser',async()=>{
 native.enabled=false;await mount();expect(native.listen).not.toHaveBeenCalled();
});
