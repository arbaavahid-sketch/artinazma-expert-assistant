import re
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Iterable, Sequence, Dict, Tuple, Any

# =============================================================================
# 1) Data model
# =============================================================================


@dataclass
class StandardEntry:
    code: str
    title_fa: str
    title_en: str = ""
    domain: List[str] = field(default_factory=list)
    family: str = ""
    standard_type: str = (
        "test_method"  # test_method, specification, practice, guide, calculation, internal_note
    )
    technique: str = ""
    analytes: List[str] = field(default_factory=list)
    matrices: List[str] = field(default_factory=list)
    samples: List[str] = field(default_factory=list)
    measures: str = ""
    principle: str = ""
    execution: List[str] = field(default_factory=list)
    qc: List[str] = field(default_factory=list)
    limitations: List[str] = field(default_factory=list)
    report: str = ""
    when_to_use: str = ""
    when_not_enough: str = ""
    related: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    aliases: List[str] = field(default_factory=list)
    caution: str = (
        "برای کاربرد رسمی، دامنه، نسخه و سال انتشار استاندارد باید از متن رسمی کنترل شود."
    )

    def to_context(self, compact: bool = False) -> str:
        if compact:
            return (
                f"کد: {self.code}\n"
                f"عنوان: {self.title_fa}\n"
                f"نوع: {self.standard_type}\n"
                f"حوزه: {', '.join(self.domain)}\n"
                f"خانواده: {self.family}\n"
                f"تکنیک: {self.technique}\n"
                f"اندازه‌گیری: {self.measures or ', '.join(self.analytes)}\n"
                f"ماتریس: {', '.join(self.matrices or self.samples)}\n"
                f"کاربرد: {self.when_to_use}\n"
                f"محدودیت کلیدی: {self.when_not_enough or (self.limitations[0] if self.limitations else '')}"
            ).strip()

        return f"""
دانش تخصصی استاندارد شناسایی‌شده:
کد استاندارد: {self.code}

عنوان کاربردی:
{self.title_fa}

عنوان/توضیح انگلیسی:
{self.title_en}

نوع استاندارد:
{self.standard_type}

حوزه:
{', '.join(self.domain) if self.domain else 'ثبت نشده'}

خانواده آزمون:
{self.family or 'ثبت نشده'}

تکنیک/روش تحلیلی:
{self.technique or 'ثبت نشده'}

این استاندارد دقیقاً چه چیزی را اندازه‌گیری می‌کند:
{self.measures or 'ثبت نشده'}

آنالیت‌ها/پارامترها:
{format_list(self.analytes)}

نمونه‌ها و ماتریس‌های مناسب:
{format_list(self.samples or self.matrices)}

اصل روش:
{self.principle or 'ثبت نشده'}

نکات اجرایی و آماده‌سازی:
{format_list(self.execution)}

کالیبراسیون و کنترل کیفیت:
{format_list(self.qc)}

تداخل‌ها و محدودیت‌ها:
{format_list(self.limitations)}

گزارش نتیجه:
{self.report or 'طبق روش و واحد تعریف‌شده در استاندارد.'}

چه زمانی روش انتخاب خوبی است:
{self.when_to_use or 'ثبت نشده'}

چه زمانی کافی نیست:
{self.when_not_enough or 'ثبت نشده'}

روش‌ها/استانداردهای مرتبط:
{format_list(self.related)}

احتیاط:
{self.caution}
""".strip()


def format_list(items: Iterable[str]) -> str:
    values = [str(x).strip() for x in items if str(x).strip()]
    return (
        "\n".join(f"- {item}" for item in values)
        if values
        else "- ثبت نشده / وابسته به نسخه روش"
    )


def S(
    code: str,
    title_fa: str,
    *,
    title_en: str = "",
    domain: Sequence[str] = (),
    family: str = "",
    standard_type: str = "test_method",
    technique: str = "",
    analytes: Sequence[str] = (),
    matrices: Sequence[str] = (),
    samples: Sequence[str] = (),
    measures: str = "",
    principle: str = "",
    execution: Sequence[str] = (),
    qc: Sequence[str] = (),
    limitations: Sequence[str] = (),
    report: str = "",
    when_to_use: str = "",
    when_not_enough: str = "",
    related: Sequence[str] = (),
    tags: Sequence[str] = (),
    aliases: Sequence[str] = (),
    caution: Optional[str] = None,
) -> StandardEntry:
    return StandardEntry(
        code=code,
        title_fa=title_fa,
        title_en=title_en,
        domain=list(domain),
        family=family,
        standard_type=standard_type,
        technique=technique,
        analytes=list(analytes),
        matrices=list(matrices),
        samples=list(samples) if samples else list(matrices),
        measures=measures,
        principle=principle,
        execution=list(execution),
        qc=list(qc),
        limitations=list(limitations),
        report=report,
        when_to_use=when_to_use,
        when_not_enough=when_not_enough,
        related=list(related),
        tags=list(tags),
        aliases=list(aliases),
        caution=caution or StandardEntry(code, title_fa).caution,
    )


# =============================================================================
# 2) Common QC templates
# =============================================================================

COMMON_QC_XRF = [
    "کالیبراسیون با استانداردهای ماتریس‌مشابه و نزدیک به محدوده غلظتی نمونه.",
    "Blank، QC sample، duplicate و در صورت امکان CRM.",
    "کنترل drift با check standard و بررسی خروج نمونه از محدوده کالیبراسیون.",
]

COMMON_QC_CHROM = [
    "کالیبراسیون چندنقطه‌ای یا استاندارد معتبر همراه با calibration verification.",
    "Blank، duplicate، کنترل retention time، resolution و carryover.",
    "برای GC/MS استفاده از internal standard/surrogate متناسب با روش.",
]

COMMON_QC_TITRATION = [
    "Blank و duplicate.",
    "استانداردسازی تیترانت و کنترل پاسخ الکترود/endpoint.",
    "کنترل کیفیت حلال، تمیزی ظروف و پایداری محلول‌ها.",
]

COMMON_QC_ICP = [
    "Calibration blank، continuing calibration verification و independent check standard.",
    "Method blank، duplicate، matrix spike و CRM در صورت وجود.",
    "کنترل drift، internal standard و تداخل‌های طیفی/جرمی.",
]

COMMON_QC_SAMPLING = [
    "ثبت محل، زمان، دما، فشار، ظرف، sampler و شرایط نمونه‌برداری.",
    "کنترل نشتی، آلودگی ظرف و chain of custody.",
    "در نمونه‌های چندفازی، representative بودن نمونه باید جداگانه کنترل شود.",
]


# =============================================================================
# 3) Registry
# =============================================================================

