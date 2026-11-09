import React,{useState} from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,within} from '@testing-library/react';
vi.mock('@/lib/i18n',()=>({useI18n:()=>({locale:'en'})}));
vi.mock('./calculators/QuickCalculators',()=>({default:function Quick(){const [value,setValue]=useState('');return <section><h1>Quick calculations</h1><label>Quick draft<input value={value} onChange={e=>setValue(e.target.value)}/></label></section>;}}));
import Workspace from './calculators/page';
beforeEach(()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;}});
});
it('opens the unified workspace at the main route and keeps both drafts when switching sections',async()=>{
 render(<Workspace/>);
 expect(screen.queryByText(/Explore the new/)).toBeNull();
 const nav=screen.getByRole('navigation',{name:'Laboratory sections'});
 fireEvent.click(within(nav).getByRole('button',{name:'Test project'}));
 fireEvent.change(screen.getByLabelText('Project title'),{target:{value:'Retain guided draft'}});
 fireEvent.click(within(nav).getByRole('button',{name:'Quick calculations'}));
 const quick=await screen.findByLabelText('Quick draft');fireEvent.change(quick,{target:{value:'Retain quick draft'}});
 fireEvent.click(within(nav).getByRole('button',{name:'Test project'}));
 expect(screen.getByLabelText('Project title')).toHaveValue('Retain guided draft');
 expect(quick).not.toBeVisible();
 fireEvent.click(within(nav).getByRole('button',{name:'Quick calculations'}));expect(quick).toBeVisible();expect(quick).toHaveValue('Retain quick draft');
});
it('offers other tools from the guided and method-bank chooser without discarding the project draft',async()=>{
 render(<Workspace/>);const nav=screen.getByRole('navigation',{name:'Laboratory sections'});
 fireEvent.click(within(nav).getByRole('button',{name:'Test project'}));
 fireEvent.change(screen.getByLabelText('Project title'),{target:{value:'Keep me'}});
 fireEvent.click(screen.getByRole('button',{name:'New project'}));
 const dialog=screen.getByRole('dialog',{name:'New project'});
 expect(within(dialog).getByRole('combobox',{name:'Choose a bank test'}).querySelectorAll('option')).toHaveLength(99);
 fireEvent.click(within(dialog).getByRole('button',{name:'Other tools and GUM models'}));
 expect(await screen.findByLabelText('Quick draft')).toBeVisible();expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.click(within(nav).getByRole('button',{name:'Test project'}));expect(screen.getByLabelText('Project title')).toHaveValue('Keep me');
});
it('retains method search when returning from a project to the workbench',()=>{
 render(<Workspace/>);const nav=screen.getByRole('navigation',{name:'Laboratory sections'});
 fireEvent.change(screen.getByLabelText('Search test methods'),{target:{value:'D445'}});
 fireEvent.click(within(nav).getByRole('button',{name:'Test project'}));
 fireEvent.click(within(nav).getByRole('button',{name:'Workbench'}));
 expect(screen.getByLabelText('Search test methods')).toHaveValue('D445');
});
