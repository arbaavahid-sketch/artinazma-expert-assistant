"use client";
import { useState } from "react";
import { familyModels } from "./family-models";
import { methodProfile, type BankMethod } from "./method-profiles";
import { readMethodRecord } from "./method-record";
import {methodName} from "./method-names-en";

export default function MethodReadiness({method,en,onOpen}:{method:BankMethod;en:boolean;onOpen:(model:string)=>void}) {
  const profile=methodProfile(method,en);
  const [outcome,setOutcome]=useState("");
  const [evidence,setEvidence]=useState("");
  const [sop,setSop]=useState("");
  const [status,setStatus]=useState("");
  return <section className="space-y-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4 text-sm leading-7">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-bold">{en?"Method workspace":"پروندهٔ آزمون"}</h3>
      <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-bold">{en
        ? ({numeric:"Base calculation available",qualitative:"Qualitative / ordinal",sampling:"Sampling study",custom:"Method model required"})[profile.kind]
        : ({numeric:"مدل پایهٔ محاسبه دارد",qualitative:"کیفی یا رده‌ای",sampling:"مطالعهٔ نمونه‌برداری",custom:"نیازمند مدل اختصاصی"})[profile.kind]}</span>
    </div>
    <p>{profile.scope}</p>
    <h4 className="font-semibold">{en?"Effects to assess for this method":"پارامترهایی که باید برای این روش بررسی شوند"}</h4>
    <ul className="list-inside list-disc space-y-1">{profile.effects.map(effect=><li key={effect}>{effect}</li>)}</ul>
    {profile.models.length>0 && <div className="flex flex-wrap gap-2">{profile.models.map(key=><button type="button" key={key} className="ui-btn ui-btn-ghost text-sm" onClick={()=>onOpen(`family:${key}`)}>
      {en?"Use model: ":"انتخاب مدل: "}{en?familyModels[key].en:familyModels[key].fa}
    </button>)}</div>}
    {profile.kind!=="numeric" && <div className="space-y-3 border-t border-[var(--border-soft)] pt-3">
      <label className="block"><span>{en?"Actual SOP / standard edition":"روش اجرایی و ویرایش استاندارد واقعی"}</span><input className="ui-input" value={sop} onChange={e=>setSop(e.target.value)}/></label>
      <label className="block"><span>{en?"Observed result or study objective":"نتیجهٔ مشاهده‌شده یا هدف مطالعه"}</span><input className="ui-input" value={outcome} onChange={e=>setOutcome(e.target.value)}/></label>
      <label className="block"><span>{en?"Evidence, replicates and decision rule":"شواهد، تکرارها و قاعدهٔ تصمیم"}</span><textarea rows={3} className="ui-input" value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>
      <div className="flex flex-wrap gap-2">
        <label className="ui-btn ui-btn-ghost cursor-pointer">{en?"Open method record":"باز کردن پروندهٔ روش"}<input type="file" accept=".json" className="sr-only" onChange={async event=>{
          const file=event.target.files?.[0];event.target.value="";if(!file)return;
          try {
            if(file.size>100000)throw new Error("Too large");
            const data=readMethodRecord(JSON.parse(await file.text()),method.id);
            setSop(data.sop);setOutcome(data.outcome);setEvidence(data.evidence);
            setStatus(en?"Method record restored.":"پروندهٔ روش باز شد.");
          } catch {setStatus(en?"Invalid record or different test. Current entries were kept.":"پرونده نامعتبر یا مربوط به آزمون دیگری است؛ اطلاعات فعلی حفظ شد.");}
        }}/></label>
        <button type="button" className="ui-btn ui-btn-ghost" disabled={!sop.trim()||!outcome.trim()} onClick={()=>{
          const file={format:"artin-method-record",version:1,savedAt:new Date().toISOString(),methodId:method.id,method:methodName(method,en),kind:profile.kind,sop,outcome,evidence,effects:profile.effects,scope:profile.scope};
          const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:"application/json"}));
          const a=document.createElement("a");a.href=url;a.download=`artin-method-${method.id}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
          setStatus(en?"Method record prepared; no numeric uncertainty was calculated.":"پروندهٔ روش آماده شد؛ عدم‌قطعیت عددی محاسبه نشده است.");
        }}>{en?"Save method record":"ذخیرهٔ پروندهٔ روش"}</button>
        {profile.kind!=="qualitative" && <button type="button" className="ui-btn ui-btn-ghost" onClick={()=>onOpen("general")}>{en?"Open expert budget":"بودجهٔ اختصاصی کارشناس"}</button>}
      </div>
      <p className="text-xs opacity-75">{en?"Method records document the assessment and do not certify compliance or replace an uncertainty study.":"این پرونده مستندات ارزیابی است و تأیید انطباق یا جایگزین مطالعهٔ عدم‌قطعیت نیست."}</p>
      {status&&<p role="status">{status}</p>}
    </div>}
  </section>;
}