STANDARDS: List[StandardEntry] = [
    # -------------------------------------------------------------------------
    # Sulfur: petroleum, fuels, LPG, gas
    # -------------------------------------------------------------------------
    S(
        "ASTM D4294",
        "گوگرد کل در نفت و فرآورده‌های نفتی با EDXRF",
        title_en="Total Sulfur in Petroleum and Petroleum Products by Energy Dispersive X-ray Fluorescence",
        domain=["petroleum", "fuels", "crude"],
        family="sulfur",
        technique="EDXRF",
        analytes=["total sulfur", "گوگرد کل"],
        matrices=[
            "crude oil",
            "diesel",
            "fuel oil",
            "kerosene",
            "gasoline",
            "liquid petroleum products",
        ],
        measures="Total sulfur در نمونه‌های نفتی مایع/تک‌فاز و سازگار با کالیبراسیون.",
        principle="تابش X-ray به نمونه و اندازه‌گیری شدت فلورسانس گوگرد؛ تبدیل سیگنال به غلظت با منحنی کالیبراسیون.",
        execution=[
            "نمونه باید یکنواخت و تک‌فاز باشد.",
            "cup/film، ضخامت، حجم و آلودگی پنجره باید کنترل شود.",
            "برای نمونه‌های فرار یا دارای ذرات، آماده‌سازی/اعتبارسنجی لازم است.",
        ],
        qc=COMMON_QC_XRF,
        limitations=[
            "اثر ماتریس و محدوده کالیبراسیون مهم‌ترین ریسک‌ها هستند.",
            "گونه‌بندی H2S، مرکاپتان، COS یا CS2 انجام نمی‌دهد.",
            "برای گوگرد خیلی پایین ممکن است UVF مناسب‌تر باشد.",
        ],
        report="mg/kg، ppm یا درصد جرمی، طبق روش و محدوده کاری.",
        when_to_use="کنترل کیفیت سریع، غیرتخریبی و روتین گوگرد در سوخت‌ها و فرآورده‌های نفتی.",
        when_not_enough="برای trace sulfur خیلی پایین یا speciation ترکیبات گوگردی کافی نیست.",
        related=["ASTM D5453", "ASTM D2622", "ASTM D7039", "ISO 20847", "ISO 8754"],
        tags=["sulfur", "xrf", "edxrf", "گوگرد", "نفت", "سوخت"],
    ),
    S(
        "ASTM D2622",
        "گوگرد کل با WDXRF",
        domain=["petroleum", "fuels"],
        family="sulfur",
        technique="WDXRF",
        analytes=["total sulfur"],
        matrices=["liquid petroleum products", "fuels"],
        measures="Total sulfur با تفکیک طول موجی XRF.",
        principle="اندازه‌گیری فلورسانس گوگرد با سیستم wavelength-dispersive.",
        execution=["نمونه یکنواخت، cup و film ثابت.", "کالیبراسیون ماتریس‌مشابه."],
        qc=COMMON_QC_XRF,
        limitations=[
            "اثر ماتریس و جذب/پراکندگی X-ray.",
            "LOD وابسته به دستگاه و برنامه اندازه‌گیری.",
        ],
        report="mg/kg یا درصد جرمی.",
        when_to_use="وقتی تفکیک و دقت بهتر از EDXRF معمولی لازم باشد.",
        related=["ASTM D4294", "ASTM D7039", "ISO 20884"],
    ),
    S(
        "ASTM D5453",
        "گوگرد کل با احتراق و UV Fluorescence",
        domain=["petroleum", "fuels"],
        family="sulfur",
        technique="Combustion UV Fluorescence",
        analytes=["total sulfur"],
        matrices=[
            "liquid hydrocarbons",
            "gasoline",
            "diesel",
            "naphtha",
            "kerosene",
            "oils",
        ],
        measures="Total sulfur در هیدروکربن‌ها و سوخت‌های سازگار با تزریق/احتراق.",
        principle="احتراق نمونه، تبدیل گوگرد به SO2 و اندازه‌گیری سیگنال UV fluorescence.",
        execution=[
            "تزریق نمونه باید دقیق و تکرارپذیر باشد.",
            "احتراق کامل، کیفیت گازها، تمیزی مسیر و کنترل carryover حیاتی است.",
        ],
        qc=[
            "کالیبراسیون با استاندارد گوگرد در محدوده کاری.",
            "Blank، check standard، duplicate و recovery.",
            "کنترل baseline و drift.",
        ],
        limitations=[
            "کیفیت احتراق و آلودگی مسیر اثر مستقیم دارد.",
            "گونه‌بندی گوگرد انجام نمی‌دهد.",
            "نمونه‌های سنگین/نمکی/دارای ذرات نیاز به اعتبارسنجی دارند.",
        ],
        report="معمولاً mg/kg یا ppm.",
        when_to_use="برای گوگرد پایین‌تر و حساس‌تر در بسیاری از سوخت‌ها.",
        when_not_enough="برای تشخیص نوع ترکیبات گوگردی باید GC-SCD/FPD/PFPD یا روش گونه‌ای استفاده شود.",
        related=["ISO 20846", "ASTM D4294", "ASTM D6667"],
        tags=["uvf", "low sulfur", "ulsd", "گوگرد پایین"],
    ),
    S(
        "ASTM D7039",
        "گوگرد کل با Monochromatic WDXRF",
        domain=["petroleum", "fuels"],
        family="sulfur",
        technique="MWDXRF",
        analytes=["total sulfur"],
        matrices=["gasoline", "diesel", "fuel oils", "petroleum products"],
        measures="Total sulfur با XRF تک‌فام و تداخل کمتر.",
        principle="پرتو تک‌فام و سیستم wavelength-dispersive برای افزایش انتخاب‌پذیری سیگنال گوگرد.",
        execution=["cup/film/حجم ثابت.", "نمونه یکنواخت و بدون ذرات معلق."],
        qc=COMMON_QC_XRF,
        limitations=["ماتریس و محدوده کالیبراسیون همچنان تعیین‌کننده‌اند."],
        report="mg/kg یا ppm.",
        when_to_use="برای کنترل سریع گوگرد با عملکرد بهتر از XRF معمولی در بسیاری از سوخت‌ها.",
        related=["ASTM D4294", "ASTM D2622"],
    ),
    S(
        "ASTM D6667",
        "گوگرد فرار کل در گازها و LPG",
        domain=["lpg", "gas"],
        family="sulfur",
        technique="Combustion/UVF or instrument-specific",
        analytes=["total volatile sulfur", "volatile sulfur"],
        matrices=["LPG", "light hydrocarbon gases"],
        measures="Total volatile sulfur در LPG و گازهای هیدروکربنی سبک.",
        principle="ورود کنترل‌شده نمونه فرار به سیستم، تبدیل ترکیبات گوگردی به SO2 و اندازه‌گیری سیگنال.",
        execution=[
            "نمونه‌برداری نماینده از سیلندر/خط مهم‌ترین بخش روش است.",
            "فشار، dead volume، نشتی، جذب سطحی و تبخیر باید کنترل شود.",
            "رگولاتور و خطوط inert/تمیز استفاده شود.",
        ],
        qc=[
            "کالیبراسیون با استاندارد گازی/مایع معتبر.",
            "Leak test، blank، check standard، duplicate و carryover check.",
        ],
        limitations=[
            "H2S، مرکاپتان، COS و CS2 در نمونه‌برداری رفتار متفاوت دارند.",
            "Total است و الزاماً گونه‌بندی نمی‌دهد.",
        ],
        report="ppm، mg/kg یا واحد حجمی/جرمی طبق روش.",
        when_to_use="کنترل Total sulfur در LPG و گازهای سبک.",
        when_not_enough="برای speciation از ASTM D5504 یا GC با دتکتور اختصاصی استفاده شود.",
        related=["ASTM D5504", "ASTM D7551", "ASTM D1265"],
    ),
    S(
        "ASTM D7551",
        "گوگرد فرار در گازهای هیدروکربنی و LPG",
        domain=["lpg", "gas"],
        family="sulfur",
        technique="Gas/LPG sulfur analyzer",
        analytes=["volatile sulfur", "total sulfur"],
        matrices=["LPG", "hydrocarbon gases"],
        measures="گوگرد فرار یا گوگرد کل در گاز/LPG، بسته به نسخه و پیکربندی روش.",
        principle="تزریق کنترل‌شده گاز/LPG و تبدیل/تشخیص ترکیبات گوگردی با دتکتور مناسب.",
        execution=[
            "کنترل فشار و مسیر نمونه.",
            "جلوگیری از نشتی، جذب سطحی و fractionation.",
        ],
        qc=["استاندارد گازی معتبر، blank، leak check، duplicate."],
        limitations=["نماینده بودن نمونه در LPG چالش اصلی است."],
        report="ppm، mg/kg یا واحد حجمی.",
        when_to_use="برای کنترل گوگرد در LPG/گاز با سیستم‌های اختصاصی.",
        related=["ASTM D6667", "ASTM D5504"],
    ),
    S(
        "ASTM D5504",
        "گونه‌بندی ترکیبات گوگردی در گاز طبیعی و سوخت‌های گازی با GC",
        domain=["gas", "lpg"],
        family="sulfur speciation",
        technique="GC-SCD/FPD/PFPD",
        analytes=[
            "H2S",
            "mercaptans",
            "sulfides",
            "COS",
            "CS2",
            "volatile sulfur compounds",
        ],
        matrices=["natural gas", "fuel gas", "hydrocarbon gas"],
        measures="ترکیبات گوگردی منفرد و گاهی مجموع گوگرد گونه‌ای.",
        principle="جداسازی ترکیبات گوگردی با GC و اندازه‌گیری با دتکتور اختصاصی گوگرد.",
        execution=[
            "سیلندر و خطوط inert برای sulfur species.",
            "کنترل نشتی، جذب سطحی و retention time.",
            "برنامه دمایی/ستون باید تفکیک کافی بدهد.",
        ],
        qc=COMMON_QC_CHROM,
        limitations=[
            "نمونه‌برداری ضعیف می‌تواند نتیجه را شدیداً تغییر دهد.",
            "برخی ترکیبات گوگردی ناپایدار یا جذب‌شونده‌اند.",
        ],
        report="غلظت هر ترکیب جداگانه و در صورت نیاز مجموع.",
        when_to_use="وقتی H2S، مرکاپتان، COS، CS2 یا گونه‌بندی گوگرد مهم است.",
        related=["ASTM D6667", "ASTM D7551", "UOP 163"],
    ),
    S(
        "ASTM D5623",
        "ترکیبات گوگردی در مایعات نفتی سبک با GC",
        domain=["fuels", "petroleum"],
        family="sulfur speciation",
        technique="GC sulfur-selective detector",
        analytes=["sulfur species", "mercaptans", "sulfides", "thiophenes"],
        matrices=["gasoline", "naphtha", "light petroleum liquids"],
        measures="گونه‌های گوگردی در مایعات سبک.",
        principle="جداسازی GC و تشخیص با دتکتور انتخابی گوگرد.",
        execution=[
            "رقیق‌سازی و آماده‌سازی برای جلوگیری از overload.",
            "کنترل co-elution و retention time.",
        ],
        qc=COMMON_QC_CHROM,
        limitations=[
            "برای total sulfur ساده، XRF یا UVF سریع‌تر است.",
            "همپوشانی پیک‌ها می‌تواند خطا ایجاد کند.",
        ],
        report="غلظت هر گونه گوگردی یا مجموع.",
        when_to_use="وقتی نوع ترکیب گوگردی مهم‌تر از Total sulfur است.",
        related=["ASTM D5453", "ASTM D3227", "ASTM D5504"],
    ),
    S(
        "ASTM D3227",
        "Mercaptan Sulfur در سوخت‌ها",
        domain=["fuels"],
        family="sulfur speciation",
        technique="Potentiometric titration",
        analytes=["mercaptan sulfur", "thiol sulfur"],
        matrices=["gasoline", "kerosene", "aviation turbine fuel", "distillate fuels"],
        measures="Mercaptan sulfur، نه total sulfur.",
        principle="تیتراسیون پتانسیومتری مرکاپتان‌ها طبق روش.",
        execution=[
            "نمونه تازه و بدون loss ترکیبات فرار.",
            "کنترل endpoint/الکترود و حذف/کنترل H2S در صورت مزاحمت.",
        ],
        qc=COMMON_QC_TITRATION,
        limitations=[
            "Total sulfur نیست.",
            "برای H2S، COS، CS2 و سایر گونه‌ها کافی نیست.",
        ],
        report="mg/kg یا ppm به عنوان sulfur.",
        when_to_use="کنترل mercaptan در سوخت‌های سبک.",
        related=["UOP 163", "ASTM D5504", "ASTM D5623"],
    ),
    S(
        "ASTM D5705",
        "H2S در فاز بخار بالای سوخت‌های باقیمانده",
        domain=["fuels", "hse"],
        family="H2S",
        technique="Field headspace measurement",
        analytes=["hydrogen sulfide", "H2S"],
        matrices=["residual fuel oil", "heavy fuel oil"],
        measures="H2S در فاز بخار equilibrium headspace.",
        principle="اندازه‌گیری میدانی H2S در فضای بخار بالای نمونه سوخت سنگین.",
        execution=[
            "نمونه باید با ایمنی H2S مدیریت شود.",
            "دما، زمان تعادل و ظرف/هداسپیس روی نتیجه اثر دارد.",
        ],
        qc=["کنترل دستگاه/سنسور، blank یا هوای صفر، check gas در صورت امکان."],
        limitations=[
            "نتیجه فاز بخار با H2S مایع یکی نیست.",
            "H2S فرار و واکنش‌پذیر است؛ زمان و شرایط نمونه‌برداری مهم‌اند.",
        ],
        report="ppm v/v یا واحد روش.",
        when_to_use="ارزیابی ریسک H2S در headspace سوخت‌های باقیمانده.",
        related=["ASTM D7621"],
    ),
    S(
        "ASTM D7621",
        "H2S در فاز مایع سوخت‌های نفتی",
        domain=["fuels", "hse"],
        family="H2S",
        technique="Liquid phase H2S analyzer",
        analytes=["hydrogen sulfide", "H2S"],
        matrices=[
            "marine residual fuels",
            "fuel oil",
            "blend stocks",
            "marine distillate fuels",
        ],
        measures="H2S در فاز مایع سوخت.",
        principle="آزادسازی/اندازه‌گیری H2S از فاز مایع با دستگاه اختصاصی.",
        execution=[
            "ایمنی H2S، نمونه‌برداری تازه و جلوگیری از loss ضروری است.",
            "ویسکوزیته و دما باید مطابق دامنه روش کنترل شود.",
        ],
        qc=["check standard/gas، duplicate و کنترل پاسخ دستگاه."],
        limitations=[
            "اندازه‌گیری H2S به زمان و شرایط نمونه‌برداری وابسته است.",
            "نتیجه liquid phase را با vapor phase یکی فرض نکنید.",
        ],
        report="mg/kg یا واحد روش.",
        when_to_use="کنترل H2S محلول/فاز مایع در fuel oil و سوخت‌های دریایی.",
        related=["ASTM D5705", "ISO 8217"],
    ),
    S(
        "ASTM D1266",
        "گوگرد با Lamp Method",
        domain=["fuels"],
        family="sulfur",
        technique="Lamp combustion",
        analytes=["total sulfur"],
        matrices=["light petroleum products", "fuels"],
        measures="Total sulfur با روش کلاسیک احتراق/لامپ.",
        principle="سوزاندن نمونه و اندازه‌گیری محصولات گوگردی.",
        execution=["کنترل احتراق کامل و جلوگیری از تلفات."],
        qc=["Blank و duplicate."],
        limitations=[
            "زمان‌بر و اپراتورمحور؛ برای گوگرد پایین روش‌های جدید مناسب‌ترند."
        ],
        report="Total sulfur.",
        when_to_use="وقتی روش کلاسیک در سیستم کیفیت الزام شده باشد.",
        related=["ASTM D5453", "ASTM D4294"],
    ),
    S(
        "ASTM D129",
        "گوگرد با Bomb Method",
        domain=["petroleum"],
        family="sulfur",
        technique="Oxygen bomb",
        analytes=["total sulfur"],
        matrices=["petroleum products"],
        measures="Total sulfur با اکسیداسیون در بمب اکسیژن.",
        principle="اکسیداسیون نمونه در بمب و اندازه‌گیری محصولات گوگردی.",
        execution=["ایمنی بمب اکسیژن و شست‌وشوی کامل محصولات احتراق."],
        qc=["Blank، duplicate و recovery."],
        limitations=[
            "زمان‌بر؛ برای روتین مدرن معمولاً ابزارهای سریع‌تر انتخاب می‌شوند."
        ],
        report="Total sulfur.",
        when_to_use="روش کلاسیک/مرجع داخلی.",
        related=["ASTM D5453", "ASTM D1552"],
    ),
    S(
        "ASTM D1552",
        "گوگرد با اکسیداسیون دمای بالا",
        domain=["petroleum", "fuels"],
        family="sulfur",
        technique="High-temperature combustion",
        analytes=["total sulfur"],
        matrices=["petroleum products", "oils"],
        measures="Total sulfur با اکسیداسیون دمای بالا.",
        principle="اکسیداسیون نمونه و اندازه‌گیری محصولات گوگردی.",
        execution=["احتراق کامل، تمیزی مسیر و تزریق پایدار."],
        qc=["Calibration، blank، duplicate، check standard."],
        limitations=["ماتریس و احتراق روی نتیجه اثر دارند."],
        report="Total sulfur.",
        when_to_use="نمونه‌های سازگار با روش احتراقی.",
        related=["ASTM D5453"],
    ),
    S(
        "ISO 20847",
        "گوگرد در فرآورده‌های نفتی با EDXRF",
        domain=["fuels", "petroleum"],
        family="sulfur",
        technique="EDXRF",
        analytes=["total sulfur"],
        matrices=["petroleum products", "fuels"],
        measures="Total sulfur با EDXRF.",
        principle="فلورسانس X-ray گوگرد و کالیبراسیون.",
        execution=["cup/film مناسب، یکنواختی و حجم ثابت."],
        qc=COMMON_QC_XRF,
        limitations=["اثر ماتریس و محدوده کاری."],
        report="mg/kg یا درصد جرمی.",
        when_to_use="کنترل سریع گوگرد در سوخت‌ها.",
        related=["ASTM D4294"],
    ),
    S(
        "ISO 8754",
        "گوگرد در فرآورده‌های نفتی با XRF",
        domain=["fuels", "petroleum"],
        family="sulfur",
        technique="XRF",
        analytes=["total sulfur"],
        matrices=["petroleum products"],
        measures="Total sulfur با XRF.",
        principle="اندازه‌گیری سیگنال XRF گوگرد.",
        execution=["نمونه یکنواخت، cup تمیز و کالیبراسیون مناسب."],
        qc=COMMON_QC_XRF,
        limitations=["ماتریس و کالیبراسیون."],
        report="mg/kg یا درصد جرمی.",
        when_to_use="روش سریع XRF برای فرآورده‌های نفتی.",
        related=["ASTM D4294", "ISO 20847"],
    ),
    S(
        "ISO 20846",
        "گوگرد با UV Fluorescence",
        domain=["fuels", "petroleum"],
        family="sulfur",
        technique="Combustion UV Fluorescence",
        analytes=["total sulfur"],
        matrices=["petroleum products", "fuels"],
        measures="Total sulfur با احتراق و UVF.",
        principle="تبدیل گوگرد به SO2 و اندازه‌گیری UV fluorescence.",
        execution=["تزریق دقیق، احتراق کامل، گاز تمیز."],
        qc=["Calibration، blank، check standard، duplicate."],
        limitations=["ماتریس سنگین/آلوده می‌تواند مسیر احتراق را تحت تأثیر قرار دهد."],
        report="mg/kg یا ppm.",
        when_to_use="برای گوگرد پایین در سوخت‌ها.",
        related=["ASTM D5453"],
    ),
    S(
        "ISO 20884",
        "گوگرد با WDXRF",
        domain=["fuels", "petroleum"],
        family="sulfur",
        technique="WDXRF",
        analytes=["total sulfur"],
        matrices=["petroleum products"],
        measures="Total sulfur با WDXRF.",
        principle="فلورسانس گوگرد با تفکیک طول موجی.",
        execution=["کالیبراسیون ماتریس‌مشابه و cup ثابت."],
        qc=COMMON_QC_XRF,
        limitations=["اثر ماتریس و محدوده کالیبراسیون."],
        report="mg/kg یا درصد جرمی.",
        when_to_use="وقتی XRF دقیق‌تر لازم است.",
        related=["ASTM D2622"],
    ),
    S(
        "ISO 14596",
        "گوگرد با WDXRF در فرآورده‌های نفتی",
        domain=["fuels", "petroleum"],
        family="sulfur",
        technique="WDXRF",
        analytes=["total sulfur"],
        matrices=["petroleum products"],
        measures="Total sulfur با WDXRF.",
        principle="اندازه‌گیری XRF طول موجی.",
        execution=["کنترل cup، film، حجم نمونه و کالیبراسیون."],
        qc=COMMON_QC_XRF,
        limitations=["برای غلظت خیلی پایین باید LOQ دستگاه بررسی شود."],
        report="mg/kg.",
        when_to_use="کنترل گوگرد با WDXRF.",
        related=["ASTM D2622"],
    ),
    # -------------------------------------------------------------------------
    # Gas, LPG, composition, specifications and sampling
    # -------------------------------------------------------------------------
    S(
        "ASTM D1945",
        "آنالیز ترکیب گاز طبیعی با GC",
        domain=["gas"],
        family="gas composition",
        technique="GC",
        analytes=[
            "methane",
            "ethane",
            "propane",
            "butanes",
            "nitrogen",
            "CO2",
            "H2S",
            "hydrogen",
            "helium",
            "oxygen",
        ],
        matrices=["natural gas", "fuel gas"],
        measures="ترکیب شیمیایی گاز طبیعی و مخلوط‌های گازی مشابه.",
        principle="جداسازی اجزای گاز با GC و محاسبه درصد مولی/حجمی.",
        execution=[
            "نمونه‌برداری نماینده، سیلندر مناسب، کنترل فشار و نشتی.",
            "کالیبراسیون با استاندارد گازی معتبر.",
        ],
        qc=["Calibration gas، retention time check، duplicate، leak check."],
        limitations=[
            "نشتی یا نمونه‌برداری غیرنماینده ترکیب را تغییر می‌دهد.",
            "برای ترکیبات گوگردی trace ممکن است روش اختصاصی لازم باشد.",
        ],
        report="درصد مولی/حجمی اجزا.",
        when_to_use="تعیین ترکیب گاز و ورودی محاسبات ارزش حرارتی.",
        related=["ASTM D3588", "GPA 2261", "ISO 6974"],
    ),
    S(
        "ASTM D2163",
        "آنالیز LPG و پروپن کنسانتره با GC",
        domain=["lpg"],
        family="lpg composition",
        technique="GC",
        analytes=["propane", "propylene", "butanes", "butenes", "light hydrocarbons"],
        matrices=["LPG", "propane", "butane", "propylene concentrate"],
        measures="ترکیب هیدروکربنی LPG.",
        principle="تفکیک اجزای LPG با GC و کمی‌سازی با استاندارد.",
        execution=[
            "نمونه‌برداری تحت فشار و جلوگیری از تبخیر انتخابی.",
            "تزریق کنترل‌شده و مسیر تمیز/مناسب LPG.",
        ],
        qc=["استاندارد LPG/گازی، leak test، blank، duplicate، retention time."],
        limitations=["تبخیر ناقص یا fractionation باعث خطای جدی می‌شود."],
        report="درصد مولی یا حجمی اجزا.",
        when_to_use="کنترل ترکیب LPG و کیفیت تجاری آن.",
        related=["ASTM D1265", "ASTM D1835"],
    ),
    S(
        "ASTM D1265",
        "نمونه‌برداری LPG",
        domain=["lpg", "sampling"],
        family="sampling",
        standard_type="practice",
        technique="Pressurized sampling",
        analytes=["representative sample"],
        matrices=["LPG", "liquefied petroleum gases"],
        measures="راهنمای گرفتن نمونه نماینده LPG برای آزمون‌های بعدی.",
        principle="نمونه‌برداری بدون تغییر ترکیب به دلیل تبخیر، نشتی یا fractionation.",
        execution=[
            "سیلندر مناسب، purging، کنترل فشار، برچسب‌گذاری و ایمنی.",
            "نمونه‌برداری توسط فرد آموزش‌دیده.",
        ],
        qc=COMMON_QC_SAMPLING,
        limitations=["نمونه‌برداری اشتباه تمام نتایج بعدی را بی‌اعتبار می‌کند."],
        report="اطلاعات نمونه‌برداری و شرایط سیلندر.",
        when_to_use="قبل از هر آزمون قابل اعتماد روی LPG.",
        related=["ASTM D2163", "ASTM D1835", "ASTM D6667"],
    ),
    S(
        "ASTM D3700",
        "نمونه‌برداری LPG با Floating Piston Cylinder",
        domain=["lpg", "sampling"],
        family="sampling",
        standard_type="practice",
        technique="Floating piston cylinder",
        analytes=["representative sample"],
        matrices=["LPG", "volatile liquid hydrocarbons"],
        measures="نمونه‌برداری از هیدروکربن‌های مایع فرار با سیلندر پیستون شناور.",
        principle="حفظ نمونه تحت فشار برای جلوگیری از flashing و fractionation.",
        execution=["purging، فشار پیستون، leak check و ایمنی باید دقیق کنترل شود."],
        qc=COMMON_QC_SAMPLING,
        limitations=[
            "سیلندر آلوده یا pressure management ضعیف ترکیب LPG را تغییر می‌دهد."
        ],
        report="sampling conditions and cylinder ID.",
        when_to_use="برای LPG/condensate فرار که سیلندر معمولی ممکن است ترکیب را تغییر دهد.",
        related=["ASTM D1265", "ASTM D6849", "ASTM D2163"],
    ),
    S(
        "ASTM D6849",
        "نگهداری و استفاده از نمونه‌های LPG در سیلندر",
        domain=["lpg", "sampling"],
        family="sample handling",
        standard_type="practice",
        technique="Cylinder storage/handling",
        analytes=["sample integrity"],
        matrices=["LPG samples"],
        measures="راهنمای storage/use نمونه LPG در سیلندرهای نمونه‌برداری.",
        principle="کنترل شرایط نگهداری، فشار و مصرف نمونه بدون تغییر ترکیب.",
        execution=["دمای نگهداری، نشتی، headspace و سازگاری cylinder باید کنترل شود."],
        qc=COMMON_QC_SAMPLING,
        limitations=[
            "نمونه LPG در اثر نشتی، adsorption یا fractionation ممکن است تغییر کند."
        ],
        report="شرایط نگهداری و استفاده از سیلندر.",
        when_to_use="بعد از D1265/D3700 تا زمان آزمون LPG.",
        related=["ASTM D1265", "ASTM D3700"],
    ),
    S(
        "ASTM D1835",
        "مشخصات LPG",
        domain=["lpg"],
        family="specification",
        standard_type="specification",
        technique="Specification",
        analytes=["composition", "vapor pressure", "residue", "corrosion", "sulfur"],
        matrices=["commercial LPG", "propane", "butane"],
        measures="حدود پذیرش/کیفیت LPG با ارجاع به روش‌های آزمون.",
        principle="Specification است، نه یک آزمون منفرد؛ نتایج روش‌های مختلف با حدود استاندارد مقایسه می‌شوند.",
        execution=[
            "انتخاب آزمون‌های ترکیب، فشار بخار، خوردگی، residue و گوگرد طبق نیاز."
        ],
        qc=["نمونه‌برداری صحیح و استفاده از روش‌های معتبر."],
        limitations=["خود D1835 مقدار یک پارامتر را اندازه‌گیری نمی‌کند."],
        report="Pass/Fail یا جدول انطباق با مشخصات.",
        when_to_use="ارزیابی انطباق LPG با مشخصات تجاری/کیفی.",
        related=["ASTM D1265", "ASTM D2163", "ASTM D1838", "ASTM D2158"],
    ),
    S(
        "ASTM D1838",
        "خوردگی نوار مسی توسط LPG",
        domain=["lpg", "corrosion"],
        family="corrosion",
        technique="Copper strip",
        analytes=["copper strip corrosion"],
        matrices=["LPG"],
        measures="خاصیت خورندگی LPG نسبت به نوار مسی.",
        principle="قرارگیری نوار مسی در تماس با LPG و مقایسه تغییر رنگ با استاندارد rating.",
        execution=["تمیزی نوار، زمان، دما و ایمنی فشار مهم است."],
        qc=["کنترل شرایط آزمون و نوار/استاندارد مناسب."],
        limitations=["نتیجه کیفی/طبقه‌ای است و عامل خورنده را مشخص نمی‌کند."],
        report="Copper strip rating.",
        when_to_use="کنترل وجود ترکیبات خورنده در LPG.",
        related=["ASTM D130", "ASTM D1835"],
    ),
    S(
        "ASTM D2158",
        "Residues در LPG",
        domain=["lpg"],
        family="residue",
        technique="Evaporation residue",
        analytes=["residue", "oil stain"],
        matrices=["LPG"],
        measures="باقیمانده‌های تبخیر و مواد سنگین در LPG.",
        principle="تبخیر کنترل‌شده نمونه و بررسی residue/oil stain.",
        execution=["ایمنی، کنترل تبخیر و ظرف تمیز."],
        qc=["Blank، duplicate و کنترل ظروف."],
        limitations=["آلودگی ظرف یا نمونه غیرنماینده نتیجه را تغییر می‌دهد."],
        report="مقدار residue یا مشاهده کیفی طبق روش.",
        when_to_use="کنترل آلودگی سنگین در LPG.",
        related=["ASTM D1835"],
    ),
    S(
        "ASTM D1657",
        "چگالی LPG با Pressure Hydrometer",
        domain=["lpg", "physical"],
        family="density",
        technique="Pressure hydrometer",
        analytes=["density", "relative density"],
        matrices=["LPG", "light hydrocarbons under pressure"],
        measures="چگالی/relative density گازهای مایع سبک.",
        principle="خواندن هیدرومتر فشاری در شرایط کنترل‌شده.",
        execution=["کنترل فشار، دما و ایمنی."],
        qc=["هیدرومتر کالیبره، کنترل دما، duplicate."],
        limitations=["تبخیر یا نمونه‌برداری نامناسب نتیجه را تغییر می‌دهد."],
        report="density یا relative density در دمای مشخص.",
        when_to_use="کنترل مشخصات فیزیکی LPG.",
        related=["ASTM D1265"],
    ),
    S(
        "ASTM D2420",
        "H2S در LPG با Lead Acetate",
        domain=["lpg", "sulfur", "hse"],
        family="H2S",
        technique="Lead acetate indication",
        analytes=["hydrogen sulfide", "H2S"],
        matrices=["LPG"],
        measures="Hydrogen sulfide در LPG به روش کیفی/نیمه‌کمی بسته به اجرا.",
        principle="واکنش H2S با lead acetate و ایجاد تغییر رنگ/اثر قابل مشاهده.",
        execution=["نمونه‌برداری تحت فشار، ایمنی H2S و fresh sample ضروری است."],
        qc=["کنترل reagent، blank و positive check در صورت امکان."],
        limitations=["برای اندازه‌گیری دقیق یا speciation گوگرد، GC/UVF مناسب‌تر است."],
        report="وجود/عدم وجود یا نتیجه مطابق روش.",
        when_to_use="screening سریع H2S در LPG.",
        related=["ASTM D5504", "ASTM D6667", "ASTM D1265"],
    ),
    S(
        "ASTM D2598",
        "محاسبه خواص فیزیکی LPG از ترکیب",
        domain=["lpg"],
        family="calculation",
        standard_type="calculation",
        technique="Calculation from composition",
        analytes=["density", "vapor pressure", "heating value"],
        matrices=["LPG"],
        measures="محاسبه برخی خواص LPG از ترکیب کروماتوگرافی.",
        principle="استفاده از composition برای محاسبه خواص فیزیکی/ترمودینامیکی.",
        execution=["داده ترکیب باید دقیق، نرمال‌شده و representative باشد."],
        qc=["کنترل D2163 و نرمال‌سازی اجزا."],
        limitations=["خطای composition مستقیماً وارد محاسبات می‌شود."],
        report="خواص محاسبه‌شده طبق روش.",
        when_to_use="وقتی ترکیب LPG موجود است و خواص محاسباتی لازم است.",
        related=["ASTM D2163"],
    ),
    S(
        "ASTM D3588",
        "محاسبه ارزش حرارتی و خواص گاز",
        domain=["gas"],
        family="calculation",
        standard_type="calculation",
        technique="Calculation from composition",
        analytes=["heating value", "relative density", "compressibility"],
        matrices=["natural gas", "fuel gas"],
        measures="Heating value، relative density و خواص گاز بر اساس ترکیب.",
        principle="محاسبه خواص از داده ترکیب گاز.",
        execution=["کیفیت ترکیب ورودی و نرمال‌سازی اجزا مهم است."],
        qc=["کنترل صحت GC و جمع درصدها."],
        limitations=["اگر ترکیب دقیق نباشد، محاسبات هم قابل اتکا نیست."],
        report="HHV/LHV، relative density و خواص مرتبط.",
        when_to_use="پس از آنالیز گاز برای محاسبات انرژی/فروش.",
        related=["ASTM D1945", "ISO 6976", "GPA 2172"],
    ),
    S(
        "ISO 6974",
        "آنالیز ترکیب گاز طبیعی با GC",
        domain=["gas"],
        family="gas composition",
        technique="GC",
        analytes=["natural gas composition"],
        matrices=["natural gas"],
        measures="ترکیب گاز طبیعی با GC.",
        principle="جداسازی و کمی‌سازی اجزای گاز.",
        execution=["نمونه‌برداری و کالیبراسیون گازی معتبر."],
        qc=["Calibration gas، drift check، duplicate."],
        limitations=["برای sulfur trace روش اختصاصی لازم است."],
        report="درصد مولی اجزا.",
        when_to_use="ترکیب گاز طبیعی و محاسبات بعدی.",
        related=["ASTM D1945", "ISO 6976"],
    ),
    S(
        "ISO 6976",
        "محاسبه ارزش حرارتی گاز طبیعی",
        domain=["gas"],
        family="calculation",
        standard_type="calculation",
        technique="Calculation",
        analytes=["calorific value", "Wobbe index", "density"],
        matrices=["natural gas"],
        measures="Calorific value، density، relative density و Wobbe index از ترکیب گاز.",
        principle="محاسبه خواص از composition.",
        execution=["composition معتبر و basis مناسب لازم است."],
        qc=["کنترل نرمال‌سازی و صحت اجزا."],
        limitations=["خطای ترکیب ورودی به محاسبه منتقل می‌شود."],
        report="HHV/LHV، Wobbe index، density.",
        when_to_use="محاسبه کیفیت انرژی گاز.",
        related=["ASTM D3588", "ISO 6974"],
    ),
    # -------------------------------------------------------------------------
    # Crude oil: water, salt, sediment, BS&W, asphaltene, wax, distillation
    # -------------------------------------------------------------------------
    S(
        "ASTM D4006",
        "آب در نفت خام با تقطیر",
        domain=["crude"],
        family="water",
        technique="Distillation",
        analytes=["water"],
        matrices=["crude oil"],
        measures="Water content در نفت خام با تقطیر.",
        principle="هم‌تقطیر آب و حلال/نفت و جمع‌آوری آب در trap.",
        execution=[
            "همگن‌سازی نمونه و کنترل جوش/تقطیر.",
            "تمیزی trap و جلوگیری از امولسیون مهم است.",
        ],
        qc=["Blank، duplicate، کنترل بازیابی آب."],
        limitations=[
            "برای آب بسیار کم یا نمونه‌های مشکل‌دار ممکن است KF مناسب‌تر باشد."
        ],
        report="درصد حجمی/جرمی آب طبق روش.",
        when_to_use="اندازه‌گیری روتین آب در crude.",
        related=["ASTM D4377", "ASTM D6304", "ASTM D1796", "ASTM D4007"],
    ),
    S(
        "ASTM D4377",
        "آب در نفت خام با Karl Fischer",
        domain=["crude"],
        family="water",
        technique="Karl Fischer titration",
        analytes=["water"],
        matrices=["crude oil"],
        measures="Water در نفت خام با KF.",
        principle="تیتراسیون Karl Fischer برای آب.",
        execution=[
            "نمونه باید همگن و representative باشد.",
            "حلال/روش استخراج آب از ماتریس نفتی مهم است.",
        ],
        qc=COMMON_QC_TITRATION,
        limitations=[
            "ماتریس و واکنش‌های مزاحم می‌توانند endpoint/recovery را تحت تأثیر قرار دهند."
        ],
        report="mg/kg یا درصد آب.",
        when_to_use="برای آب پایین‌تر یا نیاز به دقت بهتر نسبت به روش‌های حجمی.",
        related=["ASTM D6304", "ASTM D4006"],
    ),
    S(
        "ASTM D6304",
        "آب در فرآورده‌های نفتی با Karl Fischer",
        domain=["petroleum", "fuels", "lubricants"],
        family="water",
        technique="Karl Fischer titration",
        analytes=["water"],
        matrices=["petroleum products", "lubricating oils", "additives"],
        measures="Water در فرآورده‌های نفتی و روغن‌ها.",
        principle="KF volumetric/coulometric بسته به روش.",
        execution=["نمونه همگن، جلوگیری از جذب رطوبت هوا و انتخاب روش مناسب."],
        qc=COMMON_QC_TITRATION,
        limitations=["مواد مزاحم و ماتریس پیچیده نیاز به validation دارند."],
        report="mg/kg، ppm یا درصد.",
        when_to_use="اندازه‌گیری دقیق آب در سوخت/روغن/فرآورده.",
        related=["ASTM D4377"],
    ),
    S(
        "ASTM D1796",
        "آب و رسوب در نفت خام/سوخت‌ها با سانتریفیوژ",
        domain=["crude", "fuels"],
        family="BS&W",
        technique="Centrifuge",
        analytes=["water", "sediment", "BS&W"],
        matrices=["crude oil", "fuel oils"],
        measures="Water and sediment by centrifuge.",
        principle="سانتریفیوژ نمونه با حلال/شرایط روش و خواندن فاز آب/رسوب.",
        execution=["همگن‌سازی، کنترل دما، سرعت و زمان سانتریفیوژ."],
        qc=["Duplicate و کنترل ظروف/حلال."],
        limitations=[
            "برای تعیین دقیق آب یا رسوب جداگانه ممکن است روش‌های اختصاصی لازم باشد."
        ],
        report="درصد حجمی آب و رسوب.",
        when_to_use="برآورد سریع BS&W در crude/fuel.",
        related=["ASTM D4007", "ASTM D4006", "ASTM D473"],
    ),
    S(
        "ASTM D4007",
        "آب و رسوب در نفت خام با سانتریفیوژ",
        domain=["crude"],
        family="BS&W",
        technique="Centrifuge",
        analytes=["water", "sediment", "BS&W"],
        matrices=["crude oil"],
        measures="Water and sediment در نفت خام.",
        principle="سانتریفیوژ نمونه و خواندن فاز آب/رسوب.",
        execution=["نمونه‌برداری و همگن‌سازی حیاتی است."],
        qc=["Duplicate و کنترل شرایط سانتریفیوژ."],
        limitations=["امولسیون پایدار یا solids ریز می‌تواند خواندن را دشوار کند."],
        report="درصد حجمی BS&W.",
        when_to_use="کنترل سریع BS&W نفت خام.",
        related=["ASTM D1796", "ASTM D4006", "ASTM D473"],
    ),
    S(
        "ASTM D473",
        "رسوب در نفت خام و سوخت‌ها با استخراج",
        domain=["crude", "fuels"],
        family="sediment",
        technique="Extraction",
        analytes=["sediment"],
        matrices=["crude oil", "fuel oil"],
        measures="Sediment content.",
        principle="استخراج/فیلتراسیون رسوبات و اندازه‌گیری باقیمانده.",
        execution=["همگن‌سازی نمونه و کنترل حلال/فیلتراسیون."],
        qc=["Blank، duplicate و کنترل فیلتر/ظرف."],
        limitations=["آسفالتن/مواد محلول ممکن است رفتار روش را تحت تأثیر قرار دهند."],
        report="درصد جرمی یا حجمی طبق روش.",
        when_to_use="اندازه‌گیری رسوب جدا از آب در نفت/سوخت.",
        related=["ASTM D4807", "ASTM D4007"],
    ),
    S(
        "ASTM D4807",
        "رسوب در نفت خام با فیلتراسیون غشایی",
        domain=["crude"],
        family="sediment",
        technique="Membrane filtration",
        analytes=["sediment"],
        matrices=["crude oil"],
        measures="Sediment by membrane filtration.",
        principle="رقیق‌سازی/حل‌سازی نمونه و فیلتراسیون روی غشا.",
        execution=["انتخاب حلال و کنترل plugging فیلتر مهم است."],
        qc=["Blank، duplicate، وزن‌کشی فیلتر."],
        limitations=[
            "نمونه‌های دارای آسفالتن/واکس زیاد می‌توانند فیلتر را دچار مشکل کنند."
        ],
        report="درصد جرمی sediment.",
        when_to_use="کنترل رسوب نفت خام با روش فیلتراسیون.",
        related=["ASTM D473"],
    ),
    S(
        "ASTM D3230",
        "نمک در نفت خام",
        domain=["crude"],
        family="salt",
        technique="Conductometric/electrometric",
        analytes=["salt", "chloride salts"],
        matrices=["crude oil"],
        measures="Salt content در نفت خام.",
        principle="استخراج/اندازه‌گیری هدایت یا پاسخ الکتریکی مرتبط با کلریدها طبق روش.",
        execution=["همگن‌سازی، مدیریت آب همراه و کنترل حلال/استخراج."],
        qc=["Blank، calibration/check standard، duplicate."],
        limitations=[
            "نمک وابسته به آب همراه و نمونه‌برداری است؛ امولسیون‌ها می‌توانند خطا ایجاد کنند."
        ],
        report="mg NaCl/L، PTB یا واحد روش.",
        when_to_use="کنترل نمک نفت خام برای desalting و خوردگی.",
        related=["ASTM D4929", "ASTM D4006"],
    ),
    S(
        "ASTM D4929",
        "کلراید آلی در نفت خام",
        domain=["crude"],
        family="chlorides",
        technique="Combustion/microcoulometry or extraction",
        analytes=["organic chloride"],
        matrices=["crude oil"],
        measures="Organic chloride content در نفت خام.",
        principle="تبدیل/استخراج کلراید آلی و اندازه‌گیری کلراید طبق روش.",
        execution=[
            "جلوگیری از آلودگی کلرایدی و تفکیک inorganic/organic chloride مهم است."
        ],
        qc=["Blank، spike/recovery، duplicate، calibration verification."],
        limitations=["ماتریس نفت خام و نمک‌های معدنی می‌توانند مزاحمت ایجاد کنند."],
        report="mg/kg chloride یا واحد روش.",
        when_to_use="ارزیابی ریسک کلراید آلی و خوردگی در واحدهای پالایش.",
        related=["ASTM D3230"],
    ),
    S(
        "ASTM D6560",
        "آسفالتن‌ها در نفت خام و فرآورده‌ها",
        domain=["crude", "heavy oil"],
        family="asphaltene",
        technique="n-Heptane insolubles",
        analytes=["asphaltenes"],
        matrices=["crude oil", "petroleum products"],
        measures="Asphaltene content.",
        principle="رسوب‌دهی آسفالتن با n-heptane و جداسازی/وزن‌کشی.",
        execution=["نسبت حلال، زمان تماس، فیلتراسیون و شست‌وشو مهم است."],
        qc=["Duplicate، blank و کنترل خشک‌کردن/وزن‌کشی."],
        limitations=["تعریف عملیاتی آسفالتن وابسته به حلال و شرایط روش است."],
        report="درصد جرمی آسفالتن.",
        when_to_use="ارزیابی پایداری، رسوب‌گذاری و رفتار نفت‌های سنگین.",
        related=["IP 143"],
    ),
    S(
        "IP 143",
        "آسفالتن‌ها در نفت خام/فرآورده‌ها",
        domain=["crude", "heavy oil"],
        family="asphaltene",
        technique="n-Heptane insolubles",
        analytes=["asphaltenes"],
        matrices=["crude oil", "fuel oil"],
        measures="Asphaltenes.",
        principle="رسوب با n-heptane و وزن‌کشی.",
        execution=["کنترل حلال، فیلتر و خشک‌کردن."],
        qc=["Duplicate و blank."],
        limitations=[
            "نتیجه operational است و با روش‌های دیگر دقیقاً قابل جایگزینی نیست."
        ],
        report="درصد جرمی.",
        when_to_use="کاربرد رایج در نفت سنگین و fuel oil.",
        related=["ASTM D6560"],
    ),
    S(
        "ASTM D721",
        "Wax content در روغن‌ها/فرآورده‌های نفتی",
        domain=["crude", "lubricants"],
        family="wax",
        technique="Solvent precipitation",
        analytes=["wax"],
        matrices=["petroleum oils", "distillates"],
        measures="Wax content طبق روش رسوب‌دهی/جداسازی.",
        principle="رسوب‌دهی wax با حلال و دمای کنترل‌شده.",
        execution=["دمای سردسازی، حلال و فیلتراسیون باید دقیق کنترل شود."],
        qc=["Blank، duplicate، کنترل دما."],
        limitations=["برای نفت خام واکسی پیچیده نیاز به validation/روش مکمل است."],
        report="درصد wax.",
        when_to_use="ارزیابی wax در برش‌ها/روغن‌های نفتی.",
        related=["ASTM D97", "ASTM D2500"],
    ),
    S(
        "ASTM D97",
        "Pour Point",
        domain=["crude", "fuels", "lubricants"],
        family="cold flow",
        technique="Manual pour point",
        analytes=["pour point"],
        matrices=["crude oil", "diesel", "fuel oil", "lubricating oils"],
        measures="کمترین دمایی که نمونه تحت شرایط روش هنوز جاری می‌شود.",
        principle="سردکردن پله‌ای نمونه و مشاهده جریان‌پذیری.",
        execution=["دما، برنامه سردسازی و مشاهده اپراتور مهم است."],
        qc=["کنترل ترمومتر/حمام و duplicate."],
        limitations=["اپراتورمحور و وابسته به رفتار wax/ساختار نمونه."],
        report="درجه سانتی‌گراد.",
        when_to_use="کنترل جریان‌پذیری در سرما برای نفت/سوخت/روغن.",
        related=["ASTM D2500", "ASTM D6371"],
    ),
    S(
        "ASTM D2500",
        "Cloud Point",
        domain=["fuels", "crude", "lubricants"],
        family="cold flow",
        technique="Manual cloud point",
        analytes=["cloud point"],
        matrices=["diesel", "middle distillates", "petroleum products"],
        measures="دمای ظاهر شدن کدورت ناشی از wax crystals.",
        principle="سردکردن نمونه و مشاهده اولین کدورت.",
        execution=["کنترل دما و مشاهده دقیق."],
        qc=["کنترل دستگاه/ترمومتر و duplicate."],
        limitations=["نمونه‌های رنگی/کدر یا additives ممکن است مشاهده را دشوار کنند."],
        report="درجه سانتی‌گراد.",
        when_to_use="ارزیابی شروع تشکیل wax در سوخت‌ها.",
        related=["ASTM D97", "ASTM D5773", "ASTM D6371"],
    ),
    S(
        "ASTM D5773",
        "Cloud Point خودکار",
        domain=["fuels", "lubricants"],
        family="cold flow",
        technique="Automatic optical cloud point",
        analytes=["cloud point"],
        matrices=["petroleum products"],
        measures="Cloud point با دستگاه خودکار.",
        principle="تشخیص نوری کدورت هنگام سردسازی.",
        execution=["کالیبراسیون دما و تمیزی سل."],
        qc=["Check sample، duplicate."],
        limitations=["برای ماتریس‌های غیرمعمول باید با روش مرجع/نسخه رسمی کنترل شود."],
        report="درجه سانتی‌گراد.",
        when_to_use="Cloud point سریع‌تر و تکرارپذیرتر.",
        related=["ASTM D2500"],
    ),
    S(
        "ASTM D2892",
        "تقطیر True Boiling Point نفت خام",
        domain=["crude"],
        family="distillation",
        technique="TBP distillation",
        analytes=["boiling range", "crude assay fractions"],
        matrices=["crude oil"],
        measures="منحنی TBP و برش‌های نفت خام.",
        principle="تقطیر fractionating با تعداد سینی/شرایط کنترل‌شده.",
        execution=["نمونه بزرگ، کنترل reflux، فشار، cut points و تلفات سبک."],
        qc=["Mass balance، کنترل دما/فشار، تکرارپذیری cut."],
        limitations=["زمان‌بر و تخصصی؛ برای QC روزمره معمولاً مناسب نیست."],
        report="Yield برش‌ها و دمای جوش حقیقی.",
        when_to_use="Crude assay و طراحی/ارزیابی پالایشگاهی.",
        related=["ASTM D5236", "ASTM D1160", "ASTM D7169"],
    ),
    S(
        "ASTM D5236",
        "تقطیر خلأ برش‌های سنگین نفت خام",
        domain=["crude", "heavy oil"],
        family="distillation",
        technique="Vacuum potstill distillation",
        analytes=["boiling range", "heavy fractions"],
        matrices=["heavy petroleum fractions", "crude residues"],
        measures="تقسیم برش‌های سنگین در خلأ.",
        principle="تقطیر تحت خلأ برای کاهش دمای جوش و جلوگیری از cracking.",
        execution=["کنترل فشار، دما و cut point."],
        qc=["Mass balance و کنترل دما/فشار."],
        limitations=["برای اجزای بسیار سنگین/ناپایدار محدودیت دارد."],
        report="Yield و cut temperatures.",
        when_to_use="crude assay و ارزیابی resid/heavy cuts.",
        related=["ASTM D2892", "ASTM D1160"],
    ),
    S(
        "ASTM D1160",
        "تقطیر فرآورده‌ها در فشار کاهش‌یافته",
        domain=["petroleum", "heavy oil"],
        family="distillation",
        technique="Reduced pressure distillation",
        analytes=["distillation range"],
        matrices=["petroleum products", "heavy distillates"],
        measures="منحنی تقطیر در خلأ/فشار کاهش‌یافته.",
        principle="تقطیر نمونه تحت فشار کم و تصحیح دما.",
        execution=["کنترل فشار و دمای بخار/مایع."],
        qc=["کنترل سنسور و pressure measurement."],
        limitations=["برای نمونه‌های خیلی سنگین یا ناپایدار باید دامنه روش بررسی شود."],
        report="IBP/FBP و درصدهای بازیافت.",
        when_to_use="فرآورده‌های با نقطه جوش بالا که D86 مناسب نیست.",
        related=["ASTM D86", "ASTM D5236"],
    ),
    S(
        "ASTM D2887",
        "Simulated Distillation برش‌های نفتی با GC",
        domain=["petroleum", "fuels"],
        family="distillation",
        technique="GC SimDist",
        analytes=["boiling range distribution"],
        matrices=["petroleum fractions"],
        measures="توزیع محدوده جوش با GC.",
        principle="ارتباط retention time هیدروکربن‌ها با دمای جوش نرمال.",
        execution=["کالیبراسیون با n-paraffins و کنترل ستون."],
        qc=["Calibration check، blank، duplicate."],
        limitations=[
            "برای نمونه‌های خیلی سنگین/قطبی/دارای اجزای غیرقابل elute محدودیت دارد."
        ],
        report="Boiling range distribution.",
        when_to_use="تخمین سریع رفتار تقطیر بدون تقطیر فیزیکی.",
        related=["ASTM D7169", "ASTM D6352"],
    ),
    S(
        "ASTM D7169",
        "SimDist برای نفت خام و باقیمانده‌ها",
        domain=["crude", "heavy oil"],
        family="distillation",
        technique="High-temperature GC SimDist",
        analytes=["boiling point distribution"],
        matrices=["crude oil", "residues"],
        measures="Boiling point distribution تا برش‌های سنگین‌تر.",
        principle="GC دمای بالا و کالیبراسیون دمای جوش.",
        execution=["رقیق‌سازی، جلوگیری از آلودگی inlet/ستون، کنترل recovery."],
        qc=["Calibration mix، blank، duplicate، reference oil."],
        limitations=["اجزای غیرقابل تبخیر/آسفالتنی می‌توانند recovery را محدود کنند."],
        report="منحنی boiling distribution.",
        when_to_use="ارزیابی سریع نفت خام/باقیمانده در crude assay مکمل.",
        related=["ASTM D2892", "ASTM D5236", "ASTM D2887"],
    ),
    # -------------------------------------------------------------------------
    # Physical properties, gasoline, diesel, jet fuel, lube oils
    # -------------------------------------------------------------------------
    S(
        "ASTM D86",
        "تقطیر اتمسفری فرآورده‌های نفتی",
        domain=["fuels", "petroleum"],
        family="distillation",
        technique="Atmospheric distillation",
        analytes=["distillation curve", "IBP", "FBP"],
        matrices=["gasoline", "kerosene", "diesel", "light/middle distillates"],
        measures="رفتار تقطیر و دماهای بازیافت حجمی.",
        principle="تقطیر نمونه تحت شرایط کنترل‌شده و ثبت دمای درصدهای بازیافت.",
        execution=["حجم نمونه، نرخ تقطیر، فشار بارومتریک و کندانسور باید کنترل شود."],
        qc=["کنترل دماسنج/سنسور، نرخ تقطیر و duplicate."],
        limitations=[
            "برای نمونه‌های خیلی سنگین، ناپایدار یا خیلی فرار باید دامنه روش بررسی شود."
        ],
        report="IBP، FBP و دماهای بازیافت.",
        when_to_use="کنترل کیفیت سوخت و رفتار تبخیر/تقطیر.",
        related=["ASTM D1160", "ASTM D2887"],
    ),
    S(
        "ASTM D93",
        "Flash Point با Pensky-Martens Closed Cup",
        domain=["fuels", "lubricants", "hse"],
        family="flash point",
        technique="Closed cup",
        analytes=["flash point"],
        matrices=["fuel oils", "lubricating oils", "petroleum liquids"],
        measures="Flash point در کاپ بسته.",
        principle="گرم‌کردن نمونه و اعمال منبع اشتعال تا مشاهده flash.",
        execution=["نرخ گرمایش، هم‌زدن، حجم نمونه و تمیزی cup."],
        qc=["استاندارد مرجع، کنترل دمایی، duplicate."],
        limitations=["آب، حلال فرار یا آلودگی نتیجه را تغییر می‌دهد."],
        report="درجه سانتی‌گراد.",
        when_to_use="ایمنی، طبقه‌بندی و کنترل کیفیت مایعات نفتی.",
        related=["ASTM D56", "ASTM D3828"],
    ),
    S(
        "ASTM D445",
        "ویسکوزیته سینماتیکی",
        domain=["fuels", "lubricants", "crude"],
        family="viscosity",
        technique="Glass capillary viscometer",
        analytes=["kinematic viscosity"],
        matrices=["oils", "fuels", "petroleum liquids"],
        measures="Kinematic viscosity در دمای مشخص.",
        principle="زمان عبور نمونه از ویسکومتر کالیبره در حمام دمای ثابت.",
        execution=["کنترل دقیق دما، نبود حباب/ذرات، انتخاب ویسکومتر مناسب."],
        qc=["استاندارد ویسکوزیته، duplicate، کنترل دمای حمام."],
        limitations=["آلودگی، حباب و دمای ناپایدار خطای جدی ایجاد می‌کند."],
        report="mm²/s یا cSt.",
        when_to_use="کنترل کیفیت روغن‌ها، سوخت‌ها و سیالات نفتی.",
        related=["ASTM D2270", "ASTM D7042"],
    ),
    S(
        "ASTM D2270",
        "محاسبه Viscosity Index",
        domain=["lubricants"],
        family="viscosity",
        standard_type="calculation",
        technique="Calculation",
        analytes=["viscosity index"],
        matrices=["lubricating oils"],
        measures="Viscosity Index از ویسکوزیته در 40 و 100 °C.",
        principle="محاسبه VI بر اساس روابط استاندارد.",
        execution=["نیاز به داده دقیق viscosity در دو دما."],
        qc=["کنترل صحت D445/D7042."],
        limitations=["اگر ویسکوزیته‌ها خطا داشته باشند VI هم خطا دارد."],
        report="VI بدون واحد.",
        when_to_use="ارزیابی تغییر ویسکوزیته روغن با دما.",
        related=["ASTM D445"],
    ),
    S(
        "ASTM D4052",
        "چگالی با Digital Density Meter",
        domain=["crude", "fuels", "petroleum"],
        family="density",
        technique="Oscillating U-tube",
        analytes=["density", "relative density", "API gravity"],
        matrices=["crude oil", "fuels", "condensate", "petroleum liquids"],
        measures="Density، relative density یا API gravity.",
        principle="اندازه‌گیری چگالی با تیوب نوسانی در دمای کنترل‌شده.",
        execution=["نمونه بدون حباب، سل تمیز و دمای پایدار."],
        qc=["کالیبراسیون هوا/آب یا استاندارد مناسب، check standard، duplicate."],
        limitations=["حباب، آب آزاد، ذرات یا نمونه دوفازی خطا ایجاد می‌کند."],
        report="Density در دمای مشخص، relative density یا API gravity.",
        when_to_use="اندازه‌گیری سریع و دقیق چگالی مایعات نفتی.",
        related=["ASTM D1298", "ASTM D287"],
    ),
    S(
        "ASTM D5002",
        "چگالی نفت خام با Digital Density Analyzer",
        domain=["crude", "density"],
        family="density",
        technique="Oscillating U-tube",
        analytes=["density", "API gravity"],
        matrices=["crude oil"],
        measures="Density/API نفت خام.",
        principle="اندازه‌گیری چگالی با U-tube نوسانی برای crude.",
        execution=["نمونه بدون حباب و همگن، کنترل دما، handling نفت waxy/فرار."],
        qc=["Calibration، check standard، duplicate."],
        limitations=["آب آزاد، گاز حل‌شده، ذرات و دوفازی بودن خطا می‌دهد."],
        report="density/API در دمای مشخص.",
        when_to_use="چگالی دقیق نفت خام در آزمایشگاه.",
        related=["ASTM D4052", "ASTM D1298"],
    ),
    S(
        "ASTM D1298",
        "چگالی/API با Hydrometer",
        domain=["crude", "fuels", "petroleum"],
        family="density",
        technique="Hydrometer",
        analytes=["density", "relative density", "API gravity"],
        matrices=["crude oil", "petroleum liquids"],
        measures="چگالی/API با هیدرومتر.",
        principle="شناوری هیدرومتر و تصحیح دما.",
        execution=["دمای نمونه، خواندن meniscus و نبود حباب."],
        qc=["هیدرومتر کالیبره، کنترل دما، duplicate."],
        limitations=["دقت کمتر از روش دیجیتال و حساس به اپراتور."],
        report="Density/API در دمای مرجع.",
        when_to_use="اندازه‌گیری میدانی یا ساده چگالی/API.",
        related=["ASTM D4052", "ASTM D287"],
    ),
    S(
        "ASTM D323",
        "Reid Vapor Pressure",
        domain=["fuels", "petroleum"],
        family="vapor pressure",
        technique="RVP",
        analytes=["vapor pressure"],
        matrices=["gasoline", "light petroleum products"],
        measures="فشار بخار Reid.",
        principle="اندازه‌گیری فشار بخار نمونه در شرایط استاندارد و نسبت مایع/بخار مشخص.",
        execution=["نمونه‌برداری بدون loss اجزای سبک، کنترل دما و آماده‌سازی."],
        qc=["کنترل دستگاه، duplicate، check sample."],
        limitations=[
            "تبخیر اجزای سبک یا نمونه‌برداری اشتباه نتیجه را کم‌نمایی می‌کند."
        ],
        report="kPa یا psi.",
        when_to_use="کنترل volatility بنزین و فرآورده‌های سبک.",
        related=["ASTM D5191"],
    ),
    S(
        "ASTM D5191",
        "Vapor Pressure با Mini Method",
        domain=["fuels"],
        family="vapor pressure",
        technique="Automated vapor pressure",
        analytes=["vapor pressure"],
        matrices=["gasoline", "light fuels"],
        measures="فشار بخار با دستگاه خودکار/حجم کوچک.",
        principle="قرارگیری حجم کوچک نمونه در محفظه و اندازه‌گیری فشار در دمای مشخص.",
        execution=["نمونه‌برداری سرد و بدون loss سبک‌ها."],
        qc=["Verification دستگاه، duplicate."],
        limitations=["حساس به از دست رفتن ترکیبات سبک."],
        report="kPa یا psi.",
        when_to_use="کنترل سریع فشار بخار سوخت‌ها.",
        related=["ASTM D323"],
    ),
    S(
        "ASTM D381",
        "Gum Content در سوخت‌ها",
        domain=["fuels"],
        family="stability/residue",
        technique="Evaporation gum",
        analytes=["gum", "residue"],
        matrices=["gasoline", "light fuels"],
        measures="Gum یا residue در بنزین/سوخت‌های سبک.",
        principle="تبخیر نمونه و وزن‌کشی/اندازه‌گیری residue.",
        execution=["کنترل دما، جریان هوا/بخار و ظروف تمیز."],
        qc=["Blank، duplicate، کنترل شرایط تبخیر."],
        limitations=["آلودگی ظرف یا تبخیر ناقص خطا ایجاد می‌کند."],
        report="mg/100 mL.",
        when_to_use="ارزیابی پایداری و تمیزی سوخت.",
        related=["ASTM D525"],
    ),
    S(
        "ASTM D130",
        "Copper Strip Corrosion",
        domain=["fuels", "corrosion"],
        family="corrosion",
        technique="Copper strip",
        analytes=["copper corrosion"],
        matrices=["gasoline", "diesel", "jet fuel", "petroleum products"],
        measures="خاصیت خورندگی نسبت به نوار مسی.",
        principle="تماس نوار مسی با نمونه و مقایسه تغییر رنگ با rating استاندارد.",
        execution=["نوار صیقلی/تمیز، دما و زمان دقیق."],
        qc=["کنترل دما، rating استاندارد و duplicate در صورت نیاز."],
        limitations=["کیفی/طبقه‌ای است و نوع ترکیب خورنده را مشخص نمی‌کند."],
        report="Copper strip rating.",
        when_to_use="کنترل ترکیبات خورنده گوگردی/فعال در سوخت‌ها.",
        related=["ASTM D1838", "ASTM D3227"],
    ),
    S(
        "ASTM D2699",
        "Research Octane Number - RON",
        domain=["gasoline"],
        family="octane",
        technique="CFR engine",
        analytes=["RON", "research octane number"],
        matrices=["gasoline", "spark ignition fuels"],
        measures="Research Octane Number.",
        principle="مقایسه knock سوخت با مخلوط‌های مرجع در موتور CFR تحت شرایط research.",
        execution=["تنظیم موتور، شرایط استاندارد، سوخت مرجع و اپراتور ماهر."],
        qc=["Check fuel، کنترل موتور، duplicate."],
        limitations=[
            "هزینه‌بر و تخصصی؛ روش‌های NIR فقط با کالیبراسیون معتبر جایگزین عملیاتی‌اند."
        ],
        report="RON.",
        when_to_use="کنترل کیفیت بنزین و انطباق specification.",
        related=["ASTM D2700", "ASTM D4814"],
    ),
    S(
        "ASTM D2700",
        "Motor Octane Number - MON",
        domain=["gasoline"],
        family="octane",
        technique="CFR engine",
        analytes=["MON", "motor octane number"],
        matrices=["gasoline", "spark ignition fuels"],
        measures="Motor Octane Number.",
        principle="مقایسه knock در موتور CFR تحت شرایط شدیدتر motor.",
        execution=["تنظیم دقیق موتور و سوخت‌های مرجع."],
        qc=["Check fuel، duplicate، کنترل شرایط موتور."],
        limitations=["اپراتور و وضعیت موتور روی نتیجه اثر دارند."],
        report="MON.",
        when_to_use="کنترل کیفیت بنزین و محاسبه AKI/antiknock.",
        related=["ASTM D2699", "ASTM D4814"],
    ),
    S(
        "ASTM D613",
        "Cetane Number با موتور CFR",
        domain=["diesel"],
        family="cetane",
        technique="CFR engine",
        analytes=["cetane number"],
        matrices=["diesel fuel"],
        measures="Cetane number.",
        principle="مقایسه ignition delay سوخت با سوخت‌های مرجع در موتور استاندارد.",
        execution=["تنظیم موتور، شرایط استاندارد و سوخت‌های مرجع."],
        qc=["Check fuel، duplicate، کنترل موتور."],
        limitations=[
            "زمان‌بر و تخصصی؛ روش‌های محاسباتی/دستگاهی ممکن است جایگزین QC باشند ولی یکسان نیستند."
        ],
        report="Cetane number.",
        when_to_use="ارزیابی کیفیت احتراق دیزل.",
        related=["ASTM D6890", "ASTM D4737", "ASTM D975"],
    ),
    S(
        "ASTM D6890",
        "Derived Cetane Number با IQT",
        domain=["diesel"],
        family="cetane",
        technique="Ignition Quality Tester",
        analytes=["derived cetane number", "DCN"],
        matrices=["diesel", "middle distillates"],
        measures="Derived Cetane Number.",
        principle="اندازه‌گیری ignition delay در chamber کنترل‌شده و محاسبه DCN.",
        execution=["حجم تزریق، دما، فشار و تمیزی injector."],
        qc=["Check standards، duplicate، کنترل دستگاه."],
        limitations=[
            "DCN الزاماً با CN موتور یکسان نیست؛ specification باید اجازه دهد."
        ],
        report="DCN.",
        when_to_use="کنترل سریع کیفیت احتراق دیزل.",
        related=["ASTM D613", "ASTM D7170"],
    ),
    S(
        "ASTM D4737",
        "Calculated Cetane Index",
        domain=["diesel"],
        family="cetane",
        standard_type="calculation",
        technique="Calculation",
        analytes=["cetane index"],
        matrices=["diesel", "middle distillates"],
        measures="Cetane index از چگالی و داده‌های تقطیر.",
        principle="محاسبه با روابط تجربی.",
        execution=["نیاز به density و distillation معتبر."],
        qc=["کنترل D4052/D1298 و D86."],
        limitations=[
            "برای سوخت‌های دارای cetane improver یا ترکیب غیرمعمول دقیق نیست."
        ],
        report="Cetane index.",
        when_to_use="برآورد سریع کیفیت احتراق وقتی موتور/IQT در دسترس نیست.",
        related=["ASTM D613", "ASTM D86", "ASTM D4052"],
    ),
    S(
        "ASTM D6371",
        "Cold Filter Plugging Point - CFPP",
        domain=["diesel"],
        family="cold flow",
        technique="CFPP",
        analytes=["CFPP"],
        matrices=["diesel", "middle distillates", "biodiesel blends"],
        measures="دمای گرفتگی فیلتر سرد.",
        principle="سردکردن نمونه و عبور از فیلتر تحت شرایط کنترل‌شده.",
        execution=["کنترل سرعت سردسازی، خلأ، فیلتر و حجم نمونه."],
        qc=["Check sample، duplicate، کنترل دما."],
        limitations=["CFPP پیش‌بینی کامل عملکرد میدانی نیست."],
        report="درجه سانتی‌گراد.",
        when_to_use="ارزیابی عملکرد دیزل در هوای سرد.",
        related=["ASTM D97", "ASTM D2500", "EN 116"],
    ),
    S(
        "ASTM D2274",
        "Oxidation Stability of Distillate Fuel Oil",
        domain=["diesel"],
        family="oxidation stability",
        technique="Accelerated oxidation",
        analytes=["oxidation stability", "insolubles"],
        matrices=["distillate fuel oils", "diesel"],
        measures="پایداری اکسیداسیونی سوخت‌های تقطیری.",
        principle="اکسیداسیون شتاب‌یافته و اندازه‌گیری رسوبات/insolubles.",
        execution=["اکسیژن/هوا، دما، زمان و تمیزی ظروف."],
        qc=["Blank، duplicate، check sample."],
        limitations=[
            "نتیجه شتاب‌یافته الزاماً رفتار انبارداری واقعی را دقیقاً پیش‌بینی نمی‌کند."
        ],
        report="mg insolubles یا واحد روش.",
        when_to_use="کنترل پایداری دیزل و سوخت‌های تقطیری.",
        related=["ASTM D525", "ASTM D7462"],
    ),
    S(
        "ASTM D525",
        "Oxidation Stability of Gasoline",
        domain=["gasoline"],
        family="oxidation stability",
        technique="Induction period",
        analytes=["oxidation stability", "induction period"],
        matrices=["gasoline"],
        measures="پایداری اکسیداسیونی بنزین.",
        principle="اندازه‌گیری induction period تحت اکسیژن و دما.",
        execution=["کنترل اکسیژن، دما، فشار و تمیزی بمب."],
        qc=["Check sample، duplicate."],
        limitations=[
            "نتیجه آزمایشگاهی ممکن است همه شرایط انبارداری واقعی را پوشش ندهد."
        ],
        report="دقیقه induction period.",
        when_to_use="کنترل پایداری بنزین.",
        related=["ASTM D381"],
    ),
    S(
        "ASTM D6079",
        "Lubricity دیزل با HFRR",
        domain=["diesel"],
        family="lubricity",
        technique="HFRR",
        analytes=["lubricity", "wear scar diameter"],
        matrices=["diesel fuel", "middle distillates"],
        measures="روانکاری دیزل بر اساس wear scar.",
        principle="تماس ball-on-disk تحت شرایط کنترل‌شده و اندازه‌گیری wear scar.",
        execution=["رطوبت، دما، تمیزی نمونه/قطعات و کالیبراسیون دستگاه."],
        qc=["Reference fluids، duplicate، کنترل شرایط محیطی."],
        limitations=["به آلودگی و رطوبت حساس است."],
        report="Wear scar diameter معمولاً µm.",
        when_to_use="کنترل lubricity دیزل کم‌گوگرد.",
        related=["ASTM D975"],
    ),
    S(
        "ASTM D2386",
        "Freezing Point سوخت جت",
        domain=["jet fuel"],
        family="cold flow",
        technique="Manual freezing point",
        analytes=["freezing point"],
        matrices=["aviation fuels"],
        measures="Freezing point سوخت هوایی.",
        principle="سردکردن نمونه و مشاهده تشکیل/ذوب کریستال‌ها.",
        execution=["کنترل دما، مشاهده و تمیزی ظرف."],
        qc=["Reference/check sample، duplicate."],
        limitations=["اپراتورمحور؛ برای QC سریع روش‌های خودکار هم رایج‌اند."],
        report="°C.",
        when_to_use="کنترل سوخت جت و انطباق با specification.",
        related=["ASTM D5972", "ASTM D1655"],
    ),
    S(
        "ASTM D5972",
        "Freezing Point خودکار سوخت جت",
        domain=["jet fuel"],
        family="cold flow",
        technique="Automatic phase transition",
        analytes=["freezing point"],
        matrices=["aviation fuels"],
        measures="Freezing point با دستگاه خودکار.",
        principle="تشخیص خودکار تغییر فاز هنگام سردکردن/گرم‌کردن.",
        execution=["کالیبراسیون دما و تمیزی سل."],
        qc=["Check sample و duplicate."],
        limitations=["برای اختلاف رسمی باید روش موردقبول specification کنترل شود."],
        report="°C.",
        when_to_use="QC سریع سوخت جت.",
        related=["ASTM D2386", "ASTM D1655"],
    ),
    S(
        "ASTM D3241",
        "Thermal Oxidation Stability of Aviation Turbine Fuels - JFTOT",
        domain=["jet fuel"],
        family="thermal stability",
        technique="JFTOT",
        analytes=["thermal oxidation stability", "tube deposit"],
        matrices=["aviation turbine fuel"],
        measures="پایداری حرارتی سوخت جت.",
        principle="عبور سوخت از لوله گرم و ارزیابی رسوب/افت فشار.",
        execution=["تمیزی سیستم، دما، flow و rating رسوب."],
        qc=["Check fuel، کنترل دستگاه و شرایط."],
        limitations=["تخصصی و وابسته به دستگاه/rating."],
        report="Tube rating و pressure drop.",
        when_to_use="کنترل کیفیت سوخت جت.",
        related=["ASTM D1655"],
    ),
    S(
        "ASTM D5599",
        "اکسیژنه‌ها در بنزین با GC-O-FID",
        domain=["gasoline"],
        family="oxygenates",
        technique="GC with oxygen-selective detection",
        analytes=["MTBE", "ETBE", "TAME", "methanol", "ethanol", "oxygenates"],
        matrices=["gasoline"],
        measures="اکسیژنه‌ها در بنزین.",
        principle="جداسازی GC و تشخیص انتخابی اکسیژن.",
        execution=["کالیبراسیون ترکیبات اکسیژنه، کنترل retention و co-elution."],
        qc=COMMON_QC_CHROM,
        limitations=["برای matrix یا oxygenate غیرمعمول باید اعتبارسنجی شود."],
        report="درصد جرمی/حجمی یا mg/kg طبق روش.",
        when_to_use="کنترل oxygenates در بنزین و blending.",
        related=["ASTM D4815", "ASTM D4814"],
    ),
    S(
        "ASTM D4815",
        "اکسیژنه‌ها، اترها و الکل‌ها در بنزین با GC",
        domain=["gasoline"],
        family="oxygenates",
        technique="GC",
        analytes=["oxygenates", "ethers", "alcohols"],
        matrices=["gasoline"],
        measures="اکسیژنه‌های بنزین.",
        principle="GC و کالیبراسیون ترکیبات اکسیژنه هدف.",
        execution=["کنترل ستون، برنامه دمایی و استاندارد داخلی/خارجی."],
        qc=COMMON_QC_CHROM,
        limitations=["co-elution و ترکیبات ناشناخته می‌توانند مشکل ایجاد کنند."],
        report="درصد یا غلظت oxygenates.",
        when_to_use="کنترل methanol/ethanol/ethers در بنزین.",
        related=["ASTM D5599", "ASTM D4814"],
    ),
    # -------------------------------------------------------------------------
    # Specifications
    # -------------------------------------------------------------------------
    S(
        "ASTM D975",
        "Specification for Diesel Fuel Oils",
        domain=["diesel"],
        family="specification",
        standard_type="specification",
        technique="Specification",
        analytes=[
            "viscosity",
            "sulfur",
            "cetane",
            "flash point",
            "distillation",
            "lubricity",
            "water",
        ],
        matrices=["diesel fuel"],
        measures="مشخصات دیزل.",
        principle="حدود پذیرش دیزل با ارجاع به روش‌های آزمون.",
        execution=["انتخاب grade و الزامات منطقه‌ای/قراردادی."],
        qc=["روش‌های آزمون معتبر و نمونه‌برداری صحیح."],
        limitations=["خود استاندارد آزمون منفرد نیست."],
        report="جدول انطباق با specification.",
        when_to_use="کنترل کیفیت و فروش/خرید دیزل.",
        related=["ASTM D613", "ASTM D6079", "ASTM D5453", "ASTM D6371"],
    ),
    S(
        "ASTM D4814",
        "Specification for Automotive Spark-Ignition Engine Fuel",
        domain=["gasoline"],
        family="specification",
        standard_type="specification",
        technique="Specification",
        analytes=[
            "octane",
            "vapor pressure",
            "distillation",
            "sulfur",
            "benzene",
            "aromatics",
        ],
        matrices=["gasoline"],
        measures="مشخصات بنزین خودرو.",
        principle="حدود کیفی/فصلی و ارجاع به روش‌های آزمون.",
        execution=["پارامترهای منطقه‌ای/فصلی و روش‌های آزمون باید کنترل شوند."],
        qc=["نمونه‌برداری و روش‌های معتبر."],
        limitations=["روش آزمون منفرد نیست."],
        report="جدول انطباق با specification.",
        when_to_use="ارزیابی انطباق بنزین.",
        related=["ASTM D2699", "ASTM D2700", "ASTM D86", "ASTM D5191"],
    ),
    S(
        "ASTM D1655",
        "Specification for Aviation Turbine Fuels",
        domain=["jet fuel"],
        family="specification",
        standard_type="specification",
        technique="Specification",
        analytes=[
            "distillation",
            "flash point",
            "freezing point",
            "sulfur",
            "aromatics",
            "thermal stability",
        ],
        matrices=["aviation turbine fuel"],
        measures="مشخصات سوخت جت.",
        principle="حدود کیفی و ارجاع به روش‌های آزمون.",
        execution=["grade، additive و الزامات ایمنی/هوانوردی بررسی شود."],
        qc=["نمونه‌برداری صحیح و روش‌های موردقبول specification."],
        limitations=["روش آزمون منفرد نیست."],
        report="جدول انطباق سوخت جت.",
        when_to_use="ارزیابی کیفیت/انطباق سوخت هوایی.",
        related=["ASTM D3241", "ASTM D86", "ASTM D93"],
    ),
    S(
        "ASTM D7566",
        "Specification for Aviation Turbine Fuel with Synthesized Hydrocarbons",
        domain=["jet fuel", "sustainable aviation fuel"],
        family="specification",
        standard_type="specification",
        technique="Specification",
        analytes=["SAF", "synthetic blending components"],
        matrices=["aviation turbine fuel", "SAF blends"],
        measures="مشخصات سوخت هوایی حاوی هیدروکربن‌های سنتزی.",
        principle="Specification و annex مسیرهای تولید/اختلاط مجاز.",
        execution=["نسخه و annex مربوط به مسیر تولید باید دقیق کنترل شود."],
        qc=["آزمون‌های کامل سوخت هوایی و blend control."],
        limitations=["روش آزمون منفرد نیست و نسخه به‌روز اهمیت زیادی دارد."],
        report="انطباق با annex/specification.",
        when_to_use="ارزیابی SAF و blendهای مجاز سوخت هوایی.",
        related=["ASTM D1655"],
    ),
    S(
        "ASTM D6751",
        "Specification for Biodiesel Fuel Blend Stock - B100",
        domain=["biodiesel"],
        family="specification",
        standard_type="specification",
        technique="Specification",
        analytes=["biodiesel quality", "FAME"],
        matrices=["biodiesel B100"],
        measures="مشخصات کیفی biodiesel B100.",
        principle="حدود پارامترهای B100 با روش‌های آزمون مرتبط.",
        execution=[
            "کنترل متانول، آب، acid number، oxidation stability و فلزات طبق specification."
        ],
        qc=["روش‌های آزمون معتبر و نمونه‌برداری صحیح."],
        limitations=["روش منفرد نیست."],
        report="جدول انطباق B100.",
        when_to_use="کیفیت biodiesel برای blending.",
        related=["ASTM D7467", "EN 14214"],
    ),
    S(
        "ASTM D7467",
        "Specification for Diesel Fuel Oil, Biodiesel Blend B6-B20",
        domain=["diesel", "biodiesel"],
        family="specification",
        standard_type="specification",
        technique="Specification",
        analytes=["biodiesel blend quality"],
        matrices=["B6-B20 diesel blends"],
        measures="مشخصات blendهای دیزل-بیودیزل.",
        principle="Specification و حدود پارامترها برای B6 تا B20.",
        execution=["درصد FAME، پایداری، cold flow و سایر پارامترها کنترل شود."],
        qc=["نمونه‌برداری و روش‌های معتبر."],
        limitations=["روش آزمون منفرد نیست."],
        report="جدول انطباق B6-B20.",
        when_to_use="کنترل کیفیت blendهای biodiesel.",
        related=["ASTM D6751", "ASTM D975"],
    ),
    S(
        "ISO 8217",
        "مشخصات سوخت‌های دریایی",
        domain=["marine fuels", "fuels"],
        family="specification",
        standard_type="specification",
        technique="Specification",
        analytes=["viscosity", "sulfur", "flash point", "water", "sediment", "H2S"],
        matrices=["marine residual fuels", "marine distillate fuels"],
        measures="Specification سوخت‌های دریایی و حدود پارامترها.",
        principle="مقایسه نتایج آزمون با حدود کیفی.",
        execution=["انتخاب روش‌های آزمون متناسب با پارامتر و grade."],
        qc=["نمونه‌برداری و روش‌های آزمون معتبر."],
        limitations=["خود استاندارد روش اندازه‌گیری منفرد نیست."],
        report="جدول انطباق grade سوخت دریایی.",
        when_to_use="کنترل کیفیت/خرید و فروش سوخت‌های دریایی.",
        related=["ASTM D7621", "ASTM D445", "ASTM D93"],
    ),
    S(
        "EN 590",
        "Specification for Automotive Diesel Fuel",
        domain=["diesel", "en"],
        family="specification",
        standard_type="specification",
        technique="Specification",
        analytes=["diesel quality", "cetane", "sulfur", "CFPP", "viscosity", "FAME"],
        matrices=["automotive diesel fuel"],
        measures="مشخصات دیزل خودرو در چارچوب EN.",
        principle="حدود کیفی دیزل و ارجاع به روش‌های آزمون مربوطه.",
        execution=["کشور/قرارداد/فصل و نسخه EN باید کنترل شود."],
        qc=["آزمون‌های مرجع و نمونه‌برداری معتبر."],
        limitations=["روش آزمون منفرد نیست؛ نسخه و annex مهم است."],
        report="جدول انطباق با EN 590.",
        when_to_use="کنترل کیفیت دیزل در بازارهای تابع EN.",
        related=["ASTM D975", "EN 116", "ASTM D6371"],
    ),
    S(
        "EN 228",
        "Specification for Automotive Gasoline",
        domain=["gasoline", "en"],
        family="specification",
        standard_type="specification",
        technique="Specification",
        analytes=[
            "gasoline quality",
            "octane",
            "benzene",
            "aromatics",
            "oxygenates",
            "vapor pressure",
        ],
        matrices=["automotive gasoline"],
        measures="مشخصات بنزین خودرو در چارچوب EN.",
        principle="حدود کیفی بنزین و ارجاع به روش‌های آزمون.",
        execution=["نسخه، فصل، volatility class و الزامات محلی باید کنترل شود."],
        qc=["روش‌های معتبر و sample integrity."],
        limitations=["روش آزمون منفرد نیست."],
        report="جدول انطباق با EN 228.",
        when_to_use="کنترل کیفیت بنزین در بازارهای تابع EN.",
        related=["ASTM D4814", "ASTM D2699", "ASTM D2700"],
    ),
    S(
        "EN 116",
        "CFPP سوخت دیزل",
        domain=["diesel", "en"],
        family="cold flow",
        technique="CFPP",
        analytes=["CFPP"],
        matrices=["diesel fuel", "middle distillates"],
        measures="Cold Filter Plugging Point.",
        principle="سردکردن نمونه و آزمون عبور از فیلتر.",
        execution=["فیلتر، خلأ، دما و rate سردسازی کنترل شود."],
        qc=["Check sample و duplicate."],
        limitations=["CFPP عملکرد واقعی میدانی را کامل تضمین نمی‌کند."],
        report="°C.",
        when_to_use="کنترل cold-flow دیزل طبق EN.",
        related=["ASTM D6371", "EN 590"],
    ),
    # -------------------------------------------------------------------------
    # Acid/base, aromatics, VOC/SVOC/TPH
    # -------------------------------------------------------------------------
    S(
        "ASTM D664",
        "Acid Number با تیتراسیون پتانسیومتری",
        domain=["lubricants", "petroleum"],
        family="acid/base",
        technique="Potentiometric titration",
        analytes=["acid number", "TAN"],
        matrices=["lubricating oils", "used oils", "petroleum products"],
        measures="Acid Number.",
        principle="حل نمونه در حلال مناسب و تیتراسیون پتانسیومتری با باز استاندارد.",
        execution=["حلال، الکترود، endpoint و آماده‌سازی نمونه مهم است."],
        qc=COMMON_QC_TITRATION,
        limitations=["نمونه‌های رنگی/کدر یا مواد مزاحم endpoint را پیچیده می‌کنند."],
        report="mg KOH/g.",
        when_to_use="ارزیابی اسیدیته، خوردگی احتمالی و degradation روغن.",
        related=["ASTM D974", "ASTM D2896", "ASTM D4739"],
    ),
    S(
        "ASTM D2896",
        "Base Number با تیتراسیون پتانسیومتری",
        domain=["lubricants"],
        family="acid/base",
        technique="Potentiometric titration",
        analytes=["base number", "TBN"],
        matrices=["engine oils", "lubricants"],
        measures="Base Number ظرفیت قلیایی روغن.",
        principle="تیتراسیون اسیدی در محیط مناسب.",
        execution=["آماده‌سازی نمونه، الکترود و endpoint."],
        qc=COMMON_QC_TITRATION,
        limitations=["افزودنی‌ها و ماتریس روغن روی endpoint اثر می‌گذارند."],
        report="mg KOH/g.",
        when_to_use="پایش ظرفیت قلیایی و افزودنی‌های روغن موتور.",
        related=["ASTM D4739", "ASTM D664"],
    ),
    S(
        "ASTM D4739",
        "Base Number برای روغن‌های کارکرده",
        domain=["lubricants", "used oil"],
        family="acid/base",
        technique="Potentiometric titration",
        analytes=["base number", "TBN"],
        matrices=["used oils"],
        measures="Base Number در روغن کارکرده.",
        principle="تیتراسیون پتانسیومتری در شرایط مناسب‌تر برای برخی روغن‌های کارکرده.",
        execution=["نمونه همگن و مدیریت رسوبات/دوده."],
        qc=COMMON_QC_TITRATION,
        limitations=["نتیجه را بدون توجه به تفاوت روش با D2896 مقایسه نکنید."],
        report="mg KOH/g.",
        when_to_use="پایش روغن کارکرده و تحلیل وضعیت سرویس.",
        related=["ASTM D2896", "ASTM D664"],
    ),
    S(
        "ASTM D974",
        "Acid/Base Number با اندیکاتور رنگی",
        domain=["lubricants", "petroleum"],
        family="acid/base",
        technique="Color-indicator titration",
        analytes=["acid number", "base number"],
        matrices=["petroleum products", "lubricants"],
        measures="Acid/Base number با endpoint رنگی.",
        principle="تیتراسیون با نشانگر رنگی.",
        execution=["نمونه‌های رنگی/تیره می‌توانند endpoint را دشوار کنند."],
        qc=COMMON_QC_TITRATION,
        limitations=[
            "برای نمونه‌های تیره یا پیچیده، روش پتانسیومتری معمولاً بهتر است."
        ],
        report="mg KOH/g.",
        when_to_use="کاربرد سنتی/ساده برای نمونه‌های مناسب.",
        related=["ASTM D664", "ASTM D2896"],
    ),
    S(
        "ASTM D1319",
        "Hydrocarbon Types با FIA",
        domain=["gasoline", "fuels"],
        family="hydrocarbon types",
        technique="FIA",
        analytes=["saturates", "olefins", "aromatics"],
        matrices=["gasoline", "light petroleum fractions"],
        measures="درصد اشباع‌ها، اولفین‌ها و آروماتیک‌ها.",
        principle="حرکت نمونه روی ستون جذب و تفکیک گروه‌ها با نشانگر/فلورسانس.",
        execution=["کیفیت ستون، packing، dye و خواندن مرزها مهم است."],
        qc=["استاندارد کنترل، duplicate، بررسی عملکرد ستون."],
        limitations=["اپراتورمحور و برای برخی ماتریس‌ها محدود است."],
        report="درصد حجمی یا جرمی گروه‌ها.",
        when_to_use="ارزیابی گروه‌های هیدروکربنی در سوخت‌های سبک.",
        related=["ASTM D5580", "ASTM D6733"],
    ),
    S(
        "ASTM D3606",
        "بنزن و تولوئن در بنزین با GC",
        domain=["gasoline"],
        family="BTEX/aromatics",
        technique="GC",
        analytes=["benzene", "toluene"],
        matrices=["gasoline"],
        measures="Benzene و Toluene در بنزین.",
        principle="جداسازی GC و کمی‌سازی ترکیبات هدف.",
        execution=["تفکیک کروماتوگرافی، calibration و retention time."],
        qc=COMMON_QC_CHROM,
        limitations=["Co-elution و آلودگی ستون خطا ایجاد می‌کند."],
        report="غلظت/درصد ترکیبات طبق روش.",
        when_to_use="کنترل benzene/toluene در بنزین.",
        related=["ASTM D5580", "ASTM D5769"],
    ),
    S(
        "ASTM D5580",
        "BTEX و آروماتیک‌ها در بنزین با GC",
        domain=["gasoline"],
        family="BTEX/aromatics",
        technique="GC",
        analytes=["benzene", "toluene", "ethylbenzene", "xylenes", "aromatics"],
        matrices=["gasoline"],
        measures="BTEX و برخی آروماتیک‌ها در بنزین.",
        principle="تفکیک آروماتیک‌ها با GC و کمی‌سازی.",
        execution=["ستون، برنامه دمایی، استاندارد داخلی و calibration."],
        qc=COMMON_QC_CHROM,
        limitations=["پیک‌های همپوشان و ماتریس بنزین چالش دارند."],
        report="غلظت ترکیبات و گاهی مجموع.",
        when_to_use="کنترل آروماتیک‌ها و BTEX در سوخت.",
        related=["ASTM D3606", "ASTM D5769", "ASTM D1319"],
    ),
    S(
        "ASTM D5769",
        "آروماتیک‌ها در بنزین با GC/MS",
        domain=["gasoline"],
        family="BTEX/aromatics",
        technique="GC/MS",
        analytes=["benzene", "toluene", "aromatics"],
        matrices=["gasoline"],
        measures="ترکیبات آروماتیک در بنزین با GC/MS.",
        principle="GC جداسازی و MS شناسایی/کمی‌سازی را انجام می‌دهد.",
        execution=["کالیبراسیون، ion monitoring، internal standard و carryover."],
        qc=COMMON_QC_CHROM,
        limitations=["آلودگی سیستم، co-elution و تنظیمات MS اثر دارند."],
        report="غلظت ترکیبات هدف.",
        when_to_use="وقتی شناسایی دقیق‌تر آروماتیک‌ها لازم است.",
        related=["ASTM D3606", "ASTM D5580"],
    ),
    S(
        "ASTM D6733",
        "Detailed Hydrocarbon Analysis - DHA",
        domain=["gasoline", "naphtha"],
        family="hydrocarbon composition",
        technique="Capillary GC",
        analytes=["individual hydrocarbons", "PIONA", "DHA"],
        matrices=["naphtha", "gasoline", "light hydrocarbons"],
        measures="ترکیب تفصیلی هیدروکربن‌ها.",
        principle="تفکیک GC capillary و شناسایی بر اساس retention database.",
        execution=["ستون، برنامه دمایی، بانک retention time و تفکیک حیاتی است."],
        qc=["استاندارد مخلوط، retention time check، blank، duplicate."],
        limitations=["نمونه‌های خیلی سنگین یا co-elution زیاد نیاز به روش مکمل دارند."],
        report="درصد یا غلظت ترکیبات منفرد و گروه‌ها.",
        when_to_use="بررسی دقیق نفتا/بنزین/خوراک‌های سبک.",
        related=["ASTM D1319", "ASTM D5580"],
    ),
    S(
        "EPA 8260",
        "VOCs با GC/MS",
        domain=["environmental", "water", "soil"],
        family="VOC",
        technique="Purge-and-trap GC/MS",
        analytes=["VOC", "BTEX", "chlorinated solvents", "volatile organics"],
        matrices=["water", "soil", "solid waste", "wipes"],
        measures="ترکیبات آلی فرار در ماتریس‌های محیطی.",
        principle="Purge-and-trap یا آماده‌سازی مناسب، سپس GC/MS.",
        execution=["نمونه‌برداری بدون headspace، نگهداری سرد، جلوگیری از loss."],
        qc=["Surrogate، internal standard، method blank، matrix spike، duplicate."],
        limitations=["VOCs به نمونه‌برداری و نگهداری بسیار حساس‌اند."],
        report="µg/L، mg/kg یا واحد مناسب.",
        when_to_use="پایش VOC/BTEX در آب، خاک و نمونه‌های محیطی.",
        related=["EPA 8015", "EPA 8270"],
    ),
    S(
        "EPA 8270",
        "SVOCs با GC/MS",
        domain=["environmental", "water", "soil"],
        family="SVOC",
        technique="GC/MS",
        analytes=["SVOC", "PAH", "phenols", "semi-volatile organics"],
        matrices=["water", "soil", "sediment", "wastewater"],
        measures="ترکیبات آلی نیمه‌فرار.",
        principle="استخراج، cleanup و GC/MS.",
        execution=["استخراج، cleanup، کنترل recovery و آماده‌سازی مناسب."],
        qc=[
            "Surrogate recovery، matrix spike، blank، duplicate، calibration verification."
        ],
        limitations=["ماتریس پیچیده recovery و تداخل ایجاد می‌کند."],
        report="غلظت SVOCها.",
        when_to_use="PAHها، فنول‌ها و SVOCهای محیطی.",
        related=["EPA 8260"],
    ),
    S(
        "EPA 8015",
        "Nonhalogenated Organics/TPH با GC",
        domain=["environmental", "water", "soil"],
        family="TPH",
        technique="GC-FID",
        analytes=["TPH", "GRO", "DRO", "nonhalogenated organics"],
        matrices=["water", "soil", "waste"],
        measures="ترکیبات آلی غیرهالوژنه و TPH طبق پیکربندی روش.",
        principle="GC-FID پس از purge/extraction مناسب.",
        execution=["تعریف محدوده کربنی، استخراج/حلال و calibration مهم است."],
        qc=["Blank، surrogate، matrix spike، duplicate، calibration check."],
        limitations=["TPH روش operational است؛ speciation دقیق نمی‌دهد."],
        report="mg/L یا mg/kg.",
        when_to_use="پایش آلودگی نفتی/TPH در محیط زیست.",
        related=["EPA 8260", "EPA 8270", "EPA 1664"],
    ),
    # -------------------------------------------------------------------------
    # Mercury, metals, water/wastewater
    # -------------------------------------------------------------------------
    S(
        "ASTM D7623",
        "جیوه کل در نفت خام",
        domain=["crude", "metals"],
        family="mercury",
        technique="Thermal decomposition amalgamation AAS",
        analytes=["mercury", "Hg"],
        matrices=["crude oil"],
        measures="Total Mercury در نفت خام.",
        principle="حرارت/احتراق نمونه، آمالگام‌سازی جیوه روی طلا و اندازه‌گیری جذب اتمی.",
        execution=["همگن‌سازی نفت خام و کنترل آلودگی Hg بسیار مهم است."],
        qc=["Blank، CRM، spike recovery، duplicate، carryover check."],
        limitations=["Hg در نفت می‌تواند ناهمگن باشد؛ نمونه‌برداری نقش حیاتی دارد."],
        report="µg/kg یا ng/g.",
        when_to_use="ارزیابی ریسک فرایندی/زیست‌محیطی جیوه در crude.",
        related=["EPA 7473"],
    ),
    S(
        "EPA 7473",
        "جیوه با Thermal Decomposition Amalgamation AAS",
        domain=["environmental", "metals"],
        family="mercury",
        technique="TDA-AAS",
        analytes=["mercury", "Hg"],
        matrices=["solid", "soil", "sediment", "liquids"],
        measures="Total Hg در جامدات، مایعات و برخی ماتریس‌ها.",
        principle="تجزیه حرارتی، آمالگام‌سازی و AAS بدون digestion کلاسیک.",
        execution=["جرم نمونه، خشک بودن، همگن‌سازی و آلودگی Hg کنترل شود."],
        qc=["Blank، CRM، duplicate، spike، calibration verification."],
        limitations=["ماتریس‌های پیچیده نیاز به validation دارند."],
        report="mg/kg، µg/kg یا واحد مناسب.",
        when_to_use="اندازه‌گیری سریع جیوه کل در نمونه‌های محیطی/صنعتی.",
        related=["ASTM D7623", "EPA 1631", "EPA 245.1"],
    ),
    S(
        "EPA 1631",
        "جیوه در آب با CVAFS",
        domain=["water", "environmental"],
        family="mercury",
        technique="CVAFS",
        analytes=["mercury", "Hg"],
        matrices=["surface water", "drinking water", "wastewater"],
        measures="Hg در آب در سطوح بسیار پایین.",
        principle="تبدیل Hg به بخار سرد و اندازه‌گیری فلورسانس اتمی.",
        execution=[
            "کنترل آلودگی در سطح trace حیاتی است؛ بطری، اسید، blank و محیط تمیز."
        ],
        qc=[
            "Method blank، field blank، matrix spike، duplicate، calibration verification."
        ],
        limitations=["آلودگی کوچک محیطی نتیجه را شدیداً تغییر می‌دهد."],
        report="ng/L یا µg/L.",
        when_to_use="پایش Hg بسیار پایین در آب.",
        related=["EPA 245.1", "EPA 7473"],
    ),
    S(
        "EPA 245.1",
        "جیوه در آب با CVAAS",
        domain=["water", "environmental"],
        family="mercury",
        technique="CVAAS",
        analytes=["mercury", "Hg"],
        matrices=["water", "wastewater"],
        measures="Hg در آب با cold vapor AAS.",
        principle="آماده‌سازی/کاهش شیمیایی و اندازه‌گیری بخار سرد با AAS.",
        execution=["digestion، کاهش شیمیایی و کنترل آلودگی."],
        qc=["Blank، spike recovery، duplicate، calibration check."],
        limitations=["برای سطوح بسیار پایین CVAFS مناسب‌تر است."],
        report="µg/L.",
        when_to_use="اندازه‌گیری روتین Hg در آب با حساسیت معمول.",
        related=["EPA 1631", "EPA 7473"],
    ),
    S(
        "EPA 6010",
        "فلزات با ICP-OES",
        domain=["environmental", "water", "soil", "metals"],
        family="metals",
        technique="ICP-OES",
        analytes=["metals", "elements"],
        matrices=["water", "wastewater", "soil digest", "sediment digest"],
        measures="فلزات و عناصر پس از آماده‌سازی مناسب.",
        principle="نشر اتمی/یونی در پلاسما و اندازه‌گیری طول موج‌های عناصر.",
        execution=["digestion، dilution، کنترل ماتریس و انتخاب طول موج."],
        qc=COMMON_QC_ICP,
        limitations=["تداخل طیفی و ماتریسی باید کنترل شود."],
        report="mg/L، µg/L، mg/kg.",
        when_to_use="آنالیز چندعنصری با حساسیت مناسب.",
        related=["EPA 6020", "EPA 200.7"],
    ),
    S(
        "EPA 6020",
        "فلزات Trace با ICP-MS",
        domain=["environmental", "water", "soil", "metals"],
        family="metals",
        technique="ICP-MS",
        analytes=["trace metals", "heavy metals"],
        matrices=["water", "wastewater", "soil digest", "industrial samples"],
        measures="عناصر trace با حساسیت بالا.",
        principle="یون‌سازی در ICP و اندازه‌گیری m/z در mass spectrometer.",
        execution=[
            "کنترل آلودگی، dilution، internal standard و interference correction."
        ],
        qc=COMMON_QC_ICP,
        limitations=["تداخل‌های ایزوباریک و polyatomic می‌توانند خطا ایجاد کنند."],
        report="µg/L، ng/L یا mg/kg.",
        when_to_use="فلزات trace و حدود پایین‌تر.",
        related=["EPA 6010", "EPA 200.8"],
    ),
    S(
        "ASTM D5185",
        "عناصر افزودنی/فلزات در روغن‌ها با ICP-OES",
        domain=["lubricants", "metals"],
        family="metals",
        technique="ICP-OES",
        analytes=["additive elements", "wear metals", "contaminants"],
        matrices=["lubricating oils", "used oils", "base oils"],
        measures="عناصر در روغن‌ها با ICP-OES.",
        principle="رقیق‌سازی روغن و اندازه‌گیری نشر عناصر در ICP.",
        execution=[
            "رقیق‌سازی با حلال مناسب، internal standard و کنترل ویسکوزیته/ماتریس."
        ],
        qc=COMMON_QC_ICP,
        limitations=["ذرات بزرگ wear debris ممکن است به طور کامل وارد پلاسما نشوند."],
        report="mg/kg یا ppm عناصر.",
        when_to_use="پایش روغن کارکرده و عناصر افزودنی/سایشی.",
        related=["ASTM D5708", "EPA 6010"],
    ),
    S(
        "ASTM D5708",
        "Ni، V، Fe در نفت خام و سوخت‌ها با ICP",
        domain=["crude", "fuels", "metals"],
        family="metals",
        technique="ICP-OES/ICP-MS depending method",
        analytes=["nickel", "vanadium", "iron"],
        matrices=["crude oil", "residual fuel oil"],
        measures="فلزات کلیدی مثل Ni/V/Fe در نفت و fuel oil.",
        principle="آماده‌سازی/رقیق‌سازی یا digestion و اندازه‌گیری ICP.",
        execution=["همگن‌سازی، کنترل ذرات/آسفالتن و رقیق‌سازی مناسب."],
        qc=COMMON_QC_ICP,
        limitations=["ماتریس سنگین و ذرات فلزی باعث bias می‌شوند."],
        report="mg/kg یا ppm.",
        when_to_use="ارزیابی فلزات کاتالیست‌مسموم‌کن و خوردگی/رسوب در crude/resid.",
        related=["ASTM D5185", "EPA 6010"],
    ),
    S(
        "EPA 1664",
        "Oil and Grease / HEM در آب و پساب",
        domain=["water", "wastewater", "environmental"],
        family="oil and grease",
        technique="n-hexane extraction gravimetry/IR depending version",
        analytes=["oil and grease", "HEM", "SGT-HEM"],
        matrices=["wastewater", "produced water", "industrial water"],
        measures="Oil and grease یا hexane extractable material.",
        principle="استخراج با n-hexane و اندازه‌گیری جرم ماده استخراج‌شده.",
        execution=["نمونه‌برداری نماینده، acid preservation و کنترل امولسیون."],
        qc=["Method blank، matrix spike، duplicate، laboratory control sample."],
        limitations=["روش operational است و ترکیب دقیق نفتی را مشخص نمی‌کند."],
        report="mg/L.",
        when_to_use="پایش oil & grease در پساب/آب تولیدی.",
        related=["EPA 8015"],
    ),
    S(
        "EPA 300",
        "آنیون‌ها با Ion Chromatography",
        domain=["water", "wastewater", "environmental"],
        family="anions",
        technique="Ion chromatography",
        analytes=["chloride", "sulfate", "nitrate", "fluoride", "bromide"],
        matrices=["water", "wastewater"],
        measures="آنیون‌های معدنی در آب.",
        principle="جداسازی یونی با IC و تشخیص هدایت/دتکتور مناسب.",
        execution=["فیلتراسیون، رقیق‌سازی، کنترل matrix و استانداردها."],
        qc=["Calibration check، blank، duplicate، spike."],
        limitations=["شوری بالا و co-elution می‌تواند مشکل‌ساز شود."],
        report="mg/L.",
        when_to_use="کلراید/سولفات/نیترات در آب‌های صنعتی و محیطی.",
        related=["SM 4500"],
    ),
    S(
        "SM 2540",
        "TSS/TDS/TS در آب و پساب",
        domain=["water", "wastewater"],
        family="solids",
        technique="Gravimetry",
        analytes=["TSS", "TDS", "TS"],
        matrices=["water", "wastewater", "produced water"],
        measures="جامدات معلق/محلول/کل.",
        principle="فیلتراسیون، تبخیر/خشک‌کردن و وزن‌کشی.",
        execution=["کنترل دما، فیلتر، زمان خشک‌کردن و رطوبت."],
        qc=["Blank، duplicate، balance check."],
        limitations=["نمک‌های فرار/جاذب رطوبت می‌توانند bias ایجاد کنند."],
        report="mg/L.",
        when_to_use="کنترل جامدات آب و پساب.",
        related=["EPA 160.2"],
    ),
    S(
        "SM 5220",
        "COD در آب و پساب",
        domain=["water", "wastewater"],
        family="organic load",
        technique="Dichromate COD",
        analytes=["COD"],
        matrices=["wastewater", "industrial water"],
        measures="Chemical Oxygen Demand.",
        principle="اکسیداسیون شیمیایی با دی‌کرومات و اندازه‌گیری مصرف اکسیدکننده.",
        execution=["کنترل کلراید، digestion، blank و dilution."],
        qc=["Blank، duplicate، standard check، matrix spike."],
        limitations=["کلراید/ترکیبات مقاوم به اکسیداسیون مزاحم‌اند."],
        report="mg O2/L.",
        when_to_use="بار آلی پساب صنعتی.",
        related=["SM 5210", "SM 5310"],
    ),
    S(
        "SM 4500-S",
        "سولفید در آب و پساب",
        domain=["water", "wastewater", "sulfur"],
        family="sulfide",
        technique="Colorimetric/titrimetric depending method",
        analytes=["sulfide", "H2S", "dissolved sulfide"],
        matrices=["water", "wastewater", "produced water"],
        measures="Sulfide/H2S در نمونه‌های آبی.",
        principle="تثبیت نمونه و اندازه‌گیری سولفید با روش رنگ‌سنجی/تیتراسیون طبق بخش روش.",
        execution=["نمونه‌برداری بدون loss H2S، fixation و کنترل pH حیاتی است."],
        qc=["Blank، standard check، duplicate، spike."],
        limitations=["سولفید فرار/واکنش‌پذیر است و نمونه‌برداری سخت‌ترین بخش است."],
        report="mg/L به عنوان S یا H2S طبق روش.",
        when_to_use="پایش sulfide/H2S در آب تولیدی/پساب.",
        related=["ASTM D5504", "ASTM D5705"],
    ),
    # -------------------------------------------------------------------------
    # Sampling, API, custody transfer
    # -------------------------------------------------------------------------
    S(
        "ASTM D4057",
        "نمونه‌برداری دستی از نفت و فرآورده‌های نفتی",
        domain=["sampling", "crude", "fuels", "petroleum"],
        family="sampling",
        standard_type="practice",
        technique="Manual sampling",
        analytes=["representative sample"],
        matrices=["crude oil", "petroleum products", "fuels"],
        measures="راهنمای نمونه‌برداری دستی برای گرفتن نمونه نماینده.",
        principle="کنترل ظرف، نقطه نمونه‌برداری، حجم، ایمنی و جلوگیری از تغییر ترکیب نمونه.",
        execution=[
            "ظرف مناسب، برچسب، زنجیره نگهداری، کنترل فراریت و همگن‌سازی.",
            "برای نمونه‌های چندفازی یا دارای رسوب، روش handling باید در گزارش ذکر شود.",
        ],
        qc=COMMON_QC_SAMPLING,
        limitations=["نمونه غیرنماینده، بهترین روش آزمایشگاهی را هم بی‌اعتبار می‌کند."],
        report="شرایط نمونه‌برداری و شناسه نمونه همراه با نتایج آزمون.",
        when_to_use="برای نمونه‌برداری دستی از مخزن، drum، تانکر یا container.",
        related=["ASTM D4177", "ASTM D5854", "API MPMS 8.1"],
    ),
    S(
        "ASTM D4177",
        "نمونه‌برداری خودکار از نفت و فرآورده‌های نفتی",
        domain=["sampling", "crude", "petroleum"],
        family="sampling",
        standard_type="practice",
        technique="Automatic sampling",
        analytes=["representative sample"],
        matrices=["crude oil", "petroleum liquids"],
        measures="نمونه‌برداری representative از جریان خطوط انتقال/بارگیری.",
        principle="گرفتن incremental samples متناسب با جریان و ترکیب آن‌ها به composite sample.",
        execution=[
            "نرخ جریان، محل probe، mixing، container و proportional sampling باید کنترل شود."
        ],
        qc=COMMON_QC_SAMPLING,
        limitations=[
            "برای جریان‌های stratified یا mixing ضعیف، representativeness ریسک اصلی است."
        ],
        report="روش نمونه‌برداری، flow basis، زمان و شرایط composite.",
        when_to_use="custody transfer و نمونه‌برداری خطی از نفت/محصول.",
        related=["ASTM D4057", "API MPMS 8.2"],
    ),
    S(
        "ASTM D5854",
        "اختلاط و handling نمونه‌های نفتی",
        domain=["sampling", "crude", "petroleum"],
        family="sample handling",
        standard_type="practice",
        technique="Mixing and handling",
        analytes=["representative test portion"],
        matrices=["crude oil", "petroleum products"],
        measures="آماده‌سازی و اختلاط نمونه برای گرفتن test portion نماینده.",
        principle="کنترل همگن‌سازی، گرم‌کردن، انتقال و subsampling بدون تغییر معنی‌دار نمونه.",
        execution=[
            "برای crude، waxy oil، رسوب‌دار یا دو فازی باید اختلاط و دمای مناسب انتخاب شود."
        ],
        qc=["ثبت روش mixing، دما، زمان و مشاهده فازها."],
        limitations=[
            "overheating، loss اجزای سبک یا mixing ناکافی خطای جدی ایجاد می‌کند."
        ],
        report="روش آماده‌سازی/اختلاط در صورت اثرگذاری روی نتیجه.",
        when_to_use="قبل از آزمون‌های آب، نمک، رسوب، چگالی، فلزات و crude assay.",
        related=["ASTM D4057", "ASTM D4177"],
    ),
    S(
        "API MPMS 8.1",
        "Manual Sampling of Petroleum and Petroleum Products",
        domain=["sampling", "api", "crude", "fuels"],
        family="sampling",
        standard_type="practice",
        technique="Manual sampling",
        analytes=["representative sample"],
        matrices=["petroleum liquids"],
        measures="نمونه‌برداری دستی در چارچوب API MPMS.",
        principle="هم‌راستا با الزامات metering/custody transfer برای نمونه نماینده.",
        execution=["ظرف، نقطه نمونه‌برداری، ایمنی و documentation مهم است."],
        qc=COMMON_QC_SAMPLING,
        limitations=["برای اختلاف تجاری باید نسخه API/قرارداد کنترل شود."],
        report="sampling record.",
        when_to_use="custody transfer و عملیات پالایشگاهی/خط انتقال.",
        related=["ASTM D4057", "API MPMS 8.2", "API MPMS 8.3"],
    ),
    S(
        "API MPMS 8.2",
        "Automatic Sampling of Petroleum and Petroleum Products",
        domain=["sampling", "api", "crude"],
        family="sampling",
        standard_type="practice",
        technique="Automatic sampling",
        analytes=["representative sample"],
        matrices=["petroleum liquids"],
        measures="نمونه‌برداری خودکار در API MPMS.",
        principle="incremental sampling از جریان و composite sample.",
        execution=["probe location، flow proportionality و mixing باید کنترل شود."],
        qc=COMMON_QC_SAMPLING,
        limitations=["برای جریان چندفازی یا mixing بد، خطای systematic رخ می‌دهد."],
        report="automatic sampling record.",
        when_to_use="custody transfer نفت خام/محصول.",
        related=["ASTM D4177", "API MPMS 8.1"],
    ),
    S(
        "API MPMS 8.3",
        "Mixing and Handling of Liquid Samples",
        domain=["sampling", "api", "crude"],
        family="sample handling",
        standard_type="practice",
        technique="Mixing and handling",
        analytes=["representative test portion"],
        matrices=["petroleum liquids"],
        measures="handling و mixing نمونه‌های مایع نفتی.",
        principle="تبدیل sample به test portion نماینده بدون تغییر ترکیب.",
        execution=["دما، shear، زمان mixing و جلوگیری از loss سبک‌ها."],
        qc=["ثبت شرایط mixing و مشاهده فازها."],
        limitations=["برای آب/رسوب/فراریت، handling نادرست نتیجه را عوض می‌کند."],
        report="sample preparation record.",
        when_to_use="قبل از آزمون‌های حساس به ناهمگنی.",
        related=["ASTM D5854"],
    ),
    S(
        "API MPMS 11.1",
        "تصحیح دما/فشار چگالی و حجم نفت",
        domain=["api", "crude", "fuels"],
        family="volume correction",
        standard_type="calculation",
        technique="Petroleum measurement tables",
        analytes=["volume correction", "density correction"],
        matrices=["crude oil", "refined products", "lubricating oils"],
        measures="تصحیح چگالی/حجم به شرایط مرجع.",
        principle="استفاده از petroleum measurement tables/algorithms برای CTL/CPL.",
        execution=["انتخاب commodity group، دمای مرجع و واحدها حیاتی است."],
        qc=["کنترل ورودی density/API و temperature/pressure."],
        limitations=["برای custody transfer باید نسخه API/قرارداد دقیق کنترل شود."],
        report="حجم یا چگالی تصحیح‌شده.",
        when_to_use="محاسبات اندازه‌گیری و فروش نفت/فرآورده.",
        related=["ASTM D1250", "ASTM D4052"],
    ),
    S(
        "ASTM D1250",
        "Petroleum Measurement Tables",
        domain=["petroleum", "calculation"],
        family="volume correction",
        standard_type="calculation",
        technique="Petroleum measurement tables",
        analytes=["volume correction", "density correction"],
        matrices=["petroleum liquids"],
        measures="تصحیح حجم/چگالی به دمای مرجع.",
        principle="جداول/روابط تصحیح دما برای نفت و فرآورده‌ها.",
        execution=["نوع محصول، واحد، دمای مرجع و ورودی‌های دقیق."],
        qc=["کنترل density و temperature."],
        limitations=["برای اختلاف تجاری باید نسخه مورد قرارداد مشخص باشد."],
        report="corrected volume/density.",
        when_to_use="محاسبات metering و گزارش حجم استاندارد.",
        related=["API MPMS 11.1"],
    ),
    # -------------------------------------------------------------------------
    # Corrosion and sour service
    # -------------------------------------------------------------------------
    S(
        "ASTM G31",
        "آزمون خوردگی غوطه‌وری فلزات",
        domain=["corrosion", "materials"],
        family="corrosion",
        technique="Immersion corrosion",
        analytes=["corrosion rate", "mass loss"],
        matrices=["metals", "process fluids"],
        measures="نرخ خوردگی با کاهش وزن در آزمون غوطه‌وری.",
        principle="قراردهی coupon فلزی در محیط و محاسبه mass loss/corrosion rate.",
        execution=[
            "آماده‌سازی سطح، زمان، دما، ترکیب محیط و cleaning بعد از آزمون مهم است."
        ],
        qc=["Blank/coupon control، duplicate، ثبت pH/دما/ترکیب."],
        limitations=["شرایط آزمایشگاهی الزاماً نماینده شرایط واقعی جریان/فشار نیست."],
        report="corrosion rate، mass loss و مشاهدات سطحی.",
        when_to_use="screening خوردگی سیالات، آب تولیدی، chemical treatment و مواد.",
        related=["ASTM G1", "ASTM G102", "NACE TM0177"],
    ),
    S(
        "ASTM G1",
        "آماده‌سازی، تمیزکاری و ارزیابی specimen خوردگی",
        domain=["corrosion", "materials"],
        family="corrosion",
        standard_type="practice",
        technique="Specimen preparation/cleaning",
        analytes=["corrosion products", "mass loss"],
        matrices=["metal coupons"],
        measures="تمیزکاری و آماده‌سازی نمونه‌های خورده‌شده برای محاسبه mass loss.",
        principle="حذف محصولات خوردگی بدون حذف بیش از حد فلز پایه.",
        execution=["انتخاب محلول cleaning متناسب با آلیاژ و کنترل blank correction."],
        qc=["control coupon و repeat cleaning."],
        limitations=["cleaning بیش از حد یا ناکافی نرخ خوردگی را تغییر می‌دهد."],
        report="روش cleaning و mass loss corrected.",
        when_to_use="همراه با آزمون‌های corrosion coupon.",
        related=["ASTM G31", "ASTM G102"],
    ),
    S(
        "ASTM G102",
        "محاسبه نرخ خوردگی و اطلاعات الکتروشیمیایی",
        domain=["corrosion", "materials"],
        family="corrosion",
        standard_type="calculation",
        technique="Calculation",
        analytes=["corrosion rate", "electrochemical parameters"],
        matrices=["metals"],
        measures="محاسبه نرخ خوردگی و پارامترهای الکتروشیمیایی.",
        principle="تبدیل mass loss/current density به corrosion rate با روابط استاندارد.",
        execution=["واحدها، equivalent weight و density فلز باید درست انتخاب شوند."],
        qc=["کنترل ورودی‌های جرم، زمان، سطح و چگالی."],
        limitations=["محاسبه وابسته به ورودی‌های آزمون است."],
        report="mpy، mm/y یا واحد نرخ خوردگی.",
        when_to_use="گزارش‌کردن نرخ خوردگی از coupon یا داده الکتروشیمیایی.",
        related=["ASTM G31", "ASTM G1"],
    ),
    S(
        "NACE TM0177",
        "آزمون مقاومت فلزات به cracking در محیط H2S",
        domain=["corrosion", "sour service", "nace"],
        family="sour service",
        technique="SSC/HIC mechanical testing",
        analytes=["SSC", "sulfide stress cracking"],
        matrices=["metals", "alloys"],
        measures="مقاومت مواد به sulfide stress cracking در محیط sour.",
        principle="قراردهی نمونه تحت تنش در محیط H2S و ارزیابی cracking/failure.",
        execution=["ایمنی H2S، محلول آزمون، pH، تنش، زمان و متالورژی نمونه حیاتی است."],
        qc=["کنترل محلول، H2S، pH، specimen preparation و documentation."],
        limitations=[
            "برای انتخاب مواد واقعی باید با MR0175/ISO 15156 و شرایط سرویس تطبیق داده شود."
        ],
        report="pass/fail، زمان شکست یا مشاهدات ترک.",
        when_to_use="ارزیابی مواد برای sour service.",
        related=["NACE MR0175", "ISO 15156", "NACE TM0284"],
    ),
    S(
        "NACE MR0175",
        "مواد مقاوم برای محیط‌های H2S در تولید نفت و گاز",
        domain=["corrosion", "sour service", "nace"],
        family="sour service",
        standard_type="specification",
        technique="Material selection",
        analytes=["sour service material limits"],
        matrices=["oil and gas production equipment"],
        measures="الزامات انتخاب مواد برای محیط H2S.",
        principle="تعیین محدودیت‌های مواد/سختی/محیط برای جلوگیری از cracking در sour service.",
        execution=[
            "شرایط واقعی H2S، pH، کلراید، دما، فشار و material condition باید مشخص شود."
        ],
        qc=["کنترل مدارک material، hardness، heat treatment و service conditions."],
        limitations=["روش آزمون منفرد نیست؛ انتخاب مواد باید engineering review شود."],
        report="انطباق ماده/شرایط با الزامات sour service.",
        when_to_use="انتخاب متریال تجهیزات تولید/فرآورش نفت و گاز ترش.",
        related=["ISO 15156", "NACE TM0177", "NACE TM0284"],
    ),
    S(
        "ISO 15156",
        "Materials for use in H2S-containing oil and gas environments",
        domain=["corrosion", "sour service", "iso"],
        family="sour service",
        standard_type="specification",
        technique="Material selection",
        analytes=["sour service material selection"],
        matrices=["oil and gas equipment"],
        measures="انتخاب مواد برای محیط‌های نفت و گاز دارای H2S.",
        principle="الزامات material/environment برای کاهش ریسک SSC/SCC/HIC.",
        execution=["شرایط سرویس، آلیاژ، hardness و heat treatment باید بررسی شود."],
        qc=["مدارک ماده، تست‌ها و engineering review."],
        limitations=["جایگزین تحلیل خوردگی/فرآیندی نیست."],
        report="انطباق با ISO 15156.",
        when_to_use="طراحی/انتخاب مواد در محیط‌های ترش.",
        related=["NACE MR0175", "NACE TM0177"],
    ),
    S(
        "NACE TM0284",
        "HIC آزمون فولادها در محیط H2S",
        domain=["corrosion", "sour service", "nace"],
        family="sour service",
        technique="HIC testing",
        analytes=["hydrogen induced cracking", "HIC"],
        matrices=["pipeline steels", "plate steels"],
        measures="حساسیت فولاد به hydrogen-induced cracking.",
        principle="قراردهی نمونه در محیط H2S و ارزیابی ترک‌ها با metallography/ultrasonic طبق روش.",
        execution=["محلول، H2S، زمان، specimen orientation و ایمنی مهم است."],
        qc=["کنترل pH، H2S، specimen prep و inspection."],
        limitations=["نتیجه به steel cleanliness و شرایط آزمون وابسته است."],
        report="CLR/CTR/CSR یا شاخص‌های روش.",
        when_to_use="ارزیابی فولاد خط لوله/تجهیزات برای سرویس ترش.",
        related=["NACE TM0177", "ISO 15156"],
    ),
    # -------------------------------------------------------------------------
    # Catalyst and adsorbent characterization
    # -------------------------------------------------------------------------
    S(
        "ASTM D3663",
        "Surface Area کاتالیست‌ها با جذب نیتروژن",
        domain=["catalyst", "adsorbent"],
        family="surface area",
        technique="Nitrogen adsorption BET",
        analytes=["surface area", "BET"],
        matrices=["catalysts", "porous solids"],
        measures="سطح ویژه کاتالیست/جامدات متخلخل.",
        principle="جذب فیزیکی نیتروژن و محاسبه سطح با مدل BET.",
        execution=["Degassing، جرم نمونه، تمیزی سل و انتخاب بازه فشار نسبی مهم است."],
        qc=["Reference material، duplicate، کنترل leak/dead volume."],
        limitations=["Microporosity و انتخاب نادرست بازه BET باعث خطا می‌شود."],
        report="m²/g.",
        when_to_use="کنترل سطح ویژه کاتالیست، جاذب و پایه‌ها.",
        related=["ISO 9277", "ASTM D4284"],
    ),
    S(
        "ISO 9277",
        "سطح ویژه جامدات با روش BET",
        domain=["catalyst", "adsorbent", "materials"],
        family="surface area",
        technique="Gas adsorption BET",
        analytes=["specific surface area", "BET"],
        matrices=["disperse solids", "porous materials", "catalysts"],
        measures="Specific surface area با gas adsorption.",
        principle="جذب گاز و محاسبه BET.",
        execution=["Degassing، انتخاب گاز، بازه فشار نسبی و کنترل leak."],
        qc=["Reference material، repeat analysis، blank/dead volume control."],
        limitations=["مدل BET برای همه مواد/بازه‌ها معتبر نیست."],
        report="m²/g.",
        when_to_use="BET عمومی برای کاتالیست‌ها و مواد متخلخل.",
        related=["ASTM D3663"],
    ),
    S(
        "ASTM D4284",
        "Pore Volume Distribution با Mercury Intrusion",
        domain=["catalyst", "adsorbent", "materials"],
        family="porosity",
        technique="Mercury intrusion porosimetry",
        analytes=["pore volume", "pore size distribution"],
        matrices=["catalysts", "porous solids"],
        measures="توزیع اندازه حفرات و حجم حفره.",
        principle="ورود جیوه تحت فشار به حفرات و محاسبه توزیع حفرات.",
        execution=["خشک‌کردن نمونه، ایمنی جیوه و انتخاب فشار."],
        qc=["Blank، reference porous material، repeat."],
        limitations=["روش مخرب است و فرضیات هندسی دارد؛ برای micropores مناسب نیست."],
        report="cm³/g و توزیع pore size.",
        when_to_use="بررسی ساختار حفره‌ای کاتالیست/جاذب.",
        related=["ASTM D3663", "ISO 9277"],
    ),
    S(
        "ASTM D4058",
        "Attrition and Abrasion of Catalysts",
        domain=["catalyst"],
        family="mechanical strength",
        technique="Attrition/abrasion",
        analytes=["attrition", "abrasion loss"],
        matrices=["catalysts", "pellets", "granules"],
        measures="مقاومت کاتالیست در برابر attrition/abrasion.",
        principle="قراردهی ذرات تحت شرایط مکانیکی و اندازه‌گیری fines/loss.",
        execution=["اندازه ذرات، رطوبت، زمان و شرایط مکانیکی باید کنترل شود."],
        qc=["Duplicate، کنترل sieve و جرم اولیه/نهایی."],
        limitations=["شرایط آزمون ممکن است دقیقاً شرایط راکتور را بازسازی نکند."],
        report="درصد attrition/abrasion یا fines.",
        when_to_use="کنترل دوام مکانیکی کاتالیست/جاذب.",
        related=["ASTM D7084"],
    ),
    S(
        "ASTM D7084",
        "Bulk Crush Strength of Catalysts and Catalyst Carriers",
        domain=["catalyst"],
        family="mechanical strength",
        technique="Bulk crush strength",
        analytes=["crush strength"],
        matrices=["catalysts", "catalyst carriers"],
        measures="استحکام فشاری توده‌ای کاتالیست/پایه.",
        principle="اعمال نیرو به bed یا نمونه و محاسبه مقاومت فشاری.",
        execution=["اندازه ذرات، رطوبت، شکل ذرات و packing باید کنترل شود."],
        qc=["Duplicate، کنترل دستگاه نیرو، sample conditioning."],
        limitations=["نتیجه همیشه رفتار واقعی راکتور را کامل پیش‌بینی نمی‌کند."],
        report="force/pressure یا شاخص strength طبق روش.",
        when_to_use="کنترل دوام مکانیکی catalyst/carrier.",
        related=["ASTM D4058"],
    ),
    S(
        "CATALYST-XRD",
        "راهنمای داخلی XRD برای کاتالیست‌ها",
        domain=["catalyst", "materials"],
        family="phase identification",
        standard_type="internal_note",
        technique="XRD",
        analytes=["crystalline phases", "crystallite size"],
        matrices=["catalysts", "adsorbents", "supports"],
        measures="شناسایی فازهای کریستالی و در صورت اعتبارسنجی، crystallite size.",
        principle="پراش پرتو X از صفحات بلوری و تطبیق الگو با دیتابیس فازها.",
        execution=[
            "آماده‌سازی پودر، اندازه ذرات، preferred orientation و انتخاب بازه 2θ مهم است."
        ],
        qc=[
            "Reference material، alignment check، blank/background، تکرارپذیری peak position."
        ],
        limitations=[
            "فازهای amorphous و مقادیر کم ممکن است قابل تشخیص نباشند؛ کمی‌سازی نیاز به روش معتبر دارد."
        ],
        report="فازهای شناسایی‌شده، peak positions، crystallite size در صورت اعتبارسنجی.",
        when_to_use="شناسایی فاز active/support و تغییرات پس از calcination/reduction.",
        related=["ISO 9277", "CATALYST-TPR", "CATALYST-TPD"],
    ),
    S(
        "CATALYST-TPR",
        "راهنمای داخلی TPR برای کاتالیست‌ها",
        domain=["catalyst"],
        family="redox characterization",
        standard_type="internal_note",
        technique="TPR",
        analytes=["reducibility", "H2 consumption"],
        matrices=["metal catalysts", "oxide catalysts"],
        measures="قابلیت احیا و مصرف H2.",
        principle="گرمایش برنامه‌ریزی‌شده در گاز احیاکننده و اندازه‌گیری مصرف H2/سیگنال TCD/MS.",
        execution=["جرم نمونه، pretreatment، flow، ramp rate و baseline حیاتی است."],
        qc=["Blank run، calibration gas/pulse، reference catalyst، duplicate."],
        limitations=[
            "روش بیشتر characterization است؛ استاندارد عمومی واحدی برای همه کاتالیست‌ها ندارد."
        ],
        report="دمای پیک‌ها، H2 consumption و تفسیر redox.",
        when_to_use="مقایسه احیاپذیری کاتالیست‌ها و اثر preparation/aging.",
        related=["CATALYST-XRD", "CATALYST-TPD"],
    ),
    S(
        "CATALYST-TPD",
        "راهنمای داخلی TPD برای اسیدیته/بازیسیته کاتالیست",
        domain=["catalyst"],
        family="acid/base characterization",
        standard_type="internal_note",
        technique="TPD",
        analytes=["acidity", "basicity", "NH3-TPD", "CO2-TPD"],
        matrices=["solid catalysts", "zeolites", "oxides"],
        measures="قدرت و مقدار نسبی سایت‌های اسیدی/بازی.",
        principle="جذب probe molecule و desorption برنامه‌ریزی‌شده با دما.",
        execution=[
            "Pretreatment، اشباع probe، purge، ramp rate و calibration مهم است."
        ],
        qc=["Blank، reference catalyst، duplicate، calibration response."],
        limitations=[
            "تفسیر پیک‌ها به شدت وابسته به روش و ماتریس است؛ کمی‌سازی مطلق نیاز به validation دارد."
        ],
        report="پروفایل desorption، مقدار جذب و تفسیر سایت‌ها.",
        when_to_use="مقایسه اسیدیته/بازیسیته کاتالیست‌ها.",
        related=["CATALYST-TPR", "CATALYST-XRD"],
    ),
    S(
        "CATALYST-ICP",
        "راهنمای داخلی ICP برای کاتالیست‌ها و جاذب‌ها",
        domain=["catalyst", "metals"],
        family="metals",
        standard_type="internal_note",
        technique="ICP-OES/ICP-MS after digestion",
        analytes=["active metals", "promoters", "poisons", "contaminants"],
        matrices=["catalysts", "adsorbents", "spent catalysts"],
        measures="فلزات فعال، promoterها، poisonها و آلودگی‌ها در کاتالیست.",
        principle="digestion یا fusion مناسب و اندازه‌گیری با ICP.",
        execution=[
            "انتخاب روش digestion برای انحلال کامل فازها، dilution و کنترل contamination مهم است."
        ],
        qc=COMMON_QC_ICP,
        limitations=["digestion ناقص یا matrix effect می‌تواند نتیجه را کم‌نمایی کند."],
        report="wt%، mg/kg یا ppm عناصر.",
        when_to_use="آنالیز fresh/spent catalyst و بررسی poisonهایی مثل Ni, V, Na, Fe, As.",
        related=["EPA 6010", "EPA 6020", "ASTM D5185"],
    ),
]


