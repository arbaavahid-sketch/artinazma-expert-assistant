import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import PhysicalPDFButton from '../workspace/PhysicalPDFButton';
import {emptyDensity} from '../workspace/density';
import {physicalKey,preparePhysical,type PhysicalRun} from '../workspace/physical-run';
import {customerFetch} from '@/lib/api';
import {emptyGCData,prepareGCBudget,gcInputKey,type GCRun} from '../workspace/gc-workflow';
vi.mock('@/lib/api',()=>({apiUrl:(s:string)=>s,customerFetch:vi.fn()}));
const data=emptyDensity();data.inputs.mass={nominal:'50',uncertainty:{value:'.01',kind:'standard',divisor:'',source:'mass'}};data.inputs.volume={nominal:'25',uncertainty:{value:'.02',kind:'standard',divisor:'',source:'volume'}};data.independent=true;data.conditions='20 C';data.coverageSource='Hypothetical';
const identity={title:'نمونه',sample:'',sop:'',edition:'',matrix:''};
const run:PhysicalRun={kind:'density',modelVersion:1,inputKey:physicalKey(data,identity),calculatedAt:'2026-11-05T00:00:00Z',...preparePhysical('density',data).expected,engine:'artin-linear-gum',engineVersion:'1'};
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.clearAllMocks();});
it('downloads a PDF only after a valid current run and sends structured data',async()=>{
  URL.createObjectURL=vi.fn(()=> 'blob:pdf-test');URL.revokeObjectURL=vi.fn();const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
  vi.mocked(customerFetch).mockResolvedValue({ok:true,headers:new Headers({'content-type':'application/pdf'}),blob:async()=>({size:10,slice:()=>({text:async()=>'%PDF-'})})} as Response);
  render(<PhysicalPDFButton kind="density" data={data} identity={identity} run={run} en/>);fireEvent.click(screen.getByRole('button',{name:'Download PDF report'}));await waitFor(()=>expect(click).toHaveBeenCalledOnce());const body=JSON.parse(vi.mocked(customerFetch).mock.calls[0][1]!.body as string);expect(body.locale).toBe('en');expect(body.data.conditions).toBe('20 C');expect(body.run).toEqual(run);
});
it('shows an error instead of downloading a failed PDF',async()=>{
  const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});vi.mocked(customerFetch).mockResolvedValue({ok:false} as Response);
  render(<PhysicalPDFButton kind="density" data={data} identity={identity} run={run} en={false}/>);fireEvent.click(screen.getByRole('button',{name:'دریافت گزارش PDF'}));expect(await screen.findByRole('alert')).toHaveTextContent('PDF ساخته نشد');expect(click).not.toHaveBeenCalled();
});
it('rejects a stale snapshot before sending a PDF request',async()=>{
  render(<PhysicalPDFButton kind="density" data={data} identity={{...identity,title:'changed'}} run={run} en/>);fireEvent.click(screen.getByRole('button',{name:'Download PDF report'}));await screen.findByRole('alert');expect(customerFetch).not.toHaveBeenCalled();
});
it('uses the GC endpoint for a current GC run and rejects unverified exports',async()=>{
  const rows=[['0','10'],['5','61'],['10','109'],['15','161']],gc=emptyGCData();gc.values={area:'110',extract:'50',dilution:'2',mass:'10',recovery:'80'};
  for(const key of Object.keys(gc.values) as (keyof typeof gc.values)[])gc.uncertainties[key]={value:'.01',kind:'standard',divisor:'',source:'Hypothetical source'};gc.coverageSource='Hypothetical';
  const {request}=prepareGCBudget(rows,gc);const gcRun:GCRun={inputKey:gcInputKey(rows,gc),calculatedAt:'2026-11-05T00:00:00Z',measured:request.measured,standard:1,expanded:2,coverage:2,engine:'artin-linear-gum',engineVersion:'1'};
  const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});URL.createObjectURL=vi.fn(()=>'blob:gc-pdf');URL.revokeObjectURL=vi.fn();
  vi.mocked(customerFetch).mockResolvedValue({ok:true,headers:new Headers({'content-type':'application/pdf'}),blob:async()=>({size:10,slice:()=>({text:async()=>'%PDF-'})})} as Response);
  const {rerender}=render(<PhysicalPDFButton kind="gc" rows={rows} data={gc} identity={identity} run={gcRun} verified en/>);fireEvent.click(screen.getByRole('button',{name:'Download PDF report'}));await waitFor(()=>expect(click).toHaveBeenCalledOnce());expect(vi.mocked(customerFetch).mock.calls[0][0]).toBe('/uncertainty/gc-report.pdf');const payload=JSON.parse(vi.mocked(customerFetch).mock.calls[0][1]!.body as string);expect(payload.rows).toEqual(rows);expect(payload.data).toEqual(gc);
  vi.mocked(customerFetch).mockClear();rerender(<PhysicalPDFButton kind="gc" rows={rows} data={gc} identity={identity} run={gcRun} verified={false} en/>);fireEvent.click(screen.getByRole('button',{name:'Download PDF report'}));await screen.findByRole('alert');expect(customerFetch).not.toHaveBeenCalled();
});
