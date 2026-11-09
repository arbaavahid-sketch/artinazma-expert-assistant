import { familyModels } from "./family-models";

export type BudgetRow = { name: string; source: string; unit: string; u: string; c: string; kind: string; divisor: string; target?: number; dfMode?: 'unknown'|'finite'|'infinite'|'study'; dfValue?: string };
export type GCGraphData = { standards: string; chromatogram: string };
export type GumProject = {
  format: "artin-gum"; version: 1; savedAt: string; template: string;
  rows: BudgetRow[];
  inputs: Record<string, string>;
  gcData: Record<string, string>;
  familyData: string[];
  correlations: { first: number; second: number; coefficient: string }[];
  graphs?: GCGraphData;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid object");
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  if (typeof value !== "string" || value.length > 5000) throw new Error("Invalid text");
  return value;
}

function stringRecord(value: unknown) {
  const source = record(value);
  if (Object.keys(source).length > 30) throw new Error("Too many fields");
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, text(value)]));
}

export function readGumProject(value: unknown): GumProject {
  const data = record(value);
  if (data.format !== "artin-gum" || data.version !== 1) throw new Error("Unsupported project");
  const template = text(data.template);
  const rowCounts: Record<string, number> = { balance: 5, density: 2, standard: 5, titration: 6, typeA: 1, gc: 5, gcExtraction: 7 };
  const family = template.startsWith("family:") ? familyModels[template.slice(7)] : undefined;
  const count = family ? family.inputs.length + 2 : rowCounts[template];
  if (template !== "general" && !count) throw new Error("Unknown template");
  if (!Array.isArray(data.rows) || data.rows.length < 1 || data.rows.length > 100 ||
    (template !== "general" && data.rows.length < count)) throw new Error("Invalid components");
  const kinds = ["standard", "certificate", "rectangular", "triangular", "resolution", "repeatability"];
  const rows = data.rows.map((value, index) => {
    const source = record(value);
    const row = Object.fromEntries(["name", "source", "unit", "u", "c", "kind", "divisor"].map(key => [key, text(source[key])])) as unknown as BudgetRow;
    if (!kinds.includes(row.kind)) throw new Error("Unknown input type");
    if(source.dfMode!==undefined){
      if(!['unknown','finite','infinite','study'].includes(String(source.dfMode)))throw new Error('Invalid degrees of freedom');
      row.dfMode=source.dfMode as BudgetRow['dfMode'];
    }
    if(source.dfValue!==undefined)row.dfValue=text(source.dfValue);
    if (template !== "general" && index >= count) {
      const physicalCount = family ? family.inputs.length : template === "density" ? 2 : template === "gcExtraction" ? 7 : template === "standard" ? 5 : template === "titration" ? 6 : 0;
      if (!Number.isInteger(source.target) || (source.target as number) < -1 || (source.target as number) >= physicalCount) throw new Error("Invalid additional component target");
      row.target = source.target as number;
    } else if (source.target !== undefined) throw new Error("Unexpected component target");
    return row;
  });
  if (!Array.isArray(data.familyData) || data.familyData.length > 20) throw new Error("Invalid inputs");
  if (!Array.isArray(data.correlations) || data.correlations.length > 4950) throw new Error("Invalid correlations");
  const correlations = data.correlations.map(value => {
    const pair = record(value);
    if (!Number.isInteger(pair.first) || !Number.isInteger(pair.second) ||
      (pair.first as number) < 0 || (pair.second as number) < 0 ||
      (pair.first as number) >= rows.length || (pair.second as number) >= rows.length ||
      pair.first === pair.second) throw new Error("Invalid correlation pair");
    return { first: pair.first as number, second: pair.second as number, coefficient: text(pair.coefficient) };
  });
  let graphs: GCGraphData | undefined;
  if (data.graphs !== undefined) {
    const source = record(data.graphs);
    if (typeof source.standards !== "string" || typeof source.chromatogram !== "string" ||
      source.standards.length > 500000 || source.chromatogram.length > 2000000) throw new Error("Invalid graph data");
    graphs = { standards: source.standards, chromatogram: source.chromatogram };
  }
  return {
    format: "artin-gum", version: 1, savedAt: text(data.savedAt), template,
    rows, inputs: stringRecord(data.inputs), gcData: stringRecord(data.gcData),
    familyData: data.familyData.map(text), correlations,
    ...(graphs ? { graphs } : {}),
  };
}
