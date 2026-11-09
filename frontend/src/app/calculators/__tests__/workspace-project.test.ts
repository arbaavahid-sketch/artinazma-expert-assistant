import { describe, expect, it } from 'vitest';
import { MAX_PROJECT_BYTES, parseProjectFile, readLabProject, serializeLabProject, type LabProject } from '../workspace/project-file';

const project: LabProject = {
  format:'artin-lab-project',version:1,id:'fixture-1',savedAt:'2026-11-05T00:00:00.000Z',workflow:'gc-external-extraction',
  identity:{title:'آزمون الف',sample:'Sample-01',sop:'GC/03',edition:'نسخهٔ واقعی',matrix:'روغن'},
  evidence:['standard','preparation'],standards:[['۰','10'],['۵٫۰۰۰','61.0000000001'],['','']],stage:2,
};
const row={name:'کالیبراسیون',source:'Certificate A',unit:'g',u:'0.004',c:'-1',kind:'certificate',divisor:'2',dfMode:'finite',dfValue:'12'};
const old={format:'artin-gum',version:1,savedAt:'2026-11-04T00:00:00Z',template:'density',rows:[row,{...row,name:'حجم',unit:'mL'}, {...row,name:'Added effect',unit:'g/mL',target:-1}],
  inputs:{mass:'50',volume:'50',unit:'g/mL',coverageMode:'automatic',coverageProbability:'0.95'},gcData:{},familyData:[],
  correlations:[{first:0,second:1,coefficient:'-0.25'}],graphs:{standards:'0 10\n5 61',chromatogram:'0,1\n1,5'}, extraOriginalField:{note:'Do not discard'}};

describe('versioned laboratory project files',()=>{
  it('round-trips bilingual unfinished data, precision strings and the selected stage',()=>{
    const result=parseProjectFile(serializeLabProject(project),'file.json','ignored-id','ignored-date');
    expect(result).toEqual(project);
    expect(result.standards[1][1]).toBe('61.0000000001');
  });
  it('wraps an existing density budget without relabeling it as GC or losing original data',()=>{
    const original=JSON.stringify(old,null,3)+'\n';
    const migrated=parseProjectFile(original,'چگالی.json','migration-id',project.savedAt);
    expect(migrated.workflow).toBe('legacy-gum');
    expect(migrated.legacy).toEqual({fileName:'چگالی.json',originalText:original});
    const restored=readLabProject(JSON.parse(serializeLabProject(migrated)));
    expect(restored.legacy?.originalText).toBe(original);
    expect(JSON.parse(restored.legacy!.originalText)).toEqual(old);
  });
  it('rejects bad old files rather than producing an empty migrated budget',()=>{
    for(const invalid of [{...old,version:2},{...old,template:'unknown'},{...old,rows:[row]},{...old,correlations:[{first:0,second:99,coefficient:'0.2'}]}]){
      expect(()=>parseProjectFile(JSON.stringify(invalid),'bad.json','new-id',project.savedAt)).toThrow();
    }
  });
  it('rejects invalid versions, workflows, stages and nested data before changing a draft',()=>{
    for(const change of [{version:2},{workflow:'unknown'},{stage:5},{evidence:['standard','standard']},{evidence:['invented']},{standards:[['1','2','3']]},{identity:{...project.identity,title:{formula:'anything'}}},{savedAt:'invalid-date'}]){
      expect(()=>readLabProject({...project,...change})).toThrow();
    }
    expect(project.identity.title).toBe('آزمون الف');
  });
  it('validates a nested original budget on every reopen',()=>{
    expect(()=>readLabProject({...project,workflow:'legacy-gum',legacy:{fileName:'old.json',originalText:'{}'}})).toThrow();
    expect(()=>readLabProject({...project,legacy:{fileName:'old.json',originalText:JSON.stringify(old)}})).toThrow();
  });
  it('limits files before parsing and rejects excessive standard rows',()=>{
    expect(()=>parseProjectFile(' '.repeat(MAX_PROJECT_BYTES+1),'large.json','new-id',project.savedAt)).toThrow('Project too large');
    expect(()=>readLabProject({...project,standards:Array.from({length:21},()=>['',''])})).toThrow();
  });
});
