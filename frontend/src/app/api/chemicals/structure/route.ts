import {NextRequest} from 'next/server';
import {chemicalLanguage} from '../language';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 const cid=request.nextUrl.searchParams.get('cid')??'';
 if(!/^[1-9]\d{0,9}$/.test(cid))return Response.json({error:'invalid'},{status:400});
 try{const response=await chemicalLanguage(`structure?cid=${cid}`);return Response.json(await response.json(),{status:response.status});}
 catch{return Response.json({error:'unavailable'},{status:503});}
}
