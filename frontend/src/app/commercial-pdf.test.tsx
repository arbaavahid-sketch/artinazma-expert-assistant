import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import CommercialPDFButton from './calculators/workspace/CommercialPDFButton';
import {newSolutionDraft,chemicals} from './calculators/workspace/chemical-library';
import {emptyCommercial,linkCommercialReagent} from './calculators/workspace/commercial-solution';
import {newReagent} from './calculators/workspace/reagents';
vi.mock('@/lib/api',()=>({apiUrl:(p:string)=>p,customerFetch:(...args:unknown[])=>fetch(...args as Parameters<typeof fetch>)}));
afterEach(()=>vi.unstubAllGlobals());
function fixture(){const r={...newReagent(),name:'Example',lot:'LOT1',certificate:'CoA1',purity:'50%',purityBasis:'w/w'};return {...newSolutionDraft(chemicals[0]),commercial:{...linkCommercialReagent({...emptyCommercial(),density:'1',densitySource:'Example density',densityConditions:'20 C',target:'1',volume:'100'},r),sameSpecies:true}};}
it('disables export for incomplete commercial data',()=>{render(<CommercialPDFButton en draft={newSolutionDraft(chemicals[0])}/>);expect(screen.getByRole('button')).toBeDisabled();});
it('shows a failure instead of downloading an error response',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));render(<CommercialPDFButton en draft={fixture()}/>);fireEvent.click(screen.getByRole('button'));expect(await screen.findByRole('alert')).toHaveTextContent('could not be generated');expect(screen.getByRole('button')).not.toBeDisabled();});
it('aborts in-flight exports when the input changes',async()=>{let signal:AbortSignal;vi.stubGlobal('fetch',vi.fn((_url,opts)=>{signal=opts.signal;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));}));const d=fixture();const view=render(<CommercialPDFButton en draft={d}/>);fireEvent.click(screen.getByRole('button'));await waitFor(()=>expect(fetch).toHaveBeenCalledOnce());view.rerender(<CommercialPDFButton en draft={{...d,commercial:{...d.commercial,volume:'200'}}}/> );expect(signal!.aborted).toBe(true);await waitFor(()=>expect(screen.getByRole('button')).not.toBeDisabled());expect(screen.queryByRole('alert')).toBeNull();});

it('submits current product evidence and rejects a non-PDF body',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,headers:new Headers({'Content-Type':'application/pdf'}),blob:async()=>({size:10,slice:()=>({text:async()=>'<html'})})}));render(<CommercialPDFButton en draft={fixture()}/>);fireEvent.click(screen.getByRole('button'));expect(await screen.findByRole('alert')).toHaveTextContent('could not be generated');const [url,opts]=vi.mocked(fetch).mock.calls[0];expect(url).toBe('/uncertainty/commercial-report.pdf');const body=JSON.parse(opts!.body as string);expect(body.commercial.reagent.lot).toBe('LOT1');expect(body.commercial.densityConditions).toBe('20 C');expect(body.expectedAliquot).toBeCloseTo(11.688);expect(body.molarMass).toBe('58.44');});
