import React from 'react';
import {it,expect} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {elementMetadata} from './calculators/workspace/element-library';
import {elementReferences,propertyReferences} from './calculators/workspace/element-provenance';
import ElementProvenance from './calculators/workspace/ElementProvenance';
it('resolves every nonempty supplier citation and excludes unrelated ionic-radii data',()=>{for(const p of elementMetadata.properties){expect(p.table_name).not.toBe('ionicradii');for(const key of (p.citation_keys??'').split(',').filter(Boolean))expect(elementReferences[key]).toBeDefined();}expect(propertyReferences('elements','electronegativity_pauling')[0].key).toBe('haynes2014crc');expect(propertyReferences('isotopes','mass_number')[0].key).toBe('iupac-masses');expect(propertyReferences('elements','econf')).toEqual([]);});
it('presents human-readable linked references and missing provenance in both languages',()=>{const view=render(<ElementProvenance en/>);fireEvent.click(screen.getByText('Source and data metadata'));expect(screen.getAllByRole('link',{name:'NUBASE2020 (2021)'})[0]).toHaveAttribute('href','https://doi.org/10.1088/1674-1137/abddae');expect(screen.getAllByText('No separate citation in the metadata').length).toBeGreaterThan(0);expect(screen.getByText(/Relative atomic weight is dimensionless/)).toBeVisible();view.rerender(<ElementProvenance en={false}/>);expect(screen.getByText(/به معنی به‌روزرسانی عدد ذخیره‌شده نیست/)).toBeVisible();});
