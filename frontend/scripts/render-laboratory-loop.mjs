// Render a real multi-frame WebP from the original generated artwork.
// No browser CSS or autoplay permission is needed to play this asset.
import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const source=new URL('../public/images/laboratory-instrumentation-hero-v1.png',import.meta.url);
const output=new URL('../public/images/laboratory-instrumentation-loop-v3.webp',import.meta.url);
const image=(await readFile(source)).toString('base64');
const frames=[];
const width=720,height=480,count=100;
sharp.cache(false);
for(let index=0;index<count;index++){
  const time=index/count,angle=time*2*Math.PI;
  const scale=1.015+.012*Math.sin(angle);
  const dx=9*Math.sin(angle),dy=5*Math.cos(angle);
  const vapor=Array.from({length:7},(_,i)=>{
    const p=(time*3+i/7)%1;
    const x=870+Math.sin(p*5+i)*26,y=173-p*170;
    return `<ellipse cx="${x}" cy="${y}" rx="${12+p*29}" ry="${20+p*38}" opacity="${Math.sin(p*Math.PI)*.75}" fill="url(#mist)"/>`;
  }).join('');
  const bubbles=Array.from({length:22},(_,i)=>{
    const p=(time*4+i/22)%1;
    const x=736+(i*37)%255+Math.sin(p*5+i)*8,y=800-p*170;
    return `<circle cx="${x}" cy="${y}" r="${5+(i%4)*1.8}" stroke="#e0fffe" stroke-width="2" fill="#b4faff" fill-opacity=".14" opacity="${Math.sin(p*Math.PI)*.95}"/>`;
  }).join('');
  const amberBubbles=Array.from({length:12},(_,i)=>{
    const p=(time*3+i/12)%1;
    const x=1118+(i*23)%100+Math.sin(p*6+i)*5,y=778-p*310;
    return `<circle cx="${x}" cy="${y}" r="${4+(i%4)*1.5}" fill="#ffe1a4" fill-opacity=".12" stroke="#fff0c8" stroke-width="1.9" opacity="${Math.sin(p*Math.PI)*.9}"/>`;
  }).join('');
  const amberSurface=466+8*Math.sin(angle*3);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 1536 1024">
    <defs>
      <radialGradient id="mist"><stop stop-color="#e0faff" stop-opacity=".75"/><stop offset=".55" stop-color="#b9efff" stop-opacity=".25"/><stop offset="1" stop-color="#c4f6ff" stop-opacity="0"/></radialGradient>
      <clipPath id="liquid"><rect x="705" y="646" width="328" height="158" rx="72"/></clipPath>
      <clipPath id="amber"><rect x="1095" y="445" width="145" height="344" rx="5"/></clipPath>
    </defs>
    <g transform="translate(${768+dx} ${512+dy}) scale(${scale}) translate(-768 -512)">
      <image width="1536" height="1024" xlink:href="data:image/png;base64,${image}"/>
      ${vapor}<g clip-path="url(#liquid)">${bubbles}</g>
      <g clip-path="url(#amber)">${amberBubbles}<path d="M1095 ${amberSurface}Q1165 ${amberSurface+10*Math.cos(angle*3)} 1240 ${amberSurface-2}" stroke="#ffe4a3" stroke-opacity=".8" stroke-width="3.5"/><ellipse cx="1167" cy="${amberSurface+3}" rx="65" ry="7" fill="#eabe5d" opacity=".23"/></g>
      <ellipse cx="860" cy="651" rx="${127+Math.sin(angle*2)*4}" ry="${8+Math.cos(angle*2)*2}" fill="none" stroke="#acffff" stroke-opacity="${.15+.1*Math.sin(angle)}" stroke-width="1.4"/>
    </g>
  </svg>`;
  frames.push(await sharp(Buffer.from(svg)).png().toBuffer());
  if(index%20===0)process.stdout.write(`Rendered ${index+1}/${count} frames\n`);
}
await sharp(frames,{join:{animated:true}}).webp({quality:80,alphaQuality:90,effort:4,loop:0,delay:Array(count).fill(50)}).toFile(fileURLToPath(output));
const metadata=await sharp(fileURLToPath(output),{animated:true}).metadata();
if(metadata.pages!==count||metadata.loop!==0||metadata.delay.reduce((sum,n)=>sum+n,0)!==count*50)throw new Error('Animation validation failed');
await writeFile(new URL('../public/images/laboratory-instrumentation-loop-v3.json',import.meta.url),JSON.stringify({width,height,frames:metadata.pages,durationMs:metadata.delay.reduce((sum,n)=>sum+n,0),loop:metadata.loop,format:metadata.format},null,2));
process.stdout.write(JSON.stringify({frames:metadata.pages,loop:metadata.loop,bytes:(await readFile(output)).length}));
