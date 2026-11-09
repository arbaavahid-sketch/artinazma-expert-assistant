"use client";

import {useId,useState} from 'react';
import {calculateStockPreparation,numeric,stockKeys,uncertaintyKinds,type StockPreparation,type StockKey} from './gc-workflow';
import s from './preview.module.css';

export const stockLabels:Record<StockKey,readonly[string,string]>={
  mass:['جرم مادهٔ توزین‌شده (mg)','Weighed substance mass (mg)'],
  purity:['خلوص ماده (%)','Substance purity (%)'],
  volume:['حجم نهایی محلول مادر (mL)','Final stock-solution volume (mL)'],
  aliquot:['حجم برداشتی از محلول مادر (mL)','Aliquot from stock solution (mL)'],
  finalVolume:['حجم نهایی محلول رقیق‌شده (mL)','Final diluted solution volume (mL)'],
};
const help={mass:['از برگهٔ توزین؛ جرم ماده است، نه جرم ماده همراه ظرف. عدم‌قطعیت هم باید بر حسب mg باشد.','From the weighing record; substance mass excluding the container. Its uncertainty must also be in mg.'],
  purity:['از گواهی همان بچ؛ مثلاً ۹۹٫۵ یعنی ۹۹٫۵٪. عدم‌قطعیت را بر حسب واحد درصد وارد کنید، نه درصد نسبی.','From the certificate for the actual lot; 99.5 means 99.5%. Enter uncertainty in percentage points, not relative percent.'],
  volume:['حجمی که محلول پس از حل‌شدن ماده به آن رسانده شده؛ عدم‌قطعیت حجم در mL، با لحاظ شرایط واقعی کار.','The volume made up after dissolving the substance. Volume uncertainty is in mL under the actual working conditions.'],
  aliquot:['حجم محلول مادری که برای تهیهٔ یک محلول میانی مشترک برداشته‌اید؛ از پیپت یا وسیلهٔ حجمی.','Stock-solution volume used to prepare a common intermediate solution; from the pipette or volumetric device.'],
  finalVolume:['حجم نهایی همان محلول میانی مشترک. رقیق‌سازی مستقل هر نقطهٔ کالیبراسیون را اینجا وارد نکنید.','Final volume of that common intermediate solution. Do not enter separate dilutions of individual calibration points here.']};
