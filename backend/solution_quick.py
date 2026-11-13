"""Fast, deterministic answers for common solution-preparation questions.

Questions such as "make 1 L of 0.02 N sulfuric acid" are parsed for the substance,
the target concentration and the final volume, and answered from the same
calculations the laboratory tools use (element-library molar mass and
solution_prep.prepare_solution), without a language-model round trip. Anything
the parser cannot resolve with confidence returns None so the laboratory model
handles it instead.
"""
import re
from datetime import datetime, timezone

from solution_prep import molar_mass_from_formula, prepare_solution, typical_grade

# (Persian names, English names, formula, display formula, eq/mol or None, physical form)
#
# eq/mol is set only where the equivalent factor is fixed by how the reagent is
# used in practice (acid–base, dichromate → Cr³⁺, thiosulfate in iodometry, Fe²⁺,
# Ag⁺ precipitation, oxalate). It is None where normality depends on the reaction
# (permanganate in acid vs neutral, iodate, peroxide, phosphoric acid) or is not
# used, so normality questions about those go to the laboratory model.
# Solids are listed in the hydrate sold commercially.
# Longer names must come before names they contain ("بی کربنات سدیم" before
# "کربنات سدیم", "تیوسولفات سدیم" before "سولفات سدیم"): the first match wins.
SUBSTANCES = (
    # First: its full Persian name contains "استیک اسید".
    (("EDTA", "ای دی تی ای", "اتیلن دی آمین تترا استیک", "تیترپلکس"),
     ("edta", "disodium edta", "ethylenediaminetetraacetic", "titriplex"),
     "C10H14N2Na2O8·2H2O", "Na₂H₂EDTA·2H₂O", None, "solid"),
    # Acids, bases and other liquid concentrates
    (("اسید سولفوریک", "سولفوریک اسید", "اسیدسولفوریک", "جوهر گوگرد"), ("sulfuric acid", "sulphuric acid", "h2so4"),
     "H2SO4", "H₂SO₄", 2, "liquid"),
    (("اسید کلریدریک", "اسید هیدروکلریک", "کلریدریک اسید", "هیدروکلریک اسید", "جوهر نمک"), ("hydrochloric acid", "hcl"),
     "HCl", "HCl", 1, "liquid"),
    (("اسید نیتریک", "نیتریک اسید", "جوهر شوره"), ("nitric acid", "hno3"), "HNO3", "HNO₃", 1, "liquid"),
    (("اسید پرکلریک", "پرکلریک اسید"), ("perchloric acid", "hclo4"), "HClO4", "HClO₄", 1, "liquid"),
    (("اسید استیک", "استیک اسید", "سرکه گلاسیال"), ("acetic acid",), "CH3COOH", "CH₃COOH", 1, "liquid"),
    (("آمونیاک", "آمونیوم هیدروکسید"), ("ammonia", "ammonium hydroxide"), "NH3", "NH₃", 1, "liquid"),
    (("اسید فسفریک", "فسفریک اسید"), ("phosphoric acid", "h3po4"), "H3PO4", "H₃PO₄", None, "liquid"),
    (("آب اکسیژنه", "هیدروژن پراکسید", "پراکسید هیدروژن"), ("hydrogen peroxide", "h2o2"), "H2O2", "H₂O₂", 2, "liquid"),
    (("سود سوزآور", "سدیم هیدروکسید", "هیدروکسید سدیم"), ("sodium hydroxide", "naoh"), "NaOH", "NaOH", 1, "solid"),
    (("پتاسیم هیدروکسید", "هیدروکسید پتاسیم", "پتاس سوزآور"), ("potassium hydroxide", "koh"), "KOH", "KOH", 1, "solid"),
    (("باریم هیدروکسید", "هیدروکسید باریم"), ("barium hydroxide",), "Ba(OH)2·8H2O", "Ba(OH)₂·8H₂O", 2, "solid"),
    # Primary standards and titrants
    (("سدیم بی کربنات", "سدیم بیکربنات", "بی کربنات سدیم", "بیکربنات سدیم", "جوش شیرین"),
     ("sodium bicarbonate", "sodium hydrogen carbonate", "nahco3"), "NaHCO3", "NaHCO₃", 1, "solid"),
    (("سدیم کربنات", "کربنات سدیم"), ("sodium carbonate", "na2co3"), "Na2CO3", "Na₂CO₃", 2, "solid"),
    (("پتاسیم هیدروژن فتالات", "پتاسیم بی فتالات", "پتاسیم اسید فتالات", "KHP"),
     ("potassium hydrogen phthalate", "potassium biphthalate", "khp"), "C8H5KO4", "KHC₈H₄O₄", 1, "solid"),
    (("بوراکس", "سدیم تترابورات", "تترابورات سدیم"), ("borax", "sodium tetraborate"),
     "Na2B4O7·10H2O", "Na₂B₄O₇·10H₂O", 2, "solid"),
    (("اسید اگزالیک", "اگزالیک اسید"), ("oxalic acid",), "H2C2O4·2H2O", "H₂C₂O₄·2H₂O", 2, "solid"),
    (("سدیم اگزالات", "اگزالات سدیم"), ("sodium oxalate", "na2c2o4"), "Na2C2O4", "Na₂C₂O₄", 2, "solid"),
    (("پتاسیم دی کرومات", "پتاسیم دیکرومات", "دی کرومات پتاسیم", "بی کرومات پتاسیم", "پتاسیم بی کرومات"),
     ("potassium dichromate", "k2cr2o7"), "K2Cr2O7", "K₂Cr₂O₇", 6, "solid"),
    (("پتاسیم پرمنگنات", "پرمنگنات پتاسیم"), ("potassium permanganate", "kmno4"), "KMnO4", "KMnO₄", None, "solid"),
    (("پتاسیم یدات", "یدات پتاسیم"), ("potassium iodate", "kio3"), "KIO3", "KIO₃", None, "solid"),
    (("پتاسیم یدید", "یدید پتاسیم"), ("potassium iodide", "ki"), "KI", "KI", None, "solid"),
    (("سدیم تیوسولفات", "تیوسولفات سدیم"), ("sodium thiosulfate", "sodium thiosulphate"),
     "Na2S2O3·5H2O", "Na₂S₂O₃·5H₂O", 1, "solid"),
    (("نقره نیترات", "نیترات نقره"), ("silver nitrate", "agno3"), "AgNO3", "AgNO₃", 1, "solid"),
    (("آمونیوم تیوسیانات", "تیوسیانات آمونیوم"), ("ammonium thiocyanate",), "NH4SCN", "NH₄SCN", 1, "solid"),
    (("پتاسیم تیوسیانات", "تیوسیانات پتاسیم"), ("potassium thiocyanate", "kscn"), "KSCN", "KSCN", 1, "solid"),
    (("آمونیوم آهن سولفات", "سولفات آهن آمونیوم", "آمونیوم سولفات آهن", "فرو آمونیوم سولفات", "آمونیوم فرو سولفات",
      "نمک مور"),
     ("ferrous ammonium sulfate", "ammonium iron(ii) sulfate", "ammonium ferrous sulfate", "mohr's salt", "mohr salt"),
     "(NH4)2Fe(SO4)2·6H2O", "(NH₄)₂Fe(SO₄)₂·6H₂O", 1, "solid"),
    (("آهن سولفات", "سولفات آهن", "فرو سولفات", "سولفات فرو"), ("ferrous sulfate", "iron(ii) sulfate", "feso4"),
     "FeSO4·7H2O", "FeSO₄·7H₂O", 1, "solid"),
    # Neutral salts (normality not meaningful without a reaction)
    (("سدیم سولفات", "سولفات سدیم"), ("sodium sulfate", "na2so4"), "Na2SO4", "Na₂SO₄", None, "solid"),
    (("مس سولفات", "سولفات مس", "کات کبود"), ("copper sulfate", "copper(ii) sulfate", "cupric sulfate", "cuso4"),
     "CuSO4·5H2O", "CuSO₄·5H₂O", None, "solid"),
    (("منیزیم سولفات", "سولفات منیزیم"), ("magnesium sulfate", "mgso4"), "MgSO4·7H2O", "MgSO₄·7H₂O", None, "solid"),
    (("سولفات روی", "زینک سولفات"), ("zinc sulfate", "znso4"), "ZnSO4·7H2O", "ZnSO₄·7H₂O", None, "solid"),
    (("باریم کلرید", "کلرید باریم"), ("barium chloride", "bacl2"), "BaCl2·2H2O", "BaCl₂·2H₂O", None, "solid"),
    (("آمونیوم کلرید", "کلرید آمونیوم", "نشادر"), ("ammonium chloride", "nh4cl"), "NH4Cl", "NH₄Cl", None, "solid"),
    (("سدیم کلرید", "کلرید سدیم", "نمک طعام"), ("sodium chloride", "nacl"), "NaCl", "NaCl", None, "solid"),
    (("پتاسیم کلرید", "کلرید پتاسیم"), ("potassium chloride", "kcl"), "KCl", "KCl", None, "solid"),
    (("پتاسیم نیترات", "نیترات پتاسیم"), ("potassium nitrate", "kno3"), "KNO3", "KNO₃", None, "solid"),
    (("سدیم استات", "استات سدیم"), ("sodium acetate",), "CH3COONa·3H2O", "CH₃COONa·3H₂O", None, "solid"),
)

