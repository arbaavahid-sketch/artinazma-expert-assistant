"use client";
import methodBank from '../method-bank.json';
import {methodName} from '../method-names-en';
import {emptyMethodStudy,type MethodStudy} from './method-study';
import type {MethodStudyHandle} from './MethodStudyForm';
import {useModalDialog} from './use-modal-dialog';
import {emptyDecisionStudy,type DecisionStudy} from './decision-rule';
import {emptyMCStudy,type MCStudy} from './monte-carlo';
import {emptyTopDownStudy,type TopDownStudy} from './top-down';
import {transferIsCurrent,type StudyTransfer} from './study-transfer';
import {emptyControlStudy,type ControlStudy} from './control-study';
import {emptyCalibrationStudy,type CalibrationStudy} from './calibration-study';
import {emptyIntermediateStudy,type IntermediateStudy} from './intermediate-study';
import type {BiasStudy} from './bias-study';
import {emptyPrecisionStudy,type PrecisionStudy} from './precision-study';
import {type Reagent} from './reagents';

import { useMemo, useRef, useState,type ComponentProps } from 'react';
import {deferredSection} from './deferred-section';
import {useTextExport} from './use-text-export';
import {saveProjectJSON,ProjectExportUnavailable} from '@/lib/save-project-file';
import { ArrowUpRight, Atom, BookOpen, ChevronLeft, ChevronRight, ClipboardList, Download, FileCheck2, FlaskConical, FolderOpen, Gauge, ListChecks, Plus, Save, Upload } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type {SolutionDraft} from './chemical-library';
import type {PhysicalRun} from './physical-run';
import {emptyDensity} from './density';
import {emptyWeighing} from './weighing';
import LabWorkbench from './LabWorkbench';
import s from './preview.module.css';
import { MAX_PROJECT_BYTES, parseProjectFile, serializeLabProject, type LabProject, type ProjectIdentity } from './project-file';
import { readGumProject } from '../gum-project';
import { familyModels } from '../family-models';
import { emptyGCData, gcInputKey, type GCRun } from './gc-workflow';

const MethodStudyForm=deferredSection(()=>import('./MethodStudyForm'));
const QuickCalculators=deferredSection(()=>import('../QuickCalculators'));
const DecisionForm=deferredSection(()=>import('./DecisionForm'));
const MonteCarloForm=deferredSection(()=>import('./MonteCarloForm'));
const TopDownForm=deferredSection(()=>import('./TopDownForm'));
const StudyTransferForm=deferredSection(()=>import('./StudyTransferForm'));
const CalibrationStudyForm=deferredSection(()=>import('./CalibrationStudyForm'));
const ControlStudyForm=deferredSection(()=>import('./ControlStudyForm'));
const IntermediateStudyForm=deferredSection(()=>import('./IntermediateStudyForm'));
const BiasStudyForm=deferredSection(()=>import('./BiasStudyForm'));
const PrecisionStudyForm=deferredSection(()=>import('./PrecisionStudyForm'));
const ReagentLibrary=deferredSection(()=>import('./ReagentLibrary'));
const ElementLibrary=deferredSection(()=>import('./ElementLibrary'));
const OccupationalReference=deferredSection(()=>import('./OccupationalReference'));
const ChebiExplorer=deferredSection(()=>import('./ChebiExplorer'));
const ComptoxReference=deferredSection(()=>import('./ComptoxReference'));
const WorkspaceGuide=deferredSection(()=>import('./WorkspaceGuide'));
const ChemicalLibrary=deferredSection(()=>import('./ChemicalLibrary'));
const DensityForm=deferredSection(()=>import('./DensityForm'));
const WeighingForm=deferredSection(()=>import('./WeighingForm'));
const CalibrationSummary=deferredSection<ComponentProps<typeof import('./GCWorkflow')['CalibrationSummary']>>(()=>import('./GCWorkflow').then(module=>({default:module.CalibrationSummary})));
const GCSampleForm=deferredSection<ComponentProps<typeof import('./GCWorkflow')['GCSampleForm']>>(()=>import('./GCWorkflow').then(module=>({default:module.GCSampleForm})));
const GCReview=deferredSection<ComponentProps<typeof import('./GCWorkflow')['GCReview']>>(()=>import('./GCWorkflow').then(module=>({default:module.GCReview})));

type View = 'home' | 'project' | 'materials' | 'validation' | 'advanced' | 'quick';
type Draft = ProjectIdentity;
const stages = [
  ['تعریف آزمون', 'Define test'], ['داده‌ها و مدارک', 'Data & evidence'], ['کالیبراسیون', 'Calibration'], ['عدم‌قطعیت', 'Uncertainty'], ['بازبینی', 'Review'],
];
const documents = [
  ['standard', 'استاندارد مرجع', 'Reference standard', 'غلظت، خلوص و عدم‌قطعیت از گواهی استاندارد.', 'Concentration, purity and uncertainty from its certificate.'],
  ['instrument', 'دادهٔ دستگاه', 'Instrument data', 'غلظت استانداردها و مساحت پیک متناظر، از خروجی دستگاه.', 'Standard concentrations and corresponding peak areas from the instrument.'],
  ['preparation', 'آماده‌سازی نمونه', 'Sample preparation', 'جرم نمونه، حجم نهایی، ضریب رقیق‌سازی و مطالعهٔ بازیابی.', 'Sample mass, final volume, dilution factor and recovery study.'],
  ['precision', 'تکرارپذیری روش', 'Method precision', 'نتایج تکرار مستقل کل روش، مطابق طرح مطالعه.', 'Independent whole-method replicates according to the study design.'],
];

