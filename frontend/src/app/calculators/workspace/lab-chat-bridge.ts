import type {LibraryResources} from '@/lib/library-resources';
import {readLabProject,type LabProject} from './project-file';
import {preparePhysical} from './physical-run';
import {prepareGCBudget} from './gc-workflow';
import {numeric} from './gc-workflow';
import {evaluateRegisteredModel,measurementRegistry} from '../registered-models';
import {familyModels} from '../family-models';
import {gcInputs} from '../gc-model';
import {readGumProject,type GumProject} from '../gum-project';

export type LabSnapshot={project:Record<string,unknown>;budget:Record<string,unknown>|null;unit:string};
export type LabContext={project:LabProject;snapshot:LabSnapshot};
export type LabChange={path:string;value:string;previous:string;reason:string};
export type LabProposal={id:string;revision:string;changes:LabChange[]};
export type LabCalculation={id:string;kind:string;unit:string;inputs:unknown;result:Record<string,unknown>;calculatedAt:string;revision:string|null};
export type LabReply={answer:string;library_resources?:LibraryResources;calculations:LabCalculation[];proposals:LabProposal[];revision:string|null};
export type LabTurn={question:string;reply:LabReply;sourceKey:string};
const HANDOFF='artin-lab-chat-handoff-v1',RETURN='artin-lab-chat-return-v1';

function clean(value:unknown):unknown{
 if(Array.isArray(value))return value.map(clean);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['savedAt','run','physicalRun','graphs','legacy','attachments','certificates','certificateFile','dataUrl','originalText','__proto__','constructor','prototype'].includes(key)).map(([key,v])=>[key,clean(v)]));
 return value;
}
export const contextKey=(context:LabContext|null)=>JSON.stringify(context?.snapshot??null);
export function budgetFromGum(raw:GumProject):Record<string,unknown>|null{
 try{
  const gum=readGumProject(raw),p=gum.inputs,template=gum.template;
  const kind=template.startsWith('family:')?template.slice(7):({density:'density',gcExtraction:'gcExtraction',standard:'standardPreparation',titration:'naohStandardization',balance:'balance',typeA:'typeA'} as Record<string,string>)[template];
  let measured=numeric(p.result??''),baseCount=0,nominals:number[]=[];
  if(kind){
   nominals=template.startsWith('family:')?familyModels[kind].inputs.map((_,i)=>numeric(gum.familyData[i]??'')):template==='density'?[numeric(p.mass),numeric(p.volume)]:template==='gcExtraction'?gcInputs.map(i=>numeric(gum.gcData[i.key]??'')):template==='standard'?[numeric(p.mass),numeric(p.purity),numeric(p.volume),0,0,numeric(p.expansion)]:template==='titration'?[numeric(p.mass),numeric(p.purity),numeric(p.molarMass),numeric(p.volume),0,0,0]:[measured];
   const definition=measurementRegistry[kind];baseCount=(definition.uncertain_indices?.length??definition.input_count)+definition.extra_count;
   const evaluated=evaluateRegisteredModel(kind,nominals);if(!evaluated.valid)return null;measured=evaluated.value;
  }else if(template!=='general'&&template!=='gc')return null;
  if(!Number.isFinite(measured)||!p.unit?.trim()||gum.rows.some(r=>!r.name.trim()||!r.source.trim()))return null;
  const components=gum.rows.map(r=>({name:r.name,value:numeric(r.u),sensitivity:kind?1:numeric(r.c),kind:r.kind,certificate_k:r.kind==='certificate'?numeric(r.divisor):2,repetitions:r.kind==='repeatability'?numeric(r.divisor):1,
   ...(p.coverageMode==='automatic'?r.dfMode==='infinite'?{infinite_degrees:true}:r.dfMode==='finite'?{degrees_of_freedom:numeric(r.dfValue??'')}:r.dfMode==='study'?{study_count:numeric(r.dfValue??'')}:{ }:{ })}));
  const request={measured,coverage:p.coverageMode==='automatic'?2:numeric(p.coverage),coverage_mode:p.coverageMode??'manual',coverage_probability:Number(p.coverageProbability??'0.95'),components,correlations:gum.correlations.map(c=>({...c,coefficient:numeric(c.coefficient)})),
   ...(kind?{measurement_model:{kind,nominals,additional_targets:gum.rows.slice(baseCount).map(r=>r.target??-1)}}:{}),
   ...(p.simulate==='true'?{simulation:{samples:numeric(p.simulationSamples),seed:numeric(p.simulationSeed),probability:Number(p.simulationProbability)}}:{})};
  if(JSON.stringify(request,(_,v)=>{if(typeof v==='number'&&!Number.isFinite(v))throw Error('invalid');return v;})&&components.every(c=>c.value>=0&&c.repetitions>=1&&c.certificate_k>0)&&request.coverage>0)return request;
  return null;
 }catch{return null;}
}
export function captureLabContext(project:LabProject,methodBudget:Record<string,unknown>|null=null):LabContext{
 const savedGum=project.methodStudy?.budget??(project.legacy?readGumProject(JSON.parse(project.legacy.originalText)):undefined);
 let budget=methodBudget??(savedGum?budgetFromGum(savedGum):null),unit=savedGum?.inputs.unit??'';
 try{
  if(project.workflow==='density'&&project.density){budget=preparePhysical('density',project.density).request;unit='g/mL';}
  else if(project.workflow==='weighing'&&project.weighing){budget=preparePhysical('weighing',project.weighing).request;unit='g';}
  else if(project.workflow==='gc-external-extraction'&&project.gc){budget=prepareGCBudget(project.standards,project.gc.data).request;unit='mg/kg';}
 }catch{budget=null;}
 const compact=project.dataImport?{...project,dataImport:{id:project.dataImport.id,fileName:project.dataImport.fileName,sha256:project.dataImport.sha256,revision:project.dataImport.revision,mode:project.dataImport.selection.mode,reviewedAt:project.dataImport.reviewedAt}}:project;
 const snapshot:LabSnapshot={project:clean(compact) as Record<string,unknown>,budget,unit};
 if(JSON.stringify(snapshot).length>160000)throw Error('context-too-large');
 return {project,snapshot};
}

