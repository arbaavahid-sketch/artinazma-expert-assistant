import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from intent_service import detect_question_intent


def test_hds_catalyst_question_prefers_chemical_intent():
    result = detect_question_intent(
        "کاتالیست HDS در واحد پالایشگاهی چه نقشی دارد و در انتخاب آن چه عواملی مهم است؟"
    )
    assert result["intent"] == "chemical_or_catalyst"


def test_hplc_pressure_and_broad_peaks_are_troubleshooting():
    result = detect_question_intent(
        "My HPLC pressure is increasing during the run and peaks are broad. What should I check first?"
    )
    assert result["intent"] == "troubleshooting"

