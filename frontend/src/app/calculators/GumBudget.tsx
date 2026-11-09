"use client";

import { useState,useLayoutEffect,useImperativeHandle,type Ref } from "react";
import { apiUrl, customerFetch } from "@/lib/api";
import { gumGuides } from "./gum-guides";
import { gcExtraction, gcInputs, type GCValues } from "./gc-model";
import { familyModels } from "./family-models";
import methodBank from "./method-bank.json";
import GCGraphs from "./GCGraphs";
import { readGumProject, type BudgetRow, type GumProject, type GCGraphData } from "./gum-project";
import SimulationReport, { type SimulationResult } from "./SimulationReport";
import MethodReadiness from "./MethodReadiness";
import { methodProfile, profileCounts } from "./method-profiles";
import { budgetCsv } from "./budget-export";
import ResultLimits from "./ResultLimits";
import {compareLimits,limitMessage,outsideLimits} from "./result-limits";
import {measurementRegistry} from "./registered-models";
import {modelGuidesEn} from "./model-guides-en";
import {methodName,methodUnit} from "./method-names-en";
import {componentNames,generatedSourceText} from "./component-labels";
import {methodGroups,normalizedToolSearch} from './tool-groups';
import {ShieldCheck} from 'lucide-react';

type Row = BudgetRow;

const emptyRow = (): Row => ({ name: "", source: "", unit: "", u: "", c: "1", kind: "standard", divisor: "2" });
const controls = "ui-input min-w-0";

export type GumBudgetHandle={snapshot:()=>GumProject|undefined;request:()=>Record<string,unknown>|null; result:()=>{measured:number;standard:number;expanded:number;coverage:number;unit:string;engine:string;engineVersion:string;rows:{name:string;source:string;unit:string;u:number;c:number}[]}|undefined};

