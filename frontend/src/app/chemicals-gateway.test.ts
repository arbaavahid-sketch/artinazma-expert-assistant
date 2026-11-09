import {describe,it,expect,vi,beforeEach} from 'vitest';
import {NextRequest} from 'next/server';
beforeEach(()=>{vi.resetModules();vi.restoreAllMocks();});
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
describe('PubChem server gateway',()=>{
 it('retains conditions after a long excerpt and identifies missing source attribution',async()=>{const {extractAnnotations}=await import('./api/chemicals/pubchem');const original='Reference text '.repeat(40)+'at 25 C, 101.325 kPa, liquid';const [r]=extractAnnotations({Record:{RecordNumber:887,Section:[{TOCHeading:'Density',Information:[{Value:{StringWithMarkup:[{String:original}]}}]}]}});expect(r.value.length).toBe(401);expect(r.original).toBe(original);expect(r.original).toContain('101.325 kPa');expect(r.sourceMissing).toBe(true);});
 it('can open one-digit CIDs from the imported directory',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response({IdentifierList:{CID:[4]}})).mockResolvedValueOnce(response({PropertyTable:{Properties:[{CID:4,MolecularFormula:'C3H9NO',MolecularWeight:'75.11'}]}})));
  const {GET}=await import('./api/chemicals/route');expect((await GET(new NextRequest('http://localhost/api/chemicals?q=4&mode=cid'))).status).toBe(200);
 });
 it('resolves Persian ethylene and normalizes Arabic letters without matching derivatives',async()=>{
  const {resolvePersianName}=await import('./api/chemicals/persian-names');
  expect(resolvePersianName(' اِتيلن ')).toBe('ethylene');
  expect(resolvePersianName('اتیلن‌گلیکول')).toBe('ethylene glycol');
  expect(resolvePersianName('اتیلن ناشناخته')).toBeUndefined();
  const mock=vi.fn().mockResolvedValueOnce(response({IdentifierList:{CID:[6325]}})).mockResolvedValueOnce(response({PropertyTable:{Properties:[{CID:6325,MolecularFormula:'C2H4',MolecularWeight:'28.05'}]}}));vi.stubGlobal('fetch',mock);
  const {GET}=await import('./api/chemicals/route');
  expect((await GET(new NextRequest('http://localhost/api/chemicals?q='+encodeURIComponent('اتیلن')))).status).toBe(200);
  expect(decodeURIComponent(mock.mock.calls[0][0])).toContain('/name/ethylene/cids/JSON');
  mock.mockResolvedValueOnce(response({status:'unknown',explanation:'نام ماده مشخص نیست.',candidates:[]}));
  const unsupported=await GET(new NextRequest('http://localhost/api/chemicals?q='+encodeURIComponent('ماده ناشناخته')));
  expect(unsupported.status).toBe(200);expect((await unsupported.json()).records).toEqual([]);expect(mock).toHaveBeenCalledTimes(3);
 });
 it('resolves names outside the dictionary and requires a choice for ambiguous names',async()=>{
  const mock=vi.fn().mockResolvedValueOnce(response({status:'exact',candidates:[{fa:'اسید سالیسیلیک',en:'salicylic acid'}]}))
   .mockResolvedValueOnce(response({IdentifierList:{CID:[338]}})).mockResolvedValueOnce(response({PropertyTable:{Properties:[{CID:338,MolecularFormula:'C7H6O3',MolecularWeight:'138.12'}]}}))
   .mockResolvedValueOnce(response({status:'ambiguous',explanation:'نام کامل را انتخاب کنید.',candidates:[{fa:'متیلن کلرید',en:'dichloromethane'}]}));
  vi.stubGlobal('fetch',mock);const {GET}=await import('./api/chemicals/route');
  const result=await GET(new NextRequest('http://localhost/api/chemicals?q='+encodeURIComponent('اسید سالیسیلیک')));
  expect((await result.json()).records[0].CID).toBe(338);
  expect(decodeURIComponent(mock.mock.calls[1][0])).toContain('/name/salicylic%20acid/cids/JSON');
  const ambiguous=await GET(new NextRequest('http://localhost/api/chemicals?q='+encodeURIComponent('متیلن')));
  expect((await ambiguous.json()).candidates[0].en).toBe('dichloromethane');expect(mock).toHaveBeenCalledTimes(4);
 });
 it('searches beyond saved compounds and retains all identities instead of choosing the first',async()=>{
  const mock=vi.fn().mockResolvedValueOnce(response({IdentifierList:{CID:[2244,999]}})).mockResolvedValueOnce(response({PropertyTable:{Properties:[{CID:2244,MolecularFormula:'C9H8O4',MolecularWeight:'180.16'},{CID:999,MolecularFormula:'C9H8O4',MolecularWeight:'180.16'}]}}));vi.stubGlobal('fetch',mock);
  const {GET}=await import('./api/chemicals/route');const result=await GET(new NextRequest('http://localhost/api/chemicals?q=aspirin&mode=name'));expect(result.status).toBe(200);expect((await result.json()).records).toHaveLength(2);
  expect(mock.mock.calls[0][0]).toContain('/chemicals/pubchem?path=');
 });
 it('validates CID, mode and section without network calls',async()=>{
  const mock=vi.fn();vi.stubGlobal('fetch',mock);const {GET}=await import('./api/chemicals/route');
  for(const query of ['cid=0','cid=1&section=unknown','q=aspirin&mode=url','q=x'])expect((await GET(new NextRequest('http://localhost/api/chemicals?'+query))).status).toBe(400);expect(mock).not.toHaveBeenCalled();
 });
 it('preserves conflicting property values, units and source references',async()=>{
  const {extractAnnotations}=await import('./api/chemicals/pubchem');const rows=extractAnnotations({Record:{RecordNumber:5234,Reference:[{ReferenceNumber:1,SourceName:'Reference A',URL:'https://example.org/a'},{ReferenceNumber:2,SourceName:'Reference B'}],Section:[{TOCHeading:'Density',Information:[{ReferenceNumber:1,Value:{Number:[2.1],Unit:'g/cm3'}},{ReferenceNumber:2,Value:{StringWithMarkup:[{String:'2.2 g/cm3 at 25 C'}]}}]}]}});expect(rows).toHaveLength(2);expect(rows[0]).toMatchObject({value:'2.1',unit:'g/cm3',source:'Reference A',url:'https://example.org/a'});expect(rows[1].value).toContain('25 C');expect(rows[1].url).toContain('#section=Density');
 });
 it('returns controlled upstream throttling and missing records',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({},429)));const {GET}=await import('./api/chemicals/route');const r=await GET(new NextRequest('http://localhost/api/chemicals?q=2244&mode=cid'));expect(r.status).toBe(429);expect(r.headers.get('Retry-After')).toBe('10');
 });
});



