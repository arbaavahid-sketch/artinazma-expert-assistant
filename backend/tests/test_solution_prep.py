import pytest

from solution_prep import is_solution_preparation, molar_mass_from_formula, prepare_solution

H, OX, S, CU = 1.008, 15.999, 32.06, 63.546
H2SO4 = 2 * H + S + 4 * OX


def test_molar_mass_from_formula():
    assert molar_mass_from_formula("H2SO4")["molar_mass"] == pytest.approx(H2SO4)
    assert molar_mass_from_formula("Ca(OH)2")["molar_mass"] == pytest.approx(40.078 + 2 * (OX + H), rel=1e-4)
    hydrate = molar_mass_from_formula("CuSO4·5H2O")["molar_mass"]
    assert hydrate == pytest.approx(CU + S + 4 * OX + 5 * (2 * H + OX))
    assert molar_mass_from_formula("CuSO4.5H2O")["molar_mass"] == pytest.approx(hydrate)
    assert molar_mass_from_formula("H₂SO₄")["molar_mass"] == pytest.approx(H2SO4)


@pytest.mark.parametrize("formula", ["", "Xx2", "H2SO4)", "(H2", "H0", "H2SO4" * 40])
def test_molar_mass_rejects_invalid_formulas(formula):
    with pytest.raises(ValueError):
        molar_mass_from_formula(formula)


def test_normal_sulfuric_acid_from_concentrate():
    # 0.02 N H2SO4 in 1 L, acid–base (2 eq/mol), from 96 % w/w acid of density 1.84 g/mL.
    r = prepare_solution(target_value=0.02, target_unit="eq/L", equivalents_per_mol=2, final_volume=1,
                         volume_unit="L", molar_mass=H2SO4, source_kind="liquid_concentrate",
                         purity_percent=96, density_g_per_mL=1.84)
    assert r["molarity_mol_per_L"] == pytest.approx(0.01)
    assert r["solute_moles"] == pytest.approx(0.01)
    assert r["solute_mass_g"] == pytest.approx(0.01 * H2SO4)
    assert r["stock_molarity_mol_per_L"] == pytest.approx(10 * 1.84 * 96 / H2SO4)
    assert r["stock_normality_eq_per_L"] == pytest.approx(2 * 10 * 1.84 * 96 / H2SO4)
    assert r["concentrate_mass_g"] == pytest.approx(0.01 * H2SO4 / 0.96)
    assert r["concentrate_volume_mL"] == pytest.approx(0.01 * H2SO4 / 0.96 / 1.84)
    assert r["concentrate_volume_mL"] == pytest.approx(0.5552, abs=1e-4)


def test_solid_and_mass_concentration_units():
    nacl = 22.98976928 + 35.45
    r = prepare_solution(target_value=0.1, target_unit="mol/L", equivalents_per_mol=None, final_volume=250,
                         volume_unit="mL", molar_mass=nacl, source_kind="solid", purity_percent=99.5,
                         density_g_per_mL=None)
    assert r["weigh_mass_g"] == pytest.approx(0.1 * 0.25 * nacl / 0.995)
    gl = prepare_solution(target_value=5, target_unit="g/L", equivalents_per_mol=None, final_volume=100,
                          volume_unit="mL", molar_mass=nacl, source_kind="solid", purity_percent=100,
                          density_g_per_mL=None)
    assert gl["solute_mass_g"] == pytest.approx(0.5)
    wv = prepare_solution(target_value=1, target_unit="%w/v", equivalents_per_mol=None, final_volume=100,
                          volume_unit="mL", molar_mass=nacl, source_kind="solid", purity_percent=100,
                          density_g_per_mL=None)
    assert wv["solute_mass_g"] == pytest.approx(1)


