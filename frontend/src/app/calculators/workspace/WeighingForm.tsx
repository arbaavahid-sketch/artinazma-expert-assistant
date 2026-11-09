'use client';
import {useTextExport} from './use-text-export';
import {buildWeighingReport} from './weighing-report';
import type {ProjectIdentity} from './project-file';
import PhysicalPDFButton from './PhysicalPDFButton';
import {usePhysicalCalculation} from './usePhysicalCalculation';
import type {PhysicalRun} from './physical-run';
import {useId,useRef,useState} from 'react';
import {numeric} from './gc-workflow';
import {calculateWeighing,weighingKeys,type WeighingData} from './weighing';
import s from './preview.module.css';
export default function WeighingForm({data,onChange,en,identity,onRun}:{onRun?:(run:PhysicalRun)=>void;identity:ProjectIdentity;data:WeighingData;onChange:(data:WeighingData)=>void;en:boolean}){
 const textExport=useTextExport(en);
  const t=(fa:string,english:string)=>en?english:fa;
  const [run,setRun]=useState<{key:string;at:string;result:ReturnType<typeof calculateWeighing>}>();
  const id=useId(),form=useRef<HTMLElement>(null);
  const [attempted,setAttempted]=useState(false);
  const errors:Record<string,string>={};
  const positive=(value:string)=>Number.isFinite(numeric(value))&&numeric(value)>0;
  if(!positive(data.mass))errors.mass=t('جرم مثبت و معتبر وارد کنید.','Enter a valid positive mass.');
  if(!positive(data.coverage))errors.coverage=t('ضریب پوشش مثبت وارد کنید.','Enter a valid positive coverage factor.');
  if(!data.coverageSource.trim())errors.coverageSource=t('مبنای انتخاب ضریب پوشش را ثبت کنید.','Record the coverage factor basis.');
  if(!data.independent)errors.independent=t('استقلال و نبود دوباره‌شماری را بررسی و تأیید کنید.','Review and confirm independence and absence of double counting.');
  for(const key of weighingKeys){const u=data.components[key],v=numeric(u.value),n=numeric(u.divisor);
    if(!Number.isFinite(v)||v<0||v>1e100)errors[`${key}.value`]=t('عدم‌قطعیت نامنفی و معتبر تا 1e100 وارد کنید.','Enter a valid nonnegative uncertainty up to 1e100.');
    if(!u.source.trim())errors[`${key}.source`]=t('منبع و توضیح لازم است.','A source and explanation are required.');
    if(key==='calibration'&&!positive(u.divisor))errors[`${key}.divisor`]=t('ضریب پوشش گواهی باید مثبت باشد.','Certificate coverage factor must be positive.');
    if(key==='repeatability'&&(!Number.isInteger(n)||n<1||n>1000000))errors[`${key}.divisor`]=t('n باید عدد صحیح از ۱ تا ۱۰۰۰۰۰۰ باشد.','n must be an integer from 1 to 1000000.');
  }
  const attrs=(field:string)=>({'aria-invalid':Boolean(attempted&&errors[field]),'aria-describedby':attempted&&errors[field]?`${id}-${field}`:undefined});
  const fieldError=(field:string)=>attempted&&errors[field]?<span className={s.fieldError} id={`${id}-${field}`}>{errors[field]}</span>:null;
  const [error,setError]=useState(false);
  const [report,setReport]=useState<{key:string;en:boolean;html:string}>();
  const server=usePhysicalCalculation('weighing',data,identity,r=>{setRun({key:JSON.stringify({data,identity}),at:r.calculatedAt,result:calculateWeighing(data)});setError(false);onRun?.(r);});
  const key=JSON.stringify({data,identity}),current=run?.key===key&&server.current;
  const names={calibration:t('کالیبراسیون: U و k از گواهی (g)','Calibration: certificate U and k (g)'),resolution:t('گام تفکیک ترازو d (g)','Balance resolution step d (g)'),repeatability:t('انحراف معیار تکرارپذیری s (g)','Repeatability standard deviation s (g)')};
  async function exportReport(){textExport.clear();try{if(!current||!run)throw new Error('Stale result');const html=buildWeighingReport(data,identity,en,run.at,server.verified);await textExport.save(html,`artin-weighing-report-${en?'en':'fa'}.html`,'html');setReport({key,en,html});}catch{setError(true);}}
  return <section ref={form} className={s.formPanel} aria-label={t('توزین مستقیم','Direct weighing')}>
    <h2>{t('توزین مستقیم · جرم تصحیح‌شده','Direct weighing · corrected mass')}</h2>
    <p className={s.muted}>{t('جرم را پس از اعمال تصحیحات معتبر وارد کنید. مدل m = I است؛ تصحیح شناوری، توزین تفاضلی و هم‌بستگی مؤلفه‌ها در این مسیر محاسبه نمی‌شوند. فقط مؤلفه‌های مستقل و بدون هم‌پوشانی را وارد کنید.','Enter mass after applying valid corrections. The model is m = I; buoyancy correction, difference weighing and correlated components are not calculated here. Enter only independent components without overlap.')}</p>
    <div className={s.fields}><label>{t('جرم تصحیح‌شده (g)','Corrected mass (g)')}<input {...attrs('mass')} className="ui-input" dir="ltr" inputMode="decimal" value={data.mass} onChange={e=>onChange({...data,mass:e.target.value})}/>{fieldError('mass')}</label></div>
    <div className={s.gcInputs}>{weighingKeys.map(component=>{const u=data.components[component];const update=(patch:Partial<typeof u>)=>onChange({...data,independent:false,components:{...data.components,[component]:{...u,...patch}}});return <fieldset key={component}><legend>{names[component]}</legend><div className={s.fields}>
      <label>{t('عدد عدم‌قطعیت یا گام (g)','Uncertainty or resolution value (g)')}<input {...attrs(`${component}.value`)} className="ui-input" dir="ltr" inputMode="decimal" value={u.value} onChange={e=>update({value:e.target.value})}/>{fieldError(`${component}.value`)}</label>
      {component!=='resolution'&&<label>{component==='calibration'?'k':t('تعداد n برای میانگین؛ برای تک‌توزین ۱','Count n for the mean; 1 for a single weighing')}<input {...attrs(`${component}.divisor`)} className="ui-input" dir="ltr" inputMode="decimal" value={u.divisor} onChange={e=>update({divisor:e.target.value})}/>{fieldError(`${component}.divisor`)}</label>}
      <label>{t('منبع و بررسی هم‌پوشانی','Source and overlap assessment')}<input {...attrs(`${component}.source`)} className="ui-input" maxLength={2000} value={u.source} onChange={e=>update({source:e.target.value})}/>{fieldError(`${component}.source`)}</label>
    </div><p className={s.muted} dir="ltr">{component==='calibration'?'u = U / k':component==='resolution'?'u = d / √12':'u = s / √n'}</p></fieldset>;})}</div>
    <p className={s.muted}>{t('اگر تفکیک یا تکرارپذیری در عدم‌قطعیت گواهی لحاظ شده است، آن را دوباره اضافه نکنید. صفر فقط با دلیل مستند در منبع مجاز است. تقسیم s بر √n فقط برای گزارش میانگین n توزین مستقل است.','Do not add resolution or repeatability again if already included in the certificate uncertainty. Zero requires a documented reason in the source. Divide s by √n only when reporting the mean of n independent weighings.')}</p>
    <label className={s.checkLine}><input {...attrs('independent')} type="checkbox" checked={data.independent} onChange={e=>onChange({...data,independent:e.target.checked})}/><span>{t('منابع را بررسی کرده‌ام؛ مؤلفه‌ها مستقل‌اند و دوباره‌شماری ندارند.','I have reviewed the sources; components are independent and not double counted.')}{fieldError('independent')}</span></label>
    <div className={s.fields}><label>{t('ضریب پوشش نتیجه k','Result coverage factor k')}<input {...attrs('coverage')} className="ui-input" dir="ltr" value={data.coverage} onChange={e=>onChange({...data,coverage:e.target.value})}/>{fieldError('coverage')}</label><label>{t('مبنای انتخاب k','Basis for choosing k')}<input {...attrs('coverageSource')} className="ui-input" maxLength={2000} value={data.coverageSource} onChange={e=>onChange({...data,coverageSource:e.target.value})}/>{fieldError('coverageSource')}</label></div>
    <p className={s.muted}>{t('k = ۲ تضمین پوشش دقیق ۹۵٪ نیست. انتشار مرتبهٔ اول برای ورودی‌های مستقل:','k = 2 does not guarantee exact 95% coverage. First-order propagation for independent inputs:')} <bdi>u = √Σuᵢ²; U = k × u</bdi></p>
    <button type="button" className={s.primary} disabled={server.busy} onClick={()=>{setError(false);setAttempted(true);if(Object.keys(errors).length){requestAnimationFrame(()=>form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());return;}void server.calculate();}}>{server.busy?t('در حال محاسبه…','Calculating…'):t('محاسبهٔ توزین','Calculate weighing')}</button>
    {attempted&&Object.keys(errors).length>0&&<p role="alert">{t('ورودی‌های مشخص‌شده را اصلاح کنید.','Correct the highlighted inputs.')}</p>}
    {(error||server.failure)&&<p role="alert" className={s.fileStatus}>{t('اگر ارتباط با سرور برقرار است، ورودی‌ها را بررسی کنید: جرم مثبت، عدم‌قطعیت‌های نامنفی با منبع، k مثبت و n صحیح از ۱ تا ۱۰۰۰۰۰۰ لازم است. مبنای پوشش و استقلال را نیز بررسی کنید.','Check server connectivity and provide positive mass, nonnegative sourced uncertainties, positive k and integer n from 1 to 1000000. Review the coverage basis and independence.')}</p>}
    {run&&!current&&<p role="status">{t('داده‌ها تغییر کرده‌اند؛ دوباره محاسبه کنید.','Inputs changed; recalculate.')}</p>}
    {current&&run&&<div className={s.calculated} role="status"><h3 dir="ltr">{run.result.mass.toPrecision(7)} ± {run.result.expanded.toPrecision(4)} g</h3><p><bdi>u = {run.result.standard.toPrecision(6)} g; k = {run.result.k}</bdi></p>{run.result.budget.map(c=><p key={c.key}>{names[c.key]}: <bdi>u = {c.u.toPrecision(6)} g</bdi></p>)}<p>{t('این نتیجه تصمیم انطباق نیست. مشخصات اجرا در فایل نگهداری می‌شود؛ پس از بازخوانی، نتیجه باید دوباره محاسبه شود.','This is not a conformity decision. Execution details are retained in the file; recalculate after reopening.')}</p></div>}
    {current&&run&&<div className={s.reportActions}>{server.verified&&<PhysicalPDFButton kind="weighing" data={data} identity={identity} run={server.verified} en={en}/>}<p><bdi>{server.verified?.engine} · {server.verified?.engineVersion}</bdi></p><button type="button" className={s.secondary} onClick={exportReport}>{t('دریافت گزارش قابل چاپ (HTML)','Download printable report (HTML)')}</button>{textExport.notice}<p className={s.muted}>{t('PDF را مستقیم دریافت کنید یا نسخهٔ HTML را باز کنید. برای ویرایش بعدی، فایل JSON را نگه دارید.','Download PDF directly or open the HTML version. Keep JSON for further editing.')}</p>{report?.key===key&&report.en===en&&<iframe className={s.physicalReport} title={t('پیش‌نمایش گزارش توزین','Weighing report preview')} sandbox="" srcDoc={report.html}/>}</div>}
  </section>;
}
