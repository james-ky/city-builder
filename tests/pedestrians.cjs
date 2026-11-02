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
const run=async(h0,ms)=>{await p.evaluate(h0=>{__fx.setDay(Math.ceil(__city.sim().day/24)*24+h0)},h0);await p.evaluate(()=>__city.setSpeed(1));const S=[];const t0=Date.now();while(Date.now()-t0<ms){S.push(await p.evaluate(()=>{const N=__city.N(),road=__city.road;let onLane=0;
  for(const q of __peds.list){const a=q.pts[q.seg],b=q.pts[q.seg+1],gi=a[0]+(b[0]-a[0])*q.t,gj=a[1]+(b[1]-a[1])*q.t,ti=Math.round(gi),tj=Math.round(gj);if(q.seg===q.cross)continue;if(road[ti]&&road[ti][tj]){const ext=Math.max(Math.abs(gi-ti),Math.abs(gj-tj));if(ext<0.25)onLane++}}
  return {h:__city.sim().day%24,n:__peds.list.length,onLane,kinds:__peds.list.map(q=>q.kind),purp:__peds.list.map(q=>q.purpose),ages:__peds.list.map(q=>q.age)}}));await p.waitForTimeout(400)}return S};
const day=await run(7,14000);const night=await run(1,6000);
await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c2,d='')=>res.push((c2?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const peak=Math.max(...day.map(s=>s.n));console.log('residents',Math.round(info.res),'day peak walkers',peak,'kinds',JSON.stringify([...new Set(day.flatMap(s=>s.kinds))]),'purposes',JSON.stringify([...new Set(day.flatMap(s=>s.purp))]));
ok('people walk in the morning',peak>=2,String(peak));ok('walkers capped',peak<=__cap(),String(peak));
function __cap(){return 160}
ok('kids walk to school',day.some(s=>s.kinds.includes('kid')));
ok('kid ages 6-12 and adults 16+',day.every(s=>s.kinds.every((k,x)=>k==='kid'?s.ages[x]>=6&&s.ages[x]<=12:s.ages[x]>=16)));
ok('walkers keep to the sidewalk (never on the lane centre except crossing)',day.every(s=>s.onLane===0),String(Math.max(...day.map(s=>s.onLane))));
const lateN=night.slice(-3).map(s=>s.n);ok('nobody walking in the small hours',lateN.every(n=>n===0),JSON.stringify(night.map(s=>[s.h,s.n])));
// tooltip on a walker in the day
await p.evaluate(()=>{__fx.setDay(Math.ceil(__city.sim().day/24)*24+7)});await p.evaluate(()=>__city.setSpeed(1));await p.waitForFunction(()=>__peds.list.some(q=>q.s&&q.s.visible),null,{timeout:30000}).catch(()=>{});await p.waitForTimeout(1500);await p.evaluate(()=>__city.setSpeed(0));await p.waitForTimeout(200);
const pt=await p.evaluate(()=>{const q=__peds.list.find(q=>q.s&&q.s.visible);if(!q)return null;const g=q.s.getGlobalPosition();return {x:g.x,y:g.y-6}});
let tip='';if(pt){await p.evaluate(pt=>__city.inspectAt(pt.x,pt.y),pt);await p.waitForTimeout(200);tip=await p.evaluate(()=>document.getElementById('info').innerText)}
console.log('tooltip:',tip.replace(/\n/g,' | '));ok('walker tooltip shows age, home and destination',/Age: \d+/.test(tip)&&/Home|To: home/.test(tip)&&/Going to|From/.test(tip),tip.slice(0,80));
if(shots){await p.mouse.move(pt?pt.x+60:300,pt?pt.y+60:300);await p.keyboard.press('Escape');await p.screenshot({path:'screenshots/peds-day.png'});await p.evaluate(pt=>__city.inspectAt(pt.x,pt.y),pt);await p.screenshot({path:'screenshots/peds-tooltip.png'})}
await p.keyboard.press('Escape');
await p.keyboard.press('Shift+D');await p.click('[data-tab="Transportation"]');await p.waitForTimeout(1200);
const pn=await p.evaluate(()=>({n:document.getElementById('liveWalkN')?.textContent,walk:/Walk \(/.test(document.getElementById('dataBody').innerText)}));ok('City Data shows walkers now and walk trips',pn.n!=null&&pn.walk,JSON.stringify(pn));
if(shots){await p.screenshot({path:'screenshots/peds-data.png'})}await p.keyboard.press('Shift+D');
if(shots){await p.evaluate(()=>{__fx.setDay(Math.ceil(__city.sim().day/24)*24+19)});await p.evaluate(()=>__city.setSpeed(1));await p.waitForTimeout(5000);await p.evaluate(()=>__city.setSpeed(0));await p.waitForTimeout(500);await p.screenshot({path:'screenshots/peds-night.png'})}
ok('no page errors',!errs.length,errs.join(' | '));console.log(res.join('\n'));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