# =============================================================================
# 4) Aliases, normalization, extraction
# =============================================================================

PERSIAN_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def normalize_text(text: str) -> str:
    text = (text or "").translate(PERSIAN_DIGITS)
    text = text.replace("–", "-").replace("—", "-").replace("−", "-")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def auto_aliases_for(code: str) -> List[str]:
    aliases = {code, code.upper()}
    m = re.match(r"ASTM D(\d+)$", code)
    if m:
        n = m.group(1)
        aliases.update({f"D{n}", f"D {n}", f"ASTM D {n}", f"ASTM-D{n}"})
    m = re.match(r"ISO (\d+)$", code)
    if m:
        n = m.group(1)
        aliases.update({f"ISO{n}", f"ISO {n}"})
    m = re.match(r"EPA (\d+(?:\.\d+)?)$", code)
    if m:
        n = m.group(1)
        aliases.update({f"EPA{n}", f"EPA {n}"})
    m = re.match(r"SM (\d+)(?:-([A-Z]+))?$", code)
    if m:
        base, suffix = m.group(1), m.group(2)
        aliases.update({f"SM{base}", f"SM {base}"})
        if suffix:
            aliases.update({f"SM {base}-{suffix}", f"SM{base}-{suffix}"})
    m = re.match(r"EN (\d+)$", code)
    if m:
        n = m.group(1)
        aliases.update({f"EN{n}", f"EN {n}"})
    m = re.match(r"IP (\d+)$", code)
    if m:
        n = m.group(1)
        aliases.update({f"IP{n}", f"IP {n}"})
    return list(aliases)


