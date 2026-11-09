import type {FamilyModel} from "./family-models";
import {gcInputs} from "./gc-model";
const labels:Record<string,{fa:string[];en:string[]}>= {
 balance:{fa:['پراکندگی توزین‌های تکراری','گواهی کالیبراسیون','گام نمایش ترازو','حد اثر رانش','حد اثر دما'],en:['Repeatability','Calibration certificate','Display increment','Drift limit','Temperature effect limit']},
 typeA:{fa:['انحراف معیار قرائت‌های تکراری'],en:['Standard deviation of repeated readings']},
 density:{fa:['عدم‌قطعیت جرم نمونه','عدم‌قطعیت حجم نمونه'],en:['Mass uncertainty','Volume uncertainty']},
 standard:{fa:['عدم‌قطعیت جرم توزین','حد تغییر خلوص','حد خطای حجم بالن','تغییر دمای آزمایشگاه','تکرارپذیری پرکردن بالن'],en:['Mass uncertainty','Purity limit','Flask volume limit','Temperature variation','Filling repeatability']},
 titration:{fa:['عدم‌قطعیت استاندارد جرم خالص','حد تغییر خلوص KHP','عدم‌قطعیت جرم مولی KHP','حد نسبی حجم بورت','سهم نسبی دما','تکرارپذیری نسبی کل تیتراسیون'],en:['Net mass standard uncertainty','KHP purity limit','KHP molar mass uncertainty','Relative burette volume limit','Relative temperature contribution','Relative whole-method repeatability']},
 gc:{fa:['برازش کالیبراسیون','مادهٔ مرجع و تهیهٔ استاندارد','دقت روش','آماده‌سازی نمونه','بازیابی یا بایاس'],en:['Calibration fit','Reference and standards','Method precision','Sample preparation','Recovery or bias']},
};
export function componentNames(template:string,family:FamilyModel|undefined,en:boolean):string[]{
 if(family)return [...family.inputs.map(input=>en?input.en:input.fa),en?'Method precision in result units':'دقت روش در واحد نتیجه',en?'Other independent effects in result units':'سایر اثرهای مستقل در واحد نتیجه'];
 if(template==='gcExtraction')return gcInputs.map(input=>en?input.en:input.fa);
 return labels[template]?.[en?'en':'fa']??[];
}
const sources=[
 ['مثال فرضی؛ عدم‌قطعیت واقعی را وارد کنید','Hypothetical example; enter real uncertainty data'],
 ['مثال فرضی؛ عدم‌قطعیت را از دادهٔ واقعی وارد کنید','Hypothetical example; enter uncertainty from real data'],
 ['برازش خطی بدون وزن استانداردهای واردشده','Unweighted linear fit of entered standards'],
];
export function generatedSourceText(value:string,en:boolean){
 const pair=sources.find(item=>item.includes(value));return pair?pair[en?1:0]:value;
}
