export function readMethodRecord(value:unknown,methodId:number) {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new Error("Invalid record");
  const record=value as Record<string,unknown>;
  if(record.format!=="artin-method-record"||record.version!==1||record.methodId!==methodId) throw new Error("Wrong method or version");
  const fields=["sop","outcome","evidence"] as const;
  fields.forEach(key=>{if(typeof record[key]!=="string"||(record[key] as string).length>5000) throw new Error("Invalid field");});
  return {sop:record.sop as string,outcome:record.outcome as string,evidence:record.evidence as string};
}
