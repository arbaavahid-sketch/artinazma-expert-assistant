"""Repository-owned equations, vectorized sampling and forward-mode derivatives.

User expressions are never parsed or executed. Clients select a fixed key.
"""
import json
import math
from pathlib import Path
import numpy as np

_ROOT=Path(__file__).resolve().parent
MODEL_REGISTRY=json.loads((_ROOT/"measurement_model_registry.json").read_text(encoding="utf-8"))
VI_REFERENCE=json.loads((_ROOT/"viscosity_index_reference.json").read_text(encoding="utf-8"))

class Dual:
    def __init__(self,value,gradient):
        self.value=float(value)
        self.gradient=np.asarray(gradient,dtype=float)
    def coerce(self,other):return other if isinstance(other,Dual) else Dual(other,np.zeros_like(self.gradient))
    def __add__(self,other):
        other=self.coerce(other)
        return Dual(self.value+other.value,self.gradient+other.gradient)
    __radd__=__add__
    def __neg__(self):return Dual(-self.value,-self.gradient)
    def __sub__(self,other):return self+-self.coerce(other)
    def __rsub__(self,other):return self.coerce(other)+-self
    def __mul__(self,other):
        other=self.coerce(other)
        return Dual(self.value*other.value,self.gradient*other.value+other.gradient*self.value)
    __rmul__=__mul__
    def __truediv__(self,other):
        other=self.coerce(other)
        return Dual(self.value/other.value,(self.gradient-other.gradient*self.value/other.value)/other.value)
    def __rtruediv__(self,other):return self.coerce(other)/self
    def __pow__(self,other):
        other=self.coerce(other)
        value=self.value**other.value
        if np.all(other.gradient==0):
            gradient=other.value*self.value**(other.value-1)*self.gradient if other.value else np.zeros_like(self.gradient)
        else:
            gradient=value*(other.gradient*math.log(self.value)+other.value*self.gradient/self.value)
        return Dual(value,gradient)
    def __rpow__(self,other):return self.coerce(other)**self

def value_of(v):return v.value if isinstance(v,Dual) else v

def interpolate(which,y):
    values=np.asarray(VI_REFERENCE["VI_Ls" if which=="L" else "VI_Hs"])
    grid=np.asarray(VI_REFERENCE["VI_nus"])
    raw=value_of(y)
    if isinstance(y,Dual):
        if raw>70:
            return (.8353*y*y+14.67*y-216) if which=="L" else (.1684*y*y+11.85*y-97)
        index=int(np.clip(np.searchsorted(grid,raw,side="right")-1,0,len(grid)-2))
        slope=(values[index+1]-values[index])/(grid[index+1]-grid[index])
        return Dual(float(np.interp(raw,grid,values)),slope*y.gradient)
    polynomial=(.8353*raw**2+14.67*raw-216) if which=="L" else (.1684*raw**2+11.85*raw-97)
    return np.where(np.asarray(raw)>70,polynomial,np.interp(raw,grid,values))

def evaluate_tree(tree,inputs):
    if isinstance(tree,(int,float)):
        return tree
    op=tree[0]
    if op=="x":
        return inputs[tree[1]]
    if op=="interp":
        return interpolate(tree[1],evaluate_tree(tree[2],inputs))
    if op=="if":
        test=evaluate_tree(tree[1],inputs)
        if np.ndim(test)==0:
            return evaluate_tree(tree[2] if test else tree[3],inputs)
        return np.where(test,evaluate_tree(tree[2],inputs),evaluate_tree(tree[3],inputs))
    args=[evaluate_tree(item,inputs) for item in tree[1:]]
    if op=="add":
        return sum(args)
    if op=="mul":
        result=1
        for arg in args:
            result=result*arg
        return result
    if op=="sub":
        return args[0]-args[1]
    if op=="div":
        return args[0]/args[1]
    if op=="pow":
        return args[0]**args[1]
    if op=="exp":
        arg=args[0]
        return Dual(math.exp(arg.value),math.exp(arg.value)*arg.gradient) if isinstance(arg,Dual) else np.exp(arg)
    if op=="log":
        arg=args[0]
        return Dual(math.log(arg.value),arg.gradient/arg.value) if isinstance(arg,Dual) else np.log(arg)
    left,right=map(value_of,args)
    if op=="gt":
        return left>right
    if op=="ge":
        return left>=right
    if op=="le":
        return left<=right
    if op=="ne":
        return left!=right
    raise ValueError("Unknown registered operation")

def model_definition(kind):
    if kind not in MODEL_REGISTRY:
        raise ValueError("Unknown registered measurement model")
    return MODEL_REGISTRY[kind]

def check_constraints(definition,inputs,key):
    for constraint in definition[key]:
        if not np.all(evaluate_tree(constraint,inputs)):
            if key=="sample_constraints":
                raise ValueError("Simulation crossed the registered model domain")
            raise ValueError("Inputs are outside the registered model applicability domain")

def model_at_nominal(kind,values):
    definition=model_definition(kind)
    n=definition["input_count"]
    if len(values)!=n or not all(math.isfinite(v) for v in values):
        raise ValueError("Input count does not match registered model")
    check_constraints(definition,values,"nominal_constraints")
    inputs=[Dual(value,np.eye(n)[index]) for index,value in enumerate(values)]
    answer=evaluate_tree(definition["expression"],inputs)
    if not isinstance(answer,Dual):
        answer=Dual(answer,np.zeros(n))
    indices=definition.get("uncertain_indices",list(range(n)))
    sensitivities=[float(answer.gradient[index]) for index in indices]+[1.]*definition["extra_count"]
    if not math.isfinite(answer.value) or not all(math.isfinite(v) for v in sensitivities):
        raise ValueError("Model exceeds the supported numeric range")
    return answer.value,sensitivities

def evaluate_model_samples(kind,samples,nominals=None,with_diagnostics=False):
    definition=model_definition(kind)
    n=definition["input_count"]
    if nominals is None:
        if samples.shape[1]!=n+definition["extra_count"]:
            raise ValueError("Sample input count does not match model")
        physical=samples[:,:n]
        extra=samples[:,n:]
    else:
        indices=definition.get("uncertain_indices",list(range(n)))
        if samples.shape[1]!=len(indices)+definition["extra_count"]:
            raise ValueError("Sample input count does not match model")
        physical=np.broadcast_to(np.asarray(nominals,dtype=float),(len(samples),n)).copy()
        physical[:,indices]+=samples[:,:len(indices)]
        extra=samples[:,len(indices):]
    columns=[physical[:,index] for index in range(n)]
    check_constraints(definition,columns,"sample_constraints")
    answer=np.asarray(evaluate_tree(definition["expression"],columns))+np.sum(extra,axis=1)
    if with_diagnostics:
        applicable=np.ones(len(samples),dtype=bool)
        for constraint in definition['nominal_constraints']:
            applicable &= evaluate_tree(constraint,columns)
        return answer,int(np.count_nonzero(~applicable))
    return answer