# Basis of the equivalent factor where it is not an acid–base one: (Persian, English).
EQ_BASIS = {
    "K2Cr2O7": ("اکسایش–کاهش: Cr₂O₇²⁻ → 2Cr³⁺", "redox: Cr₂O₇²⁻ → 2Cr³⁺"),
    "Na2C2O4": ("اکسایش–کاهش: C₂O₄²⁻ → 2CO₂", "redox: C₂O₄²⁻ → 2CO₂"),
    "Na2S2O3·5H2O": ("یدومتری: 2S₂O₃²⁻ → S₄O₆²⁻", "iodometry: 2S₂O₃²⁻ → S₄O₆²⁻"),
    "(NH4)2Fe(SO4)2·6H2O": ("اکسایش–کاهش: Fe²⁺ → Fe³⁺", "redox: Fe²⁺ → Fe³⁺"),
    "FeSO4·7H2O": ("اکسایش–کاهش: Fe²⁺ → Fe³⁺", "redox: Fe²⁺ → Fe³⁺"),
    "H2O2": ("اکسایش–کاهش، دو الکترون در هر دو جهت", "redox, two electrons either way"),
    "AgNO3": ("تیتراسیون رسوبی، Ag⁺", "precipitation titration, Ag⁺"),
    "KSCN": ("تیتراسیون رسوبی، SCN⁻", "precipitation titration, SCN⁻"),
    "NH4SCN": ("تیتراسیون رسوبی، SCN⁻", "precipitation titration, SCN⁻"),
}

