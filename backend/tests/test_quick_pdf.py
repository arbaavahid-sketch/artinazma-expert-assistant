import io

import pytest
from pydantic import ValidationError
from pypdf import PdfReader

from quick_pdf_service import QuickReport, build_quick_pdf, plain


def example(locale='en', **changes):
    return {'locale': locale, 'tool': 'dilution', 'title': 'Solution dilution', 'category': 'Solutions & concentration',
            'formula': 'V₁ = C₂ × V₂ / C₁', 'inputs': [{'label': 'Stock concentration', 'value': '1 mol/L'},
                                                       {'label': 'Final volume', 'value': '250 mL'}],
            'results': ['25 mL', '0.1 × 250 / 1 = 25 mL'], 'note': 'Bring to the final volume with solvent.', **changes}


@pytest.mark.parametrize('locale', ['fa', 'en'])
def test_report_prints_result_inputs_and_origin(locale):
    reader = PdfReader(io.BytesIO(build_quick_pdf(QuickReport.model_validate(example(locale)))))
    text = ''.join(page.extract_text() for page in reader.pages)
    for value in ['25 mL', '250 mL', 'quick calculation v1 | dilution', 'V_1 = C_2']:
        assert value in text
    if locale == 'en':
        assert 'did not recompute or verify' in text


def test_formula_symbols_missing_from_the_font_become_plain_text():
    assert plain('Re = ρ × v × D / μ') == 'Re = rho × v × D / mu'
    assert plain('x̄ = Σx / n · ṁ · d²') == 'x_mean = sum x / n · m_dot · d^2'


@pytest.mark.parametrize('change', [{'tool': 'Quick 1'}, {'tool': '../x'}, {'results': []}, {'title': ''},
                                    {'inputs': [{'label': 'a', 'value': 'b'}] * 41}, {'extra': 1},
                                    {'results': ['x' * 2001]}])
def test_rejects_malformed_payload(change):
    with pytest.raises(ValidationError):
        QuickReport.model_validate(example(**change))


def test_usage_api_accepts_stable_and_legacy_tool_keys():
    from routes.calculation_activity import ClientEvent
    for tool in ['quick-0', 'quick-dilution', 'quick-mean-sd-rsd', 'quick-flow-m3h-to-lmin']:
        assert ClientEvent(event_id='a' * 32, tool=tool, status='success').tool == tool
    for tool in ['quick-', 'quick-Dilution', 'quick--x', 'other-tool']:
        with pytest.raises(ValidationError):
            ClientEvent(event_id='a' * 32, tool=tool, status='success')
