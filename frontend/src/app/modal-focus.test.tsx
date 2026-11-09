import React,{StrictMode,useState} from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {useModalDialog} from './calculators/workspace/use-modal-dialog';

beforeEach(()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;this.querySelector('button')?.focus();}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;}});
});
function Dialog({close,next}:{close:()=>void;next?:()=>void}){
 const ref=useModalDialog();
 return <dialog ref={ref} aria-label="Test dialog" onCancel={e=>{e.preventDefault();close();}}><button onClick={close}>Cancel</button>{next&&<button onClick={next}>Next</button>}</dialog>;
}
function Harness(){
 const [stage,setStage]=useState(0);
 return <><input aria-label="Draft" defaultValue="Retain this"/><button onClick={()=>setStage(1)}>Open</button>{stage===1&&<Dialog key="one" close={()=>setStage(0)} next={()=>setStage(2)}/>}{stage===2&&<Dialog key="two" close={()=>setStage(0)}/>}</>;
}
it.each([false,true])('restores the opener after cancel and retains the draft (StrictMode=%s)',strict=>{
 render(strict?<StrictMode><Harness/></StrictMode>:<Harness/>);
 const opener=screen.getByRole('button',{name:'Open'});opener.focus();fireEvent.click(opener);
 expect(screen.getByRole('button',{name:'Cancel'})).toHaveFocus();
 fireEvent(screen.getByRole('dialog'),new Event('cancel',{cancelable:true}));
 expect(opener).toHaveFocus();expect(screen.getByLabelText('Draft')).toHaveValue('Retain this');
});
it('restores the toolbar opener after transitioning between dialogs',()=>{
 render(<Harness/>);const opener=screen.getByRole('button',{name:'Open'});opener.focus();fireEvent.click(opener);
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 expect(screen.getByRole('button',{name:'Cancel'})).toHaveFocus();
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(opener).toHaveFocus();
});
it('does not focus an opener that has been removed',()=>{
 const opener=document.createElement('button');document.body.append(opener);opener.focus();
 const {unmount}=render(<Dialog close={()=>{}}/>);opener.remove();
 const focus=vi.spyOn(opener,'focus');unmount();expect(focus).not.toHaveBeenCalled();
});
