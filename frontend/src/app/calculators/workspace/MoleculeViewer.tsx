'use client';
import {useEffect,useRef,useState} from 'react';
import {Plus,Minus,RotateCcw} from 'lucide-react';
import type {Molecule3D} from './molecule-3d';
import s from './preview.module.css';
const symbols='H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ');
const colors:Record<number,string>={1:'#e6edf3',6:'#64748b',7:'#2563eb',8:'#ef4444',9:'#22c55e',11:'#a855f7',12:'#65a30d',14:'#d6aa75',15:'#f97316',16:'#eab308',17:'#16a34a',19:'#8b5cf6',20:'#65a30d',26:'#b45309',29:'#b87333',35:'#a52a2a',53:'#9333ea'};
type Style='ball'|'sticks'|'wire';
export default function MoleculeViewer({cid,en}:{cid:number;en:boolean}){
 const t=(fa:string,english:string)=>en?english:fa;
 const [molecule,setMolecule]=useState<Molecule3D>(),[failure,setFailure]=useState(''),[retry,setRetry]=useState(0),[style,setStyle]=useState<Style>('ball'),[hydrogens,setHydrogens]=useState(true),[zoom,setZoom]=useState(1),[animate,setAnimate]=useState(false),[conformer,setConformer]=useState(0);
 const canvas=useRef<HTMLCanvasElement>(null),angles=useRef({x:.25,y:.35}),pointer=useRef<{id:number;x:number;y:number}|undefined>(undefined),redraw=useRef<()=>void>(()=>{});
 useEffect(()=>{const controller=new AbortController();setFailure('');setMolecule(undefined);
  fetch(`/api/chemicals?cid=${cid}&section=structure3d`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error(String(r.status));return r.json();})
   .then(data=>{if(controller.signal.aborted)return;if(!data.molecule?.conformers?.length)throw new Error('422');setMolecule(data.molecule);})
   .catch(error=>{if(!controller.signal.aborted)setFailure(['404','422'].includes(error.message)?'missing':'unavailable');});return ()=>controller.abort();
 },[cid,retry]);
 useEffect(()=>{
  const element=canvas.current;if(!element||!molecule)return;const context=element.getContext('2d');if(!context){setFailure('canvas');return;}
  const points=molecule.conformers[conformer],center=points.reduce((a,p)=>({x:a.x+p.x/points.length,y:a.y+p.y/points.length,z:a.z+p.z/points.length}),{x:0,y:0,z:0});
  const centered=points.map(p=>({x:p.x-center.x,y:p.y-center.y,z:p.z-center.z})),radius=Math.max(1,...centered.map(p=>Math.hypot(p.x,p.y,p.z)));
  function draw(){
   if(!context||!element)return;const width=element.clientWidth,height=element.clientHeight;if(!width||!height)return;const ratio=Math.min(devicePixelRatio||1,2);
   if(element.width!==Math.round(width*ratio)||element.height!==Math.round(height*ratio)){element.width=Math.round(width*ratio);element.height=Math.round(height*ratio);}
   context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);context.fillStyle='#f8fafc';context.fillRect(0,0,width,height);
   const scale=Math.min(width,height)*.32/radius*zoom,cx=Math.cos(angles.current.x),sx=Math.sin(angles.current.x),cy=Math.cos(angles.current.y),sy=Math.sin(angles.current.y);
   const projected=new Map(centered.map((p,i)=>{const x=p.x*cy+p.z*sy,z=-p.x*sy+p.z*cy,y=p.y*cx-z*sx,depth=p.y*sx+z*cx;return [molecule!.atoms[i].id,{x:width/2+x*scale,y:height/2-y*scale,z:depth,element:molecule!.atoms[i].element}];}));
   const visible=(e:number)=>hydrogens||e!==1;
   const items:{depth:number;paint:()=>void}[]=[];
   for(const bond of molecule!.bonds){const a=projected.get(bond.a)!,b=projected.get(bond.b)!;if(!visible(a.element)||!visible(b.element))continue;
    items.push({depth:(a.z+b.z)/2,paint:()=>{const lineWidth=style==='wire'?1.5:Math.max(2,Math.min(9,scale*.09));const length=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;
     const count=bond.order===4?1:Math.min(3,bond.order);for(let line=0;line<count;line++){const offset=(line-(count-1)/2)*(lineWidth+2),x1=a.x+nx*offset,y1=a.y+ny*offset,x2=b.x+nx*offset,y2=b.y+ny*offset;const gradient=context.createLinearGradient(x1,y1,x2,y2);gradient.addColorStop(0,colors[a.element]??'#a78bfa');gradient.addColorStop(.48,colors[a.element]??'#a78bfa');gradient.addColorStop(.52,colors[b.element]??'#a78bfa');gradient.addColorStop(1,colors[b.element]??'#a78bfa');context.strokeStyle=gradient;context.lineWidth=lineWidth;context.lineCap='round';context.beginPath();context.moveTo(x1,y1);context.lineTo(x2,y2);context.stroke();}}});
   }
   for(const atom of projected.values()){if(!visible(atom.element))continue;items.push({depth:atom.z+.01,paint:()=>{const r=style==='ball'?Math.max(4,Math.min(24,scale*(atom.element===1?.14:.25))):style==='sticks'?3:2;
    const gradient=context.createRadialGradient(atom.x-r*.35,atom.y-r*.4,r*.05,atom.x,atom.y,r);gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.4,colors[atom.element]??'#a78bfa');gradient.addColorStop(1,'#334155');context.fillStyle=gradient;context.beginPath();context.arc(atom.x,atom.y,r,0,2*Math.PI);context.fill();
    if(style==='ball'&&r>10&&atom.element!==1){context.fillStyle='#fff';context.font='bold 11px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(symbols[atom.element-1],atom.x,atom.y);}}});}
   items.sort((a,b)=>a.depth-b.depth).forEach(item=>item.paint());
  }
  redraw.current=draw;const observer=new ResizeObserver(draw);observer.observe(element);draw();let frame=0,last=0;
  const tick=(now:number)=>{if(last)angles.current.y+=Math.min(now-last,50)*.00035;last=now;draw();frame=requestAnimationFrame(tick);};if(animate)frame=requestAnimationFrame(tick);
  return ()=>{observer.disconnect();cancelAnimationFrame(frame);redraw.current=()=>{};};
 },[molecule,style,hydrogens,zoom,animate,conformer]);
 const hasHydrogens=Boolean(molecule?.atoms.some(atom=>atom.element===1));
 const reset=()=>{angles.current={x:.25,y:.35};setZoom(1);setAnimate(false);redraw.current();};
 if(failure)return <div className={s.moleculeFallback} role="status"><p>{failure==='missing'?t('برای این ماده مختصات سه‌بعدی قابل نمایش از PubChem دریافت نشد. ساختار دوبعدی همچنان در دسترس است.','No displayable 3D coordinates were available from PubChem. The 2D structure remains available.'):t('نمای سه‌بعدی بارگیری نشد؛ دوباره تلاش کنید یا ساختار دوبعدی را ببینید.','Could not load the 3D viewer. Retry or use the 2D structure.')}</p><button type="button" className={s.secondary} onClick={()=>setRetry(v=>v+1)}>{t('تلاش دوباره','Retry')}</button></div>;
 if(!molecule)return <p className={s.moleculeFallback} role="status">{t('در حال دریافت مختصات سه‌بعدی از PubChem…','Loading 3D coordinates from PubChem…')}</p>;
 return <section className={s.moleculeViewer} aria-label={t('نمای سه‌بعدی مولکول','Interactive 3D molecule')}>
 <div className={s.moleculeControls}><label>{t('مدل نمایش','Display model')}<select value={style} onChange={e=>setStyle(e.target.value as Style)}><option value="ball">{t('گوی و میله','Ball and stick')}</option><option value="sticks">{t('میله‌ای','Sticks')}</option><option value="wire">{t('خطی','Wireframe')}</option></select></label><label title={hasHydrogens?undefined:t("در مدل دریافتی هیدروژنی وجود ندارد","The retrieved model contains no hydrogen atoms")}><input type="checkbox" disabled={!hasHydrogens} checked={hasHydrogens&&hydrogens} onChange={e=>setHydrogens(e.target.checked)}/>{t('نمایش هیدروژن‌ها','Show hydrogens')}</label><label><input type="checkbox" checked={animate} onChange={e=>setAnimate(e.target.checked)}/>{t('چرخش خودکار','Auto rotate')}</label></div>
 <canvas ref={canvas} className={s.moleculeCanvas} tabIndex={0} role="img" aria-label={t('ساختار سه‌بعدی؛ با کشیدن بچرخانید. کلیدهای جهت‌نما برای چرخش و مثبت و منفی برای بزرگ‌نمایی.','3D structure: drag or use arrow keys to rotate; plus and minus to zoom.')}
  onPointerDown={e=>{pointer.current={id:e.pointerId,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}}
  onPointerMove={e=>{const p=pointer.current;if(!p||p.id!==e.pointerId)return;angles.current.y+=(e.clientX-p.x)*.012;angles.current.x+=(e.clientY-p.y)*.012;pointer.current={id:e.pointerId,x:e.clientX,y:e.clientY};redraw.current();}}
  onPointerUp={()=>{pointer.current=undefined;}} onPointerCancel={()=>{pointer.current=undefined;}}
  onKeyDown={e=>{if(e.key.startsWith('Arrow')){e.preventDefault();angles.current.y+=e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0;angles.current.x+=e.key==='ArrowUp'?-.12:e.key==='ArrowDown'?.12:0;redraw.current();}else if(e.key==='+'||e.key==='='){e.preventDefault();setZoom(z=>Math.min(3,z*1.15));}else if(e.key==='-'){e.preventDefault();setZoom(z=>Math.max(.4,z/1.15));}else if(e.key==='Home'){e.preventDefault();reset();}}}/>
 <div className={s.moleculeActions}><button type="button" className={s.moleculeIcon} aria-label={t("بزرگ‌نمایی","Zoom in")} title={t("بزرگ‌نمایی","Zoom in")} onClick={()=>setZoom(z=>Math.min(3,z*1.2))} disabled={zoom>=3}><Plus size={23} aria-hidden="true"/></button><button type="button" className={s.moleculeIcon} aria-label={t("کوچک‌نمایی","Zoom out")} title={t("کوچک‌نمایی","Zoom out")} onClick={()=>setZoom(z=>Math.max(.4,z/1.2))} disabled={zoom<=.4}><Minus size={23} aria-hidden="true"/></button><button type="button" className={s.moleculeIcon} aria-label={t("نمای اولیه","Reset view")} title={t("نمای اولیه","Reset view")} onClick={reset}><RotateCcw size={22} aria-hidden="true"/></button>{molecule.conformers.length>1&&<label>{t('کانفورمر','Conformer')}<select value={conformer} onChange={e=>{setConformer(Number(e.target.value));reset();}}>{molecule.conformers.map((_,i)=><option key={i} value={i}>{i+1}</option>)}</select></label>}</div>
 <p className={s.moleculeHelp}>{t('برای چرخش، مدل را با ماوس یا انگشت بکشید. مختصات محاسباتی PubChem؛ این نمایش به معنی ساختار تجربی یا تنها آرایش ممکن ماده نیست.','Drag to rotate. Computed PubChem coordinates; this is not an experimental structure or the only possible conformation.')}</p>
 <div className={s.moleculeLegend} aria-label={t('راهنمای رنگ عناصر','Element color legend')}>{Array.from(new Set(molecule.atoms.filter(a=>hydrogens||a.element!==1).map(a=>a.element))).map(e=><span key={e}><i style={{background:colors[e]??'#a78bfa'}}/>{symbols[e-1]}</span>)}</div>
 <a className={s.referenceLink} href={`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=3D-Conformer`} target="_blank" rel="noreferrer">{t('مشاهدهٔ مدل‌ها و منبع در PubChem ↗','Conformers and source at PubChem ↗')}</a>
 </section>;
}
