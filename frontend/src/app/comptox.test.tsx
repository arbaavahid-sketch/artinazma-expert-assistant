import React from 'react';
import {it,expect,vi,beforeEach} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {NextRequest} from 'next/server';
import ComptoxReference from './calculators/workspace/ComptoxReference';
const response=(d:unknown,status=200)=>new Response(JSON.stringify(d),{status});
const record={id:'DTXSID7020182',name:'Synthetic contract example',cas:null,dtxcid:null,smiles:null,fetchedAt:'2026-11-08T08:00:00Z',sourceUpdatedAt:null,sourceVersion:null,scope:'explicit_dtxsid_identity',structuralMatch:'unverified'};
beforeEach(()=>{vi.restoreAllMocks();vi.resetModules();});
it('lets a failed configuration check recover without a page reload',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(response({configured:false})));render(<ComptoxReference en/>);
 await screen.findByText('Connection status could not be checked.');fireEvent.click(screen.getByRole('button',{name:'Check connection again'}));await screen.findByText(/key is not configured on the server/);
});
it('shows missing configuration without inventing records and keeps official dashboard access available',async()=>{
 const fetcher=vi.fn().mockResolvedValue(response({configured:false}));vi.stubGlobal('fetch',fetcher);render(<ComptoxReference en={false}/>);
 await screen.findByText(/کلید CompTox هنوز روی سرور تنظیم نشده/);
 fireEvent.change(screen.getByLabelText('DTXSID'),{target:{value:'DTXSID7020182'}});
 expect(screen.getByRole('button',{name:'دریافت رکورد EPA'})).toBeDisabled();
 expect(screen.getByRole('link',{name:/بازکردن همین شناسه/})).toHaveAttribute('href','https://comptox.epa.gov/dashboard/chemical/details/DTXSID7020182');
 expect(screen.queryByRole('article')).toBeNull();expect(fetcher).toHaveBeenCalledTimes(1);
});
it('retrieves only an explicit identifier and shows missing data and unverified matching',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(response({configured:true})).mockResolvedValueOnce(response(record));vi.stubGlobal('fetch',fetcher);render(<ComptoxReference en/>);
 await screen.findByText(/A server key is configured/);fireEvent.change(screen.getByLabelText('DTXSID'),{target:{value:'dtxsid7020182'}});fireEvent.click(screen.getByRole('button',{name:'Retrieve EPA record'}));
 await screen.findByRole('article',{name:'CompTox record'});expect(fetcher.mock.calls[1][0]).toBe('/api/chemicals/comptox?dtxsid=DTXSID7020182');
 expect(screen.getByRole('article')).toHaveTextContent('About record matching');expect(screen.getAllByText('Not reported')).toHaveLength(3);
 fireEvent.change(screen.getByLabelText('DTXSID'),{target:{value:'DTXSID0000000'}});expect(screen.queryByRole('article')).toBeNull();
});
it('discards an in-flight response after the identifier is edited',async()=>{
 let finish!:(r:Response)=>void;const delayed=new Promise<Response>(r=>{finish=r;});vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response({configured:true})).mockReturnValueOnce(delayed));render(<ComptoxReference en/>);
 await screen.findByText(/A server key is configured/);fireEvent.change(screen.getByLabelText('DTXSID'),{target:{value:record.id}});fireEvent.click(screen.getByRole('button',{name:'Retrieve EPA record'}));fireEvent.change(screen.getByLabelText('DTXSID'),{target:{value:'DTXSID0000000'}});finish(response(record));expect(screen.queryByRole('article')).toBeNull();
});
it('shows authentication failure without displaying an old or sample record',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response({configured:true})).mockResolvedValueOnce(response({},503)));render(<ComptoxReference en/>);await screen.findByText(/A server key is configured/);fireEvent.change(screen.getByLabelText('DTXSID'),{target:{value:record.id}});fireEvent.click(screen.getByRole('button',{name:'Retrieve EPA record'}));expect(await screen.findByRole('alert')).toHaveTextContent('key configuration or validity');expect(screen.queryByRole('article')).toBeNull();
});
it('gateway rejects paths and never forwards a browser-supplied key or upstream error content',async()=>{
 const fetcher=vi.fn().mockResolvedValue(response({detail:'private upstream diagnostic'},503));vi.stubGlobal('fetch',fetcher);const {GET}=await import('./api/chemicals/comptox/route');
 expect((await GET(new NextRequest('http://localhost/api/chemicals/comptox?dtxsid=../bad'))).status).toBe(400);expect(fetcher).not.toHaveBeenCalled();
 const result=await GET(new NextRequest('http://localhost/api/chemicals/comptox?dtxsid='+record.id+'&api_key=browser-secret',{headers:{'x-api-key':'browser-secret'}}));
 expect(result.status).toBe(503);expect(await result.json()).toEqual({error:'not_ready'});expect(JSON.stringify(fetcher.mock.calls)).not.toContain('browser-secret');expect(result.headers.get('Cache-Control')).toBe('no-store');
});