# Substances whose normality depends on the reaction: every usual reading is
# calculated and the user picks the one that matches their method.
EQ_OPTIONS = {
    "H3PO4": (
        (1, "تیتراسیون تا نقطهٔ پایانی اول (متیل اورانژ، pH حدود ۴٫۵)",
         "titration to the first end point (methyl orange, pH ≈ 4.5)"),
        (2, "تیتراسیون تا نقطهٔ پایانی دوم (فنل‌فتالئین، pH حدود ۹٫۵)",
         "titration to the second end point (phenolphthalein, pH ≈ 9.5)"),
        (3, "خنثی‌سازی کامل هر سه پروتون (در تیتراسیون معمول نیست)",
         "neutralizing all three protons (not reached in a normal titration)"),
    ),
    "KMnO4": (
        (5, "محیط اسیدی، MnO₄⁻ → Mn²⁺ (رایج‌ترین؛ مثلاً آهن، اگزالات، آب اکسیژنه)",
         "acid medium, MnO₄⁻ → Mn²⁺ (the usual case: iron, oxalate, peroxide)"),
        (3, "محیط خنثی یا قلیایی، MnO₄⁻ → MnO₂", "neutral or alkaline medium, MnO₄⁻ → MnO₂"),
    ),
}

# Handling points that change how the solution is made or kept, keyed by formula.
NOTES = {
    "NaOH": ("از آب مقطر جوشانده و سردشده (بدون CO₂) استفاده کنید و در ظرف پلی‌اتیلنی دربسته نگه دارید؛ با پتاسیم هیدروژن فتالات استاندارد کنید.",
             "Use boiled and cooled (CO₂-free) water, store in a closed polyethylene bottle and standardize against KHP."),
    "KOH": ("از آب بدون CO₂ استفاده کنید و در ظرف پلی‌اتیلنی دربسته نگه دارید.",
            "Use CO₂-free water and store in a closed polyethylene bottle."),
    "Ba(OH)2·8H2O": ("محلول CO₂ هوا را جذب می‌کند و باریم کربنات رسوب می‌دهد؛ از آب بدون CO₂ و ظرف دربسته استفاده کنید. ترکیبات باریم سمی‌اند.",
                     "The solution absorbs CO₂ and deposits barium carbonate: use CO₂-free water and a closed bottle. Barium compounds are toxic."),
    "Na2CO3": ("سدیم کربنات استاندارد اولیه است؛ پیش از توزین حدود یک ساعت در ۲۷۰ تا ۳۰۰ °C خشک و در دسیکاتور سرد کنید.",
               "As a primary standard, dry it for about an hour at 270–300 °C and cool in a desiccator before weighing."),
    "C8H5KO4": ("KHP استاندارد اولیه است؛ پیش از توزین حدود دو ساعت در ۱۲۰ °C خشک و در دسیکاتور سرد کنید.",
                "KHP is a primary standard: dry it for about two hours at 120 °C and cool in a desiccator before weighing."),
    "K2Cr2O7": ("پتاسیم دی‌کرومات استاندارد اولیه است (پیش از توزین در حدود ۱۵۰ °C خشک کنید). ترکیبات کروم شش‌ظرفیتی سرطان‌زا هستند: دستکش و پسماند جداگانه.",
                "A primary standard (dry at about 150 °C before weighing). Hexavalent chromium is carcinogenic: wear gloves and collect the waste separately."),
    "KMnO4": ("محلول را چند روز در تاریکی نگه دارید (یا یک ساعت بجوشانید)، از پشم شیشه صاف کنید، در بطری قهوه‌ای نگه دارید و با سدیم اگزالات استاندارد کنید.",
              "Let the solution stand for some days in the dark (or boil for an hour), filter through glass wool, keep in an amber bottle and standardize against sodium oxalate."),
    "Na2S2O3·5H2O": ("با آب مقطر تازه جوشانده و سردشده تهیه کنید، کمی سدیم کربنات (حدود ۰٫۱ g/L) برای پایداری بیفزایید و با پتاسیم یدات یا دی‌کرومات استاندارد کنید.",
                     "Use freshly boiled and cooled water, add a little sodium carbonate (about 0.1 g/L) as a stabilizer and standardize against potassium iodate or dichromate."),
    "AgNO3": ("به نور حساس است: در بطری قهوه‌ای نگه دارید و با سدیم کلرید خشک‌شده استاندارد کنید. روی پوست لکهٔ سیاه می‌گذارد.",
              "Light-sensitive: keep in an amber bottle and standardize against dried sodium chloride. It stains skin black."),
    "C10H14N2Na2O8·2H2O": ("نمک دی‌سدیم EDTA دوآبه را بگیرید (اسید آزاد EDTA در آب کم‌محلول است)، در ظرف پلی‌اتیلنی نگه دارید و با کلسیم کربنات یا روی استاندارد کنید.",
                           "Use the disodium dihydrate (free EDTA acid is poorly soluble), store in polyethylene and standardize against calcium carbonate or zinc."),
    "(NH4)2Fe(SO4)2·6H2O": ("در آب حاوی کمی اسید سولفوریک حل کنید تا اکسید نشود و غلظت را روز مصرف با دی‌کرومات تعیین کنید.",
                            "Dissolve in water containing a little sulfuric acid to slow oxidation, and standardize against dichromate on the day of use."),
    "FeSO4·7H2O": ("در آب حاوی کمی اسید سولفوریک حل کنید تا اکسید نشود؛ محلول پایدار نیست.",
                   "Dissolve in water with a little sulfuric acid to slow oxidation; the solution is not stable."),
    "H2O2": ("در ظرف تیره و خنک نگه دارید و غلظت را با پرمنگنات تعیین کنید؛ محلول به‌مرور تجزیه می‌شود.",
             "Keep cold and dark and standardize against permanganate; the solution decomposes with time."),
    "HClO4": ("اسید پرکلریک غلیظ اکسیدکنندهٔ قوی است؛ از تماس با مواد آلی دور نگه دارید و در هود مخصوص کار کنید.",
              "Concentrated perchloric acid is a strong oxidizer: keep it away from organic material and use a suitable fume hood."),
}

