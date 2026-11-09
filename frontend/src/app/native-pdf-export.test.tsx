import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const save=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/save-pdf-file',()=>({savePDFFile:save}));
vi.mock('@/lib/api',()=>({apiUrl:(s:string)=>s,customerFetch:vi.fn()}));
import {customerFetch} from '@/lib/api';
import {ProjectExportUnavailable} from '@/lib/save-project-file';
import PhysicalPDFButton from './calculators/workspace/PhysicalPDFButton';
import {emptyDensity} from './calculators/workspace/density';
import {physicalKey,preparePhysical,type PhysicalRun} from './calculators/workspace/physical-run';
const identity={title:'Synthetic PDF native test',sample:'DEMO-PDF-46',sop:'',edition:'',matrix:''};
const data=emptyDensity();data.inputs.mass={nominal:'50',uncertainty:{value:'.01',kind:'standard',divisor:'',source:'synthetic mass'}};data.inputs.volume={nominal:'25',uncertainty:{value:'.02',kind:'standard',divisor:'',source:'synthetic volume'}};data.independent=true;data.conditions='synthetic conditions';data.coverageSource='synthetic coverage';
const run:PhysicalRun={kind:'density',modelVersion:1,inputKey:physicalKey(data,identity),calculatedAt:'2026-11-08T00:00:00Z',...preparePhysical('density',data).expected,engine:'artin-linear-gum',engineVersion:'1'};
beforeEach(()=>{vi.clearAllMocks();save.mockReset();vi.mocked(customerFetch).mockResolvedValue({ok:true,headers:new Headers({'content-type':'application/pdf'}),blob:async()=>({size:10,slice:()=>({text:async()=>'%PDF-'})})} as Response);});
afterEach(()=>{cleanup();vi.useRealTimers();});
function form(){render(<PhysicalPDFButton kind="density" data={data} identity={identity} run={run} en/>);fireEvent.click(screen.getByRole('button',{name:'Download PDF report'}));}
it('does not expire the request timer while the user is choosing the document destination',async()=>{
 vi.useFakeTimers();let finish!:(result:string)=>void;save.mockReturnValue(new Promise<string>(resolve=>{finish=resolve;}));form();await act(async()=>{});expect(save).toHaveBeenCalledTimes(1);const signal=vi.mocked(customerFetch).mock.calls[0][1]!.signal!;act(()=>vi.advanceTimersByTime(25_000));expect(signal.aborted).toBe(false);await act(async()=>finish('cancelled'));expect(screen.getByRole('status')).toHaveTextContent('PDF save cancelled');expect(screen.queryByRole('alert')).toBeNull();
});
it('explains a missing PDF capability without a false report-generation error',async()=>{
 save.mockRejectedValue(new ProjectExportUnavailable());form();expect(await screen.findByRole('alert')).toHaveTextContent('use the web version or update the app package');expect(screen.queryByText(/PDF could not be generated/)).toBeNull();
});
it('confirms only a completed native save and reports a write failure without success',async()=>{
 save.mockResolvedValueOnce('saved').mockRejectedValueOnce(Error('write failed'));form();await screen.findByText('The selected PDF was saved.');fireEvent.click(screen.getByRole('button',{name:'Download PDF report'}));await screen.findByRole('alert');expect(screen.queryByText('The selected PDF was saved.')).toBeNull();
});