def build_alias_map(entries: Sequence[StandardEntry]) -> Dict[str, str]:
    alias_map: Dict[str, str] = {}
    for entry in entries:
        for alias in set(auto_aliases_for(entry.code) + entry.aliases):
            key = normalize_text(alias).upper()
            alias_map[key] = entry.code
            alias_map[key.replace(" ", "")] = entry.code
    return alias_map


ALIAS_TO_CODE: Dict[str, str] = build_alias_map(STANDARDS)
STANDARD_KNOWLEDGE: Dict[str, StandardEntry] = {s.code: s for s in STANDARDS}


def normalize_standard_code(code: str) -> str:
    text = normalize_text(code).upper().strip()
    text = re.sub(r"(?<=\d)[-:]\d{2,4}\b", "", text)
    text = re.sub(r"\s+", " ", text)

    direct = ALIAS_TO_CODE.get(text) or ALIAS_TO_CODE.get(text.replace(" ", ""))
    if direct:
        return direct

    patterns: List[Tuple[str, str]] = [
        (r"\bASTM\s*D\s*(\d{2,5})[A-Z]?\b", "ASTM D{0}"),
        (r"\bD\s*(\d{2,5})[A-Z]?\b", "ASTM D{0}"),
        (r"\bISO\s*(\d{3,6})\b", "ISO {0}"),
        (r"\bEPA\s*(\d{3,4}(?:\.\d+)?)[A-Z]?\b", "EPA {0}"),
        (r"\bSM\s*(\d{4})(?:\s*-\s*([A-Z]+))?\b", "SM {0}{dash}{1}"),
        (r"\bUOP\s*(\d{1,4})\b", "UOP {0}"),
        (r"\bIP\s*(\d{1,4})\b", "IP {0}"),
        (r"\bEN\s*(\d{2,5})\b", "EN {0}"),
        (r"\bGPA\s*(\d{3,4})\b", "GPA {0}"),
        (r"\bAPI\s*MPMS\s*(\d+(?:\.\d+)*)\b", "API MPMS {0}"),
        (r"\bNACE\s*(TM|MR)\s*(\d{4,5})\b", "NACE {0}{1}"),
        (r"\bCATALYST\s*-\s*(XRD|TPR|TPD|ICP)\b", "CATALYST-{0}"),
    ]
    for pattern, template in patterns:
        m = re.search(pattern, text)
        if not m:
            continue
        groups = m.groups(default="")
        if "{dash}" in template:
            dash = "-" if groups[1] else ""
            return template.format(groups[0], groups[1], dash=dash)
        return template.format(*groups)

    return text