@pytest.mark.parametrize("change", [
    {"target_unit": "eq/L", "equivalents_per_mol": None},          # normality without equivalents
    {"source_kind": "liquid_concentrate", "density_g_per_mL": None},  # concentrate without density
    {"purity_percent": 0},
    {"purity_percent": 120},
    {"final_volume": -1},
    {"target_value": 50, "target_unit": "mol/L", "source_kind": "liquid_concentrate", "density_g_per_mL": 1.84},  # above stock
    {"target_unit": "ppm"},
])
def test_invalid_preparations_are_rejected(change):
    base = dict(target_value=0.1, target_unit="mol/L", equivalents_per_mol=2, final_volume=1, volume_unit="L",
                molar_mass=H2SO4, source_kind="solid", purity_percent=96, density_g_per_mL=None)
    with pytest.raises(ValueError):
        prepare_solution(**{**base, **change})


@pytest.mark.parametrize("message", [
    "آرتين جان ميخام محلول 0.02 نرمال اسيد سولفوريك تو يك ليتر بسازم. با استفاده از E200 بهم بگو",
    "چطور محلول ۰٫۱ مولار سدیم کلرید ۲۵۰ میلی‌لیتری تهیه کنم؟",
    "How do I prepare 500 mL of 0.1 M HCl from 37% acid?",
    "برای ساخت یک لیتر محلول 5 گرم بر لیتر چقدر نمک لازم است",
])
def test_detects_solution_preparation_questions(message):
    assert is_solution_preparation(message)


@pytest.mark.parametrize("message", [
    "روش ASTM D4294 برای گوگرد چیست؟",
    "دستگاه GC چه قیمتی دارد؟",
    "محلول استاندارد جیوه را از کجا بخرم؟",
    "what is a normal distribution",
])
def test_ignores_other_questions(message):
    assert not is_solution_preparation(message)


def test_lab_tools_record_solution_calculations():
    from laboratory_chat import LabTools, TOOLS

    names = {t["name"] for t in TOOLS}
    assert {"find_chemical", "calculate_molar_mass", "prepare_solution"} <= names
    tool = next(t for t in TOOLS if t["name"] == "prepare_solution")
    assert set(tool["parameters"]["required"]) == set(tool["parameters"]["properties"])  # strict schema

    tools = LabTools(None)
    mass = tools.execute("calculate_molar_mass", {"formula": "H2SO4"})
    result = tools.execute("prepare_solution", {
        "target_value": 0.02, "target_unit": "eq/L", "equivalents_per_mol": 2, "final_volume": 1,
        "volume_unit": "L", "molar_mass": mass["result"]["molar_mass"], "source_kind": "liquid_concentrate",
        "purity_percent": 96, "density_g_per_mL": 1.84})
    assert [c["kind"] for c in tools.calculations] == ["molar_mass", "solution_preparation"]
    assert result["result"]["concentrate_volume_mL"] == pytest.approx(0.5552, abs=1e-4)
    with pytest.raises(ValueError):
        tools.execute("prepare_solution", {**result["inputs"], "density_g_per_mL": None})


def test_typical_example_uses_the_tools_own_grade_not_the_models_numbers():
    from laboratory_chat import LabTools, TOOLS

    tool = next(t for t in TOOLS if t["name"] == "prepare_solution")
    assert "assay_source" in tool["parameters"]["required"]
    args = {"target_value": 0.02, "target_unit": "eq/L", "equivalents_per_mol": 2, "final_volume": 1,
            "volume_unit": "L", "molar_mass": 98.072, "source_kind": "liquid_concentrate",
            "purity_percent": 100, "density_g_per_mL": 1.84, "assay_source": "typical_example"}
    result = LabTools(None).execute("prepare_solution", args)["result"]
    assert result["purity_percent"] == 96 and result["density_g_per_mL"] == 1.84
    assert result["typical_grade"]["name"] == "sulfuric acid"
    assert result["concentrate_volume_mL"] == pytest.approx(0.98072 / 0.96 / 1.84)

    with pytest.raises(ValueError, match="No typical grade"):
        LabTools(None).execute("prepare_solution", {**args, "molar_mass": 58.44})  # NaCl has no concentrate grade
    with pytest.raises(ValueError, match="liquid concentrates"):
        LabTools(None).execute("prepare_solution", {**args, "source_kind": "solid"})
