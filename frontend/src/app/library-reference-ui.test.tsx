import React from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,within} from '@testing-library/react';
import LibraryResourceCards from '@/components/LibraryResourceCards';
import type {LibraryResources} from '@/lib/library-resources';
import Workspace from './calculators/page';
import {LabAssistantDialog} from './calculators/workspace/LabAssistant';
import {backendFetch} from '@/lib/api';
vi.mock('@/lib/i18n',()=>({useI18n:()=>({locale:'en'})}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock('@/lib/api',()=>({apiUrl:(p:string)=>p,backendRequestUrl:(p:string)=>p,backendFetch:vi.fn()}));
vi.mock('./calculators/workspace/ChemicalLibrary',()=>({default:({initialCid}:{initialCid:number})=><section aria-label="Linked material">CID {initialCid}</section>}));
const references:LibraryResources={chemical:{query:'C12H14ClN3O',mode:'formula',status:'candidates',limited:false,records:[{cid:198139,name:'Synthetic selected material',formula:'C12H14ClN3O',cas:'34375-78-5',iupac:'',computedMolarMass:'',fetchedAt:null,sourceUrl:'https://pubchem.ncbi.nlm.nih.gov/compound/198139'}]},links:[{kind:'compounds',title:'Library',href:'/calculators?section=materials&material=compounds'}]};
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();window.history.replaceState(null,'','/calculators');Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;}});});
it('opens the exact selected material without discarding an unsaved project',async()=>{
 render(<><Workspace/><LibraryResourceCards value={references} en/></>);
 const nav=screen.getByRole('navigation',{name:'Laboratory sections'});fireEvent.click(within(nav).getByRole('button',{name:'Test project'}));fireEvent.change(screen.getByLabelText('Project title'),{target:{value:'Retain this unsaved project'}});
 fireEvent.click(screen.getByRole('link',{name:'Open this material card'}));expect(await screen.findByRole('region',{name:'Linked material'})).toHaveTextContent('CID 198139');
 fireEvent.click(within(nav).getByRole('button',{name:'Test project'}));expect(screen.getByLabelText('Project title')).toHaveValue('Retain this unsaved project');
});
it('opens a direct compound reference at workspace entry',async()=>{
 window.history.replaceState(null,'','/calculators?section=materials&material=compounds&chemical=198139');render(<Workspace/>);expect(await screen.findByRole('region',{name:'Linked material'})).toHaveTextContent('198139');
});
it('sends selected CID separately from user prose and renders returned material cards',async()=>{
 vi.mocked(backendFetch).mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(JSON.stringify({answer:'Verified reference result',calculations:[],proposals:[],revision:null,library_resources:references})));
 const close=vi.fn();function Test(){const [turns,setTurns]=React.useState<import('./calculators/workspace/lab-chat-bridge').LabTurn[]>([]);return <LabAssistantDialog en chemicalCid={198139} getContext={()=>null} turns={turns} setTurns={setTurns} onClose={close}/>;}
 render(<Test/>);fireEvent.click(screen.getByRole('button',{name:'Send to Artin'}));await screen.findByText('Verified reference result');
 expect(JSON.parse(String(vi.mocked(backendFetch).mock.calls[1][1]?.body)).chemical_cid).toBe(198139);
 const source=screen.getByRole('complementary',{name:'Connected laboratory references'});expect(within(source).getByText(/formula alone/)).toBeVisible();
 fireEvent.click(within(source).getByRole('link',{name:'Open this material card'}));expect(close).toHaveBeenCalledOnce();
});
