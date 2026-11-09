import React,{createRef,useState} from 'react';
import {expect,it,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import MethodStudyForm,{type MethodStudyHandle} from './calculators/workspace/MethodStudyForm';
import {emptyMethodStudy} from './calculators/workspace/method-study';
const save=vi.hoisted(()=>vi.fn());
const request=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/api',()=>({apiUrl:(p:string)=>p,customerFetch:request}));
vi.mock('./calculators/workspace/use-text-export',()=>({useTextExport:()=>({save,busy:false,notice:null})}));
function Harness({id,ref}:{id:number;ref:React.Ref<MethodStudyHandle>}){
 const [value,onChange]=useState(emptyMethodStudy(id));
 return <MethodStudyForm projectRef={ref} en value={value} onChange={onChange} identity={{title:'Synthetic test',sample:'A',sop:'Lab SOP',edition:'1',matrix:'Test'}} onIdentity={()=>{}}/>;
}
it.each([11,94])('records qualitative/sampling outcomes without manufacturing numeric uncertainty (method %s)',id=>{
 const ref=createRef<MethodStudyHandle>();render(<Harness id={id} ref={ref}/>);
 expect(screen.queryByRole('button',{name:'Calculate budget'})).toBeNull();
 const payload='<img src=x onerror=alert(1)>';
 fireEvent.change(screen.getByLabelText('Observed outcome or study objective'),{target:{value:payload}});
 expect(ref.current?.snapshot().outcome).toBe(payload);expect(ref.current?.snapshot().budget).toBeUndefined();
 fireEvent.click(screen.getByRole('button',{name:'Download test project report (HTML)'}));
 const html=save.mock.calls.at(-1)![0];expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');expect(html).not.toContain('<img src=x');expect(html).toContain('no current server-verified numerical result');
});
it('reports raw numeric inputs and current engine results, then drops the result after an edit',async()=>{
 const value={...emptyMethodStudy(1),budget:{format:'artin-gum' as const,version:1 as const,savedAt:'2026-11-09T00:00:00Z',template:'family:residue',familyData:['.2','10'],gcData:{},correlations:[],inputs:{unit:'% mass',coverage:'2',activeMethodId:'1'},rows:[{name:'a',unit:'g'},{name:'b',unit:'g'},{name:'c',unit:'% mass'},{name:'d',unit:'% mass'}].map(r=>({...r,source:'Hypothetical source',u:'.01',c:'1',kind:'standard',divisor:'2'}))}};
 request.mockResolvedValue({ok:true,json:async()=>({standard_uncertainty:.10101485,expanded_uncertainty:.2020297,engine:'artin-linear-gum',engine_version:'1',components:[{variance_percent:98},{variance_percent:0},{variance_percent:1},{variance_percent:1}]})});
 render(<MethodStudyForm en value={value} onChange={()=>{}} identity={{title:'Synthetic',sample:'A',sop:'SOP',edition:'1',matrix:'Oil'}} onIdentity={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:'Calculate budget'}));await screen.findByText('Measurement report');
 fireEvent.click(screen.getByRole('button',{name:'Download test project report (HTML)'}));
 const html=save.mock.calls.at(-1)![0];expect(html).toContain('Raw model inputs');expect(html).toContain('Sample mass');expect(html).toContain('Current server calculation');expect(html).toContain('artin-linear-gum 1');
 fireEvent.change(screen.getByLabelText('Sample mass g'),{target:{value:'20'}});
 fireEvent.click(screen.getByRole('button',{name:'Download test project report (HTML)'}));
 const stale=save.mock.calls.at(-1)![0];expect(stale).not.toContain('Current server calculation');expect(stale).toContain('no current server-verified numerical result');
});
