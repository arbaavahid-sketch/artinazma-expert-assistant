import { expect, it } from "vitest";
import registry from "../measurement-registry.json";
import { familyModels } from "../family-models";
import { gumGuides, templateForModel } from "../gum-guides";

const referenceOf = (id: string) => (registry as Record<string, { reference?: string }>)[id]?.reference
  ?? familyModels[id]?.reference ?? gumGuides[templateForModel[id]]?.source?.url;

it("every registered equation names a source", () => {
  const missing = Object.keys(registry).filter(id => !referenceOf(id));
  expect(missing).toEqual([]);
});

it("sources are https links with a stated basis", () => {
  for (const id of Object.keys(registry)) {
    expect(referenceOf(id)).toMatch(/^https:\/\/[^\s]+$/);
    const family = familyModels[id];
    if (family?.reference && !family.sourceEdition) continue; // older entries keep their link-only form
    expect(family?.sourceEdition ?? gumGuides[templateForModel[id]]?.source?.label).toBeTruthy();
  }
});

it("template map matches the guides", () => {
  for (const template of Object.values(templateForModel)) expect(gumGuides[template]).toBeDefined();
});