STANDARD_PATTERNS = [
    r"\bASTM\s*D\s*\d{2,5}[A-Z]?(?:[-:]\d{2,4})?\b",
    r"\bD\s*\d{2,5}[A-Z]?(?:[-:]\d{2,4})?\b",
    r"\bISO\s*\d{3,6}(?:[-:]\d{2,4})?\b",
    r"\bEPA\s*\d{3,4}(?:\.\d+)?[A-Z]?\b",
    r"\bSM\s*\d{4}(?:\s*-\s*[A-Z]+)?\b",
    r"\bUOP\s*\d{1,4}\b",
    r"\bIP\s*\d{1,4}\b",
    r"\bEN\s*\d{2,5}\b",
    r"\bGPA\s*\d{3,4}\b",
    r"\bAPI\s*MPMS\s*\d+(?:\.\d+)*\b",
    r"\bNACE\s*(?:TM|MR)\s*\d{4,5}\b",
    r"\bCATALYST\s*-\s*(?:XRD|TPR|TPD|ICP)\b",
]


def extract_standard_codes(message: str) -> List[str]:
    text = normalize_text(message)
    found: List[str] = []
    for pattern in STANDARD_PATTERNS:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            normalized = normalize_standard_code(match.group(0))
            if normalized not in found:
                found.append(normalized)
    return found


