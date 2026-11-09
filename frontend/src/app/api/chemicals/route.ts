import { NextRequest } from 'next/server';
import { pubchemSearch, pubchemDetails, PubChemError } from './pubchem';
import {resolvePersianName} from './persian-names';
import {chemicalLanguage} from './language';
import {compoundCatalog} from '../../calculators/workspace/compound-catalog';
export const runtime='nodejs';
export async function GET(request:NextRequest){
  const p=request.nextUrl.searchParams;
  try {
    const cid=p.get('cid');
    if(cid!==null){if(!/^[1-9]\d{0,9}$/.test(cid))return Response.json({error:'invalid'}, {status:400});return Response.json(await pubchemDetails(Number(cid),p.get('section')??'identity'));}
    const q=(p.get('q')??'').trim().normalize('NFKC').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)),mode=p.get('mode')??'name';
    if(q.length<(mode==='cid'?1:2)||q.length>120||!['name','formula','cid'].includes(mode)||/[\x00-\x1f]/.test(q))return Response.json({error:'invalid'},{status:400});
    const persian=mode==='name'&&/[\u0600-\u06ff]/.test(q);
    let resolved=persian?resolvePersianName(q):undefined;
    if(persian&&!resolved){
      const response=await chemicalLanguage(`resolve-name?q=${encodeURIComponent(q)}`);
      if(!response.ok)return Response.json({error:'language-unavailable'},{status:response.status});
      const language=await response.json();
      if(language.status!=='exact'||language.candidates?.length!==1)return Response.json({records:[],suggestions:[],limited:false,candidates:(language.candidates??[]).map((c:{en:string})=>({en:c.en,fa:compoundCatalog.find(entry=>entry.en.toLowerCase()===c.en.toLowerCase())?.fa??''})),explanation:language.explanation});
      resolved=language.candidates[0].en;
    }
    const result=await pubchemSearch(resolved??q,mode);
    return Response.json({...result,resolvedName:persian&&result.records.length===1?{fa:q,en:resolved}:undefined});
  }catch(error){const status=error instanceof PubChemError?error.status:502;return Response.json({error:status===404?'not-found':status===429?'busy':status===400?'invalid':'unavailable'},{status,headers:status===429?{'Retry-After':'10'}:{}});}
}
export async function POST(request:NextRequest){
  try{
    const length=Number(request.headers.get('content-length')??0);if(length>20000)return Response.json({error:'too-large'},{status:413});
    const body=await request.json();
    if(!Array.isArray(body.texts)||body.texts.length<1||body.texts.length>4||body.texts.some((s:unknown)=>typeof s!=='string'||s.length>1000))return Response.json({error:'invalid'},{status:400});
    const result=await chemicalLanguage('translate',{texts:body.texts});
    return Response.json(await result.json(),{status:result.status});
  }catch{return Response.json({error:'translation-unavailable'},{status:503});}
}
