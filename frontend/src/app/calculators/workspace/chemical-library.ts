import {readPreparationLabels,type PreparationLabels} from './solution-label-data';
import {readCommercial,type CommercialDraft} from './commercial-solution';
import {readDilution,type DilutionPlan} from './dilution-plan';
import {type StockPreparation} from './gc-workflow';
import {readSolutionPreparation} from './solution-preparation';
import {type Reagent} from './reagents';
import {reagentSnapshot,reagentPurity,reagentReference} from './reagent-solution';
import dataset from './chemical-library.json';
import {numeric} from './gc-workflow';
import {labTools} from '../lab-tools';
export type ChemicalRecord={fetchedAt?:string|null;cid:number;fa:string;en:string;formula:string;sourceFormula:string;iupac:string;molarMass:string;waters:number|null;formFa:string;formEn:string;aliases:string[]};
export type ChemicalSnapshot={fetchedAt?:string;sourceUpdatedAt?:null;version:string;retrievedOn:string;source:string;sourceUrl:string;property:'MolecularWeight';unit:'g/mol';kind:'computed';record:ChemicalRecord};
export type SolutionDraft={material:ChemicalSnapshot;concentration:string;volume:string;purity:string;puritySource:string;labels?:PreparationLabels;reagent?:Reagent;preparation?:StockPreparation;dilutionPlan?:DilutionPlan;commercial?:CommercialDraft};
export const chemicals:ChemicalRecord[]=dataset.records;
export function chemicalSnapshot(record:ChemicalRecord):ChemicalSnapshot{
 const known=chemicals.some(r=>r.cid===record.cid);
 if(!known&&(!record.fetchedAt||!/^\d{4}-\d{2}-\d{2}T/.test(record.fetchedAt)||!Number.isFinite(Date.parse(record.fetchedAt))))throw Error('Remote retrieval timestamp unavailable');
 return {version:known?dataset.version:'pubchem-live-v1',retrievedOn:known?dataset.retrievedOn:record.fetchedAt!.slice(0,10),...(!known?{fetchedAt:record.fetchedAt!,sourceUpdatedAt:null}:{}),source:dataset.source,sourceUrl:`https://pubchem.ncbi.nlm.nih.gov/compound/${record.cid}`,property:'MolecularWeight',unit:'g/mol',kind:'computed',record:structuredClone(record)};
}
export function newSolutionDraft(record:ChemicalRecord):SolutionDraft{return {material:chemicalSnapshot(record),concentration:'',volume:'',purity:'',puritySource:''};}
export function normalizeChemicalSearch(text:string){return text.normalize('NFKC').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[\u200c\s·.()\[\]-]/g,'').toLowerCase();}
export function searchChemicals(query:string){const normalized=normalizeChemicalSearch(query.trim());if(!normalized)return chemicals;return chemicals.filter(r=>[r.fa,r.en,r.formula,r.sourceFormula,r.iupac,String(r.cid),...r.aliases].some(v=>normalizeChemicalSearch(v).includes(normalized)));}
export function readSolutionDraft(value:unknown):SolutionDraft{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid solution draft');
  const raw=value as Record<string,unknown>;const labels=raw.labels===undefined?undefined:readPreparationLabels(raw.labels);const reagent=raw.reagent===undefined?undefined:reagentSnapshot(raw.reagent);if(reagent&&(reagentPurity(reagent)===null||!reagent.lot.trim()||!reagent.certificate.trim()||numeric(String(raw.purity))!==reagentPurity(reagent)||raw.puritySource!==reagentReference(reagent)))throw new Error('Reagent snapshot does not match solution purity');const preparation=raw.preparation===undefined?undefined:readSolutionPreparation(raw.preparation);const dilutionPlan=raw.dilutionPlan===undefined?undefined:readDilution(raw.dilutionPlan);const commercial=raw.commercial===undefined?undefined:readCommercial(raw.commercial);const snapshot=raw.material as ChemicalSnapshot|undefined;
  if(!snapshot||typeof snapshot!=='object'||!snapshot.record)throw new Error('Invalid material snapshot');
  if(snapshot.version==='pubchem-live-v1'){
    const r=snapshot.record;
    if(snapshot.fetchedAt!==undefined&&(typeof snapshot.fetchedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(snapshot.fetchedAt)||!Number.isFinite(Date.parse(snapshot.fetchedAt))||snapshot.fetchedAt.slice(0,10)!==snapshot.retrievedOn||r.fetchedAt!==snapshot.fetchedAt||snapshot.sourceUpdatedAt!==null))throw Error('Invalid fetched timestamp');
    if(!Number.isSafeInteger(r.cid)||r.cid<=0||r.cid>9999999999||snapshot.sourceUrl!==`https://pubchem.ncbi.nlm.nih.gov/compound/${r.cid}`||snapshot.source!=='PubChem PUG-REST'||snapshot.property!=='MolecularWeight'||snapshot.unit!=='g/mol'||snapshot.kind!=='computed'||!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.retrievedOn))throw new Error('Invalid external source');
    for(const key of ['fa','en','formula','sourceFormula','iupac','molarMass','formFa','formEn'] as const)if(typeof r[key]!=='string'||r[key].length>2000)throw new Error('Invalid compound text');
    if(!r.en.trim()||!r.formula.trim()||!Number.isFinite(Number(r.molarMass))||Number(r.molarMass)<=0||!Array.isArray(r.aliases)||r.aliases.length>100||r.aliases.some(a=>typeof a!=='string'||a.length>2000)||!(r.waters===null||Number.isInteger(r.waters)&&r.waters>=0))throw new Error('Invalid external compound');
    for(const key of ['concentration','volume','purity','puritySource'] as const)if(typeof raw[key]!=='string'||(raw[key] as string).length>(key==='puritySource'?2000:200))throw new Error('Invalid solution text');
    return {...structuredClone(value) as SolutionDraft,...(labels?{labels}:{}),...(reagent?{reagent}:{}),...(preparation?{preparation}:{}),...(dilutionPlan?{dilutionPlan}:{}),...(commercial?{commercial}:{})};
  }
  const known=chemicals.find(r=>r.cid===snapshot.record.cid);if(!known)throw new Error('Unknown material snapshot');
  const expected=chemicalSnapshot(known);
  for(const key of Object.keys(expected) as (keyof ChemicalSnapshot)[]){
    if(key==='record'){for(const field of Object.keys(known) as (keyof ChemicalRecord)[])if(JSON.stringify(snapshot.record[field])!==JSON.stringify(known[field]))throw new Error('Material snapshot mismatch');}
    else if(snapshot[key]!==expected[key])throw new Error('Unsupported material snapshot');
  }
  const text=(key:string,max=200)=>{const v=raw[key];if(typeof v!=='string'||v.length>max)throw new Error('Invalid solution text');return v;};
  return {material:expected,concentration:text('concentration'),volume:text('volume'),purity:text('purity'),puritySource:text('puritySource',2000),...(labels?{labels}:{}),...(reagent?{reagent}:{}),...(preparation?{preparation}:{}),...(dilutionPlan?{dilutionPlan}:{}),...(commercial?{commercial}:{})};
}
export function solutionErrors(draft:SolutionDraft){const errors:Record<string,string>={};for(const key of ['concentration','volume'] as const)if(!Number.isFinite(numeric(draft[key]))||numeric(draft[key])<=0)errors[key]='positive';const p=numeric(draft.purity);if(!Number.isFinite(p)||p<=0||p>100)errors.purity='purity';if(!draft.puritySource.trim())errors.puritySource='source';return errors;}
const molarTool=labTools.find(tool=>tool.en==='Molar solution with purity correction')!;
export function calculateSolution(draft:SolutionDraft){
  readSolutionDraft(draft);if(Object.keys(solutionErrors(draft)).length)throw new Error('Incomplete solution inputs');
  const values=[numeric(draft.concentration),numeric(draft.volume),numeric(draft.material.record.molarMass),numeric(draft.purity)];
  if(!molarTool.valid?.(values))throw new Error('Invalid solution inputs');const mass=molarTool.calculate(values);if(!Number.isFinite(mass)||mass<=0)throw new Error('Solution outside numeric range');
  return {mass,unit:'g' as const,molarMass:values[2],concentration:values[0],volume:values[1],purity:values[3]};
}
