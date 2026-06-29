import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from answer_quality_service import build_core_quality_rules


def test_core_quality_rules_prioritize_accuracy_over_style():
    rules = build_core_quality_rules()

    assert "Accuracy-first contract" in rules
    assert "Correctness has priority over style" in rules
    assert "Never substitute one ASTM/ISO/EPA code" in rules
