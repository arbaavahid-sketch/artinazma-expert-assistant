import {readConfirmedImport,type ConfirmedImport} from './data-import';
import {readMethodStudy,type MethodStudy} from './method-study';
import {readDecisionStudy,type DecisionStudy} from './decision-rule';
import {readMCStudy,type MCStudy} from './monte-carlo';
import {readTopDownStudy,type TopDownStudy} from './top-down';
import {readStudyTransfer,type StudyTransfer} from './study-transfer';
import {readControlStudy,type ControlStudy} from './control-study';
import {readCalibrationStudy,type CalibrationStudy} from './calibration-study';
import {readIntermediateStudy,type IntermediateStudy} from './intermediate-study';
import {readBiasStudy,type BiasStudy} from './bias-study';
import {readPrecisionStudy,type PrecisionStudy} from './precision-study';
import {readReagents,type Reagent} from './reagents';
import {readSolutionDraft,type SolutionDraft} from './chemical-library';
import { readGumProject } from '../gum-project';
import {readPhysicalRun,type PhysicalRun} from './physical-run';
import {densityKeys,type DensityData} from './density';
import {weighingKeys,type WeighingData} from './weighing';
import { additionalPresets, sampleKeys, stockKeys, uncertaintyKinds, type GCAdditional, type GCData, type GCRun, type StockPreparation } from './gc-workflow';