_NUMBER = r"(\d+(?:[.,٫]\d+)?)"
# Order matters: mg/L before g/L.
_CONC_UNITS = (
    (r"نرمال|normal\b|eq\s*/\s*l\b|N\b", "eq/L"),
    (r"مولار|molar\b|mol\s*/\s*l\b|M\b", "mol/L"),
    (r"میلی\s*گرم\s+بر\s+لیتر|mg\s*/\s*l\b", "mg/L"),
    (r"گرم\s+بر\s+لیتر|g\s*/\s*l\b", "g/L"),
)
_WORD_NUMBERS = {"یک": 1.0, "دو": 2.0, "سه": 3.0, "پنج": 5.0, "نیم": 0.5, "one": 1.0, "two": 2.0, "a": 1.0}
_VOLUME = re.compile(
    r"(?<![/\w])(\d+(?:[.,٫]\d+)?|یک|دو|سه|پنج|نیم|one|two|a)\s*"
    r"(میلی\s*لیتر|ml|cc|cm3|لیتر|liters?|litres?|L)(?:ی)?(?![/\w])", re.I)
_STANDARD_PREFIX = re.compile(r"(?:ASTM|ISO|EN|UOP|DIN|API|IP|GPA)\b")
# "E200" on its own means ASTM E200, the practice for preparing and standardizing
# standard and reagent solutions, not a supplier code.
_E200 = re.compile(r"(?<![A-Za-z0-9])(?:ASTM\s*)?E\s?-?0*200(?:\s*-\s*\d{2})?(?![0-9])", re.I)


