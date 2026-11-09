import React,{useState} from 'react';
import {expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import DensityForm from './calculators/workspace/DensityForm';
import {emptyDensity} from './calculators/workspace/density';
import WeighingForm from './calculators/workspace/WeighingForm';
import {emptyWeighing} from './calculators/workspace/weighing';
vi.mock('./calculators/workspace/usePhysicalCalculation',()=>({usePhysicalCalculation:()=>({busy:false,failure:false,current:false,calculate:vi.fn()})}));
function Harness({en}:{en:boolean}){
 const [data,setData]=useState(emptyWeighing());
 return <WeighingForm en={en} data={data} onChange={setData} identity={{title:'Example',sample:'',sop:'',edition:'',matrix:''}}/>;
}
it.each([true,false])('describes invalid inputs and focuses the first input (English=%s)',async en=>{
 render(<Harness en={en}/>);
 const mass=screen.getByLabelText(en?'Corrected mass (g)':'جرم تصحیح‌شده (g)');
 expect(mass).toHaveAttribute('aria-invalid','false');
 fireEvent.click(screen.getByRole('button',{name:en?'Calculate weighing':'محاسبهٔ توزین'}));
 await waitFor(()=>expect(mass).toHaveFocus());
 expect(mass).toHaveAttribute('aria-invalid','true');
 expect(mass).toHaveAccessibleDescription(en?'Enter a valid positive mass.':'جرم مثبت و معتبر وارد کنید.');
 fireEvent.change(mass,{target:{value:'۲۵'}});
 expect(mass).toHaveAttribute('aria-invalid','false');
 expect(mass).not.toHaveAttribute('aria-describedby');
});


function DensityHarness({en}:{en:boolean}){
 const [data,setData]=useState(emptyDensity());
 return <DensityForm en={en} data={data} onChange={setData} identity={{title:'Example',sample:'',sop:'',edition:'',matrix:''}}/>;
}
it.each([true,false])('focuses an invalid density input with its error description (English=%s)',async en=>{
 render(<DensityHarness en={en}/>);
 fireEvent.click(screen.getByRole('button',{name:en?'Calculate density':'محاسبهٔ چگالی'}));
 const mass=screen.getByLabelText(en?'Mass (g)':'جرم (g)');
 await waitFor(()=>expect(mass).toHaveFocus());
 expect(mass).toHaveAccessibleDescription(en?'Enter a valid positive value.':'مقدار مثبت و معتبر وارد کنید.');
 fireEvent.change(mass,{target:{value:'۲۵'}});
 expect(mass).toHaveAttribute('aria-invalid','false');
 expect(mass).not.toHaveAttribute('aria-describedby');
});
