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

# (Persian names, English names, formula, display formula, acid–base eq/mol or None, physical form)
SUBSTANCES = (
    (("اسید سولفوریک", "سولفوریک اسید", "اسیدسولفوریک", "جوهر گوگرد"), ("sulfuric acid", "sulphuric acid", "h2so4"),
     "H2SO4", "H₂SO₄", 2, "liquid"),
    (("اسید کلریدریک", "اسید هیدروکلریک", "کلریدریک اسید", "جوهر نمک"), ("hydrochloric acid", "hcl"),
     "HCl", "HCl", 1, "liquid"),
    (("اسید نیتریک", "نیتریک اسید", "جوهر شوره"), ("nitric acid", "hno3"), "HNO3", "HNO₃", 1, "liquid"),
    (("اسید استیک", "استیک اسید"), ("acetic acid",), "CH3COOH", "CH₃COOH", 1, "liquid"),
    (("آمونیاک", "آمونیوم هیدروکسید"), ("ammonia", "ammonium hydroxide"), "NH3", "NH₃", 1, "liquid"),
    (("اسید فسفریک", "فسفریک اسید"), ("phosphoric acid", "h3po4"), "H3PO4", "H₃PO₄", None, "liquid"),
    (("سود سوزآور", "سدیم هیدروکسید", "هیدروکسید سدیم"), ("sodium hydroxide", "naoh"), "NaOH", "NaOH", 1, "solid"),
    (("پتاسیم هیدروکسید", "هیدروکسید پتاسیم", "پتاس سوزآور"), ("potassium hydroxide", "koh"), "KOH", "KOH", 1, "solid"),
    (("سدیم کربنات", "کربنات سدیم"), ("sodium carbonate", "na2co3"), "Na2CO3", "Na₂CO₃", 2, "solid"),
    (("سدیم کلرید", "کلرید سدیم", "نمک طعام"), ("sodium chloride", "nacl"), "NaCl", "NaCl", None, "solid"),
    (("پتاسیم کلرید", "کلرید پتاسیم"), ("potassium chloride", "kcl"), "KCl", "KCl", None, "solid"),
)

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
    if unit == "eq/L" and not eq_per_mol:
        return None  # Normality depends on the reaction for this substance; let the model ask.
    stamp = datetime.now(timezone.utc).isoformat()
    mass = molar_mass_from_formula(formula)
    M = mass["molar_mass"]
    args = dict(target_value=target, target_unit=unit, equivalents_per_mol=eq_per_mol if unit == "eq/L" else None,
                final_volume=volume, volume_unit=volume_unit, molar_mass=M)
    grade = typical_grade(M) if form == "liquid" else None
    if form == "liquid" and not grade:
        return None
    try:
        if grade:
            result = prepare_solution(**args, source_kind="liquid_concentrate", purity_percent=grade["assay_percent"],
                                      density_g_per_mL=grade["density_g_per_mL"])
        else:
            result = prepare_solution(**args, source_kind="solid", purity_percent=100, density_g_per_mL=None)
    except ValueError:
        return None
    result = {**result, "assay_source": "typical_example" if grade else "pure_basis",
              **({"typical_grade": grade} if grade else {})}
    calculations = [
        {"id": "calc-1", "kind": "molar_mass", "inputs": {"formula": formula}, "result": mass, "unit": "g/mol",
         "calculatedAt": stamp, "revision": None},
        {"id": "calc-2", "kind": "solution_preparation", "inputs": {**args, "form": form}, "result": result, "unit": "",
         "calculatedAt": stamp, "revision": None},
    ]
    answer = (_answer_fa if request["persian"] else _answer_en)(request, name_fa, name_en, display, eq_per_mol, unit,
                                                               target, volume, volume_unit, M, result, grade)
    return {"answer": answer, "calculations": calculations, "proposals": [], "library_resources": None,
            "failed_calculations": [], "revision": None, "engine": "deterministic"}


def _answer_fa(request, name, _en, display, eq, unit, target, volume, volume_unit, M, r, grade):
    vol = f"{_fmt(volume)} {'لیتر' if volume_unit == 'L' else 'میلی‌لیتر'}"
    conc = f"{_fmt(target)} {dict(zip(('eq/L', 'mol/L', 'g/L', 'mg/L'), ('نرمال', 'مولار', 'گرم بر لیتر', 'میلی‌گرم بر لیتر')))[unit]}"
    rows = [(f"جرم مولی {display}", f"{_fmt(M, 6)} g/mol")]
    if unit == "eq/L":
        rows.append(("اکی‌والان بر مول (اسید–باز)", str(eq)))
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
        rows.append(("Equivalents per mole (acid–base)", str(eq)))
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
