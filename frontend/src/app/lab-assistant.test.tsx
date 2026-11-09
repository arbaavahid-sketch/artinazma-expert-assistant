import React from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {LabAssistantDialog} from './calculators/workspace/LabAssistant';
import {captureLabContext,type LabTurn} from './calculators/workspace/lab-chat-bridge';
import {emptyDensity} from './calculators/workspace/density';
import {backendFetch} from '@/lib/api';
vi.mock('@/lib/api',()=>({apiUrl:(p:string)=>p,backendFetch:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
beforeEach(()=>{vi.clearAllMocks();Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','');}});});
function setup(){
 let context=captureLabContext({format:'artin-lab-project',version:1,id:'qa',savedAt:'2026-11-09T00:00:00Z',workflow:'density',identity:{title:'Synthetic project',sample:'QA-1',matrix:'',sop:'',edition:''},standards:[['',''],['',''],['','']],stage:0,evidence:[],density:emptyDensity()});
 const onApply=vi.fn();let latest:LabTurn[]=[];
 function Test(){const [turns,setTurns]=React.useState<LabTurn[]>([]);return <LabAssistantDialog en onClose={()=>{}} getContext={()=>context} onApply={onApply} turns={turns} setTurns={v=>{latest=v;setTurns(v);}}/>;}
 render(<Test/>);return {onApply,latest:()=>latest,change:()=>{context=captureLabContext({...context.project,identity:{...context.project.identity,sample:'Changed'}});}};
}
const reply={answer:'Synthetic interpretation',calculations:[{id:'calc-1',kind:'dilution',inputs:{values:[1,.1,250]},result:{aliquot_volume:25},unit:'mL',calculatedAt:'2026-11-09T00:00:00Z',revision:'r1'}],revision:'r1',proposals:[{id:'p1',revision:'r1',changes:[{path:'identity.sample',value:'QA-2',previous:'QA-1',reason:'Explicit user request'}]}]};
it('sends the current context, shows exact tool output and waits for explicit confirmation',async()=>{
 vi.mocked(backendFetch).mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(JSON.stringify(reply)));
 const qa=setup();fireEvent.change(screen.getByLabelText('Message Artin'),{target:{value:'Calculate and propose the requested sample ID'}});fireEvent.click(screen.getByRole('button',{name:'Send to Artin'}));
 await screen.findByText('Synthetic interpretation');expect(screen.getByText('Aliquot volume')).toBeVisible();expect(screen.getByText('25',{exact:true})).toBeVisible();expect(qa.onApply).not.toHaveBeenCalled();
 const payload=JSON.parse(String(vi.mocked(backendFetch).mock.calls[1][1]?.body));expect(payload.laboratory.project.identity.sample).toBe('QA-1');
 fireEvent.click(screen.getByRole('button',{name:'Confirm and apply these changes'}));expect(qa.onApply).toHaveBeenCalledOnce();expect(qa.onApply.mock.calls[0][0].identity.sample).toBe('QA-2');
});
it('blocks a proposal after intervening project edits and keeps data on service errors',async()=>{
 vi.mocked(backendFetch).mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(JSON.stringify(reply)));
 const qa=setup();fireEvent.change(screen.getByLabelText('Message Artin'),{target:{value:'Propose'}});fireEvent.click(screen.getByRole('button',{name:'Send to Artin'}));await screen.findByText('Synthetic interpretation');qa.change();
 fireEvent.click(screen.getByRole('button',{name:'Confirm and apply these changes'}));expect(screen.getByRole('alert')).toHaveTextContent('project changed');expect(qa.onApply).not.toHaveBeenCalled();
 vi.mocked(backendFetch).mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response('{}',{status:503}));
 fireEvent.change(screen.getByLabelText('Message Artin'),{target:{value:'Retry with current context'}});fireEvent.click(screen.getByRole('button',{name:'Send to Artin'}));await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Project data were not changed'));expect(qa.onApply).not.toHaveBeenCalled();
});
