import {it,expect} from 'vitest';
import {newReagent,readReagents} from './calculators/workspace/reagents';
import {readLabProject,serializeLabProject,type LabProject} from './calculators/workspace/project-file';
it('saves raw certificate values and keeps missing values blank',()=>{const r={...newReagent(),name:'متانول',lot:'A-01',purity:'۹۹٫۹ %',uncertainty:'',expires:'۱۴۰۶/۰۱/۰۱ شمسی'};const p:LabProject={format:'artin-lab-project',version:1,id:'test',savedAt:'2026-11-05',workflow:'gc-external-extraction',identity:{title:'',sample:'',sop:'',edition:'',matrix:''},evidence:[],standards:[['',''],['',''],['','']],stage:0,reagents:[r]};expect(readLabProject(JSON.parse(serializeLabProject(p))).reagents).toEqual([r]);});
it('rejects malformed, duplicate and oversized records',()=>{const r=newReagent();for(const bad of [[r,r],[{...r,purity:12}],[{...r,notes:'a'.repeat(2001)}],Array(101).fill(r),{}])expect(()=>readReagents(bad)).toThrow();});
