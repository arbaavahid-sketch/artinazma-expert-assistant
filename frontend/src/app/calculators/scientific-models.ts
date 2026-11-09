import type {FamilyModel} from "./family-models";
import {measurementRegistry,evaluateRegisteredModel} from "./registered-models";
export const scientificModels:Record<string,FamilyModel>=Object.fromEntries(Object.entries(measurementRegistry).filter(([,model])=>model.special).map(([key,model])=>[key,{
  fa:model.fa!,en:model.en!,formula:model.formula!,unit:model.unit!,inputs:model.inputs!,example:model.example!,explanation:model.explanation!,reference:model.reference!,sourceEdition:model.source_edition,
  evaluate:(values:number[])=>evaluateRegisteredModel(key,values),
}]));
