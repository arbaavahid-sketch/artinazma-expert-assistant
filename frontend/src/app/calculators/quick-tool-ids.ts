/**
 * Stable identifiers for the quick calculators.
 *
 * Usage records, saved history and PDF reports refer to a tool by this id, so
 * an id must never change or be reused once released. Keys are the English
 * tool names; renaming a tool means updating its key here and keeping the id.
 */
const ids: Record<string, string> = {
  "Solution dilution": "dilution",
  "Molar solution preparation": "molar-solution",
  "Pressure conversion": "pressure",
  "Purity correction": "purity-correction",
  "Mass percentage w/w": "mass-percent",
  "Mass ppm to mg/L": "ppm-to-mg-l",
  "Volumetric flow conversion": "flow-lmin-to-m3h",
  "Celsius to Kelvin conversion": "celsius-to-kelvin",
  "Spike recovery": "spike-recovery",
  "Linear calibration concentration": "calibration-concentration",
  "Pipe flow velocity": "pipe-velocity",
  "Pipe Reynolds number": "reynolds",
  "Mass flow from volumetric flow": "mass-flow",
  "Serial dilution": "serial-dilution",
  "Molar solution with purity correction": "molar-solution-purity",
  "Mass per volume percentage w/v": "mass-volume-percent",
  "Volume percentage v/v": "volume-percent",
  "Mass concentration in ppm": "mass-ppm",
  "Density from mass and volume": "density",
  "Volumetric flow from mass flow": "volumetric-flow",
  "Gas flow at reference conditions": "gas-flow-reference",
  "Dynamic to kinematic viscosity": "kinematic-viscosity",
  "Darcy–Weisbach friction pressure drop": "darcy-pressure-drop",
  "Pump hydraulic power": "pump-hydraulic-power",
  "Mean, sample standard deviation and RSD": "mean-sd-rsd",
  "Kelvin to Celsius conversion": "kelvin-to-celsius",
  "m³/h to L/min flow conversion": "flow-m3h-to-lmin",
  "g/mL to kg/m³ density conversion": "density-gml-to-kgm3",
  "Sensible heat energy": "sensible-heat",
  "Hydrostatic pressure difference": "hydrostatic-pressure",
  "Linear calibration regression R²": "calibration-fit",
  "Relative measurement error": "relative-error",
  "Pump input power with efficiency": "pump-input-power",
  "Type A standard uncertainty of the mean": "type-a-uncertainty",
  "Combined standard uncertainty": "combined-uncertainty",
  "Expanded measurement uncertainty": "expanded-uncertainty",
  "GC–FID external calibration uncertainty budget": "gc-fid-budget",
  "General GUM uncertainty budget": "gum-budget",
  "Balance weighing uncertainty": "balance-uncertainty",
  "Density uncertainty from mass and volume": "density-uncertainty",
  "Unit converter": "unit-converter",
  "Normal solution preparation": "normal-solution",
  "Molarity of a concentrated reagent": "concentrate-molarity",
  "Concentrate volume for a molar solution": "concentrate-volume",
  "Molar mass from formula": "molar-mass",
  "pH from hydrogen ion concentration": "ph-from-h",
  "Hydrogen ion concentration from pH": "h-from-ph",
  "Buffer pH (Henderson–Hasselbalch)": "buffer-ph",
  "Analyte concentration from titration": "titration",
  "Acid number from KOH titration": "acid-number",
  "API gravity from relative density": "api-from-sg",
  "Relative density from API gravity": "sg-from-api",
};

export const builtInQuickTools = ["Solution dilution", "Molar solution preparation", "Pressure conversion", "Unit converter"] as const;

export function quickToolId(englishName: string): string {
  const id = ids[englishName];
  if (!id) throw new Error(`Quick calculator has no stable id: ${englishName}`);
  return id;
}
