import {expect,it} from "vitest";
import {extendedModels} from "../extended-models";
import bank from "../method-bank.json";
import {methodProfile,profileCounts} from "../method-profiles";
import {readMethodRecord} from "../method-record";

const expected:Record<string,number>={acidBaseNumber:2.1318,pycnometer:25/29.94*998.2,volumePercent:.5,ratioPercent:75,solubility:95,transmission:50,absorbance:Math.log10(2),apiGravity:141.5/.85-131.5,kfCoulometric:100,kfVolumetric:2400,gcNormalization:20};
it.each(Object.entries(extendedModels))("validates %s and all analytic sensitivities",(key,model)=>{
  const x=model.example!;
  const result=model.evaluate(x);
  expect(result.valid).toBe(true);
  expect(result.value).toBeCloseTo(expected[key],9);
  expect(result.sensitivities).toHaveLength(x.length);
  x.forEach((value,index)=>{
    const h=Math.max(Math.abs(value),.01)*1e-5;
    const plus=x.map((v,i)=>i===index?v+h:v),minus=x.map((v,i)=>i===index?v-h:v);
    const independent=(model.evaluate(plus).value-model.evaluate(minus).value)/(2*h);
    expect(Math.abs(result.sensitivities[index]-independent)/Math.max(1,Math.abs(independent))).toBeLessThan(1e-6);
  });
});
it.each([['acidBaseNumber',[1,0,.1,0,56.1]],['pycnometer',[20,40,20,1000]],['volumePercent',[101,100]],['solubility',[-1,10]],['absorbance',[0]],['absorbance',[101]],['apiGravity',[0]],['kfCoulometric',[100,0,0]],['kfVolumetric',[1,0,0,1]],['gcNormalization',[0,1,0]]] as const)("rejects invalid %s physical inputs",(key,x)=>{
  expect(extendedModels[key].evaluate([...x]).valid).toBe(false);
});
it("covers all 98 records without treating qualitative tests as numeric uncertainty",()=>{
  expect(bank).toHaveLength(98);
  expect(new Set(bank.map(row=>row.id)).size).toBe(98);
  expect(Object.values(profileCounts).reduce((a,b)=>a+b,0)).toBe(98);
  bank.forEach(row=>{
    const profile=methodProfile(row);
    expect(profile.effects.length).toBeGreaterThan(0);
    expect(profile.scope.length).toBeGreaterThan(30);
    if(profile.kind==='numeric')expect(profile.models.length).toBeGreaterThan(0);
    if(profile.kind==='qualitative')expect(profile.models).toHaveLength(0);
  });
});
it("restores only the selected method's record and rejects invalid input",()=>{
  const record={format:'artin-method-record',version:1,methodId:11,sop:'D130 SOP',outcome:'1a',evidence:'Reference strip'};
  expect(readMethodRecord(record,11).outcome).toBe('1a');
  expect(()=>readMethodRecord(record,24)).toThrow();
  expect(()=>readMethodRecord({...record,evidence:[]},11)).toThrow();
});