export const MAX_PROJECT_BYTES = 12 * 1024 * 1024;
const MAX_LEGACY_BYTES = 4 * 1024 * 1024;
export const evidenceIds = ['standard', 'instrument', 'preparation', 'precision'] as const;
export type ProjectIdentity = { title: string; sample: string; sop: string; edition: string; matrix: string };
export type LabProject = {
  format: 'artin-lab-project'; version: 1; id: string; savedAt: string;
  workflow: 'gc-external-extraction' | 'legacy-gum' | 'weighing' | 'density' | 'method-study' | 'data-import';
  dataImport?:ConfirmedImport;
  methodStudy?:MethodStudy;
  decisionStudy?:DecisionStudy;
  monteCarloStudy?:MCStudy;
  topDownStudy?:TopDownStudy;
  validationTransfer?:StudyTransfer;
  controlStudy?:ControlStudy;
  calibrationStudy?:CalibrationStudy;
  intermediateStudy?:IntermediateStudy;
  biasStudy?:BiasStudy;
  precisionStudy?:PrecisionStudy;
  solution?:SolutionDraft;
  reagents?:Reagent[];
  physicalRun?:PhysicalRun;
  density?:DensityData;
  weighing?:WeighingData;
  identity: ProjectIdentity; evidence: string[]; standards: string[][]; stage: number;
  legacy?: { fileName: string; originalText: string };
  gc?: { data: GCData; run?: GCRun };
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid project');
  return value as Record<string, unknown>;
}
function string(value: unknown, max = 2000): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid text');
  return value;
}
export function readLabProject(value: unknown): LabProject {
  const data = record(value);
  if (data.format !== 'artin-lab-project' || data.version !== 1) throw new Error('Unsupported project version');
  const id = string(data.id, 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid project ID');
  const savedAt = string(data.savedAt, 50);
  if (!Number.isFinite(Date.parse(savedAt))) throw new Error('Invalid save date');
  if (data.workflow !== 'gc-external-extraction' && data.workflow !== 'legacy-gum' && data.workflow !== 'weighing' && data.workflow !== 'density' && data.workflow !== 'method-study' && data.workflow !== 'data-import') throw new Error('Unknown workflow');
  if (!Number.isInteger(data.stage) || (data.stage as number) < 0 || (data.stage as number) > 4) throw new Error('Invalid stage');
  const dataImport=data.workflow==='data-import'?readConfirmedImport(data.dataImport):undefined;
  if(data.workflow!=='data-import'&&data.dataImport!==undefined)throw Error('Unexpected imported data');
  if(dataImport&&['gc','legacy','density','weighing','methodStudy'].some(k=>data[k]!==undefined))throw Error('Unexpected imported workflow data');
  const methodStudy=data.workflow==='method-study'?readMethodStudy(data.methodStudy):undefined;
  if(data.workflow!=='method-study'&&data.methodStudy!==undefined)throw Error('Unexpected method study');
  if(methodStudy&&(data.gc!==undefined||data.legacy!==undefined))throw Error('Unexpected method workflow data');
  const source = record(data.identity);
  const identity: ProjectIdentity = { title: string(source.title), sample: string(source.sample), sop: string(source.sop), edition: string(source.edition), matrix: string(source.matrix) };
  if (!Array.isArray(data.evidence) || data.evidence.length > evidenceIds.length || new Set(data.evidence).size !== data.evidence.length ||
    data.evidence.some(item => !evidenceIds.includes(item as typeof evidenceIds[number]))) throw new Error('Invalid evidence');
  if (!Array.isArray(data.standards) || data.standards.length < 3 || data.standards.length > 20) throw new Error('Invalid standard rows');
  const standards = data.standards.map(row => {
    if (!Array.isArray(row) || row.length !== 2) throw new Error('Invalid standard columns');
    return row.map(value => string(value, 200));
  });
  let legacy: LabProject['legacy'];
  if (data.workflow === 'legacy-gum') {
    const input = record(data.legacy);
    const fileName = string(input.fileName, 255);
    const originalText = string(input.originalText, MAX_LEGACY_BYTES);
    if (new TextEncoder().encode(originalText).length > MAX_LEGACY_BYTES) throw new Error('Legacy project too large');
    readGumProject(JSON.parse(originalText));
    legacy = { fileName, originalText };
  } else if (data.legacy !== undefined) throw new Error('Unexpected legacy project');
  const controlStudy=data.controlStudy===undefined?undefined:readControlStudy(data.controlStudy);
  const calibrationStudy=data.calibrationStudy===undefined?undefined:readCalibrationStudy(data.calibrationStudy);
  const intermediateStudy=data.intermediateStudy===undefined?undefined:readIntermediateStudy(data.intermediateStudy);
  const biasStudy=data.biasStudy===undefined?undefined:readBiasStudy(data.biasStudy);
  const precisionStudy=data.precisionStudy===undefined?undefined:readPrecisionStudy(data.precisionStudy);
  const solution=data.solution===undefined?undefined:readSolutionDraft(data.solution);
  const physicalRun=data.physicalRun===undefined?undefined:readPhysicalRun(data.physicalRun);
  if(physicalRun&&physicalRun.kind!==data.workflow)throw new Error('Unexpected physical run');
  let density:DensityData|undefined;
  if(data.workflow==='density'){
    if(data.gc!==undefined)throw new Error('Unexpected GC data');
    const raw=record(data.density),inputs=record(raw.inputs);
    if(raw.modelVersion!==1||typeof raw.independent!=='boolean')throw new Error('Invalid density model');
    density={modelVersion:1,independent:raw.independent,conditions:string(raw.conditions),coverage:string(raw.coverage,200),coverageSource:string(raw.coverageSource),inputs:Object.fromEntries(densityKeys.map(key=>{const input=record(inputs[key]),u=record(input.uncertainty);if(!uncertaintyKinds.includes(u.kind as typeof uncertaintyKinds[number]))throw new Error('Invalid uncertainty kind');return [key,{nominal:string(input.nominal,200),uncertainty:{value:string(u.value,200),kind:u.kind,divisor:string(u.divisor,200),source:string(u.source)}}];})) as DensityData['inputs']};
  }else if(data.density!==undefined)throw new Error('Unexpected density data');
  let weighing:WeighingData|undefined;
  if(data.workflow==='weighing'){
    if(data.gc!==undefined)throw new Error('Unexpected GC data');
    const raw=record(data.weighing),components=record(raw.components);
    if(typeof raw.independent!=='boolean')throw new Error('Invalid independence');
    weighing={mass:string(raw.mass,200),coverage:string(raw.coverage,200),coverageSource:string(raw.coverageSource),independent:raw.independent,
      components:Object.fromEntries(weighingKeys.map(key=>{const u=record(components[key]);if(!uncertaintyKinds.includes(u.kind as typeof uncertaintyKinds[number]))throw new Error('Invalid uncertainty');return [key,{value:string(u.value,200),kind:u.kind,divisor:string(u.divisor,200),source:string(u.source)}];})) as WeighingData['components']};
  }else if(data.weighing!==undefined)throw new Error('Unexpected weighing data');
  let gc: LabProject['gc'];
  if(data.gc!==undefined){
    if(legacy)throw new Error('Unexpected GC data');
    const input=record(data.gc), raw=record(input.data), values=record(raw.values), uncertainties=record(raw.uncertainties);
    const parsed=Object.fromEntries(sampleKeys.map(key=>{
      const u=record(uncertainties[key]);
      if(!uncertaintyKinds.includes(u.kind as typeof uncertaintyKinds[number]))throw new Error('Unknown uncertainty kind');
      return [key,{value:string(u.value,200),kind:u.kind,divisor:string(u.divisor,200),source:string(u.source)}];
    })) as GCData['uncertainties'];
    gc={data:{values:Object.fromEntries(sampleKeys.map(key=>[key,string(values[key],200)])) as GCData['values'],
      uncertainties:parsed,coverage:string(raw.coverage,200),coverageSource:string(raw.coverageSource)}};
    if(raw.additional!==undefined){
      if(!Array.isArray(raw.additional)||raw.additional.length>20)throw new Error('Invalid additional components');
      gc.data.additional=raw.additional.map(value=>{
        const item=record(value),id=string(item.id,100);
        if(!/^[a-zA-Z0-9_-]+$/.test(id)||!additionalPresets.includes(item.preset as GCAdditional['preset'])||
          !['result',...sampleKeys].includes(item.target as GCAdditional['target'])||!['absolute','relative'].includes(item.basis as string)||
          !uncertaintyKinds.includes(item.kind as GCAdditional['kind'])||typeof item.independent!=='boolean')throw new Error('Invalid additional component');
        if(item.preset!=='custom'&&item.target!=='result'||item.preset==='standardScale'&&item.basis!=='relative')throw new Error('Invalid component mapping');
        let preparation:StockPreparation|undefined;
        if(item.preparation!==undefined){
          if(item.preset!=='standardScale')throw new Error('Unexpected preparation');
          const prep=record(item.preparation),inputs=record(prep.inputs);
          if(typeof prep.dilution!=='boolean'||typeof prep.independent!=='boolean')throw new Error('Invalid preparation');
          preparation={dilution:prep.dilution,independent:prep.independent,inputs:Object.fromEntries(stockKeys.map(key=>{
            const input=record(inputs[key]),u=record(input.uncertainty);
            if(!uncertaintyKinds.includes(u.kind as typeof uncertaintyKinds[number]))throw new Error('Invalid preparation uncertainty');
            return [key,{nominal:string(input.nominal,200),uncertainty:{value:string(u.value,200),kind:u.kind,divisor:string(u.divisor,200),source:string(u.source)}}];
          })) as StockPreparation['inputs']};
        }
        return {id,preset:item.preset,name:string(item.name,200),target:item.target,basis:item.basis,value:string(item.value,200),
          kind:item.kind,divisor:string(item.divisor,200),source:string(item.source),overlapNote:string(item.overlapNote),independent:item.independent,...(preparation?{preparation}:{})} as GCAdditional;
      });
      if(new Set(gc.data.additional.map(item=>item.id)).size!==gc.data.additional.length)throw new Error('Duplicate component ID');
    }
    if(input.run!==undefined){
      const run=record(input.run);
      for(const key of ['measured','standard','expanded','coverage'])if(typeof run[key]!=='number'||!Number.isFinite(run[key]))throw new Error('Invalid saved result');
      if((run.standard as number)<0||(run.expanded as number)<0||(run.coverage as number)<=0)throw new Error('Invalid saved result');
      const calculatedAt=string(run.calculatedAt,50);
      if(!Number.isFinite(Date.parse(calculatedAt)))throw new Error('Invalid calculation date');
      gc.run={calculatedAt,inputKey:string(run.inputKey,600000),measured:run.measured as number,standard:run.standard as number,
        expanded:run.expanded as number,coverage:run.coverage as number,engine:string(run.engine,100),engineVersion:string(run.engineVersion,100)};
    }
  }
  return { format: 'artin-lab-project', version: 1, id, savedAt, workflow: data.workflow, identity,
    evidence: data.evidence as string[], standards, stage: data.stage as number, ...(dataImport?{dataImport}:{}),...(methodStudy?{methodStudy}:{}),...(legacy ? { legacy } : {}),...(gc?{gc}:{}),...(weighing?{weighing}:{}),...(density?{density}:{}),...(physicalRun?{physicalRun}:{}),...(solution?{solution}:{}),...(precisionStudy?{precisionStudy}:{}),...(biasStudy?{biasStudy}:{}),...(intermediateStudy?{intermediateStudy}:{}),...(calibrationStudy?{calibrationStudy}:{}),...(controlStudy?{controlStudy}:{}),...(data.decisionStudy===undefined?{}:{decisionStudy:readDecisionStudy(data.decisionStudy)}),...(data.monteCarloStudy===undefined?{}:{monteCarloStudy:readMCStudy(data.monteCarloStudy)}),...(data.topDownStudy===undefined?{}:{topDownStudy:readTopDownStudy(data.topDownStudy)}),...(data.validationTransfer===undefined?{}:{validationTransfer:readStudyTransfer(data.validationTransfer)}),...(data.reagents===undefined?{}:{reagents:readReagents(data.reagents)}) };
}

export function parseProjectFile(content: string, fileName: string, id: string, now: string): LabProject {
  if (new TextEncoder().encode(content).length > MAX_PROJECT_BYTES) throw new Error('Project too large');
  const input = record(JSON.parse(content));
  if (input.format === 'artin-lab-project') return readLabProject(input);
  // Keep the original text byte-for-byte: never reconstruct the old budget from
  // the new draft form or label every imported instrument as GC-FID.
  readGumProject(input);
  return readLabProject({ format: 'artin-lab-project', version: 1, id, savedAt: now, workflow: 'legacy-gum',
    identity: { title: '', sample: '', sop: '', edition: '', matrix: '' }, evidence: [],
    standards: [['',''],['',''],['','']], stage: 4, legacy: { fileName, originalText: content } });
}

export function serializeLabProject(project: LabProject): string {
  const output=`${JSON.stringify(readLabProject(project), null, 2)}\n`;
  if(new TextEncoder().encode(output).length>MAX_PROJECT_BYTES)throw Error('Project too large; remove certificate attachments before saving');
  return output;
}