def extract_standard_code(message: str) -> Optional[str]:
    codes = extract_standard_codes(message)
    return codes[0] if codes else None


# =============================================================================
# 5) Search and context
# =============================================================================


def _tokenize(text: str) -> List[str]:
    text = normalize_text(text).lower()
    text = re.sub(r"[^\w\u0600-\u06FF\.]+", " ", text)
    return [t for t in text.split() if len(t) >= 2]


def _entry_search_text(entry: StandardEntry) -> str:
    parts = [
        entry.code,
        entry.title_fa,
        entry.title_en,
        entry.family,
        entry.technique,
        entry.measures,
        entry.principle,
        entry.when_to_use,
        entry.when_not_enough,
        " ".join(entry.domain),
        " ".join(entry.analytes),
        " ".join(entry.matrices),
        " ".join(entry.tags),
        " ".join(entry.related),
    ]
    return normalize_text(" ".join(parts)).lower()


SYNONYMS: Dict[str, List[str]] = {
    "گوگرد": ["sulfur", "sulphur"],
    "جیوه": ["mercury", "hg"],
    "بنزین": ["gasoline", "petrol"],
    "گاز": ["gas"],
    "ال پی جی": ["lpg"],
    "نفت خام": ["crude oil", "crude"],
    "آب": ["water"],
    "پساب": ["wastewater"],
    "فلز": ["metal", "metals"],
    "اکتان": ["octane"],
    "ستان": ["cetane"],
    "ویسکوزیته": ["viscosity"],
    "چگالی": ["density"],
    "کاتالیست": ["catalyst"],
    "جاذب": ["adsorbent"],
    "رسوب": ["sediment"],
    "نمک": ["salt"],
    "خوردگی": ["corrosion"],
}


