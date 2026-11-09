import React,{useState} from 'react';
import {afterEach,describe,expect,it} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {GCSampleForm} from '../workspace/GCWorkflow';
import {emptyGCData} from '../workspace/gc-workflow';
import {emptyStockPreparation} from '../workspace/gc-workflow';
import StockPreparationForm from '../workspace/StockPreparationForm';

afterEach(cleanup);
function Form({en=true}:{en?:boolean}){
  const [data,setData]=useState(emptyGCData);
  return <GCSampleForm en={en} data={data} onChange={setData}/>;
}
describe('guided stock preparation UI',()=>{
  it('associates the purity error with its input, translates it and clears it after correction',()=>{
    const data=emptyStockPreparation();
    data.inputs.purity.nominal='۱۰۱';
    const {rerender}=render(<StockPreparationForm en value={data} onChange={()=>{}}/>);
    const input=screen.getByDisplayValue('۱۰۱');
    expect(input).toHaveAttribute('aria-invalid','true');
    expect(input).toHaveAccessibleDescription('Purity must not exceed 100%.');
    rerender(<StockPreparationForm en={false} value={data} onChange={()=>{}}/>);
    expect(input).toHaveAccessibleDescription('خلوص نمی‌تواند بیشتر از ۱۰۰٪ باشد.');
    data.inputs.purity.nominal='۹۹٫۵';
    rerender(<StockPreparationForm en={false} value={data} onChange={()=>{}}/>);
    expect(input).toHaveAttribute('aria-invalid','false');
    expect(input).not.toHaveAttribute('aria-describedby');
  });
  it('adds a linked preparation, derives its relative uncertainty and resets overlap approval after editing',()=>{
    render(<Form/>);
    fireEvent.click(screen.getByRole('button',{name:'+ Shared calibration-standard scale effect'}));
    const component=within(screen.getByRole('group',{name:'1. Shared calibration-standard scale effect'}));
    fireEvent.click(component.getByRole('checkbox',{name:'I do not have the relative uncertainty; calculate it from preparation data.'}));
    const preparation=within(screen.getByRole('region',{name:'Shared standard preparation'}));
    for(const [name,nominal,u] of [['Weighed substance mass (mg)','100','.1'],['Substance purity (%)','99','.2'],['Final stock-solution volume (mL)','100','.1']]){
      const row=within(preparation.getByRole('heading',{name}).parentElement!);
      fireEvent.change(row.getByLabelText('Actual value'),{target:{value:nominal}});
      fireEvent.change(row.getByLabelText('Uncertainty value or bound, in units above'),{target:{value:u}});
      fireEvent.change(row.getByLabelText('Source or record reference'),{target:{value:`Hypothetical ${name} study`}});
    }
    fireEvent.click(preparation.getByRole('checkbox',{name:/I have assessed the preparation sources/}));
    expect(preparation.getByRole('status').textContent).toContain('990.0000 mg/L');
    const expected=(100*Math.hypot(.1/100,.2/99,.1/100)).toPrecision(6);
    expect(preparation.getByRole('status').textContent).toContain(`${expected} %`);
    const overlap=component.getByLabelText('Overlap assessment against this budget');
    fireEvent.change(overlap,{target:{value:'Common stock effect is excluded from fit scatter'}});
    const reviewed=component.getByRole('checkbox',{name:/Based on the source and assessment above/});
    fireEvent.click(reviewed);expect(reviewed).toBeChecked();
    const mass=within(preparation.getByRole('heading',{name:'Weighed substance mass (mg)'}).parentElement!);
    fireEvent.change(mass.getByLabelText('Uncertainty value or bound, in units above'),{target:{value:'.2'}});
    expect(reviewed).not.toBeChecked();
    expect(preparation.getByRole('status').textContent).not.toContain(`${expected} %`);
    fireEvent.click(preparation.getByRole('checkbox',{name:'There is one common dilution step after stock preparation.'}));
    expect(preparation.getByRole('heading',{name:'Aliquot from stock solution (mL)'})).toBeVisible();
    expect(preparation.getByRole('status').textContent).toContain('To calculate');
  });
  it('provides Persian labels and supports returning to manual entry',()=>{
    render(<Form en={false}/>);
    fireEvent.click(screen.getByRole('button',{name:'+ اثر مشترک استانداردهای کالیبراسیون'}));
    const component=within(screen.getByRole('group',{name:'1. اثر مشترک استانداردهای کالیبراسیون'}));
    const toggle=component.getByRole('checkbox',{name:'درصد آماده ندارم؛ از داده‌های تهیهٔ استاندارد حساب کن.'});
    fireEvent.click(toggle);
    expect(screen.getByRole('heading',{name:'جرم مادهٔ توزین‌شده (mg)'})).toBeVisible();
    expect(screen.getByRole('heading',{name:'حجم نهایی محلول مادر (mL)'})).toBeVisible();
    fireEvent.click(toggle);
    expect(screen.queryByRole('region',{name:'تهیهٔ استاندارد مشترک'})).not.toBeInTheDocument();
    expect(component.getByRole('textbox',{name:'عدد عدم‌قطعیت یا حد (%) u = input'})).toBeVisible();
  });
});
