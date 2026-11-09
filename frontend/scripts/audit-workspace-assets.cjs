// Reproducible local production-build inventory, not a browser timing benchmark.
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'.next/server/app/calculators/workspace.html'),'utf8');
const tags=html.match(/<(?:script|link)\b[^>]*>/g)||[];
const urls=new Set();
for(const tag of tags){
 if(!tag.startsWith('<script')&&!/as="script"/.test(tag))continue;
 const url=tag.match(/(?:src|href)="([^"?]+)(?:\?[^"]*)?"/)?.[1];
 if(url?.startsWith('/_next/static/')&&url.endsWith('.js'))urls.add(url);
}
if(!urls.size)throw Error('No initial JavaScript files found; inspect build format');
const files=[...urls].sort().map(url=>{
 const raw=fs.readFileSync(path.join(root,'.next',url.slice('/_next/'.length)));
 return {url,bytes:raw.length,gzipBytes:zlib.gzipSync(raw,{level:9}).length};
});
const result={method:'Production HTML script tags and script preloads; uncompressed bytes and local gzip level-9 estimates. Not network timings, actual transfer sizes, Lighthouse or a device benchmark.',route:'/calculators/workspace',initialJavaScript:{count:files.length,bytes:files.reduce((a,b)=>a+b.bytes,0),gzipBytes:files.reduce((a,b)=>a+b.gzipBytes,0),files}};
const output=process.argv[2];
if(output)fs.writeFileSync(path.resolve(output),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({count:result.initialJavaScript.count,bytes:result.initialJavaScript.bytes,gzipBytes:result.initialJavaScript.gzipBytes}));
