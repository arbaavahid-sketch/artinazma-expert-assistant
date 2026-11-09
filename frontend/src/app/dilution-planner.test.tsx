import React,{useState} from 'react';
import {it,expect} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import DilutionPlanner from './calculators/workspace/DilutionPlanner';
import {type DilutionPlan} from './calculators/workspace/dilution-plan';
it('retains inputs across languages and invalidates instructions on editing',()=>{function Form({en}:{en:boolean}){const [p,setP]=useState<DilutionPlan>({stock:'1000',unit:'mg/L',source:'Example',steps:[{target:'100',unit:'mg/L',volume:'100',volumeUnit:'mL'}]});return <DilutionPlanner en={en} value={p} onChange={setP}/>;}const view=render(<Form en/>);fireEvent.click(screen.getByText('Independent and serial dilution plan'));fireEvent.click(screen.getByRole('button',{name:'Calculate plan'}));expect(screen.getByRole('status')).toHaveTextContent('10.00000 mL');view.rerender(<Form en={false}/>);expect(screen.getByRole('status')).toHaveTextContent('10.00000 mL');fireEvent.change(screen.getByLabelText('غلظت مقصد'),{target:{value:'50'}});expect(screen.getByRole('status')).toHaveTextContent('دوباره محاسبه کنید');expect(screen.queryByText('10.00000 mL')).toBeNull();});
