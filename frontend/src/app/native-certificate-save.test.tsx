import React,{useState} from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const save=vi.hoisted(()=>vi.fn());
vi.mock('./calculators/workspace/save-certificate-file',()=>({saveCertificateFile:save}));
import ReagentAttachment from './calculators/workspace/ReagentAttachment';
import {newReagent,type Reagent} from './calculators/workspace/reagents';
import {ProjectExportUnavailable} from '@/lib/save-project-file';
const certificate={name:'گواهی فرضی.pdf',mime:'application/pdf' as const,base64:btoa('%PDF-1.7\nSynthetic attachment')};
function Form({en=true}:{en?:boolean}){const [value,setValue]=useState<Reagent>({...newReagent(),certificateFile:certificate});return <ReagentAttachment value={value} onChange={setValue} en={en}/>;}
beforeEach(()=>save.mockReset());afterEach(cleanup);
it('awaits the destination, prevents duplicate clicks and retains the certificate after cancellation',async()=>{
 let finish!:(s:string)=>void;save.mockReturnValueOnce(new Promise<string>(r=>{finish=r;}));render(<Form/>);const button=screen.getByRole('button',{name:'Download certificate file'});fireEvent.click(button);fireEvent.click(button);expect(save).toHaveBeenCalledTimes(1);expect(save).toHaveBeenCalledWith(certificate);expect(button).toBeDisabled();expect(screen.getByRole('button',{name:'Remove draft attachment'})).toBeDisabled();expect(screen.queryByRole('status')).toBeNull();await act(async()=>finish('cancelled'));expect(screen.getByRole('status')).toHaveTextContent('attachment remains');expect(screen.getByText(certificate.name)).toBeInTheDocument();expect(button).toBeEnabled();
});
it('shows unsupported and write errors without losing the file or retaining stale success',async()=>{
 save.mockResolvedValueOnce('saved').mockRejectedValueOnce(new ProjectExportUnavailable()).mockRejectedValueOnce(Error('secret provider path'));render(<Form en={false}/>);const button=screen.getByRole('button',{name:'دریافت فایل گواهی'});fireEvent.click(button);expect(await screen.findByRole('status')).toHaveTextContent('ذخیره شد');fireEvent.click(button);expect(await screen.findByRole('alert')).toHaveTextContent('نسخهٔ وب');expect(screen.queryByRole('status')).toBeNull();fireEvent.click(button);expect(await screen.findByRole('alert')).toHaveTextContent('پیوست حفظ شده');expect(screen.queryByText(/secret provider/)).toBeNull();expect(screen.getByText(certificate.name)).toBeInTheDocument();expect(button).toBeEnabled();
});
it('does not claim confirmed storage for a browser download and still permits removing the draft copy',async()=>{
 save.mockResolvedValue('download-started');render(<Form/>);fireEvent.click(screen.getByRole('button',{name:'Download certificate file'}));await act(async()=>{});expect(screen.queryByRole('status')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Remove draft attachment'}));expect(screen.queryByText(certificate.name)).toBeNull();
});