def _normalize(text):
    digits = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩يك", "01234567890123456789یک")
    return str(text or "").translate(digits).replace("‌", " ")


def _number(text):
    return float(text.replace("٫", ".").replace(",", "."))


def parse_solution_request(message):
    """Substance, concentration and volume from a plain solution question, or None if any is missing."""
    text = _normalize(message)
    lower = text.lower()
    substance = None
    for fa_names, en_names, *rest in SUBSTANCES:
        if any(n.replace("‌", " ") in text for n in fa_names) or any(
                re.search(r"\b" + re.escape(n) + r"\b", lower) for n in en_names):
            substance = (fa_names[0], en_names[0], *rest)
            break
    concentration = None
    for pattern, unit in _CONC_UNITS:
        m = re.search(_NUMBER + r"\s*(?:" + pattern + ")", text, 0 if pattern.endswith(r"N\b") or pattern.endswith(r"M\b") else re.I)
        if m:
            concentration = (_number(m[1]), unit)
            break
    volume = None
    for m in _VOLUME.finditer(text):
        word = m[1].lower()
        amount = _WORD_NUMBERS.get(word) if word in _WORD_NUMBERS else _number(m[1])
        unit = "mL" if re.match(r"میلی|ml|cc|cm3", m[2], re.I) else "L"
        if amount:
            volume = (amount, unit)
            break
    if not (substance and concentration and volume):
        return None
    from astm_link_service import extract_astm_codes

    standards = extract_astm_codes(text)
    if _E200.search(text) and "E200" not in standards:
        standards.append("E200")
    codes = sorted({c for c in re.findall(r"\b[A-Z]{1,4}-?\d{2,6}[A-Z]?\b", text)
                    if not _STANDARD_PREFIX.match(c) and re.sub(r"[-\s]", "", c).upper() not in standards})
    return {"substance": substance, "concentration": concentration, "volume": volume, "product_codes": codes,
            "standards": standards,
            "persian": bool(re.search(r"[؀-ۿ]", text))}


def _fmt(value, digits=4):
    return f"{value:.{digits}g}"


def quick_solution_answer(message):
    """Deterministic answer for a common solution question, or None to use the laboratory model."""
    request = parse_solution_request(message)
    if not request:
        return None
    name_fa, name_en, formula, display, eq_per_mol, form = request["substance"]
    (target, unit), (volume, volume_unit) = request["concentration"], request["volume"]
    options = None
    if unit == "eq/L" and not eq_per_mol:
        options = EQ_OPTIONS.get(formula)
        if not options:
            return None  # Normality depends on the reaction in ways not tabulated here; let the model ask.
    stamp = datetime.now(timezone.utc).isoformat()
    mass = molar_mass_from_formula(formula)
    M = mass["molar_mass"]
    grade = typical_grade(M) if form == "liquid" else None
    if form == "liquid" and not grade:
        return None

    def calculate(eq):
        args = dict(target_value=target, target_unit=unit, equivalents_per_mol=eq if unit == "eq/L" else None,
                    final_volume=volume, volume_unit=volume_unit, molar_mass=M)
        if grade:
            result = prepare_solution(**args, source_kind="liquid_concentrate", purity_percent=grade["assay_percent"],
                                      density_g_per_mL=grade["density_g_per_mL"])
        else:
            result = prepare_solution(**args, source_kind="solid", purity_percent=100, density_g_per_mL=None)
        return args, {**result, "assay_source": "typical_example" if grade else "pure_basis",
                      **({"typical_grade": grade} if grade else {})}

    try:
        runs = [calculate(eq) for eq, *_ in options] if options else [calculate(eq_per_mol)]
    except ValueError:
        return None
    calculations = [{"id": "calc-1", "kind": "molar_mass", "inputs": {"formula": formula}, "result": mass,
                     "unit": "g/mol", "calculatedAt": stamp, "revision": None}]
    calculations += [{"id": f"calc-{i}", "kind": "solution_preparation", "inputs": {**args, "form": form},
                      "result": result, "unit": "", "calculatedAt": stamp, "revision": None}
                     for i, (args, result) in enumerate(runs, 2)]
    if options:
        answer = _answer_options(request, name_fa if request["persian"] else name_en, display, target, volume,
                                 volume_unit, M, [r for _, r in runs], options, grade)
    else:
        answer = (_answer_fa if request["persian"] else _answer_en)(
            request, name_fa, name_en, display, eq_per_mol, unit, target, volume, volume_unit, M, runs[0][1], grade)
    return {"answer": answer, "calculations": calculations, "proposals": [], "library_resources": None,
            "failed_calculations": [], "revision": None, "engine": "deterministic"}


