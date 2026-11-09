"""Independent engine check. Run using the isolated Suncal evaluation environment."""
import json
import math
import importlib.metadata
from suncal import Model

cases = [
    ("density", "m/V", {"m": (50, .005), "V": (50, .02)}, 1.0, math.sqrt(17) * .0001),
    ("balance", "m+rep+cal+res+drift+temp",
     {"m": (50, 0), "rep": (0, .002), "cal": (0, .004/2),
      "res": (0, .001/math.sqrt(12)), "drift": (0, .001/math.sqrt(3)),
      "temp": (0, .001/math.sqrt(3))}, 50.0, math.sqrt(8.75)*.001),
]
results = []
for name, expression, inputs, expected_value, expected_u in cases:
    model = Model(expression)
    for variable, (value, uncertainty) in inputs.items():
        item = model.var(variable).measure(value)
        if uncertainty:
            item.typeb(std=uncertainty)
    calculation = model.calculate_gum()
    output = next(iter(calculation.expected))
    value = float(calculation.expected[output])
    uncertainty = float(calculation.uncertainty[output])
    assert math.isclose(value, expected_value, rel_tol=1e-12)
    assert math.isclose(uncertainty, expected_u, rel_tol=1e-12)
    results.append(dict(case=name, model=expression, inputs=inputs, value=value,
                        standard_uncertainty=uncertainty, expanded_k2=2*uncertainty))
print(json.dumps({"engine": "Suncal", "version": importlib.metadata.version("suncal"),
                  "results": results}, indent=2))
