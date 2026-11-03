// Crispness close-ups at 2x device scale: same seeded city/view, people + buildings. usage: node tests/shot-crisp.cjs URL OUTPREFIX
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4323/',pre=process.argv[3]||'/workspace/crisp/shot';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const ctx=await b.newContext({viewport:{width:1200,height:800},deviceScaleFactor:2});const p=await ctx.newPage();
await p.addInitScript(()=>{let s=12345;Math.random=()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296)});
await p.goto(url+'?size=64&seed=3&city=Crisp');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>{__city.setSpeed(0);localStorage.setItem('tutorialDone','1')});
const c=await p.evaluate(()=>{const t=__city.terrain,N=__city.N();for(let r=0;r<30;r++)for(let i=N-12-r;i>=10;i--)for(let j=8;j<20;j++){let g=true;for(let a=-6;a<=6&&g;a++)for(let b2=-8;b2<=8;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
await p.evaluate(([ci,cj])=>{const C=__city,N=C.N();C.sim().funds=1e9;C.setRoadWidth(0);C.paint('road',ci,cj-8,ci,cj+14);C.paint('road',ci-6,cj+3,ci+6,cj+3);
 for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.road[i][j])C.rstage[i][j]=0;const Z=(i,j,z,d)=>{if(C.road[i][j])return;C.zone[i][j]=z;C.bld[i][j]=d;C.zden[i][j]=d};
 for(let x=0;x<16;x++)Z(x%2?ci+1:ci-1,cj-7+(x>>1),'R',2);for(let x=0;x<3;x++){Z(ci+1,cj+5+x,'C',1);Z(ci-1,cj+5+x,'C',1)}for(let x=0;x<4;x++){Z(ci-3-x,cj+2,'R',2);Z(ci-3-x,cj+4,'C',1)}C.plop('school',ci+2,cj+1);
 C.markTripsDirty();C.fastForward(2);C.refresh();C.centerOn(ci,cj+1)},c);
await p.waitForFunction(()=>__peds.ready,null,{timeout:30000});await p.evaluate(()=>{__fx.setDay(Math.ceil(__city.sim().day/24)*24+8);__city.setSpeed(1)});
await p.waitForFunction(()=>__peds.list.filter(q=>q.s&&q.s.visible).length>=4,null,{timeout:60000}).catch(()=>{});await p.waitForTimeout(2000);await p.evaluate(()=>__city.setSpeed(0));
await p.evaluate(([ci,cj])=>{const L=__peds.list.filter(q=>q.s&&q.s.visible);let best=null,bn=0;for(const q of L){const n=L.filter(o=>Math.hypot(o.x-q.x,o.y-q.y)<80).length;if(n>bn){bn=n;best=q}}if(best){const a=best.pts[best.seg];__city.centerOn(Math.round(a[0]),Math.round(a[1]))}else __city.centerOn(ci,cj+1);const t=document.querySelector('[id*=tut]');if(t)t.style.display='none';__city.layers&&(__city.layers.iconL.visible=false)},c);
for(const z of [0.6,1.5,3]){await p.evaluate(z=>__city.setZoom(z),z);await p.waitForTimeout(700);await p.mouse.move(5,790);await p.screenshot({path:`${pre}-zoom${z}.png`,clip:{x:350,y:200,width:500,height:400}})}
const m=await p.evaluate(()=>({zoom:__city.zoom(),res:__city.gfx().res,peds:__peds.list.filter(q=>q.s&&q.s.visible).length}));console.log(JSON.stringify(m));await b.close()})();
