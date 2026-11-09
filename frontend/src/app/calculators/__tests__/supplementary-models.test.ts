import {expect,it} from "vitest";
import {supplementaryModels} from "../supplementary-models";
const answers:Record<string,number>={indicationError:.2,relativeError:2,inverseCalibration:20,moistureWet:20,moistureDry:25,spikeRecovery:100,massConcentrationTitration:198.1782,forceArea:100,electricalResistance:50,porosity:40,linearExpansion:.24};
it.each(Object.entries(supplementaryModels))("checks %s against an independent example and finite differences",(key,model)=>{
 const x=model.example!,result=model.evaluate(x);
 expect(result.valid).toBe(true);expect(result.value).toBeCloseTo(answers[key],8);
 x.forEach((value,index)=>{
  const h=Math.max(Math.abs(value),1e-5)*1e-5;
  const a=x.map((v,i)=>i===index?v+h:v),b=x.map((v,i)=>i===index?v-h:v);
  const derivative=(model.evaluate(a).value-model.evaluate(b).value)/(2*h);
  expect(Math.abs(result.sensitivities[index]-derivative)/Math.max(1,Math.abs(derivative))).toBeLessThan(1e-6);
 });
});
