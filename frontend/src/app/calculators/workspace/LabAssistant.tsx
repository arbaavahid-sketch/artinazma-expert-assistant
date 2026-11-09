'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {apiUrl,backendFetch} from '@/lib/api';
import {useModalDialog} from './use-modal-dialog';
import {useTextExport} from './use-text-export';
import {applyLabProposal,contextKey,readLabHandoff,readLabHandoffTurns,saveLabHandoff,saveLabReturn,type LabContext,type LabReply,type LabTurn,type LabProposal,type LabCalculation} from './lab-chat-bridge';
import s from './lab-assistant.module.css';

const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function CalculationCard({value,en}:{value:LabCalculation;en:boolean}){
 const names:Record<string,[string,string]>={measured:['نتیجه','Result'],standard_uncertainty:['عدم‌قطعیت استاندارد','Standard uncertainty'],expanded_uncertainty:['عدم‌قطعیت بسط‌یافته','Expanded uncertainty'],coverage:['ضریب پوشش','Coverage factor'],mean:['میانگین','Mean'],sample_sd:['انحراف معیار نمونه','Sample standard deviation'],rsd_percent:['انحراف معیار نسبی (%)','RSD (%)'],n:['تعداد داده','Count'],aliquot_volume:['حجم برداشت','Aliquot volume'],final_volume:['حجم نهایی','Final volume'],mass_g:['جرم (گرم)','Mass (g)'],converted:['مقدار تبدیل‌شده','Converted value']};
 return <section className={s.calculation} aria-label={en?'Numerical engine output':'خروجی موتور محاسبات'}><h4>{en?'Numerical engine output':'خروجی موتور محاسبات'} <bdi>· {value.id}</bdi></h4><dl className={s.resultGrid}>{Object.entries(value.result).filter(([k,v])=>names[k]&&typeof v==='number').map(([k,v])=><div key={k}><dt>{names[k][en?1:0]}</dt><dd><bdi>{new Intl.NumberFormat(en?'en':'fa',{maximumSignificantDigits:12}).format(v as number)}</bdi></dd></div>)}</dl><p><bdi>{value.unit} · {new Date(value.calculatedAt).toLocaleString(en?'en':'fa')}</bdi></p><details><summary>{en?'Calculation details, inputs and revision':'جزئیات محاسبه، ورودی‌ها و نسخه'}</summary><pre dir="ltr">{JSON.stringify(value,null,2)}</pre></details></section>;
}
function fieldLabel(path:string,en:boolean){
 const fields:Record<string,[string,string]>={'identity.title':['عنوان پرونده','Project title'],'identity.sample':['شناسهٔ نمونه','Sample ID'],'identity.matrix':['ماتریس نمونه','Sample matrix'],'identity.sop':['روش اجرایی','SOP'],'identity.edition':['ویرایش روش','Method edition'],'methodStudy.conditions':['شرایط آزمون','Test conditions'],'methodStudy.outcome':['پیش‌نویس نتیجهٔ متنی','Draft textual outcome'],'methodStudy.evidence':['شواهد و تکرارها','Evidence and replicates'],'methodStudy.decision':['پیش‌نویس ارزیابی تصمیم','Draft decision assessment']};
 return fields[path]?.[en?1:0]??(en?'Test input':'ورودی آزمون');
}
export function LabAssistantDialog({en,onClose,getContext,onApply,main=false,turns,setTurns}:{en:boolean;onClose:()=>void;getContext:()=>LabContext|null;onApply?:(project:LabContext['project'],sourceKey:string)=>void;main?:boolean;turns:LabTurn[];setTurns:(turns:LabTurn[])=>void}){
 const ref=useModalDialog(),controller=useRef<AbortController|null>(null),exporter=useTextExport(en),router=useRouter();
 const [question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[applied,setApplied]=useState<string[]>([]),[context,setContext]=useState<LabContext|null>(null);
 const t=(fa:string,e:string)=>en?e:fa;
 useEffect(()=>{try{setContext(getContext());}catch{setError(t('حجم پرونده برای ارسال زیاد است.','Project is too large to attach.'));}return()=>controller.current?.abort();},[]); // eslint-disable-line react-hooks/exhaustive-deps
 async function send(prompt=question){
  if(busy||controller.current||!prompt.trim())return;
  setBusy(true);setError('');controller.current=new AbortController();let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;controller.current?.abort();},130000);
  try{
   const current=getContext();setContext(current);
   // Establish the same guest cookie/CSRF flow as the main chat, never bypass its allowance.
   const access=await backendFetch(apiUrl('/chat/access'),{cache:'no-store',signal:controller.current.signal});
   if(!access.ok)throw Error('access');
   const response=await backendFetch(apiUrl('/chat/laboratory'),{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.current.signal,body:JSON.stringify({message:prompt,laboratory:current?.snapshot??null,history:turns.slice(-6).flatMap(turn=>[{role:'user',content:turn.question},{role:'assistant',content:turn.reply.answer+'\nPrevious numerical tool outputs (historical): '+JSON.stringify(turn.reply.calculations)}])})});
   if(response.status===401||response.status===403)throw Error('access');
   if(response.status===429)throw Error('rate');
   if(!response.ok)throw Error('unavailable');
   const reply=await response.json() as LabReply;
   if(typeof reply.answer!=='string'||!Array.isArray(reply.calculations)||!Array.isArray(reply.proposals))throw Error('invalid');
   setTurns([...turns,{question:prompt,reply,sourceKey:contextKey(current)}]);setQuestion('');
  }catch(e){if(timedOut||!controller.current?.signal.aborted)setError(e instanceof Error&&e.message==='access'?t('برای ادامه، وارد حساب تأییدشده شوید یا مراحل دسترسی مهمان را در چت آرتین تکمیل کنید.','Sign in with an approved account or complete guest access in the main chat.'):e instanceof Error&&e.message==='rate'?t('تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.','Too many requests. Try again shortly.'):t('پاسخ دریافت نشد. داده‌های پرونده تغییر نکرده‌اند؛ دوباره تلاش کنید.','No response received. Project data were not changed; please retry.'));}
  finally{clearTimeout(timer);setBusy(false);controller.current=null;}
 }
 function apply(turn:LabTurn,proposal:LabProposal,index:number){
  try{
   const current=getContext();if(!current||contextKey(current)!==turn.sourceKey||proposal.revision!==turn.reply.revision)throw Error('stale');
   const project=applyLabProposal(current,proposal);
   if(onApply)onApply(project,turn.sourceKey);
   else{saveLabReturn(project);router.push('/calculators');return;}
   setApplied([...applied,`${index}:${proposal.id}`]);setContext(getContext());setError('');
  }catch{setError(t('پیشنهاد قابل اعمال نیست؛ پرونده تغییر کرده یا مقدار پیشنهادی معتبر نیست. وضعیت فعلی را دوباره از آرتین بپرسید.','Cannot apply this proposal: the project changed or a proposed value is invalid. Ask Artin using the current project.'));}
 }
 function mainChat(){try{saveLabHandoff(getContext(),turns);router.push('/assistant?lab=1');}catch{setError(t('انتقال پرونده ممکن نشد؛ ابتدا فایل آن را ذخیره کنید.','Could not transfer the project. Save its file first.'));}}
 function returnProject(){try{const current=getContext();if(current){saveLabReturn(current.project);router.push('/calculators');}}catch{setError(t('انتقال پرونده ممکن نشد.','Could not transfer the project.'));}}
 async function report(){
  const title=t('گفت‌وگوی آزمایشگاهی با آرتین','Laboratory conversation with Artin');
  const html=`<!doctype html><html lang="${en?'en':'fa'}" dir="${en?'ltr':'rtl'}"><meta charset="utf-8"><title>${title}</title><style>body{font-family:Tahoma,sans-serif;max-width:960px;margin:32px auto;padding:24px;line-height:1.9}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f5f9;padding:16px}section{border-bottom:1px solid #ccd5df;padding:20px 0}</style><h1>${title}</h1><p>${escape(t('تفسیر آرتین پیش‌نویس است؛ تأیید آزمایشگاه محسوب نمی‌شود. هر محاسبه به داده و زمان همان نوبت مربوط است.','Artin’s interpretation is a draft, not laboratory approval. Each calculation refers to its own inputs and timestamp.'))}</p>${turns.map(turn=>`<section><h2>${escape(turn.question)}</h2><p>${escape(turn.reply.answer).replace(/\n/g,'<br>')}</p>${turn.reply.calculations.map(c=>`<h3>${escape(c.id)} · ${escape(c.kind)}</h3><pre dir="ltr">${escape(JSON.stringify(c,null,2))}</pre>`).join('')}</section>`).join('')}</html>`;
  await exporter.save(html,'artin-laboratory-conversation.html','html');
 }
 return <dialog ref={ref} className={s.dialog} aria-labelledby="lab-chat-title" onCancel={e=>{e.preventDefault();onClose();}} dir={en?'ltr':'rtl'}>
  <header className={s.header}><div><span>ARTIN · LAB ASSISTANT</span><h2 id="lab-chat-title">{t('بررسی و محاسبه با آرتین','Review & calculate with Artin')}</h2></div><button type="button" onClick={onClose}>{t('بستن','Close')}</button></header>
  <div className={s.context}><strong>{context?context.project.identity.title||context.project.identity.sample||t('پروندهٔ جاری','Current project'):t('گفت‌وگوی محاسباتی بدون پرونده','Standalone laboratory conversation')}</strong><p>{context?t('هنگام ارسال هر سؤال، داده‌های جاری این پرونده به آرتین فرستاده می‌شود. پیشنهادها فقط با تأیید شما اعمال می‌شوند.','Each question sends the current project data to Artin. Changes require your confirmation.'):t('واحدها و داده‌ها را در پیام بنویسید؛ برای بررسی پرونده، از محیط آزمایشگاه وارد شوید یا فایل پرونده را پیوست کنید.','Include units and input data. Open from the workspace or attach a project file to review it.')}</p></div>
  <div className={s.thread} aria-busy={busy}>
   {!turns.length&&<div className={s.starters}>{[t('برای تکمیل این آزمون چه اطلاعاتی لازم است؟','What information is missing for this test?'),t('بودجهٔ جاری را محاسبه کن و مؤلفه‌های اثرگذار را توضیح بده.','Calculate the current budget and explain its main contributions.'),t('برای تهیهٔ ۲۵۰ میلی‌لیتر محلول ۰٫۱ مولار از محلول ۱ مولار، چقدر بردارم؟','How much 1 mol/L stock is needed for 250 mL at 0.1 mol/L?')].map(prompt=><button type="button" key={prompt} onClick={()=>setQuestion(prompt)}>{prompt}</button>)}</div>}
   {turns.map((turn,index)=><article key={index} className={s.turn}><h3>{turn.question}</h3><div className={s.answer}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{img:()=>null}}>{turn.reply.answer}</ReactMarkdown></div>
    {turn.reply.calculations.map(c=><CalculationCard key={c.id} value={c} en={en}/>)}
    {turn.reply.proposals.map(p=><section key={p.id} className={s.proposal} aria-label={t('پیشنهاد تغییر پرونده','Proposed project changes')}><h4>{t('پیشنهاد آرتین؛ هنوز اعمال نشده','Artin’s proposal — not yet applied')}</h4>{p.changes.map(c=><div key={c.path}><strong>{fieldLabel(c.path,en)}</strong><details><summary>{t('نام فیلد','Field path')}</summary><bdi>{c.path}</bdi></details><dl><dt>{t('فعلی','Current')}</dt><dd>{c.previous||'∅'}</dd><dt>{t('پیشنهادی','Proposed')}</dt><dd>{c.value||'∅'}</dd></dl><p>{c.reason}</p></div>)}<button type="button" disabled={busy||applied.includes(`${index}:${p.id}`)} onClick={()=>apply(turn,p,index)}>{applied.includes(`${index}:${p.id}`)?t('اعمال شد؛ دوباره محاسبه کنید','Applied; recalculate'):main?t('بررسی و انتقال تغییرات به پرونده','Review changes in the workspace'):t('تأیید و اعمال این تغییرات','Confirm and apply these changes')}</button></section>)}
   </article>)}
   {busy&&<p role="status">{t('آرتین در حال بررسی و اجرای ابزارهای لازم است…','Artin is reviewing and running the required tools…')}</p>}
  </div>
  {error&&<p className={s.error} role="alert">{error} <Link href="/assistant">{t('چت آرتین','Artin chat')}</Link></p>}
  <form className={s.composer} onSubmit={e=>{e.preventDefault();void send();}}><label htmlFor="lab-chat-message">{t('پیام به آرتین','Message Artin')}</label><textarea id="lab-chat-message" value={question} maxLength={10000} onChange={e=>setQuestion(e.target.value)} placeholder={t('داده، واحد و درخواستت را بنویس…','Enter your data, units and question…')}/><div><button type="submit" disabled={busy||!question.trim()}>{t('ارسال به آرتین','Send to Artin')}</button>{busy&&<button type="button" onClick={()=>controller.current?.abort()}>{t('توقف','Stop')}</button>}<button type="button" disabled={!turns.length||exporter.busy} onClick={()=>void report()}>{t('گزارش گفت‌وگو','Export conversation')}</button>{main&&context&&<button type="button" disabled={busy} onClick={returnProject}>{t('بازگشت با همین پرونده','Return with this project')}</button>}{!main&&<button type="button" disabled={busy} onClick={mainChat}>{t('ادامه در صفحهٔ چت','Continue in chat page')}</button>}</div><p className={s.sessionNote}>{t('این گفت‌وگو موقت است؛ برای نگهداری، گزارش گفت‌وگو و فایل پرونده را ذخیره کنید.','This conversation is temporary. Save the conversation report and project file to retain them.')}</p>{exporter.notice}</form>
 </dialog>;
}

