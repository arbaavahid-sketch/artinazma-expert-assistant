"""Deterministic solution-preparation arithmetic for the laboratory chat.

Molar masses come from the versioned element library (standard atomic weights),
never from the language model. Purity, assay and density are always inputs:
this module never assumes a reagent grade.
"""
import math
import re

from lab_reference_data import snapshot

_SUBSCRIPTS = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")
_TOKEN = re.compile(r"([A-Z][a-z]?)|(\d+(?:\.\d+)?)|([(\[])|([)\]])")


def _atomic_weights():
    return {e["symbol"]: e["atomic_weight"] for e in snapshot()["elements"]["elements"] if e.get("atomic_weight")}


def _count(formula, weights):
    """Element counts for one formula part without hydrate dots; supports nested () and []."""
    stack = [{}]
    pos = 0
    while pos < len(formula):
        m = _TOKEN.match(formula, pos)
        if not m:
            raise ValueError(f"Unexpected character in formula: {formula[pos]!r}")
        symbol, number, opening, closing = m.groups()
        pos = m.end()
        multiplier = 1.0
        n = re.match(r"\d+(?:\.\d+)?", formula[pos:])
        if (symbol or closing) and n:
            multiplier = float(n[0])
            pos += n.end()
            if multiplier <= 0:
                raise ValueError("Zero count in formula")
        if symbol:
            if symbol not in weights:
                raise ValueError(f"Unknown element: {symbol}")
            stack[-1][symbol] = stack[-1].get(symbol, 0) + multiplier
        elif opening:
            stack.append({})
        elif closing:
            if len(stack) == 1:
                raise ValueError("Unbalanced parentheses")
            group = stack.pop()
            for k, v in group.items():
                stack[-1][k] = stack[-1].get(k, 0) + v * multiplier
        elif number:
            raise ValueError("Count without element")
    if len(stack) != 1:
        raise ValueError("Unbalanced parentheses")
    return stack[0]


def molar_mass_from_formula(formula):
    """Molar mass (g/mol) of a formula such as H2SO4, Ca(OH)2 or CuSO4·5H2O."""
    text = str(formula or "").translate(_SUBSCRIPTS).replace(" ", "")
    if not text or len(text) > 120:
        raise ValueError("Formula required (at most 120 characters)")
    weights = _atomic_weights()
    total = {}
    for part in re.split(r"[·•*]|\.(?=\d*[A-Z(])", text):
        if not part:
            raise ValueError("Empty formula part")
        lead = re.match(r"(\d+(?:\.\d+)?)(?=[A-Z(\[])", part)
        factor = float(lead[1]) if lead else 1.0
        for k, v in _count(part[lead.end():] if lead else part, weights).items():
            total[k] = total.get(k, 0) + v * factor
    mass = sum(weights[k] * v for k, v in total.items())
    if not total or not math.isfinite(mass) or mass <= 0:
        raise ValueError("Invalid formula")
    return {"formula": text, "elements": total, "molar_mass": mass, "unit": "g/mol",
            "source": "ArtinAzma element library (standard atomic weights)"}


TARGET_UNITS = ("mol/L", "eq/L", "g/L", "mg/L", "%w/v")

# Usual commercial grades of liquid concentrates, used only for clearly labelled
# examples when the user's own bottle label is not known. Keyed by molar mass.
TYPICAL_GRADES = (
    ("sulfuric acid", "H2SO4", 98.072, 96.0, 1.84),
    ("hydrochloric acid", "HCl", 36.458, 37.0, 1.19),
    ("nitric acid", "HNO3", 63.012, 65.0, 1.39),
    ("phosphoric acid", "H3PO4", 97.994, 85.0, 1.71),
    ("acetic acid (glacial)", "CH3COOH", 60.052, 100.0, 1.05),
    ("ammonia solution", "NH3", 17.031, 25.0, 0.91),
    ("hydrogen peroxide", "H2O2", 34.014, 30.0, 1.11),
    ("perchloric acid", "HClO4", 100.454, 70.0, 1.67),
    ("hydrofluoric acid", "HF", 20.006, 48.0, 1.16),
)


