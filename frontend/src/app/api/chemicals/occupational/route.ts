import {NextRequest} from 'next/server';
import {API_BASE_URL} from '@/lib/api';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 const p=request.nextUrl.searchParams,q=(p.get('q')??'').trim(),id=p.get('record_id')??'';
 if(q.length>120||/[\x00-\x1f]/.test(q)||id&&(!/^\d{4}$/.test(id)||q))return Response.json({error:'invalid'},{status:400});
 const params=new URLSearchParams(id?{record_id:id}:{q});
 try{const base=API_BASE_URL.startsWith('http')?API_BASE_URL:(process.env.INTERNAL_API_BASE_URL??'http://127.0.0.1:8000'),r=await fetch(`${base}/chemicals/occupational?${params}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});return Response.json(await r.json(),{status:r.status,headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'unavailable'},{status:502});}
}
