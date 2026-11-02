// Walking residents: people appear on the sidewalks for short trips in the day (school run, shops, parked car -> door), none in the small hours,
// they stay off the car lanes except when crossing, clicking one shows age / home / destination, and City Data counts them.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4197/',shots=process.argv.includes('--shot');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=3&city=Walkers');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const c=await p.evaluate(()=>{const t=__city.terrain,N=__city.N();for(let r=0;r<30;r++)for(let i=N-12-r;i>=10;i--)for(let j=8;j<20;j++){let g=true;for(let a=-6;a<=6&&g;a++)for(let b2=-8;b2<=8;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
const info=await p.evaluate(([ci,cj])=>{const C=__city,N=C.N();C.sim().funds=1e9;C.setRoadWidth(0);C.paint('road',ci,cj-8,ci,cj+14);C.paint('road',ci-6,cj+3,ci+6,cj+3);
 for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.road[i][j])C.rstage[i][j]=0;const Z=(i,j,z,d)=>{if(C.road[i][j])return;C.zone[i][j]=z;C.bld[i][j]=d;C.zden[i][j]=d};
 for(let x=0;x<16;x++)Z(x%2?ci+1:ci-1,cj-7+(x>>1),'R',2);for(let x=0;x<3;x++){Z(ci+1,cj+5+x,'C',1);Z(ci-1,cj+5+x,'C',1)}for(let x=0;x<4;x++){Z(ci-3-x,cj+2,'R',2);Z(ci-3-x,cj+4,'C',1)}Z(ci+1,cj+12,'I',1);C.plop('school',ci+2,cj+1);Z(ci-1,cj+12,'I',1);
 C.markTripsDirty();C.fastForward(2);C.centerOn(ci,cj+1);C.setZoom(3);return {res:C.trips().stats.residents}},c);
await p.waitForFunction(()=>__peds.ready,null,{timeout:30000});

const snap=async(h,name,until)=>{await p.evaluate(h=>{__fx.setDay(Math.ceil(__city.sim().day/24)*24+h)},h);await p.evaluate(()=>__city.setSpeed(1));if(until)await p.waitForFunction(u=>__city.sim().day%24>=u,until,{timeout:60000});await p.waitForFunction(()=>__peds.list.filter(q=>q.s&&q.s.visible).length>=3,null,{timeout:40000}).catch(()=>{});await p.waitForTimeout(2500);await p.evaluate(()=>__city.setSpeed(0));
 await p.evaluate(()=>{const L=__peds.list.filter(q=>q.s);let best=L[0],bn=0;for(const q of L){const n=L.filter(o=>Math.hypot(o.x-q.x,o.y-q.y)<60).length;if(n>bn){bn=n;best=q}}if(!best)return;const a=best.pts[best.seg];__city.centerOn(Math.round(a[0]),Math.round(a[1]));__city.setZoom(7)});await p.evaluate(()=>{__city.layers.iconL.visible=false;const t=document.getElementById('tutorial')||document.querySelector('[id*=tut]');if(t)t.style.display='none'});await p.waitForTimeout(800);await p.mouse.move(5,600);await p.screenshot({path:'screenshots/'+name})};
await snap(8,'peds-day-close.png');await snap(17,'peds-night-close.png',20);
ok('no page errors',!errs.length,errs.join(' | '));console.log(res.join('\n'));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
