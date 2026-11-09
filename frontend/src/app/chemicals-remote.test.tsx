import React,{useState} from 'react';
import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import ChemicalLibrary from './calculators/workspace/ChemicalLibrary';
import {calculateSolution,readSolutionDraft,chemicalSnapshot,type ChemicalRecord,type SolutionDraft} from './calculators/workspace/chemical-library';
it('searches a remote compound, selects it explicitly and round-trips the recipe source',async()=>{
 const remote={fetchedAt:'2026-11-05T09:10:11Z',CID:2244,Title:'Aspirin',MolecularFormula:'C9H8O4',MolecularWeight:'180.16',IUPACName:'2-acetyloxybenzoic acid'};
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes('/catalog')?{records:[],total:73162,metadata:{}}:url.includes('q=')?{records:[remote],suggestions:[],limited:false}:{record:remote,retrievedOn:'2026-11-05'}),{status:200})));
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','');}});
 let saved:SolutionDraft|undefined;
 function App(){const [d,setD]=useState<SolutionDraft>();saved=d;return <ChemicalLibrary en draft={d} onChange={setD}/>;}render(<App/>);
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'aspirin'}});fireEvent.click(screen.getByRole('button',{name:'Search PubChem'}));
 const result=await screen.findByRole('button',{name:/^Aspirin/});expect(screen.queryByRole('heading',{name:'Aspirin'})).toBeNull();fireEvent.click(result);await screen.findByRole('heading',{name:'Aspirin'});
 fireEvent.click(screen.getByRole('button',{name:'Prepare a molar solution with this compound'}));const form=within(screen.getByRole('region',{name:'Molar solution calculation'}));
 for(const [name,value] of [['Target concentration (mol/L)','0.1'],['Final solution volume (mL)','100'],['Substance mass purity (% w/w)','100'],['Purity source and certificate or lot reference','Hypothetical product']])fireEvent.change(form.getByLabelText(name),{target:{value}});
 fireEvent.click(form.getByRole('button',{name:'Calculate required mass'}));expect(form.getByRole('status')).toHaveTextContent('1.801600 g');expect(calculateSolution(readSolutionDraft(JSON.parse(JSON.stringify(saved)))).mass).toBeCloseTo(1.8016,12);
 await waitFor(()=>expect(screen.queryByText('Loading PubChem data…')).toBeNull());
});



it('never invents a retrieval date when capturing a remote molecular weight',()=>{
 const record:ChemicalRecord={cid:2244,en:'Aspirin',fa:'',formula:'C9H8O4',sourceFormula:'C9H8O4',iupac:'',molarMass:'180.16',waters:null,formFa:'',formEn:'',aliases:[]};
 expect(()=>chemicalSnapshot(record)).toThrow();
 const captured=chemicalSnapshot({...record,fetchedAt:'2026-10-01T08:09:10Z'});
 expect(captured.retrievedOn).toBe('2026-10-01');expect(captured.fetchedAt).toBe('2026-10-01T08:09:10Z');expect(captured.sourceUpdatedAt).toBeNull();
 const draft={material:captured,concentration:'',volume:'',purity:'',puritySource:''};expect(readSolutionDraft(JSON.parse(JSON.stringify(draft)))).toEqual(draft);
 expect(()=>readSolutionDraft({...draft,material:{...captured,retrievedOn:'2026-11-07'}})).toThrow();
 // Older imported snapshots retain their original date without upgrading its provenance.
 const {fetchedAt,sourceUpdatedAt,...old}=captured;void fetchedAt;void sourceUpdatedAt;expect(readSolutionDraft({...draft,material:old}).material.retrievedOn).toBe('2026-10-01');
});
