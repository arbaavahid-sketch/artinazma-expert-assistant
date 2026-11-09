import React from 'react';
import {it,expect,vi,beforeEach} from 'vitest';
import {render,screen} from '@testing-library/react';
import MoleculeViewer from './calculators/workspace/MoleculeViewer';
beforeEach(()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({} as CanvasRenderingContext2D);
 vi.stubGlobal('ResizeObserver',class{observe(){} disconnect(){}});
});
it.each([[false,[7,7]],[true,[6,8,1]]] as const)('hydrogen control follows source atoms: %s',async(hasHydrogens,elements)=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({molecule:{atoms:elements.map((element,i)=>({id:i+1,element})),bonds:[],conformers:[elements.map((_,i)=>({x:i,y:0,z:0}))]}}))));
 render(<MoleculeViewer cid={887} en/>);
 const control=await screen.findByRole('checkbox',{name:'Show hydrogens'});
 if(hasHydrogens){expect(control).toBeEnabled();expect(control).toBeChecked();}
 else{expect(control).toBeDisabled();expect(control).not.toBeChecked();}
});
it('shows a missing-data state without generating replacement coordinates',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:404})));
 render(<MoleculeViewer cid={5234} en/>);
 expect(await screen.findByText(/No displayable 3D coordinates/)).toBeVisible();
 expect(screen.queryByRole('img')).toBeNull();
});
