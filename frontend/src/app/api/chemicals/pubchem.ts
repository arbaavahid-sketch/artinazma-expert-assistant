import {API_BASE_URL} from '@/lib/api';
import {readMolecule3D} from '../../calculators/workspace/molecule-3d';
type Property={fetchedAt?:string|null;CID:number;Title?:string;MolecularFormula:string;MolecularWeight:string;IUPACName?:string;InChI?:string;InChIKey?:string;CanonicalSMILES?:string;ConnectivitySMILES?:string};
type Annotation={ReferenceNumber?:number;Name?:string;Reference?:string[];Value?:{Number?:number[];Unit?:string;StringWithMarkup?:{String:string}[]}};
type Section={TOCHeading:string;Section?:Section[];Information?:Annotation[]};
type View={Record:{RecordNumber:number;Section?:Section[];Reference?:{ReferenceNumber:number;SourceName?:string;URL?:string}[]}};
export class PubChemError extends Error{constructor(public status:number){super(`PubChem ${status}`);}}
export type FetchProvenance={fetchedAt:string|null;sourceUpdatedAt:null};
type Fetched<T>=T&{artinProvenance:FetchProvenance};
const root='https://pubchem.ncbi.nlm.nih.gov/rest/';
const cache=new Map<string,{until:number;value:unknown}>(),pending=new Map<string,Promise<unknown>>();
let queue=Promise.resolve(),last=0,blockedUntil=0;
async function fetchJSON<T>(path:string):Promise<Fetched<T>>{
  const hit=cache.get(path);if(hit&&hit.until>Date.now())return hit.value as Fetched<T>;
  if(pending.has(path))return pending.get(path) as Promise<Fetched<T>>;
  if(pending.size>=24||blockedUntil>Date.now())throw new PubChemError(429);
  const turn=queue.then(async()=>{
    const delay=Math.max(0,last+350-Date.now());if(delay)await new Promise(r=>setTimeout(r,delay));
    if(blockedUntil>Date.now())throw new PubChemError(429);last=Date.now();
  });queue=turn.then(()=>{},()=>{});
  const work=turn.then(async()=>{
    if(blockedUntil>Date.now())throw new PubChemError(429);
    const response=await fetch(`${API_BASE_URL.startsWith('http')?API_BASE_URL:(process.env.INTERNAL_API_BASE_URL??'http://127.0.0.1:8000')}/chemicals/pubchem?path=${encodeURIComponent(path)}`,{signal:AbortSignal.timeout(26000),headers:{Accept:'application/json'},cache:'no-store'});
    if(response.status===429||response.status===503){blockedUntil=Date.now()+Math.min(60000,Math.max(10000,Number(response.headers.get('retry-after'))*1000||10000));throw new PubChemError(429);}
    if(!response.ok)throw new PubChemError(response.status===404?404:502);
    const data=await response.json(),stamp=response.headers.get('x-artin-fetched-at');
    const fetchedAt=stamp&&/^\d{4}-\d{2}-\d{2}T/.test(stamp)&&Number.isFinite(Date.parse(stamp))?stamp:null;
    const value={...data,artinProvenance:{fetchedAt,sourceUpdatedAt:null}};if(cache.size>=128)cache.delete(cache.keys().next().value!);cache.set(path,{until:Date.now()+86400000,value});return value;
  });pending.set(path,work);
  try{return await work as Fetched<T>;}finally{pending.delete(path);}
}
const props='Title,MolecularFormula,MolecularWeight,IUPACName,InChI,InChIKey,CanonicalSMILES';
async function properties(ids:number[]){const data=await fetchJSON<{PropertyTable:{Properties:Property[]}}>(`pug/compound/cid/${ids.join(',')}/property/${props}/JSON`);return data.PropertyTable.Properties.map(r=>({...r,fetchedAt:data.artinProvenance.fetchedAt}));}
export async function pubchemSearch(q:string,mode:string){
  const part=encodeURIComponent(q);if(mode==='cid'&&!/^[1-9]\d{0,9}$/.test(q))throw new PubChemError(400);
  let ids:number[];
  try{const result=await fetchJSON<{IdentifierList:{CID:number[]}}>(mode==='formula'?`pug/compound/fastformula/${part}/cids/JSON?MaxRecords=40&MaxSeconds=5`:`pug/compound/${mode==='cid'?'cid':'name'}/${part}/cids/JSON`);ids=result.IdentifierList.CID;}
  catch(error){if(error instanceof PubChemError&&error.status===404&&mode==='name'){
    const data=await fetchJSON<{dictionary_terms?:{compound?:string[]}}>(`autocomplete/compound/${part}/json?limit=12`);return {records:[],suggestions:data.dictionary_terms?.compound??[],limited:false};}throw error;}
  return {records:await properties(ids.slice(0,40)),suggestions:[],limited:ids.length>=40};
}
export function extractAnnotations(view:View,provenance:FetchProvenance={fetchedAt:null,sourceUpdatedAt:null}){
  const refs=new Map(view.Record.Reference?.map(r=>[r.ReferenceNumber,r])??[]),rows:{heading:string;name:string;value:string;unit:string;source:string;url:string;reference:string;original?:string;sourceMissing?:boolean;kind:'experimental'|'computed'|'predicted'|'unknown';kindBasis:string|null;fetchedAt:string|null;sourceUpdatedAt:null}[]=[];
  function visit(sections:Section[],parents:string[]=[]){for(const section of sections){const path=[...parents,section.TOCHeading];for(const info of section.Information??[]){
    const values=info.Value?.StringWithMarkup?.map(s=>s.String)??info.Value?.Number?.map(String)??[];
    const declared=path.slice().reverse().find(h=>['Experimental Properties','Computed Properties','Predicted Properties'].includes(h));
    const kind=declared==='Experimental Properties'?'experimental':declared==='Computed Properties'?'computed':declared==='Predicted Properties'?'predicted':'unknown';
    const ref=refs.get(info.ReferenceNumber??-1);for(const value of values){if(!value.trim())continue;
      rows.push({...provenance,kind,kindBasis:declared??null,heading:path.join(' / '),name:info.Name??section.TOCHeading,value:value.length>400?value.slice(0,400)+'…':value,...(value.length>400?{original:value}:{}),sourceMissing:!ref?.SourceName,unit:info.Value?.Unit??'',source:ref?.SourceName??'PubChem',url:ref?.URL?.startsWith('https://')?ref.URL:`https://pubchem.ncbi.nlm.nih.gov/compound/${view.Record.RecordNumber}#section=${encodeURIComponent(section.TOCHeading)}`,reference:info.Reference?.join('; ')??''});}
    }visit(section.Section??[],path);}}
  visit(view.Record.Section??[]);return rows;
}
export async function pubchemDetails(cid:number,section:string){
 if(section==='structure3d'){
  const path=`pug/compound/cid/${cid}/JSON?record_type=3d`;
  const raw=await fetchJSON<unknown>(path);
  try{return {molecule:readMolecule3D(raw,cid),...raw.artinProvenance,retrievedOn:raw.artinProvenance.fetchedAt?.slice(0,10)??null,sourceUrl:root+path};}
  catch{throw new PubChemError(422);}
 }
 const headings:Record<string,string>={properties:'Chemical and Physical Properties',safety:'Safety and Hazards',identifiers:'Names and Identifiers'};
 if(section!=='identity'&&!headings[section])throw new PubChemError(400);
 if(section==='identity'){const record=(await properties([cid]))[0];return {record,fetchedAt:record.fetchedAt??null,sourceUpdatedAt:null,retrievedOn:record.fetchedAt?.slice(0,10)??null,source:'PubChem PUG-REST',sourceUrl:`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`};}
 const path=`pug_view/data/compound/${cid}/JSON?heading=${encodeURIComponent(headings[section])}`;
 const view=await fetchJSON<View>(path);return {rows:extractAnnotations(view,view.artinProvenance),...view.artinProvenance,retrievedOn:view.artinProvenance.fetchedAt?.slice(0,10)??null,sourceUrl:root+path};
}
