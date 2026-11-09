import {describe,expect,it} from 'vitest';
import {buildGCReport} from '../workspace/gc-report';
import {emptyGCData,gcInputKey,newGCAdditional,prepareGCBudget,standardComponentValue} from '../workspace/gc-workflow';

function reportInput(){
  const rows=[['0','10'],['5','61'],['10','109'],['15','161']];
  const data=emptyGCData();data.values={area:'110',extract:'50',dilution:'2',mass:'10',recovery:'80'};
  for(const [key,value] of Object.entries({area:'1',extract:'.05',dilution:'.01',mass:'.005',recovery:'1'}))data.uncertainties[key as keyof typeof data.values]={value,kind:'standard',divisor:'',source:`Study for ${key}`};
  data.coverageSource='Documented reporting convention';
  data.additional=[{...newGCAdditional('standardScale','stock'),value:'2',source:'Stock certificate',overlapNote:'Common scale not included in fit residuals',independent:true}];
  const {request,fit}=prepareGCBudget(rows,data),effects=request.components.map(c=>c.sensitivity*standardComponentValue(c));
  const standard=Math.sqrt(effects.reduce((sum,v)=>sum+v*v,0)+2*effects[1]*effects[2]*fit.correlation);
  return {identity:{title:'Test report',sample:'S-123',matrix:'Soil',sop:'SOP-01 rev 2',edition:'Laboratory method'},rows,data,
    run:{calculatedAt:'2026-11-05T08:00:00Z',inputKey:gcInputKey(rows,data),measured:request.measured,standard,expanded:standard*2,coverage:2,engine:'artin-linear-gum',engineVersion:'1'},verified:true,en:true,generatedAt:'2026-11-05T08:01:00Z'};
}
describe('printable GC report',()=>{
  it('exports a self-contained bilingual report with sources, inputs, covariance and review status',()=>{
    const input=reportInput();
    const html=buildGCReport(input),doc=new DOMParser().parseFromString(html,'text/html');
    expect(doc.documentElement.lang).toBe('en');expect(doc.documentElement.dir).toBe('ltr');
    for(const text of ['S-123','SOP-01 rev 2','Stock certificate','Common scale not included in fit residuals','u(a)','r(a,b)','Additional effects','Draft for review','gcExtraction','Asia/Tehran','JSON'])expect(doc.body.textContent).toContain(text);
    expect(doc.querySelectorAll('script,img,iframe,link').length).toBe(0);
    expect(doc.querySelector('svg[role="img"] title')?.textContent).toContain('Calibration chart');
    expect(doc.querySelectorAll('svg circle').length).toBe(4);
    expect(doc.querySelector('figcaption')?.textContent).toContain('unweighted OLS');
    expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')).not.toBeNull();
    expect(html).toContain('@media print');expect(html).toContain('thead{display:table-header-group}');
    expect(/[\u0600-\u06ff]/.test(doc.body.textContent!)).toBe(false);
    const fa=new DOMParser().parseFromString(buildGCReport({...input,en:false}),'text/html');
    expect(fa.documentElement.dir).toBe('rtl');expect(fa.body.textContent).toContain('فاقد تأیید نهایی');expect(fa.body.textContent).toContain('حجم تزریق');
  });
  it('escapes user-entered markup throughout metadata, sources and overlap notes',()=>{
    const input=reportInput(),attack='<img src=x onerror="alert(1)"><script>bad()</script>';
    input.identity.title=attack;input.identity.sop=attack;input.data.uncertainties.area.source=attack;input.data.additional![0].overlapNote=attack;
    input.run.inputKey=gcInputKey(input.rows,input.data);
    const doc=new DOMParser().parseFromString(buildGCReport(input),'text/html');
    expect(doc.querySelectorAll('script,img,[onerror]').length).toBe(0);
    expect(doc.querySelector('h1')?.textContent).toBe(attack);expect(doc.body.textContent).toContain(attack);
  });
  it('refuses stale, reopened or inconsistent results and invalid dates',()=>{
    const input=reportInput();
    for(const patch of [{verified:false},{generatedAt:'invalid'},{run:{...input.run,inputKey:'old'}},{run:{...input.run,measured:1}},{run:{...input.run,expanded:1}},{run:{...input.run,standard:NaN}},{run:{...input.run,calculatedAt:'bad'}}])expect(()=>buildGCReport({...input,...patch})).toThrow();
    input.data.values.mass='11';expect(()=>buildGCReport(input)).toThrow();
  });
});
