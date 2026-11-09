import type {LabProject} from './project-file';
export type ImportTable={id:string;label:string;location:string;page:number|null;columns:{id:string;label:string}[];rows:{row:number;cells:(string|null)[]}[]};
export type ImportPreview={id:string;fileName:string;sha256:string;extraction:string;warnings:string[];tables:ImportTable[];rawText:string};
export type ConfirmedImport={id:string;sourceId:string;fileName:string;sha256:string;revision:string;reviewedAt:string;calculatedAt:string;engine:string;unit:string;table:ImportTable;selection:Record<string,unknown>;inputs:Record<string,unknown>;result:Record<string,unknown>};
export function readConfirmedImport(value:unknown):ConfirmedImport{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid imported data');
 const v=value as ConfirmedImport;
 if(JSON.stringify(v).length>2000000||![v.id,v.sourceId].every(k=>typeof k==='string'&&/^[a-f0-9]{32}$/.test(k))||![v.sha256,v.revision].every(k=>typeof k==='string'&&/^[a-f0-9]{64}$/.test(k)))throw Error('Invalid source identity');
 if(typeof v.fileName!=='string'||v.fileName.length>200||typeof v.unit!=='string'||v.unit.length>80||v.engine!=='artin-reviewed-file-v1'||![v.reviewedAt,v.calculatedAt].every(d=>typeof d==='string'&&Number.isFinite(Date.parse(d))))throw Error('Invalid import metadata');
 if(!v.table||!Array.isArray(v.table.columns)||!v.table.columns.length||v.table.columns.length>24||!Array.isArray(v.table.rows)||v.table.rows.length>1000||v.table.rows.some(r=>!Number.isInteger(r.row)||!Array.isArray(r.cells)||r.cells.length!==v.table.columns.length||r.cells.some(c=>c!==null&&(typeof c!=='string'||c.length>500))))throw Error('Invalid imported table');
 if(!v.selection||!['statistics','calibration','model','budget'].includes(v.selection.mode as string)||!v.result||typeof v.result!=='object'||!v.inputs||typeof v.inputs!=='object')throw Error('Invalid import result');
 return JSON.parse(JSON.stringify(v)) as ConfirmedImport;
}
export function importedProject(value:ConfirmedImport):LabProject{
 const dataImport=readConfirmedImport(value);
 return {format:'artin-lab-project',version:1,id:crypto.randomUUID(),savedAt:new Date().toISOString(),workflow:'data-import',dataImport,identity:{title:dataImport.fileName,sample:'',sop:'',edition:'',matrix:''},evidence:[],standards:[['',''],['',''],['','']],stage:0};
}
