import {evaluateRegisteredModel} from '../registered-models';
import {numeric,uncertaintyComponent,standardComponentValue,type UncertaintyInput} from './gc-workflow';
export const densityKeys=['mass','volume'] as const;
export type DensityData={modelVersion:1;inputs:Record<typeof densityKeys[number],{nominal:string;uncertainty:UncertaintyInput}>;conditions:string;coverage:string;coverageSource:string;independent:boolean};
export function emptyDensity():DensityData{return {modelVersion:1,inputs:{mass:{nominal:'',uncertainty:{value:'',kind:'standard',divisor:'',source:''}},volume:{nominal:'',uncertainty:{value:'',kind:'standard',divisor:'',source:''}}},conditions:'',coverage:'2',coverageSource:'',independent:false};}
export function densityErrors(data:DensityData){
  const errors:Record<string,string>={};
  for(const key of densityKeys){const input=data.inputs[key],u=input.uncertainty;
    if(!Number.isFinite(numeric(input.nominal))||numeric(input.nominal)<=0)errors[`${key}.nominal`]='positive';
    if(!Number.isFinite(numeric(u.value))||numeric(u.value)<0||numeric(u.value)>1e100)errors[`${key}.value`]='uncertainty';
    if(!u.source.trim())errors[`${key}.source`]='source';
    if(u.kind==='certificate'&&!(numeric(u.divisor)>0))errors[`${key}.divisor`]='coverage';
    if(u.kind==='repeatability'&&(!Number.isInteger(numeric(u.divisor))||numeric(u.divisor)<1||numeric(u.divisor)>1000000))errors[`${key}.divisor`]='count';
  }
  if(!data.conditions.trim())errors.conditions='conditions';
  if(!Number.isFinite(numeric(data.coverage))||numeric(data.coverage)<=0)errors.coverage='coverage';
  if(!data.coverageSource.trim())errors.coverageSource='source';
  if(!data.independent)errors.independent='independence';
  return errors;
}
export function calculateDensity(data:DensityData){
  if(data.modelVersion!==1||Object.keys(densityErrors(data)).length)throw new Error('Invalid density data');
  const model=evaluateRegisteredModel('density',densityKeys.map(key=>numeric(data.inputs[key].nominal)));
  if(!model.valid)throw new Error('Invalid density model');
  const budget=densityKeys.map((key,i)=>{const u=standardComponentValue(uncertaintyComponent(data.inputs[key].uncertainty));const sensitivity=model.sensitivities[i];return {key,u,sensitivity,effect:sensitivity*u};});
  const standard=Math.hypot(...budget.map(c=>c.effect)),k=numeric(data.coverage),expanded=k*standard;
  if(!Number.isFinite(expanded)||budget.some(c=>!Number.isFinite(c.effect)))throw new Error('Invalid density result');
  return {density:model.value,standard,expanded,k,budget};
}
export const densityScope={fa:'چگالی از جرم خالص تصحیح‌شده (g) و حجم همان نمونه (mL) در شرایط ثبت‌شده محاسبه می‌شود. حجم باید به همان دما و شرایط جرم مربوط باشد. این مدل تصحیح دما، شناوری، پیکنومتر یا هم‌بستگی جرم و حجم را محاسبه نمی‌کند. عدم‌قطعیت هر ورودی باید بودجهٔ مستقل و کامل همان کمیت باشد؛ مؤلفهٔ مفقود را با صفر جایگزین نکنید. انتشار مرتبهٔ اول برای عدم‌قطعیت‌های کوچک نسبت به ورودی‌هاست.',en:'Density uses corrected net mass (g) and volume of the same sample (mL) at the recorded conditions. Volume must refer to the same temperature and conditions as the mass. This model does not calculate temperature or buoyancy corrections, pycnometer models or mass–volume correlation. Each input uncertainty must represent the complete independent budget for that quantity; do not replace missing components with zero. First-order propagation applies to uncertainties small relative to the inputs.'};
