import { describe, expect, it } from 'vitest';
import { emptyGCData, fitGC, gcInputKey, newGCAdditional, numeric, prepareGCBudget, standardComponentValue, validatedGCRun } from '../workspace/gc-workflow';
import { readLabProject, serializeLabProject } from '../workspace/project-file';

const rows=[['0','10'],['5','61'],['10','109'],['15','161']];
function example(){
  const data=emptyGCData();
  data.values={area:'110',extract:'50',dilution:'2',mass:'10',recovery:'80'};
  const uncertainties={area:'1',extract:'0.05',dilution:'0.01',mass:'0.005',recovery:'1'};
  for(const key of Object.keys(uncertainties) as (keyof typeof uncertainties)[]){data.uncertainties[key].value=uncertainties[key];data.uncertainties[key].source='Hypothetical study';}
  data.coverageSource='Hypothetical reporting convention; no exact coverage probability claimed';
  return data;
}
describe('guided GC-FID external calibration and extraction',()=>{
  it('strictly parses bilingual numbers and scientific notation without silently truncating',()=>{
    expect(numeric('۱۲٫۵')).toBe(12.5);expect(numeric('١.٢e٢')).toBe(120);
    for(const value of ['', '1mg', '1 2','1,2','Infinity','NaN','1e999'])expect(numeric(value)).toBeNaN();
  });
  it('derives the fit covariance and registered-model budget from reference data',()=>{
    const {fit,request}=prepareGCBudget(rows,example());
    expect(fit.slope).toBeCloseTo(10.02,10);expect(fit.intercept).toBeCloseTo(10.1,10);
    expect(fit.us).toBeCloseTo(0.1039230485,9);expect(fit.ub).toBeCloseTo(0.9721111048,9);
    expect(fit.correlation).toBeCloseTo(-0.8017837257,9);
    expect(request.measured).toBeCloseTo(124.6257485,6);
    expect(request.measurement_model.kind).toBe('gcExtraction');
    [110,10.02,10.1,50,2,10,80].forEach((value,index)=>expect(request.measurement_model.nominals[index]).toBeCloseTo(value,10));
    const c=request.components.map(item=>item.value*item.sensitivity);
    const variance=c.reduce((s,v)=>s+v*v,0)+2*c[1]*c[2]*fit.correlation;
    expect(2*Math.sqrt(variance)).toBeCloseTo(4.480433,5);
  });
  it('rejects partial standards, flat fits and extrapolation; allows blank trailing rows',()=>{
    expect(fitGC([...rows,['','']]).slope).toBeCloseTo(10.02);
    for(const bad of [[['0','10'],['5',''],['10','109']],[['1','1'],['1','2'],['1','3']],[['1','3'],['2','2'],['3','1']]])expect(()=>fitGC(bad)).toThrow('standards');
    for(const area of ['0','1000']){const d=example();d.values.area=area;expect(()=>prepareGCBudget(rows,d)).toThrow('range');}
  });
  it('requires uncertainty sources and valid certificate factors or averaged counts',()=>{
    const d=example();d.uncertainties.mass.source='';expect(()=>prepareGCBudget(rows,d)).toThrow('uncertainty');
    d.uncertainties.mass.source='Certificate';d.uncertainties.mass.kind='certificate';d.uncertainties.mass.divisor='0';expect(()=>prepareGCBudget(rows,d)).toThrow('uncertainty');
    d.uncertainties.mass.divisor='2';expect(prepareGCBudget(rows,d).request.components[5]).toMatchObject({certificate_k:2});
    d.uncertainties.mass.kind='repeatability';d.uncertainties.mass.divisor='2.5';expect(()=>prepareGCBudget(rows,d)).toThrow('uncertainty');
    d.uncertainties.mass.divisor='4';expect(prepareGCBudget(rows,d).request.components[5]).toMatchObject({repetitions:4});
    d.coverageSource='';expect(()=>prepareGCBudget(rows,d)).toThrow('coverage');
  });
  it('validates engine responses and preserves raw inputs plus a dated execution snapshot',()=>{
    const data=example(),{request}=prepareGCBudget(rows,data);
    const response={measured:request.measured,standard_uncertainty:2.2402165,expanded_uncertainty:4.480433,coverage:2,engine:'artin-linear-gum',engine_version:'1'};
    const run=validatedGCRun(response,rows,data,'2026-11-05T00:00:00Z');
    const project={format:'artin-lab-project',version:1,id:'gc-test',savedAt:run.calculatedAt,workflow:'gc-external-extraction',identity:{title:'مثال فرضی / Hypothetical example',sample:'',matrix:'',sop:'',edition:''},evidence:[],standards:rows,stage:4,gc:{data,run}} as const;
    const restored=readLabProject(JSON.parse(serializeLabProject({...project,evidence:[],standards:rows})));
    expect(restored.gc).toEqual({data,run});
    expect(gcInputKey(rows,{...data,coverage:'3'})).not.toBe(run.inputKey);
    for(const patch of [{measured:1},{standard_uncertainty:-1},{expanded_uncertainty:NaN},{expanded_uncertainty:99},{coverage:3},{engine:null}])expect(()=>validatedGCRun({...response,...patch},rows,data,run.calculatedAt)).toThrow();
    for(const gc of [{data:{...data,values:{area:2}}},{data,run:{...run,standard:-1}},{data,run:{...run,calculatedAt:'bad'}}])expect(()=>readLabProject({...project,gc})).toThrow();
  });
  it('combines shared scale, method RSD and input effects in their actual units',()=>{
    const data=example();
    const scale={...newGCAdditional('standardScale','stock'),value:'2',source:'Hypothetical stock budget',overlapNote:'Common scale excluded from fit scatter',independent:true};
    const precision={...newGCAdditional('methodPrecision','precision'),value:'3',kind:'repeatability' as const,divisor:'4',source:'Hypothetical method study',overlapNote:'Only separately assessed residual precision',independent:true};
    const mass={...newGCAdditional('custom','mass'),name:'Mass drift',target:'mass' as const,value:'0.02',kind:'rectangular' as const,source:'Hypothetical drift bound',overlapNote:'Calibration uncertainty excludes drift',independent:true};
    data.additional=[scale,precision,mass];
    const {request}=prepareGCBudget(rows,data),y=request.measured;
    expect(request.measurement_model.additional_targets).toEqual([-1,-1,5]);
    expect(request.components[7].value).toBeCloseTo(y*.02,10);
    expect(standardComponentValue(request.components[8])).toBeCloseTo(y*.015,10);
    expect(request.components[9].sensitivity).toBeCloseTo(-y/10,10);
    expect(standardComponentValue(request.components[9])).toBeCloseTo(.02/Math.sqrt(3),10);
    expect(gcInputKey(rows,data)).not.toBe(gcInputKey(rows,example()));
    const project={format:'artin-lab-project',version:1,id:'additional-roundtrip',savedAt:'2026-11-05T00:00:00Z',workflow:'gc-external-extraction',identity:{title:'',sample:'',matrix:'',sop:'',edition:''},evidence:[],standards:rows,stage:3,gc:{data}} as const;
    expect(readLabProject(project).gc?.data.additional).toEqual(data.additional);
    for(const additional of [[{...scale,independent:false}],[{...scale,overlapNote:''}],[{...scale,target:'mass'}],[{...scale,basis:'absolute'}],[scale,scale]]){
      expect(()=>prepareGCBudget(rows,{...data,additional:additional as typeof data.additional})).toThrow('additional');
    }
    for(const additional of [[{...scale,independent:'yes'}],[{...scale,target:'slope'}],[{...scale,kind:'invented'}],[scale,scale],Array.from({length:21},(_,i)=>({...scale,id:`id-${i}`}))]){
      expect(()=>readLabProject({...project,gc:{data:{...data,additional}}})).toThrow();
    }
  });
});