export default function LabChatLauncher({en,getContext,onApply}:{en:boolean;getContext?:()=>LabContext|null;onApply?:(project:LabContext['project'],sourceKey:string)=>void}){
 const [open,setOpen]=useState(false),[turns,setTurns]=useState<LabTurn[]>([]),[attached,setAttached]=useState<LabContext|null>(null),[attachError,setAttachError]=useState('');
 useEffect(()=>{if(!getContext){setAttached(readLabHandoff());setTurns(readLabHandoffTurns());if(new URLSearchParams(window.location.search).get('lab')==='1')setOpen(true);}},[getContext]);
 return <><button type="button" className={s.launch} onClick={()=>setOpen(true)}>{en?'Calculate with Artin':'بررسی و محاسبه با آرتین'}</button>{!getContext&&<label className={s.attach}>{en?'Attach lab project':'پیوست پروندهٔ آزمایشگاه'}<input type="file" accept=".json" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setAttachError('');try{if(file.size>12*1024*1024)throw Error();const {parseProjectFile}=await import('./project-file'),{captureLabContext}=await import('./lab-chat-bridge');const project=parseProjectFile(await file.text(),file.name,crypto.randomUUID(),new Date().toISOString());setAttached(captureLabContext(project));setTurns([]);setOpen(true);}catch{setAttachError(en?'Invalid project file; current data were retained.':'فایل پرونده معتبر نیست؛ اطلاعات فعلی حفظ شده‌اند.');}}}/></label>}{attachError&&<p role="alert" className={s.error}>{attachError}</p>}{open&&<LabAssistantDialog en={en} getContext={getContext??(()=>attached)} onApply={onApply} main={!getContext} onClose={()=>setOpen(false)} turns={turns} setTurns={setTurns}/>}</>;
}
