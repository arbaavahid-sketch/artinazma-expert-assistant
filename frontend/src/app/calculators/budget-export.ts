export function budgetCsv(rows: (string | number)[][]) {
  return "\uFEFF"+rows.map(row=>row.map(value=>{
    let text=String(value);
    // User labels and source descriptions must not become spreadsheet formulas.
    if(typeof value==="string" && /^[\s\u0000-\u001f]*[=+@-]/.test(text))text="'"+text;
    return `"${text.replaceAll('"','""')}"`;
  }).join(",")).join("\r\n");
}
