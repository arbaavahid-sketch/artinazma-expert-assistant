from unittest.mock import patch
import pytest
import chemical_language as language


def test_resolver_is_structured_and_cached():
    language.resolve_name.cache_clear()
    expected = {'status': 'ambiguous', 'explanation': 'نام کامل لازم است', 'candidates': []}
    with patch.object(language, 'structured_language', return_value=expected) as model:
        assert language.resolve_name('متیلن') == expected
        language.resolve_name('متیلن')
    assert model.call_count == 1
    assert 'ambiguous' in model.call_args.args[0]


def test_translation_requires_one_output_per_excerpt():
    language.translate_rows.cache_clear()
    with patch.object(language, 'structured_language', return_value={'translations': []}):
        with pytest.raises(ValueError):
            language.translate_rows(('Density 2.1 g/cm3 at 25 C',))


def test_translation_keeps_order_and_cache():
    language.translate_rows.cache_clear()
    with patch.object(language, 'structured_language', return_value={'translations': ['چگالی 2.1 g/cm3 در 25 C']}) as model:
        result = language.translate_rows(('Density 2.1 g/cm3 at 25 C',))
        assert result['translations'][0].endswith('25 C')
        language.translate_rows(('Density 2.1 g/cm3 at 25 C',))
    assert model.call_count == 1