function WorkflowChooser({en,onChoose,onCancel,onQuick}:{en:boolean;onQuick:()=>void;onChoose:(workflow:LabProject['workflow'],methodId?:number)=>void;onCancel:()=>void}){
  const ref=useModalDialog();
  const [methodId,setMethodId]=useState(''),[query,setQuery]=useState('');
  const methods=methodBank.filter(m=>`${m.name} ${methodName(m,true)} ${m.standard_codes.join(' ')} ${m.category}`.toLowerCase().includes(query.trim().toLowerCase()));
  const [selected,setSelected]=useState<LabProject['workflow']>('method-study');
  const t=(fa:string,english:string)=>en?english:fa;
  return <dialog ref={ref} className={s.newSampleDialog} aria-labelledby="workflow-choice-title" onCancel={e=>{e.preventDefault();onCancel();}}><h2 id="workflow-choice-title">{t('پروندهٔ جدید','New project')}</h2><p>{t('نوع فعالیت را انتخاب کنید. هر مسیر، داده‌ها و مدل محاسبهٔ خودش را دارد.','Choose the activity. Each workflow has its own inputs and calculation model.')}</p><fieldset className={s.workflowChoices}><legend>{t('بانک همهٔ آزمون‌ها','All test methods')}</legend><label><input type="radio" name="new-workflow" checked={selected==='method-study'} onChange={()=>setSelected('method-study')}/><span><strong>{t('ساخت پرونده از بانک ۹۸ آزمون','Create a project from the 98-test bank')}</strong><small>{t('روش‌های عددی، کیفی و نمونه‌برداری؛ هرکدام با دامنهٔ مدل خودش.','Numerical, qualitative and sampling methods, each within its model scope.')}</small></span></label><label>{t('جست‌وجوی نام یا استاندارد آزمون','Find a test by name or standard')}<input aria-label={t('جست‌وجوی نام یا استاندارد آزمون','Find a test by name or standard')} maxLength={120} className="ui-input" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>{t('انتخاب آزمون از بانک','Choose a bank test')}<select aria-label={t('انتخاب آزمون از بانک','Choose a bank test')} className="ui-input" value={methods.some(m=>String(m.id)===methodId)?methodId:''} onChange={e=>{setMethodId(e.target.value);setSelected('method-study');}}><option value="" disabled>{t('آزمون را انتخاب کنید','Select a test')}</option>{methods.map(m=><option key={m.id} value={m.id}>{methodName(m,en)} · {m.standard_codes.join(' / ')}</option>)}</select></label><p className={s.muted}>{methods.length} {t('آزمون در نتیجهٔ جست‌وجو؛ مدل پایه به معنی انطباق کامل با استاندارد نیست.','matching tests; a base model does not establish full standard conformity.')}</p></fieldset><details className={s.details}><summary>{t('مسیرهای مرحله‌ای آماده','Ready guided workflows')}</summary><fieldset className={s.workflowChoices}><legend>{t('نوع آزمون یا فعالیت','Test or activity type')}</legend>{([
    ['gc-external-extraction','GC-FID · کالیبراسیون خارجی و استخراج','GC-FID · external calibration and extraction','کالیبراسیون، آماده‌سازی نمونه و بودجهٔ عدم‌قطعیت','Calibration, sample preparation and uncertainty budget'],
    ['weighing','توزین مستقیم','Direct weighing','جرم تصحیح‌شده با کالیبراسیون، تفکیک و تکرارپذیری','Corrected mass with calibration, resolution and repeatability'],
    ['density','چگالی از جرم و حجم','Density from mass and volume','جرم و حجم همان نمونه در شرایط ثبت‌شده','Mass and volume of the same sample at recorded conditions'],
  ] as const).map(([key,fa,english,helpFa,helpEn])=><label key={key}><input type="radio" name="new-workflow" value={key} checked={selected===key} onChange={()=>setSelected(key)}/><span><strong>{t(fa,english)}</strong><small>{t(helpFa,helpEn)}</small></span></label>)}</fieldset></details><button type="button" className={s.secondary} onClick={onQuick}>{t('سایر ابزارها و مدل‌های GUM','Other tools and GUM models')}</button><div><button type="button" className={s.primary} disabled={selected==='method-study'&&!methods.some(m=>String(m.id)===methodId)} onClick={()=>onChoose(selected,selected==='method-study'?Number(methodId):undefined)}>{t('شروع این پرونده','Start this project')}</button><button type="button" className={s.secondary} onClick={onCancel}>{t('انصراف','Cancel')}</button></div></dialog>;
}

function NewSampleDialog({en,title,onSave,onCancel,onCreate}:{en:boolean;title:string;onSave:()=>void;onCancel:()=>void;onCreate:()=>void}){
  const dialog=useModalDialog();
  const t=(fa:string,english:string)=>en?english:fa;
  return <dialog ref={dialog} className={s.newSampleDialog} aria-labelledby="new-sample-title" onCancel={event=>{event.preventDefault();onCancel();}}>
    <h2 id="new-sample-title">{t('ساخت نمونهٔ جدید','Create a new sample')}</h2><p>{t('پروندهٔ فعلی:','Current project:')} <strong>{title}</strong></p>
    <p>{t('با ساخت نمونهٔ جدید، فرم فعلی خالی می‌شود. برای نگهداری اطلاعات این پرونده، ابتدا فایل آن را ذخیره کنید. فایل‌های قبلاً دانلودشده دست‌نخورده می‌مانند.','Creating a new sample clears the current form. Save this project file first to retain its data. Previously downloaded files remain unchanged.')}</p>
    <p className={s.muted}>{t('مسیر انتخاب‌شده با داده‌های خالی باز می‌شود.','The selected workflow opens with empty inputs.')}</p>
    <div><button type="button" className={s.secondary} onClick={onSave}>{t('ذخیرهٔ پروندهٔ فعلی','Save current project')}</button><button type="button" className={s.secondary} onClick={onCancel}>{t('انصراف','Cancel')}</button><button type="button" className={s.primary} onClick={onCreate}>{t('ساخت نمونهٔ جدید','Create new sample')}</button></div>
  </dialog>;
}

