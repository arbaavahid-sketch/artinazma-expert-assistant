import {NextRequest} from 'next/server';
import {API_BASE_URL} from '@/lib/api';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 const p=request.nextUrl.searchParams,q=(p.get('q')??'').trim(),id=p.get('chebi_id')??'',key=p.get('expected_key')??'',page=p.get('page')??'1';
 if(Boolean(q)===Boolean(id)||q&&(q.length<2||q.length>200||/[\x00-\x1f]/.test(q))||id&&!/^(?:CHEBI:)?[1-9]\d{0,9}$/i.test(id)||key&&!/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/.test(key)||!/^([1-9]|[1-9]\d)$/.test(page))return Response.json({error:'invalid'},{status:400});
 const query=new URLSearchParams(q?{q,page}:{chebi_id:id,...(key?{expected_key:key}:{})});
 try{const base=API_BASE_URL.startsWith('http')?API_BASE_URL:(process.env.INTERNAL_API_BASE_URL??'http://127.0.0.1:8000'),r=await fetch(`${base}/chemicals/chebi?${query}`,{cache:'no-store',signal:AbortSignal.timeout(26000)});return Response.json(await r.json(),{status:r.status,headers:{'Cache-Control':'no-store',...(r.status===429?{'Retry-After':r.headers.get('Retry-After')??'10'}:{})}});}catch{return Response.json({error:'unavailable'},{status:502});}
}
