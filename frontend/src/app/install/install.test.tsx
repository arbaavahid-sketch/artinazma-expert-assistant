import React from 'react';
import {fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('@/lib/i18n',()=>({useI18n:()=>({locale:'en',dir:'ltr'})}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>false}}));
import Install from './page';
beforeEach(()=>{vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));});
afterEach(()=>vi.unstubAllGlobals());
it('gives manual Safari steps and switches to Android guidance without claiming installation',()=>{
 render(<Install/>);expect(screen.getByRole('heading',{name:'Tap Share'})).toBeVisible();expect(screen.getByText(/Open as Web App appears/)).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Android'}));expect(screen.getByRole('heading',{name:'Open in Chrome'})).toBeVisible();expect(screen.queryByRole('status')).toBeNull();
});
it('shows an honest copy failure without a false success',async()=>{
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(Error('denied'))}});render(<Install/>);fireEvent.click(screen.getByRole('button',{name:'Copy installation link'}));expect(await screen.findByRole('alert')).toHaveTextContent('Copy this page');expect(screen.queryByRole('status')).toBeNull();
});