export default function LabWorkspace() {
  const { locale } = useI18n();
  const en = locale === 'en';
  const text = (fa: string, english: string) => en ? english : fa;
  const [view, setView] = useState<View>('home');
  const [quickOpened,setQuickOpened]=useState(false);
  function openQuick(){setQuickOpened(true);setView('quick');}
  const [decisionStudy,setDecisionStudy]=useState<DecisionStudy>();
  const [monteCarloStudy,setMonteCarloStudy]=useState<MCStudy>();
  const [advancedSection,setAdvancedSection]=useState<'topDown'|'monteCarlo'|'decision'>('topDown');
  const [topDownStudy,setTopDownStudy]=useState<TopDownStudy>();
  const [validationTransfer,setValidationTransfer]=useState<StudyTransfer>();
  const [precisionStudy,setPrecisionStudy]=useState<PrecisionStudy>();
  const [biasStudy,setBiasStudy]=useState<BiasStudy>();
  const [validationSection,setValidationSection]=useState<'precision'|'bias'|'intermediate'|'calibration'|'control'|'transfer'>('precision');
  const [intermediateStudy,setIntermediateStudy]=useState<IntermediateStudy>();
  const [controlStudy,setControlStudy]=useState<ControlStudy>();
  const [calibrationStudy,setCalibrationStudy]=useState<CalibrationStudy>();
  const [choosing,setChoosing]=useState(false);
  const [guideOpen,setGuideOpen]=useState(false);
  const [stage, setStage] = useState(0);
  const [draft, setDraft] = useState<Draft>({title:'',sample:'',sop:'',edition:'',matrix:''});
  const [evidence, setEvidence] = useState<string[]>([]);
  const [standards, setStandards] = useState([['',''],['',''],['','']]);
  const [openRevision,setOpenRevision]=useState(0);
  const [methodStudy,setMethodStudy]=useState<MethodStudy>();
  const methodRef=useRef<MethodStudyHandle>(null);
  const [physicalRun,setPhysicalRun]=useState<PhysicalRun>();
  const [density,setDensity]=useState(emptyDensity);
  const [weighing,setWeighing]=useState(emptyWeighing);
  const [workflow,setWorkflow]=useState<LabProject['workflow']>('gc-external-extraction');
  const [gcData,setGcData]=useState(emptyGCData);
  const [gcRun,setGcRun]=useState<GCRun>();
  const [runVerified,setRunVerified]=useState(false);
  const [solutionDraft,setSolutionDraft]=useState<SolutionDraft>();
  const [reagents,setReagents]=useState<Reagent[]>([]);
  const [materialSection, setMaterialSection] = useState(0);
  const projectId = useRef<string | null>(null);
  const projectInput=useRef<HTMLInputElement>(null);
  const [legacy, setLegacy] = useState<LabProject['legacy']>();
  const [pending, setPending] = useState<LabProject | null>(null);
  const [pendingAction,setPendingAction]=useState<'open'|'new'>('open');
  const [fileMessage, setFileMessage] = useState<'saved' | 'native-saved' | 'cancelled' | 'unsupported' | 'failed' | 'opened' | 'created' | 'legacy-exported' | ''>('');
  const [fileBusy, setFileBusy] = useState(false);
  const saving=useRef(false);
  const hasDraft = Boolean(methodStudy) || Boolean(decisionStudy) || Boolean(monteCarloStudy) || Boolean(topDownStudy) || Boolean(validationTransfer) || Boolean(controlStudy) || Boolean(calibrationStudy) || Boolean(intermediateStudy) || Boolean(biasStudy) || Boolean(precisionStudy) || reagents.length>0 || Boolean(solutionDraft) || workflow==='density' || workflow==='weighing' || Boolean(legacy) || Boolean(gcRun) || Boolean(gcData.additional?.length) || Object.values(gcData.values).some(Boolean) || Object.values(gcData.uncertainties).some(u=>u.value||u.source||u.divisor||u.kind!=='standard') || gcData.coverage!=='2' || Boolean(gcData.coverageSource) || Object.values(draft).some(Boolean) || evidence.length > 0 || standards.some(row => row.some(Boolean));
  const legacyProject = useMemo(() => legacy ? readGumProject(JSON.parse(legacy.originalText)) : null, [legacy]);
  const legacyNames: Record<string, [string,string]> = { balance:['ترازو · توزین مستقیم','Balance · direct weighing'],density:['چگالی · جرم و حجم','Density · mass and volume'],gc:['GC · بودجهٔ خطی','GC · linear budget'],gcExtraction:['GC-FID · استخراج','GC-FID · extraction'],general:['بودجهٔ عمومی','General uncertainty budget'],standard:['تهیهٔ استاندارد','Standard preparation'],titration:['استانداردسازی تیتراسیون','Titration standardization'],typeA:['تکرارهای اندازه‌گیری','Measurement replicates'] };
  const family = legacyProject?.template.startsWith('family:') ? familyModels[legacyProject.template.slice(7)] : null;
  const legacyTitle = legacyProject ? family ? text(family.fa,family.en) : (legacyNames[legacyProject.template]?.[en?1:0] ?? legacyProject.template) : '';
  const workflowTitle = workflow==='density'?text('چگالی از جرم و حجم','Density from mass and volume'):workflow==='weighing'?text('توزین مستقیم','Direct weighing'):workflow==='method-study'&&methodStudy?methodName(methodBank.find(m=>m.id===methodStudy.methodId)!,en):legacyProject ? legacyTitle : text('GC-FID · کالیبراسیون خارجی و استخراج','GC-FID · External calibration and extraction');

  const textExport=useTextExport(en);
  async function saveProject():Promise<boolean|null> {
    if(saving.current)return null;
    saving.current=true;setFileBusy(true);setFileMessage('');
    try {
      projectId.current ??= crypto.randomUUID();
      const project: LabProject = {format:'artin-lab-project',version:1,id:projectId.current,savedAt:new Date().toISOString(),
        ...(methodStudy?{methodStudy:methodRef.current?.snapshot()??methodStudy}:{}),...(decisionStudy?{decisionStudy}:{}),...(monteCarloStudy?{monteCarloStudy}:{}),...(topDownStudy?{topDownStudy}:{}),...(validationTransfer?{validationTransfer}:{}),...(controlStudy?{controlStudy}:{}),...(calibrationStudy?{calibrationStudy}:{}),...(intermediateStudy?{intermediateStudy}:{}),...(biasStudy?{biasStudy}:{}),...(precisionStudy?{precisionStudy}:{}),...(solutionDraft?{solution:solutionDraft}:{}),...(reagents.length?{reagents}:{}),...(physicalRun&&(workflow==='density'||workflow==='weighing')?{physicalRun}:{}),workflow:legacy?'legacy-gum':workflow,identity:draft,evidence,standards,stage,...(legacy?{legacy}:workflow==='density'?{density}:workflow==='weighing'?{weighing}:workflow==='method-study'?{}:{gc:{data:gcData,...(gcRun?{run:gcRun}:{})}})};
      const result=await saveProjectJSON(serializeLabProject(project),`artin-lab-${project.id}.json`);
      setFileMessage(result==='saved'?'native-saved':result==='cancelled'?'cancelled':'saved');return result==='cancelled'?null:true;
    } catch(error) { setFileMessage(error instanceof ProjectExportUnavailable?'unsupported':'failed');return false; }
    finally{saving.current=false;setFileBusy(false);}
  }
  async function prepareFile(file: File) {
    setFileBusy(true); setFileMessage(''); setPending(null);setPendingAction('open');
    try {
      if(file.size>MAX_PROJECT_BYTES)throw new Error('File too large');
      const project=parseProjectFile(await file.text(),file.name,crypto.randomUUID(),new Date().toISOString());
      setPending(project);
    } catch { setFileMessage('failed'); }
    finally { setFileBusy(false); }
  }
  function prepareNewSample(selected:LabProject['workflow']='gc-external-extraction',methodId?:number){
    setPendingAction('new');
    const project:LabProject={format:'artin-lab-project',version:1,id:crypto.randomUUID(),savedAt:new Date().toISOString(),
      workflow:selected,identity:{title:'',sample:'',sop:'',edition:'',matrix:''},evidence:[],
      standards:[['',''],['',''],['','']],stage:0,...(selected==='density'?{density:emptyDensity()}:selected==='weighing'?{weighing:emptyWeighing()}:selected==='method-study'?{methodStudy:emptyMethodStudy(methodId!)}:{gc:{data:emptyGCData()}})};
    if(hasDraft)setPending(project);else openProjectData(project,'created');
  }
  function openProjectData(project:LabProject,message:'created'|'opened') {
    setMethodStudy(project.methodStudy);setDecisionStudy(project.decisionStudy);setMonteCarloStudy(project.monteCarloStudy);setAdvancedSection(project.decisionStudy?'decision':project.monteCarloStudy?'monteCarlo':'topDown');setTopDownStudy(project.topDownStudy);setValidationTransfer(project.validationTransfer);setControlStudy(project.controlStudy);setCalibrationStudy(project.calibrationStudy);setIntermediateStudy(project.intermediateStudy);setBiasStudy(project.biasStudy);setValidationSection(project.validationTransfer?'transfer':project.controlStudy?'control':project.calibrationStudy?'calibration':project.intermediateStudy?'intermediate':project.biasStudy?'bias':'precision');setPrecisionStudy(project.precisionStudy);setReagents(project.reagents??[]);setSolutionDraft(project.solution);setPhysicalRun(project.physicalRun);setOpenRevision(old=>old+1);setDensity(project.density??emptyDensity());setWorkflow(project.workflow);setWeighing(project.weighing??emptyWeighing());projectId.current=project.id; setDraft(project.identity); setEvidence(project.evidence); setStandards(project.standards);
    setGcData(project.gc?.data??emptyGCData());setGcRun(project.gc?.run);setRunVerified(false);
    setStage(project.stage); setLegacy(project.legacy); setView(project.decisionStudy||project.monteCarloStudy||project.topDownStudy?'advanced':project.validationTransfer||project.controlStudy||project.precisionStudy||project.biasStudy||project.intermediateStudy||project.calibrationStudy?'validation':'project'); setPending(null); setFileMessage(message);
  }
  function openPending(){if(pending)openProjectData(pending,pendingAction==='new'?'created':'opened');}
  const Back = en ? ChevronLeft : ChevronRight;
  const Next = en ? ChevronRight : ChevronLeft;
  const openProject = () => {if(hasDraft)setView('project');else setChoosing(true);};
  const headings = [text('شناسنامهٔ آزمون','Test identity'),text('عددها را از کجا بردارم؟','Where do the values come from?'),text('استانداردهای کالیبراسیون','Calibration standards'),text('از داده تا بودجهٔ عدم‌قطعیت','From data to an uncertainty budget'),text('پرونده در یک نگاه','Project at a glance')];

  return <div className={s.page} dir={en?'ltr':'rtl'}>
    <header className={s.topline}><div className={s.workspaceBrand}><span className={s.brandIcon}><FlaskConical size={22} aria-hidden="true"/></span><div><strong>{text('محیط آزمایشگاه','Laboratory workspace')}</strong><span>{text('پرونده‌ها، محاسبات و منابع علمی','Projects, calculations & scientific references')}</span></div></div><div className={s.topActions}><button type="button" className={s.secondary} onClick={()=>setGuideOpen(true)} aria-label={text('راهنمای استفاده','User guide')} aria-haspopup="dialog"><BookOpen size={16} aria-hidden="true"/>{text('راهنما','Guide')}</button></div></header>
    {guideOpen&&<WorkspaceGuide en={en} onClose={()=>setGuideOpen(false)}/>}
    <nav className={s.navigation} aria-label={text('بخش‌های آزمایشگاه','Laboratory sections')}>
      {([['home',FolderOpen,'میز کار','Workbench'],['project',ClipboardList,'پروندهٔ آزمون','Test project'],['materials',Atom,'مواد و عناصر','Chemicals & elements'],['validation',ListChecks,'صحه‌گذاری و QC','Validation & QC'],['advanced',Gauge,'عدم‌قطعیت پیشرفته','Advanced uncertainty'],['quick',Gauge,'محاسبات سریع','Quick calculations']] as const).map(([key,Icon,fa,english]) => <button key={key} type="button" aria-current={view===key?'page':undefined} onClick={()=>key==='quick'?openQuick():setView(key)}><Icon size={17} aria-hidden="true"/>{text(fa,english)}</button>)}
    </nav>
    <div className={s.fileBar} hidden={view==='home'}><span><FolderOpen size={17} aria-hidden="true"/>{view==='quick'?text('فایل پروندهٔ مرحله‌ای','Guided project file'):text('پروندهٔ شما، روی دستگاه شما','Your project, on your device')}</span><div><button type="button" className={s.secondary} disabled={fileBusy} onClick={()=>setChoosing(true)}><Plus size={15} aria-hidden="true"/>{text('پروندهٔ جدید','New project')}</button><button type="button" className={s.secondary} disabled={fileBusy} onClick={saveProject}><Save size={15} aria-hidden="true"/>{text('ذخیرهٔ فایل پرونده','Save project file')}</button><label className={s.secondary} aria-disabled={fileBusy}><Upload size={15} aria-hidden="true"/>{text('باز کردن پرونده','Open project')}<input ref={projectInput} type="file" className="sr-only" accept=".json,application/json" disabled={fileBusy} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void prepareFile(file);}}/></label></div></div>
    {choosing&&<WorkflowChooser en={en} onQuick={()=>{setChoosing(false);openQuick();}} onCancel={()=>setChoosing(false)} onChoose={(workflow,methodId)=>{setChoosing(false);prepareNewSample(workflow,methodId);}}/>}
    {textExport.notice}
    {fileMessage&&<p role={fileMessage==='failed'||fileMessage==='unsupported'?'alert':'status'} className={s.fileStatus}>{fileMessage==='failed'?text('فایل قابل بازکردن یا ذخیره نیست. قالب، نسخه و اندازهٔ فایل را بررسی کنید؛ اطلاعات فعلی شما حفظ شده است.','Could not open or save this file. Check its format, version and size; your current inputs are unchanged.'):fileMessage==='native-saved'?text('فایل پرونده در محل انتخاب‌شده ذخیره شد.','The project file was saved to the selected destination.'):fileMessage==='cancelled'?text('ذخیره لغو شد؛ برای نگهداری پرونده دوباره ذخیره کنید.','Save cancelled; save again to retain your project.'):fileMessage==='unsupported'?text('این نسخهٔ برنامه ذخیرهٔ فایل پرونده را پشتیبانی نمی‌کند؛ از نسخهٔ وب استفاده کنید یا بستهٔ برنامه را به‌روزرسانی کنید.','This app version does not support project saving; use the web version or update the app package.'):fileMessage==='saved'?text('فایل برای دانلود آماده شد. پس از ذخیره روی دستگاه، می‌توانید دوباره آن را باز کنید.','The file was prepared for download. Once saved to your device, you can open it again.'):fileMessage==='created'?text('پروندهٔ جدید ساخته شد. مشخصات نمونه را وارد کنید؛ ذخیرهٔ فایل برای نگهداری آن لازم است.','New project created. Enter the sample details; save a project file to retain it.'):fileMessage==='legacy-exported'?text('نسخهٔ اصلی پروندهٔ GUM برای دانلود آماده شد.','The original GUM project was prepared for download.'):text('پرونده باز شد. اطلاعات را بررسی کنید؛ نتیجه باید در محیط محاسبه دوباره محاسبه شود.','Project opened. Review its data; results must be recalculated in the calculation workspace.')}</p>}
    {pending&&pendingAction==='new'&&<NewSampleDialog en={en} title={draft.title||legacyTitle||text('پروندهٔ بدون عنوان','Untitled project')} onSave={saveProject} onCancel={()=>setPending(null)} onCreate={openPending}/>}
    {pending&&pendingAction==='open'&&<section className={s.importPreview} aria-label={text('بررسی پرونده قبل از باز کردن','Review project before opening')}><div><span className={s.pending}>{text('آمادهٔ باز کردن','Ready to open')}</span><h2>{pending.identity.title||text('پروندهٔ واردشده','Imported project')}</h2><p>{pending.legacy?text('پروندهٔ GUM قبلی با مؤلفه‌ها، واحدها، هم‌بستگی‌ها و داده‌های اصلی نگهداری می‌شود.','Your existing GUM project is retained with its components, units, correlations and original data.'):text('عنوان، داده‌ها و مرحلهٔ ذخیره‌شده بازیابی می‌شوند.','The project identity, data and saved stage will be restored.')}</p><p>{text('با باز کردن، پیش‌نویس فعلی جایگزین می‌شود. اگر لازم است ابتدا آن را ذخیره کنید.','Opening replaces the current draft. Save it first if you need to keep it.')}</p></div><div><button type="button" className={s.primary} onClick={openPending}>{text('باز کردن این پرونده','Open this project')}</button><button type="button" className={s.secondary} onClick={()=>setPending(null)}>{text('انصراف','Cancel')}</button></div></section>}

    <div hidden={view!=='home'}><LabWorkbench en={en} hasDraft={hasDraft} identity={draft} workflowTitle={workflowTitle} onNew={()=>setChoosing(true)} onOpen={()=>projectInput.current?.click()} onContinue={openProject} onMethod={id=>prepareNewSample('method-study',id)} onSection={section=>section==='quick'?openQuick():setView(section)}/></div>

    {view==='project' && <>
      <header className={s.heading}><div><span className={s.kicker}>{text('پروندهٔ هوشمند آزمون','GUIDED TEST WORKSPACE')}</span><h1>{draft.title||legacyTitle||text('پروندهٔ جدید آزمون','New test project')}</h1><p>{workflowTitle}</p></div><span className={s.status}>{text('قابل ذخیره در فایل','Can be saved to a file')}</span></header>
      {workflow==='method-study'?null:legacyProject&&legacy?<section className={s.formPanel}><div className={s.panelTitle}><FileCheck2 className={s.accent} size={28}/><div><span className={s.smallLabel}>{text('پروندهٔ GUM واردشده','IMPORTED GUM PROJECT')}</span><h2>{legacyTitle}</h2></div></div><p className={s.muted}>{text('محتوای اصلی بدون تبدیل آن به مدل GC نگهداری شده است. در این مرحله، بودجه در محیط جدید ویرایش یا دوباره محاسبه نمی‌شود.','The original content is retained without converting it to a GC model. This stage does not edit or recalculate the imported budget.')}</p><dl className={s.summary}>{[[text('فایل اصلی','Original file'),legacy.fileName],[text('تعداد مؤلفه‌ها','Components'),new Intl.NumberFormat(locale).format(legacyProject.rows.length)],[text('واحد نتیجه','Result unit'),legacyProject.inputs.unit||text('در داده‌های اصلی ثبت شده','Retained in the original data')],[text('جفت هم‌بستگی','Correlation pairs'),new Intl.NumberFormat(locale).format(legacyProject.correlations.length)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className={s.legacyComponents}>{legacyProject.rows.map((row,index)=><div key={index}><strong>{row.name||text(`مؤلفهٔ ${index+1}`,`Component ${index+1}`)}</strong><span><bdi>{row.u||'—'} {row.unit}</bdi></span><small>{row.source||text('منبع وارد نشده','No source entered')}</small></div>)}</div><div className={s.formFooter}><button type="button" className={s.secondary} disabled={textExport.busy} onClick={async()=>{setFileMessage('');await textExport.save(legacy.originalText,'artin-gum-original.json','json');}}><Download size={16}/>{text('دریافت پروندهٔ GUM اصلی','Download original GUM project')}</button><button type="button" onClick={openQuick} className={s.secondary}>{text('باز کردن محیط محاسبه','Open calculation workspace')}<ArrowUpRight size={16}/></button></div></section>:(workflow==='weighing'||workflow==='density')?<><section className={s.identityCard} aria-label={text('شناسنامهٔ آزمون','Test identity')}><h2>{text('شناسنامهٔ آزمون','Test identity')}</h2><div className={s.fields}>{(['title','sample','sop'] as const).map(field=><label key={field}>{text({title:'عنوان پرونده',sample:'شناسهٔ نمونه',sop:'کد روش اجرایی'}[field],{title:'Project title',sample:'Sample ID',sop:'SOP reference'}[field])}<input className="ui-input" value={draft[field]} onChange={e=>setDraft({...draft,[field]:e.target.value})}/></label>)}</div></section>{workflow==='density'?<DensityForm key={openRevision} onRun={setPhysicalRun} data={density} onChange={setDensity} identity={draft} en={en}/>:<WeighingForm key={openRevision} onRun={setPhysicalRun} data={weighing} onChange={setWeighing} identity={draft} en={en}/>}</>:<div className={s.projectGrid}>
        <aside className={s.steps} aria-label={text('مراحل پرونده','Project stages')}><span className={s.smallLabel}>{text('مسیر پرونده','PROJECT WORKFLOW')}</span>{stages.map(([fa,english],index)=><button type="button" key={english} aria-current={stage===index?'step':undefined} onClick={()=>setStage(index)}><span className={s.stepNumber}>{new Intl.NumberFormat(locale).format(index+1)}</span><span>{text(fa,english)}</span>{stage===index&&<span className={s.currentDot}/>}</button>)}<p>{text('پس از ورود استانداردها و داده‌های نمونه، در بازبینی نتیجه و عدم‌قطعیت را محاسبه کنید.','Enter standards and sample data, then calculate the result and uncertainty in Review.')}</p></aside>
        <section className={s.formPanel} aria-label={text('فرم مرحلهٔ انتخاب‌شده','Selected stage form')}>
          <div className={s.panelTitle}><span className={s.cardIcon}>{stage===1?<ListChecks size={22}/>:stage===4?<FileCheck2 size={22}/>:<FlaskConical size={22}/>}</span><div><span className={s.smallLabel}>{text(`مرحلهٔ ${new Intl.NumberFormat('fa').format(stage+1)} از ۵`,`STEP ${stage+1} OF 5`)}</span><h2>{headings[stage]}</h2></div></div>
          {stage===0&&<><p className={s.muted}>{text('مشخصات همین نمونه و روش اجرایی خودتان را ثبت کنید.','Record the details of your sample and actual laboratory procedure.')}</p><div className={s.fields}>{([['title','عنوان پرونده','Project title','مثلاً سنجش نمونهٔ ورودی','e.g. Incoming sample analysis'],['sample','شناسهٔ نمونه','Sample ID','شناسه در دفتر یا سامانهٔ آزمایشگاه','Your laboratory sample identifier'],['matrix','نوع نمونه یا ماتریس','Sample matrix','مثلاً فرآوردهٔ هیدروکربنی','e.g. Hydrocarbon product'],['sop','کد روش اجرایی','SOP reference','کد و بازنگری روش آزمایشگاه','Laboratory SOP code and revision'],['edition','استاندارد و ویرایش استفاده‌شده','Standard and edition used','از نسخهٔ واقعی روش بردارید','Use your actual method document']] as const).map(([key,fa,english,phFa,phEn])=><label key={key}>{text(fa,english)}<input className="ui-input" value={draft[key]} placeholder={text(phFa,phEn)} onChange={event=>setDraft({...draft,[key]:event.target.value})}/></label>)}</div><div className={s.note}><BookOpen size={18}/><p>{text('نام دستگاه به‌تنهایی روش آزمون را تعیین نمی‌کند. مدل باید با ماتریس، آماده‌سازی نمونه و SOP شما تطبیق داده شود.','An instrument name does not define a complete method. Match the model to your matrix, sample preparation and SOP.')}</p></div></>}
          {stage===1&&<><p className={s.muted}>{text('مدارکی را که در اختیار دارید مشخص کنید. علامت‌زدن به معنی تأیید علمی مدرک نیست.','Mark the evidence you have available. A check mark is not scientific approval of that evidence.')}</p><div className={s.evidence}>{documents.map(([key,fa,english,helpFa,helpEn])=><label key={key}><input type="checkbox" checked={evidence.includes(key)} onChange={event=>setEvidence(event.target.checked?[...evidence,key]:evidence.filter(item=>item!==key))}/><span><strong>{text(fa,english)}</strong><small>{text(helpFa,helpEn)}</small></span></label>)}</div></>}
          {stage===2&&<><p className={s.muted}>{text('هر سطر یک استاندارد است: غلظت از گواهی یا تهیهٔ استاندارد، و مساحت پیک از دستگاه.','Each row is one standard: concentration from its certificate or preparation, and peak area from the instrument.')}</p><div className={s.tableFrame}><table><thead><tr><th>#</th><th>{text('غلظت استاندارد','Standard concentration')} <bdi>mg/L</bdi></th><th>{text('مساحت پیک','Peak area')}</th></tr></thead><tbody>{standards.map((row,index)=><tr key={index}><td>{new Intl.NumberFormat(locale).format(index+1)}</td>{row.map((value,col)=><td key={col}><input className="ui-input" inputMode="decimal" dir="ltr" aria-label={text(`${col===0?'غلظت':'مساحت پیک'} استاندارد ${index+1}`,`Standard ${index+1} ${col===0?'concentration':'peak area'}`)} value={value} onChange={event=>{setStandards(standards.map((old,i)=>i===index?old.map((v,j)=>j===col?event.target.value:v):old));setRunVerified(false);}}/></td>)}</tr>)}</tbody></table></div><CalibrationSummary rows={standards} en={en}/><button type="button" className={s.secondary} onClick={()=>setStandards([...standards,['','']])} disabled={standards.length>=20}><Plus size={16}/>{text('افزودن استاندارد','Add standard')}</button><div className={s.note}><Gauge size={18}/><p>{text('غلظت‌ها باید در یک واحد و پاسخ‌ها از همان روش و شرایط دستگاه باشند. عدم‌قطعیت غلظت استانداردها در این برازش ساده لحاظ نمی‌شود.','Use consistent concentration units and responses from the same method and instrument conditions. This simple fit does not include standard concentration uncertainty.')}</p></div></>}
          {stage===3&&<GCSampleForm data={gcData} en={en} onChange={value=>{setGcData(value);setRunVerified(false);}}/>}
          {stage===4&&<GCReview blocked={Boolean(validationTransfer&&!transferIsCurrent(validationTransfer,standards,gcData,draft))} identity={draft} key={gcInputKey(standards,gcData)} rows={standards} data={gcData} run={gcRun} verified={runVerified} en={en} onRun={run=>{setGcRun(run);setRunVerified(true);}}/>}
          <footer className={s.formFooter}><button className={s.secondary} type="button" disabled={stage===0} onClick={()=>setStage(stage-1)}><Back size={16}/>{text('مرحلهٔ قبل','Previous')}</button>{stage<4?<button type="button" className={s.primary} onClick={()=>setStage(stage+1)}>{text('مرحلهٔ بعد','Next stage')}<Next size={16}/></button>:<button type="button" className={s.secondary} onClick={()=>setView('home')}>{text('نمای کلی','Overview')}<Next size={16}/></button>}</footer>
        </section>
      </div>}
    </>}

    {view==='advanced'&&<><nav className={s.navigation} aria-label={text('مسیرهای عدم‌قطعیت پیشرفته','Advanced uncertainty paths')}><button type="button" aria-pressed={advancedSection==='topDown'} onClick={()=>setAdvancedSection('topDown')}>Top-Down</button><button type="button" aria-pressed={advancedSection==='monteCarlo'} onClick={()=>setAdvancedSection('monteCarlo')}>{text('مونت‌کارلو','Monte Carlo')}</button><button type="button" aria-pressed={advancedSection==='decision'} onClick={()=>setAdvancedSection('decision')}>{text('قاعدهٔ تصمیم','Decision rule')}</button></nav>{advancedSection==='decision'?<DecisionForm key={openRevision} en={en} value={decisionStudy??emptyDecisionStudy()} current={gcRun?{identity:draft,rows:standards,data:gcData,run:gcRun}:undefined} verified={runVerified} enabled={workflow==='gc-external-extraction'&&!legacy&&(!validationTransfer||transferIsCurrent(validationTransfer,standards,gcData,draft))} onChange={setDecisionStudy} onSave={saveProject}/>:advancedSection==='topDown'?<TopDownForm key={openRevision} en={en} value={topDownStudy??emptyTopDownStudy()} onChange={setTopDownStudy} onSave={saveProject}/>:<MonteCarloForm key={openRevision} en={en} value={monteCarloStudy??emptyMCStudy()} rows={standards} data={gcData} identity={draft} enabled={workflow==='gc-external-extraction'&&!legacy&&(!validationTransfer||transferIsCurrent(validationTransfer,standards,gcData,draft))} onChange={setMonteCarloStudy} onSave={saveProject}/>}</>}
    {view==='validation'&&<><nav className={s.navigation} aria-label={text('مطالعات صحه‌گذاری','Validation studies')}><button type="button" aria-pressed={validationSection==='precision'} onClick={()=>setValidationSection('precision')}>{text('تکرارپذیری','Repeatability')}</button><button type="button" aria-pressed={validationSection==='bias'} onClick={()=>setValidationSection('bias')}>{text('بایاس نسبت به مرجع','Bias relative to reference')}</button><button type="button" aria-pressed={validationSection==='intermediate'} onClick={()=>setValidationSection('intermediate')}>{text('دقت میانی','Intermediate precision')}</button><button type="button" aria-pressed={validationSection==='calibration'} onClick={()=>setValidationSection('calibration')}>{text('کالیبراسیون خطی','Linear calibration')}</button><button type="button" aria-pressed={validationSection==='control'} onClick={()=>setValidationSection('control')}>{text('کنترل I–MR','I–MR control')}</button><button type="button" aria-pressed={validationSection==='transfer'} onClick={()=>setValidationSection('transfer')}>{text('انتقال به GUM','Transfer to GUM')}</button></nav>{validationSection==='transfer'?<StudyTransferForm identity={draft} key={openRevision} en={en} enabled={workflow==='gc-external-extraction'&&!legacy} sources={{precisionStudy,intermediateStudy,calibrationStudy,biasStudy,controlStudy}} rows={standards} data={gcData} transfer={validationTransfer} onSave={saveProject} onApply={p=>{setStandards(p.rows);setGcData(p.data);setValidationTransfer(p.transfer);setRunVerified(false);setGcRun(undefined);}}/>:validationSection==='precision'?<PrecisionStudyForm key={openRevision} en={en} value={precisionStudy??emptyPrecisionStudy()} onChange={setPrecisionStudy} onSave={saveProject}/>:validationSection==='intermediate'?<IntermediateStudyForm key={openRevision} en={en} value={intermediateStudy??emptyIntermediateStudy()} onChange={setIntermediateStudy} onSave={saveProject}/>:validationSection==='calibration'?<CalibrationStudyForm key={openRevision} en={en} value={calibrationStudy??emptyCalibrationStudy()} onChange={setCalibrationStudy} onSave={saveProject}/>:validationSection==='control'?<ControlStudyForm key={openRevision} en={en} value={controlStudy??emptyControlStudy()} onChange={setControlStudy} onSave={saveProject}/>:<BiasStudyForm key={openRevision} en={en} value={biasStudy} precision={precisionStudy} onChange={setBiasStudy} onSave={saveProject}/>}</>}

    {workflow==='method-study'&&methodStudy&&<div hidden={view!=='project'}><MethodStudyForm key={openRevision} value={methodStudy} onChange={setMethodStudy} identity={draft} onIdentity={setDraft} en={en} projectRef={methodRef}/></div>}
    {quickOpened&&<div hidden={view!=='quick'}><QuickCalculators/></div>}
    {view==='materials'&&<>
      <header className={s.heading}><div><span className={s.kicker}>{text('مرجع کنار محاسبه','REFERENCE MEETS CALCULATION')}</span><h1>{text('مواد و عناصر','Chemicals & elements')}</h1><p>{text('هویت ماده، خواص مستند و اطلاعات محصول مصرفی؛ هرکدام در جای خود.','Chemical identity, sourced properties and your actual reagent details, each in its place.')}</p></div><Atom size={46} className={s.accent}/></header>
      <div className={s.materialLayout}><aside className={s.materialNav}>{[['ترکیبات شیمیایی','Chemical compounds'],['عناصر و ایزوتوپ‌ها','Elements & isotopes'],['بطری‌ها و گواهی‌ها','Reagents & certificates'],['مرجع ChEBI','ChEBI reference'],['مواجههٔ شغلی NIOSH','NIOSH exposure reference'],['مرجع EPA CompTox','EPA CompTox reference']].map(([fa,english],index)=><button key={english} type="button" aria-pressed={materialSection===index} onClick={()=>setMaterialSection(index)}><span className={s.cardIcon}>{index===1?<Atom size={20}/>:index===2?<FileCheck2 size={20}/>:<FlaskConical size={20}/>}</span>{text(fa,english)}<Next size={16}/></button>)}</aside><section className={s.materialPanel}>
        {materialSection===0?<ChemicalLibrary reagents={reagents} key={openRevision} en={en} draft={solutionDraft} onChange={setSolutionDraft} onSave={saveProject}/>:materialSection===1?<ElementLibrary en={en}/>:materialSection===3?<ChebiExplorer en={en}/>:materialSection===4?<OccupationalReference en={en}/>:materialSection===5?<ComptoxReference en={en}/>:<ReagentLibrary en={en} rows={reagents} onChange={setReagents} onSave={saveProject}/>}
      </section></div>
    </>}
    <p className={s.previewNote}>{text('ذخیرهٔ خودکار فعال نیست؛ پیش از بستن صفحه، فایل پرونده را ذخیره کنید. نتیجهٔ ذخیره‌شده پس از باز کردن باید دوباره محاسبه شود.','Autosave is not enabled. Save a project file before closing this page. Recalculate saved results after reopening.')}</p>
  </div>;
}
