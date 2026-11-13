import pytest

from solution_quick import parse_solution_request, quick_solution_answer


def test_parses_the_persian_question_with_arabic_letters_and_word_numbers():
    r = parse_solution_request("آرتين جان ميخام محلول 0.02 نرمال اسيد سولفوريك تو يك ليتر بسازم. با استفاده از E200 بهم بگو")
    assert r["substance"][2] == "H2SO4"
    assert r["concentration"] == (0.02, "eq/L")
    assert r["volume"] == (1.0, "L")
    assert r["standards"] == ["E200"] and r["product_codes"] == [] and r["persian"]


@pytest.mark.parametrize("message", [
    "make 1 L of 0.1 N HCl per ASTM E200-23 using X123",
    "make 1 L of 0.1 N HCl per E 200 using X123",
])
def test_e200_is_a_standard_and_other_codes_stay_unknown(message):
    r = parse_solution_request(message)
    assert r["standards"] == ["E200"] and r["product_codes"] == ["X123"]
    answer = quick_solution_answer(message)["answer"]
    assert "ASTM E200" in answer and "https://store.astm.org/standards/e200" in answer
    assert "X123" in answer and "not in the Artin catalog" in answer


def test_persian_e200_answer_points_to_the_standard_not_the_catalog():
    answer = quick_solution_answer("محلول 0.02 نرمال اسید سولفوریک یک لیتر با استفاده از E200 بسازم")["answer"]
    assert "**ASTM E200**" in answer and "استانداردسازی" in answer
    assert "در کاتالوگ آرتین شناسایی نشد" not in answer


@pytest.mark.parametrize("message, formula, conc, volume", [
    ("چطور محلول ۰٫۱ مولار سدیم کلرید ۲۵۰ میلی‌لیتری تهیه کنم؟", "NaCl", (0.1, "mol/L"), (250.0, "mL")),
    ("How do I prepare 500 mL of 0.1 M HCl?", "HCl", (0.1, "mol/L"), (500.0, "mL")),
    ("برای ساخت ۲ لیتر محلول 5 گرم بر لیتر سود سوزآور", "NaOH", (5.0, "g/L"), (2.0, "L")),
    ("make 100 ml of 0.5 N sodium hydroxide", "NaOH", (0.5, "eq/L"), (100.0, "mL")),
])
def test_parses_other_common_forms(message, formula, conc, volume):
    r = parse_solution_request(message)
    assert (r["substance"][2], r["concentration"], r["volume"]) == (formula, conc, volume)


def test_sulfuric_acid_answer_numbers():
    r = quick_solution_answer("محلول 0.02 نرمال اسید سولفوریک یک لیتر بسازم")
    prep = r["calculations"][1]["result"]
    assert prep["molarity_mol_per_L"] == pytest.approx(0.01)
    assert prep["purity_percent"] == 96 and prep["assay_source"] == "typical_example"
    assert prep["concentrate_volume_mL"] == pytest.approx(0.98072 / 0.96 / 1.84)
    assert "0.555 mL" in r["answer"] and "به آب" in r["answer"]


def test_solid_uses_pure_basis_and_asks_for_purity():
    r = quick_solution_answer("How do I prepare 250 mL of 0.1 M sodium chloride solution?")
    prep = r["calculations"][1]["result"]
    assert prep["assay_source"] == "pure_basis"
    assert prep["weigh_mass_g"] == pytest.approx(0.1 * 0.25 * (22.98976928 + 35.45))
    assert "purity" in r["answer"]


@pytest.mark.parametrize("message", [
    "محلول 0.1 نرمال پتاسیم یدات در یک لیتر چطور بسازم؟",        # normality depends on the reaction, not tabulated
    "محلول 0.1 مولار اسید سولفوریک بسازم",                      # no volume
    "یک لیتر محلول اسید سولفوریک بسازم",                        # no concentration
    "محلول 0.1 مولار کبالت نیترات یک لیتر بسازم",                # substance not in the table
])
def test_unresolved_questions_go_to_the_model(message):
    assert quick_solution_answer(message) is None


def test_phosphoric_acid_normality_lists_each_end_point():
    r = quick_solution_answer("محلول 0.1 نرمال اسید فسفریک در یک لیتر چطور بسازم؟")
    preps = [c["result"] for c in r["calculations"] if c["kind"] == "solution_preparation"]
    assert [p["equivalents_per_mol"] for p in preps] == [1, 2, 3]
    assert [p["molarity_mol_per_L"] for p in preps] == pytest.approx([0.1, 0.05, 0.1 / 3])
    assert all(p["purity_percent"] == 85 for p in preps)
    assert "متیل اورانژ" in r["answer"] and "فنل‌فتالئین" in r["answer"] and "به آب" in r["answer"]


