import React from 'react';
import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import ReferenceSections from './calculators/workspace/ReferenceSections';
it('keeps long reference lists collapsed, paginates and translates only the opened page',async()=>{
 const mock=vi.fn(async(_url:string,_options?:RequestInit)=>new Response(JSON.stringify({translations:['شرح فارسی 0','شرح فارسی 1']})));vi.stubGlobal('fetch',mock);
 const rows=Array.from({length:12},(_,i)=>({heading:'Record Description',name:'Record Description',value:'Original '+i,unit:'',source:'PubChem',url:'https://pubchem.ncbi.nlm.nih.gov',reference:''}));
 render(<ReferenceSections rows={rows} en={false}/>);
 expect(mock).not.toHaveBeenCalled();expect(screen.queryByText('Original 0')).toBeNull();
 const summary=screen.getByText('شرح ماده',{exact:false}).closest('details')!;
 summary.open=true;fireEvent(summary,new Event('toggle'));
 await screen.findByText('شرح فارسی 0');expect(screen.queryByText('Original 4')).toBeNull();
 expect(JSON.parse(mock.mock.calls[0][1]!.body as string).texts).toHaveLength(2);
});
