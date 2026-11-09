export const toolGroups = [
  {fa:'محلول و غلظت',en:'Solutions & concentration',helpFa:'تهیهٔ محلول، رقیق‌سازی و درصدها',helpEn:'Preparation, dilution and percentages'},
  {fa:'تبدیل واحد',en:'Unit conversions',helpFa:'فشار، دما، دبی و چگالی',helpEn:'Pressure, temperature, flow and density'},
  {fa:'آمار و کنترل کیفیت',en:'Statistics & quality control',helpFa:'RSD، بازیابی و کالیبراسیون',helpEn:'RSD, recovery and calibration'},
  {fa:'جریان و پمپ',en:'Flow & pumps',helpFa:'دبی، رینولدز، افت فشار و توان',helpEn:'Flow, Reynolds number, pressure drop and power'},
  {fa:'خواص فیزیکی',en:'Physical properties',helpFa:'چگالی و گرانروی',helpEn:'Density and viscosity'},
  {fa:'حرارت و انرژی',en:'Heat & energy',helpFa:'انرژی گرمایی و ظرفیت گرمایی',helpEn:'Heat energy and heat capacity'},
  {fa:'عدم‌قطعیت و GUM',en:'Uncertainty & GUM',helpFa:'مدل آزمون، بودجه و مونت‌کارلو',helpEn:'Method models, budgets and Monte Carlo'},
] as const;

export const methodGroups=[
  {fa:'هیدروکربن',en:'Hydrocarbon products'}, {fa:'روغن',en:'Lubricating oils'},
  {fa:'قیر',en:'Bitumen'}, {fa:'ضدیخ',en:'Coolants'},
  {fa:'گریس',en:'Grease'}, {fa:'نفت خام',en:'Crude oil'},
] as const;

export function toolGroup(name:string,legacyCategory:number):number {
  if(name==='General GUM uncertainty budget')return 6;
  if(name==='Sensible heat energy')return 5;
  if(['Density from mass and volume','Dynamic to kinematic viscosity'].includes(name))return 4;
  return legacyCategory;
}

export function normalizedToolSearch(value:string):string {
  return value.normalize('NFKC').toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک')
    .replace(/[\u064B-\u065F\u0670]/g,'').replace(/[\u200c\s]+/g,'');
}
