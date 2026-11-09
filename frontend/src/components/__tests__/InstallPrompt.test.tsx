import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({native:false,standalone:false}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>state.native}}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({locale:'en',dir:'ltr'})}));
import InstallPrompt from '../InstallPrompt';
beforeEach(()=>{sessionStorage.clear();state.native=false;state.standalone=false;vi.useFakeTimers();vi.stubGlobal('matchMedia',vi.fn(()=>({matches:state.standalone})));vi.spyOn(navigator,'userAgent','get').mockReturnValue('iPhone Safari');});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('offers the Safari guide without a beforeinstallprompt event and remembers dismissal',()=>{
 render(<InstallPrompt/>);act(()=>vi.advanceTimersByTime(3000));expect(screen.getByRole('link',{name:'Install guide'})).toHaveAttribute('href','/install');
 expect(screen.queryByRole('button',{name:/^Install$/})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Close'}));expect(sessionStorage.getItem('pwa_install_dismissed')).toBe('1');expect(screen.queryByText('Artin on your Home Screen')).toBeNull();
});
it('never shows install instructions in a native shell or an already standalone window',()=>{
 state.native=true;const first=render(<InstallPrompt/>);act(()=>vi.advanceTimersByTime(3000));expect(first.container).toBeEmptyDOMElement();first.unmount();state.native=false;state.standalone=true;const second=render(<InstallPrompt/>);act(()=>vi.advanceTimersByTime(3000));expect(second.container).toBeEmptyDOMElement();
});
it('clears the delayed banner on install and on unmount',()=>{
 const first=render(<InstallPrompt/>);act(()=>window.dispatchEvent(new Event('appinstalled')));act(()=>vi.advanceTimersByTime(3000));expect(first.container).toBeEmptyDOMElement();first.unmount();const second=render(<InstallPrompt/>);second.unmount();expect(vi.getTimerCount()).toBe(0);
});
