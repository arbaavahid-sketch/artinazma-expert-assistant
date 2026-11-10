import React from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import ApprovedCustomerGate from '../ApprovedCustomerGate';
import {backendFetch} from '@/lib/api';
vi.mock('@/lib/api',()=>({apiUrl:(p:string)=>p,backendFetch:vi.fn()}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({locale:'en',dir:'ltr'})}));
beforeEach(()=>{vi.clearAllMocks();window.history.replaceState(null,'','/calculators?chemical=198139');});
it('never mounts a calculator before real approval and preserves the destination for login',async()=>{
 let respond:(value:Response)=>void=()=>{};vi.mocked(backendFetch).mockReturnValue(new Promise(resolve=>{respond=resolve;}));const child=vi.fn(()=> <p>Private calculator</p>);
 render(<ApprovedCustomerGate>{React.createElement(child)}</ApprovedCustomerGate>);expect(child).not.toHaveBeenCalled();respond(new Response('{}',{status:401}));
 const login=await screen.findByRole('link',{name:'Sign in'});expect(login).toHaveAttribute('href','/customer-login?next=%2Fcalculators%3Fchemical%3D198139');expect(child).not.toHaveBeenCalled();
});
it('rejects a pending account even with a localStorage customer and checks revoked approval on focus',async()=>{
 localStorage.setItem('artin_customer',JSON.stringify({id:7}));vi.mocked(backendFetch).mockResolvedValueOnce(new Response('{}',{status:403}));
 render(<ApprovedCustomerGate><p>Private calculator</p></ApprovedCustomerGate>);await screen.findByText(/not been approved/);expect(screen.queryByText('Private calculator')).toBeNull();
 vi.mocked(backendFetch).mockResolvedValueOnce(new Response('{"approved":true,"customer_id":7}'));fireEvent.click(screen.getByRole('button',{name:'Check again'}));await screen.findByText('Private calculator');
 vi.mocked(backendFetch).mockResolvedValueOnce(new Response('{}',{status:403}));fireEvent(window,new Event('focus'));await waitFor(()=>expect(screen.getByText('Private calculator')).not.toBeVisible());localStorage.clear();
});
it('fails closed on a network error',async()=>{
 vi.mocked(backendFetch).mockRejectedValue(new Error('offline'));render(<ApprovedCustomerGate><p>Private calculator</p></ApprovedCustomerGate>);await screen.findByText(/could not be checked/);expect(screen.queryByText('Private calculator')).toBeNull();
});
