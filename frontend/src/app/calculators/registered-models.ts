import registryData from "./measurement-registry.json";
import reference from "./viscosity-index-reference.json";
export type Bilingual={fa:string;en:string};
export type RegisteredDefinition={input_count:number;extra_count:number;uncertain_indices?:number[];expression:unknown;nominal_constraints:unknown[];sample_constraints:unknown[];special?:boolean;fa?:string;en?:string;formula?:string;unit?:string;example?:number[];explanation?:Bilingual;reference?:string;source_edition?:string;inputs?:{fa:string;en:string;unit:string;help:Bilingual}[]};
export const measurementRegistry=registryData as unknown as Record<string,RegisteredDefinition>;
type Dual={value:number;gradient:number[]};

export function evaluateRegisteredModel(kind:string,values:number[]) {
  const model=measurementRegistry[kind],n=model?.input_count??0;
  if(!model||values.length!==n||!values.every(Number.isFinite))return {value:NaN,sensitivities:Array(n).fill(NaN) as number[],valid:false};
  const constant=(value:number):Dual=>({value,gradient:Array(n).fill(0)});
  const inputs=values.map((value,i)=>({value,gradient:values.map((_,j)=>i===j?1:0)}));
  function evaluate(tree:unknown):Dual {
    if(typeof tree==='number')return constant(tree);
    const t=tree as unknown[],op=t[0] as string;
    if(op==='x')return inputs[t[1] as number];
    if(op==='if')return evaluate(evaluate(t[1]).value?t[2]:t[3]);
    if(op==='interp') {
      const arg=evaluate(t[2]),y=arg.value,which=t[1];
      if(y>70){const a=which==='L'?.8353:.1684,b=which==='L'?14.67:11.85,c=which==='L'?-216:-97;return {value:a*y*y+b*y+c,gradient:arg.gradient.map(g=>(2*a*y+b)*g)};}
      const grid=reference.VI_nus,data=which==='L'?reference.VI_Ls:reference.VI_Hs;
      let index=0;while(index<grid.length-2&&grid[index+1]<=y)index++;
      const slope=(data[index+1]-data[index])/(grid[index+1]-grid[index]);
      return {value:data[index]+slope*(y-grid[index]),gradient:arg.gradient.map(g=>g*slope)};
    }
    const args=t.slice(1).map(evaluate),a=args[0],b=args[1];
    if(op==='add')return args.reduce((sum,v)=>({value:sum.value+v.value,gradient:sum.gradient.map((g,i)=>g+v.gradient[i])}),constant(0));
    if(op==='mul')return args.reduce((sum,v)=>({value:sum.value*v.value,gradient:sum.gradient.map((g,i)=>g*v.value+sum.value*v.gradient[i])}),constant(1));
    if(op==='sub')return {value:a.value-b.value,gradient:a.gradient.map((g,i)=>g-b.gradient[i])};
    if(op==='div')return {value:a.value/b.value,gradient:a.gradient.map((g,i)=>(g-b.gradient[i]*a.value/b.value)/b.value)};
    if(op==='pow'){
      const value=a.value**b.value;
      return {value,gradient:a.gradient.map((g,i)=>b.gradient.every(d=>d===0)?(b.value?b.value*a.value**(b.value-1)*g:0):value*(b.gradient[i]*Math.log(a.value)+b.value*g/a.value))};
    }
    if(op==='exp')return {value:Math.exp(a.value),gradient:a.gradient.map(g=>g*Math.exp(a.value))};
    if(op==='log')return {value:Math.log(a.value),gradient:a.gradient.map(g=>g/a.value)};
    if(op==='gt')return constant(Number(a.value>b.value));
    if(op==='ge')return constant(Number(a.value>=b.value));
    if(op==='le')return constant(Number(a.value<=b.value));
    if(op==='ne')return constant(Number(a.value!==b.value));
    throw new Error('Unknown fixed equation operation');
  }
  const answer=evaluate(model.expression);
  const indices=model.uncertain_indices??values.map((_,i)=>i);
  const sensitivities=indices.map(i=>answer.gradient[i]);
  return {value:answer.value,sensitivities,valid:Number.isFinite(answer.value)&&sensitivities.every(Number.isFinite)&&model.nominal_constraints.every(c=>Boolean(evaluate(c).value))};
}
