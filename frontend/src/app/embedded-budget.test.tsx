import React,{createRef} from 'react';
import {expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import GumBudget,{type GumBudgetHandle} from './calculators/GumBudget';
import {readGumProject} from './calculators/gum-project';
const request=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/api',()=>({apiUrl:(p:string)=>p,customerFetch:request}));
it('restores an embedded budget without trusting saved results and exposes current drafts and verified calculations',async()=>{
 const initial=readGumProject({format:'artin-gum',version:1,savedAt:'2026-11-09T00:00:00Z',template:'family:residue',familyData:['.2','10'],gcData:{},graphs:{standards:'',chromatogram:''},correlations:[],inputs:{unit:'% mass',coverage:'2',activeMethodId:'1',methodEdition:'Synthetic 1'},rows:[{name:'a',unit:'g'},{name:'b',unit:'g'},{name:'c',unit:'% mass'},{name:'d',unit:'% mass'}].map(r=>({...r,source:'Hypothetical source',u:'.01',c:'1',kind:'standard',divisor:'2'}))});
 request.mockResolvedValue({ok:true,json:async()=>({standard_uncertainty:.1010148504,expanded_uncertainty:.2020297008,engine:'artin-linear-gum',engine_version:'1',components:[{variance_percent:98},{variance_percent:0},{variance_percent:1},{variance_percent:1}]})});
 const ref=createRef<GumBudgetHandle>();render(<GumBudget en parseNumber={Number} lockedMethodId={1} initialProject={initial} projectRef={ref}/>);
 expect(ref.current?.snapshot()?.familyData).toEqual(['.2','10']);expect(ref.current?.result()).toBeUndefined();
 expect(screen.getByLabelText('Select test or method')).toHaveValue('family:residue');
 expect(screen.getByLabelText('Select test or method').querySelector('option[value="family:viscosity"]')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Calculate budget'}));await waitFor(()=>expect(ref.current?.result()?.measured).toBe(2));
 fireEvent.change(screen.getByLabelText('Sample mass g'),{target:{value:'20'}});
 expect(ref.current?.result()).toBeUndefined();expect(ref.current?.snapshot()?.familyData[1]).toBe('20');
});
