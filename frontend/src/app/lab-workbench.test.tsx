import React from 'react';
import {expect,it,vi} from 'vitest';
import {render,screen,fireEvent,within} from '@testing-library/react';
import LabWorkbench from './calculators/workspace/LabWorkbench';
import bank from './calculators/method-bank.json';
import {methodName} from './calculators/method-names-en';
const callbacks=()=>({onNew:vi.fn(),onOpen:vi.fn(),onContinue:vi.fn(),onMethod:vi.fn(),onSection:vi.fn()});
it('searches the actual method bank, combines material filters and resets an empty result',()=>{
 const actions=callbacks();render(<LabWorkbench en hasDraft={false} identity={{title:'',sample:'',matrix:'',sop:'',edition:''}} workflowTitle="GC" {...actions}/>);
 expect(screen.getAllByRole('button',{name:/^Create project for /})).toHaveLength(7);
 fireEvent.change(screen.getByLabelText('Search test methods'),{target:{value:'D445'}});
 const expected=bank.filter(m=>`${m.name} ${methodName(m,true)} ${m.standard_codes.join(' ')}`.includes('D445')).slice(0,7);
 expect(screen.getAllByRole('button',{name:/^Create project for /})).toHaveLength(expected.length);
 fireEvent.click(screen.getAllByRole('button',{name:/^Create project for /})[0]);expect(actions.onMethod).toHaveBeenCalledWith(expected[0].id);
 fireEvent.change(screen.getByLabelText('Filter material group'),{target:{value:'قیر'}});
 expect(screen.getByText('No matching method')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Clear filters'}));expect(screen.getAllByRole('button',{name:/^Create project for /})).toHaveLength(7);
});
it('shows the real current draft and opens or continues it through the provided actions',()=>{
 const actions=callbacks();render(<LabWorkbench en hasDraft identity={{title:'Synthetic sample',sample:'QA-4',matrix:'Oil',sop:'SOP-1',edition:'1'}} workflowTitle="D445 method" {...actions}/>);
 const current=screen.getByRole('heading',{name:'Current project'}).closest('section')!;
 expect(current).toHaveTextContent('Synthetic sample');expect(current).toHaveTextContent('QA-4');expect(current).toHaveTextContent('D445 method');
 fireEvent.click(within(current).getByRole('button',{name:'Continue this project'}));expect(actions.onContinue).toHaveBeenCalledOnce();
 fireEvent.click(screen.getByRole('button',{name:'Continue from a file'}));expect(actions.onOpen).toHaveBeenCalledOnce();
 expect(screen.getByText('Autosave is off. Save a project file before leaving.')).toBeVisible();
});
