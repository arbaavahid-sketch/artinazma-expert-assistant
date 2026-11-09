import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import GumBudget from "../GumBudget";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ apiUrl: (path: string) => path, customerFetch: request }));

it("sends certificate uncertainty and coverage factor to the server", async () => {
  request.mockResolvedValue({ ok: true, json: async () => ({
    standard_uncertainty: .05, expanded_uncertainty: .1, engine: "suncal", engine_version: "1.7.1",
    components: [{ variance_percent: 100 }],
  }) });
  render(<GumBudget en parseNumber={Number} />);
  fireEvent.change(screen.getByLabelText("Select test or method"), { target: { value: "general" } });
  fireEvent.change(screen.getByLabelText("Measured result y"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText("Component"), { target: { value: "Calibration" } });
  fireEvent.change(screen.getByLabelText("What value do you have?"), { target: { value: "certificate" } });
  fireEvent.change(screen.getByLabelText("Uncertainty value or bound"), { target: { value: "0.1" } });
  fireEvent.click(screen.getByRole("button", { name: "Calculate budget" }));
  expect(await screen.findByText("10 ± 0.1 (k = 2)")).toBeInTheDocument();
  expect(screen.getByText("suncal 1.7.1")).toBeInTheDocument();
  expect(JSON.parse(request.mock.calls[0][1].body).components[0]).toMatchObject({ kind: "certificate", value: .1, certificate_k: 2 });
  fireEvent.change(screen.getByLabelText("Certificate coverage factor k"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Calculate budget" }));
  expect(screen.getByRole("alert")).toBeInTheDocument();
});

it("calculates density and its sensitivity coefficients from mass and volume", async () => {
  request.mockClear();
  request.mockResolvedValue({ ok: true, json: async () => ({
    standard_uncertainty: .000412310562561766, expanded_uncertainty: .000824621125123532,
    engine: "artin-linear-gum", engine_version: "1", components: [{ variance_percent: 6 }, { variance_percent: 94 }],
  }) });
  render(<GumBudget en parseNumber={Number} />);
  fireEvent.change(screen.getByLabelText("Select test or method"), { target: { value: "density" } });
  fireEvent.change(screen.getByLabelText("Sample mass (g)"), { target: { value: "50" } });
  fireEvent.change(screen.getByLabelText("Sample volume (mL)"), { target: { value: "50" } });
  const inputs = screen.getAllByLabelText("Uncertainty value or bound");
  fireEvent.change(inputs[0], { target: { value: ".005" } });
  fireEvent.change(inputs[1], { target: { value: ".02" } });
  fireEvent.click(screen.getByRole("button", { name: "Calculate budget" }));
  await screen.findByText("Measurement report");
  const body = JSON.parse(request.mock.calls[0][1].body);
  expect(body.measured).toBe(1);
  expect(body.measurement_model).toEqual({ kind: "density", nominals: [50, 50] });
  expect(body.components[0].sensitivity).toBe(.02);
  expect(body.components[1].sensitivity).toBe(-.02);
});

it("loads the standard preparation model with reference distributions and automatic sensitivities", async () => {
  request.mockClear();
  request.mockResolvedValue({ ok: true, json: async () => ({
    standard_uncertainty: .8351992267684394, expanded_uncertainty: 1.6703984535368788,
    engine: "artin-linear-gum", engine_version: "1", components: Array(5).fill({ variance_percent: 20 }),
  }) });
  render(<GumBudget en parseNumber={Number} />);
  fireEvent.change(screen.getByLabelText("Select test or method"), { target: { value: "standard" } });
  fireEvent.click(screen.getByRole("button", { name: "Load Eurachem A1 reference values" }));
  fireEvent.click(screen.getByRole("button", { name: "Calculate budget" }));
  await screen.findByText("Measurement report");
  const body = JSON.parse(request.mock.calls[0][1].body);
  expect(body.measured).toBeCloseTo(1002.69972, 8);
  expect(body.components[1]).toMatchObject({ value: .01, kind: "rectangular" });
  expect(body.components[2].kind).toBe("triangular");
  expect(body.components[3].sensitivity).toBeCloseTo(-.2105669412, 10);
});

it("loads NaOH titration with molar mass and percent-based sensitivities", async () => {
  request.mockClear();
  request.mockResolvedValue({ ok: true, json: async () => ({
    standard_uncertainty: .0000967819, expanded_uncertainty: .0001935638,
    engine: "artin-linear-gum", engine_version: "1", components: Array(6).fill({ variance_percent: 100/6 }),
  }) });
  render(<GumBudget en parseNumber={Number} />);
  fireEvent.change(screen.getByLabelText("Select test or method"), { target: { value: "titration" } });
  fireEvent.click(screen.getByRole("button", { name: "Load Eurachem A2 reference values" }));
  fireEvent.click(screen.getByRole("button", { name: "Calculate budget" }));
  await screen.findByText("Measurement report");
  const body = JSON.parse(request.mock.calls[0][1].body);
  expect(body.measured).toBeCloseTo(.102136159706791, 12);
  expect(body.components[1]).toMatchObject({ value: .05, kind: "rectangular" });
  expect(body.components[3].sensitivity).toBeCloseTo(-.001021361597, 12);
  expect(body.components[5].sensitivity).toBeCloseTo(.001021361597, 12);
});

it("shows corrected dimensionless units and translated method information in English", () => {
  render(<GumBudget en parseNumber={Number} />);
  fireEvent.click(screen.getByText("98-test method bank"));
  fireEvent.change(screen.getByLabelText("Test bank selection"), { target: { value: "57" } });
  expect(screen.getByText(/Output unit/)).toHaveTextContent('Output unit · 1');
  expect(screen.queryByText("عنوان چگالی نسبی بود اما واحد فایل API بود.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Use model: Relative density from sample and reference densities" })).toBeInTheDocument();
});

it('adds input-linked and result effects, updates units and sensitivities, and removes only added rows',async()=>{
 request.mockClear();
 request.mockResolvedValue({ok:true,json:async()=>({standard_uncertainty:.3,expanded_uncertainty:.6,engine:'artin-linear-gum',engine_version:'1',components:Array(4).fill({variance_percent:25})})});
 render(<GumBudget en parseNumber={Number}/>);
 fireEvent.change(screen.getByLabelText('Select test or method'),{target:{value:'density'}});
 fireEvent.change(screen.getByLabelText('Sample mass (g)'),{target:{value:'10'}});
 fireEvent.change(screen.getByLabelText('Sample volume (mL)'),{target:{value:'2'}});
 expect(screen.queryByRole('button',{name:'Remove component'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'+ Add component'}));
 fireEvent.change(screen.getAllByLabelText('Component')[2],{target:{value:'Volume calibration'}});
 fireEvent.change(screen.getByLabelText('Where does this additional effect act?'),{target:{value:'1'}});
 expect(screen.getAllByLabelText('Input unit')[2]).toHaveValue('mL');
 fireEvent.click(screen.getByRole('button',{name:'+ Add component'}));
 fireEvent.change(screen.getAllByLabelText('Component')[3],{target:{value:'Remaining result effect'}});
 expect(screen.getAllByLabelText('Input unit')[3]).toHaveValue('g/mL');
 screen.getAllByLabelText('Uncertainty value or bound').forEach(field=>fireEvent.change(field,{target:{value:'.1'}}));
 fireEvent.click(screen.getByRole('button',{name:'Calculate budget'}));
 await screen.findByText('Measurement report');
 const sent=JSON.parse(request.mock.calls[0][1].body);
 expect(sent.measurement_model.additional_targets).toEqual([1,-1]);
 expect(sent.components.map((item:{sensitivity:number})=>item.sensitivity)).toEqual([.5,-2.5,-2.5,1]);
 fireEvent.click(screen.getAllByRole('button',{name:'Remove component'})[0]);
 expect(screen.getAllByLabelText('Component')).toHaveLength(3);
 expect(screen.getAllByLabelText('Component')[2]).toHaveValue('Remaining result effect');
 expect(screen.queryByText('Measurement report')).not.toBeInTheDocument();
});

it('retains added component targets when opening a preset project and translates its controls',async()=>{
 const page=render(<GumBudget en parseNumber={Number}/>);
 const row={name:'Mass',source:'Lab record',unit:'g',u:'.1',c:'999',kind:'standard',divisor:'2'};
 const project={format:'artin-gum',version:1,savedAt:'2026-11-04',template:'density',rows:[row,row,{...row,name:'Extra mass',target:0}],inputs:{mass:'10',volume:'2'},gcData:{},familyData:[],correlations:[]};
 const file=new File([],'project.json',{type:'application/json'});
 Object.defineProperty(file,'text',{value:async()=>JSON.stringify(project)});
 fireEvent.change(screen.getByLabelText('Open project'),{target:{files:[file]}});
 await screen.findByText('Project loaded. Recalculate to verify its result.');
 expect(screen.getByLabelText('Where does this additional effect act?')).toHaveValue('0');
 expect(screen.getAllByLabelText('Component')[2]).toHaveValue('Extra mass');
 page.rerender(<GumBudget en={false} parseNumber={Number}/>);
 expect(screen.getByLabelText('این اثر اضافی به کدام بخش مربوط است؟')).toHaveValue('0');
 expect(screen.getByRole('button',{name:'+ افزودن مؤلفه'})).toBeInTheDocument();
});

it.each(['standard','titration'])('keeps custom components when loading %s reference values',(template)=>{
 render(<GumBudget en parseNumber={Number}/>);
 fireEvent.change(screen.getByLabelText('Select test or method'),{target:{value:template}});
 fireEvent.click(screen.getByRole('button',{name:'+ Add component'}));
 fireEvent.change(screen.getAllByLabelText('Component').at(-1)!,{target:{value:'Documented extra'}});
 fireEvent.change(screen.getAllByLabelText('Uncertainty value or bound').at(-1)!,{target:{value:'.07'}});
 fireEvent.click(screen.getByRole('button',{name:`Load Eurachem ${template==='standard'?'A1':'A2'} reference values`}));
 expect(screen.getAllByLabelText('Component').at(-1)).toHaveValue('Documented extra');
 expect(screen.getAllByLabelText('Uncertainty value or bound').at(-1)).toHaveValue('.07');
 expect(screen.getAllByLabelText('What value do you have?').at(-1)).toHaveValue('standard');
});

it('requires documented degrees, uses study size separately from n, and displays server-computed k',async()=>{
 request.mockClear();request.mockResolvedValue({ok:true,json:async()=>({coverage:2.306004135,coverage_method:'welch-satterthwaite',coverage_probability:.95,effective_degrees_of_freedom:8,coverage_t_degrees:8,standard_uncertainty:.3,expanded_uncertainty:.6918012405,engine:'artin-linear-gum',engine_version:'1',components:[{variance_percent:100}]})});
 const page=render(<GumBudget en parseNumber={Number}/>);
 fireEvent.change(screen.getByLabelText('Select test or method'),{target:{value:'general'}});
 fireEvent.change(screen.getByLabelText('Measured result y'),{target:{value:'10'}});
 fireEvent.change(screen.getByLabelText('Component'),{target:{value:'Repeatability study'}});
 fireEvent.change(screen.getByLabelText('What value do you have?'),{target:{value:'repeatability'}});
 fireEvent.change(screen.getByLabelText('Number averaged in result n (1 for a single reading)'),{target:{value:'1'}});
 fireEvent.change(screen.getByLabelText('Uncertainty value or bound'),{target:{value:'.3'}});
 fireEvent.change(screen.getByLabelText('How should the coverage factor be determined?'),{target:{value:'automatic'}});
 fireEvent.click(screen.getByRole('button',{name:'Calculate budget'}));
 expect(request).not.toHaveBeenCalled();
 expect(screen.getByRole('alert')).toHaveTextContent('choose the source of degrees of freedom');
 fireEvent.change(screen.getByLabelText('Degrees of freedom source'),{target:{value:'study'}});
 fireEvent.change(screen.getByLabelText('Readings in the study used to estimate s'),{target:{value:'9'}});
 fireEvent.click(screen.getByRole('button',{name:'Calculate budget'}));
 await screen.findByText(/Approximate Student’s t coverage/);
 expect(screen.getByLabelText('Coverage factor k')).toHaveValue('2.306004135');
 const sent=JSON.parse(request.mock.calls[0][1].body);
 expect(sent.coverage_mode).toBe('automatic');
 expect(sent.components[0]).toMatchObject({repetitions:1,study_count:9});
 page.rerender(<GumBudget en={false} parseNumber={Number}/>);
 expect(screen.getByLabelText('ضریب پوشش چطور تعیین شود؟')).toHaveValue('automatic');
 expect(screen.getByLabelText('تعداد قرائت‌های مطالعه برای برآورد s')).toHaveValue('9');
});

it("restores a saved budget and recalculates using its signed inputs", async () => {
  request.mockClear();
  request.mockResolvedValue({ ok: true, json: async () => ({
    standard_uncertainty: .05, expanded_uncertainty: .1, engine: "artin-linear-gum", engine_version: "1",
    components: [{ variance_percent: 100 }],
  }) });
  render(<GumBudget en parseNumber={Number} />);
  const project = {
    format: "artin-gum", version: 1, savedAt: "2026-11-04T00:00:00Z", template: "general",
    rows: [{ name: "Loaded certificate", source: "ABC", unit: "g", u: ".1", c: "-1", kind: "certificate", divisor: "2" }],
    inputs: { result: "10", unit: "g", coverage: "2", model: "y = x" },
    gcData: {}, familyData: [], correlations: [],
  };
  const file = new File([], "project.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => JSON.stringify(project) });
  fireEvent.change(screen.getByLabelText("Open project"), { target: { files: [file] } });
  await screen.findByText("Project loaded. Recalculate to verify its result.");
  expect(screen.getByLabelText("Sensitivity cᵢ")).toHaveValue("-1");
  fireEvent.click(screen.getByRole("button", { name: "Calculate budget" }));
  await screen.findByText("10 ± 0.1 g (k = 2)");
  expect(JSON.parse(request.mock.calls[0][1].body).components[0].sensitivity).toBe(-1);
});

it("requests Monte Carlo and shows its interval and histogram", async () => {
  request.mockClear();
  request.mockResolvedValue({ ok: true, json: async () => ({
    standard_uncertainty: .05, expanded_uncertainty: .1, engine: "artin-linear-gum", engine_version: "1",
    components: [{ variance_percent: 100 }],
    simulation: { engine: "numpy-linear-mc", engine_version: "test", samples: 20000, seed: 12345,
      probability: .95, mean: 10, standard_uncertainty: .05, lower: 9.902, upper: 10.098,
      histogram: [{ offset: -.1, count: 10000 }, { offset: .1, count: 10000 }] },
  }) });
  render(<GumBudget en parseNumber={Number} />);
  fireEvent.change(screen.getByLabelText("Select test or method"), { target: { value: "general" } });
  fireEvent.change(screen.getByLabelText("Measured result y"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText("Component"), { target: { value: "Calibration" } });
  fireEvent.change(screen.getByLabelText("Uncertainty value or bound"), { target: { value: ".05" } });
  fireEvent.click(screen.getByLabelText("Compare with Monte Carlo"));
  fireEvent.click(screen.getByRole("button", { name: "Calculate budget" }));
  await screen.findByRole("img", { name: "Simulated output histogram" });
  expect(JSON.parse(request.mock.calls[0][1].body).simulation).toEqual({ samples: 20000, seed: 12345, probability: .95 });
});

it("uses the full density equation for Monte Carlo when the density template is selected", async () => {
  request.mockClear();
  request.mockResolvedValue({ ok: true, json: async () => ({
    standard_uncertainty: .23, expanded_uncertainty: .46, engine: "artin-linear-gum", engine_version: "1",
    components: [{ variance_percent: 0 }, { variance_percent: 100 }],
    simulation: { engine: "numpy-model-mc", engine_version: "test", model: "density",
      samples: 20000, seed: 12345, probability: .95, mean: 1.06, standard_uncertainty: .26,
      lower: .72, upper: 1.61, histogram: [{ offset: -.2, count: 10000 }, { offset: .2, count: 10000 }] },
  }) });
  render(<GumBudget en parseNumber={Number} />);
  fireEvent.change(screen.getByLabelText("Select test or method"), { target: { value: "density" } });
  fireEvent.change(screen.getByLabelText("Sample mass (g)"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Sample volume (mL)"), { target: { value: "1" } });
  const inputs = screen.getAllByLabelText("Uncertainty value or bound");
  fireEvent.change(inputs[0], { target: { value: "0" } });
  fireEvent.change(inputs[1], { target: { value: ".4" } });
  fireEvent.change(screen.getAllByLabelText("What value do you have?")[1], { target: { value: "rectangular" } });
  fireEvent.click(screen.getByLabelText("Compare with Monte Carlo"));
  fireEvent.click(screen.getByRole("button", { name: "Calculate budget" }));
  await screen.findByText("Monte Carlo · full measurement model");
  expect(JSON.parse(request.mock.calls[0][1].body).measurement_model).toEqual({ kind: "density", nominals: [1, 1] });
});

it("explains missing density inputs instead of displaying a non-finite sensitivity", () => {
  render(<GumBudget en parseNumber={value => value.trim() ? Number(value) : NaN} />);
  fireEvent.change(screen.getByLabelText("Select test or method"), { target: { value: "density" } });
  expect(screen.getAllByText(/Enter measurement inputs first/)).toHaveLength(2);
  expect(screen.queryByText(/cᵢ = NaN/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Sample mass (g)"), { target: { value: "50" } });
  fireEvent.change(screen.getByLabelText("Sample volume (mL)"), { target: { value: "50" } });
  expect(screen.queryByText(/Enter measurement inputs first/)).not.toBeInTheDocument();
  expect(screen.getByText(/cᵢ = -0.02/)).toBeInTheDocument();
});

it.each([
  ["standard", "Load Eurachem A1 reference values", "Final solution volume (mL)", "Enter a positive final solution volume in mL."],
  ["titration", "Load Eurachem A2 reference values", "NaOH titration volume (mL)", "Enter a positive NaOH titration volume in mL."],
])("identifies invalid volume and purity before requesting a %s budget", (template, load, volumeLabel, message) => {
  request.mockClear();
  render(<GumBudget en parseNumber={value => value.trim() ? Number(value) : NaN} />);
  fireEvent.change(screen.getByLabelText("Select test or method"), { target: { value: template } });
  fireEvent.click(screen.getByRole("button", { name: load }));
  fireEvent.change(screen.getByLabelText(volumeLabel), { target: { value: "0" } });
  fireEvent.change(screen.getByLabelText("Purity (%)"), { target: { value: "101" } });
  fireEvent.click(screen.getByRole("button", { name: "Calculate budget" }));
  expect(screen.getByRole("alert")).toHaveTextContent(message);
  expect(screen.getByRole("alert")).toHaveTextContent("Enter purity as a percentage");
  expect(request).not.toHaveBeenCalled();
  expect(screen.queryByText("Measurement report")).not.toBeInTheDocument();
});
