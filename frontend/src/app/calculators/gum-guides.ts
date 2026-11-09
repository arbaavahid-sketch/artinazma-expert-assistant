type Text = { fa: string; en: string };
export type GumGuide = { purpose: Text; inputs: Text[]; sections: string };
export const gumGuides: Record<string, GumGuide> = {
  gcExtraction: {
    purpose: {
      fa: "این مدل برای کالیبراسیون خارجی خطی، استخراج یک نمونه و گزارش جرمی است. واحدهای ورودی از پیش مشخص‌اند و فرمول از رابطهٔ مقدار ماده در محلول استخراج و جرم نمونه ساخته شده است.",
      en: "This model uses linear external calibration, sample extraction and mass-based reporting. It combines extract concentration, extract volume and sample mass in fixed units.",
    },
    sections: "§5–8; Appendix C; Appendix E",
    inputs: [
      { fa: "عدم‌قطعیت پاسخ نمونه را در همان واحد A وارد کنید؛ تعداد تزریق و روش برآورد باقی‌ماندهٔ برازش باید مشخص باشد.", en: "Enter sample-response uncertainty in A units, accounting for the replicate and fit-residual basis." },
      { fa: "عدم‌قطعیت استاندارد شیب را از برازش آماری بردارید و هم‌بستگی آن با عرض از مبدأ را نیز ثبت کنید.", en: "Use slope standard uncertainty from regression and record its correlation with the intercept." },
      { fa: "عدم‌قطعیت استاندارد عرض از مبدأ را از همان برازش و در همان واحد مساحت پیک بردارید.", en: "Use intercept standard uncertainty from the same regression in peak-area units." },
      { fa: "سهم حجم نهایی استخراج را از بودجهٔ حجم یا گواهی همراه با اثرهای مرتبط بردارید.", en: "Use final extract volume uncertainty from its volume budget." },
      { fa: "عدم‌قطعیت ضریب رقیق‌سازی را از حجم برداشت و حجم نهایی محاسبه کنید؛ خود ضریب D در ورودی بالای فرم است.", en: "Obtain dilution-factor uncertainty from aliquot and final-volume uncertainties." },
      { fa: "از بودجهٔ توزین، عدم‌قطعیت جرم نمونه را به گرم بردارید.", en: "Use sample mass uncertainty in grams from the weighing budget." },
      { fa: "عدم‌قطعیت بازیابی را در واحد درصد وارد کنید. برای بازیابی ۸۰٪ با عدم‌قطعیت استاندارد ۲ واحد درصد، عدد ۲ را وارد کنید.", en: "Use recovery uncertainty in percentage points, e.g. 2 for an 80% recovery with 2 percentage-point standard uncertainty." },
    ],
  },
  balance: {
    purpose: { fa: "برای یک توزین مستقیم یا میانگین توزین‌های مستقل، سهم‌های جرم را جمع می‌کنیم. اثرهای موجود در تکرارپذیری را دوباره به بودجه اضافه نکنید.", en: "Combine mass contributions for direct weighing or the mean of independent weighings. Avoid re-entering effects already included in repeatability." },
    sections: "§7.11, §8",
    inputs: [
      { fa: "از ابزار آمار، انحراف معیار نمونه s را بردارید. برای نتیجهٔ تک‌توزین، n=1 است؛ برای میانگین، تعداد واقعی توزین‌ها را وارد کنید.", en: "Use sample deviation s from repeat readings. Use n=1 for a single reported weighing or the actual number averaged." },
      { fa: "U و k را از گواهی کالیبراسیون در بار مرتبط بردارید. اگر گواهی mg دارد، برای ورود به g بر ۱۰۰۰ تقسیم کنید.", en: "Use U and its k from the calibration certificate at the relevant load. Divide mg by 1000 to enter g." },
      { fa: "فاصلهٔ دو عدد متوالی نمایشگر، مثلاً ۰٫۰۰۱ گرم. فرم آن را برای یک سهم گردکردن بر √۱۲ تقسیم می‌کند.", en: "Enter the spacing between consecutive display readings, e.g. 0.001 g, for one rounding contribution." },
      { fa: "از سوابق کنترل ترازو، نیم‌عرض بازهٔ تغییر در طول زمان را به گرم وارد کنید. برای ±۰٫۰۰۲ گرم، مقدار ۰٫۰۰۲ است.", en: "Use the drift half-width in grams from check records. For ±0.002 g, enter 0.002." },
      { fa: "اثر دما را از مشخصات دستگاه یا آزمایش به گرم تبدیل کنید. خود دمای اتاق، ورودی این ردیف نیست.", en: "Convert the temperature effect to grams using instrument specifications or experimental data." },
    ],
  },
  density: {
    purpose: { fa: "چگالی از جرم همان نمونه تقسیم بر حجم آن محاسبه می‌شود. فرم ضریب حساسیت هر دو ورودی را از معادله استخراج می‌کند.", en: "Density is the mass divided by the volume of the same sample. The form calculates both sensitivity coefficients." },
    sections: "§5, §8.2",
    inputs: [
      { fa: "از بودجهٔ جرم، عدم‌قطعیت استاندارد u(m) را بردارید. اگر فقط U و k دارید، U/k را حساب کنید یا نوع «گواهی» را انتخاب کنید.", en: "Use standard mass uncertainty u(m). If you have U and k, select the certificate input type." },
      { fa: "از بودجهٔ حجم، u(V) را بردارید. سهم گواهی ظرف به‌تنهایی ممکن است تکرارپذیری و اثر دما را پوشش ندهد.", en: "Use u(V) from the volume budget. Vessel calibration alone may not cover filling repeatability or temperature." },
    ],
  },
  standard: {
    purpose: { fa: "غلظت استاندارد از جرم، خلوص و حجم نهایی محاسبه می‌شود. اعداد نمونهٔ A1 تاریخی‌اند؛ برای نمونهٔ واقعی، دادهٔ گواهی و روش خود را وارد کنید.", en: "Calculate standard concentration from mass, purity and final volume. A1 values are historical reference data." },
    sections: "Example A1",
    inputs: [
      { fa: "عدم‌قطعیت استاندارد جرم را به mg وارد کنید؛ U گواهی را بدون تبدیل به استاندارد وارد نکنید.", en: "Enter standard mass uncertainty in mg, or select certificate conversion for U." },
      { fa: "از گواهی خلوص بردارید. برای ۹۹٫۹۹ ±۰٫۰۱ درصد، اینجا ۰٫۰۱ وارد کنید.", en: "For a purity statement of 99.99 ±0.01%, enter the bound 0.01." },
      { fa: "حد حجم بالن را از گواهی یا مشخصات بردارید. مثلثی بودن، فرض مثال A1 است و باید برای ظرف خود بررسی شود.", en: "Use flask tolerance or certificate data. The triangular assumption belongs to the reference example." },
      { fa: "نیم‌عرض تغییر دمای محیط را به درجهٔ سلسیوس وارد کنید. فرم با ضریب انبساط، اثر حجمی را محاسبه می‌کند.", en: "Enter the temperature half-width in °C. The expansion coefficient converts it to a volume effect." },
      { fa: "از آزمایش چند بار پرکردن، انحراف معیار حجم یک بار پرکردن را به mL وارد کنید.", en: "Use the standard deviation of a single fill volume in mL from repeated fills." },
    ],
  },
  titration: {
    purpose: { fa: "این الگو برای تعیین غلظت NaOH با KHP و نسبت واکنش ۱ به ۱ است. در نمونهٔ A2، تکرارپذیری کل روش جدا لحاظ می‌شود.", en: "This model standardizes NaOH against KHP with 1:1 stoichiometry. A2 includes a separate whole-method repeatability contribution." },
    sections: "Example A2; Errata 2019 p.1",
    inputs: [
      { fa: "عدم‌قطعیت استاندارد جرم خالصِ به‌دست‌آمده از اختلاف دو توزین را به g وارد کنید. تکرارپذیری پوشش‌داده‌شده در کل روش را دوباره نشمارید.", en: "Use standard net mass uncertainty from the two weighings, excluding repeatability already covered by the whole method." },
      { fa: "حد خلوص را بر حسب واحد درصد از گواهی KHP بردارید؛ برای ±۰٫۰۵ درصد، ۰٫۰۵ وارد کنید.", en: "Use the purity half-width in percentage points, e.g. 0.05 for ±0.05%." },
      { fa: "عدم‌قطعیت استاندارد جرم مولی را به g/mol وارد کنید. این عدد می‌تواند از ترکیب سهم جرم‌های اتمی به دست آید.", en: "Use the standard molar-mass uncertainty in g/mol, combined from atomic-weight contributions if applicable." },
      { fa: "حد نسبی حجم‌دهی بورت را به درصد وارد کنید. عدد مرجع ۰٫۱۵ درصد بر مبنای فایل A2 است.", en: "Enter the relative burette volume bound as a percentage. The A2 file uses 0.15%." },
      { fa: "سهم نسبی استاندارد دما را به درصد وارد کنید. فایل A2 برای این سهم، مقدار استاندارد ۰٫۰۳ درصد دارد.", en: "Enter the relative standard temperature contribution in percent. The A2 file uses 0.03%." },
      { fa: "از تکرار مستقل کل تیتراسیون، انحراف معیار نسبی مناسب نتیجه را بردارید. عدد مرجع ۰٫۰۵ درصد است.", en: "Use relative repeatability from independent full titrations on the reporting basis. The reference uses 0.05%." },
    ],
  },
  typeA: {
    purpose: { fa: "این روش عدم‌قطعیت میانگین تکرارهای مستقل را با s/√n به دست می‌آورد. مقدار s و تعداد داده‌های میانگین‌گرفته‌شده را وارد کنید.", en: "This method gives uncertainty of the mean of independent repeats as s/√n." },
    sections: "§7.11",
    inputs: [{ fa: "s را از خروجی انحراف معیار نمونه در ابزار آمار بردارید. n تعداد قرائت‌هایی است که نتیجهٔ گزارش میانگین آن‌هاست.", en: "Use sample standard deviation s. n is the number of readings averaged in the reported result." }],
  },
  gc: {
    purpose: { fa: "این فرم بودجهٔ کالیبراسیون خارجی است. سهم‌ها را در واحد غلظت گزارش‌شده وارد کنید. درصدهای RSD را ابتدا به همان واحد تبدیل کنید. برای مدل استخراج، استاندارد داخلی یا نرمال‌سازی پیک، الگوی اختصاصی لازم است.", en: "This external-calibration budget uses absolute contributions in the reported concentration unit. Convert relative percentages first. Extraction, internal-standard and normalization methods need their own models." },
    sections: "§6–8; Appendix C",
    inputs: [
      { fa: "از ارزیابی عدم‌قطعیت کالیبراسیون، سهم برازش را برای غلظت نمونه بردارید. R² به‌تنهایی این عدد را تعیین نمی‌کند.", en: "Use the calibration-fit uncertainty at the sample concentration. R² alone does not determine this contribution." },
      { fa: "گواهی استاندارد و بودجهٔ تهیهٔ محلول‌های استاندارد را بررسی و سهم آن‌ها را به واحد غلظت نهایی منتقل کنید.", en: "Use the reference-standard certificate and standard-preparation budget, propagated to the final concentration unit." },
      { fa: "از داده‌های مستقل کل روش استفاده کنید. اگر RSD درصدی دارید، سهم مطلق را از |C|×RSD/۱۰۰ به دست آورید.", en: "Use independent whole-method precision data. Convert percentage RSD to an absolute contribution using |C|×RSD/100." },
      { fa: "از بودجهٔ توزین، حجم‌سنجی و استخراج نمونه بردارید. اثرهای پوشش‌داده‌شده در دقت کل روش را دوباره وارد نکنید.", en: "Use the sample weighing, volumetry and extraction budget, excluding effects already covered by method precision." },
      { fa: "از مطالعهٔ بازیابی، مادهٔ مرجع یا بایاس روش برآورد کنید و به واحد خروجی منتقل کنید.", en: "Estimate from recovery, reference-material or bias studies and propagate to the result unit." },
    ],
  },
};
