import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import SolutionPDFButton from './calculators/workspace/SolutionPDFButton';
import {newSolutionDraft,chemicals} from './calculators/workspace/chemical-library';
import {emptyStockPreparation} from './calculators/workspace/gc-workflow';
vi.mock('@/lib/api',()=>({apiUrl:(p:string)=>p,customerFetch:(...args:unknown[])=>fetch(...args as Parameters<typeof fetch>)}));
afterEach(()=>vi.unstubAllGlobals());
function fixture(){const p=emptyStockPreparation();p.independent=true;for(const [k,n] of [['mass','100'],['purity','99'],['volume','100']] as const)p.inputs[k]={nominal:n,uncertainty:{value:'0.1',kind:'standard',divisor:'',source:'example'}};return {...newSolutionDraft(chemicals[0]),preparation:p};}
it('disables export for incomplete preparation',()=>{render(<SolutionPDFButton en draft={newSolutionDraft(chemicals[0])}/>);expect(screen.getByRole('button')).toBeDisabled();});
it('shows a failure instead of downloading an error response',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));render(<SolutionPDFButton en draft={fixture()}/>);fireEvent.click(screen.getByRole('button'));expect(await screen.findByRole('alert')).toHaveTextContent('could not be generated');expect(screen.getByRole('button')).not.toBeDisabled();});
it('aborts in-flight exports when the input changes',async()=>{let signal:AbortSignal;vi.stubGlobal('fetch',vi.fn((_url,opts)=>{signal=opts.signal;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));}));const d=fixture();const view=render(<SolutionPDFButton en draft={d}/>);fireEvent.click(screen.getByRole('button'));await waitFor(()=>expect(fetch).toHaveBeenCalledOnce());view.rerender(<SolutionPDFButton en draft={{...d,volume:'200'}}/>);expect(signal!.aborted).toBe(true);await waitFor(()=>expect(screen.getByRole('button')).not.toBeDisabled());expect(screen.queryByRole('alert')).toBeNull();});
