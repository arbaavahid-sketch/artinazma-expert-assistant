import React from 'react';
import {it,expect,vi,beforeEach} from 'vitest';
import {render,screen,fireEvent,within} from '@testing-library/react';
import {NextRequest} from 'next/server';
import OccupationalReference from './calculators/workspace/OccupationalReference';
import fixture from './calculators/__tests__/fixtures/occupational-methanol.json';
const response=(d:unknown,status=200)=>new Response(JSON.stringify(d),{status});
const candidate={id:'0397',en:'Methyl alcohol',fa:'متانول',cas:'67-56-1',formula:'CH3OH'};
beforeEach(()=>{vi.restoreAllMocks();vi.resetModules();});
it('requires explicit selection and separates recommended, reported regulatory and acute limits',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(response({...fixture,record:undefined,records:[candidate],coverageCount:12})).mockResolvedValueOnce(response(fixture));vi.stubGlobal('fetch',fetcher);
 render(<OccupationalReference en initialQuery="methanol"/>);expect(screen.getByText(/reviewed snapshot covers selected substances/)).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Search reviewed snapshot'}));
 const button=await screen.findByRole('button',{name:/Methyl alcohol CAS 67-56-1/});expect(screen.getByText('Current snapshot coverage: 12 selected substances')).toBeInTheDocument();expect(fetcher).toHaveBeenCalledTimes(1);expect(screen.queryByRole('article')).toBeNull();fireEvent.click(button);
 await screen.findByRole('article',{name:'Occupational exposure record'});
 const rel=screen.getByRole('region',{name:'NIOSH REL'}),pel=screen.getByRole('region',{name:'OSHA PEL'}),idlh=screen.getByRole('region',{name:'NIOSH IDLH'});
 expect(rel).toHaveTextContent('250 ppm');expect(rel).toHaveTextContent('[skin]');expect(pel).not.toHaveTextContent('250 ppm');expect(pel).toHaveTextContent('as reported by NPG');expect(idlh).toHaveTextContent('6000 ppm');expect(within(pel).getByRole('link')).toHaveAttribute('href',fixture.record.limits[1].regulationUrl);
 expect(screen.getByText(/Snapshot checked:/)).toHaveTextContent('2026-11-07');expect(screen.getByText(/Source page’s stated review date:/)).toHaveTextContent('2019-10-30');expect(screen.getByText(/not a live retrieval/)).toBeInTheDocument();
});
it('states that an uncovered substance is unknown and does not fabricate a zero or acceptable result',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({...fixture,record:undefined,records:[]})));render(<OccupationalReference en={false} initialQuery="ناشناخته"/>);fireEvent.click(screen.getByRole('button',{name:'جست‌وجو در نسخهٔ بازبینی‌شده'}));await screen.findByText('رکوردی در پوشش این نسخه پیدا نشد.');expect(screen.queryByRole('article')).toBeNull();expect(screen.getByText(/نبود نتیجه، به معنی نبود حد/)).toBeInTheDocument();});
it('discards late results after a newer search in the same mounted form',async()=>{
 let finish!:(r:Response)=>void;const delayed=new Promise<Response>(r=>{finish=r;});vi.stubGlobal('fetch',vi.fn().mockReturnValueOnce(delayed).mockResolvedValueOnce(response({...fixture,record:undefined,records:[]})));
 render(<OccupationalReference en initialQuery="methanol"/>);fireEvent.click(screen.getByRole('button',{name:'Search reviewed snapshot'}));fireEvent.change(screen.getByLabelText('Substance name or CAS in NIOSH reference'),{target:{value:'uncovered'}});fireEvent.keyDown(screen.getByLabelText('Substance name or CAS in NIOSH reference'),{key:'Enter'});await screen.findByText('No record in this snapshot’s coverage.');finish(response({...fixture,record:undefined,records:[candidate]}));expect(screen.queryByRole('button',{name:/Methyl alcohol CAS/})).toBeNull();
});
it('handles source errors without showing an old record',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({},503)));render(<OccupationalReference en/>);fireEvent.click(screen.getByRole('button',{name:'Search reviewed snapshot'}));await screen.findByRole('alert');expect(screen.queryByRole('article')).toBeNull();});
it('validates the gateway and retains snapshot metadata from the backend',async()=>{
 const fetcher=vi.fn().mockResolvedValue(response(fixture));vi.stubGlobal('fetch',fetcher);const {GET}=await import('./api/chemicals/occupational/route');
 for(const q of ['record_id=../x','record_id=0397&q=methanol','q='+('x'.repeat(121))])expect((await GET(new NextRequest('http://localhost/api/chemicals/occupational?'+q))).status).toBe(400);
 expect(fetcher).not.toHaveBeenCalled();const r=await GET(new NextRequest('http://localhost/api/chemicals/occupational?record_id=0397'));expect(r.status).toBe(200);expect(await r.json()).toMatchObject({delivery:'reviewed_snapshot',checkedOn:'2026-11-07',fetchedAt:null});expect(r.headers.get('Cache-Control')).toBe('no-store');
});
