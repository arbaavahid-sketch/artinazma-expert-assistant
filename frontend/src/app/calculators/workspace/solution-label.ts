import {reportFontCSS} from '@/lib/report-font';
import {calculateSolution,readSolutionDraft,type SolutionDraft} from './chemical-library';
import {calculateCommercial} from './commercial-solution';
import {dilutionPrintCSS} from './dilution-print';
export type PreparationKind='nominal'|'commercial';
export function solutionLabel(draft:SolutionDraft,kind:PreparationKind){
 const d=readSolutionDraft(draft),label=d.labels?.[kind];if(!label?.solutionId.trim())throw Error('Solution ID required');
 if(kind==='nominal'){const r=calculateSolution(d);return {label,concentration:`${d.concentration} mol/L`,volume:`${d.volume} mL`,basis:`${r.mass.toPrecision(8)} g`,reference:d.puritySource};}
 if(!d.commercial)throw Error('Commercial recipe required');const r=calculateCommercial(d.commercial,d.material.record.molarMass);
 return {label,concentration:`${d.commercial.target} mol/L`,volume:`${r.volumeML.toPrecision(8)} mL`,basis:`${r.aliquotML.toPrecision(8)} mL`,reference:d.commercial.productReference};
}
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function buildSolutionLabelHTML(draft:SolutionDraft,kind:PreparationKind,en:boolean){
 const r=solutionLabel(draft,kind),t=(fa:string,english:string)=>en?english:fa;
 const fields=[['preparedBy','تهیه‌کننده','Prepared by'],['preparedOn','تاریخ تهیه و تقویم','Preparation date and calendar'],['expires','انقضا و تقویم','Expiry and calendar'],['storage','نگهداری','Storage']] as const;
 return `<!doctype html><html lang="${en?'en':'fa'}" dir="${en?'ltr':'rtl'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"><title>ARTIN LAB - ${esc(r.label.solutionId)}</title><style>${reportFontCSS}${dilutionPrintCSS}body{font-family:Vazir,Tahoma,Arial,sans-serif;margin:24px;line-height:1.8;color:#203542}.dilutionLabelGrid{max-width:700px;grid-template-columns:1fr}</style></head><body><div class="dilutionLabelGrid"><article class="dilutionLabelCard"><small>ARTIN LAB · ${t(kind==='nominal'?'تهیه با توزین ماده':'تهیه از محصول تجاری',kind==='nominal'?'Prepared by weighing':'Prepared from commercial product')}</small><h3>${esc(en?draft.material.record.en:draft.material.record.fa||draft.material.record.en)}</h3><bdi>${esc(draft.material.record.formula)}</bdi><p class="concentration" dir="ltr">${esc(r.concentration)}</p><p><bdi>${esc(r.label.solutionId)}</bdi> · <bdi>${esc(r.volume)}</bdi></p><dl>${fields.map(([k,fa,english])=>`<div><dt>${t(fa,english)}</dt><dd>${esc(r.label[k]||t('ثبت نشده','Not recorded'))}</dd></div>`).join('')}</dl><p>${esc(r.reference)}</p>${r.label.notes?`<p>${esc(r.label.notes)}</p>`:''}<small>${t('غلظت اسمی؛ تأیید تهیهٔ واقعی نیست. ایمنی طبق SDS و SOP. قالب آزاد A4.','Nominal concentration; actual preparation is not verified. Safety per SDS and SOP. Flexible A4 layout.')}</small></article></div></body></html>`;
}
