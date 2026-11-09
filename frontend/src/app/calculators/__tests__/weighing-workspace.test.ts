import {describe,it,expect} from 'vitest';
import {emptyWeighing,calculateWeighing} from '../workspace/weighing';
import {readLabProject,serializeLabProject} from '../workspace/project-file';
describe('weighing project',()=>{
  const example=()=>{const d=emptyWeighing();d.mass='۵۰';d.coverageSource='Hypothetical k basis';d.independent=true;d.components.calibration={value:'.004',kind:'certificate',divisor:'2',source:'Hypothetical calibration'};d.components.resolution={value:'.001',kind:'resolution',divisor:'',source:'Hypothetical display step'};d.components.repeatability={value:'.003',kind:'repeatability',divisor:'1',source:'Hypothetical independent study'};return d;};
  it('matches an independent reference and preserves raw inputs on file round trip',()=>{
    const d=example(),r=calculateWeighing(d);
    expect(r.mass).toBe(50);expect(r.standard).toBeCloseTo(Math.sqrt(.004**2/4+.001**2/12+.003**2),12);
    const project=readLabProject({format:'artin-lab-project',version:1,id:'weighing-test',savedAt:'2026-11-05T00:00:00Z',workflow:'weighing',weighing:d,identity:{title:'توزین',sample:'',sop:'',edition:'',matrix:''},evidence:[],standards:[['',''],['',''],['','']],stage:0});
    const restored=readLabProject(JSON.parse(serializeLabProject(project)));
    expect(restored.weighing).toEqual(d);expect(calculateWeighing(restored.weighing!)).toEqual(r);
    expect(()=>readLabProject({...project,weighing:{...d,independent:'yes'}})).toThrow();
  });
  it('rejects missing evidence and invalid quantities instead of inventing zero',()=>{
    expect(()=>calculateWeighing(emptyWeighing())).toThrow();
    for(const change of [(d:ReturnType<typeof example>)=>{d.mass='-1';},(d:ReturnType<typeof example>)=>{d.components.calibration.source='';},(d:ReturnType<typeof example>)=>{d.components.repeatability.divisor='1.5';},(d:ReturnType<typeof example>)=>{d.independent=false;}]){const d=example();change(d);expect(()=>calculateWeighing(d)).toThrow();}
  });
});