export default function GumBudget({ en, parseNumber, onCalculated,initialProject,lockedMethodId,projectRef }: {
  initialProject?:GumProject;lockedMethodId?:number;projectRef?:Ref<GumBudgetHandle>;
  en: boolean;
  parseNumber: (value: string) => number;
  onCalculated?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [result, setResult] = useState("");
  const [model, setModel] = useState("");
  const [gcTemplate, setGcTemplate] = useState(false);
  const [template, setTemplate] = useState("choose");
  const [mass, setMass] = useState("");
  const [volume, setVolume] = useState("");
  const [purity, setPurity] = useState("");
  const [expansion, setExpansion] = useState("");
  const [molarMass, setMolarMass] = useState("");
  const [gcData, setGcData] = useState<Record<string, string>>({});
  const [familyData, setFamilyData] = useState<string[]>([]);
  const [methodId, setMethodId] = useState(lockedMethodId===undefined?"":String(lockedMethodId));
  const [activeMethodId, setActiveMethodId] = useState("");
  const [methodRevision, setMethodRevision] = useState("");
  const [methodEdition, setMethodEdition] = useState("");
  const [resultMinimum,setResultMinimum]=useState("");
  const [resultMaximum,setResultMaximum]=useState("");
  const [methodQuery, setMethodQuery] = useState("");
  const [methodCategory,setMethodCategory]=useState('');
  const [projectStatus, setProjectStatus] = useState("");
  const [graphs, setGraphs] = useState<GCGraphData>({ standards: "", chromatogram: "" });
  const [graphKey, setGraphKey] = useState(0);
  const selectedMethod = methodBank.find(method => String(method.id) === methodId);
  const activeMethod = methodBank.find(method => String(method.id) === activeMethodId);
  const filteredMethods=methodBank.filter(method=>(!methodCategory||method.category===methodCategory)&&normalizedToolSearch(`${method.name} ${methodName(method,true)} ${method.standard_codes.join(' ')}`).includes(normalizedToolSearch(methodQuery)));
  const family = familyModels[template.replace("family:", "")];
  const familyResult = family?.evaluate(family.inputs.map((_, index) => parseNumber(familyData[index] ?? "")));
  const gcModel = gcExtraction(Object.fromEntries(gcInputs.map(input => [input.key, parseNumber(gcData[input.key] ?? "")])) as GCValues);
  const [unit, setUnit] = useState("");
  const [coverage, setCoverage] = useState("2");
  const [coverageMode,setCoverageMode]=useState('manual');
  const [coverageProbability,setCoverageProbability]=useState('0.95');
  const [simulate, setSimulate] = useState(false);
  const [simulationSamples, setSimulationSamples] = useState("20000");
  const [simulationSeed, setSimulationSeed] = useState("12345");
  const [simulationProbability, setSimulationProbability] = useState("0.95");
  const [submitted, setSubmitted] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [correlations, setCorrelations] = useState<{ first: number; second: number; coefficient: string }[]>([]);
  const [serverResult, setServerResult] = useState<{
    standard_uncertainty: number; expanded_uncertainty: number;
    engine: string; engine_version: string;
    coverage?: number; coverage_method?: string; coverage_probability?: number;
    effective_degrees_of_freedom?: number|null; coverage_t_degrees?: number|null;
    components: { variance_percent: number | null }[];
    simulation?: SimulationResult;
  } | null>(null);
  const density = template === "density";
  const solution = template === "standard";
  const titration = template === "titration";
  const extraction = template === "gcExtraction";
  const guide = gumGuides[template];
  const m = parseNumber(mass);
  const v = parseNumber(volume);
  const p = parseNumber(purity);
  const beta = parseNumber(expansion);
  const molar = parseNumber(molarMass);
  const y = familyResult ? familyResult.value : extraction ? gcModel.concentration : titration ? 10 * m * p / (molar * v) : solution ? 10 * m * p / v : density ? m / v : parseNumber(result);
  const baseModel = family && measurementRegistry[template.slice(7)]
    ? {kind:template.slice(7),nominals:family.inputs.map((_,index)=>parseNumber(familyData[index]??""))}
    : density ? {kind:"density",nominals:[m,v]}
    : extraction ? {kind:"gcExtraction",nominals:gcInputs.map(input=>parseNumber(gcData[input.key]??""))}
    : solution ? {kind:"standardPreparation",nominals:[m,p,v,0,0,beta]}
    : titration ? {kind:"naohStandardization",nominals:[m,p,molar,v,0,0,0]}
    : template==='balance'||template==='typeA' ? {kind:template,nominals:[parseNumber(result)]}:null;
  const solutionSensitivities = [10 * p / v, 10 * m / v, -y / v, -y * beta, -y / v];
  const names=componentNames(template,family,en);
  const baseCount=names.length;
  const definition=baseModel?measurementRegistry[baseModel.kind]:undefined;
  const physicalCount=definition?(definition.uncertain_indices?.length??definition.input_count):0;
  const registeredModel=baseModel?{...baseModel,...(rows.length>baseCount?{additional_targets:rows.slice(baseCount).map(row=>row.target??-1)}:{})}:null;
  const displayRows=rows.map((row,index)=>({...row,name:template==='general'?row.name:names[index]??row.name,source:generatedSourceText(row.source,en),unit:template!=='general'&&index>=baseCount
    ? ((row.target??-1)<0?unit:methodUnit(rows[row.target!]?.unit??'',en)):methodUnit(row.unit,en)}));
  const baseEffectiveRows = displayRows.map((row, index) => index>=baseCount && template!=='general'?row:density && index < 2
    ? { ...row, c: String(index === 0 ? 1 / v : -m / v ** 2) }
    : solution ? { ...row, c: String(solutionSensitivities[index]) }
    : titration ? { ...row, c: String([y / m, y / p, -y / molar, -y / 100, -y / 100, y / 100][index]) }
    : extraction ? { ...row, c: String(gcModel.sensitivities[index]) }
    : familyResult ? { ...row, c: String(familyResult.sensitivities[index] ?? 1) } : row);
  const effectiveRows=baseEffectiveRows.map((row,index)=>template!=='general'&&index>=baseCount
    ? {...row,c:(row.target??-1)<0?'1':baseEffectiveRows[row.target!]?.c??'NaN'}:row);
  const requestedCoverage=coverageMode==='automatic'?2:parseNumber(coverage);
  const k = serverResult?.coverage ?? requestedCoverage;
  const standardValues = rows.map(row => {
    const divisor = row.kind === "certificate" ? parseNumber(row.divisor) :
      row.kind === "rectangular" ? Math.sqrt(3) : row.kind === "triangular" ? Math.sqrt(6) :
      row.kind === "resolution" ? Math.sqrt(12) : row.kind === "repeatability" ? Math.sqrt(parseNumber(row.divisor)) : 1;
    return divisor > 0 && Number.isFinite(divisor) ? parseNumber(row.u) / divisor : NaN;
  });
  const contributions = effectiveRows.map((row, index) => standardValues[index] * parseNumber(row.c));
  const localCombined = contributions.reduce((total, value) => Math.hypot(total, value), 0);
  const combined = serverResult?.standard_uncertainty ?? localCombined;
  const expanded = serverResult?.expanded_uncertainty ?? k * localCombined;
  const measurementErrors: string[] = [];
  if (solution || titration) {
    if (!Number.isFinite(m) || m <= 0) measurementErrors.push(en
      ? `Enter a positive ${solution ? "weighed mass in mg" : "net KHP mass in g"}.`
      : solution ? "جرم توزین‌شده را به mg و بزرگ‌تر از صفر وارد کنید." : "جرم خالص KHP را به g و بزرگ‌تر از صفر وارد کنید.");
    if (!Number.isFinite(v) || v <= 0) measurementErrors.push(en
      ? `Enter a positive ${solution ? "final solution volume" : "NaOH titration volume"} in mL.`
      : solution ? "حجم نهایی محلول را به mL و بزرگ‌تر از صفر وارد کنید." : "حجم مصرفی NaOH را به mL و بزرگ‌تر از صفر وارد کنید.");
    if (!Number.isFinite(p) || p <= 0 || p > 100) measurementErrors.push(en
      ? "Enter purity as a percentage greater than 0 and no more than 100 (e.g. 99.99)."
      : "خلوص را به درصد، بیشتر از صفر و حداکثر ۱۰۰ وارد کنید؛ مثلاً ۹۹٫۹۹.");
    if (solution && (!Number.isFinite(beta) || beta < 0)) measurementErrors.push(en
      ? "Enter a non-negative liquid volume expansion coefficient in 1/°C."
      : "ضریب انبساط حجمی محلول را با واحد 1/°C و نامنفی وارد کنید.");
    if (titration && (!Number.isFinite(molar) || molar <= 0)) measurementErrors.push(en
      ? "Enter a positive KHP molar mass in g/mol."
      : "جرم مولی KHP را به g/mol و بزرگ‌تر از صفر وارد کنید.");
  }
  if (family) {
    if(!family.unit&&!unit.trim())measurementErrors.push(en?"Enter the result unit used by your method.":"واحد نتیجه را مطابق روش آزمون وارد کنید.");
    family.inputs.forEach((input,index)=>{
      if(!Number.isFinite(parseNumber(familyData[index]??""))) measurementErrors.push(en
        ? `Enter a numeric value for ${input.en} (${input.unit || unit}).`
        : `برای «${input.fa}» مقدار عددی با واحد ${input.unit || unit || "روش آزمون"} وارد کنید.`);
    });
    if(!measurementErrors.length && familyResult && !familyResult.valid) measurementErrors.push(en
      ? "These values are outside this equation's physical domain. Check positive denominators, non-negative quantities and the stated method conditions."
      : "این مقادیر خارج از دامنهٔ فیزیکی رابطه‌اند. مخرج‌های مثبت، مقادیر نامنفی و شرایط بیان‌شدهٔ روش را بررسی کنید.");
  }
  displayRows.forEach((row,index)=>{
    const label=row.name.trim() || (en?`Component ${index+1}`:`مؤلفهٔ ${index+1}`);
    if(!row.name.trim())measurementErrors.push(en?`Enter a name for component ${index+1}.`:`نام مؤلفهٔ ${index+1} را وارد کنید.`);
    if(!Number.isFinite(parseNumber(row.u))||parseNumber(row.u)<0)measurementErrors.push(en?`${label}: enter a finite, non-negative uncertainty or bound.`:`${label}: مقدار عدم‌قطعیت یا حد اثر را عددی و نامنفی وارد کنید.`);
    if(row.kind==='certificate'&&(!Number.isFinite(parseNumber(row.divisor))||parseNumber(row.divisor)<=0))measurementErrors.push(en?`${label}: certificate k must be positive.`:`${label}: ضریب پوشش گواهی باید مثبت باشد.`);
    if(row.kind==='repeatability'&&(!Number.isSafeInteger(parseNumber(row.divisor))||parseNumber(row.divisor)<1))measurementErrors.push(en?`${label}: n must be a positive whole number.`:`${label}: تعداد تکرار n باید عدد صحیح مثبت باشد.`);
    if(coverageMode==='automatic'&&contributions[index]!==0){
      const value=parseNumber(row.dfValue??'');
      if(!row.dfMode||row.dfMode==='unknown')measurementErrors.push(en?`${label}: choose the source of degrees of freedom.`:`${label}: مبنای تعیین درجهٔ آزادی را انتخاب کنید.`);
      if(row.dfMode==='finite'&&(!Number.isFinite(value)||value<1||value>1e9))measurementErrors.push(en?`${label}: enter degrees of freedom from 1 to 1,000,000,000.`:`${label}: درجهٔ آزادی را از ۱ تا یک میلیارد وارد کنید.`);
      if(row.dfMode==='study'&&(row.kind!=='repeatability'||!Number.isSafeInteger(value)||value<2||value>1000000))measurementErrors.push(en?`${label}: enter 2–1,000,000 readings used to estimate s; this option requires a repeatability component.`:`${label}: تعداد قرائت‌های مطالعهٔ برآورد s باید عدد صحیح ۲ تا یک میلیون باشد؛ این انتخاب مخصوص مؤلفهٔ تکرارپذیری است.`);
    }
  });
  if(coverageMode==='automatic'&&correlations.some(pair=>parseNumber(pair.coefficient)!==0))measurementErrors.push(en?'Automatic coverage currently requires independent components. Use manual k for a correlated budget.':'پوشش خودکار فعلاً به مؤلفه‌های مستقل نیاز دارد. برای بودجهٔ هم‌بسته از k دستی استفاده کنید.');
  if(coverageMode==='automatic'&&localCombined===0)measurementErrors.push(en?'Automatic coverage needs a nonzero combined uncertainty.':'برای تعیین پوشش خودکار، عدم‌قطعیت ترکیبی باید غیرصفر باشد.');
  const valid = measurementErrors.length===0 && Number.isFinite(y) && Number.isFinite(k) && k > 0 && Number.isFinite(expanded) &&
    (!family || Boolean(family.unit || unit.trim())) &&
    (!density || (m > 0 && v > 0)) &&
    (!solution || (m > 0 && v > 0 && p > 0 && p <= 100 && beta >= 0 && Number.isFinite(beta))) &&
    (!titration || (m > 0 && v > 0 && p > 0 && p <= 100 && molar > 0 && Number.isFinite(molar))) &&
    (!extraction || gcModel.valid) &&
    (!simulate || (Number.isInteger(parseNumber(simulationSamples)) && parseNumber(simulationSamples) >= 5000 &&
      parseNumber(simulationSamples) <= 50000 && Number.isInteger(parseNumber(simulationSeed)) &&
      parseNumber(simulationSeed) >= 0 && parseNumber(simulationSeed) <= 4294967295)) &&
    (!familyResult || (familyResult.valid && familyData.length >= family!.inputs.length &&
      family!.inputs.every((_, index) => Number.isFinite(parseNumber(familyData[index] ?? ""))))) &&
    rows.every(row => row.name.trim() && parseNumber(row.u) >= 0 &&
      (row.kind !== "repeatability" || (Number.isSafeInteger(parseNumber(row.divisor)) && parseNumber(row.divisor) >= 1))) &&
    correlations.every(pair => pair.first !== pair.second && Number.isFinite(parseNumber(pair.coefficient)) &&
      Math.abs(parseNumber(pair.coefficient)) <= 1);
  const format = (value: number) => String(Number(value.toPrecision(7)));
  const report = `${format(y)} ± ${format(expanded)} ${unit.trim()} (k = ${format(k)})`;
  const limitStatus=compareLimits(submitted&&serverResult?y:NaN,resultMinimum,resultMaximum,parseNumber);
  const limitFailed=outsideLimits(limitStatus);
  const nominalInputs: (string|number)[][] = family
    ? family.inputs.map((input,index)=>[en?input.en:input.fa,parseNumber(familyData[index]??""),input.unit||unit])
    : extraction ? gcInputs.map((input,index)=>[en?input.en:input.fa,parseNumber(gcData[input.key]??""),rows[index]?.unit??""])
    : density||solution||titration ? [
      [en?"Mass":"جرم",m,solution?"mg":"g"],[en?"Volume":"حجم",v,"mL"],
      ...(solution||titration?[[en?"Purity":"خلوص",p,"%"]]:[]),
      ...(solution?[[en?"Volume expansion":"انبساط حجمی",beta,"1/°C"]]:[]),
      ...(titration?[[en?"KHP molar mass":"جرم مولی KHP",molar,"g/mol"]]:[]),
    ]:[];
  const fields = en ? ["Component", "Source", "Input unit", "Uncertainty value or bound", "Sensitivity cᵢ"] :
    ["مؤلفه", "منبع داده", "واحد ورودی", "مقدار عدم‌قطعیت یا حد اثر", "ضریب حساسیت cᵢ"];
  const keys = ["name", "source", "unit", "u", "c"] as const;

  function loadGCFid() {
    const names = en ? ["Calibration fit", "Reference and standards", "Method precision", "Sample preparation", "Recovery or bias"] :
      ["برازش کالیبراسیون", "مادهٔ مرجع و تهیهٔ استاندارد", "دقت روش", "آماده‌سازی نمونه", "بازیابی یا بایاس"];
    setRows(names.map(name => ({ ...emptyRow(), name })));
    setModel("C = ((A − b) / a) × F");
    setGcTemplate(true);
    setSubmitted(false);
    setServerResult(null);
    setCorrelations([]);
  }

  function selectTemplate(value: string) {
    setTemplate(value);
    setActiveMethodId(lockedMethodId===undefined?"":String(lockedMethodId)); setMethodRevision(""); setMethodEdition("");
    setSubmitted(false);
    setServerResult(null);
    setServerError("");
    setCorrelations([]);
    setResult("");
    setMass("");
    setVolume("");
    setPurity("");
    setExpansion("");
    setMolarMass("");
    setGcData({});
    setFamilyData([]);
    setGraphs({ standards: "", chromatogram: "" }); setGraphKey(previous => previous + 1);
    setGcTemplate(false);
    setCoverage("2");
    setResultMinimum("");setResultMaximum("");
    if (value === "gc") { loadGCFid(); setUnit(""); return; }
    const selectedFamily = familyModels[value.replace("family:", "")];
    if (selectedFamily) {
      setRows([...selectedFamily.inputs.map(input => ({ ...emptyRow(), name: en ? input.en : input.fa, unit: input.unit })),
        { ...emptyRow(), name: en ? "Method precision in result units" : "دقت روش در واحد نتیجه", unit: selectedFamily.unit },
        { ...emptyRow(), name: en ? "Other independent effects in result units" : "سایر اثرهای مستقل در واحد نتیجه", unit: selectedFamily.unit }]);
      setUnit(selectedFamily.unit); setModel(selectedFamily.formula);
    } else if (value === "gcExtraction") {
      const units = ["area", "area/(mg/L)", "area", "mL", "1", "g", "%"];
      setRows(gcInputs.map((input, index) => ({ ...emptyRow(), name: en ? input.en : input.fa, unit: units[index] })));
      setUnit("mg/kg");
      setModel("w = ((A − b) / a) × V(mL) × D / (m(g) × R(%)/100)");
    } else if (value === "titration") {
      const names = en ? ["Net mass standard uncertainty", "KHP purity limit", "KHP molar mass uncertainty", "Relative burette volume limit", "Relative temperature contribution", "Relative whole-method repeatability"] :
        ["عدم‌قطعیت استاندارد جرم خالص", "حد تغییر خلوص KHP", "عدم‌قطعیت جرم مولی KHP", "حد نسبی حجم بورت", "سهم نسبی دما", "تکرارپذیری نسبی کل تیتراسیون"];
      const kinds = ["standard", "rectangular", "standard", "triangular", "standard", "standard"];
      const units = ["g", "%", "g/mol", "%", "%", "%"];
      setRows(names.map((name, index) => ({ ...emptyRow(), name, kind: kinds[index], unit: units[index] })));
      setUnit("mol/L"); setModel("C(NaOH) = 1000 × m(KHP) × P(%) / (100 × M(KHP) × V)");
    } else if (value === "standard") {
      const names = en ? ["Mass uncertainty", "Purity limit", "Flask volume limit", "Temperature variation", "Filling repeatability"] :
        ["عدم‌قطعیت جرم توزین", "حد تغییر خلوص", "حد خطای حجم بالن", "تغییر دمای آزمایشگاه", "تکرارپذیری پرکردن بالن"];
      const kinds = ["standard", "rectangular", "triangular", "rectangular", "standard"];
      const units = ["mg", "%", "mL", "°C", "mL"];
      setRows(names.map((name, index) => ({ ...emptyRow(), name, kind: kinds[index], unit: units[index] })));
      setUnit("mg/L");
      setModel("C = 1000 × m(mg) × P(%) / (100 × V(mL)); ∂C/∂T = −Cβ");
    } else if (value === "balance" || value === "typeA") {
      const names = en ? ["Repeatability", "Calibration certificate", "Display increment", "Drift limit", "Temperature effect limit"] :
        ["پراکندگی توزین‌های تکراری", "گواهی کالیبراسیون", "گام نمایش ترازو", "حد اثر رانش", "حد اثر دما"];
      const kinds = ["repeatability", "certificate", "resolution", "rectangular", "rectangular"];
      setRows(names.slice(0, value === "typeA" ? 1 : 5).map((name, index) => ({
        ...emptyRow(), name: value === "typeA" ? (en ? "Standard deviation of repeated readings" : "انحراف معیار قرائت‌های تکراری") : name,
        kind: kinds[index], divisor: index === 0 ? "1" : "2", unit: value === "typeA" ? "" : "g",
      })));
      setUnit(value === "typeA" ? "" : "g");
      setModel(value === "typeA" ? "u(mean) = s / √n" : "m = I + corrections; cᵢ = 1");
    } else if (value === "density") {
      setRows((en ? ["Mass uncertainty", "Volume uncertainty"] : ["عدم‌قطعیت جرم نمونه", "عدم‌قطعیت حجم نمونه"])
        .map((name, index) => ({ ...emptyRow(), name, unit: index === 0 ? "g" : "mL" })));
      setUnit("g/mL");
      setModel("ρ = m / V; c_m = 1/V; c_V = −m/V²");
    } else {
      setRows([emptyRow()]); setUnit(""); setModel("");
    }
  }

  function snapshotProject():GumProject {
    return {
      format: "artin-gum", version: 1, savedAt: new Date().toISOString(), template, rows,
      inputs: { result, model, mass, volume, purity, expansion, molarMass, unit, coverage, coverageMode, coverageProbability, activeMethodId, methodRevision, methodEdition, resultMinimum, resultMaximum,
        simulate: String(simulate), simulationSamples, simulationSeed, simulationProbability },
      gcData, familyData, correlations, graphs,
    } as GumProject;
  }
  function buildRequest(){return {
          measured: y, coverage: requestedCoverage,coverage_mode:coverageMode,coverage_probability:Number(coverageProbability),
          ...(registeredModel?{measurement_model:registeredModel}:{}),
          ...(simulate ? { simulation: { samples: parseNumber(simulationSamples), seed: parseNumber(simulationSeed),
            probability: Number(simulationProbability) } } : {}),
          correlations: correlations.map(pair => ({ ...pair, coefficient: parseNumber(pair.coefficient) })),
          components: effectiveRows.map(row => ({
            name: row.name.trim(), value: parseNumber(row.u), sensitivity: parseNumber(row.c),
            kind: row.kind, certificate_k: row.kind === "certificate" ? parseNumber(row.divisor) : 2,
            repetitions: row.kind === "repeatability" ? parseNumber(row.divisor) : 1,
            ...(coverageMode==='automatic'?row.dfMode==='finite'?{degrees_of_freedom:parseNumber(row.dfValue??'')}:row.dfMode==='infinite'?{infinite_degrees:true}:row.dfMode==='study'?{study_count:parseNumber(row.dfValue??'')}:{ }:{}),
          })),
        };}
  useImperativeHandle(projectRef,()=>({request:()=>valid?buildRequest():null,snapshot:()=>template==='choose'?undefined:snapshotProject(),result:()=>submitted&&serverResult&&valid?{measured:y,standard:serverResult.standard_uncertainty,expanded:serverResult.expanded_uncertainty,coverage:k,unit,engine:serverResult.engine,engineVersion:serverResult.engine_version,rows:effectiveRows.map((r,i)=>({name:r.name,source:r.source,unit:r.unit,u:standardValues[i],c:parseNumber(r.c)}))}:undefined}));
  // Restore once before paint; later parent edits must not overwrite a live budget.
  useLayoutEffect(()=>{if(initialProject)applyProject(readGumProject(initialProject));},[]); // eslint-disable-line react-hooks/exhaustive-deps

  function saveProject() {
    const project=snapshotProject();
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "artin-gum-project.json";
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setProjectStatus(en ? "Project file prepared." : "فایل پرونده آماده شد.");
  }

  function applyProject(project:GumProject){
    if(lockedMethodId!==undefined){const method=methodBank.find(m=>m.id===lockedMethodId)!;if(project.template!=='general'&&!methodProfile(method).models.some(key=>project.template===`family:${key}`))throw Error('Method/model mismatch');if(project.inputs.activeMethodId&&project.inputs.activeMethodId!==String(lockedMethodId))throw Error('Method identity mismatch');}
      selectTemplate(project.template);
      setRows(previous => project.template === "general" ? project.rows : [...previous.map((row, index) => ({
        ...row, u: project.rows[index].u, source: project.rows[index].source,
        kind: project.rows[index].kind, divisor: project.rows[index].divisor,
        dfMode:project.rows[index].dfMode,dfValue:project.rows[index].dfValue,
        ...(project.template === "gc" ? { unit: project.rows[index].unit } : {}),
      })),...project.rows.slice(previous.length)]);
      const input = project.inputs;
      setResult(input.result ?? ""); setMass(input.mass ?? ""); setVolume(input.volume ?? "");
      setPurity(input.purity ?? ""); setExpansion(input.expansion ?? ""); setMolarMass(input.molarMass ?? "");
      setCoverage(input.coverage ?? "2");
      setCoverageMode(input.coverageMode==='automatic'?'automatic':'manual');
      setCoverageProbability(['0.9','0.95','0.99'].includes(input.coverageProbability)?input.coverageProbability:'0.95');
      setResultMinimum(input.resultMinimum??"");setResultMaximum(input.resultMaximum??"");
      setSimulate(input.simulate === "true"); setSimulationSamples(input.simulationSamples ?? "20000");
      setSimulationSeed(input.simulationSeed ?? "12345");
      setSimulationProbability(["0.9", "0.95", "0.99"].includes(input.simulationProbability) ? input.simulationProbability : "0.95");
      if (["general", "gc", "typeA"].includes(project.template) || familyModels[project.template.slice(7)]?.unit === "") {
        setUnit(input.unit ?? "");
        const loadedFamily=familyModels[project.template.slice(7)];
        if(loadedFamily && !loadedFamily.unit) setRows(previous=>previous.map((row,index)=>
          index>=loadedFamily.inputs.length || !loadedFamily.inputs[index].unit ? {...row,unit:input.unit??""}:row));
        if(project.template === "typeA") setRows(previous=>previous.map(row=>({...row,unit:input.unit??""})));
      }
      if (project.template === "general") setModel(input.model ?? "");
      setGcData(project.gcData); setFamilyData(project.familyData); setCorrelations(project.correlations);
      setGraphs(project.graphs ?? { standards: "", chromatogram: "" });
      const method = methodBank.find(item => String(item.id) === input.activeMethodId);
      if (method && (project.template === "general" || methodProfile(method).models.some(key=>project.template===`family:${key}`))) {
        setActiveMethodId(String(method.id)); setMethodId(String(method.id)); setMethodRevision(input.methodRevision ?? ""); setMethodEdition(input.methodEdition ?? "");
      }
  }

  async function loadProject(file: File) {
    setProjectStatus("");
    try {
      if (file.size > 4_000_000) throw new Error("Project too large");
      const project = readGumProject(JSON.parse(await file.text()));
      applyProject(project);
      setProjectStatus(en ? "Project loaded. Recalculate to verify its result." : "پرونده باز شد. برای بررسی نتیجه دوباره محاسبه بزنید.");
    } catch {
      setProjectStatus(en ? "The file is not a supported GUM project. Current data were kept." : "فایل، پروندهٔ معتبر GUM نیست. داده‌های فعلی حفظ شدند.");
    }
  }

  async function calculate() {
    setSubmitted(true);
    setCopyStatus("");
    setServerError("");
    setServerResult(null);
    if (!valid) return;
    setBusy(true);
    try {
      const response = await customerFetch(apiUrl("/uncertainty/budget"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify(buildRequest()),
      });
      if (response.status === 422) {
        const error = await response.json();
        if (error.detail === "Monte Carlo supports correlations only between normal inputs") {
          setServerError(en ? "Monte Carlo currently supports correlations only between normal inputs. Rectangular and triangular inputs must be independent."
            : "مونت‌کارلو فعلاً هم‌بستگی بین ورودی‌های نرمال را پشتیبانی می‌کند. ورودی‌های مستطیلی و مثلثی باید مستقل باشند.");
          return;
        }
        if (error.detail === "Simulation crossed a nonpositive physical input") {
          setServerError(en ? "Some sampled physical inputs reached zero or became negative. Review the uncertainty and input distributions."
            : "بعضی ورودی‌های فیزیکی در نمونه‌گیری صفر یا منفی شدند. مقدار عدم‌قطعیت و نوع توزیع ورودی‌ها را بررسی کنید.");
          return;
        }
        if(error.detail==='Simulation crossed the registered model domain'){
          setServerError(en?'Some sampled inputs crossed the equation domain (for example, a non-positive denominator, an invalid VI lookup range or an invalid composition). Review distributions and uncertainty sizes. Samples were not silently discarded.'
            :'بعضی نمونه‌ها از دامنهٔ معادله خارج شدند؛ مثلاً مخرج نامثبت، محدودهٔ نامعتبر جدول VI یا ترکیب نامعتبر. توزیع‌ها و عدم‌قطعیت‌ها را بررسی کنید. نمونه‌های نامعتبر بی‌صدا حذف نشده‌اند.');return;
        }
        setServerError(en ? "Check the components and correlations. The correlation pairs must be unique and form a valid matrix."
          : "مؤلفه‌ها و هم‌بستگی‌ها را بررسی کنید. هر جفت باید یکتا باشد و مجموع هم‌بستگی‌ها باید یک ماتریس معتبر تشکیل بدهد.");
        return;
      }
      if (!response.ok) throw new Error("Calculation failed");
      const data = await response.json();
      if (!Number.isFinite(data.standard_uncertainty) || !Number.isFinite(data.expanded_uncertainty)) throw new Error("Invalid response");
      if (simulate && !data.simulation) throw new Error("Simulation is not supported by this server");
      if (simulate && registeredModel && data.simulation.model !== registeredModel.kind) throw new Error("Full model simulation is not supported by this server");
      if(coverageMode==='automatic'&&(data.coverage_method!=='welch-satterthwaite'||!Number.isFinite(data.coverage)||data.coverage<=0))throw new Error('Automatic coverage is not supported by this server');
      setServerResult(data);
      onCalculated?.();
    } catch {
      setServerError(en ? "The server calculation failed. Check the connection and try again." : "محاسبهٔ سرور انجام نشد. اتصال را بررسی کنید و دوباره محاسبه بزنید.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="ui-card min-w-0 space-y-5 p-4 sm:p-6" onChange={() => { setSubmitted(false); setCopyStatus(""); setServerResult(null); }}
      onSubmit={event => { event.preventDefault(); void calculate(); }}>
      <fieldset disabled={busy} className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-info-bg)] text-[var(--color-info-text)]"><ShieldCheck size={23} aria-hidden="true"/></span><div><h2 className="text-lg font-extrabold sm:text-xl">{en ? "Measurement uncertainty · GUM" : "عدم‌قطعیت اندازه‌گیری · GUM"}</h2><p className="mt-1 text-xs leading-6 opacity-65">{en?'Method inputs, uncertainty budget and report in one project':'ورودی‌های روش، بودجهٔ عدم‌قطعیت و گزارش در یک پرونده'}</p></div></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={template === "choose"} className="ui-btn ui-btn-ghost disabled:opacity-40" onClick={saveProject}>
            {lockedMethodId!==undefined?(en?'Save standalone budget':'ذخیرهٔ بودجهٔ مستقل'):(en?'Save project':'ذخیرهٔ پرونده')}
          </button>
          <label className="ui-btn ui-btn-ghost cursor-pointer">
            <span>{lockedMethodId!==undefined?(en?'Open standalone budget':'باز کردن بودجهٔ مستقل'):(en?'Open project':'باز کردن پرونده')}</span>
            <input type="file" accept=".json" className="sr-only" onChange={event => {
              const file = event.target.files?.[0]; event.target.value = "";
              if (file) void loadProject(file);
            }} />
          </label>
        </div>
      </div>
      {projectStatus && <p role="status" className="text-sm">{projectStatus}</p>}
      <details open={lockedMethodId!==undefined} className="rounded-xl border border-[var(--border-soft)] p-3 text-sm">
        <summary className="cursor-pointer font-bold">{lockedMethodId!==undefined?(en?'Method model and scope':'مدل و دامنهٔ آزمون'):(en?'98-test method bank':'بانک ۹۸ آزمون')}</summary>
        <div className="mt-3 space-y-3">
          {lockedMethodId===undefined&&<>
          <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
            {([['numeric',en?'Base models':'دارای مدل پایه'],['qualitative',en?'Qualitative':'کیفی و رده‌ای'],['sampling',en?'Sampling':'نمونه‌برداری'],['custom',en?'Custom model needed':'نیازمند رابطهٔ اختصاصی']] as const).map(([key,label])=><div key={key} className="rounded-xl bg-[var(--surface-soft)] p-3"><b className="block text-xl">{new Intl.NumberFormat(en?'en':'fa').format(profileCounts[key])}</b>{label}</div>)}
          </div>
          <p className="text-xs leading-6">{en ? "Source models are drafts. A family model covers only the stated equation and requires review against the actual method."
            : "مدل‌های بانک پیش‌نویس‌اند. مدل پایه فقط رابطهٔ نمایش‌داده‌شده را پوشش می‌دهد و باید با روش اجرایی آزمون تطبیق داده شود."}</p>
          <input className={controls} aria-label={en ? "Find test" : "جست‌وجوی آزمون"} placeholder={en ? "Test name or standard" : "نام آزمون یا استاندارد"}
            value={methodQuery} onChange={event => setMethodQuery(event.target.value)} />
          <label className="block space-y-1 text-xs font-semibold"><span>{en?'Test material category':'دستهٔ آزمون بر اساس ماده'}</span><select className={controls} value={methodCategory} onChange={event=>setMethodCategory(event.target.value)}><option value="">{en?'All materials':'همهٔ مواد'}</option>{methodGroups.map(group=><option key={group.fa} value={group.fa}>{en?group.en:group.fa}</option>)}</select></label>
          <p className="text-xs opacity-65" aria-live="polite">{en?`${filteredMethods.length} matching ${filteredMethods.length===1?'test':'tests'}`:`${new Intl.NumberFormat('fa').format(filteredMethods.length)} آزمون مطابق فیلتر`}</p>
          <select className={controls} aria-label={en ? "Test bank selection" : "انتخاب از بانک آزمون"} disabled={lockedMethodId!==undefined} value={methodId} onChange={event => {
            setMethodId(event.target.value); setActiveMethodId(""); setMethodRevision(""); setMethodEdition(""); setTemplate("choose"); setSubmitted(false); setServerResult(null); setCorrelations([]);
          }}>
            <option value="">{en ? "Select a test" : "انتخاب آزمون"}</option>
            {methodGroups.map(group=><optgroup key={group.fa} label={en?group.en:group.fa}>{filteredMethods.filter(method=>method.category===group.fa)
              .map(method => <option key={method.id} value={method.id}>{method.id} · {methodName(method,en)} · {method.standard_codes.join(" / ") || (en ? "Method unspecified" : "روش نامشخص")}</option>)}</optgroup>)}
          </select>
          </>}
          {selectedMethod && <div className="space-y-2 text-xs leading-6">
            <p className="font-bold">{methodName(selectedMethod,en)}</p>
            <p><bdi className="font-bold">{selectedMethod.standard_codes.join(" / ")}</bdi> · {en
              ? selectedMethod.standard_state === "provided" ? "From supplied bank" : selectedMethod.standard_state === "candidate" ? "Candidate method" : "Method not identified"
              : selectedMethod.standard_state === "provided" ? "اعلام‌شده در فایل" : selectedMethod.standard_state === "candidate" ? "روش پیشنهادی برای تطبیق" : "روش تعیین نشده"}</p>
            <p>{en?'Record the standard edition actually used by your laboratory; a supplied or proposed code is not confirmation of method implementation.':selectedMethod.standard_note}</p>
            <p>{en ? "Output unit" : "واحد خروجی"} · <bdi>{methodUnit(selectedMethod.unit,en)}</bdi></p>
            {!en&&selectedMethod.corrections.map(note => <p key={note} className="text-[var(--color-info-text)]">{note}</p>)}
            {selectedMethod.standard_reference.startsWith("https://") && <a className="inline-block text-[var(--color-info-text)] underline"
              href={selectedMethod.standard_reference} target="_blank" rel="noreferrer">{en ? "Standard reference" : "صفحهٔ مرجع استاندارد"}</a>}
            <p>{en?methodProfile(selectedMethod,true).scope:`${selectedMethod.model_family} · ${selectedMethod.method_notes}`}</p>
            {selectedMethod.review_flag && <p className="text-[var(--color-warning-text)]">{en?'Source record contains a correction/review flag; verify the actual procedure and reporting unit.':selectedMethod.review_flag}</p>}
            <MethodReadiness key={selectedMethod.id} method={selectedMethod} en={en} onOpen={value=>{
              selectTemplate(value); setActiveMethodId(String(selectedMethod.id));
              const chosen=familyModels[value.slice(7)];
              if(chosen && !chosen.unit && selectedMethod.unit && selectedMethod.unit!=="وابسته به روش") {
                const outputUnit=methodUnit(selectedMethod.unit,true);
                setUnit(outputUnit);
                setRows(previous=>previous.map(row=>({...row,unit:row.unit||outputUnit})));
              }
            }}/>
          </div>}
        </div>
      </details>
      <label className="block space-y-2 text-sm font-bold">
        <span>{en ? "Select test or method" : "آزمون یا روش را انتخاب کنید"}</span>
        <select aria-label={en ? "Select test or method" : "آزمون یا روش را انتخاب کنید"} className={controls} value={template} onChange={event => selectTemplate(event.target.value)}>
          <option value="choose" disabled>{en ? "Choose a test to start" : "برای شروع، آزمون را انتخاب کنید"}</option>
          <option value="general">{en ? "General budget (expert)" : "بودجهٔ عمومی (کارشناس)"}</option>
          {lockedMethodId===undefined&&<><option value="balance">{en ? "Balance · direct weighing" : "ترازو · توزین مستقیم"}</option>
          <option value="density">{en ? "Density · mass and volume" : "چگالی · از جرم و حجم"}</option>
          <option value="standard">{en ? "Calibration standard preparation · Eurachem A1" : "تهیهٔ محلول استاندارد · مثال Eurachem A1"}</option>
          <option value="titration">{en ? "NaOH standardization with KHP · Eurachem A2" : "تعیین غلظت NaOH با KHP · مثال Eurachem A2"}</option>
          <option value="typeA">{en ? "Repeat readings · uncertainty of mean" : "اندازه‌گیری تکراری · عدم‌قطعیت میانگین"}</option>
          <option value="gc">{en ? "GC–FID · external calibration budget" : "GC–FID · بودجهٔ کالیبراسیون خارجی"}</option>
          <option value="gcExtraction">{en ? "GC–FID · external calibration and extraction" : "GC–FID · کالیبراسیون خارجی و استخراج"}</option>
          </>}{Object.entries(familyModels).filter(([key])=>lockedMethodId===undefined||Boolean(selectedMethod&&methodProfile(selectedMethod).models.includes(key))).map(([key, item]) => <option key={key} value={`family:${key}`}>{en ? item.en : item.fa}</option>)}
        </select>
      </label>
      <div hidden={template === "choose"} className="space-y-5">
      {activeMethod && <section className="space-y-2 rounded-xl border border-[var(--border-soft)] p-3 text-sm">
        <h3 className="font-bold">{methodName(activeMethod,en)}</h3>
        <p><bdi>{activeMethod.standard_codes.join(" / ")}</bdi> · {en?methodProfile(activeMethod,true).scope:activeMethod.standard_note}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1"><span>{en?"Standard number from the test bank":"شمارهٔ استاندارد از بانک آزمون"}</span>
            <input dir="ltr" readOnly className={controls} value={activeMethod.standard_codes.join(" / ") || (en?"Not identified":"تعیین نشده")}/>
          </label>
          <label className="block space-y-1"><span>{en?"Edition used by your laboratory (optional)":"سال یا ویرایش مورد استفادهٔ آزمایشگاه (اختیاری)"}</span>
            <input dir="auto" className={controls} value={methodEdition} placeholder={en?"Copy the edition from your actual standard":"از روی جلد نسخهٔ استاندارد آزمایشگاه وارد کنید"} onChange={event=>setMethodEdition(event.target.value)}/>
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span>{en ? "Laboratory SOP identifier and revision (optional)" : "شناسه و بازنگری روش داخلی آزمایشگاه، SOP (اختیاری)"}</span>
            <input dir="auto" className={controls} value={methodRevision} placeholder={en?"Copy the document code and revision from your SOP":"کد سند و شمارهٔ بازنگری را از روش اجرایی آزمایشگاه بردارید"} onChange={event => setMethodRevision(event.target.value)} />
          </label>
        </div>
        <p className="text-xs leading-6 opacity-80">{en
          ? "These fields identify the method used for traceability. They are not measurement inputs and do not change the formula. Leave them empty if unknown; the report will state that they were not recorded. The app does not choose a standard edition or certify compliance."
          : "این اطلاعات مشخص می‌کند آزمایشگاه از کدام نسخه و دستورکار استفاده کرده است؛ عدد اندازه‌گیری نیست و فرمول را تغییر نمی‌دهد. اگر نمی‌دانید فعلاً خالی بگذارید؛ در گزارش «ثبت نشده» درج می‌شود. برنامه ویرایش استاندارد را حدس نمی‌زند و انطباق با آن را تأیید نمی‌کند."}</p>
        <p className="text-xs opacity-75">{en ? "Opening the base model does not verify complete implementation of the named standard."
          : "باز کردن مدل پایه به معنی تأیید اجرای کامل استاندارد نام‌برده نیست."}</p>
      </section>}
      {family && <div className="space-y-3">
        <p className="text-sm leading-7">{en ? "Base equation model. Add method precision and any remaining independent effects in result units; enter zero only when justified. Review overlap and correlations."
          : "این فرم مدل پایهٔ رابطه است. دقت روش و سایر اثرهای مستقل را در واحد نتیجه وارد کنید. فقط با دلیل مشخص صفر بگذارید و هم‌پوشانی سهم‌ها و هم‌بستگی را بررسی کنید."}</p>
        {family.explanation && <p className="rounded-xl bg-[var(--surface-soft)] p-3 text-sm leading-7">{typeof family.explanation==='string'?(en?modelGuidesEn[template.slice(7)]:family.explanation):en?family.explanation.en:family.explanation.fa}</p>}
        {family.sourceEdition&&<p className="text-xs opacity-75">{en?'Equation/data version':'نسخهٔ مرجع رابطه/داده'} · <bdi>{family.sourceEdition}</bdi></p>}
        {family.reference && <a className="inline-block text-xs text-[var(--color-info-text)] underline" href={family.reference} target="_blank" rel="noreferrer">{en?"Equation reference and scope":"مرجع رابطه و دامنهٔ کاربرد"}</a>}
        <div className="grid gap-3 sm:grid-cols-2">{family.inputs.map((input, index) => (
          <label key={index} className="text-sm font-semibold"><span>{en ? input.en : input.fa} <bdi>{input.unit}</bdi></span>
            <input dir="ltr" className={controls} value={familyData[index] ?? ""} onChange={event =>
              setFamilyData(family.inputs.map((_, i) => i === index ? event.target.value : familyData[i] ?? ""))} />
            {input.help&&<span className="block text-xs font-normal leading-6 opacity-80">{en?input.help.en:input.help.fa}</span>}
          </label>
        ))}</div>
        {family.example && <button type="button" className="ui-btn ui-btn-ghost" onClick={()=>{
          setFamilyData(family.example!.map(String));
          setRows(previous=>previous.map(row=>({...row,u:"",source:en?"Hypothetical example; enter real uncertainty data":"مثال فرضی؛ عدم‌قطعیت واقعی را وارد کنید"})));
          setSubmitted(false);setServerResult(null);setCorrelations([]);
        }}>{en?"Load hypothetical measurement inputs":"بارگذاری ورودی‌های فرضی؛ عدم‌قطعیت‌ها را خودتان وارد کنید"}</button>}
      </div>}
      {guide && <aside className="space-y-2 rounded-xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-4 text-sm leading-7">
        <h3 className="font-bold">{en ? "What does this method calculate?" : "این روش چه چیزی را حساب می‌کند؟"}</h3>
        <p>{en ? guide.purpose.en : guide.purpose.fa}</p>
        <p className="text-xs">{en ? "Guide section" : "بخش مرجع"} · <bdi>{guide.sections}</bdi></p>
        <div className="flex flex-wrap gap-3 text-xs font-semibold">
          <a className="underline underline-offset-4" href="https://www.eurachem.org/index.php/publications/guides/quam" target="_blank" rel="noreferrer">{en ? "QUAM and Persian translation" : "راهنمای QUAM و ترجمهٔ فارسی"}</a>
          <a className="underline underline-offset-4" href="https://www.eurachem.org/images/stories/Guides/quam/errata/QUAM_ERRATA_v2.pdf" target="_blank" rel="noreferrer">{en ? "Official corrections" : "اصلاحیهٔ رسمی"}</a>
        </div>
      </aside>}
      <details className="rounded-xl border border-[var(--border-soft)] p-3 text-sm leading-7">
        <summary className="cursor-pointer font-semibold">{en ? "What do u, U, k and the distributions mean?" : "معنی u، U، k و نوع توزیع چیست؟"}</summary>
        <dl className="mt-3 space-y-2">
          <div><dt className="font-semibold">{en ? "Standard uncertainty u" : "عدم‌قطعیت استاندارد u"}</dt>
            <dd>{en ? "Uncertainty expressed on a standard-deviation scale. Contributions are converted to this scale before combination."
              : "عدم‌قطعیت در مقیاس انحراف معیار است. فرم قبل از ترکیب، سهم‌ها را به این مقیاس تبدیل می‌کند."}</dd></div>
          <div><dt className="font-semibold">{en ? "Expanded uncertainty U and coverage factor k" : "عدم‌قطعیت گسترده U و ضریب پوشش k"}</dt>
            <dd>{en ? "A certificate's U is divided by its k. Final U is the combined standard uncertainty multiplied by the reporting k. k=2 does not guarantee 95% coverage in every case."
              : "U گواهی بر k همان گواهی تقسیم می‌شود. برای گزارش نهایی، عدم‌قطعیت استاندارد ترکیبی در k گزارش ضرب می‌شود. k=۲ در همهٔ شرایط الزاماً به معنی پوشش ۹۵ درصد نیست."}</dd></div>
          <div><dt className="font-semibold">{en ? "Rectangular and triangular distributions" : "توزیع مستطیلی و مثلثی"}</dt>
            <dd>{en ? "For a ±a interval, rectangular assumes equally likely values; triangular gives greater weight to the center. Standard uncertainty is a/√3 or a/√6 respectively. Select using evidence."
              : "برای بازهٔ ±a، مستطیلی احتمال یکسان در بازه و مثلثی احتمال بیشتر نزدیک مرکز را فرض می‌کند. به‌ترتیب u=a/√۳ و u=a/√۶ است. انتخاب باید پشتوانهٔ داده یا مستندات داشته باشد."}</dd></div>
        </dl>
      </details>
      <aside className="rounded-xl bg-[var(--surface-soft)] p-3 text-sm leading-7">
        <h3 className="font-bold">{en?'What are uncertainty components?':'سهم‌های عدم‌قطعیت یعنی چه؟'}</h3>
        <p>{en?'Each component describes uncertainty in one input, such as the measured mass or volume. The program chooses the input names, units and sensitivity coefficients for the selected method. Enter the uncertainty of that input, not its measured value again.'
          :'هر سهم نشان می‌دهد یکی از ورودی‌ها، مثل جرم یا حجم، چقدر عدم‌قطعیت دارد. برنامه نام ورودی‌ها، واحد و ضریب اثرشان را با توجه به آزمون انتخاب می‌کند. اینجا عدم‌قطعیت آن ورودی را می‌نویسید، نه خود مقدار اندازه‌گیری‌شده را.'}</p>
        <p className="text-xs opacity-80">{en?'The source document determines whether a number is standard u, certificate U with k, repeated-reading s with n, or a ±a limit. A test name alone cannot determine this safely. The initial selection is a template suggestion; match it to your actual evidence.'
          :'منبع داده مشخص می‌کند عدد شما u استاندارد، U گواهی همراه k، انحراف معیار s همراه تعداد تکرار n یا حد ±a است. نام آزمون به‌تنهایی این را تعیین نمی‌کند. انتخاب اولیه پیشنهاد الگوست و باید با سند واقعی مطابقت داشته باشد.'}</p>
      </aside>
      <p className="text-sm leading-7 opacity-80">{template === "general"
        ? (en ? "Enter uncertainty components and their sensitivity coefficients. Add correlations when supported by your data."
          : "مؤلفه‌های عدم‌قطعیت و ضریب حساسیت آن‌ها را وارد کنید. هم‌بستگی را فقط بر اساس دادهٔ مستند ثبت کنید.")
        : (en ? "Enter each uncertainty value and select what it represents. Standard uncertainties and sensitivity coefficients are calculated automatically. Add correlations only when supported by your data."
          : "عدد هر مؤلفه و نوع آن را وارد کنید. تبدیل به عدم‌قطعیت استاندارد و محاسبهٔ ضریب حساسیت خودکار است. هم‌بستگی را فقط بر اساس دادهٔ مستند ثبت کنید.")}</p>
      <label className="block space-y-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-sm">
        <span className="block font-bold">{en ? "Test measurement equation" : "معادلهٔ اندازه‌گیری آزمون"}</span>
        <input dir="ltr" className={controls} value={model} readOnly={template !== "general"} placeholder="y = f(x₁, x₂, …)"
          onChange={event => { setModel(event.target.value); setGcTemplate(false); }} />
        <span className="block leading-6 opacity-80">{template === "general"
          ? (en ? "Record your method equation for documentation. It is not executed; this budget uses the result and sensitivity coefficients you enter."
            : "معادلهٔ روش را برای مستندسازی ثبت کنید. این متن اجرا نمی‌شود؛ محاسبه از نتیجه و ضرایب حساسیتی که وارد می‌کنید استفاده می‌کند.")
          : (en ? "This is the selected template's equation. Its sensitivity coefficients are supplied automatically."
            : "این رابطه مربوط به الگوی انتخاب‌شده است و ضرایب حساسیت آن خودکار تعیین می‌شوند.")}</span>
        {gcTemplate && <span className="block leading-6">{en
          ? "A is peak area, a is slope, b is intercept and F converts to the reporting basis. If your method corrects for recovery, divide by the recovery fraction R."
          : "A مساحت پیک، a شیب، b عرض از مبدأ و F ضریب تبدیل به مبنای گزارش است. اگر روش آزمون تصحیح بازیابی دارد، حاصل را بر کسر بازیابی R تقسیم کنید."}</span>}
      </label>
      {template === "balance" && <p className="text-sm leading-7">{en
        ? "Enter s from repeat weighings. Set n=1 for a single reported reading. Use U and k from the certificate. Limits use ±a; display resolution uses the spacing between consecutive readings. Avoid double counting effects covered by repeatability."
        : "برای تکرارپذیری، s را از ابزار آمار بردارید. اگر یک توزین گزارش می‌کنید n را ۱ بگذارید. U و k را از گواهی بردارید. برای رانش و دما، نیم‌عرض بازهٔ ±a و برای گام نمایش، فاصلهٔ دو عدد متوالی را وارد کنید. اثرهایی را که در تکرارپذیری پوشش داده شده‌اند دوباره اضافه نکنید."}</p>}
      {extraction && <div className="space-y-3">
        <GCGraphs key={graphKey} initialData={graphs} onDataChange={patch => setGraphs(previous => ({ ...previous, ...patch }))} en={en} onCalibration={(slope, intercept, us, ub, correlation) => {
          setGcData(previous => ({ ...previous, slope: String(slope), intercept: String(intercept) }));
          setRows(previous => previous.map((row, index) => index === 1 || index === 2
            ? { ...row, u: String(index === 1 ? us : ub), kind: "standard",
              source: en ? "Unweighted linear fit of entered standards" : "برازش خطی بدون وزن استانداردهای واردشده" } : row));
          setCorrelations(previous => [...previous.filter(pair => !([pair.first, pair.second].includes(1) && [pair.first, pair.second].includes(2))),
            { first: 1, second: 2, coefficient: String(correlation) }]);
          setSubmitted(false); setServerResult(null);
        }} />
        <p className="text-sm leading-7">{en
          ? "A and b must use the same peak-area unit. The calibration returns mg/L in the injected solution; V is the final extract volume before post-extraction dilution D. Set R=100 when the method applies no recovery correction. Include slope–intercept correlation below. Supply uncertainty of A that covers the relevant sample response variability and fit residual effects without double counting."
          : "A و b باید در یک واحد مساحت پیک باشند. کالیبراسیون، غلظت محلول تزریقی را به mg/L می‌دهد. V حجم نهایی استخراج پیش از رقیق‌سازی D است. اگر روش تصحیح بازیابی ندارد R را ۱۰۰ بگذارید. هم‌بستگی شیب و عرض از مبدأ را در بخش هم‌بستگی وارد کنید. عدم‌قطعیت A باید پراکندگی پاسخ نمونه و اثر باقی‌ماندهٔ برازش را متناسب با مدل پوشش دهد و دوباره‌شماری نشود."}</p>
        <div className="grid gap-3 sm:grid-cols-2">{gcInputs.map(input => (
          <label key={input.key} className="space-y-1 text-sm font-semibold">
            <span>{en ? input.en : input.fa}</span>
            <input dir="ltr" className={controls} value={gcData[input.key] ?? ""} onChange={event =>
              setGcData(previous => ({ ...previous, [input.key]: event.target.value }))} />
          </label>
        ))}</div>
        <button type="button" className="ui-btn ui-btn-ghost" onClick={() => {
          setGcData({ area: "110", slope: "10", intercept: "10", extract: "50", dilution: "2", mass: "10", recovery: "80" });
          setRows(rows.map(row => ({ ...row, u: "", source: en ? "Hypothetical example; enter uncertainty from real data" : "مثال فرضی؛ عدم‌قطعیت را از دادهٔ واقعی وارد کنید" })));
          setSubmitted(false); setServerResult(null); setCorrelations([]);
        }}>{en ? "Load hypothetical measurement inputs" : "بارگذاری ورودی‌های اندازه‌گیری فرضی"}</button>
      </div>}
      {(density || solution || titration) && <div className="grid gap-3 sm:grid-cols-2">
        {[{ name: solution ? (en ? "Weighed mass (mg)" : "جرم توزین‌شده (mg)") : titration ? (en ? "Net KHP mass (g)" : "جرم خالص KHP (g)") : en ? "Sample mass (g)" : "جرم نمونه (g)", value: mass, set: setMass },
          { name: titration ? (en ? "NaOH titration volume (mL)" : "حجم مصرفی NaOH (mL)") : solution ? (en ? "Final solution volume (mL)" : "حجم نهایی محلول (mL)") : en ? "Sample volume (mL)" : "حجم نمونه (mL)", value: volume, set: setVolume },
          ...(solution || titration ? [{ name: en ? "Purity (%)" : "خلوص (%)", value: purity, set: setPurity }] : []),
          ...(solution ? [{ name: en ? "Liquid expansion coefficient (1/°C)" : "ضریب انبساط حجمی محلول (1/°C)", value: expansion, set: setExpansion }] : []),
          ...(titration ? [{ name: en ? "KHP molar mass (g/mol)" : "جرم مولی KHP (g/mol)", value: molarMass, set: setMolarMass }] : [])].map(field => (
          <label key={field.name} className="text-sm"><span>{field.name}</span><input dir="ltr" className={controls}
            value={field.value} onChange={event => field.set(event.target.value)} /></label>
        ))}
      </div>}
      {titration && <div className="space-y-2 text-sm leading-7">
        <p>{en ? "The stoichiometric ratio is 1:1. Use net KHP mass in grams. The mass uncertainty must exclude effects already included in whole-method repeatability. Relative contributions are entered in percent. Molar mass uncertainty is standard uncertainty."
          : "نسبت استوکیومتری واکنش ۱ به ۱ است. جرم خالص KHP را به گرم وارد کنید. سهم جرم نباید اثرهایی را که در تکرارپذیری کل روش لحاظ شده‌اند دوباره پوشش دهد. سهم‌های نسبی به درصد و عدم‌قطعیت جرم مولی به‌صورت استاندارد وارد می‌شوند."}</p>
        <button type="button" className="ui-btn ui-btn-ghost" onClick={() => {
          setMass("0.3888"); setVolume("18.64"); setPurity("100"); setMolarMass("204.2212");
          setRows(rows.map((row, index) => index>=baseCount?row:({ ...row,
            u: ["0.00012247448713916", "0.05", "0.00376530211271287", "0.15", "0.03", "0.05"][index],
            kind: ["standard", "rectangular", "standard", "triangular", "standard", "standard"][index],
            source: "Eurachem A2 · GUM Workbench example (2007)",
          })));
          setCoverage("2"); setCorrelations([]); setSubmitted(false); setServerResult(null);
        }}>{en ? "Load Eurachem A2 reference values" : "بارگذاری اعداد مرجع Eurachem A2"}</button>
      </div>}
      {solution && <div className="space-y-2 text-sm leading-7">
        <p>{en
          ? "This model uses mass, purity and final volume. Temperature enters as a first-order volume contribution. Enter purity uncertainty in percentage points, e.g. 0.01 for ±0.01%. Choose distributions from your documentation. The reference assumes triangular flask tolerance and uniform purity and temperature bounds."
          : "غلظت از جرم، خلوص و حجم نهایی به دست می‌آید. اثر دما با تقریب مرتبهٔ اول از تغییر حجم محاسبه می‌شود. برای خلوص ۹۹٫۹۹ ±۰٫۰۱ درصد، حد خلوص را ۰٫۰۱ وارد کنید. توزیع‌ها را از مستندات انتخاب کنید. نمونهٔ مرجع، حد حجم بالن را مثلثی و حد خلوص و دما را مستطیلی فرض می‌کند."}</p>
        <button type="button" className="ui-btn ui-btn-ghost" onClick={() => {
          setMass("100.28"); setVolume("100"); setPurity("99.99"); setExpansion("0.00021");
          setRows(rows.map((row, index) => index>=baseCount?row:({ ...row, u: ["0.05", "0.01", "0.1", "4", "0.02"][index],
            kind: ["standard", "rectangular", "triangular", "rectangular", "standard"][index],
            source: "Eurachem A1 · GUM Workbench example (2007)" })));
          setCorrelations([]); setCoverage("2"); setSubmitted(false); setServerResult(null);
        }}>{en ? "Load Eurachem A1 reference values" : "بارگذاری اعداد مرجع Eurachem A1"}</button>
        <p className="text-xs opacity-75">{en
          ? "The reference values are from the supplied Workbench example. The calculation uses analytic first-order propagation; the stored example differs by about 0.000000102 mg/L in standard uncertainty."
          : "اعداد مرجع از فایل مثال Workbench خوانده شده‌اند. محاسبه با انتشار تحلیلی مرتبهٔ اول انجام می‌شود. اختلاف عدم‌قطعیت استاندارد با عدد ذخیره‌شدهٔ مرجع حدود ۰٫۰۰۰۰۰۰۱۰۲ mg/L است."}</p>
      </div>}
      <div className="grid gap-3 sm:grid-cols-3">
        {[{ label: en ? "Measured result y" : "نتیجهٔ اندازه‌گیری y", value: density || solution || titration || extraction || family ? (Number.isFinite(y) ? String(y) : "") : result, set: setResult },
          { label: en ? "Result unit" : "واحد نتیجه", value: unit, set: setUnit },
          { label: en ? "Coverage factor k" : "ضریب پوشش k", value: coverageMode==='automatic'?(serverResult?String(k):''):coverage, set: setCoverage }].map(field => (
          <label key={field.label} className="space-y-1 text-sm font-semibold">
            <span>{field.label}</span>
            <input dir="auto" className={controls} value={field.value}
              readOnly={coverageMode==='automatic'&&field.set===setCoverage || Boolean(density || solution || titration || extraction || family) && field.set === setResult ||
                template !== "general" && template !== "gc" && template !== "typeA" && (!family || Boolean(family.unit)) && field.set === setUnit}
              onChange={event => {
                field.set(event.target.value);
                if(field.set===setUnit){setResultMinimum("");setResultMaximum("");}
                if (template === "typeA" && field.set === setUnit) setRows(previous => previous.map(row => ({ ...row, unit: event.target.value })));
                if (family && !family.unit && field.set === setUnit) setRows(previous=>previous.map((row,index)=>
                  index>=family.inputs.length || !family.inputs[index].unit ? {...row,unit:event.target.value}:row));
              }} />
          </label>
        ))}
      </div>
      <section className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
        <label className="block space-y-1 text-sm font-semibold"><span>{en?'How should the coverage factor be determined?':'ضریب پوشش چطور تعیین شود؟'}</span>
          <select className={controls} value={coverageMode} onChange={event=>setCoverageMode(event.target.value)}>
            <option value="manual">{en?'Manual k':'ورود دستی k'}</option>
            <option value="automatic">{en?'Automatic · independent components':'خودکار · مؤلفه‌های مستقل'}</option>
          </select>
        </label>
        {coverageMode==='automatic'&&<>
          <label className="block space-y-1 text-sm font-semibold"><span>{en?'Approximate coverage level':'سطح پوشش تقریبی'}</span>
            <select className={controls} value={coverageProbability} onChange={event=>setCoverageProbability(event.target.value)}><option value="0.9">90%</option><option value="0.95">95%</option><option value="0.99">99%</option></select>
          </label>
          <p className="text-xs leading-7">{en?'The server combines the degrees of freedom of independent components using Welch–Satterthwaite and obtains k from Student’s t. This is an approximate coverage procedure, appropriate when the output admits a normal/t approximation. It is not an exact interval for a dominant rectangular or strongly nonlinear contribution. For correlated inputs, use a documented manual k.':'سرور درجهٔ آزادی مؤلفه‌های مستقل را با روش ولچ–ساترویت ترکیب می‌کند و k را از توزیع t به دست می‌آورد. این روش تقریبی است و وقتی مناسب است که بتوان خروجی را با توزیع نرمال یا t تقریب زد. برای یک سهم مستطیلیِ غالب یا اثر شدیداً غیرخطی، بازهٔ دقیق محسوب نمی‌شود. برای ورودی‌های هم‌بسته از k دستی و مستند استفاده کنید.'}</p>
          <a className="text-xs underline" href="https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-appendix-b-coverage-factors" target="_blank" rel="noreferrer">{en?'Reference and conditions · NIST TN 1297, Appendix B':'مرجع و شرایط استفاده · پیوست B راهنمای NIST TN 1297'}</a>
        </>}
      </section>
      <ResultLimits en={en} value={submitted&&serverResult?y:NaN} unit={unit} minimum={resultMinimum} maximum={resultMaximum} onMinimum={setResultMinimum} onMaximum={setResultMaximum} parseNumber={parseNumber}/>
      <div className="space-y-3">
        {displayRows.map((row, index) => (
          <fieldset key={index} className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 sm:grid-cols-2 xl:grid-cols-3">
            <legend className="px-2 text-sm font-semibold">{en ? "Component" : "سهم عدم‌قطعیت"} {index + 1}{template!=='general'&&` · ${row.name}`}</legend>
            {guide?.inputs[index] && <p className="text-xs font-normal leading-6 opacity-80 sm:col-span-2 xl:col-span-3">
              {en ? guide.inputs[index].en : guide.inputs[index].fa}
            </p>}
            {coverageMode==='automatic'&&<div className="space-y-2 rounded-lg border border-[var(--border-soft)] p-3 sm:col-span-2 xl:col-span-3">
              <label className="block space-y-1 text-xs font-semibold"><span>{en?'Degrees of freedom source':'مبنای تعیین درجهٔ آزادی'}</span>
                <select className={controls} value={row.dfMode??'unknown'} onChange={event=>setRows(previous=>previous.map((item,i)=>i===index?{...item,dfMode:event.target.value as Row['dfMode'],dfValue:''}:item))}>
                  <option value="unknown">{en?'Select the evidence available':'مستند موجود را انتخاب کنید'}</option>
                  {row.kind==='repeatability'&&<option value="study">{en?'Number of readings used to estimate s':'تعداد قرائت‌های مطالعهٔ برآورد s'}</option>}
                  <option value="finite">{en?'Degrees of freedom stated by the source':'درجهٔ آزادی اعلام‌شده در منبع'}</option>
                  <option value="infinite">{en?'Effectively infinite · documented reliability assumption':'عملاً نامحدود · با فرض مستندِ قابلیت اتکا'}</option>
                </select>
              </label>
              {(row.dfMode==='finite'||row.dfMode==='study')&&<label className="block space-y-1 text-xs font-semibold"><span>{row.dfMode==='study'?(en?'Readings in the study used to estimate s':'تعداد قرائت‌های مطالعه برای برآورد s'):(en?'Source degrees of freedom ν':'درجهٔ آزادی ν از منبع')}</span>
                <input className={controls} dir="ltr" inputMode="decimal" value={row.dfValue??''} onChange={event=>setRows(previous=>previous.map((item,i)=>i===index?{...item,dfValue:event.target.value}:item))}/>
              </label>}
              <p className="text-xs leading-6 opacity-80">{row.dfMode==='study'?(en?'ν = study readings − 1. This is not necessarily the number n averaged in the reported result. For a single reported reading, n may be 1 while s came from a larger study.':'درجهٔ آزادی برابر تعداد قرائت‌های مطالعه منهای ۱ است. این تعداد لزوماً همان n میانگین‌گیری نتیجه نیست؛ ممکن است نتیجه تک‌قرائت باشد ولی s از یک مطالعهٔ چندقرائتی آمده باشد.'):row.dfMode==='infinite'?(en?'Choose only when the reliability of this uncertainty estimate justifies treating its degrees of freedom as infinite. A certificate coverage factor k alone does not establish this.':'فقط وقتی انتخاب کنید که قابلیت اتکای برآورد عدم‌قطعیت، فرض درجهٔ آزادی نامحدود را توجیه کند. داشتن k در گواهی به‌تنهایی این فرض را ثابت نمی‌کند.'):(en?'Obtain ν from the uncertainty evaluation or calibration source. It is not the measured value or coverage factor k. A zero contribution does not require ν.':'ν را از ارزیابی عدم‌قطعیت یا منبع کالیبراسیون بردارید. این عدد، مقدار اندازه‌گیری یا ضریب پوشش k نیست. سهم صفر به تعیین ν نیاز ندارد.')}</p>
            </div>}
            {template!=='general'&&index>=baseCount&&<label className="space-y-1 text-xs font-semibold sm:col-span-2 xl:col-span-3">
              <span>{en?'Where does this additional effect act?':'این اثر اضافی به کدام بخش مربوط است؟'}</span>
              <select aria-label={en?'Where does this additional effect act?':'این اثر اضافی به کدام بخش مربوط است؟'} className={controls} value={row.target??-1} onChange={event=>{setRows(previous=>previous.map((item,i)=>i===index?{...item,target:Number(event.target.value)}:item));setSubmitted(false);setServerResult(null);}}>
                <option value={-1}>{en?'Directly on the result (in result units)':'مستقیماً روی نتیجه، در واحد نتیجه'}</option>
                {names.slice(0,physicalCount).map((name,i)=><option key={i} value={i}>{name}</option>)}
              </select>
              <span className="block font-normal leading-6 opacity-80">{en?'Use a separate, documented contribution. Do not include an effect already covered by another component. Input effects use that input’s unit and automatic sensitivity; result effects use sensitivity 1.':'فقط سهم جداگانه و مستند وارد کنید؛ اثری را که در مؤلفهٔ دیگری حساب شده دوباره اضافه نکنید. اثر ورودی در واحد همان ورودی با ضریب حساسیت خودکار محاسبه می‌شود؛ اثر مستقیم نتیجه ضریب ۱ دارد.'}</span>
            </label>}
            {family && index<baseCount && <p className="text-xs font-normal leading-6 opacity-80 sm:col-span-2 xl:col-span-3">{index<family.inputs.length
              ? (en ? `Uncertainty of ${family.inputs[index].en}, in ${row.unit || unit}. Use the certificate, replicate study or documented limit for this same parameter; do not enter its measured value again.`
                : `عدم‌قطعیت «${family.inputs[index].fa}» در واحد ${row.unit || unit || "همان پارامتر"}. عدد را از گواهی، مطالعهٔ تکرارپذیری یا حد مستند همین پارامتر بردارید؛ خود مقدار اندازه‌گیری را دوباره اینجا وارد نکنید.`)
              : index===family.inputs.length
                ? (en?"Use whole-method precision on the reporting basis, excluding effects already counted above. Convert relative RSD using |result| × RSD/100."
                  : "سهم دقت کل روش را متناسب با نتیجهٔ گزارش و بدون دوباره‌شماری سهم‌های بالا وارد کنید. برای RSD درصدی، سهم مطلق برابر |نتیجه| × RSD/۱۰۰ است.")
                : (en?"Include remaining independent effects in result units. Enter zero only if the absence or coverage of these effects is documented."
                  : "باقی اثرهای مستقل را در واحد نتیجه وارد کنید. صفر فقط وقتی درست است که نبودن یا پوشش این اثرها مستند باشد.")}</p>}
            <label className="space-y-1 text-xs font-semibold">
              <span>{en ? "Where does this uncertainty number come from?" : "این عدد عدم‌قطعیت را از کجا برداشته‌اید؟"}</span>
              <select aria-label={en ? "What value do you have?" : "چه عددی در اختیار دارید؟"} className={controls} value={row.kind} onChange={event => setRows(rows.map((item, i) => i === index ? { ...item, kind: event.target.value,...(item.dfMode==='study'&&event.target.value!=='repeatability'?{dfMode:'unknown' as const,dfValue:''}:{}) } : item))}>
                <option value="standard">{en ? "Standard uncertainty u" : "عدم‌قطعیت استاندارد u"}</option>
                <option value="certificate">{en ? "Certificate expanded uncertainty U" : "عدم‌قطعیت گستردهٔ گواهی U"}</option>
                <option value="rectangular">{en ? "Uniform half-width ±a" : "حد اثر ±a با توزیع یکنواخت"}</option>
                <option value="triangular">{en ? "Triangular half-width ±a" : "حد اثر ±a با توزیع مثلثی"}</option>
                <option value="resolution">{en ? "Display increment d" : "گام نمایش d"}</option>
                <option value="repeatability">{en ? "Repeat readings standard deviation s" : "انحراف معیار تکرارها s"}</option>
              </select>
              <span className="block text-xs font-normal leading-6 opacity-80">
                {row.kind === "certificate"
                  ? (en ? "Copy U and its k from the same certificate entry." : "U و k را از همان ردیف گواهی کالیبراسیون بردارید.")
                  : row.kind === "rectangular" || row.kind === "triangular"
                    ? (en ? "Enter the positive half-width a of the ±a interval. Choose the distribution supported by your data."
                      : "برای بازهٔ ±a، مقدار مثبت a را وارد کنید. نوع توزیع را بر اساس داده یا مستندات انتخاب کنید.")
                    : row.kind === "resolution"
                      ? (en ? "Enter the spacing between consecutive display readings." : "فاصلهٔ دو عدد متوالی نمایشگر را وارد کنید.")
                      : row.kind === "repeatability"
                        ? (en ? "Enter the sample standard deviation s and the number of readings actually averaged."
                          : "انحراف معیار نمونه s و تعداد قرائت‌هایی را وارد کنید که واقعاً میانگین گرفته شده‌اند.")
                        : (en ? "Enter a value already expressed as standard uncertainty u." : "عددی را وارد کنید که از قبل به عدم‌قطعیت استاندارد u تبدیل شده است.")}
              </span>
            </label>
            {row.kind === "certificate" && <label className="space-y-1 text-xs font-semibold">
              <span>{en ? "Certificate coverage factor k" : "ضریب پوشش k گواهی"}</span>
              <input className={controls} dir="ltr" value={row.divisor} onChange={event => setRows(rows.map((item, i) => i === index ? { ...item, divisor: event.target.value } : item))} />
            </label>}
            {row.kind === "repeatability" && <label className="space-y-1 text-xs font-semibold">
              <span>{en ? "Number averaged in result n (1 for a single reading)" : "تعداد قرائت‌های میانگین‌گرفته‌شده n (برای تک‌قرائت ۱)"}</span>
              <input dir="ltr" className={controls} value={row.divisor} onChange={event => setRows(rows.map((item, i) => i === index ? { ...item, divisor: event.target.value } : item))} />
            </label>}
            {keys.filter(key => template === "general" || key !== "c").map(key => {
              const column = keys.indexOf(key);
              return (
              <label key={key} className="space-y-1 text-xs font-semibold">
                <span>{fields[column]}</span>
                <input className={controls} dir={column >= 3 ? "ltr" : "auto"} inputMode={column >= 3 ? "decimal" : "text"}
                  readOnly={template !== "general" && (key === "name" && index<baseCount || key === "unit" && (index>=baseCount||template !== "gc"))}
                  value={row[key]} onChange={event => setRows(rows.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))} />
              </label>
            ); })}
            <p className="self-center text-xs" dir="ltr">u(xᵢ) = {row.kind === "certificate" ? "U / k" : row.kind === "rectangular" ? "a / √3" : row.kind === "triangular" ? "a / √6" : row.kind === "resolution" ? "d / √12" : row.kind === "repeatability" ? "s / √n" : "u"} {Number.isFinite(standardValues[index]) && `= ${format(standardValues[index])} ${row.unit}`}
              <br />cᵢ = {Number.isFinite(Number(effectiveRows[index].c)) ? effectiveRows[index].c : (en ? "Enter measurement inputs first" : "ابتدا داده‌های اندازه‌گیری را وارد کنید")}</p>
            {(template === "general" || index>=baseCount) && <button type="button" disabled={rows.length === 1} className="ui-btn ui-btn-ghost self-end disabled:opacity-40"
              onClick={() => { setRows(rows.filter((_, i) => i !== index)); setCorrelations([]); setSubmitted(false); setServerResult(null); }}>
              {en ? "Remove component" : "حذف مؤلفه"}
            </button>}
          </fieldset>
        ))}
      </div>
      {rows.length > 1 && <details className="rounded-xl border border-[var(--border-soft)] p-3">
        <summary className="cursor-pointer text-sm font-bold">{en ? "Input correlations" : "هم‌بستگی بین مؤلفه‌ها"}</summary>
        <p className="my-3 text-xs leading-6">{en
          ? "Use correlation between inputs before applying sensitivity coefficients. Unlisted pairs use zero. Removing a component clears these pairs."
          : "ضریب هم‌بستگی ورودی‌ها را پیش از اعمال ضریب حساسیت وارد کنید. جفت‌های ثبت‌نشده صفر در نظر گرفته می‌شوند. حذف مؤلفه، فهرست هم‌بستگی‌ها را پاک می‌کند."}</p>
        <div className="space-y-3">
          {correlations.map((pair, index) => <div key={index} className="grid gap-2 sm:grid-cols-2">
            {(["first", "second"] as const).map((key, column) => <label key={key} className="text-xs">
              <span>{en ? `Component ${column + 1}` : `مؤلفهٔ ${column + 1}`}</span>
              <select className={controls} value={pair[key]} onChange={event => setCorrelations(correlations.map((item, i) =>
                i === index ? { ...item, [key]: Number(event.target.value) } : item))}>
                {displayRows.map((row, i) => <option key={i} value={i}>{i + 1} · {row.name}</option>)}
              </select>
            </label>)}
            <label className="text-xs"><span>{en ? "Correlation r (−1 to 1)" : "ضریب هم‌بستگی r بین ۱− و ۱"}</span>
              <input dir="ltr" className={controls} value={pair.coefficient} onChange={event => setCorrelations(correlations.map((item, i) =>
                i === index ? { ...item, coefficient: event.target.value } : item))} />
            </label>
            <button type="button" className="ui-btn ui-btn-ghost" onClick={() => {
              setCorrelations(correlations.filter((_, i) => i !== index)); setSubmitted(false); setServerResult(null);
            }}>{en ? "Remove pair" : "حذف جفت"}</button>
          </div>)}
          <button type="button" className="ui-btn ui-btn-ghost" onClick={() => {
            setCorrelations([...correlations, { first: 0, second: 1, coefficient: "0" }]);
            setSubmitted(false); setServerResult(null);
          }}>{en ? "+ Add correlation" : "+ افزودن هم‌بستگی"}</button>
        </div>
      </details>}
      <div className="flex flex-wrap gap-2">
        <div className="w-full space-y-3 rounded-xl border border-[var(--border-soft)] p-3 text-sm">
          <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={simulate} onChange={event => setSimulate(event.target.checked)} />
            {en ? "Compare with Monte Carlo" : "مقایسه با شبیه‌سازی مونت‌کارلو"}</label>
          {simulate && <div className="space-y-3">
            <p className="text-xs leading-6">{en ? "Standard uncertainty, certificate and repeatability inputs are treated as normal. Rectangular and triangular inputs retain their distributions."
              : "ورودی‌های استاندارد، گواهی و تکرارپذیری نرمال فرض می‌شوند؛ مستطیلی و مثلثی توزیع خود را حفظ می‌کنند."}</p>
            <p className="text-xs leading-6">{registeredModel
              ? (en ? "The full selected measurement equation is evaluated for every sampled set of inputs."
                : "در هر مجموعهٔ نمونه‌گیری‌شده، معادلهٔ کامل روش انتخاب‌شده محاسبه می‌شود.")
              : (en ? "This template currently simulates the linearized budget." : "این الگو فعلاً بودجهٔ خطی‌شده را شبیه‌سازی می‌کند.")}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label><span>{en ? "Samples (5,000–50,000)" : "تعداد نمونه (۵۰۰۰ تا ۵۰۰۰۰)"}</span><input dir="ltr" className={controls} value={simulationSamples} onChange={event => setSimulationSamples(event.target.value)} /></label>
              <label><span>{en ? "Random seed" : "بذر تصادفی برای تکرار نتیجه"}</span><input dir="ltr" className={controls} value={simulationSeed} onChange={event => setSimulationSeed(event.target.value)} /></label>
              <label><span>{en ? "Coverage probability" : "احتمال پوشش"}</span><select className={controls} value={simulationProbability} onChange={event => setSimulationProbability(event.target.value)}>
                <option value="0.9">90%</option><option value="0.95">95%</option><option value="0.99">99%</option>
              </select></label>
            </div>
          </div>}
        </div>
        <button type="submit" className="ui-btn bg-blue-700 text-white">{en ? "Calculate budget" : "محاسبهٔ بودجه"}</button>
        <button type="button" disabled={rows.length>=100} className="ui-btn ui-btn-ghost disabled:opacity-40" onClick={() => { setRows([...rows, {...emptyRow(),...(template==='general'?{}:{target:-1,unit})}]); setSubmitted(false);setServerResult(null); }}>
          {en ? "+ Add component" : "+ افزودن مؤلفه"}
        </button>
      </div>
      {submitted && !valid && <div role="alert" className="rounded-xl border border-[var(--border-soft)] p-3 text-sm leading-7 text-[var(--color-danger-text)]">
        {measurementErrors.length > 0 ? <ul className="list-inside list-disc">{measurementErrors.map(message => <li key={message}>{message}</li>)}</ul>
          : <p>{en
            ? "Check the result, positive coverage factor, component values and distribution settings. Sensitivities are automatic in preset models; enter them for a general budget."
            : "نتیجه، ضریب پوشش مثبت، مقادیر مؤلفه‌ها و تنظیمات توزیع را بررسی کنید. ضرایب حساسیت در الگوها خودکارند؛ در بودجهٔ عمومی باید آن‌ها را وارد کنید."}</p>}
      </div>}
      {busy && <p role="status">{en ? "Calculating…" : "در حال محاسبه…"}</p>}
      {serverError && <p role="alert">{serverError}</p>}
      {submitted && valid && serverResult && <section className={`space-y-3 rounded-xl border p-4 ${limitFailed?'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)]':'border-[var(--color-success-border)] bg-[var(--color-success-bg)]'}`} aria-live="polite">
        <h3 className="font-bold">{en ? "Measurement report" : "گزارش اندازه‌گیری"}</h3>
        <p className={`text-lg font-bold ${limitFailed?'text-[var(--color-danger-text)]':''}`}><bdi dir="ltr">{report}</bdi></p>
        {(limitFailed||limitStatus==='within')&&<p className="font-semibold">{limitMessage(limitStatus,en)}</p>}
        <p><bdi dir="ltr">u_c = {format(combined)} {unit}</bdi></p>
        {serverResult.coverage_method==='welch-satterthwaite'&&<div className="space-y-2 rounded-xl bg-[var(--surface-soft)] p-3 text-xs leading-7">
          <p>{en?'Approximate Student’s t coverage':'پوشش تقریبی با توزیع t'} · {100*(serverResult.coverage_probability??.95)}%</p>
          <p><bdi dir="ltr">ν_eff = {serverResult.effective_degrees_of_freedom==null?'∞':format(serverResult.effective_degrees_of_freedom)}; ν_t = {serverResult.coverage_t_degrees??'∞'}; k = {format(k)}</bdi></p>
          <p>{en?'Finite effective degrees are rounded down for the t-factor. The approximation assumes independent components. Monte Carlo still samples the specified input distributions with their standard uncertainties treated as fixed; it does not automatically simulate Student’s t inputs.':'برای تعیین ضریب t، درجهٔ آزادی مؤثرِ محدود به عدد صحیح پایین‌تر گرد می‌شود. این تقریب بر استقلال مؤلفه‌ها استوار است. مونت‌کارلو همچنان توزیع‌های تعیین‌شدهٔ ورودی را با عدم‌قطعیت استاندارد ثابت نمونه‌گیری می‌کند و ورودی t را خودکار شبیه‌سازی نمی‌کند.'}</p>
        </div>}
        <p className="text-xs opacity-75">{en ? "Calculation engine" : "موتور محاسبه"} · <bdi>{serverResult.engine} {serverResult.engine_version}</bdi></p>
        {serverResult.simulation && <SimulationReport value={serverResult.simulation} en={en} unit={unit} />}
        <ul className="space-y-1 text-sm">{displayRows.map((row, index) => {
          const share = serverResult.components[index]?.variance_percent;
          return <li key={index}>{row.name} · <bdi dir="ltr">{format(contributions[index])} {unit} · {share == null ? "—" : `${format(share)}%`}</bdi></li>;
        })}</ul>
        <button type="button" className="ui-btn ui-btn-ghost" onClick={()=>{
          const csv=budgetCsv([
            ["Measurement uncertainty budget",new Date().toISOString()],
            [en?'Method':'آزمون',activeMethod?methodName(activeMethod,en):template],[en?'Standard edition':'ویرایش استاندارد',methodEdition||(en?'Not recorded':'ثبت نشده')],[en?'SOP / revision':'روش اجرایی و بازنگری',methodRevision||(en?'Not recorded':'ثبت نشده')],
            [en?'Scope':'دامنهٔ کاربرد',activeMethod?methodProfile(activeMethod,en).scope:(en?'Base measurement model; actual method scope must be reviewed':'مدل پایهٔ اندازه‌گیری؛ دامنهٔ کاربرد روش واقعی باید بررسی شود')],
            ...(family?.sourceEdition?[[en?'Equation/data version':'نسخهٔ مرجع رابطه/داده',family.sourceEdition],[en?'Equation reference':'مرجع رابطه',family.reference??'']]:[]),
            ["Equation",model],["Result",y,"Unit",unit],["u_c",combined],["k",k],["U",expanded],
            ["Minimum",resultMinimum,"Maximum",resultMaximum],["Numeric limits comparison",limitMessage(limitStatus,en)],
            ["Engine",serverResult.engine,serverResult.engine_version],
            ['Coverage method',serverResult.coverage_method??'manual'],
            ...(serverResult.coverage_method==='welch-satterthwaite'?[['Coverage probability',serverResult.coverage_probability??.95],['Effective degrees of freedom',serverResult.effective_degrees_of_freedom??'infinite'],['t-table degrees of freedom',serverResult.coverage_t_degrees??'infinite'],['Coverage reference','NIST TN 1297 Appendix B']]:[]),
            ...nominalInputs,
            [...fields,"Input type","Divisor / n","u(x)","c*u","Variance share %",en?'Additional effect target':'محل اثر مؤلفهٔ اضافی','Degrees of freedom source','Degrees / study count'],
            ...effectiveRows.map((row,index)=>[row.name,row.source,row.unit,parseNumber(row.u),parseNumber(row.c),row.kind,row.divisor,standardValues[index],contributions[index],serverResult.components[index]?.variance_percent??"undefined",row.target===undefined?'':row.target<0?(en?'Result':'نتیجه'):names[row.target],row.dfMode??'unknown',row.dfValue??'']),
            ["Correlations: first input","second input","r"],
            ...correlations.map(pair=>[pair.first+1,pair.second+1,parseNumber(pair.coefficient)]),
            ...(serverResult.simulation?[["MC model",serverResult.simulation.model??"linearized"],["MC samples",serverResult.simulation.samples,"seed",serverResult.simulation.seed],
              ["MC probability",serverResult.simulation.probability],["MC mean",serverResult.simulation.mean],["MC standard uncertainty",serverResult.simulation.standard_uncertainty],
              [en?'Draws outside applicability bounds':'نمونه‌های بیرون از دامنهٔ کاربرد',serverResult.simulation.applicability_exceedances??0],
              ["MC equal-tail lower",serverResult.simulation.lower,"upper",serverResult.simulation.upper]]:[]),
          ]);
          const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
          const a=document.createElement("a");a.href=url;a.download="artin-uncertainty-budget.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
        }}>{en?"Export budget for Excel (CSV)":"دریافت جدول بودجه برای اکسل (CSV)"}</button>
        <button type="button" className="ui-btn ui-btn-ghost" onClick={async () => {
          try {
            await navigator.clipboard.writeText([...(model.trim() ? [model.trim()] : []),
              ...(activeMethod ? [methodName(activeMethod,en), activeMethod.standard_codes.join(" / "), en?methodProfile(activeMethod,true).scope:activeMethod.standard_note,
                methodEdition || (en ? "Standard edition not recorded" : "ویرایش استاندارد ثبت نشده"),
                methodRevision || (en ? "SOP not recorded" : "روش اجرایی ثبت نشده")] : []),
              ...nominalInputs.map(input=>input.join("\t")),
              ...(family?.sourceEdition?[`${en?'Equation/data version':'نسخهٔ مرجع رابطه/داده'}: ${family.sourceEdition}`,family.reference??'']:[]),
              ...(resultMinimum.trim()||resultMaximum.trim()?[`Limits (${unit}): min=${resultMinimum||"none"}; max=${resultMaximum||"none"}; ${limitMessage(limitStatus,en)}`,en?"Numeric comparison only; no uncertainty guard band.":"مقایسهٔ عددی؛ بدون اعمال حاشیهٔ عدم‌قطعیت."]:[]),
              report, `Engine: ${serverResult.engine} ${serverResult.engine_version}`, `u_c = ${format(combined)} ${unit}`,
              ...(serverResult.coverage_method==='welch-satterthwaite'?[`Coverage: Welch–Satterthwaite / Student t; p=${serverResult.coverage_probability}; ν_eff=${serverResult.effective_degrees_of_freedom??'∞'}; ν_t=${serverResult.coverage_t_degrees??'∞'}; k=${k}`,'NIST TN 1297 Appendix B; independent inputs; approximate normal/t coverage']:[]),
              ...(serverResult.simulation ? [
                `Monte Carlo (${serverResult.simulation.model ?? "linearized"}): ${serverResult.simulation.engine} ${serverResult.simulation.engine_version}`,
                `samples=${serverResult.simulation.samples}; seed=${serverResult.simulation.seed}`,
                `mean=${serverResult.simulation.mean}; u=${serverResult.simulation.standard_uncertainty}`,
                `${en?'Draws outside applicability bounds':'نمونه‌های بیرون از دامنهٔ کاربرد'}=${serverResult.simulation.applicability_exceedances??0}`,
                `equal-tail interval (${serverResult.simulation.probability * 100}%): [${serverResult.simulation.lower}, ${serverResult.simulation.upper}] ${unit}`,
              ] : []),
              [...fields, "Input type", "Certificate k", "u(xᵢ)", "cᵢ × u(xᵢ)",en?'Additional effect target':'محل اثر مؤلفهٔ اضافی','Degrees of freedom source','Degrees / study count'].join("\t"),
              ...effectiveRows.map((row, index) => [...keys.map(key => row[key]), row.kind, row.kind === "certificate" || row.kind === "repeatability" ? row.divisor : "", format(standardValues[index]), format(contributions[index]),row.target===undefined?'':row.target<0?(en?'Result':'نتیجه'):names[row.target],row.dfMode??'unknown',row.dfValue??''].join("\t")),
              "Correlation: input 1\tinput 2\tr",
              ...correlations.map(pair => [pair.first + 1, pair.second + 1, parseNumber(pair.coefficient)].join("\t"))].join("\n"));
            setCopyStatus(en ? "Copied" : "کپی شد");
          } catch {
            setCopyStatus(en ? "Select the result to copy it manually." : "نتیجه را انتخاب و دستی کپی کنید.");
          }
        }}>{en ? "Copy report" : "کپی گزارش"}</button>
        {copyStatus && <p role="status">{copyStatus}</p>}
      </section>}
      <div className="space-y-2 border-t border-[var(--border-soft)] pt-3 text-sm leading-7">
        <p dir="ltr" className="break-words font-mono">qᵢ = cᵢ × u(xᵢ)<br />u_c² = Σqᵢ² + 2Σ(i&lt;j) rᵢⱼqᵢqⱼ<br />U = k × u_c</p>
        <p>{en ? "Correlation adds covariance terms. Percentages allocate half of each cross-term to each component, so negative percentages can occur. With zero total variance, percentages are undefined."
          : "هم‌بستگی جمله‌های کوواریانس را اضافه می‌کند. در درصدها، نصف هر سهم مشترک به هر مؤلفه اختصاص می‌یابد؛ بنابراین سهم منفی هم ممکن است. وقتی واریانس کل صفر است، درصد تعریف نمی‌شود."}</p>
        <a className="text-[var(--color-info-text)] underline" href="https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-appendix-law-propagation-uncertainty" target="_blank" rel="noreferrer">NIST TN 1297 · A.3</a>
      </div>
      </div>
      </fieldset>
    </form>
  );
}
