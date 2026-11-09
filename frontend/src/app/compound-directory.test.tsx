import React from 'react';
import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import CompoundDirectory from './calculators/workspace/CompoundDirectory';
it('browses the actual catalog with dropdown initials, pagination and explicit open actions',async()=>{
 const mock=vi.fn(async(_url:string)=>new Response(JSON.stringify({records:[{cid:887,cas:'67-56-1',formula:'CH4O',name:'methanol',iupac:'methanol'}],total:73162,metadata:{source:'chemicals 1.5.2',version:'v1'}})));vi.stubGlobal('fetch',mock);
 const choose=vi.fn();render(<CompoundDirectory en onChoose={choose} onShortcut={vi.fn()}/>);
 fireEvent.click(await screen.findByRole('button',{name:/^methanol/}));expect(choose).toHaveBeenCalledWith(887,'متانول');
 fireEvent.change(screen.getByLabelText('Reference name starts with'),{target:{value:'m'}});
 await waitFor(()=>expect(mock.mock.calls.some(c=>String(c[0]).includes('offset=0&letter=m'))).toBe(true));
 fireEvent.click(await screen.findByRole('button',{name:'Next page'}));
 await waitFor(()=>expect(mock.mock.calls.some(c=>String(c[0]).includes('offset=12&letter=m'))).toBe(true));
 expect(screen.queryByText('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBeNull();
});
