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
    "محلول 0.1 نرمال اسید فسفریک در یک لیتر چطور بسازم؟",       # normality depends on the reaction
    "محلول 0.1 مولار اسید سولفوریک بسازم",                      # no volume
    "یک لیتر محلول اسید سولفوریک بسازم",                        # no concentration
    "محلول 0.1 مولار پتاسیم دی‌کرومات یک لیتر بسازم",            # substance not in the table
])
def test_unresolved_questions_go_to_the_model(message):
    assert quick_solution_answer(message) is None
