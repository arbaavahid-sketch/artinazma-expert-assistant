import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const save=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/save-text-file',()=>({saveTextFile:save}));
import {ProjectExportUnavailable} from '@/lib/save-project-file';
import {useTextExport} from './calculators/workspace/use-text-export';
import ChebiExplorer from './calculators/workspace/ChebiExplorer';
import record from './calculators/__tests__/fixtures/chebi-record.json';
function Export(){const e=useTextExport(false);return <><button onClick={()=>void e.save('<html>فرضی</html>','a.html','html')}>ذخیره</button>{e.notice}</>;}
beforeEach(()=>{save.mockReset();});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('blocks duplicate saves while awaiting a picker and makes cancellation retryable',async()=>{
 let finish!:(s:string)=>void;save.mockReturnValueOnce(new Promise<string>(r=>{finish=r;}));render(<Export/>);const button=screen.getByRole('button');fireEvent.click(button);fireEvent.click(button);expect(save).toHaveBeenCalledTimes(1);expect(screen.queryByRole('status')).toBeNull();await act(async()=>finish('cancelled'));expect(screen.getByRole('status')).toHaveTextContent('لغو شد');save.mockResolvedValueOnce('saved');fireEvent.click(button);expect(await screen.findByRole('status')).toHaveTextContent('ذخیره شد');
});
it('clears prior success and reports unsupported or failed writes without raw errors',async()=>{
 save.mockResolvedValueOnce('saved').mockRejectedValueOnce(new ProjectExportUnavailable()).mockRejectedValueOnce(Error('secret provider path'));render(<Export/>);fireEvent.click(screen.getByRole('button'));await screen.findByRole('status');fireEvent.click(screen.getByRole('button'));expect(await screen.findByRole('alert')).toHaveTextContent('نسخهٔ وب');expect(screen.queryByRole('status')).toBeNull();fireEvent.click(screen.getByRole('button'));expect(await screen.findByRole('alert')).toHaveTextContent('انجام نشد');expect(screen.queryByText(/secret provider/)).toBeNull();
});
it('exports the selected ChEBI record with provenance and retains it after cancellation',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(record))));save.mockResolvedValue('cancelled');render(<ChebiExplorer en initialQuery={record.id}/>);fireEvent.click(screen.getByRole('button',{name:'Search ChEBI database'}));await screen.findByRole('article');fireEvent.click(screen.getByRole('button',{name:'Download record and provenance (JSON)'}));await screen.findByText(/File save cancelled/);const [text,name,kind]=save.mock.calls[0];expect(JSON.parse(text)).toEqual({...record,comparedPubchemCid:null});expect(name).toBe('artin-CHEBI-17790.json');expect(kind).toBe('json');expect(screen.getByRole('article')).toBeInTheDocument();
});
