import {beforeEach,expect,it,vi} from 'vitest';
import {waitFor} from '@testing-library/react';
vi.mock('./api',()=>({apiUrl:(p:string)=>p,backendFetch:vi.fn()}));
beforeEach(()=>{vi.resetModules();});
it('records only an explicit calculation with no inputs or client identity, and serializes initialization',async()=>{
 const {backendFetch}=await import('./api');vi.mocked(backendFetch).mockImplementation(async()=>new Response('{}'));
 const {observeCalculation}=await import('./calculation-activity');expect(observeCalculation('precision',()=>42)).toBe(42);expect(()=>observeCalculation('precision',()=>{throw Error('private input');})).toThrow('private input');
 await waitFor(()=>expect(vi.mocked(backendFetch).mock.calls.filter(c=>c[0]==='/calculation-activity')).toHaveLength(2));
 const payloads=vi.mocked(backendFetch).mock.calls.filter(c=>c[0]==='/calculation-activity').map(c=>JSON.parse(String(c[1]?.body)));
 expect(payloads.map(p=>p.status)).toEqual(['success','error']);expect(Object.keys(payloads[0]).sort()).toEqual(['event_id','status','title','tool']);expect(payloads[0].event_id).not.toBe(payloads[1].event_id);expect(JSON.stringify(payloads)).not.toContain('private');
});
it('does not change the result when usage recording fails',async()=>{
 const {backendFetch}=await import('./api');vi.mocked(backendFetch).mockRejectedValue(new Error('offline'));
 const {observeCalculation}=await import('./calculation-activity');expect(observeCalculation('solution',()=>5)).toBe(5);await waitFor(()=>expect(backendFetch).toHaveBeenCalled());
});
