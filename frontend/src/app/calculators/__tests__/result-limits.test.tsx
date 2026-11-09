import {render,screen,fireEvent} from "@testing-library/react";
import {expect,it,vi} from "vitest";
import {compareLimits} from "../result-limits";
import GumBudget from "../GumBudget";
const request=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/api",()=>({apiUrl:(path:string)=>path,customerFetch:request}));

it.each([
 [9,'10','20','below'],[21,'10','20','above'],[10,'10','20','within'],[20,'10','20','within'],
 [-2,'-1','','below'],[0,'0','','within'],[2,'','1','above'],[NaN,'0','','unavailable'],
 [1,'','','none'],[1,'2','1','invalid'],[1,'abc','','invalid'],[1,'Infinity','','invalid'],
] as const)('compares %s with entered limits',(value,min,max,status)=>expect(compareLimits(value,min,max,Number)).toBe(status));

it('recolors a calculated GUM result immediately without recalculating the budget',async()=>{
 request.mockClear();request.mockResolvedValue({ok:true,json:async()=>({standard_uncertainty:.05,expanded_uncertainty:.1,engine:'artin-linear-gum',engine_version:'1',components:[{variance_percent:100}]})});
 render(<GumBudget en parseNumber={value=>value.trim()?Number(value):NaN}/>);
 fireEvent.change(screen.getByLabelText('Select test or method'),{target:{value:'general'}});
 fireEvent.change(screen.getByLabelText('Measured result y'),{target:{value:'10'}});
 fireEvent.change(screen.getByLabelText('Component'),{target:{value:'Certificate'}});
 fireEvent.change(screen.getByLabelText('Uncertainty value or bound'),{target:{value:'.05'}});
 fireEvent.click(screen.getByRole('button',{name:'Calculate budget'}));
 const result=await screen.findByText('10 ± 0.1 (k = 2)');
 fireEvent.change(screen.getByLabelText('Minimum acceptable result'),{target:{value:'11'}});
 expect(result.parentElement).toHaveClass('text-[var(--color-danger-text)]');
 expect(screen.getAllByText('Below the minimum')).toHaveLength(2);
 expect(request).toHaveBeenCalledTimes(1);
 fireEvent.change(screen.getByLabelText('Minimum acceptable result'),{target:{value:'10'}});
 expect(result.parentElement).not.toHaveClass('text-[var(--color-danger-text)]');
 expect(screen.getAllByText('Within the entered limits')).toHaveLength(2);
});
