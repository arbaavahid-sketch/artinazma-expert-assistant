import { expect, it } from "vitest";
import { readGumProject, type GumProject } from "../gum-project";

const project: GumProject = {
  format: "artin-gum", version: 1, savedAt: "2026-11-04T00:00:00Z", template: "general",
  rows: [{ name: "Calibration", source: "Certificate", unit: "g", u: "0.1", c: "-1", kind: "certificate", divisor: "2" }],
  inputs: { result: "10", unit: "g", coverage: "2" }, gcData: {}, familyData: [], correlations: [],
};

it("preserves inputs and signed sensitivity through a project round trip", () => {
  const restored = readGumProject(JSON.parse(JSON.stringify(project)));
  expect(restored).toEqual(project);
});

it("rejects invalid versions, component layouts and dangling correlations before loading", () => {
  expect(() => readGumProject({ ...project, version: 2 })).toThrow();
  expect(() => readGumProject({ ...project, template: "density" })).toThrow();
  expect(() => readGumProject({ ...project, correlations: [{ first: 0, second: 1, coefficient: ".5" }] })).toThrow();
  expect(() => readGumProject({ ...project, inputs: { result: { expression: "anything" } } })).toThrow();
});

it("keeps imported calibration and trace data with the budget", () => {
  const withGraphs = { ...project, graphs: { standards: "0 10\n5 61\n10 109", chromatogram: "0,1\n1,5\n2,1" } };
  expect(readGumProject(JSON.parse(JSON.stringify(withGraphs))).graphs).toEqual(withGraphs.graphs);
  expect(() => readGumProject({ ...project, graphs: { standards: 123, chromatogram: "" } })).toThrow();
});

it('preserves added input and result effects while rejecting invalid targets or missing core rows',()=>{
 const row=project.rows[0];
 const extended={...project,template:'density',rows:[row,row,{...row,name:'Volume calibration',target:1},{...row,name:'Result correction',target:-1}]};
 expect(readGumProject(JSON.parse(JSON.stringify(extended))).rows).toEqual(extended.rows);
 expect(()=>readGumProject({...extended,rows:[row,row,{...row,target:2}]})).toThrow();
 expect(()=>readGumProject({...extended,rows:[row,row,row]})).toThrow();
 expect(()=>readGumProject({...extended,rows:[{...row,target:0},row]})).toThrow();
});

it('round-trips coverage evidence and rejects unknown degrees-of-freedom modes',()=>{
 const saved={...project,inputs:{...project.inputs,coverageMode:'automatic',coverageProbability:'0.95'},rows:[{...project.rows[0],dfMode:'study',dfValue:'9'}]};
 expect(readGumProject(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
 expect(()=>readGumProject({...saved,rows:[{...saved.rows[0],dfMode:'invented'}]})).toThrow();
});
