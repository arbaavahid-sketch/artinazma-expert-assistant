# Suncal engine activation

The built-in independent linear GUM budget remains available without an additional dependency.
Set UNCERTAINTY_ENGINE=suncal to use the installed Suncal engine for the budget endpoint.
An unavailable configured engine returns HTTP 503 instead of switching engines.

Install requirements-uncertainty.txt in the backend environment and restart the backend.
For headless deployments, use MPLBACKEND=Agg and a writable MPLCONFIGDIR.

Suncal 1.7.1 is GPL-3.0 software. Review the license and distribution obligations for the actual deployment and packaged applications before shipping it. The optional requirements file does not add Suncal to the default application image.

The route generates a sum of independent zero-mean error terms from standard uncertainties and supplied sensitivity coefficients. The text entered in the measurement equation field is documentation. It is not evaluated. This adapter does not yet evaluate arbitrary nonlinear models, correlations or Monte Carlo distributions.

Engine name and version are returned and included in copied budget reports.

## Correlated linear budgets

The budget endpoint accepts optional correlations as zero-based component indices and a coefficient between -1 and 1. Unlisted pairs are zero. Duplicate, diagonal and out-of-range pairs are rejected, as are correlation matrices with eigenvalues below -1e-10. Values within that numerical tolerance are treated as positive semidefinite for calculation.

Signed sensitivity coefficients are retained in covariance terms. The Suncal adapter applies their signs when mapping input correlations to scaled error terms. A zero standard uncertainty contributes nothing.

Variance percentages allocate half of each cross-term to each participating component. Signed percentages may be negative. At zero total variance the percentages are undefined and returned as null.

Correlations entered in the UI are included in the copied report. Removing a component clears the entered correlation pairs so that indices cannot silently refer to another component.
