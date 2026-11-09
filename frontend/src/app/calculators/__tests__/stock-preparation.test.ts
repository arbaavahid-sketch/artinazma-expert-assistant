import {describe,expect,it} from 'vitest';
import {calculateStockPreparation,emptyStockPreparation,emptyGCData,gcInputKey,newGCAdditional,prepareGCBudget,resolvedAdditional} from '../workspace/gc-workflow';
import {readLabProject,serializeLabProject,type LabProject} from '../workspace/project-file';
import {buildGCReport} from '../workspace/gc-report';

function example(){
  const prep=emptyStockPreparation();prep.independent=true;
  const values={mass:['100','.1'],purity:['99','0.2'],volume:['100','.1'],aliquot:['10','.01'],finalVolume:['100','.1']};
  for(const key of Object.keys(values) as (keyof typeof values)[]){prep.inputs[key].nominal=values[key][0];prep.inputs[key].uncertainty={value:values[key][1],kind:'standard',divisor:'',source:`Hypothetical ${key} certificate`};}
  return prep;
}
describe('shared stock preparation',()=>{
  it('uses mg, purity percent and mL consistently, with an optional common dilution',()=>{
    const prep=example(),result=calculateStockPreparation(prep);
    expect(result.concentration).toBeCloseTo(990,10);
    expect(result.relativePercent).toBeCloseTo(100*Math.hypot(.1/100,.2/99,.1/100),12);
    expect(result.components).toHaveLength(3);
    prep.dilution=true;const diluted=calculateStockPreparation(prep);
    expect(diluted.concentration).toBeCloseTo(99,10);
    expect(diluted.relativePercent).toBeCloseTo(100*Math.hypot(.1/100,.2/99,.1/100,.01/10,.1/100),12);
    expect(diluted.components).toHaveLength(5);
    prep.inputs.mass.uncertainty={value:'.2',kind:'certificate',divisor:'2',source:'Hypothetical balance certificate'};
    expect(calculateStockPreparation(prep).relativePercent).toBeCloseTo(diluted.relativePercent,12);
  });
  it('rejects missing sources, invalid purity, unreviewed independence and impossible dilution',()=>{
    const prep=example();prep.independent=false;expect(()=>calculateStockPreparation(prep)).toThrow();
    prep.independent=true;prep.inputs.purity.nominal='100.1';expect(()=>calculateStockPreparation(prep)).toThrow();
    prep.inputs.purity.nominal='99';prep.inputs.volume.uncertainty.source='';expect(()=>calculateStockPreparation(prep)).toThrow();
    prep.inputs.volume.uncertainty.source='Reference';prep.dilution=true;prep.inputs.aliquot.nominal='101';expect(()=>calculateStockPreparation(prep)).toThrow();
    prep.dilution=false;expect(calculateStockPreparation(prep).components).toHaveLength(3);
  });
  it('recomputes the linked relative effect, saves the evidence and reports the raw preparation inputs',()=>{
    const rows=[['0','10'],['5','61'],['10','109'],['15','161']],data=emptyGCData();
    data.values={area:'110',extract:'50',dilution:'2',mass:'10',recovery:'80'};
    for(const key of Object.keys(data.values) as (keyof typeof data.values)[])data.uncertainties[key]={value:'0',kind:'standard',divisor:'',source:'Hypothetical isolated model test'};
    data.coverageSource='Hypothetical convention';
    const item={...newGCAdditional('standardScale','prep'),preparation:example(),overlapNote:'Shared stock effect only; excludes independently prepared levels',independent:true};
    data.additional=[item];
    const nominal=prepareGCBudget(rows,data),relative=calculateStockPreparation(item.preparation).relativePercent;
    expect(nominal.request.components[7].value).toBeCloseTo(nominal.request.measured*relative/100,12);
    const oldKey=gcInputKey(rows,data);item.preparation.inputs.mass.uncertainty.value='.2';
    expect(gcInputKey(rows,data)).not.toBe(oldKey);
    expect(prepareGCBudget(rows,data).request.components[7].value).toBeGreaterThan(nominal.request.components[7].value);
    expect(resolvedAdditional(item)).toMatchObject({kind:'standard',divisor:''});
    expect(()=>resolvedAdditional({...item,preset:'custom'})).toThrow();
    const project:LabProject={format:'artin-lab-project',version:1,id:'prep-test',savedAt:'2026-11-05T00:00:00Z',workflow:'gc-external-extraction',identity:{title:'Hypothetical report',sample:'',matrix:'',sop:'',edition:''},evidence:[],standards:rows,stage:3,gc:{data}};
    const restored=readLabProject(JSON.parse(serializeLabProject(project)));
    expect(restored.gc?.data.additional?.[0].preparation).toEqual(item.preparation);
    const {request}=prepareGCBudget(rows,data);
    const run={calculatedAt:project.savedAt,inputKey:gcInputKey(rows,data),measured:request.measured,standard:1,expanded:2,coverage:2,engine:'test',engineVersion:'1'};
    const html=buildGCReport({identity:project.identity,rows,data,run,verified:true,en:true,generatedAt:project.savedAt});
    expect(html).toContain('Shared standard preparation data');expect(html).toContain('Hypothetical mass certificate');expect(html).toContain('Weighed mass (mg)');expect(html).toContain('990');
    for(const prep of [{...item.preparation,independent:'yes'},{...item.preparation,inputs:{mass:{nominal:100}}}]){
      expect(()=>readLabProject({...project,gc:{data:{...data,additional:[{...item,preparation:prep}]}}})).toThrow();
    }
  });
});
