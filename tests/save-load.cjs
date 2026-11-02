// Save/load round trip: build a small city, run it for a while, save with Ctrl+S (IndexedDB slot, gzip), reload the page
// into that slot and check the city comes back the same and keeps simulating. Also checks the .city file bytes decode. Usage: node tests/save-load.cjs URL
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
await p.goto(url+'?size=64&seed=7&city=SaveTest');await p.waitForFunction(()=>window.__city&&__city.N,null,{timeout:120000});await p.evaluate(()=>__city.setSpeed(0));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-6;a<=6&&g;a++)for(let b=-6;b<=6;b++)if(!t[i+a]||t[i+a][j+b]!=='grass'){g=false;break}if(g)return[i,j]}});
ok('found open ground',!!c);const [ci,cj]=c;
await p.evaluate(([i,j])=>{const C=__city;C.paint('road',i,j-6,i,j+6);C.paint('road',i-6,j,i+6,j);C.paint('R',i-3,j-5,i-1,j-1);C.paint('C',i+1,j-5,i+3,j-1);C.paint('I',i+1,j+1,i+3,j+5);C.paint('R',i-3,j+1,i-1,j+5);C.setTool('select');C.fastForward(120)},c);
const snap=()=>p.evaluate(()=>{const C=__city,N=C.N(),s=C.sim(),cnt=a=>{let n=0;for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(a[i][j])n++;return n};
  return{name:C.city().name,N,day:s.day,funds:Math.round(s.funds),pop:Math.round(s.pop??0),roads:cnt(C.road),zones:cnt(C.zone),blds:cnt(C.bld),ach:[...(s.ach||[])].sort().join(',')}});
const before=await snap();ok('city grew before saving',before.roads>=20&&before.zones>=40,JSON.stringify(before));
await p.mouse.click(700,300);await p.keyboard.press('Control+s');await p.waitForTimeout(2500);
const rec=await p.evaluate(()=>new Promise(r=>{const q=indexedDB.open('city-builder',1);q.onsuccess=()=>{const g=q.result.transaction('saves').objectStore('saves').getAll();g.onsuccess=()=>r(g.result.map(x=>({id:x.id,city:x.city,bytes:x.bytes,size:x.data?.size||0})))}}));
const mine=rec.find(x=>x.id==='slot:SaveTest');ok('Ctrl+S writes a save slot',!!mine&&mine.size>100,JSON.stringify(rec));
const file=await p.evaluate(async id=>new Promise(r=>{const q=indexedDB.open('city-builder',1);q.onsuccess=()=>{const g=q.result.transaction('saves').objectStore('saves').get(id);g.onsuccess=async()=>{try{const ds=g.result.data.stream().pipeThrough(new DecompressionStream('gzip'));const o=JSON.parse(await new Response(ds).text());r({format:o.format,version:o.version})}catch(e){r({err:String(e)})}}}}),mine.id);
ok('saved bytes are a gzip city file',file.format==='city-builder-save'&&file.version>=16,JSON.stringify(file));
await p.evaluate(id=>sessionStorage.setItem('loadId',id),mine.id);await p.reload();await p.waitForFunction(()=>window.__city&&__city.N,null,{timeout:120000});await p.evaluate(()=>__city.setSpeed(0));
const after=await snap();
for(const k of ['name','N','day','funds','roads','zones','blds','ach'])ok('loaded '+k+' matches',before[k]===after[k],before[k]+' vs '+after[k]);
ok('loaded population matches (within 1%)',Math.abs(before.pop-after.pop)<=Math.max(2,before.pop*0.01),before.pop+' vs '+after.pop);
await p.evaluate(()=>__city.fastForward(30));const later=await snap();ok('loaded city keeps simulating',later.day>after.day,after.day+' -> '+later.day);
ok('no page errors',!errs.length,errs.join('; '));console.log(res.join('\n'));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
