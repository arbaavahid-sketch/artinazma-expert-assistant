import React,{useState} from 'react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import {emptyDensity} from '../workspace/density';
import {preparePhysical,physicalKey,validatePhysicalRun,calculatePhysicalOnServer,type PhysicalRun} from '../workspace/physical-run';
import {usePhysicalCalculation} from '../workspace/usePhysicalCalculation';
import {customerFetch} from '@/lib/api';
import {readLabProject,serializeLabProject} from '../workspace/project-file';
import {buildDensityReport} from '../workspace/density-report';
vi.mock('@/lib/api',()=>({apiUrl:(s:string)=>s,customerFetch:vi.fn()}));
const identity={title:'نمونه',sample:'1',sop:'SOP',matrix:'',edition:''};
function example(){const d=emptyDensity();d.inputs.mass={nominal:'50',uncertainty:{value:'.01',kind:'standard',divisor:'',source:'mass'}};d.inputs.volume={nominal:'25',uncertainty:{value:'.02',kind:'standard',divisor:'',source:'volume'}};d.conditions='20 C';d.coverageSource='Hypothetical';d.independent=true;return d;}
const data=example();
const run:PhysicalRun={kind:'density',modelVersion:1,inputKey:physicalKey(data,identity),calculatedAt:'2026-11-05T00:00:00Z',...preparePhysical('density',data).expected,engine:'builtin',engineVersion:'1'};
const response=()=>({ok:true,json:async()=>({measured:run.measured,standard_uncertainty:run.standard,expanded_uncertainty:run.expanded,coverage:run.coverage,engine:'builtin',engine_version:'1'})}) as Response;
afterEach(()=>{cleanup();vi.clearAllMocks();vi.useRealTimers();});
describe('physical server runs',()=>{
  it('stops a stalled request after the deadline without presenting success',async()=>{
    vi.useFakeTimers();
    vi.mocked(customerFetch).mockImplementationOnce((_url,options)=>new Promise<Response>((_resolve,reject)=>options!.signal!.addEventListener('abort',()=>reject(new Error('aborted')))));
    function Form(){const s=usePhysicalCalculation('density',data,identity);return <><button onClick={()=>void s.calculate()}>Calculate</button>{s.busy&&<p>Busy</p>}{s.failure&&<p>Failure</p>}{s.current&&<p>Verified</p>}</>;}
    render(<Form/>);fireEvent.click(screen.getByText('Calculate'));expect(screen.getByText('Busy')).toBeVisible();await act(async()=>{await vi.advanceTimersByTimeAsync(15001);});expect(screen.getByText('Failure')).toBeVisible();expect(screen.queryByText('Busy')).toBeNull();expect(screen.queryByText('Verified')).toBeNull();
  });
  it('sends the registered density model and rejects tampered responses and stale reports',async()=>{
    vi.mocked(customerFetch).mockResolvedValue(response());
    const actual=await calculatePhysicalOnServer('density',data,identity,new AbortController().signal);
    expect(actual.engine).toBe('builtin');const request=JSON.parse(vi.mocked(customerFetch).mock.calls[0][1]!.body as string);expect(request.measurement_model).toEqual({kind:'density',nominals:[50,25]});expect(JSON.stringify(request)).not.toContain('SOP');
    expect(()=>validatePhysicalRun({...run,standard:run.standard*2},'density',data,identity)).toThrow();expect(()=>validatePhysicalRun(run,'density',data,{...identity,title:'edited'})).toThrow();expect(()=>buildDensityReport({...data,coverage:'3'},identity,true,run.calculatedAt,run)).toThrow();
    vi.mocked(customerFetch).mockResolvedValue({ok:false} as Response);await expect(calculatePhysicalOnServer('density',data,identity,new AbortController().signal)).rejects.toThrow();
  });
  it('preserves the execution snapshot in the versioned project file',()=>{const p=readLabProject({format:'artin-lab-project',version:1,id:'physical-test',savedAt:run.calculatedAt,workflow:'density',density:data,identity,physicalRun:run,evidence:[],standards:[['',''],['',''],['','']],stage:0});expect(readLabProject(JSON.parse(serializeLabProject(p))).physicalRun).toEqual(run);expect(()=>readLabProject({...p,physicalRun:{...run,engine:1}})).toThrow();expect(()=>readLabProject({...p,physicalRun:{...run,kind:'weighing'}})).toThrow();});
  it('does not display an offline result or a late response after an input edit',async()=>{
    let resolve!:(value:Response)=>void;
    vi.mocked(customerFetch).mockImplementationOnce(()=>new Promise<Response>(r=>{resolve=r;}));
    function Form(){const [d,setD]=useState(example);const server=usePhysicalCalculation('density',d,identity);return <><button onClick={()=>void server.calculate()}>Calculate</button><button onClick={()=>setD({...d,coverage:'3'})}>Edit</button>{server.current&&<p>Verified</p>}{server.failure&&<p>Failure</p>}</>;}
    render(<Form/>);fireEvent.click(screen.getByText('Calculate'));fireEvent.click(screen.getByText('Edit'));resolve(response());await waitFor(()=>expect(screen.queryByText('Verified')).toBeNull());
    vi.mocked(customerFetch).mockRejectedValueOnce(new Error('offline'));fireEvent.click(screen.getByText('Calculate'));await screen.findByText('Failure');expect(screen.queryByText('Verified')).toBeNull();
  });
});
