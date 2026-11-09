import React,{useState} from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import WorkspaceGuide from './calculators/workspace/WorkspaceGuide';

beforeEach(()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','');}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open');}});
});
function Harness({en=false}:{en?:boolean}){
 const [open,setOpen]=useState(false);
 return <><label>Sample<input defaultValue="Retained sample 42"/></label><button onClick={()=>setOpen(true)}>Open help</button>{open&&<WorkspaceGuide en={en} onClose={()=>setOpen(false)}/>}</>;
}
it('opens help without changing a current draft and restores keyboard focus after cancel',()=>{
 render(<Harness/>);const opener=screen.getByRole('button',{name:'Open help'});opener.focus();fireEvent.click(opener);
 const dialog=screen.getByRole('dialog',{name:'راهنمای محیط آزمایشگاه'});
 expect(dialog).toHaveAttribute('open');expect(dialog).toHaveTextContent('ذخیرهٔ خودکار فعال نیست');expect(dialog).toHaveTextContent('۱۲ MiB');
 fireEvent(dialog,new Event('cancel',{bubbles:false,cancelable:true}));
 expect(screen.queryByRole('dialog')).toBeNull();expect(opener).toHaveFocus();expect(screen.getByLabelText('Sample')).toHaveValue('Retained sample 42');
});
it('provides English saving, report and source limitations and closes through its named button',()=>{
 render(<Harness en/>);fireEvent.click(screen.getByRole('button',{name:'Open help'}));const dialog=screen.getByRole('dialog',{name:'Laboratory workspace guide'});
 expect(dialog).toHaveTextContent('Autosave is not enabled');expect(dialog).toHaveTextContent('do not replace the editable project');expect(dialog).toHaveTextContent('toxicity and prediction data are not supplied');
 fireEvent.click(screen.getByRole('button',{name:'Close guide'}));expect(screen.queryByRole('dialog')).toBeNull();
});
it('does not restore focus to an opener removed while a dialog is open',()=>{
 const opener=document.createElement('button');document.body.append(opener);opener.focus();const focus=vi.spyOn(opener,'focus');const {unmount}=render(<WorkspaceGuide en onClose={()=>{}}/>);opener.remove();unmount();expect(focus).not.toHaveBeenCalled();
});
