import React from 'react';
import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import StructureAnalysis from './calculators/workspace/StructureAnalysis';
it('keeps computed molar and exact masses separate and retains the input provenance',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({engine:'RDKit',engineVersion:'2026.09.1',formula:'CH4O',molarMass:32.042,exactMass:32.026214748,atomCount:6,heavyAtomCount:2,hydrogenCount:4,formalCharge:0,fragmentCount:1,svg:'<svg xmlns="http://www.w3.org/2000/svg"/>',inputSmiles:'CO',canonicalSmiles:'CO',sourceUrl:'https://pubchem.ncbi.nlm.nih.gov/compound/887',retrievedOn:'2026-11-05'}))));
 render(<StructureAnalysis cid={887} en/>);
 expect(await screen.findByText('32.04200 g/mol')).toBeVisible();expect(screen.getByText('32.02621475 Da')).toBeVisible();
 expect(screen.getByText(/do not automatically replace solution inputs/)).toBeVisible();
 fireEvent.click(screen.getByText('Input structure, method and source'));
 expect(screen.getByRole('link',{name:'Structure source at PubChem ↗'})).toHaveAttribute('href','https://pubchem.ncbi.nlm.nih.gov/compound/887');
});
it('explains unsupported source structures without displaying successful calculations',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:422})));
 render(<StructureAnalysis cid={887} en/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('unsupported');expect(screen.queryByRole('img')).toBeNull();
});
