import saved from '../../calculators/workspace/chemical-library.json';
import {compoundCatalog} from '../../calculators/workspace/compound-catalog';

// Exact names only: do not confuse ethylene with ethylene glycol or other derivatives.
export const normalizePersianName = (name:string) => name.normalize('NFKC')
  .replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u064b-\u065f\u0670ـ]/g,'')
  .replace(/[\s\u200c-\u200f]+/g,'').toLowerCase();
const names = new Map<string,string>([
  ['اتیلن','ethylene'],['اتن','ethene'],['اتیلن گلیکول','ethylene glycol'],
  ['پروپیلن','propylene'],['پروپن','propene'],['متان','methane'],['اتان','ethane'],
  ['پروپان','propane'],['بنزن','benzene'],['تولوئن','toluene'],['کافئین','caffeine'],
].map(([fa,en])=>[normalizePersianName(fa),en]));
for(const record of saved.records){
  for(const alias of [record.fa,...record.aliases]){
    if(/[\u0600-\u06ff]/.test(alias)) names.set(normalizePersianName(alias),record.iupac);
  }
}
for(const record of compoundCatalog)names.set(normalizePersianName(record.fa),record.en);
export function resolvePersianName(name:string){return names.get(normalizePersianName(name));}
