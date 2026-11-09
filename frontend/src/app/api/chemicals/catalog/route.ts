import {NextRequest} from 'next/server';
import {chemicalLanguage} from '../language';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 const params=request.nextUrl.searchParams,offset=params.get('offset')??'0',q=params.get('q')??'',letter=params.get('letter')??'';
 if(!/^\d{1,7}$/.test(offset)||Number(offset)>1000000||q.length>120)return Response.json({error:'invalid'},{status:400});
 if(!/^[a-z]?$/.test(letter))return Response.json({error:'invalid'},{status:400});
 try{const response=await chemicalLanguage(`catalog?offset=${offset}&limit=12&q=${encodeURIComponent(q)}&letter=${letter}`);return Response.json(await response.json(),{status:response.status});}
 catch{return Response.json({error:'unavailable'},{status:503});}
}
