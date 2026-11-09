import {expect,it} from "vitest";
import {budgetCsv} from "../budget-export";
it("preserves numbers and protects text labels from spreadsheet formula execution",()=>{
 const csv=budgetCsv([["=HYPERLINK(\"x\")",-1,"source, note", "line\nnext"," @SUM(1)"]]);
 expect(csv).toContain('"\'=HYPERLINK(""x"")"');
 expect(csv).toContain('"-1"');
 expect(csv).toContain('"source, note"');
 expect(csv).toContain('"\' @SUM(1)"');
});
