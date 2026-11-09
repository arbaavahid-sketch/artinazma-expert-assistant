import {NextRequest} from 'next/server';
import {API_BASE_URL} from '@/lib/api';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 const id=(request.nextUrl.searchParams.get('dtxsid')??'').trim().toUpperCase();
 if(id&&!/^DTXSID[0-9]{7,10}$/.test(id))return Response.json({error:'invalid'},{status:400});
 try{
  const base=API_BASE_URL.startsWith('http')?API_BASE_URL:(process.env.INTERNAL_API_BASE_URL??'http://127.0.0.1:8000');
  const response=await fetch(`${base}/chemicals/comptox${id?'?'+new URLSearchParams({dtxsid:id}):''}`,{cache:'no-store',signal:AbortSignal.timeout(26000)});
  // Only our backend owns the EPA key. Never accept or forward a browser credential.
  const data=await response.json();
  return Response.json(response.ok?data:{error:response.status===503?'not_ready':'unavailable'},{status:response.status,headers:{'Cache-Control':'no-store',...(response.status===429?{'Retry-After':response.headers.get('Retry-After')??'10'}:{})}});
 }catch{return Response.json({error:'unavailable'},{status:502});}
}
