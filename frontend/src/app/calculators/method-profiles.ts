import bank from "./method-bank.json";
import { familyModels } from "./family-models";
export type BankMethod = typeof bank[number];
export type MethodProfile = { kind: "numeric" | "qualitative" | "sampling" | "custom"; models: string[]; effects: string[]; scope: string };
const assigned: Record<number, string[]> = {
  7:["hthsTbs"],10:["heatNet","heatGross"],29:["freeAcid"],54:["mercaptanSulfur"],72:["viscosityIndex"],
  77:["ndmCA","ndmCN","ndmCP","ndmRA","ndmRN","ndmRT"],78:["cetaneA"],79:["trueVaporRefined"],81:["coolantWater"],
  12:["gcNormalization"],13:["pycnometer"],15:["volumePercent"],23:["solubility"],28:["acidBaseNumber"],30:["acidBaseNumber"],31:["transmission","corrected"],
  38:["kfCoulometric","kfVolumetric","volumePercent"],41:["acidBaseNumber"],42:["acidBaseNumber"],45:["volumePercent"],51:["acidBaseNumber"],
  52:["corrected","relativeDensity","apiGravity"],55:["volumePercent"],57:["relativeDensity","corrected"],58:["apiGravity"],59:["kinematicFromDynamic","dynamic","corrected"],
  61:["kfCoulometric","kfVolumetric"],62:["acidBaseNumber"],65:["relativeDensity","corrected"],73:["absorbance","corrected"],74:["acidBaseNumber"],75:["acidBaseNumber"],85:["ratioPercent"],96:["relativeDensity","pycnometer"],
};
const effects: Record<string, string[]> = {
  viscosity:["گواهی ثابت ویسکومتر و دمای مرجع آن","زمان‌سنج و تشخیص منیسک","دمای حمام و یکنواختی آن","تکرارپذیری، تصحیح انرژی جنبشی و شرایط جریان مطابق روش"],
  residue:["جرم خالی و پر ظرف، هم‌بستگی توزین‌ها","بلانک، انتقال و بازیابی باقیمانده","خشک‌کردن یا شرایط حرارتی روش","تکرارپذیری و ناهمگنی نمونه"],
  loss:["جرم‌های قبل و بعد و هم‌بستگی توزین‌ها","دما، زمان، فشار و شرایط عملیات","جابه‌جایی نمونه و آلودگی","تکرارپذیری کل روش"],
  corrected:["گواهی دستگاه و تصحیح با علامت","تفکیک‌پذیری، رانش و تکرارپذیری","شرایط محیطی و آماده‌سازی نمونه","اثر تعریف نقطهٔ پایانی یا اپراتور مطابق روش"],
  diluted:["کالیبراسیون و عدم‌قطعیت استانداردهای مرجع","بلانک، ماتریس، بازیابی و خطی‌بودن","حجم برداشت، حجم نهایی و هم‌بستگی آن‌ها","تکرارپذیری و پایداری نمونه"],
  acidBaseNumber:["غلظت واقعی تیترانت و سابقهٔ استانداردسازی","حجم بورت، بلانک و نقطهٔ پایانی","جرم نمونه و هم‌بستگی توزین‌ها","الکترود، آب/CO₂، حلال و تکرارپذیری کل روش"],
  pycnometer:["جرم خالی، پر از نمونه و پر از آب؛ با هم‌بستگی‌ها","چگالی آب مرجع در دمای واقعی","دمای مایع و انبساط ظرف","حباب، پرکردن، شناوری هوا و تکرارپذیری"],
  volumePercent:["کالیبراسیون و تفکیک‌پذیری ظروف حجمی","بلانک و قرائت حجم جزء","دما، بازیابی جداسازی و امولسیون","ناهمگنی و تکرارپذیری کل روش"],
  kfCoulometric:["استاندارد آب و کنترل صحت دستگاه","رانش زمانی، بلانک و نفوذ رطوبت محیط","جرم واقعی تزریق و انتقال نمونه","واکنش جانبی، استخراج آب و تکرارپذیری"],
  kfVolumetric:["تیتر واقعی آب و عدم‌قطعیت استانداردسازی","بلانک، رانش و کالیبراسیون بورت","جرم نمونه و رطوبت محیط","نقطهٔ پایانی، واکنش جانبی و تکرارپذیری"],
  apiGravity:["عدم‌قطعیت SG در مبنای ۶۰°F/۶۰°F","تبدیل معتبر دما و عدم‌قطعیت آن پیش از ورود","گواهی چگالی‌سنج یا هیدرومتر","تکرارپذیری و ناهمگنی نمونه"],
  gcNormalization:["انتگرال‌گیری و جداسازی پیک‌ها","ضرایب پاسخ و استانداردهای مرجع","مجموع سهم سایر پیک‌ها و کوواریانس‌ها","پیک‌های شناسایی‌نشده، تزریق و تکرارپذیری"],
  transmission:["شدت مرجع و نمونه و هم‌بستگی آن‌ها","بلانک، نور سرگردان و طول موج","کووت، مسیر نوری و خطی‌بودن آشکارساز","رانش و تکرارپذیری در طول موج تعریف‌شده"],
};
const special: Record<number,string> = {
  7:"مدل اختصاصی کالیبراسیون TBS آماده است. این رابطه برای هر نوع دستگاه HTHS قابل تعمیم نیست؛ ضرایب از کالیبراسیون واقعی TBS گرفته می‌شوند.",
  10:"دو مدل خالص و ناخالص D4868 با مبنای چگالی ۱۵°C آماده‌اند. دامنهٔ سوخت هیدروکربنی و خطای مدل تجربی باید بررسی شود.",
  12:"نرمال‌سازی سهم پاسخ، به‌تنهایی درصد جرمی یا حجمی ترکیبات بنزین نیست. ضرایب پاسخ و مبنای گزارش باید مطابق روش تعریف شوند.",
  15:"در FIA طول ناحیه ممکن است طبق روش به سهم حجمی مرتبط شود. مدل نسبت فقط بعد از تأیید رابطهٔ تبدیل و تصحیحات روش قابل استفاده است.",
  29:"مدل تیتراسیون اسید آزاد آماده است؛ هویت اسید، استوکیومتری و نقطهٔ پایانی باید مشخص باشند. نام کلی «اسید آزاد» به‌تنهایی مادهٔ مورد گزارش را تعیین نمی‌کند.",
  38:"کارل‌فیشر و تقطیر دو روش جدا هستند. ابتدا روش واقعی، واحد گزارش و نحوهٔ تصحیح بلانک/رانش را تعیین کنید.",
  52:"ابتدا خروجی را مشخص کنید: چگالی، چگالی نسبی یا API. تبدیل دمای هیدرومتر با این روابط پایه انجام نمی‌شود.",
  54:"مدل اختصاصی گوگرد مرکاپتانی با AgNO₃ آماده است؛ خروجی mg/kg بر مبنای جرم گوگرد است، نه جرم کل مرکاپتان.",
  58:"SG ورودی باید در مبنای ۶۰°F/۶۰°F باشد؛ این مدل جداول تصحیح دما یا فشار را اجرا نمی‌کند.",
  59:"خروجی مستقیم دستگاه و محاسبهٔ مشتق‌شده را جدا انتخاب کنید. سهم دما و کالیبراسیون دستگاه باید در بودجهٔ ورودی‌ها پوشش داده شود.",
  61:"ASTM D6304 کولومتری است. مدل حجمی تنها برای SOP حجمیِ مجزا قابل استفاده است و نباید به D6304 نسبت داده شود.",
  63:"برای هر نقطهٔ بازیافت، دما و بودجهٔ جدا ثبت کنید. منحنی تقطیر مجموعه‌ای از خروجی‌هاست و یک عدد نمایندهٔ تمام آن نیست.",
  72:"جدول مرجع L/H و روابط قطعه‌ای به‌طور خودکار اجرا می‌شوند. شاخه و درون‌یابی در هر نمونهٔ مونت‌کارلو دوباره محاسبه می‌شوند؛ گرانروی ۱۰۰°C کمتر از ۲ مجاز نیست.",
  73:"برای طیف FT-IR باید طول موج/عدد موج یا ویژگی کمی تعریف شود. مدل جذب فقط یک خروجی تک‌نقطه‌ای است، نه عدم‌قطعیت کل طیف.",
  77:"شش خروجی کربن آروماتیکی، نفتنیکی، پارافینی و تعداد حلقه‌ها با روابط قطعه‌ای آماده‌اند. شرط بدون الفین بودن، دمای مرجع و محدودهٔ ترکیب روش باید رعایت شوند.",
  78:"معادلهٔ چهارمتغیرهٔ رویهٔ A آماده است. شاخص ستان برآوردشده با عدد ستان اندازه‌گیری‌شده یکسان نیست؛ نوع سوخت و ممنوعیت تعمیم به بیودیزل/افزایندهٔ ستان را بررسی کنید.",
  79:"مدل EPA برای فرآوردهٔ سبک پالایش‌شده از RVP، شیب D86 و دمای مایع آماده است. برای نفت خام یا هر مخلوط دلخواه به‌کار نرود.",
  81:"مدل اختصاصی KF حجمی کنسانترهٔ کولانت با خروجی درصد جرمی آماده است. درصد جرمی و حجمی آب قابل جایگزینی نیستند.",
};

