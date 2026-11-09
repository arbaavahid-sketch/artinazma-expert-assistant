import {labelFields,type DilutionLabel} from './dilution-plan';
export type PreparationLabels={nominal?:DilutionLabel;commercial?:DilutionLabel};
export function readPreparationLabels(raw:unknown):PreparationLabels{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid preparation labels');
 const r=raw as PreparationLabels,out:PreparationLabels={};
 for(const kind of ['nominal','commercial'] as const){const v=r[kind];if(v===undefined)continue;if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid solution label');out[kind]=Object.fromEntries(labelFields.map(k=>{if(typeof v[k]!=='string'||v[k].length>(k==='notes'?300:200))throw Error('Invalid solution label text');return [k,v[k]];})) as DilutionLabel;}
 return out;
}