const kindLabels=[['عدم‌قطعیت استاندارد u','Standard uncertainty u'],['گواهی: U و k','Certificate: U and k'],['حد ±a مستطیلی','Rectangular ±a bound'],['حد ±a مثلثی','Triangular ±a bound'],['گام تفکیک d','Resolution step d'],['انحراف معیار s و تعداد n','Standard deviation s and count n']];
export default function StockPreparationForm({value,onChange,en,standalone=false}:{standalone?:boolean;value:StockPreparation;onChange:(value:StockPreparation)=>void;en:boolean}){
  const t=(fa:string,english:string)=>en?english:fa;
  const id=useId();
  const [visited,setVisited]=useState<Record<string,boolean>>({});
  const active=value.dilution?stockKeys:stockKeys.slice(0,3);
  let result:ReturnType<typeof calculateStockPreparation>|null=null;
  try{result=calculateStockPreparation(value);}catch{/* Incomplete drafts remain editable. */}
  return <section className={s.stockPreparation} aria-label={standalone?t('عدم‌قطعیت محلول تهیه‌شده','Prepared solution uncertainty'):t('تهیهٔ استاندارد مشترک','Shared standard preparation')}>
    <h4>{standalone?t('غلظت جرمی و عدم‌قطعیت محلول','Solution mass concentration and uncertainty'):t('محاسبه از تهیهٔ محلول استاندارد','Calculate from standard preparation')}</h4>
    <p className={s.muted}>{standalone?t('برای تهیه از جرم ماده و رساندن به حجم نهایی؛ واکنش، تبدیل نمک به عنصر و CRM آماده در این مدل نیستند.','For preparation from weighed substance made up to final volume; reactions, salt-to-element conversion and ready-made CRMs are outside this model.'):t('برای حل‌کردن یک مادهٔ دارای خلوص جرمی مشخص و رساندن آن به حجم معلوم. این مدل واکنش شیمیایی، تبدیل نمک به عنصر، CRM آماده یا رقیق‌سازی مستقل نقاط کالیبراسیون را پوشش نمی‌دهد. فقط آماده‌سازی‌ای را ثبت کنید که بین استانداردها مشترک است.','For dissolving a substance of known mass purity and making it up to a stated volume. This model does not cover chemical reactions, salt-to-element conversion, ready-made CRMs or independent dilution of calibration points. Record only preparation shared by the standards.')}</p>
    <label className={s.checkLine}><input type="checkbox" checked={value.dilution} onChange={e=>onChange({...value,dilution:e.target.checked})}/><span>{standalone?t('پس از تهیهٔ محلول مادر، یک مرحله رقیق‌سازی دارم.','One dilution step follows stock preparation.'):t('یک مرحله رقیق‌سازی مشترک پس از تهیهٔ محلول مادر دارم.','There is one common dilution step after stock preparation.')}</span></label>
    {active.map(key=>{
      const input=value.inputs[key],u=input.uncertainty;
      const nominal=numeric(input.nominal),uncertainty=numeric(u.value),divisor=numeric(u.divisor);
      const errors:Record<string,string>={
        nominal:!Number.isFinite(nominal)||nominal<=0?t('مقدار مثبت و معتبر وارد کنید.','Enter a valid positive value.'):key==='purity'&&nominal>100?t('خلوص نمی‌تواند بیشتر از ۱۰۰٪ باشد.','Purity must not exceed 100%.'):key==='finalVolume'&&numeric(value.inputs.aliquot.nominal)>nominal?t('حجم نهایی نباید از حجم برداشتی کمتر باشد.','Final volume must not be less than the aliquot.'):'',
        uncertainty:!Number.isFinite(uncertainty)||uncertainty<0||uncertainty>1e100?t('عدم‌قطعیت معتبر و نامنفی، حداکثر 1e100 وارد کنید.','Enter a valid nonnegative uncertainty no greater than 1e100.'):'',
        divisor:u.kind==='certificate'&&(!Number.isFinite(divisor)||divisor<=0)?t('ضریب پوشش k باید مثبت باشد.','Coverage factor k must be positive.'):u.kind==='repeatability'&&(!Number.isInteger(divisor)||divisor<1||divisor>1000000)?t('تعداد n باید عدد صحیح از ۱ تا ۱۰۰۰۰۰۰ باشد.','Count n must be an integer from 1 to 1000000.'):'',
        source:!u.source.trim()?t('منبع یا شمارهٔ مدرک را وارد کنید.','Enter the source or record reference.'):'',
      };
      const shown=(field:string)=>Boolean(errors[field]&&(visited[`${key}-${field}`]||({nominal:input.nominal,uncertainty:u.value,divisor:u.divisor,source:u.source}[field]?.trim())));
      const validation=(field:string)=>({'aria-invalid':shown(field),'aria-describedby':shown(field)?`${id}-${key}-${field}`:undefined,onBlur:()=>setVisited(old=>({...old,[`${key}-${field}`]:true}))});
      const message=(field:string)=>shown(field)?<span id={`${id}-${key}-${field}`} className={s.fieldError}>{errors[field]}</span>:null;
      const update=(patch:Partial<typeof input>)=>onChange({...value,inputs:{...value.inputs,[key]:{...input,...patch}}});
      return <div key={key} className={s.stockInput}><h5>{stockLabels[key][en?1:0]}</h5><p className={s.muted}>{help[key][en?1:0]}</p><div className={s.fields}>
        <label>{t('مقدار واقعی','Actual value')}<input {...validation('nominal')} className="ui-input" dir="ltr" inputMode="decimal" value={input.nominal} onChange={e=>update({nominal:e.target.value})}/>{message('nominal')}</label>
        <label>{t('نوع عدد عدم‌قطعیت','Uncertainty input type')}<select className="ui-input" value={u.kind} onChange={e=>update({uncertainty:{...u,kind:e.target.value as typeof u.kind}})}>{uncertaintyKinds.map((kind,i)=><option key={kind} value={kind}>{kindLabels[i][en?1:0]}</option>)}</select></label>
        <label>{t('عدد عدم‌قطعیت یا حد، در واحد بالا','Uncertainty value or bound, in units above')}<input {...validation('uncertainty')} className="ui-input" dir="ltr" inputMode="decimal" value={u.value} onChange={e=>update({uncertainty:{...u,value:e.target.value}})}/>{message('uncertainty')}</label>
        {(u.kind==='certificate'||u.kind==='repeatability')&&<label>{u.kind==='certificate'?t('ضریب پوشش گواهی k','Certificate coverage factor k'):t('تعداد اندازه‌گیری‌های میانگین‌شده n','Number of measurements averaged n')}<input {...validation('divisor')} className="ui-input" dir="ltr" inputMode="decimal" value={u.divisor} onChange={e=>update({uncertainty:{...u,divisor:e.target.value}})}/>{message('divisor')}</label>}
        <label>{t('منبع یا شمارهٔ مدرک','Source or record reference')}<input {...validation('source')} className="ui-input" value={u.source} maxLength={2000} onChange={e=>update({uncertainty:{...u,source:e.target.value}})}/>{message('source')}</label>
      </div></div>;
    })}
    <label className={s.checkLine}><input type="checkbox" checked={value.independent} onChange={e=>onChange({...value,independent:e.target.checked})}/><span>{t('منابع تهیهٔ استاندارد را بررسی کرده‌ام و در این محاسبه مستقل فرض می‌کنم؛ هم‌بستگی و دوباره‌شماریِ داخل آن‌ها را جدا بررسی کرده‌ام.','I have assessed the preparation sources and treat them as independent here; correlations and internal double counting have been reviewed separately.')}</span></label>
    <p className={s.formula} dir="ltr">C (mg/L) = 10 × m (mg) × P (%) / V (mL){value.dilution?' × Va / Vf':''}<br/>uᵣ (%) = 100 × √Σ[u(x) / x]²</p>
    <p className={s.muted}>{t('غلظت از جرم مادهٔ خالص تقسیم بر حجم می‌آید؛ عدد ۱۰ تبدیل mg، درصد و mL به mg/L است. در ترکیب مرتبهٔ اولِ کمیت‌های مستقلِ ضرب و تقسیم، مربع عدم‌قطعیت‌های نسبی جمع می‌شود.','Concentration is pure-substance mass divided by volume; 10 converts mg, percent and mL to mg/L. For independent multiplied and divided quantities, first-order propagation sums squared relative standard uncertainties.')}</p>
    {result?<div className={s.stockResult} role="status"><p>{standalone?t('غلظت جرمی محلول','Solution mass concentration'):t('غلظت محلول مشترک','Common solution concentration')}: <bdi>{result.concentration.toPrecision(7)} mg/L</bdi></p><p>{standalone?t('عدم‌قطعیت استاندارد نسبی','Relative standard uncertainty'):t('عدم‌قطعیت استاندارد نسبی منتقل‌شده','Transferred relative standard uncertainty')}: <bdi>{result.relativePercent.toPrecision(6)} %</bdi></p>{standalone&&<><p>{t('عدم‌قطعیت استاندارد غلظت','Standard concentration uncertainty')}: <bdi>{(result.concentration*result.relativePercent/100).toPrecision(6)} mg/L</bdi></p><div style={{overflowX:'auto'}}><table style={{width:'100%',fontSize:12}}><thead><tr><th>{t('کمیت','Input')}</th><th>u(x)</th><th>{t('اثر استاندارد (mg/L)','Standard effect (mg/L)')}</th></tr></thead><tbody>{result.components.map(c=><tr key={c.key}><th>{t(...stockLabels[c.key])}</th><td dir="ltr">{c.u.toPrecision(6)}</td><td dir="ltr">{(result.concentration*c.relative).toPrecision(6)}</td></tr>)}</tbody></table></div></>}</div>:<p role="status" className={s.muted}>{t('برای محاسبه، مقدار مثبت و عدم‌قطعیت نامنفی با منبع را برای هر کمیت فعال وارد کنید و فرض استقلال را بررسی کنید. خلوص حداکثر ۱۰۰٪ است.','To calculate, enter a positive value and nonnegative sourced uncertainty for every active quantity, and review independence. Purity must not exceed 100%.')}</p>}
  </section>;
}
