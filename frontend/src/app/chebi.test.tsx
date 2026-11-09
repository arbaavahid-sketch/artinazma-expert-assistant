import React from 'react';
import {it,expect,vi,beforeEach} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {NextRequest} from 'next/server';
import ChebiExplorer from './calculators/workspace/ChebiExplorer';
import record from './calculators/__tests__/fixtures/chebi-record.json';
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
const candidate={id:record.id,name:record.name,formula:record.formula,charge:0,inchiKey:record.inchiKey,stars:3};
beforeEach(()=>{vi.restoreAllMocks();vi.resetModules();});
it('requires explicit selection after search and keeps source dates, direction and license',async()=>{
 const mock=vi.fn().mockResolvedValueOnce(response({records:[candidate,{...candidate,id:'CHEBI:52090',name:'methoxide'}],total:2,page:1})).mockResolvedValueOnce(response(record));vi.stubGlobal('fetch',mock);
 render(<ChebiExplorer en/>);fireEvent.change(screen.getByLabelText('Search ChEBI'),{target:{value:'methanol'}});fireEvent.click(screen.getByRole('button',{name:'Search ChEBI database'}));
 await screen.findByRole('button',{name:/^methanol CHEBI:17790/});expect(mock).toHaveBeenCalledTimes(1);expect(screen.queryByRole('article')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/^methanol CHEBI:17790/}));await screen.findByRole('article',{name:'Selected ChEBI record'});
 expect(screen.getByText('2018-07-19T14:41:20Z')).toBeInTheDocument();expect(screen.getByText('2026-11-07T10:00:00Z')).toBeInTheDocument();expect(screen.getByRole('link',{name:'CC BY 4.0'})).toHaveAttribute('href','https://creativecommons.org/licenses/by/4.0/');expect(screen.getAllByText('Incoming relationship').length).toBeGreaterThan(0);expect(screen.getAllByText('Outgoing relationship').length).toBeGreaterThan(0);
});
it('searches the full PubChem key explicitly and reports a different salt or isomer without linking',async()=>{
 const mock=vi.fn(async(url:string)=>response(url.includes('section=identity')?{record:{CID:887,InChIKey:record.inchiKey}}:url.includes('chebi_id')?{...record,match:'different'}:{records:[candidate],total:1,page:1}));vi.stubGlobal('fetch',mock);
 render(<ChebiExplorer en initialQuery="methanol" pubchemCid={887}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Search this compound’s structure'})).toBeEnabled());expect(mock).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Search this compound’s structure'}));await screen.findByRole('button',{name:/^methanol CHEBI:17790/});expect(decodeURIComponent(String(mock.mock.calls[1][0]))).toContain(record.inchiKey!);
 fireEvent.click(screen.getByRole('button',{name:/^methanol CHEBI:17790/}));await screen.findByText(/InChIKey differs/);expect(String(mock.mock.calls[2][0])).toContain('expected_key='+record.inchiKey);
});
it('ignores a late aborted search and handles empty results without choosing a record',async()=>{
 let finish!:(r:Response)=>void;const delayed=new Promise<Response>(r=>{finish=r;});const mock=vi.fn().mockReturnValueOnce(delayed).mockResolvedValueOnce(response({records:[],total:0,page:1}));vi.stubGlobal('fetch',mock);
 const e=render(<ChebiExplorer en initialQuery="methanol"/>);fireEvent.click(screen.getByRole('button',{name:'Search ChEBI database'}));e.unmount();render(<ChebiExplorer en initialQuery="empty"/>);fireEvent.click(screen.getByRole('button',{name:'Search ChEBI database'}));await screen.findByText('No results found.');finish(response({records:[candidate],total:1,page:1}));expect(screen.queryByRole('article')).toBeNull();
});
it('shows controlled source failures in Persian',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({},429)));render(<ChebiExplorer en={false} initialQuery="methanol"/>);fireEvent.click(screen.getByRole('button',{name:'جست‌وجو در ChEBI'}));await screen.findByRole('alert');expect(screen.getByRole('alert')).toHaveTextContent('منبع مشغول است');});
it('validates the server gateway before network calls and preserves backend errors',async()=>{
 const mock=vi.fn().mockResolvedValue(response({detail:'busy'},429));vi.stubGlobal('fetch',mock);const {GET}=await import('./api/chemicals/chebi/route');
 for(const query of ['q=x','chebi_id=../x','q=methanol&chebi_id=17790','chebi_id=17790&expected_key=partial','q=methanol&page=0'])expect((await GET(new NextRequest('http://localhost/api/chemicals/chebi?'+query))).status).toBe(400);
 expect(mock).not.toHaveBeenCalled();const r=await GET(new NextRequest('http://localhost/api/chemicals/chebi?q=methanol'));expect(r.status).toBe(429);expect(r.headers.get('Retry-After')).toBe('10');expect(String(mock.mock.calls[0][0])).toContain('/chemicals/chebi?q=methanol');
});
