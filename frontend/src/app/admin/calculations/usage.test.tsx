import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import Usage from './page';
vi.mock('@/lib/i18n',()=>({useI18n:()=>({locale:'en',dir:'ltr'})}));
afterEach(()=>vi.unstubAllGlobals());
const data={summary:{total:26,success:25,errors:1,customers:1,today:4},items:[{id:'synthetic',created_at:'2026-11-09T07:00:00Z',customer_id:7,actor_kind:'customer',visitor_label:null,full_name:'Synthetic customer',email:'qa@example.invalid',phone:'09120000000',tool:'gum-budget',title:'بودجه',title_en:'GUM uncertainty budget',status:'success',execution:'server',source:'calculator',duration_ms:10,summary:{measured:10}}]};
it('displays the user and execution source and filters with authenticated admin proxy URLs',async()=>{
 const fetcher=vi.fn(async(_url:RequestInfo|URL)=>new Response(JSON.stringify(data)));vi.stubGlobal('fetch',fetcher);render(<Usage/>);await screen.findByText('Synthetic customer');expect(screen.getByText('qa@example.invalid')).toBeVisible();expect(screen.getByText(/Calculator.*Server execution/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Next'}));await waitFor(()=>expect(fetcher.mock.calls.some(c=>String(c[0]).includes('offset=25'))).toBe(true));
 fireEvent.change(screen.getByLabelText('Name, email, phone or tool'),{target:{value:'qa@example.invalid'}});fireEvent.click(screen.getByRole('button',{name:'Apply filters'}));await waitFor(()=>expect(fetcher.mock.calls.some(c=>String(c[0]).includes('q=qa%40example.invalid')&&String(c[0]).includes('offset=0'))).toBe(true));
 expect(String(fetcher.mock.calls[0][0])).toContain('/api/admin-proxy/admin/calculation-activity');
});
it('shows an access error without a misleading empty report',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:401})));render(<Usage/>);await screen.findByRole('alert');expect(screen.getByRole('link',{name:'Sign in again'})).toHaveAttribute('href','/admin-login?next=/admin/calculations');expect(screen.queryByText(/No calculation usage matches/)).toBeNull();
});