export function editableLabFields(project:LabProject){
 const fields:Record<string,string>={};
 const collect=(value:unknown,path:string)=>{
  if(typeof value==='string')fields[path]=value;
  else if(Array.isArray(value))value.forEach((v,i)=>collect(v,`${path}.${i}`));
  else if(value&&typeof value==='object')for(const [key,v] of Object.entries(value))if(!['__proto__','prototype','constructor'].includes(key))collect(v,`${path}.${key}`);
 };
 for(const key of ['identity','density','weighing','standards'] as const)if(project[key])collect(project[key],key);
 if(project.gc)collect(project.gc.data,'gc.data');
 const study=project.methodStudy;
 if(study){for(const key of ['conditions','evidence','outcome','decision'] as const)collect(study[key],`methodStudy.${key}`);
  if(study.budget)for(const key of ['inputs','familyData','gcData','rows','correlations'] as const)collect(study.budget[key],`methodStudy.budget.${key}`);}
 return Object.fromEntries(Object.entries(fields).filter(([p])=>!['activeMethodId','methodRevision','methodEdition','kind','dfMode','coverageMode','coverageProbability'].includes(p.split('.').at(-1)!)));
}
export function applyLabProposal(context:LabContext,proposal:LabProposal):LabProject{
 if(!proposal.changes.length||proposal.changes.length>20||new Set(proposal.changes.map(c=>c.path)).size!==proposal.changes.length)throw Error('invalid-proposal');
 const fields=editableLabFields(context.project),project=structuredClone(context.project);
 for(const change of proposal.changes){
  if(!Object.hasOwn(fields,change.path)||fields[change.path]!==change.previous||typeof change.value!=='string'||change.value.length>5000)throw Error('invalid-proposal');
  const keys=change.path.split('.');let target:unknown=project;
  for(const key of keys.slice(0,-1))target=(target as Record<string,unknown>)[key];
  (target as Record<string,unknown>)[keys.at(-1)!]=change.value;
 }
 // Results are invalidated, never patched or carried forward as current.
 delete project.physicalRun;if(project.gc)delete project.gc.run;
 return readLabProject(project);
}

export function saveLabHandoff(context:LabContext|null,turns:LabTurn[]=[]){
 const data=JSON.stringify({created:Date.now(),context,turns:turns.slice(-20)});sessionStorage.setItem(HANDOFF,data);
}
export function readLabHandoffTurns():LabTurn[]{try{const item=JSON.parse(sessionStorage.getItem(HANDOFF)??'null');return item&&Date.now()-item.created<2*60*60*1000&&Array.isArray(item.turns)?item.turns.slice(-20):[];}catch{return [];}}
export function readLabHandoff():LabContext|null{
 try{const item=JSON.parse(sessionStorage.getItem(HANDOFF)??'null');
  if(!item||Date.now()-item.created>2*60*60*1000||!item.context)return null;
  const project=readLabProject(item.context.project);return {...item.context,project};
 }catch{return null;}
}
export function saveLabReturn(project:LabProject){sessionStorage.setItem(RETURN,JSON.stringify(project));}
export function takeLabReturn():LabProject|null{
 const text=sessionStorage.getItem(RETURN);if(!text)return null;
 const project=readLabProject(JSON.parse(text));sessionStorage.removeItem(RETURN);return project;
}
