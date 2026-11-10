import {NextRequest} from 'next/server';
import {API_BASE_URL} from '@/lib/api';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 const id=(request.nextUrl.searchParams.get('dtxsid')??'').trim().toUpperCase();
 const section=request.nextUrl.searchParams.get('section')??'identity';
 if(!['identity','hazard','exposure','predictions'].includes(section)||(!id&&section!=='identity'))return Response.json({error:'invalid'},{status:400});
 if(id&&!/^DTXSID[0-9]{7,10}$/.test(id))return Response.json({error:'invalid'},{status:400});
 try{
  const base=process.env.BACKEND_INTERNAL_URL??process.env.INTERNAL_API_BASE_URL??(API_BASE_URL.startsWith('http')?API_BASE_URL:'http://127.0.0.1:8000');
  const query=new URLSearchParams(id?{dtxsid:id,section}:{});
  const response=await fetch(`${base}/chemicals/comptox?${query}`,{cache:'no-store',signal:AbortSignal.timeout(26000)});
  // Only our backend owns the EPA key. Never accept or forward a browser credential.
  const data=await response.json();
  return Response.json(response.ok?data:{error:response.status===503?'not_ready':'unavailable'},{status:response.status,headers:{'Cache-Control':'no-store',...(response.status===429?{'Retry-After':response.headers.get('Retry-After')??'10'}:{})}});
 }catch{return Response.json({error:'unavailable'},{status:502});}
}
