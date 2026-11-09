import React from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
const save=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/i18n',()=>({useI18n:()=>({locale:'en'})}));
vi.mock('@/lib/save-project-file',()=>({saveProjectJSON:save,ProjectExportUnavailable:class ProjectExportUnavailable extends Error{}}));
import Workspace from './calculators/workspace/page';
import {ProjectExportUnavailable} from '@/lib/save-project-file';
beforeEach(()=>{vi.restoreAllMocks();save.mockReset();});
function draft(){render(<Workspace/>);fireEvent.click(screen.getByRole('button',{name:'Test project'}));fireEvent.change(screen.getByLabelText('Project title'),{target:{value:'Synthetic native-save project'}});fireEvent.change(screen.getByLabelText('Sample ID'),{target:{value:'DEMO-NATIVE-44'}});}
it('awaits native completion, blocks duplicate toolbar saves and exports the actual editable project',async()=>{
 let finish!:(status:string)=>void;save.mockReturnValue(new Promise<string>(resolve=>{finish=resolve;}));draft();const button=screen.getByRole('button',{name:'Save project file'});fireEvent.click(button);expect(button).toBeDisabled();fireEvent.click(button);expect(save).toHaveBeenCalledTimes(1);
 const payload=JSON.parse(save.mock.calls[0][0]);expect(payload.format).toBe('artin-lab-project');expect(payload.identity.sample).toBe('DEMO-NATIVE-44');expect(screen.queryByText(/saved to the selected destination/)).toBeNull();finish('saved');await screen.findByText('The project file was saved to the selected destination.');expect(button).toBeEnabled();expect(screen.getByLabelText('Sample ID')).toHaveValue('DEMO-NATIVE-44');
});
it('retains data and treats a cancelled picker as neither a successful save nor an error',async()=>{
 save.mockResolvedValue('cancelled');draft();fireEvent.click(screen.getByRole('button',{name:'Save project file'}));await screen.findByText('Save cancelled; save again to retain your project.');expect(screen.queryByRole('alert')).toBeNull();expect(screen.queryByText(/saved to the selected destination/)).toBeNull();expect(screen.getByLabelText('Project title')).toHaveValue('Synthetic native-save project');
});
it('explains an old app plugin and makes saving available again after failure',async()=>{
 save.mockRejectedValue(new ProjectExportUnavailable());draft();fireEvent.click(screen.getByRole('button',{name:'Save project file'}));expect(await screen.findByRole('alert')).toHaveTextContent('use the web version or update the app package');expect(screen.getByRole('button',{name:'Save project file'})).toBeEnabled();expect(screen.getByLabelText('Sample ID')).toHaveValue('DEMO-NATIVE-44');
});
it('keeps browser download-ready wording separate from a confirmed native save',async()=>{
 save.mockResolvedValue('download-started');draft();fireEvent.click(screen.getByRole('button',{name:'Save project file'}));await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('prepared for download'));expect(screen.queryByText(/saved to the selected destination/)).toBeNull();
});
