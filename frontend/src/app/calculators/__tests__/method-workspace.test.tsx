import {render,screen,fireEvent} from "@testing-library/react";
import {expect,it,vi} from "vitest";
import GumBudget from "../GumBudget";
import MethodReadiness from "../MethodReadiness";
import bank from "../method-bank.json";
import {familyModels} from "../family-models";
const request=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/api",()=>({apiUrl:(path:string)=>path,customerFetch:request}));

it.each(Object.entries(familyModels))("submits the complete %s base model with automatic sensitivities",async(key,model)=>{
 request.mockReset();
 request.mockResolvedValue({ok:true,json:async()=>({standard_uncertainty:.1,expanded_uncertainty:.2,engine:'artin-linear-gum',engine_version:'1',components:Array(model.inputs.length+2).fill({variance_percent:0})})});
 render(<GumBudget en parseNumber={value=>value.trim()?Number(value):NaN}/>);
 fireEvent.change(screen.getByLabelText('Select test or method'),{target:{value:`family:${key}`}});
 fireEvent.click(screen.getByRole('button',{name:'Load hypothetical measurement inputs'}));
 if(!model.unit)fireEvent.change(screen.getByLabelText('Result unit'),{target:{value:'mg/L'}});
 screen.getAllByLabelText('Uncertainty value or bound').forEach(input=>{
   fireEvent.change(input,{target:{value:'0.001'}});
 });
 fireEvent.click(screen.getByRole('button',{name:'Calculate budget'}));
 await screen.findByText('Measurement report');
 const payload=JSON.parse(request.mock.calls[0][1].body),result=model.evaluate(model.example!);
 expect(payload.measured).toBeCloseTo(result.value,8);
 expect(payload.components).toHaveLength(model.inputs.length+2);
 result.sensitivities.forEach((value,index)=>expect(payload.components[index].sensitivity).toBeCloseTo(value,8));
 if(!model.unit)expect(payload.components.at(-1).name).toBe('Other independent effects in result units');
});

it('provides a qualitative record without offering a numeric uncertainty calculation',()=>{
 render(<MethodReadiness method={bank[10]} en onOpen={vi.fn()}/>);
 expect(screen.getByText('Qualitative / ordinal')).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Open expert budget'})).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Save method record'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Actual SOP / standard edition'),{target:{value:'D130 SOP 1'}});
 fireEvent.change(screen.getByLabelText('Observed result or study objective'),{target:{value:'1a'}});
 expect(screen.getByRole('button',{name:'Save method record'})).toBeEnabled();
});

it('fills the standard number while leaving the actual edition and SOP optional',()=>{
 render(<GumBudget en parseNumber={Number}/>);
 fireEvent.click(screen.getByText('98-test method bank'));
 fireEvent.change(screen.getByLabelText('Test bank selection'),{target:{value:'1'}});
 fireEvent.click(screen.getByRole('button',{name:'Use model: Residue mass percentage'}));
 expect(screen.getByLabelText('Standard number from the test bank')).toHaveValue('ASTM D524');
 expect(screen.getByLabelText('Edition used by your laboratory (optional)')).toHaveValue('');
 expect(screen.getByLabelText('Laboratory SOP identifier and revision (optional)')).toHaveValue('');
 expect(screen.getByText(/They are not measurement inputs/)).toBeInTheDocument();
});

it('preserves current entries when a record belongs to a different test',async()=>{
 render(<MethodReadiness method={bank[10]} en onOpen={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('Observed result or study objective'),{target:{value:'1a'}});
 const file=new File([],'record.json');Object.defineProperty(file,'text',{value:async()=>JSON.stringify({format:'artin-method-record',version:1,methodId:24,sop:'D130',outcome:'4',evidence:''})});
 fireEvent.change(screen.getByLabelText('Open method record'),{target:{files:[file]}});
 await screen.findByText('Invalid record or different test. Current entries were kept.');
 expect(screen.getByLabelText('Observed result or study objective')).toHaveValue('1a');
});
