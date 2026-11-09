import React from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,within} from '@testing-library/react';
const save=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/i18n',()=>({useI18n:()=>({locale:'en'})}));
vi.mock('@/lib/save-project-file',()=>({saveProjectJSON:save,ProjectExportUnavailable:class extends Error{}}));
import Workspace from './calculators/page';
beforeEach(()=>{
 save.mockReset().mockResolvedValue('download-started');
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;}});
});
async function create(id:string){
 render(<Workspace/>);fireEvent.click(screen.getByRole('button',{name:'New project'}));
 const dialog=screen.getByRole('dialog',{name:'New project'});
 expect(within(dialog).getByRole('button',{name:'Start this project'})).toBeDisabled();
 fireEvent.change(within(dialog).getByLabelText('Choose a bank test'),{target:{value:id}});
 fireEvent.click(within(dialog).getByRole('button',{name:'Start this project'}));
 await screen.findByRole('region',{name:'Method bank project'});
}
it('creates a qualitative method project and saves its outcome through the main project toolbar',async()=>{
 await create('11');fireEvent.change(screen.getByLabelText('Observed outcome or study objective'),{target:{value:'Synthetic ordinal outcome'}});
 fireEvent.change(screen.getByLabelText('Project title'),{target:{value:'Quality test'}});
 fireEvent.click(screen.getByRole('button',{name:'Save project file'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));
 const data=JSON.parse(save.mock.calls[0][0]);expect(data.workflow).toBe('method-study');expect(data.methodStudy).toMatchObject({methodId:11,outcome:'Synthetic ordinal outcome'});expect(data.methodStudy.budget).toBeUndefined();expect(data.identity.title).toBe('Quality test');
});
it('saves the latest embedded numeric inputs rather than only the initial method record',async()=>{
 await create('1');
 fireEvent.change(screen.getByLabelText('Select test or method'),{target:{value:'family:residue'}});
 fireEvent.change(screen.getByLabelText('Net residue mass g'),{target:{value:'.2'}});
 fireEvent.change(screen.getByLabelText('Sample mass g'),{target:{value:'10'}});
 fireEvent.click(screen.getByRole('button',{name:'Save project file'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));
 const data=JSON.parse(save.mock.calls[0][0]);expect(data.methodStudy.methodId).toBe(1);expect(data.methodStudy.budget.template).toBe('family:residue');expect(data.methodStudy.budget.familyData).toEqual(['.2','10']);expect(data.methodStudy.budget.inputs.activeMethodId).toBe('1');
});
