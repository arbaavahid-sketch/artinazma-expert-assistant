'use client';
import {useId,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,Atom,BookOpen,ChevronDown,ChevronLeft,ChevronRight,ClipboardList,FileText,FolderOpen,Gauge,ListChecks,Plus,Search} from 'lucide-react';
import bank from '../method-bank.json';
import {methodName} from '../method-names-en';
import {methodProfile,profileCounts} from '../method-profiles';
import {methodGroups,normalizedToolSearch} from '../tool-groups';
import type {ProjectIdentity} from './project-file';
import LaboratoryArtwork from '../LaboratoryArtwork';
import s from './workbench.module.css';

export default function LabWorkbench({en,hasDraft,identity,workflowTitle,onNew,onOpen,onContinue,onMethod,onSection}:{en:boolean;hasDraft:boolean;identity:ProjectIdentity;workflowTitle:string;onNew:()=>void;onOpen:()=>void;onContinue:()=>void;onMethod:(id:number)=>void;onSection:(section:'materials'|'validation'|'advanced'|'quick')=>void}){
 const t=(fa:string,e:string)=>en?e:fa;
 const listId=useId();const [expanded,setExpanded]=useState(false);
 const [query,setQuery]=useState(''),[category,setCategory]=useState(''),[page,setPage]=useState(0);
 const matches=bank.filter(m=>(!category||m.category===category)&&normalizedToolSearch(`${m.name} ${methodName(m,true)} ${m.standard_codes.join(' ')}`).includes(normalizedToolSearch(query)));
 const pages=Math.max(1,Math.ceil(matches.length/7)),current=Math.min(page,pages-1),rows=matches.slice(current*7,current*7+7),Arrow=en?ArrowRight:ArrowLeft;
 const format=(v:number)=>new Intl.NumberFormat(en?'en':'fa').format(v);
 const kinds={numeric:t('مدل پایهٔ عددی','Numeric base model'),qualitative:t('کیفی / رده‌ای','Qualitative / ordinal'),sampling:t('نمونه‌برداری','Sampling'),custom:t('مدل اختصاصی','Custom model')};
 const tools = [
   ['quick', Gauge, t('محاسبات سریع','Quick calculations'), t('تبدیل واحد و محاسبات مستقل','Conversions and independent tools')],
   ['materials', Atom, t('مواد و عناصر','Chemicals & elements'), t('هویت، خواص و منابع ماده','Identity, properties and sources')],
   ['validation', ListChecks, t('صحه‌گذاری و کنترل کیفیت','Validation & QC'), t('مطالعات دقت، بایاس و کالیبراسیون','Precision, bias and calibration')],
   ['advanced', ClipboardList, t('تحلیل عدم‌قطعیت','Uncertainty analysis'), t('مونت‌کارلو و قاعدهٔ تصمیم','Monte Carlo and decision rules')],
 ] as const;
 return <div className={s.workbench}>
  <header className={s.welcome}><div className={s.welcomeContent}><span className={s.eyebrow}>ARTIN · LABORATORY WORKSPACE</span><h1>{t('میز کار آزمایشگاه','Laboratory workbench')}</h1><p>{t('آزمون را انتخاب کنید؛ داده‌ها، محاسبه و گزارش را در همان پرونده پیش ببرید.','Select a method and keep its data, calculations and report together.')}</p><div className={s.welcomeActions}><button onClick={onNew} aria-label={t('پروندهٔ جدید','New project')} className={s.primary} type="button"><Plus size={17} aria-hidden="true"/>{t('شروع آزمون جدید','Start a new test')}</button><button onClick={onOpen} className={s.secondary} type="button"><FolderOpen size={17} aria-hidden="true"/>{t('ادامه از فایل','Continue from a file')}</button></div></div><div className={s.welcomeMedia}><LaboratoryArtwork en={en} requestedMotion/></div></header>
  <div className={s.layout}>
   <section className={s.catalog} aria-label={t('انتخاب روش آزمون','Select a test method')}>
    <div className={s.panelHeading}><div><h2>{t('بانک روش‌های آزمون','Method library')}</h2></div><span className={s.count}>{format(matches.length)} {t('روش','methods')}</span></div>
    <div className={s.filters}><label className={s.search}><Search size={18} aria-hidden="true"/><input aria-label={t('جست‌وجوی روش آزمون','Search test methods')} value={query} maxLength={120} placeholder={t('نام آزمون یا کد استاندارد؛ مثلاً D445','Method or standard, e.g. D445')} onChange={e=>{setQuery(e.target.value);setPage(0);setExpanded(true);}}/></label><select aria-label={t('فیلتر گروه ماده','Filter material group')} value={category} onChange={e=>{setCategory(e.target.value);setPage(0);setExpanded(true);}}><option value="">{t('همهٔ گروه‌ها','All groups')}</option>{methodGroups.map(g=><option key={g.fa} value={g.fa}>{en?g.en:g.fa}</option>)}</select></div>
    <button type="button" className={s.listToggle} aria-expanded={expanded} aria-controls={listId} onClick={()=>setExpanded(!expanded)}>{expanded?t('بستن فهرست آزمون‌ها','Hide method list'):t('مشاهدهٔ فهرست آزمون‌ها','Show method list')}<ChevronDown size={18} style={{transform:expanded?'rotate(180deg)':undefined}} aria-hidden="true"/></button>
    <div id={listId} hidden={!expanded}><div className={s.listHeader} aria-hidden="true"><span>{t('آزمون و مرجع روش','Test and method reference')}</span><span>{t('نوع پرونده','Project type')}</span></div>
    <div className={s.methodList}>{rows.map(method=>{const kind=methodProfile(method).kind;return <button key={method.id} type="button" className={s.method} onClick={()=>onMethod(method.id)} aria-label={`${t('تشکیل پرونده برای','Create project for')} ${methodName(method,en)}`}><span className={s.methodIcon}><FileText size={18} aria-hidden="true"/></span><span className={s.methodName}><strong>{methodName(method,en)}</strong><span><bdi>{method.standard_codes.join(' / ')||t('مرجع در بانک مشخص نشده','Reference not specified')}</bdi><i aria-hidden="true"/> {en?methodGroups.find(g=>g.fa===method.category)?.en??method.category:method.category}</span></span><span className={`${s.kind} ${kind==='numeric'?s.numeric:s.observational}`}>{kinds[kind]}</span><Arrow size={16} className={s.rowArrow} aria-hidden="true"/></button>;})}</div>
    {!rows.length&&<div className={s.noResults}><Search size={24} aria-hidden="true"/><h3>{t('روشی با این مشخصات پیدا نشد','No matching method')}</h3><p>{t('کد استاندارد، نام کوتاه‌تر یا گروه مادهٔ دیگری را امتحان کنید.','Try a standard code, a shorter name or a different group.')}</p><button type="button" className={s.secondary} onClick={()=>{setQuery('');setCategory('');setPage(0);}}>{t('پاک کردن فیلترها','Clear filters')}</button></div>}
    <footer className={s.catalogFooter}><span role="status">{t('صفحهٔ','Page')} {format(current+1)} / {format(pages)}</span><div><button type="button" disabled={current===0} aria-label={t('صفحهٔ قبل روش‌ها','Previous method page')} onClick={()=>setPage(current-1)}>{en?<ChevronLeft size={17}/>:<ChevronRight size={17}/>}</button><button type="button" disabled={current===pages-1} aria-label={t('صفحهٔ بعد روش‌ها','Next method page')} onClick={()=>setPage(current+1)}>{en?<ChevronRight size={17}/>:<ChevronLeft size={17}/>}</button></div></footer>
    </div><p className={s.scope}>{t('مدل پایه باید با SOP، دستگاه و شرایط واقعی آزمون تطبیق داده شود.','Match each base model to the actual SOP, instrument and test conditions.')}</p>
   </section>
   <aside className={s.side}>
    <section className={s.project}><div className={s.projectTop}><span className={s.local}><i/>{t('در این نشست','This session')}</span></div><h2>{t('پروندهٔ جاری','Current project')}</h2>{hasDraft?<><div className={s.projectIdentity}><span><ClipboardList size={22} aria-hidden="true"/></span><h3>{identity.title||t('پروندهٔ بدون عنوان','Untitled project')}</h3></div><dl><div><dt>{t('شناسهٔ نمونه','Sample ID')}</dt><dd>{identity.sample||t('ثبت نشده','Not recorded')}</dd></div><div><dt>{t('مسیر آزمون','Workflow')}</dt><dd>{workflowTitle}</dd></div></dl><button type="button" className={s.projectContinue} onClick={onContinue}>{t('ادامهٔ کار روی پرونده','Continue this project')}<Arrow size={17} aria-hidden="true"/></button></>:<><div className={s.emptyProject}><FolderOpen size={30} strokeWidth={1.3} aria-hidden="true"/><h3>{t('پرونده‌ای باز نشده است','No project is open')}</h3><p>{t('یک روش از بانک انتخاب کنید یا فایل پروندهٔ قبلی را باز کنید.','Choose a method from the library or open an existing project file.')}</p></div><button type="button" className={s.projectContinue} onClick={onOpen}>{t('باز کردن فایل پرونده','Open a project file')}<Arrow size={17} aria-hidden="true"/></button></>}<p className={s.storageNote}>{t('ذخیرهٔ خودکار فعال نیست؛ پیش از خروج فایل پرونده را نگه دارید.','Autosave is off. Save a project file before leaving.')}</p></section>
   </aside>
  </div>
  <section className={s.tools} aria-labelledby="workbench-tools">
    <h2 id="workbench-tools">{t('ابزارهای آزمایشگاه','Lab tools')}</h2>
    <div className={s.toolGrid}>
      {tools.map(([key, Icon, title, description]) => (
        <button key={key} type="button" className={`artin-motion-card ${s.toolTile}`} onClick={() => onSection(key)}>
          <span className={s.resourceIcon}><Icon size={18} aria-hidden="true" /></span>
          <ArrowUpRight size={15} className={s.toolArrow} aria-hidden="true" />
          <strong>{title}</strong>
          <small>{description}</small>
        </button>
      ))}
    </div>
  </section>
  <div className={s.metrics} aria-label={t('دامنهٔ بانک آزمون','Method bank coverage')}>
    {([
      [bank.length, t('روش در بانک','Methods in bank'), BookOpen],
      [profileCounts.numeric, t('مدل پایهٔ عددی','Numeric base models'), Gauge],
      [profileCounts.qualitative, t('آزمون کیفی و رده‌ای','Qualitative methods'), ListChecks],
      [profileCounts.sampling, t('روش نمونه‌برداری','Sampling method'), ClipboardList],
    ] as const).map(([count, label, Icon]) => (
      <div key={label}><Icon size={18} aria-hidden="true" /><strong>{format(count)}</strong><span>{label}</span></div>
    ))}
  </div>
 </div>;
}
