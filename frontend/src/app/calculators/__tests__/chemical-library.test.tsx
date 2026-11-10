import React,{useState} from 'react';
import {describe,it,expect,beforeEach,vi} from 'vitest';
import {render,screen,fireEvent,within} from '@testing-library/react';
import {chemicals,searchChemicals,newSolutionDraft,calculateSolution,readSolutionDraft,type SolutionDraft} from '../workspace/chemical-library';
import {readLabProject,serializeLabProject} from '../workspace/project-file';
import ChemicalLibrary from '../workspace/ChemicalLibrary';
beforeEach(()=>{vi.stubGlobal('fetch',vi.fn(()=>new Promise(()=>{})));Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','');}});});
const example=(cid=5234)=>({...newSolutionDraft(chemicals.find(r=>r.cid===cid)!),concentration:'۰٫۱',volume:'۲۵۰',purity:'۹۸',puritySource:'CoA lot 1; mass fraction'});
describe('sourced compound library and molar preparation',()=>{
  it('searches Persian variants, subscripts, hydrate forms and CID without merging them',()=>{
    expect(searchChemicals('كربنات سديم').map(r=>r.cid)).toEqual([10340,151402]);
    expect(searchChemicals('Na₂CO₃').map(r=>r.cid)).toEqual([10340,151402]);
    expect(searchChemicals('۱۵۱۴۰۲')[0].cid).toBe(151402);
    expect(searchChemicals('سولفات مس پنج آبه')[0].cid).toBe(24463);
    expect(searchChemicals('unknown compound')).toEqual([]);
  });
  it('uses the existing molar calculation and the actual selected hydration form',()=>{
    expect(calculateSolution(example()).mass).toBeCloseTo(1.490816326530612,12);
    const anhydrous=calculateSolution(example(10340)),hydrate=calculateSolution(example(151402));
    expect(anhydrous.mass).toBeCloseTo(.1*.25*105.988/.98,12);
    expect(hydrate.mass).toBeCloseTo(.1*.25*286.14/.98,12);
    expect(hydrate.mass).toBeGreaterThan(2*anhydrous.mass);
  });
  it('rejects missing purity evidence, invalid units-as-text, overrange purity and overflow',()=>{
    for(const patch of [{purity:''},{purity:'101'},{puritySource:''},{volume:'250 mL'},{concentration:'0'},{concentration:'1e308',volume:'1e308'}])expect(()=>calculateSolution({...example(),...patch})).toThrow();
    expect(newSolutionDraft(chemicals[0]).purity).toBe('');
  });
  it('preserves raw Persian inputs and source snapshots in a project round trip and rejects forged mass',()=>{
    const d=example(151402),p=readLabProject({format:'artin-lab-project',version:1,id:'solution-test',savedAt:'2026-11-05T00:00:00Z',workflow:'gc-external-extraction',identity:{title:'محلول',sample:'',sop:'',edition:'',matrix:''},evidence:[],standards:[['',''],['',''],['','']],stage:0,solution:d});
    const restored=readLabProject(JSON.parse(serializeLabProject(p)));expect(restored.solution).toEqual(d);expect(calculateSolution(restored.solution!)).toEqual(calculateSolution(d));
    expect(()=>readSolutionDraft({...d,material:{...d.material,record:{...d.material.record,molarMass:'1'}}})).toThrow();
    expect(()=>readSolutionDraft({...d,material:{...d.material,version:'unknown'}})).toThrow();
    expect(readLabProject({...p,solution:undefined}).solution).toBeUndefined();
  });
  it('does not guess purity and invalidates its result after an edit while retaining data across languages',()=>{
    function Form({en}:{en:boolean}){const [d,setD]=useState<SolutionDraft>();return <ChemicalLibrary en={en} draft={d} onChange={setD}/>;}
    const {rerender}=render(<Form en/>);fireEvent.click(screen.getByRole('button',{name:'Show material list'}));fireEvent.click(screen.getByRole('button',{name:'Common shortcuts'}));fireEvent.click(screen.getByRole('button',{name:/^sodium chloride/i}));fireEvent.click(screen.getByRole('button',{name:'Prepare a molar solution with this compound'}));
    const region=within(screen.getByRole('region',{name:'Molar solution calculation'}));expect(region.getByLabelText('Substance mass purity (% w/w)')).toHaveValue('');
    for(const [name,value] of [['Target concentration (mol/L)','.1'],['Final solution volume (mL)','250'],['Substance mass purity (% w/w)','98'],['Purity source and certificate or lot reference','Hypothetical CoA mass fraction']])fireEvent.change(region.getByLabelText(name),{target:{value}});
    fireEvent.click(region.getByRole('button',{name:'Calculate required mass'}));expect(region.getByRole('status')).toHaveTextContent('1.490816 g');
    rerender(<Form en={false}/>);const fa=within(screen.getByRole('region',{name:'محاسبهٔ تهیهٔ محلول مولار'}));expect(fa.getByLabelText('خلوص جرمی ماده (% w/w)')).toHaveValue('98');expect(fa.getByRole('status')).toHaveTextContent('1.490816 g');fireEvent.change(fa.getByLabelText('خلوص جرمی ماده (% w/w)'),{target:{value:'101'}});fireEvent.click(fa.getByRole('button',{name:'محاسبهٔ جرم لازم'}));expect(fa.getByRole('alert')).toBeVisible();expect(fa.queryByRole('status')).toBeNull();
  });
  it('requires a replacement decision before clearing a populated recipe for another compound',()=>{
    function Form(){const [d,setD]=useState(example);return <ChemicalLibrary en draft={d} onChange={setD}/>;}render(<Form/>);
    fireEvent.change(screen.getByLabelText('Search compounds'),{target:{value:'151402'}});fireEvent.click(screen.getByRole('button',{name:/Sodium carbonate decahydrate/}));fireEvent.click(screen.getByRole('button',{name:'Prepare a molar solution with this compound'}));expect(screen.getByRole('dialog',{name:'Replace solution inputs?'})).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(screen.getByRole('button',{name:/Resume solution/})).toHaveTextContent('Sodium chloride');
    fireEvent.click(screen.getByRole('button',{name:'Prepare a molar solution with this compound'}));fireEvent.click(screen.getByRole('button',{name:'Replace solution inputs'}));expect(screen.getByLabelText('Substance mass purity (% w/w)')).toHaveValue('');expect(screen.getByRole('region',{name:'Molar solution calculation'})).toHaveTextContent('286.14 g/mol');
  });
});
import {newReagent} from '../workspace/reagents';
import {reagentReference} from '../workspace/reagent-solution';
it('removes linked evidence and stale results when purity is manually changed',()=>{
 const r={...newReagent(),name:'Hypothetical product',lot:'L1',certificate:'C1',purity:'99%',purityBasis:'w/w'};
 let latest:SolutionDraft;
 function Linked(){const [d,setD]=useState({...example(),purity:'99',puritySource:reagentReference(r),reagent:r} as SolutionDraft);latest=d;return <ChemicalLibrary en reagents={[r]} draft={d} onChange={setD}/>;}
 render(<Linked/>);fireEvent.click(screen.getByRole('button',{name:/Resume solution/}));fireEvent.click(screen.getByRole('button',{name:'Calculate required mass'}));expect(screen.getByRole('region',{name:'Molar solution calculation'})).toHaveTextContent('Snapshot used in this solution');
 fireEvent.change(screen.getByLabelText('Substance mass purity (% w/w)'),{target:{value:'98'}});expect(latest!.reagent).toBeUndefined();expect(screen.queryByRole('button',{name:'Save this calculation to project file'})).toBeNull();expect(screen.queryByText(/Snapshot used in this solution/)).toBeNull();
});
import {emptyCommercial} from '../workspace/commercial-solution';
it('protects a commercial or dilution draft even when nominal solid inputs are blank',()=>{
 function Form(){const [d,setD]=useState<SolutionDraft>({...newSolutionDraft(chemicals.find(r=>r.cid===5234)!),commercial:{...emptyCommercial(),productReference:'Unsaved lot'}});return <ChemicalLibrary en draft={d} onChange={setD}/>;}
 render(<Form/>);fireEvent.change(screen.getByLabelText('Search compounds'),{target:{value:'151402'}});fireEvent.click(screen.getByRole('button',{name:/Sodium carbonate decahydrate/}));fireEvent.click(screen.getByRole('button',{name:'Prepare a molar solution with this compound'}));expect(screen.getByRole('dialog',{name:'Replace solution inputs?'})).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(screen.getByRole('button',{name:/Resume solution/})).toHaveTextContent('Sodium chloride');
});