def typical_grade(molar_mass):
    """Usual commercial assay (% w/w) and density (g/mL) for a known concentrate, or None."""
    for name, formula, mass, assay, density in TYPICAL_GRADES:
        if abs(mass - molar_mass) <= 0.05:
            return {"name": name, "formula": formula, "assay_percent": assay, "density_g_per_mL": density,
                    "note": "Typical commercial grade, for an example only; confirm against the bottle label."}
    return None


def prepare_solution(*, target_value, target_unit, equivalents_per_mol, final_volume, volume_unit,
                     molar_mass, source_kind, purity_percent, density_g_per_mL):
    """How much solid to weigh, or concentrate to measure, for a target solution."""
    def positive(value, name):
        if type(value) not in (int, float) or not math.isfinite(value) or value <= 0:
            raise ValueError(f"{name} must be a positive number")
        return float(value)

    c, M = positive(target_value, "target_value"), positive(molar_mass, "molar_mass")
    if target_unit not in TARGET_UNITS:
        raise ValueError(f"target_unit must be one of {TARGET_UNITS}")
    if volume_unit not in ("mL", "L"):
        raise ValueError("volume_unit must be mL or L")
    volume_L = positive(final_volume, "final_volume") / (1000 if volume_unit == "mL" else 1)
    p = positive(purity_percent, "purity_percent")
    if p > 100:
        raise ValueError("purity_percent cannot exceed 100")
    n = None
    if target_unit == "eq/L" or equivalents_per_mol is not None:
        n = positive(equivalents_per_mol, "equivalents_per_mol")

    molarity = {"mol/L": c, "eq/L": c / n if n else None, "g/L": c / M, "mg/L": c / 1000 / M, "%w/v": c * 10 / M}[target_unit]
    moles = molarity * volume_L
    solute_g = moles * M
    result = {"target": {"value": c, "unit": target_unit}, "final_volume_L": volume_L, "molar_mass_g_per_mol": M,
              "equivalents_per_mol": n, "molarity_mol_per_L": molarity, "normality_eq_per_L": molarity * n if n else None,
              "solute_moles": moles, "solute_mass_g": solute_g, "purity_percent": p, "source_kind": source_kind}
    if source_kind == "solid":
        result["weigh_mass_g"] = solute_g / (p / 100)
    elif source_kind == "liquid_concentrate":
        rho = positive(density_g_per_mL, "density_g_per_mL")
        stock = 10 * rho * p / M
        if molarity >= stock:
            raise ValueError("Target is not below the concentrate's own concentration")
        concentrate_g = solute_g / (p / 100)
        result.update(density_g_per_mL=rho, stock_molarity_mol_per_L=stock,
                      stock_normality_eq_per_L=stock * n if n else None,
                      concentrate_mass_g=concentrate_g, concentrate_volume_mL=concentrate_g / rho)
        if result["concentrate_volume_mL"] >= volume_L * 1000:
            raise ValueError("Concentrate volume exceeds the final volume")
    else:
        raise ValueError("source_kind must be solid or liquid_concentrate")
    if not all(math.isfinite(v) for v in result.values() if isinstance(v, float)):
        raise ValueError("Non-finite result")
    return result


_PREPARE = re.compile(
    r"بساز|بسازم|درست کن|تهیه|آماده کن|ساخت|رقیق|بریزم|بکشم|وزن کنم|چقدر .{0,20}(لازم|بریز|بردار)|"
    r"\bprepar|\bmake\b|\bmaking\b|\bdilut|how much .{0,30}(need|add|weigh)", re.I)
_SOLUTION = re.compile(r"محلول|solution", re.I)
_CONCENTRATION = re.compile(
    r"نرمال|مولار|مولال|گرم بر لیتر|میلی.?گرم بر لیتر|درصد|ppm|"
    r"\d\s*(?:N|M|mol/L|mmol/L|g/L|mg/L|%)(?![A-Za-z])|\bnormal\b|\bmolar\b|\bmolarity\b|\bnormality\b", re.I)


def is_solution_preparation(message):
    """True for questions asking how to make a solution of a stated concentration."""
    text = str(message or "").translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹ي", "0123456789ی"))
    explicit_unit = re.search(r"\d\s*(?:N|M|mol/L|mmol/L|g/L|mg/L)(?![A-Za-z])|نرمال|مولار", text)
    return bool((_SOLUTION.search(text) or explicit_unit) and _CONCENTRATION.search(text) and _PREPARE.search(text))
