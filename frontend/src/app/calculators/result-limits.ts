export type LimitStatus = "none"|"invalid"|"unavailable"|"below"|"above"|"within";
export function compareLimits(value:number,minimum:string,maximum:string,parse:(text:string)=>number):LimitStatus {
  const hasMin=Boolean(minimum.trim()),hasMax=Boolean(maximum.trim());
  if(!hasMin&&!hasMax)return "none";
  const min=hasMin?parse(minimum):null,max=hasMax?parse(maximum):null;
  if(min!==null&&!Number.isFinite(min)||max!==null&&!Number.isFinite(max)||min!==null&&max!==null&&min>max)return "invalid";
  if(!Number.isFinite(value))return "unavailable";
  if(min!==null&&value<min)return "below";
  if(max!==null&&value>max)return "above";
  return "within";
}
export function limitMessage(status:LimitStatus,en:boolean) {
  return ({none:"",unavailable:en?"Calculate a valid result to compare.":"برای مقایسه، ابتدا نتیجهٔ معتبر محاسبه کنید.",
    invalid:en?"Enter valid numeric limits; the minimum cannot exceed the maximum.":"حدها باید عدد معتبر باشند و حد پایین از حد بالا بیشتر نباشد.",
    below:en?"Below the minimum":"کمتر از حد پایین",above:en?"Above the maximum":"بیشتر از حد بالا",within:en?"Within the entered limits":"داخل حدود واردشده"})[status];
}
export const outsideLimits=(status:LimitStatus)=>status==='below'||status==='above';