def _answer_options(request, name, display, target, volume, volume_unit, M, results, options, grade):
    """One row per usual reaction when normality depends on how the solution is used."""
    fa = request["persian"]
    formula = request["substance"][2]
    amount = (lambda r: f"{_fmt(r['concentrate_volume_mL'], 3)} mL") if grade else (lambda r: f"{_fmt(r['weigh_mass_g'])} g")
    rows = "\n".join(f"| {label_fa if fa else label_en} | {eq} | {_fmt(r['molarity_mol_per_L'])} mol/L | **{amount(r)}** |"
                     for (eq, label_fa, label_en), r in zip(options, results))
    if fa:
        vol = f"{_fmt(volume)} {'لیتر' if volume_unit == 'L' else 'میلی‌لیتر'}"
        head = (f"## تهیهٔ {vol} محلول {_fmt(target)} نرمال {name}\n\n"
                f"نرمالیتهٔ {name} به واکنشی بستگی دارد که محلول در آن مصرف می‌شود. سطر مطابق روش خودتان را انتخاب کنید "
                f"(جرم مولی {display}: {_fmt(M, 6)} g/mol):\n\n"
                f"| کاربرد | اکی‌والان بر مول | مولاریته | {'حجم غلیظ' if grade else 'مقدار توزین'} |\n| --- | --- | --- | --- |\n")
        if grade:
            steps = (f"\n\n### روش تهیه\n\n1. حدود دو سوم حجم آب مقطر را در بالن حجمی {vol} بریزید.\n"
                     f"2. حجم سطر مربوط از {name} غلیظ را آهسته و با هم‌زدن **به آب** اضافه کنید؛ هرگز آب را به اسید نریزید.\n"
                     "3. پس از خنک شدن به خط نشانه برسانید و مخلوط کنید، سپس غلظت را با استاندارد مناسب تعیین کنید.\n"
                     f"\n> اعداد برای **گرید رایج تجاری** است ({grade['assay_percent']:g}٪ w/w، {grade['density_g_per_mL']:g} g/mL)؛ "
                     "درصد و چگالی روی برچسب بطری را بفرستید تا دقیق حساب کنم.")
        else:
            steps = ("\n\n### روش تهیه\n\n1. مقدار سطر مربوط را با ترازوی تجزیه‌ای وزن کنید (بر پایهٔ خلوص ۱۰۰٪).\n"
                     "2. در حدود دو سوم حجم آب مقطر حل کنید، به بالن حجمی منتقل کنید و به خط نشانه برسانید.\n"
                     "3. غلظت را با استاندارد مناسب تعیین کنید.\n")
        note = f"\n>\n> **نکته:** {NOTES[formula][0]}" if formula in NOTES else ""
    else:
        vol = f"{_fmt(volume)} {volume_unit}"
        head = (f"## Preparing {vol} of {_fmt(target)} N {name}\n\n"
                f"The normality of {name} depends on the reaction it is used for. Pick the row that matches your method "
                f"(molar mass of {display}: {_fmt(M, 6)} g/mol):\n\n"
                f"| Use | Eq/mol | Molarity | {'Concentrate' if grade else 'Mass to weigh'} |\n| --- | --- | --- | --- |\n")
        if grade:
            steps = (f"\n\n### Procedure\n\n1. Put about two thirds of the water in a {vol} volumetric flask.\n"
                     f"2. Add the volume from your row of concentrated {name} slowly to the water while stirring — never water to acid.\n"
                     "3. Cool, make up to the mark, mix, and standardize.\n"
                     f"\n> The figures use the **usual commercial grade** ({grade['assay_percent']:g} % w/w, "
                     f"{grade['density_g_per_mL']:g} g/mL); send the assay and density from your label for exact amounts.")
        else:
            steps = ("\n\n### Procedure\n\n1. Weigh the amount from your row (100 % purity basis).\n"
                     "2. Dissolve in about two thirds of the water, transfer to a volumetric flask and make up to the mark.\n"
                     "3. Standardize the solution.\n")
        note = f"\n>\n> **Note:** {NOTES[formula][1]}" if formula in NOTES else ""
    return head + rows + steps + note + _standards_note(request["standards"], persian=fa)


