"""Bounded adaptive GC Monte Carlo; input PDFs come from the reviewed budget."""
import hashlib
import json
import math
import platform
from typing import Literal
import numpy as np
from pydantic import BaseModel, ConfigDict, Field, field_validator
from uncertainty_service import BudgetRequest, SimulationOptions, calculate_budget, correlation_matrix, simulate_budget
from measurement_models import MODEL_REGISTRY

ALGORITHM = 'artin-adaptive-gc-mc-v1'
BLOCK_SIZE = 10000
MIN_BATCHES = 5


class MCSettings(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    seed: int = Field(default=12345, ge=0, le=4294967295, strict=True)
    max_batches: int = Field(default=10, ge=5, le=20, strict=True)
    significant_digits: Literal[1, 2] = 2
    probability: Literal[.9, .95, .99] = .95

    @field_validator('significant_digits', mode='before')
    @classmethod
    def strict_digits(cls, value):
        if type(value) is not int:
            raise ValueError('Significant digits must be an integer')
        return value


class MCStudyRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    budget: BudgetRequest
    settings: MCSettings
    calibration_range: list[float] = Field(min_length=2, max_length=2)


def numerical_tolerance(standard, digits):
    if not math.isfinite(standard) or standard <= 0:
        raise ValueError('Positive simulated spread is required for numerical tolerance')
    exponent = int(f'{standard:.{digits-1}e}'.split('e')[1])
    delta = .5 * 10.0 ** (exponent-digits+1)
    if not math.isfinite(delta) or delta <= 0:
        raise ValueError('Numerical tolerance exceeds the supported range')
    return delta


def normalized_summary(draws, probability):
    low, high = np.quantile(draws, [(1-probability)/2, (1+probability)/2], method='linear')
    summary = np.array([np.mean(draws), np.std(draws, ddof=1), low, high], dtype=float)
    if not np.all(np.isfinite(summary)):
        raise ValueError('Simulation exceeds the supported numeric range')
    return summary


def stability_errors(batch_summaries, scale):
    # 2*s for the average of independent batch estimates: denominator h*(h-1).
    return 2 * np.std(np.asarray(batch_summaries), axis=0, ddof=1) / math.sqrt(len(batch_summaries)) * scale


def calculate_mc_study(payload: MCStudyRequest):
    request, options = payload.budget, payload.settings
    if request.simulation is not None or not request.measurement_model or request.measurement_model.kind != 'gcExtraction':
        raise ValueError('This study requires a GC extraction budget without nested simulation')
    if len(request.components) > 27 or len(request.measurement_model.additional_targets) > 20:
        raise ValueError('GC study component limit exceeded')
    low, high = payload.calibration_range
    if not all(math.isfinite(v) for v in [low, high]) or low < 0 or high <= low:
        raise ValueError('Invalid calibration range')
    nominals = request.measurement_model.nominals
    if len(nominals) != 7 or nominals[1] <= 0 or not low <= (nominals[0]-nominals[2])/nominals[1] <= high:
        raise ValueError('Nominal sample is outside the calibration range')
    reference = calculate_budget(request)
    if reference['standard_uncertainty'] <= 0:
        raise ValueError('This study requires a positive linear standard uncertainty')
    standard = [item['standard_uncertainty'] for item in reference['components']]
    contributions = [item['contribution'] for item in reference['components']]
    _, eigenvalues, eigenvectors = correlation_matrix(request)
    sample_request = request.model_copy(update={'simulation': SimulationOptions(samples=BLOCK_SIZE, seed=options.seed, probability=options.probability)})
    chunks, summaries, checkpoints = [], [], []
    exceedances = 0
    calibration_exceedances = 0
    converged = False
    for index in range(options.max_batches):
        # Named child streams avoid reusing a seed and make prefixes reproducible.
        rng = np.random.Generator(np.random.PCG64(np.random.SeedSequence(options.seed, spawn_key=(index,))))
        draws, scale, outside, outside_calibration = simulate_budget(sample_request, contributions, standard, eigenvalues, eigenvectors, _rng=rng, _raw=True, _gc_calibration_range=(low, high))
        chunks.append(draws)
        summaries.append(normalized_summary(draws, options.probability))
        exceedances += outside
        calibration_exceedances += outside_calibration
        if len(chunks) < MIN_BATCHES:
            continue
        pooled = np.concatenate(chunks)
        summary = normalized_summary(pooled, options.probability)
        delta = numerical_tolerance(float(summary[1])*scale, options.significant_digits)
        errors = stability_errors(summaries, scale)
        if not np.all(np.isfinite(errors)):
            raise ValueError('Stability diagnostic exceeds the supported range')
        converged = bool(np.all(errors <= delta))
        checkpoints.append({'batches': len(chunks), 'samples': len(pooled), 'tolerance': delta,
                            'twice_standard_errors': errors.tolist(), 'tolerance_met': converged})
        if converged:
            break
    mean = request.measured + float(summary[0])*scale
    u = float(summary[1])*scale
    lower, upper = request.measured+float(summary[2])*scale, request.measured+float(summary[3])*scale
    if not all(math.isfinite(v) for v in [mean, u, lower, upper]) or u <= 0:
        raise ValueError('Simulation exceeds the supported numeric range')
    counts, edges = np.histogram(pooled, bins=30)
    histogram = [{'offset': float((edges[i]+edges[i+1])/2)*scale, 'count': int(n)} for i, n in enumerate(counts)]
    if not all(math.isfinite(bin['offset']) for bin in histogram):
        raise ValueError('Histogram exceeds the supported numeric range')
    return {'algorithm': ALGORITHM, 'engine': 'numpy-model-mc', 'engine_version': np.__version__,
            'python_version': platform.python_version(), 'rng': 'PCG64-SeedSequence-spawn-v1',
            'model': 'gcExtraction', 'model_sha256': hashlib.sha256(json.dumps(MODEL_REGISTRY['gcExtraction'], sort_keys=True).encode()).hexdigest(),
            'quantile_method': 'linear', 'settings': options.model_dump(), 'block_size': BLOCK_SIZE,
            'minimum_batches': MIN_BATCHES, 'batches': len(chunks), 'samples': len(pooled), 'seed': options.seed,
            'probability': options.probability, 'interval': 'equal-tail', 'mean': mean,
            'mean_shift': mean-request.measured, 'standard_uncertainty': u, 'lower': lower, 'upper': upper,
            'histogram': histogram, 'applicability_exceedances': exceedances,
            'calibration_range': [low, high], 'calibration_exceedances': calibration_exceedances,
            'applicability_exceedance_fraction': exceedances/len(pooled), 'checkpoints': checkpoints,
            'converged': converged, 'stop_reason': 'tolerance_met' if converged else 'batch_limit',
            'tolerance': delta, 'normal_assumption': 'standard, certificate and repeatability contributions treated as normal',
            'linear_reference': {'measured': reference['measured'], 'standard_uncertainty': reference['standard_uncertainty'],
                                 'expanded_uncertainty': reference['expanded_uncertainty'], 'coverage': reference['coverage'],
                                 'engine': reference['engine'], 'engine_version': reference['engine_version']}}
