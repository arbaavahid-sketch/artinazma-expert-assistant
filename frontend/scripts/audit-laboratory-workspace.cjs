// Read the existing TypeScript catalog without changing the application runtime.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const catalogRoot = path.join(root, 'frontend/src/app/calculators');
const cache = new Map();

function load(relative) {
  const file = path.resolve(catalogRoot, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const instance = new Module(file, module);
  instance.filename = file;
  instance.paths = Module._nodeModulePaths(path.dirname(file));
  cache.set(file, instance);
  const nativeRequire = instance.require.bind(instance);
  instance.require = request => {
    if (request.startsWith('.')) {
      const local = path.resolve(path.dirname(file), request);
      if (fs.existsSync(`${local}.ts`)) return load(path.relative(catalogRoot, `${local}.ts`));
    }
    return nativeRequire(request);
  };
  instance._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: file,
  }).outputText, file);
  return instance.exports;
}

const { labTools } = load('lab-tools.ts');
const { toolGroups, toolGroup } = load('tool-groups.ts');
const { familyModels } = load('family-models.ts');
const { methodProfile, profileCounts } = load('method-profiles.ts');
const { formulaNotes } = load('formula-notes.ts');
const { methodName } = load('method-names-en.ts');
const { measurementRegistry, evaluateRegisteredModel } = load('registered-models.ts');
const bank = require(path.join(catalogRoot, 'method-bank.json'));
const backendRegistry = require(path.join(root, 'backend/measurement_model_registry.json'));

const builtin = [
  { id: 0, fa: 'رقیق‌سازی محلول', en: 'Solution dilution', category: 0, note: 'dilution', example: [1, 0.1, 250], result: 25 },
  { id: 1, fa: 'آماده‌سازی محلول مولار', en: 'Molar solution preparation', category: 0, note: 'molarity', example: [0.1, 250, 58.44], result: 1.461 },
  { id: 2, fa: 'تبدیل واحد فشار', en: 'Pressure conversion', category: 1, note: 'pressure', example: [1.5], result: 150 },
];
const tools = [
  ...builtin.map(item => ({ ...item, visible: true, bilingualExplanation: Boolean(formulaNotes[item.note]?.fa && formulaNotes[item.note]?.en), exampleCheck: 'covered-by-existing-UI-tests' })),
  ...labTools.map((item, index) => {
    const note = item.explanation ?? formulaNotes[item.en];
    const visible = !item.en.toLowerCase().includes('uncertainty') || item.en === 'General GUM uncertainty budget';
    const answer = item.calculate(item.example);
    return {
      id: index + 3, fa: item.name, en: item.en, category: toolGroup(item.en, item.category), visible,
      fields: { fa: item.fields, en: item.fieldsEn }, formula: item.formula, unit: item.unit,
      bilingualExplanation: Boolean(note?.fa && note?.en), fieldLabelsAligned: item.fields.length === item.fieldsEn.length,
      example: item.example, exampleResult: Number.isFinite(answer) ? answer : null,
      exampleAccepted: item.valid ? item.valid(item.example) : null,
      exampleCheck: item.en === 'General GUM uncertainty budget' ? 'dedicated-form' : Number.isFinite(answer) ? 'finite-output-only' : 'needs-review',
    };
  }),
];
const equations = Object.entries(measurementRegistry).map(([id, model]) => {
  const answer = model.example ? evaluateRegisteredModel(id, model.example) : null;
  return { id, inputCount: model.input_count, examplePresent: Boolean(model.example), exampleValid: Boolean(answer?.valid),
    finiteSensitivities: Boolean(answer?.sensitivities.every(Number.isFinite)),
    exampleResult: answer && Number.isFinite(answer.value) ? answer.value : null,
    reference: model.reference ?? familyModels[id]?.reference ?? null,
    sourceEdition: model.source_edition ?? familyModels[id]?.sourceEdition ?? null };
});
const methods = bank.map(item => {
  const profile = methodProfile(item, true);
  return { id: item.id, fa: item.name, en: methodName(item, true), category: item.category,
    standard: item.standard_claim, kind: profile.kind, models: profile.models, scope: profile.scope,
    readinessMeaning: 'base-model-availability-not-complete-method-validation' };
});
const result = {
  schema: 'artin-lab-baseline', version: 1,
  evidence: 'Static catalog inspection and evaluation of existing nominal examples; not validation of every laboratory method.',
  counts: { catalogEntries: tools.length, visibleTools: tools.filter(item => item.visible).length,
    hiddenLegacyEntries: tools.filter(item => !item.visible).length, methodBank: methods.length,
    methodKinds: profileCounts, familyModels: Object.keys(familyModels).length, registeredEquations: equations.length },
  categories: toolGroups.map((group, index) => ({ ...group, count: tools.filter(item => item.visible && item.category === index).length })),
  checks: { registryParity: JSON.stringify(measurementRegistry) === JSON.stringify(backendRegistry),
    nominalExamplesValid: equations.every(item => item.exampleValid && item.finiteSensitivities),
    visibleToolFieldLabelsAligned: tools.filter(item => item.visible && item.id >= 3).every(item => item.fieldLabelsAligned),
    visibleToolsMissingBilingualExplanation: tools.filter(item => item.visible && !item.bilingualExplanation).map(item => item.en),
    equationsWithoutInlineReference: equations.filter(item => !item.reference).map(item => item.id),
    methodsMissingEnglishName: methods.filter(item => !item.en).map(item => item.id),
    numericMethodsWithoutBaseModel: methods.filter(item => item.kind === 'numeric' && !item.models.length).map(item => item.id),
    methodModelsAbsentFromRegistry: [...new Set(methods.flatMap(item => item.models).filter(id => !measurementRegistry[id]))] },
  tools, methods, equations,
};
fs.writeFileSync(path.join(root, 'docs/lab-workspace-baseline.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ counts: result.counts, checks: result.checks, categories: result.categories.map(({fa,en,count}) => ({fa,en,count})) }, null, 2));
if (!result.checks.registryParity || !result.checks.nominalExamplesValid || !result.checks.visibleToolFieldLabelsAligned) process.exitCode = 1;
