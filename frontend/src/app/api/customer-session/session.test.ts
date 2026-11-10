import {afterEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {POST,GET} from './route';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
const request=(id=7)=>new NextRequest('http://localhost/api/customer-session',{method:'POST',headers:{'Content-Type':'application/json',cookie:'artin_jwt=synthetic'},body:JSON.stringify({customer_id:id})});
it('cannot mint a customer session from a supplied ID without backend approval',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:401})));
 const denied=await POST(request());expect(denied.status).toBe(401);expect(denied.headers.get('set-cookie')).toBeNull();
});
it('binds a signed session to the approved JWT identity and checks approval again on GET',async()=>{
 vi.stubEnv('CUSTOMER_SESSION_SECRET','synthetic-test-session-secret');const fetcher=vi.fn().mockImplementation(async()=>new Response('{"approved":true,"customer_id":7}'));vi.stubGlobal('fetch',fetcher);
 expect((await POST(request(8))).status).toBe(401);
 const approved=await POST(request());expect(approved.status).toBe(200);const session=approved.cookies.get('artin_customer_session')?.value;expect(session).toContain('7.');
 fetcher.mockResolvedValue(new Response('{}',{status:403}));expect((await GET(new NextRequest('http://localhost/api/customer-session',{headers:{cookie:`artin_jwt=synthetic; artin_customer_session=${session}`}}))).status).toBe(401);
});
