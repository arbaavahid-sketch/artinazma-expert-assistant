import React,{useState,type ComponentType} from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {deferredSection} from './calculators/workspace/deferred-section';
const language=vi.hoisted(()=>({locale:'en'}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>language}));
beforeEach(()=>{vi.restoreAllMocks();language.locale='en';vi.spyOn(console,'error').mockImplementation(()=>{});});
type Props={sample:string};
function Loaded({sample}:Props){return <label>Section input<input defaultValue={sample}/></label>;}
function Harness({Section,save}:{Section:ComponentType<Props>;save:(data:{sample:string})=>void}){
 const [sample,setSample]=useState(''),[shown,setShown]=useState(true);
 return <><label>Project sample<input value={sample} onChange={e=>setSample(e.target.value)}/></label><button onClick={()=>save({sample})}>Save project</button><button onClick={()=>setShown(v=>!v)}>Toggle section</button>{shown&&<Section sample={sample}/>}</>;
}
it('keeps project editing and saving available while a section waits for its module',()=>{
 const loader=vi.fn(()=>new Promise<{default:ComponentType<Props>}>(()=>{})),Section=deferredSection(loader),save=vi.fn();render(<Harness Section={Section} save={save}/>);
 expect(screen.getByRole('status')).toHaveTextContent('Loading this section');fireEvent.change(screen.getByLabelText('Project sample'),{target:{value:'Raw sample 41'}});fireEvent.click(screen.getByRole('button',{name:'Save project'}));
 expect(save).toHaveBeenCalledWith({sample:'Raw sample 41'});expect(loader).toHaveBeenCalledTimes(1);
});
it('retries a rejected import with a fresh lazy instance while preserving the project owner',async()=>{
 const loader=vi.fn().mockRejectedValueOnce(Error('ChunkLoadError private diagnostic')).mockResolvedValueOnce({default:Loaded});const Section=deferredSection<Props>(loader),save=vi.fn();render(<Harness Section={Section} save={save}/>);
 fireEvent.change(screen.getByLabelText('Project sample'),{target:{value:'Retained draft 42'}});expect(await screen.findByRole('alert')).not.toHaveTextContent('private diagnostic');
 fireEvent.click(screen.getByRole('button',{name:'Save project'}));expect(save).toHaveBeenCalledWith({sample:'Retained draft 42'});
 fireEvent.click(screen.getByRole('button',{name:'Retry this section'}));expect(await screen.findByLabelText('Section input')).toHaveValue('Retained draft 42');expect(loader).toHaveBeenCalledTimes(2);expect(screen.getByLabelText('Project sample')).toHaveValue('Retained draft 42');
});
it('does not retry automatically or reload the page when failures repeat',async()=>{
 const loader=vi.fn().mockRejectedValue(Error('offline')),Section=deferredSection<Props>(loader);render(<Harness Section={Section} save={()=>{}}/>);
 await screen.findByRole('alert');expect(loader).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByRole('button',{name:'Retry this section'}));await screen.findByRole('alert');expect(loader).toHaveBeenCalledTimes(2);expect(screen.getByRole('button',{name:'Save project'})).toBeEnabled();expect(screen.queryByRole('button',{name:/reload/i})).toBeNull();
});
it('contains render failures in a loaded section as well as import rejection',async()=>{
 const Broken=()=>{throw Error('private rendering failure');};const loader=vi.fn().mockResolvedValueOnce({default:Broken}).mockResolvedValueOnce({default:Loaded}),Section=deferredSection<Props>(loader);
 render(<Harness Section={Section} save={()=>{}}/>);await screen.findByRole('alert');fireEvent.change(screen.getByLabelText('Project sample'),{target:{value:'Still editable'}});fireEvent.click(screen.getByRole('button',{name:'Retry this section'}));expect(await screen.findByLabelText('Section input')).toHaveValue('Still editable');
});
it('keeps a successful child mounted across owner edits and reuses the latest recovered module on remount',async()=>{
 const loader=vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({default:Loaded}),Section=deferredSection<Props>(loader);render(<Harness Section={Section} save={()=>{}}/>);
 await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Retry this section'}));await screen.findByLabelText('Section input');fireEvent.change(screen.getByLabelText('Section input'),{target:{value:'Local section state'}});fireEvent.change(screen.getByLabelText('Project sample'),{target:{value:'Owner edit'}});expect(screen.getByLabelText('Section input')).toHaveValue('Local section state');
 fireEvent.click(screen.getByRole('button',{name:'Toggle section'}));fireEvent.click(screen.getByRole('button',{name:'Toggle section'}));await screen.findByLabelText('Section input');expect(loader).toHaveBeenCalledTimes(2);expect(screen.queryByRole('alert')).toBeNull();
});
it('provides Persian recovery instructions without exposing the raw error',async()=>{
 language.locale='fa';const Section=deferredSection<Props>(()=>Promise.reject(Error('sensitive stack value')));render(<Harness Section={Section} save={()=>{}}/>);
 expect(screen.getByRole('status')).toHaveTextContent('در حال آماده‌کردن');const alert=await screen.findByRole('alert');expect(alert).toHaveTextContent('پیش از بازخوانی صفحه فایل پرونده را ذخیره کنید');expect(alert).not.toHaveTextContent('sensitive stack value');expect(screen.getByRole('button',{name:'تلاش دوباره برای این بخش'})).toBeEnabled();
});
