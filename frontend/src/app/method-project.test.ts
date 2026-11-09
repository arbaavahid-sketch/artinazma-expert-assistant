import {expect,it} from 'vitest';
import bank from './calculators/method-bank.json';
import {methodProfile} from './calculators/method-profiles';
import {emptyMethodStudy,readMethodStudy} from './calculators/workspace/method-study';
import {readLabProject,serializeLabProject,type LabProject} from './calculators/workspace/project-file';
const project=(methodId:number):LabProject=>({format:'artin-lab-project',version:1,id:'method-test',savedAt:'2026-11-09T00:00:00Z',workflow:'method-study',methodStudy:{...emptyMethodStudy(methodId),outcome:'Observed result',conditions:'Recorded conditions',evidence:'Raw data source',decision:'Assessor review'},identity:{title:'Synthetic project',sample:'S-1',sop:'LAB-1',edition:'1',matrix:'Oil'},evidence:[],standards:[['',''],['',''],['','']],stage:0});
it('roundtrips a real project record for every method in the bank, including qualitative and sampling methods',()=>{
 expect(bank).toHaveLength(98);
 for(const method of bank){const input=project(method.id);const restored=readLabProject(JSON.parse(serializeLabProject(input)));expect(restored).toEqual(input);}
});
it('rejects unknown methods, oversized evidence and method data on an unrelated workflow',()=>{
 expect(()=>emptyMethodStudy(9999)).toThrow();
 expect(()=>readMethodStudy({...emptyMethodStudy(1),evidence:'x'.repeat(5001)})).toThrow();
 expect(()=>readLabProject({...project(1),workflow:'gc-external-extraction'})).toThrow();
 expect(()=>readLabProject({...project(1),methodStudy:undefined})).toThrow();
});
const row={name:'Source',source:'Synthetic evidence',unit:'g',u:'.01',c:'1',kind:'standard',divisor:'2'};
const budget={format:'artin-gum',version:1,savedAt:'2026-11-09T00:00:00Z',template:'general',rows:[row],inputs:{result:'2',unit:'% mass',activeMethodId:'1'},gcData:{},familyData:[],correlations:[]};
it('persists the complete embedded numeric budget and rejects cross-method models and identities',()=>{
 const input={...project(1),methodStudy:{...emptyMethodStudy(1),budget:budget as NonNullable<LabProject['methodStudy']>['budget']}};
 expect(readLabProject(JSON.parse(serializeLabProject(input))).methodStudy?.budget?.rows[0].source).toBe('Synthetic evidence');
 expect(()=>readMethodStudy({...emptyMethodStudy(1),budget:{...budget,inputs:{...budget.inputs,activeMethodId:'2'}}})).toThrow();
 expect(()=>readMethodStudy({...emptyMethodStudy(1),budget:{...budget,template:'family:viscosity',rows:[row,row,row,row],familyData:['.1','100']}})).toThrow();
 for(const method of bank.filter(m=>['qualitative','sampling'].includes(methodProfile(m).kind))){expect(()=>readMethodStudy({...emptyMethodStudy(method.id),budget})).toThrow();}
});
