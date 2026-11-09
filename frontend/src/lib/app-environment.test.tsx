import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import {Capacitor} from '@capacitor/core';
import {isAppEnvironment} from './app-environment';
import GuestRegistrationCard from '@/components/GuestRegistrationCard';
afterEach(()=>vi.restoreAllMocks());
it('detects native apps, desktop shell and home-screen installations',()=>{
 vi.spyOn(Capacitor,'isNativePlatform').mockReturnValue(true);expect(isAppEnvironment()).toBe(true);
 vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
 Object.defineProperty(window,'artinDesktop',{configurable:true,value:{version:'test'}});expect(isAppEnvironment()).toBe(true);
 Object.defineProperty(window,'artinDesktop',{configurable:true,value:undefined});
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true})));expect(isAppEnvironment()).toBe(true);vi.unstubAllGlobals();
});
it('shows account entry instead of web quota in the app card',()=>{
 render(<GuestRegistrationCard isEn appMode/>);expect(screen.getByRole('link',{name:'Sign in'})).toHaveAttribute('href','/customer-login?next=/assistant');expect(screen.getByRole('link',{name:'Register'})).toBeVisible();expect(screen.queryByText(/free questions/)).toBeNull();expect(screen.getByText(/email and password/)).toBeVisible();
});
