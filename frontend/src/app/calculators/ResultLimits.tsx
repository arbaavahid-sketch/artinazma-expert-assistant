"use client";
import {compareLimits,limitMessage,outsideLimits} from "./result-limits";
export default function ResultLimits({en,value,unit,minimum,maximum,onMinimum,onMaximum,parseNumber}:{
  en:boolean;value:number;unit:string;minimum:string;maximum:string;onMinimum:(value:string)=>void;onMaximum:(value:string)=>void;parseNumber:(value:string)=>number;
}) {
  const status=compareLimits(value,minimum,maximum,parseNumber);
  return <fieldset className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-sm" onChange={event=>event.stopPropagation()}>
    <legend className="px-1 font-bold">{en?"Result limits (optional)":"حدود نتیجه (اختیاری)"}</legend>
    <p className="text-xs leading-6 opacity-80">{en?"Use limits from the product specification, customer requirement or approved laboratory procedure. A test-method number alone does not define acceptance limits. Leave blank if no valid limit is available.":"حدها را از مشخصات محصول، الزام مشتری یا روش اجرایی تأییدشدهٔ آزمایشگاه بردارید. شمارهٔ روش آزمون به‌تنهایی حد قبولی نیست. اگر حد معتبر ندارید، کادرها را خالی بگذارید."}</p>
    <p className="text-xs leading-6">{en?"Enter one or both limits in the result unit. Values below the minimum or above the maximum turn red; equality is within limits.":"یک یا هر دو حد را در واحد نتیجه وارد کنید. کمتر از حد پایین یا بیشتر از حد بالا قرمز می‌شود؛ مقدار برابر با حد، داخل محدوده است."} {unit&&<bdi dir="ltr">({unit})</bdi>}</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1"><span>{en?"Minimum acceptable result":"حد پایین نتیجه"}</span><input className="ui-input" dir="ltr" inputMode="decimal" value={minimum} placeholder={en?"No minimum":"بدون حد پایین"} onChange={event=>onMinimum(event.target.value)}/></label>
      <label className="block space-y-1"><span>{en?"Maximum acceptable result":"حد بالای نتیجه"}</span><input className="ui-input" dir="ltr" inputMode="decimal" value={maximum} placeholder={en?"No maximum":"بدون حد بالا"} onChange={event=>onMaximum(event.target.value)}/></label>
    </div>
    {status!=='none'&&<p role={status==='invalid'?'alert':'status'} className={`font-bold ${outsideLimits(status)||status==='invalid'?'text-[var(--color-danger-text)]':status==='within'?'text-[var(--color-success-text)]':''}`}>{limitMessage(status,en)}</p>}
    {(status==='within'||outsideLimits(status))&&<p className="text-xs">{en?"Value compared before rounding: ":"مقدار مبنای مقایسه، پیش از گرد کردن: "}<bdi dir="ltr">{String(value)} {unit}</bdi></p>}
    {(status==='within'||outsideLimits(status))&&<p className="text-xs opacity-75">{en?"This compares the numeric result only; it does not apply an uncertainty guard band or certify conformity.":"این مقایسه فقط برای مقدار نتیجه است؛ حاشیهٔ اطمینان ناشی از عدم‌قطعیت یا تأیید انطباق اعمال نشده است."}</p>}
  </fieldset>;
}
