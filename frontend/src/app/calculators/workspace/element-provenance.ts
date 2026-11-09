import {elementMetadata} from './element-library';
export const elementReferences:Record<string,{title:string;url:string}>={
 Meija2016:{title:'Atomic weights of the elements 2013 (2016)',url:'https://doi.org/10.1515/pac-2015-0305'},
 'iupac-weights':{title:'CIAAW · Standard atomic weights',url:'https://ciaaw.org/atomic-weights.htm'},
 'iupac-masses':{title:'CIAAW · Atomic masses',url:'https://ciaaw.org/atomic-masses.htm'},
 Kondev2021:{title:'NUBASE2020 (2021)',url:'https://doi.org/10.1088/1674-1137/abddae'},
 haynes2014crc:{title:'CRC Handbook · 95th edition (2014)',url:'https://books.google.no/books?id=bNDMBQAAQBAJ'},
 'enwiki:1039678864':{title:'List of chemical elements · archived 2021 revision',url:'https://en.wikipedia.org/w/index.php?title=List_of_chemical_elements&oldid=1039678864'},
};
export function propertyReferences(table:string,field:string){const p=elementMetadata.properties.find(p=>p.table_name===table&&p.attribute_name===field);return (p?.citation_keys??'').split(',').map(k=>k.trim()).filter(Boolean).map(key=>({key,reference:elementReferences[key]}));}
export const propertyLabels:Record<string,[string,string]>={atomic_weight:['جرم اتمی گزارش‌شده','Reported atomic weight'],atomic_weight_uncertainty:['عدم‌قطعیت جرم اتمی','Atomic-weight uncertainty'],density:['چگالی','Density'],electronegativity_pauling:['الکترونگاتیوی پالینگ','Pauling electronegativity'],econf:['آرایش الکترونی','Electron configuration'],abundance:['فراوانی ایزوتوپی','Isotopic abundance'],abundance_uncertainty:['عدم‌قطعیت فراوانی','Abundance uncertainty'],mass:['جرم ایزوتوپی','Isotopic mass'],mass_uncertainty:['عدم‌قطعیت جرم ایزوتوپی','Isotopic mass uncertainty'],mass_number:['عدد جرمی','Mass number'],is_radioactive:['وضعیت پرتوزایی','Radioactivity status'],half_life:['نیمه‌عمر','Half-life'],half_life_uncertainty:['عدم‌قطعیت نیمه‌عمر','Half-life uncertainty'],half_life_unit:['واحد نیمه‌عمر','Half-life unit'],spin:['اسپین هسته‌ای','Nuclear spin']};
