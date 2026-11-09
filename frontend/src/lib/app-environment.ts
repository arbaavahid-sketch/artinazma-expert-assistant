import {Capacitor} from '@capacitor/core';
/** Presentation policy only; server authentication remains authoritative. */
export function isAppEnvironment(){
 if(Capacitor.isNativePlatform())return true;
 if(typeof window==='undefined')return false;
 return Boolean((window as Window&{artinDesktop?:{version?:string}}).artinDesktop?.version)||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)||Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches);
}