it('retains the backend retrieval timestamp across frontend cache hits and uses unknown when absent',async()=>{
 const stamp='2026-10-01T08:09:10Z';
 const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({PropertyTable:{Properties:[{CID:2244,MolecularFormula:'C9H8O4',MolecularWeight:'180.16'}]}}),{headers:{'X-Artin-Fetched-At':stamp}}));vi.stubGlobal('fetch',mock);
 const {pubchemDetails}=await import('./api/chemicals/pubchem');
 const first=await pubchemDetails(2244,'identity');
 expect(first).toMatchObject({fetchedAt:stamp,retrievedOn:'2026-10-01',sourceUpdatedAt:null});
 expect(await pubchemDetails(2244,'identity')).toEqual(first);expect(mock).toHaveBeenCalledTimes(1);
 mock.mockResolvedValue(new Response(JSON.stringify({PropertyTable:{Properties:[{CID:887,MolecularFormula:'CH4O',MolecularWeight:'32.04'}]}})));
 expect(await pubchemDetails(887,'identity')).toMatchObject({fetchedAt:null,retrievedOn:null,sourceUpdatedAt:null});
});
it('attributes property type only from declared source sections and preserves each row provenance',async()=>{
 const {extractAnnotations}=await import('./api/chemicals/pubchem'),meta={fetchedAt:'2026-10-01T08:09:10Z',sourceUpdatedAt:null} as const;
 const rows=extractAnnotations({Record:{RecordNumber:887,Section:[...['Experimental Properties','Computed Properties','Predicted Properties','Other'].map(TOCHeading=>({TOCHeading,Section:[{TOCHeading:'Density',Information:[{Name:'Density',Value:{StringWithMarkup:[{String:'0.8 g/cm3 at 20 C; not a product measurement'}]}}]}]}))]}},meta);
 expect(rows.map(r=>r.kind)).toEqual(['experimental','computed','predicted','unknown']);for(const row of rows){expect(row.fetchedAt).toBe(meta.fetchedAt);expect(row.sourceUpdatedAt).toBeNull();expect(row.value).toContain('20 C');}expect(rows[3].kindBasis).toBeNull();
});

it('paces dispatches without making an unrelated request wait for a slow network response',async()=>{
 let finish!:(value:Response)=>void;
 const first=new Promise<Response>(resolve=>{finish=resolve;});
 const mock=vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce(response({PropertyTable:{Properties:[{CID:2244,MolecularFormula:'C9H8O4',MolecularWeight:'180.16'}]}}));vi.stubGlobal('fetch',mock);
 const {pubchemDetails}=await import('./api/chemicals/pubchem');
 const slow=pubchemDetails(887,'identity'),fast=pubchemDetails(2244,'identity');
 try{await vi.waitFor(()=>expect(mock).toHaveBeenCalledTimes(2),{timeout:2000});expect(await fast).toMatchObject({record:{CID:2244}});}
 finally{finish(response({PropertyTable:{Properties:[{CID:887,MolecularFormula:'CH4O',MolecularWeight:'32.04'}]}}));await slow;}
});
