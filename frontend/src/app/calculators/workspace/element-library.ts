import data from './element-data.json';
export type ElementRecord=(typeof data.elements)[number];
export type IsotopeRecord={mass_number:number;mass:number|null;mass_uncertainty:number|null;abundance:number|null;abundance_uncertainty:number|null;is_radioactive:boolean|null;half_life:number|null;half_life_unit:string|null;half_life_uncertainty:number|null;spin:string|null};
export const elements=data.elements;
export const elementMetadata=data.metadata;
export const families=[['نافلزها','Nonmetals'],['گازهای نجیب','Noble gases'],['فلزهای قلیایی','Alkali metals'],['فلزهای قلیایی خاکی','Alkaline earth metals'],['شبه‌فلزها','Metalloids'],['هالوژن‌ها','Halogens'],['دیگر فلزها','Other metals'],['فلزهای واسطه','Transition metals'],['لانتانیدها','Lanthanides'],['اکتینیدها','Actinides']];
export function normalizeElementQuery(value:string){return value.normalize('NFKC').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/آ/g,'ا').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[\s\u200c\u200e\u200f]/g,'').toLowerCase();}
const aliases:Record<string,number>={'الومینیوم':13,'سیلیسیوم':14,'تیتانیوم':22,'اورانیوم':92,'ید':53,'گوگرد':16,'اهن':26,'طلا':79,'جیوه':80,'قلع':50,'سرب':82};
export function findElements(query:string){const q=normalizeElementQuery(query);if(!q)return elements;
 if(/^\d+$/.test(q))return elements.filter(e=>e.atomic_number===Number(q));
 const exact=elements.find(e=>e.symbol.toLowerCase()===q);if(exact)return [exact];
 return elements.filter(e=>e.atomic_number===aliases[q]||[e.fa,e.name,e.symbol].some(v=>normalizeElementQuery(v).includes(q)));
}
export function elementPosition(z:number,period:number,group:number|null){
 if(z>=57&&z<=71)return {row:9,column:z-57+3};
 if(z>=89&&z<=103)return {row:10,column:z-89+3};
 return {row:period,column:group??3};
}
export function isotopeValue(value:number|null,uncertainty:number|null=null){
 if(value===null)return null;
 const format=(n:number)=>String(Number(n.toPrecision(12)));
 return uncertainty===null?format(value):`${format(value)} ± ${format(uncertainty)}`;
}
