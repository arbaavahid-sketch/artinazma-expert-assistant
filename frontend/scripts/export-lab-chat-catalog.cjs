// Export only labels and input contracts; equations stay in the numerical engine.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'frontend/src/app/calculators'),cache=new Map();
function load(relative){
 const file=path.resolve(base,relative);if(cache.has(file))return cache.get(file).exports;
 const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));cache.set(file,m);
 const native=m.require.bind(m);m.require=request=>{const local=path.resolve(path.dirname(file),request);return request.startsWith('.')&&fs.existsSync(`${local}.ts`)?load(path.relative(base,`${local}.ts`)):native(request);};
 m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:file}).outputText,file);return m.exports;
}
const {familyModels}=load('family-models.ts'),{methodProfile}=load('method-profiles.ts'),{methodName}=load('method-names-en.ts');
const registry=require(path.join(root,'backend/measurement_model_registry.json')),bank=require(path.join(base,'method-bank.json'));
const models=Object.fromEntries(Object.entries(familyModels).filter(([key])=>registry[key]).map(([key,m])=>[key,{fa:m.fa,en:m.en,unit:m.unit,formula:m.formula,inputs:m.inputs.map(({fa,en,unit})=>({fa,en,unit}))}]));
models.density={fa:'چگالی از جرم و حجم',en:'Density from mass and volume',unit:'g/mL',formula:'mass / volume',inputs:[{fa:'جرم',en:'Mass',unit:'g'},{fa:'حجم',en:'Volume',unit:'mL'}]};
const {gcInputs}=load('gc-model.ts');
models.gcExtraction={fa:'GC-FID با استخراج و کالیبراسیون خارجی',en:'GC-FID extraction and external calibration',unit:'mg/kg',formula:'(A-b)/a × V × D / (m × R/100)',inputs:gcInputs.map((x,i)=>({fa:x.fa,en:x.en,unit:['area','area/(mg/L)','area','mL','1','g','%'][i]}))};
const methods=bank.map(m=>({id:m.id,fa:m.name,en:methodName(m,true),references:m.standard_codes,...methodProfile(m,true)}));
fs.writeFileSync(path.join(root,'backend/data/lab-chat-catalog.json'),JSON.stringify({version:1,models,methods},null,2)+'\n');
console.log(`Exported ${Object.keys(models).length} models and ${methods.length} methods`);
