import {API_BASE_URL} from '@/lib/api';
export async function chemicalLanguage(path:string,body?:unknown){
  const base=API_BASE_URL.startsWith('http')?API_BASE_URL:(process.env.INTERNAL_API_BASE_URL??'http://127.0.0.1:8000');
  const headers:Record<string,string>={'Content-Type':'application/json'};
  if(body){
    // Keep the backend's double-submit CSRF check for server-to-server POSTs.
    const bootstrap=await fetch(`${base}/health`,{cache:'no-store',signal:AbortSignal.timeout(5000)});
    const token=bootstrap.headers.get('set-cookie')?.match(/(?:^|[;,]\s*)artin_csrf=([^;]+)/)?.[1];
    if(token){headers.Cookie=`artin_csrf=${token}`;headers['X-CSRF-Token']=token;}
  }
  return fetch(`${base}/chemicals/${path}`,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(55000),cache:'no-store'});
}
