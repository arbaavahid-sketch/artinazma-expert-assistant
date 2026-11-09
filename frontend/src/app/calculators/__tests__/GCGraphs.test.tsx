import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import GCGraphs from "../GCGraphs";

it("fits real entered standards and exports parameter uncertainty and correlation", () => {
  const apply = vi.fn();
  render(<GCGraphs en onCalibration={apply} />);
  fireEvent.change(screen.getByLabelText("Standards: concentration (mg/L), peak area; one pair per line"),
    { target: { value: "0 10\n5 61\n10 109\n15 161" } });
  fireEvent.click(screen.getByRole("button", { name: "Use fit and slope–intercept correlation" }));
  expect(apply).toHaveBeenCalledTimes(1);
  const [slope, intercept, us, ub, correlation] = apply.mock.calls[0];
  expect(slope).toBeCloseTo(10.02);
  expect(intercept).toBeCloseTo(10.1);
  expect(us).toBeGreaterThan(0);
  expect(ub).toBeGreaterThan(0);
  expect(correlation).toBeLessThan(0);
  expect(screen.getByRole("img", { name: "Calibration graph" })).toBeInTheDocument();
});

it("plots uploaded time-signal data without fabricating peak identity", async () => {
  render(<GCGraphs en onCalibration={vi.fn()} />);
  const file = new File(["time,signal\n0,1\n1,5\n2,1"], "trace.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", { value: async () => "time,signal\n0,1\n1,5\n2,1" });
  fireEvent.change(screen.getByLabelText("Chromatogram: time, signal (CSV/TXT, up to 10,000 points)"),
    { target: { files: [file] } });
  expect(await screen.findByRole("img", { name: "Imported chromatogram" })).toBeInTheDocument();
});

it("accepts Persian and Arabic digits and decimal marks in standards", () => {
  const apply = vi.fn();
  render(<GCGraphs en onCalibration={apply} />);
  fireEvent.change(screen.getByLabelText("Standards: concentration (mg/L), peak area; one pair per line"),
    { target: { value: "۰ ۱۰\n٥ ۶۱\n۱۰ ۱۰۹\n۱۵٫۰ ۱۶۱" } });
  fireEvent.click(screen.getByRole("button", { name: "Use fit and slope–intercept correlation" }));
  expect(apply.mock.calls[0][0]).toBeCloseTo(10.02);
});

it("builds calibration pairs using separate labelled concentration and peak-area fields",()=>{
 const apply=vi.fn();render(<GCGraphs en onCalibration={apply}/>);
 [[0,10],[5,61],[10,109]].forEach(([c,a],index)=>{
  fireEvent.change(screen.getByLabelText(`Standard ${index+1} concentration`),{target:{value:String(c)}});
  fireEvent.change(screen.getByLabelText(`Standard ${index+1} peak area`),{target:{value:String(a)}});
 });
 fireEvent.click(screen.getByRole('button',{name:'Use fit and slope–intercept correlation'}));
 expect(apply.mock.calls[0][0]).toBeCloseTo(9.9);
});

it.each(["0,broken", "NaN,1", "0x10,2"])("does not discard a malformed first data row: %s", async first => {
  render(<GCGraphs en onCalibration={vi.fn()} />);
  const file = new File([], "trace.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", { value: async () => `${first}\n1,5\n2,1` });
  fireEvent.change(screen.getByLabelText("Chromatogram: time, signal (CSV/TXT, up to 10,000 points)"),
    { target: { files: [file] } });
  expect(await screen.findByRole("alert")).toHaveTextContent("Check the two numeric columns");
  expect(screen.queryByRole("img", { name: "Imported chromatogram" })).not.toBeInTheDocument();
});
