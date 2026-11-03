// Coverage ring: opening a service building's panel outlines its coverage area on the map; dragging the radius slider resizes it live;
// releasing commits it; closing the panel (X, Esc, clicking elsewhere) removes it. Optional 2nd arg = screenshot path.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4191/',shot=process.argv[3];
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.stack));
await p.goto(url+'?size=128&seed=3&city=Ringford');await p.waitForFunction(()=>window.__city&&__city.N,null,{timeout:120000});await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<60;r++)for(let i=64-r;i<=64+r;i++)for(let j=64-r;j<=64+r;j++){let g=true;for(let a=-14;a<=14&&g;a++)for(let b2=-22;b2<=22;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
const pol=await p.evaluate(([ci,cj])=>{const C=__city;C.sim().funds=1e7;const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.zone[i][j]='';C.bld[i][j]=0};
 for(let j=cj-20;j<=cj+20;j++){R(ci,j);R(ci+4,j)}for(const i of [ci+1,ci+2,ci+3])for(let j=cj-14;j<=cj+14;j++){const z=j<cj+3?'R':'C';C.zone[i][j]=z;C.bld[i][j]=2;C.zden[i][j]=2}
 C.refresh();C.markTripsDirty();C.plop('police',ci-2,cj-6);C.fastForward(2);const v=C.civs.find(x=>x.type==='police');C.setZoom(1);C.centerOn(v.i+(v.s-1)/2,v.j+(v.s-1)/2);return{i:v.i,j:v.j,s:v.s}},c);
await p.waitForTimeout(1500);
const ctr=()=>p.evaluate(v=>__city.tileToScreen(v.i+(v.s-1)/2,v.j+(v.s-1)/2),pol);
ok('no ring before anything is selected',!(await p.evaluate(()=>__city.svcRing().on)));
let s=await ctr();await p.mouse.click(s.x,s.y+4);await p.waitForTimeout(600);
const r0=await p.evaluate(()=>({ring:__city.svcRing(),slider:!!document.getElementById('svcRR'),label:document.getElementById('svcRR')?.nextElementSibling?.textContent}));
ok('clicking a police station shows its coverage ring',r0.ring.on&&r0.ring.type==='police'&&r0.ring.r>3&&r0.slider,JSON.stringify(r0.ring));
ok('ring matches the radius shown in the panel',r0.label===`${Math.round(r0.ring.r)} tiles`,`${r0.label} vs ${r0.ring.r}`);
const w0=r0.ring.w;
// drag: input events resize live without committing
const live=await p.evaluate(()=>{const el=document.getElementById('svcRR');el.value='150';el.dispatchEvent(new Event('input',{bubbles:true}));const civ=__city.civs.find(x=>x.type==='police');return{ring:__city.svcRing(),label:el.nextElementSibling.textContent,rr:civ.rr??1}});
ok('dragging the radius slider grows the ring live',live.ring.r>r0.ring.r*1.4&&live.ring.w>w0*1.4,`${r0.ring.r.toFixed(1)} -> ${live.ring.r.toFixed(1)}, width ${w0.toFixed(0)} -> ${live.ring.w.toFixed(0)}`);
ok('label follows the drag',live.label===`${Math.round(live.ring.r)} tiles`,live.label);
ok('drag alone does not change the building yet',live.rr===1,String(live.rr));
const com=await p.evaluate(()=>{const el=document.getElementById('svcRR');el.dispatchEvent(new Event('change',{bubbles:true}));const civ=__city.civs.find(x=>x.type==='police');return{ring:__city.svcRing(),rr:civ.rr,x:!!document.querySelector('#info .infoX, .infoX'),slider:document.getElementById('svcRR')?.value}});
ok('releasing commits the radius and keeps the ring',Math.abs(com.rr-1.5)<1e-6&&com.ring.on&&Math.abs(com.ring.r-live.ring.r)<1e-6&&com.slider==='150',JSON.stringify(com));
ok('panel keeps its close button after a slider change',com.x);
if(shot){await p.evaluate(()=>__city.setZoom(0.55));await p.waitForTimeout(1500);await p.screenshot({path:shot});}
await p.evaluate(()=>document.querySelector('.infoX').click());await p.waitForTimeout(200);
ok('closing the panel with X removes the ring',!(await p.evaluate(()=>__city.svcRing().on)));
s=await ctr();await p.mouse.click(s.x,s.y+4);await p.waitForTimeout(500);const re=await p.evaluate(()=>__city.svcRing().on);await p.keyboard.press('Escape');await p.waitForTimeout(200);
ok('Esc removes the ring',re&&!(await p.evaluate(()=>__city.svcRing().on)));
s=await ctr();await p.mouse.click(s.x,s.y+4);await p.waitForTimeout(500);
const road=await p.evaluate(([ci,cj])=>__city.tileToScreen(ci+2,cj+10),c);await p.mouse.click(road.x,road.y);await p.waitForTimeout(500);const other=await p.evaluate(()=>document.getElementById('info').innerText.slice(0,60));
ok('clicking another building removes the ring',!(await p.evaluate(()=>__city.svcRing().on))&&!/Police/.test(other),other.replace(/\n/g,' '));
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