def search_standards(
    query: str,
    *,
    limit: int = 10,
    domain: Optional[str] = None,
    family: Optional[str] = None,
) -> List[Dict[str, Any]]:
    q_norm = normalize_text(query).lower()
    q_tokens = _tokenize(q_norm)
    results: List[Tuple[int, StandardEntry]] = []

    normalized_code = normalize_standard_code(query)
    if normalized_code in STANDARD_KNOWLEDGE:
        results.append((10_000, STANDARD_KNOWLEDGE[normalized_code]))

    for entry in STANDARDS:
        if domain and domain.lower() not in [d.lower() for d in entry.domain]:
            continue
        if family and family.lower() != entry.family.lower():
            continue

        text = _entry_search_text(entry)
        score = 0
        if q_norm and q_norm in text:
            score += 25
        for token in q_tokens:
            if token in text:
                score += 3
            if token in normalize_text(entry.code).lower():
                score += 20
            if token in [x.lower() for x in entry.analytes]:
                score += 8
            if token in [x.lower() for x in entry.matrices]:
                score += 6
            if token in [x.lower() for x in entry.domain]:
                score += 5

        for fa, ens in SYNONYMS.items():
            if fa in q_norm and any(en in text for en in ens):
                score += 10
            if any(en in q_norm for en in ens) and fa in text:
                score += 10

        if score > 0:
            results.append((score, entry))

    seen = set()
    unique: List[Tuple[int, StandardEntry]] = []
    for score, entry in sorted(results, key=lambda x: x[0], reverse=True):
        if entry.code not in seen:
            unique.append((score, entry))
            seen.add(entry.code)

    return [
        {
            "score": score,
            "code": entry.code,
            "title_fa": entry.title_fa,
            "family": entry.family,
            "type": entry.standard_type,
            "technique": entry.technique,
            "matrices": entry.matrices,
            "analytes": entry.analytes,
            "when_to_use": entry.when_to_use,
        }
        for score, entry in unique[:limit]
    ]


def get_standard_context(
    message: str, *, compact: bool = False, max_items: int = 5
) -> str:
    codes = extract_standard_codes(message)
    if not codes:
        return ""

    blocks: List[str] = []
    for code in codes[:max_items]:
        knowledge = STANDARD_KNOWLEDGE.get(code)
        if knowledge:
            blocks.append(knowledge.to_context(compact=compact))
        else:
            blocks.append(f"""
کد استاندارد شناسایی‌شده:
{code}

برای این استاندارد هنوز دانش ساختاریافته داخلی ثبت نشده است.
پاسخ باید محتاطانه باشد و برای قطعیت، نسخه رسمی استاندارد بررسی شود.
""".strip())

    if len(codes) > max_items:
        blocks.append(
            f"تعداد {len(codes) - max_items} استاندارد دیگر هم در متن دیده شد، ولی برای جلوگیری از طولانی شدن context نمایش داده نشد."
        )
    return "\n\n---\n\n".join(blocks)


