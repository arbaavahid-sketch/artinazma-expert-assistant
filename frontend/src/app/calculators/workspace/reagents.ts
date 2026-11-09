import {readCertificateAttachment,type CertificateAttachment} from './reagent-attachment';
export const reagentFields = ['name','manufacturer','catalogue','lot','certificate','purity','purityBasis','uncertainty','uncertaintyKind','coverageFactor','issued','opened','expires','storage','notes'] as const;
export type Reagent = {id:string;certificateFile?:CertificateAttachment} & Record<typeof reagentFields[number],string>;
export function newReagent():Reagent{return {id:crypto.randomUUID(),...Object.fromEntries(reagentFields.map(k=>[k,'']))} as Reagent;}
export function readReagents(value:unknown):Reagent[]{
 if(!Array.isArray(value)||value.length>100)throw Error('Invalid reagent list');
 const rows=value.map(raw=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid reagent');const r=raw as Record<string,unknown>;if(typeof r.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(r.id))throw Error('Invalid reagent ID');for(const k of reagentFields)if(typeof r[k]!=='string'||r[k].length>2000)throw Error('Invalid reagent field');return {id:r.id,...(r.certificateFile!==undefined?{certificateFile:readCertificateAttachment(r.certificateFile)}:{}),...Object.fromEntries(reagentFields.map(k=>[k,r[k]]))} as Reagent;});
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Duplicate reagent');return rows;
}
