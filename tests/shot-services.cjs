// Screenshots: crime overlay before/after a police station, and police/hospital/school info panels.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4191/',out=process.argv[3]||'/workspace/cb-ui/screenshots';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});
await p.goto(url+'?size=128&seed=3&city=Servton');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));await p.waitForTimeout(3000);
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<60;r++)for(let i=64-r;i<=64+r;i++)for(let j=64-r;j<=64+r;j++){let g=true;for(let a=-14;a<=14&&g;a++)for(let b2=-22;b2<=22;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
await p.evaluate(([ci,cj])=>{const C=__city;C.sim().funds=1e7;const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.zone[i][j]='';C.bld[i][j]=0};
 for(let j=cj-20;j<=cj+20;j++){R(ci,j);R(ci+4,j)}for(const i of [ci+1,ci+2,ci+3])for(let j=cj-14;j<=cj+14;j++){const z=j<0+cj+3?'R':'C';C.zone[i][j]=z;C.bld[i][j]=2;C.zden[i][j]=2}
 C.refresh();C.markTripsDirty();C.fastForward(3);C.setCovView('crime');C.setZoom(1.1);C.centerOn(ci+2,cj);},c);
await p.waitForTimeout(2500);await p.screenshot({path:out+'/crime-before.png'});
await p.evaluate(([ci,cj])=>{const C=__city;C.plop('police',ci-2,cj-6);C.plop('hospital',ci-2,cj+4);C.plop('school',ci-2,cj-12);C.fastForward(90);C.setCovView('crime');},c);
await p.waitForTimeout(2500);await p.screenshot({path:out+'/crime-after.png'});await p.evaluate(()=>__city.setCovView(''));
for(const [t,di,dj] of [['police',-2,-6],['hospital',-2,4],['school',-2,-12]]){await p.evaluate(([ci,cj,di,dj])=>{const C=__city;C.centerOn(ci+di,cj+dj);},[...c,di,dj]);await p.waitForTimeout(800);
 const s=await p.evaluate(([ci,cj,di,dj])=>__city.tileToScreen(ci+di,cj+dj),[...c,di,dj]);await p.mouse.click(s.x,s.y+4);await p.waitForTimeout(800);await p.screenshot({path:`${out}/svc-${t}.png`});}
await p.evaluate(()=>{document.querySelector('#dataBtn')?.click()});await p.waitForTimeout(500);await p.evaluate(()=>document.querySelector('[data-tab="Services"]')?.click());await p.waitForTimeout(500);await p.screenshot({path:out+'/data-services.png'});
await b.close()})();
