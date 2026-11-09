import {expect,it} from 'vitest';
import {applyLabProposal,captureLabContext,contextKey,editableLabFields,budgetFromGum,saveLabHandoff,readLabHandoff,readLabHandoffTurns,saveLabReturn,takeLabReturn} from './calculators/workspace/lab-chat-bridge';
import type {LabProject} from './calculators/workspace/project-file';
import {emptyDensity} from './calculators/workspace/density';
const project=():LabProject=>({format:'artin-lab-project',version:1,id:'synthetic-qa',savedAt:'2026-11-09T00:00:00Z',workflow:'density',identity:{title:'Synthetic',sample:'QA-1',sop:'',edition:'',matrix:''},standards:[['',''],['',''],['','']],stage:0,evidence:[],density:emptyDensity()});
it('captures the live project without treating saved outputs or changing timestamps as current results',()=>{
 const p=project(),first=captureLabContext(p);expect(first.snapshot.budget).toBeNull();p.savedAt='2026-11-10T00:00:00Z';expect(contextKey(captureLabContext(p))).toBe(contextKey(first));
 expect(editableLabFields(p)).toHaveProperty('density.inputs.mass.nominal');expect(editableLabFields(p)).not.toHaveProperty('density.inputs.mass.uncertainty.kind');
 p.density!.inputs.mass.nominal='12';expect(contextKey(captureLabContext(p))).not.toBe(contextKey(first));
});
it('applies only explicitly reviewed existing fields and rejects tampering or stale values',()=>{
 const context=captureLabContext(project()),proposal={id:'p1',revision:'r1',changes:[{path:'identity.sample',previous:'QA-1',value:'QA-2',reason:'User request'}]};
 expect(applyLabProposal(context,proposal).identity.sample).toBe('QA-2');expect(context.project.identity.sample).toBe('QA-1');
 for(const path of ['id','__proto__.polluted','density.independent','physicalRun.measured'])expect(()=>applyLabProposal(context,{...proposal,changes:[{...proposal.changes[0],path}]})).toThrow();
 expect(()=>applyLabProposal(context,{...proposal,changes:[{...proposal.changes[0],previous:'wrong'}]})).toThrow();
});
it('preserves a handoff and consumes the return only once',()=>{
 const context=captureLabContext(project());saveLabHandoff(context);expect(readLabHandoff()?.project.identity.sample).toBe('QA-1');expect(readLabHandoffTurns()).toEqual([]);
 saveLabReturn(context.project);expect(takeLabReturn()?.id).toBe(context.project.id);expect(takeLabReturn()).toBeNull();
});
it('rebuilds a saved GUM request through the registered model rather than stored sensitivities',()=>{
 const gum={format:'artin-gum' as const,version:1 as const,savedAt:'2026-11-09T00:00:00Z',template:'density',inputs:{mass:'50',volume:'25',unit:'g/mL',coverage:'2'},familyData:[],gcData:{},correlations:[],rows:[{name:'mass',source:'Synthetic certificate',unit:'g',u:'.1',c:'999',kind:'standard',divisor:'2'},{name:'volume',source:'Synthetic certificate',unit:'mL',u:'.05',c:'999',kind:'standard',divisor:'2'}]};
 const request=budgetFromGum(gum);expect(request?.measured).toBe(2);expect(request?.measurement_model).toEqual({kind:'density',nominals:[50,25],additional_targets:[]});
 gum.rows[0].source='';expect(budgetFromGum(gum)).toBeNull();
});