def _answer_fa(request, name, _en, display, eq, unit, target, volume, volume_unit, M, r, grade):
    vol = f"{_fmt(volume)} {'لیتر' if volume_unit == 'L' else 'میلی‌لیتر'}"
    conc = f"{_fmt(target)} {dict(zip(('eq/L', 'mol/L', 'g/L', 'mg/L'), ('نرمال', 'مولار', 'گرم بر لیتر', 'میلی‌گرم بر لیتر')))[unit]}"
    rows = [(f"جرم مولی {display}", f"{_fmt(M, 6)} g/mol")]
    if unit == "eq/L":
        basis = EQ_BASIS.get(request["substance"][2], ("اسید–باز", ""))[0]
        rows.append((f"اکی‌والان بر مول ({basis})", str(eq)))
    rows += [("مولاریتهٔ معادل", f"{_fmt(r['molarity_mol_per_L'])} mol/L"), (f"{display} خالص لازم", f"{_fmt(r['solute_mass_g'])} g")]
    if grade:
        rows.append((f"{name} غلیظ (نمونه: {grade['assay_percent']:g}٪ w/w، چگالی {grade['density_g_per_mL']:g} g/mL)",
                     f"{_fmt(r['concentrate_mass_g'])} g ≈ **{_fmt(r['concentrate_volume_mL'], 3)} mL**"))
        steps = (f"1. حدود دو سوم حجم نهایی آب مقطر را در بالن حجمی {vol} بریزید.\n"
                 f"2. حدود **{_fmt(r['concentrate_volume_mL'], 3)} mL** {name} غلیظ را با پیپت مدرج بردارید.\n"
                 "3. آن را آهسته و با هم‌زدن **به آب** اضافه کنید؛ هرگز آب را به اسید یا محلول غلیظ نریزید.\n"
                 "4. بگذارید تا دمای محیط خنک شود، با آب مقطر به خط نشانه برسانید و خوب مخلوط کنید.\n"
                 "5. برای تیتراسیون، غلظت دقیق را با یک استاندارد اولیه (مثلاً سدیم کربنات برای اسیدها) تعیین کنید.\n")
        note = (f"\n> اعداد غلیظ برای **گرید رایج تجاری** است ({grade['assay_percent']:g}٪، {grade['density_g_per_mL']:g} g/mL). "
                "درصد خلوص و چگالی روی برچسب بطری خودتان را بفرستید تا حجم دقیق را با همان حساب کنم.")
    else:
        rows.append(("مقدار توزین (بر پایهٔ خلوص ۱۰۰٪)", f"**{_fmt(r['weigh_mass_g'])} g**"))
        steps = ("1. مقدار بالا را با ترازوی تجزیه‌ای وزن کنید؛ اگر خلوص ماده p٪ است، عدد را بر p/100 تقسیم کنید.\n"
                 "2. در حدود دو سوم حجم آب مقطر حل کنید، به بالن حجمی منتقل کنید و به خط نشانه برسانید.\n"
                 "3. برای کار دقیق، غلظت را با استاندارد مناسب تعیین کنید.\n")
        note = "\n> درصد خلوص روی برچسب ماده را بفرستید تا مقدار توزین دقیق را حساب کنم."
        if "·" in request["substance"][2]:
            note += (f"\n>\n> محاسبه برای فرم آب‌دار رایج تجاری ({display}) است؛ اگر نمک بی‌آب یا آب‌پوشی دیگری دارید، "
                     "بگویید تا با جرم مولی همان حساب کنم.")
    if request["substance"][2] in NOTES:
        note += f"\n>\n> **نکته:** {NOTES[request['substance'][2]][0]}"
    note += _standards_note(request["standards"], persian=True)
    if request["product_codes"]:
        note += (f"\n>\n> «{', '.join(request['product_codes'])}» در کاتالوگ آرتین شناسایی نشد. اگر کد محصول یا نام تجاری است، "
                 "درصد خلوص و چگالی آن را بفرستید؛ اگر محلول استاندارد آماده (آمپول) است، نرمالیتهٔ آن را.")
    table = "\n".join(f"| {a} | {b} |" for a, b in rows)
    return f"## تهیهٔ {vol} محلول {conc} {name}\n\n| مورد | مقدار |\n| --- | --- |\n{table}\n\n### روش تهیه\n\n{steps}{note}"


