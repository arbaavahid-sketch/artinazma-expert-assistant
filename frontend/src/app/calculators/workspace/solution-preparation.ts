import {stockKeys,uncertaintyKinds,type StockPreparation} from './gc-workflow';
export function readSolutionPreparation(value:unknown):StockPreparation{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid preparation');const raw=value as StockPreparation;
 if(typeof raw.dilution!=='boolean'||typeof raw.independent!=='boolean'||!raw.inputs||typeof raw.inputs!=='object')throw Error('Invalid preparation');
 const text=(v:unknown,max=200)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid preparation text');return v;};
 return {dilution:raw.dilution,independent:raw.independent,inputs:Object.fromEntries(stockKeys.map(k=>{const r=raw.inputs[k];if(!r||!r.uncertainty||!uncertaintyKinds.includes(r.uncertainty.kind))throw Error('Invalid preparation input');return [k,{nominal:text(r.nominal),uncertainty:{kind:r.uncertainty.kind,value:text(r.uncertainty.value),divisor:text(r.uncertainty.divisor),source:text(r.uncertainty.source,2000)}}];})) as StockPreparation['inputs']};
}
