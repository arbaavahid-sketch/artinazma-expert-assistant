import {fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {measurementRegistry,evaluateRegisteredModel} from '../registered-models';
import {familyModels} from '../family-models';
import {methodName} from '../method-names-en';
import {methodProfile,profileCounts} from '../method-profiles';
import bank from '../method-bank.json';
import GumBudget from '../GumBudget';
const request=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/api',()=>({apiUrl:(path:string)=>path,customerFetch:request}));
const persianLetters=/[آ-ی]/;

it.each(Object.entries(measurementRegistry))('checks shared %s equation and exact sensitivities',(kind,model)=>{
 const inputs=model.example!;const answer=evaluateRegisteredModel(kind,inputs);
 expect(answer.valid).toBe(true);
 (model.uncertain_indices??inputs.map((_,i)=>i)).forEach((index,position)=>{
   const h=Math.max(Math.abs(inputs[index]),.01)*1e-4;
   const a=inputs.map((v,i)=>i===index?v+h:v),b=inputs.map((v,i)=>i===index?v-h:v);
   const independent=(evaluateRegisteredModel(kind,a).value-evaluateRegisteredModel(kind,b).value)/(2*h);
   expect(Math.abs(answer.sensitivities[position]-independent)/Math.max(1,Math.abs(independent))).toBeLessThan(2e-5);
 });
});

it.each(Object.entries(familyModels))('changes all generated %s component names and sources when the language changes',(key)=>{
 const page=render(<GumBudget en={false} parseNumber={Number}/>);
 fireEvent.change(screen.getByLabelText('آزمون یا روش را انتخاب کنید'),{target:{value:`family:${key}`}});
 fireEvent.click(screen.getByRole('button',{name:'بارگذاری ورودی‌های فرضی؛ عدم‌قطعیت‌ها را خودتان وارد کنید'}));
 page.rerender(<GumBudget en parseNumber={Number}/>);
 expect(page.container.textContent).not.toMatch(persianLetters);
 screen.getAllByLabelText('Component').forEach(field=>expect((field as HTMLInputElement).value).not.toMatch(persianLetters));
 screen.getAllByLabelText('Source').forEach(field=>expect((field as HTMLInputElement).value).not.toMatch(persianLetters));
 page.rerender(<GumBudget en={false} parseNumber={Number}/>);
 expect(page.container.textContent).toMatch(persianLetters);
});

it('covers all nine previously missing tests with explicit method-specific models in both languages',()=>{
 expect(profileCounts).toEqual({numeric:88,qualitative:9,sampling:1,custom:0});
 [7,10,29,54,72,77,78,79,81].forEach(id=>{
  const method=bank.find(row=>row.id===id)!;
  const profile=methodProfile(method,true);
  expect(profile.models.length).toBeGreaterThan(0);
  expect(profile.scope).not.toMatch(persianLetters);
  expect(profile.effects.join(' ')).not.toMatch(persianLetters);
  expect(methodName(method,true)).not.toMatch(persianLetters);
 });
});

it('requests the full registered equation for a new scientific model',async()=>{
 const result=evaluateRegisteredModel('viscosityIndex',[73.3,8.86]);
 request.mockClear();request.mockResolvedValue({ok:true,json:async()=>({standard_uncertainty:1,expanded_uncertainty:2,engine:'artin-linear-gum',engine_version:'1',components:Array(4).fill({variance_percent:25}),simulation:{engine:'numpy-model-mc',engine_version:'test',model:'viscosityIndex',samples:20000,seed:12345,probability:.95,mean:result.value,standard_uncertainty:1,lower:result.value-2,upper:result.value+2,histogram:[{offset:0,count:20000}]}})});
 render(<GumBudget en parseNumber={Number}/>);
 fireEvent.change(screen.getByLabelText('Select test or method'),{target:{value:'family:viscosityIndex'}});
 fireEvent.click(screen.getByRole('button',{name:'Load hypothetical measurement inputs'}));
 screen.getAllByLabelText('Uncertainty value or bound').forEach(input=>fireEvent.change(input,{target:{value:'.01'}}));
 fireEvent.click(screen.getByLabelText('Compare with Monte Carlo'));
 fireEvent.click(screen.getByRole('button',{name:'Calculate budget'}));
 await screen.findByText('Monte Carlo · full measurement model');
 expect(JSON.parse(request.mock.calls[0][1].body).measurement_model).toEqual({kind:'viscosityIndex',nominals:[73.3,8.86]});
});