def _answer_en(request, _fa, name, display, eq, unit, target, volume, volume_unit, M, r, grade):
    vol = f"{_fmt(volume)} {volume_unit}"
    conc = f"{_fmt(target)} {dict(zip(('eq/L', 'mol/L', 'g/L', 'mg/L'), ('N', 'M', 'g/L', 'mg/L')))[unit]}"
    rows = [(f"Molar mass of {display}", f"{_fmt(M, 6)} g/mol")]
    if unit == "eq/L":
        basis = EQ_BASIS.get(request["substance"][2], ("", "acid–base"))[1]
        rows.append((f"Equivalents per mole ({basis})", str(eq)))
    rows += [("Equivalent molarity", f"{_fmt(r['molarity_mol_per_L'])} mol/L"), (f"Pure {display} needed", f"{_fmt(r['solute_mass_g'])} g")]
    if grade:
        rows.append((f"Concentrated {name} (example: {grade['assay_percent']:g} % w/w, {grade['density_g_per_mL']:g} g/mL)",
                     f"{_fmt(r['concentrate_mass_g'])} g ≈ **{_fmt(r['concentrate_volume_mL'], 3)} mL**"))
        steps = (f"1. Put about two thirds of the final volume of distilled water in a {vol} volumetric flask.\n"
                 f"2. Measure about **{_fmt(r['concentrate_volume_mL'], 3)} mL** of concentrated {name} with a graduated pipette.\n"
                 "3. Add it slowly to the water while stirring — never water to acid.\n"
                 "4. Let it cool to room temperature, make up to the mark with distilled water and mix.\n"
                 "5. For titration work, standardize against a primary standard (e.g. sodium carbonate for acids).\n")
        note = (f"\n> The concentrate figures use the **usual commercial grade** ({grade['assay_percent']:g} % w/w, "
                f"{grade['density_g_per_mL']:g} g/mL). Send the assay and density from your bottle label for an exact volume.")
    else:
        rows.append(("Mass to weigh (100 % purity basis)", f"**{_fmt(r['weigh_mass_g'])} g**"))
        steps = ("1. Weigh the amount above on an analytical balance; for purity p %, divide by p/100.\n"
                 "2. Dissolve in about two thirds of the volume of distilled water, transfer to a volumetric flask and make up to the mark.\n"
                 "3. For accurate work, standardize the solution.\n")
        note = "\n> Send the purity from the label for an exact mass to weigh."
        if "·" in request["substance"][2]:
            note += (f"\n>\n> The mass is for the usual commercial hydrate ({display}); if you have the anhydrous salt "
                     "or another hydrate, say so and I will use its molar mass.")
    if request["substance"][2] in NOTES:
        note += f"\n>\n> **Note:** {NOTES[request['substance'][2]][1]}"
    note += _standards_note(request["standards"], persian=False)
    if request["product_codes"]:
        note += (f"\n>\n> “{', '.join(request['product_codes'])}” is not in the Artin catalog. If it is a product code, send its "
                 "assay and density, or its normality if it is a ready standard solution.")
    table = "\n".join(f"| {a} | {b} |" for a, b in rows)
    return f"## Preparing {vol} of {conc} {name}\n\n| Item | Value |\n| --- | --- |\n{table}\n\n### Procedure\n\n{steps}{note}"


def _standards_note(standards, persian):
    """What the cited standards mean for this preparation, with official ASTM links."""
    from astm_link_service import official_astm_url

    lines = []
    for code in standards:
        url = official_astm_url(code)
        if code == "E200" and persian:
            lines.append("**ASTM E200** روش استاندارد تهیه، استانداردسازی و نگهداری محلول‌های استاندارد و معرف برای آنالیز شیمیایی است. "
                         "در این روش محلول ابتدا با رقیق‌سازی به غلظت تقریبی ساخته می‌شود و نرمالیتهٔ دقیق آن با استانداردسازی تعیین می‌شود. "
                         "حجم اسید غلیظ را مطابق جدول همین استاندارد بردارید؛ عدد بالا مقدار نظری برای کنترل است. "
                         f"[متن استاندارد ASTM E200]({url})")
        elif code == "E200":
            lines.append("**ASTM E200** is the standard practice for preparing, standardizing and storing standard and reagent solutions "
                         "for chemical analysis: the solution is made to an approximate strength by dilution and its exact normality is "
                         "then established by standardization. Take the concentrate volume from that standard's table; the figure above "
                         f"is the theoretical amount to check against. [ASTM E200]({url})")
        elif persian:
            lines.append(f"روش استاندارد **ASTM {code}** را که ذکر کردید ملاک قرار دهید. [ASTM {code}]({url})")
        else:
            lines.append(f"Follow **ASTM {code}**, which you cited. [ASTM {code}]({url})")
    return "".join(f"\n>\n> {line}" for line in lines)