# =============================================================================
# 6) Specification graph
# =============================================================================

SPECIFICATION_METHOD_GRAPH: Dict[str, Dict[str, List[str]]] = {
    "ASTM D1835": {
        "sampling": ["ASTM D1265", "ASTM D3700", "ASTM D6849"],
        "composition": ["ASTM D2163"],
        "sulfur": ["ASTM D6667", "ASTM D5504", "ASTM D7551", "ASTM D2420"],
        "corrosion": ["ASTM D1838"],
        "residue": ["ASTM D2158"],
        "density": ["ASTM D1657", "ASTM D2598"],
    },
    "ASTM D975": {
        "sampling": ["ASTM D4057"],
        "distillation": ["ASTM D86"],
        "viscosity": ["ASTM D445"],
        "density": ["ASTM D4052", "ASTM D1298"],
        "flash_point": ["ASTM D93"],
        "sulfur": ["ASTM D5453", "ASTM D4294", "ASTM D7039"],
        "cetane": ["ASTM D613", "ASTM D6890", "ASTM D4737"],
        "cold_flow": ["ASTM D2500", "ASTM D6371", "EN 116"],
        "lubricity": ["ASTM D6079"],
        "corrosion": ["ASTM D130"],
    },
    "ASTM D4814": {
        "sampling": ["ASTM D4057"],
        "octane": ["ASTM D2699", "ASTM D2700"],
        "vapor_pressure": ["ASTM D5191", "ASTM D323"],
        "distillation": ["ASTM D86"],
        "benzene_aromatics": ["ASTM D3606", "ASTM D5580", "ASTM D5769"],
        "oxygenates": ["ASTM D5599", "ASTM D4815"],
        "sulfur": ["ASTM D5453", "ASTM D4294", "ASTM D7039"],
        "gum": ["ASTM D381"],
    },
    "ASTM D1655": {
        "sampling": ["ASTM D4057"],
        "distillation": ["ASTM D86"],
        "flash_point": ["ASTM D93"],
        "freezing_point": ["ASTM D2386", "ASTM D5972"],
        "thermal_stability": ["ASTM D3241"],
        "sulfur": ["ASTM D5453", "ASTM D4294"],
    },
    "ISO 8217": {
        "viscosity": ["ASTM D445"],
        "flash_point": ["ASTM D93"],
        "sulfur": ["ASTM D5453", "ASTM D4294", "ISO 20846", "ISO 8754"],
        "water_sediment": ["ASTM D95", "ASTM D1796", "ASTM D4007"],
        "h2s": ["ASTM D5705", "ASTM D7621"],
        "density": ["ASTM D4052", "ASTM D1298"],
    },
    "EN 590": {
        "cetane": ["ASTM D613", "ASTM D6890", "ASTM D4737"],
        "cold_flow": ["EN 116", "ASTM D6371"],
        "sulfur": ["ISO 20846", "ISO 20847", "ASTM D5453"],
        "viscosity": ["ASTM D445"],
        "distillation": ["ASTM D86"],
    },
    "EN 228": {
        "octane": ["ASTM D2699", "ASTM D2700"],
        "vapor_pressure": ["ASTM D5191"],
        "aromatics_benzene": ["ASTM D5580", "ASTM D3606", "ASTM D5769"],
        "oxygenates": ["ASTM D5599", "ASTM D4815"],
        "sulfur": ["ISO 20846", "ISO 20847", "ASTM D5453"],
    },
}


def expand_specification(code: str) -> Dict[str, Any]:
    normalized = normalize_standard_code(code)
    graph = SPECIFICATION_METHOD_GRAPH.get(normalized, {})
    return {
        "specification": normalized,
        "title": (
            STANDARD_KNOWLEDGE.get(normalized).title_fa
            if normalized in STANDARD_KNOWLEDGE
            else "نامشخص"
        ),
        "method_groups": graph,
        "note": "Specification روش آزمون منفرد نیست؛ برای هر پارامتر باید test method مربوط و نسخه رسمی کنترل شود.",
    }


# =============================================================================
# 7) Recommendation engine
# =============================================================================

QUESTION_KEYWORDS: Dict[str, List[str]] = {
    "matrix_crude": ["crude", "crude oil", "نفت خام"],
    "matrix_lpg": ["lpg", "lp gas", "ال پی جی", "گاز مایع"],
    "matrix_gas": [
        "natural gas",
        "fuel gas",
        "hydrocarbon gas",
        "گاز طبیعی",
        "گاز هیدروکربنی",
        "نمونه گازی",
    ],
    "matrix_gasoline": ["gasoline", "petrol", "بنزین"],
    "matrix_diesel": ["diesel", "دیزل", "گازوئیل"],
    "matrix_jet": ["jet", "aviation", "سوخت جت", "هوایی"],
    "matrix_water": [
        "water",
        "wastewater",
        "produced water",
        "آب",
        "پساب",
        "آب تولیدی",
    ],
    "matrix_catalyst": ["catalyst", "adsorbent", "کاتالیست", "جاذب"],
    "target_sulfur_total": ["total sulfur", "sulfur", "گوگرد کل", "گوگرد"],
    "target_sulfur_speciation": [
        "h2s",
        "mercaptan",
        "cos",
        "cs2",
        "speciation",
        "گونه",
        "مرکاپتان",
    ],
    "target_water_salt_sediment": [
        "water",
        "salt",
        "sediment",
        "bs&w",
        "bsw",
        "آب",
        "نمک",
        "رسوب",
    ],
    "target_btex_voc": ["btex", "voc", "benzene", "toluene", "بنزن", "تولوئن"],
    "target_metals": ["metal", "metals", "icp", "فلز", "فلزات"],
    "target_mercury": ["mercury", "hg", "جیوه"],
    "target_physical": [
        "density",
        "viscosity",
        "flash",
        "distillation",
        "vapor pressure",
        "چگالی",
        "ویسکوزیته",
        "تقطیر",
        "نقطه اشتعال",
        "فشار بخار",
    ],
    "target_acid_base": [
        "acid number",
        "base number",
        "tan",
        "tbn",
        "اسیدیته",
        "قلیائیت",
    ],
    "target_corrosion": ["corrosion", "h2s", "sour", "خوردگی", "ترش"],
    "purpose_specification": [
        "spec",
        "specification",
        "limit",
        "pass",
        "fail",
        "انطباق",
        "مشخصات",
        "حد مجاز",
    ],
    "purpose_qc": ["qc", "routine", "control", "کنترل کیفیت", "روتین"],
    "purpose_trace": ["trace", "low", "ppb", "ultra", "خیلی کم", "پایین", "ردیابی"],
}


def classify_lab_request(text: str) -> Dict[str, List[str]]:
    norm = normalize_text(text).lower()
    found: Dict[str, List[str]] = {"matrix": [], "target": [], "purpose": []}
    for key, words in QUESTION_KEYWORDS.items():
        if any(w.lower() in norm for w in words):
            bucket = key.split("_", 1)[0]
            label = key.split("_", 1)[1]
            if label not in found[bucket]:
                found[bucket].append(label)
    return found


def needed_clarifications(classification: Dict[str, List[str]]) -> List[str]:
    questions: List[str] = []
    if not classification.get("matrix"):
        questions.append(
            "ماتریس نمونه مشخص نیست: نفت خام، بنزین، دیزل، LPG، گاز، آب/پساب، روغن یا کاتالیست؟"
        )
    if not classification.get("target"):
        questions.append(
            "پارامتر هدف مشخص نیست: گوگرد کل، H2S/مرکاپتان، آب/نمک/رسوب، BTEX/VOC، فلزات، چگالی، ویسکوزیته و غیره؟"
        )
    if (
        "sulfur_speciation" in classification.get("target", [])
        and "lpg" not in classification.get("matrix", [])
        and "gas" not in classification.get("matrix", [])
    ):
        questions.append(
            "برای گونه‌بندی گوگرد، فاز نمونه و ترکیبات هدف مثل H2S، مرکاپتان، COS یا CS2 باید مشخص شود."
        )
    if "specification" in classification.get("purpose", []):
        questions.append(
            "برای انطباق specification، نسخه استاندارد/قرارداد و کشور/بازار هدف باید مشخص شود."
        )
    return questions


def red_flags_for_request(classification: Dict[str, List[str]], text: str) -> List[str]:
    flags: List[str] = []
    matrix = classification.get("matrix", [])
    target = classification.get("target", [])
    purpose = classification.get("purpose", [])
    norm = normalize_text(text).lower()

    if "lpg" in matrix:
        flags.append(
            "در LPG، نمونه‌برداری/سیلندر/فشار می‌تواند از خود آزمون مهم‌تر باشد؛ D1265/D3700/D6849 را کنار روش آزمون ببین."
        )
    if "gas" in matrix and ("sulfur_total" in target or "sulfur_speciation" in target):
        flags.append(
            "ترکیبات گوگردی گازی جذب‌پذیر و ناپایدارند؛ خطوط و رگولاتور inert و leak check لازم است."
        )
    if "crude" in matrix and "water_salt_sediment" in target:
        flags.append(
            "برای نفت خام، همگن‌سازی، دمای handling و representative بودن test portion ریسک اصلی است."
        )
    if "trace" in purpose or "ppb" in norm:
        flags.append(
            "برای سطوح trace، blank، آلودگی محیطی، LOD/LOQ دستگاه و نسخه روش باید جداگانه کنترل شود."
        )
    if "specification" in purpose:
        flags.append(
            "Specification مثل D975/D4814/D1835 روش آزمون نیست؛ باید test methodهای ارجاعی و نسخه رسمی چک شوند."
        )
    if "catalyst" in matrix:
        flags.append(
            "برای کاتالیست، BET/XRD/TPR/TPD اغلب characterization هستند؛ SOP داخلی و validation لازم است."
        )
    return flags


def recommend_methods(
    query: str = "",
    *,
    sample: str = "",
    analyte: str = "",
    goal: str = "",
    limit: int = 8,
) -> Dict[str, Any]:
    full = normalize_text(" ".join([query, sample, analyte, goal])).lower()
    classification = classify_lab_request(full)
    boosted: List[str] = []

    def add_many(codes: Sequence[str]) -> None:
        for code in codes:
            normalized = normalize_standard_code(code)
            if normalized in STANDARD_KNOWLEDGE and normalized not in boosted:
                boosted.append(normalized)

    matrix = classification.get("matrix", [])
    target = classification.get("target", [])

    if "lpg" in matrix and "sulfur_speciation" in target:
        add_many(
            [
                "ASTM D1265",
                "ASTM D3700",
                "ASTM D6849",
                "ASTM D5504",
                "ASTM D6667",
                "ASTM D2420",
            ]
        )
    if "lpg" in matrix and "sulfur_total" in target:
        add_many(["ASTM D1265", "ASTM D3700", "ASTM D6667", "ASTM D7551", "ASTM D5504"])
    if "lpg" in matrix and not target:
        add_many(["ASTM D1265", "ASTM D2163", "ASTM D1835", "ASTM D1838", "ASTM D2158"])
    if "gas" in matrix and "sulfur_speciation" in target:
        add_many(["ASTM D5504", "ASTM D1945", "ASTM D3588"])
    if "gas" in matrix and not target:
        add_many(["ASTM D1945", "ASTM D3588", "ISO 6974", "ISO 6976"])
    if "crude" in matrix and "water_salt_sediment" in target:
        add_many(
            [
                "ASTM D5854",
                "ASTM D4006",
                "ASTM D4377",
                "ASTM D6304",
                "ASTM D3230",
                "ASTM D4007",
                "ASTM D473",
            ]
        )
    if "crude" in matrix and "mercury" in target:
        add_many(["ASTM D7623", "EPA 7473"])
    if "gasoline" in matrix and "btex_voc" in target:
        add_many(["ASTM D5580", "ASTM D3606", "ASTM D5769", "ASTM D6733"])
    if "water" in matrix and "btex_voc" in target:
        add_many(["EPA 8260", "EPA 8015", "EPA 8270"])
    if "mercury" in target:
        add_many(["ASTM D7623", "EPA 7473", "EPA 1631", "EPA 245.1"])
    if "metals" in target:
        add_many(["EPA 6020", "EPA 6010", "ASTM D5185", "ASTM D5708", "CATALYST-ICP"])
    if "catalyst" in matrix:
        add_many(
            [
                "ASTM D3663",
                "ISO 9277",
                "ASTM D4284",
                "ASTM D4058",
                "ASTM D7084",
                "CATALYST-XRD",
                "CATALYST-TPR",
                "CATALYST-TPD",
                "CATALYST-ICP",
            ]
        )
    if "diesel" in matrix:
        add_many(
            [
                "ASTM D975",
                "ASTM D86",
                "ASTM D445",
                "ASTM D5453",
                "ASTM D613",
                "ASTM D6371",
                "ASTM D6079",
            ]
        )
    if "gasoline" in matrix:
        add_many(
            [
                "ASTM D4814",
                "ASTM D2699",
                "ASTM D2700",
                "ASTM D5191",
                "ASTM D86",
                "ASTM D5453",
            ]
        )
    if "jet" in matrix:
        add_many(
            [
                "ASTM D1655",
                "ASTM D86",
                "ASTM D93",
                "ASTM D2386",
                "ASTM D5972",
                "ASTM D3241",
            ]
        )
    if "sulfur_total" in target and not boosted:
        add_many(["ASTM D5453", "ASTM D4294", "ASTM D7039", "ISO 20846", "ISO 20847"])

    for hit in search_standards(full, limit=limit * 2):
        code = hit["code"]
        if code not in boosted:
            boosted.append(code)

    entries = [
        STANDARD_KNOWLEDGE[c] for c in boosted[:limit] if c in STANDARD_KNOWLEDGE
    ]
    return {
        "query": full,
        "classification": classification,
        "red_flags": red_flags_for_request(classification, full),
        "must_ask": needed_clarifications(classification),
        "codes": [e.code for e in entries],
        "recommendations": [e.to_context(compact=True) for e in entries],
        "official_caution": "برای گزارش رسمی، ممیزی، accreditation یا اختلاف تجاری، نسخه رسمی و سال انتشار استاندارد باید کنترل شود.",
    }


def build_professional_answer_context(message: str, *, limit: int = 8) -> str:
    direct = get_standard_context(message, max_items=limit)
    rec = recommend_methods(query=message, limit=limit)

    blocks: List[str] = []
    if direct:
        blocks.append("استانداردهای شناسایی‌شده در متن:\n" + direct)

    if rec["recommendations"]:
        blocks.append(
            "پیشنهاد موتور انتخاب روش:\n" + "\n\n".join(rec["recommendations"])
        )

    if rec["red_flags"]:
        blocks.append("ریسک‌ها و نکات حیاتی:\n" + format_list(rec["red_flags"]))

    if rec["must_ask"]:
        blocks.append(
            "ابهام‌هایی که در صورت امکان باید از کاربر پرسیده شود:\n"
            + format_list(rec["must_ask"])
        )

    blocks.append("احتیاط رسمی:\n" + rec["official_caution"])
    return "\n\n---\n\n".join(blocks)


# تابع اصلی برای اپ
def get_context_for_app(message: str) -> str:
    direct = get_standard_context(message, max_items=6)
    rec = recommend_methods(query=message, limit=6)

    if not direct and not rec.get("recommendations"):
        return ""

    return build_professional_answer_context(message, limit=6)


# =============================================================================
# 8) Utilities
# =============================================================================


def standard_card(code: str) -> Dict[str, Any]:
    normalized = normalize_standard_code(code)
    entry = STANDARD_KNOWLEDGE.get(normalized)
    if not entry:
        return {
            "code": normalized,
            "found": False,
            "message": "در دیتابیس داخلی موجود نیست.",
        }
    return {
        "found": True,
        "code": entry.code,
        "title_fa": entry.title_fa,
        "title_en": entry.title_en,
        "domain": entry.domain,
        "family": entry.family,
        "type": entry.standard_type,
        "technique": entry.technique,
        "analytes": entry.analytes,
        "matrices": entry.matrices,
        "best_for": entry.when_to_use,
        "not_enough": entry.when_not_enough,
        "related": entry.related,
        "caution": entry.caution,
    }


def compare_standards(codes: Sequence[str]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for raw in codes:
        code = normalize_standard_code(raw)
        entry = STANDARD_KNOWLEDGE.get(code)
        if not entry:
            rows.append({"code": code, "status": "not_found"})
            continue
        rows.append(
            {
                "code": entry.code,
                "title": entry.title_fa,
                "family": entry.family,
                "type": entry.standard_type,
                "technique": entry.technique,
                "measures": entry.measures,
                "matrices": ", ".join(entry.matrices),
                "best_for": entry.when_to_use,
                "not_enough": entry.when_not_enough,
                "key_limitations": entry.limitations[:3],
            }
        )
    return rows


def professional_compare(codes: Sequence[str]) -> str:
    rows = compare_standards(codes)
    lines = ["مقایسه استانداردها:"]
    for row in rows:
        if row.get("status") == "not_found":
            lines.append(f"\n{row['code']}: در دیتابیس داخلی پیدا نشد.")
            continue
        lines.append(
            f"\n{row['code']} — {row['title']}\n"
            f"- نوع: {row['type']}\n"
            f"- خانواده: {row['family']}\n"
            f"- تکنیک: {row['technique']}\n"
            f"- اندازه‌گیری: {row['measures']}\n"
            f"- ماتریس: {row['matrices']}\n"
            f"- بهترین کاربرد: {row['best_for']}\n"
            f"- کافی نیست وقتی: {row['not_enough']}"
        )
    return "\n".join(lines)


def list_domains() -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for entry in STANDARDS:
        for d in entry.domain:
            counts[d] = counts.get(d, 0) + 1
    return dict(sorted(counts.items(), key=lambda x: x[0]))


def list_by_domain(domain: str) -> List[str]:
    d = domain.lower()
    return [
        f"{e.code} — {e.title_fa}"
        for e in STANDARDS
        if d in [x.lower() for x in e.domain]
    ]


def coverage_report() -> Dict[str, Any]:
    families: Dict[str, int] = {}
    for entry in STANDARDS:
        families[entry.family] = families.get(entry.family, 0) + 1
    return {
        "total_standards": len(STANDARDS),
        "total_aliases": len(ALIAS_TO_CODE),
        "domains": list_domains(),
        "families": dict(sorted(families.items(), key=lambda x: x[0])),
        "missing_or_needs_validation": [
            "برای UOP/IP/API/NACE/EN کامل‌تر، باید بر اساس نیاز پالایشگاه و پتروشیمی داده رسمی بیشتری اضافه شود.",
            "برای کاتالیست، XRD/TPR/TPD اغلب SOP داخلی معتبر می‌خواهد و یک استاندارد عمومی واحد برای همه نمونه‌ها ندارد.",
            "Specificationها مثل ASTM D975/D4814/D1835/D1655 روش آزمون منفرد نیستند؛ باید به روش‌های آزمون ارجاعی وصل شوند.",
        ],
    }


def validate_registry() -> Dict[str, Any]:
    errors: List[str] = []
    warnings: List[str] = []
    seen: Dict[str, int] = {}

    for entry in STANDARDS:
        seen[entry.code] = seen.get(entry.code, 0) + 1
        if not entry.title_fa:
            errors.append(f"{entry.code}: title_fa missing")
        if not entry.family:
            warnings.append(f"{entry.code}: family missing")
        if not entry.technique:
            warnings.append(f"{entry.code}: technique missing")
        if not entry.measures:
            warnings.append(f"{entry.code}: measures missing")
        if (
            entry.standard_type == "specification"
            and entry.code not in SPECIFICATION_METHOD_GRAPH
        ):
            warnings.append(f"{entry.code}: specification has no method graph")
        if entry.standard_type == "internal_note":
            warnings.append(
                f"{entry.code}: internal note/SOP required; not an official universal standard"
            )

    for code, count in seen.items():
        if count > 1:
            errors.append(f"duplicate code: {code}")

    return {
        "status": "pass" if not errors else "fail",
        "total_standards": len(STANDARDS),
        "total_aliases": len(ALIAS_TO_CODE),
        "errors": errors,
        "warnings": warnings[:100],
        "warning_count": len(warnings),
    }


def export_as_dict() -> Dict[str, Dict[str, Any]]:
    return {entry.code: asdict(entry) for entry in STANDARDS}


# =============================================================================
# 9) Demo
# =============================================================================

if __name__ == "__main__":
    examples = [
        "برای گوگرد کل دیزل با D5453 توضیح بده",
        "نمونه LPG داریم، H2S و مرکاپتان و گوگرد کل می‌خوایم",
        "برای نفت خام آب نمک رسوب و BS&W چه استانداردهایی هست؟",
        "BTEX در آب آلوده با GC/MS",
        "کاتالیست NiMo را BET XRD TPR بررسی کنیم",
    ]
    print("Registry validation:")
    print(validate_registry())
    for ex in examples:
        print("\n" + "=" * 90)
        print(ex)
        print(get_context_for_app(ex)[:3500])