const scopeEn:Record<number,string>={12:'Corrected GC response percent is not automatically mass or volume percent. Response factors and reporting basis must match the actual method.',15:'In FIA, zone length may be related to volume fraction by the method. Verify conversion and corrections before using a ratio model.',38:'Karl Fischer and distillation are different methods. Select the actual procedure, reporting basis and blank/drift correction.',52:'Choose density, relative density or API. These base models do not perform hydrometer temperature-correction tables.',58:'SG must already be on the 60°F/60°F basis. This model does not perform temperature or pressure correction tables.',59:'Choose the direct instrument result or the derived viscosity relation. Input budgets must cover temperature and instrument calibration.',61:'D6304 is coulometric. A volumetric model is only for a separate volumetric SOP and must not be labelled D6304.',63:'Record a separate temperature and budget at each recovery point. One number does not represent the full distillation curve.',73:'Define the FT-IR wavenumber or quantitative feature. The absorbance model covers one numerical output, not uncertainty of an entire spectrum.'};
export function methodProfile(method: BankMethod,en=false): MethodProfile {
  const qualitative = [11,24,46,53,67,68,69,71,95].includes(method.id);
  const models = assigned[method.id] ?? (method.template ? [method.template] : []);
  const kind = qualitative ? "qualitative" : method.id === 94 ? "sampling" : models.length ? "numeric" : "custom";
  return {
    kind, models:models.filter(key => Boolean(familyModels[key])),
    effects: en ? (qualitative ? ['Visual reference and positive/negative controls','Assessor agreement and repeat tests','Misclassification probability and category boundaries','Method conditions and documented decision rule']
      : kind==='sampling'?['Sampling design, location and lot heterogeneity','Independent duplicate samples and study design','Storage, transport, stability and contamination','Separate sampling variance from analytical variance']
      : [...(familyModels[models[0]]?.inputs.map(input=>`${input.en} (${input.unit||'reporting unit'})`)??[]),'Reference and instrument calibration uncertainty','Method precision, drift, recovery and model discrepancy without double counting','Correlations between shared inputs'])
      : qualitative ? ["مرجع تصویری/شاهد مثبت و منفی","توافق ارزیاب‌ها و تکرار آزمون","احتمال طبقه‌بندی نادرست و مرز رده‌ها","شرایط آزمون و قاعدهٔ تصمیم مطابق روش"]
      : kind === "sampling" ? ["طرح و محل نمونه‌برداری و ناهمگنی محموله","نمونه‌های تکراری مستقل و طراحی آزمایش","نگهداری، حمل، پایداری و آلودگی","تفکیک واریانس نمونه‌برداری از واریانس تحلیل"]
      : effects[models[0]] ?? [...(familyModels[models[0]]?.inputs.map(input=>`${input.fa} (${input.unit||'واحد نتیجه'})`)??[]),"گواهی مرجع و کالیبراسیون ورودی‌ها","آماده‌سازی، بلانک، بازیابی و اثر ماتریس طبق روش","دما، رانش و شرایط عملیاتی دستگاه","تکرارپذیری، بایاس و هم‌بستگی ورودی‌ها"],
    scope: en ? scopeEn[method.id] ?? (qualitative?'This result is qualitative or ordinal. Do not apply U=k×u directly to a category name; assess method validity and decision error separately.'
      : kind==='sampling'?'Sampling is a separate stage; an instrument budget alone does not cover how well a sample represents the lot.'
      : typeof familyModels[models[0]]?.explanation==='object'?(familyModels[models[0]].explanation as {en:string}).en
      : models.length?'A base equation and sensitivities are available. Match inputs and applicability to the actual SOP and instrument; this is not certification of complete ASTM implementation.'
      :'The method-specific equation needs verification. Record the assessment or use an expert budget with a verified equation and sensitivities.')
      : special[method.id] ?? (qualitative ? "این خروجی رده‌ای یا کیفی است. U = k×u را مستقیماً به نام رده اعمال نکنید؛ اعتبار روش و خطای تصمیم باید جدا ارزیابی شوند."
      : kind === "sampling" ? "نمونه‌برداری یک مرحلهٔ مستقل است. بودجهٔ دستگاه به‌تنهایی عدم‌قطعیت نمایندگی نمونه از محموله را پوشش نمی‌دهد."
      : models.length ? "رابطهٔ پایه و ضرایب حساسیت آماده‌اند. مؤلفه‌های مؤثر و دامنهٔ کاربرد باید با SOP و دستگاه واقعی تطبیق داده شوند؛ این وضعیت تأیید اجرای کامل ASTM نیست."
      : "رابطهٔ اختصاصی این روش هنوز تأیید نشده است. پرونده و بودجهٔ عمومی قابل ثبت است، اما فرمول و ضرایب باید از روش معتبر تهیه شوند."),
  };
}

export const profileCounts = bank.reduce((counts, method) => {
  counts[methodProfile(method).kind]++; return counts;
}, {numeric:0,qualitative:0,sampling:0,custom:0});