def test_permanganate_normality_lists_acid_and_neutral_media():
    r = quick_solution_answer("make 1 L of 0.1 N potassium permanganate")
    preps = [c["result"] for c in r["calculations"] if c["kind"] == "solution_preparation"]
    assert [p["weigh_mass_g"] for p in preps] == pytest.approx([0.1 / 5 * 158.034, 0.1 / 3 * 158.034], rel=1e-4)
    assert "Mn²⁺" in r["answer"] and "MnO₂" in r["answer"] and "glass wool" in r["answer"]


def test_peroxide_normality_is_two_electrons():
    prep = quick_solution_answer("make 1 L of 0.1 N hydrogen peroxide")["calculations"][1]["result"]
    assert prep["molarity_mol_per_L"] == pytest.approx(0.05)


def test_every_table_row_is_usable():
    from solution_prep import molar_mass_from_formula, typical_grade
    from solution_quick import EQ_BASIS, EQ_OPTIONS, NOTES, SUBSTANCES

    formulas = [row[2] for row in SUBSTANCES]
    assert len(formulas) == len(set(formulas))
    for _fa, _en, formula, _display, eq, form in SUBSTANCES:
        mass = molar_mass_from_formula(formula)["molar_mass"]
        assert form in ("solid", "liquid")
        if form == "liquid":
            assert typical_grade(mass), formula
    assert set(NOTES) <= set(formulas) and set(EQ_BASIS) <= set(formulas) and set(EQ_OPTIONS) <= set(formulas)
    # A fixed factor and a list of options would contradict each other.
    assert all(row[4] is None for row in SUBSTANCES if row[2] in EQ_OPTIONS)


@pytest.mark.parametrize("message, formula", [
    # Names that contain another substance's name must still resolve to the longer one.
    ("محلول ۰٫۱ مولار بی‌کربنات سدیم ۵۰۰ میلی‌لیتر بسازم", "NaHCO3"),
    ("محلول ۰٫۱ مولار کربنات سدیم ۵۰۰ میلی‌لیتر بسازم", "Na2CO3"),
    ("محلول ۰٫۱ نرمال تیوسولفات سدیم یک لیتر بسازم", "Na2S2O3·5H2O"),
    ("محلول ۰٫۱ مولار سولفات سدیم یک لیتر بسازم", "Na2SO4"),
    ("محلول ۰٫۱ نرمال سولفات آهن آمونیوم یک لیتر بسازم", "(NH4)2Fe(SO4)2·6H2O"),
    ("محلول ۰٫۰۵ مولار اتیلن دی آمین تترا استیک اسید یک لیتر بسازم", "C10H14N2Na2O8·2H2O"),
    ("make 1 L of 0.01 M EDTA", "C10H14N2Na2O8·2H2O"),
    ("make 1 L of 0.1 N silver nitrate", "AgNO3"),
    ("محلول ۰٫۱ نرمال نیترات نقره یک لیتر تهیه کنم", "AgNO3"),
    ("make 500 mL of 0.1 M sodium bicarbonate", "NaHCO3"),
    ("make 500 mL of 0.1 N sodium thiosulfate", "Na2S2O3·5H2O"),
])
def test_resolves_the_right_substance(message, formula):
    assert parse_solution_request(message)["substance"][2] == formula


def test_dichromate_normality_uses_six_electrons_and_warns():
    r = quick_solution_answer("محلول ۰٫۱ نرمال پتاسیم دی‌کرومات یک لیتر بسازم")
    prep = r["calculations"][1]["result"]
    assert prep["molarity_mol_per_L"] == pytest.approx(0.1 / 6)
    assert prep["weigh_mass_g"] == pytest.approx(0.1 / 6 * 294.18, rel=1e-3)
    assert "Cr₂O₇²⁻ → 2Cr³⁺" in r["answer"] and "سرطان‌زا" in r["answer"]


def test_hydrate_mass_and_note():
    r = quick_solution_answer("make 1 L of 0.1 N sodium thiosulfate")
    prep = r["calculations"][1]["result"]
    assert prep["weigh_mass_g"] == pytest.approx(24.82, rel=1e-3)  # Na2S2O3·5H2O, 248.18 g/mol
    assert "hydrate" in r["answer"] and "iodometry" in r["answer"] and "boiled" in r["answer"]


def test_liquid_peroxide_molar_uses_typical_grade():
    r = quick_solution_answer("make 1 L of 0.1 M hydrogen peroxide")
    prep = r["calculations"][1]["result"]
    assert prep["purity_percent"] == 30 and prep["assay_source"] == "typical_example"
