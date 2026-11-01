// Driver ages + car counts audit (James: "something off about how many cars are on the road"). Builds a small city, runs a game day,
// and at every sampled hour checks: every car has a driver 16+, resident cars (× scale) never exceed driving-age residents, age bands add up.
// Also: the car tooltip shows driver age / trip purpose, and there is one Budget panel (menu + City data tray open the same one; no Budget tab).
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4192/',shots=process.argv.includes('--shot');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=3&city=Ages');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const c=await p.evaluate(()=>{const t=__city.terrain,N=__city.N();for(let r=0;r<30;r++)for(let i=N-12-r;i>=10;i--)for(let j=8;j<20;j++){let g=true;for(let a=-6;a<=6&&g;a++)for(let b2=-8;b2<=8;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
const info=await p.evaluate(([ci,cj])=>{const C=__city,N=C.N();C.sim().funds=1e9;C.setRoadWidth(0);C.paint('road',ci,0,ci,cj+30);
 for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.road[i][j])C.rstage[i][j]=0;const Z=(i,j,z,d)=>{C.zone[i][j]=z;C.bld[i][j]=d;C.zden[i][j]=d};
 for(let x=0;x<20;x++)Z(x%2?ci+1:ci-1,cj-6+(x>>1),'R',2);for(let x=0;x<3;x++)Z(ci+1,cj+22+x,'C',1);for(let x=0;x<3;x++)Z(ci-1,cj+22+x,'C',2);Z(ci+1,cj+28,'I',1);Z(ci-1,cj+28,'I',1);
 C.markTripsDirty();C.fastForward(2);C.centerOn(ci,cj+8);C.setZoom(2.2);return {res:C.trips().stats.residents}},c);
await p.evaluate(()=>{__fx.setDay(Math.ceil(__city.sim().day/24)*24+5)});await p.evaluate(()=>__city.setSpeed(3));
const samples=[];let d0=await p.evaluate(()=>__city.sim().day);const t0=Date.now();
while(Date.now()-t0<200000){const s=await p.evaluate(()=>{const d=__drivers(),cs=__city.cars(),sc=cs.find(c=>c.trip)?.trip?.scale??1;const kinds={};for(const c of cs){const k=c.bus?'service':c.trip?.kind||'none';kinds[k]=(kinds[k]||0)+1}
  const homes={};let homeOver=0;for(const c of cs)if(c.trip&&c.trip.kind!=='freight')homes[c.trip.home]=(homes[c.trip.home]||0)+1;const N=__city.N();for(const [k,v] of Object.entries(homes)){if(v*sc>Math.max(1,Math.floor(__city.trips().w.residents(k/N|0,k%N)*0.8+1e-6))*sc)homeOver++}
  return {h:__city.sim().day%24,n:cs.length,res:d.res,pro:d.pro,bad:d.bad,bands:d.bands,adults:d.adults,ratio:d.adults?d.res*sc/d.adults:0,kinds,homeOver}});samples.push(s);if(s.day-d0>=24)break;
  if(await p.evaluate(d0=>__city.sim().day-d0>=24,d0))break;await p.waitForTimeout(300)}
const byH={};for(const s of samples){const k=Math.floor(s.h);if(!byH[k]||s.n>byH[k].n)byH[k]=s}
console.log('residents',Math.round(info.res));for(const [h,s] of Object.entries(byH))console.log(`h${h} cars ${s.n} resident ${s.res} pro ${s.pro} bad ${s.bad} bands ${s.bands} ratio ${s.ratio.toFixed(2)} ${JSON.stringify(s.kinds)}`);
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
ok('every vehicle has a driver aged 16+',samples.every(s=>s.bad===0),JSON.stringify(samples.find(s=>s.bad)||''));
ok('resident cars never exceed driving-age residents',samples.every(s=>s.ratio<=1.0001),Math.max(...samples.map(s=>s.ratio)).toFixed(2));
ok('no home has more cars than people 16+',samples.every(s=>!s.homeOver));
ok('age bands add up to resident cars',samples.every(s=>s.bands.reduce((a,b)=>a+b,0)===s.res));
ok('morning and evening rush both show up',[6,7,8].some(h=>byH[h]?.n>=3)&&[16,17,18,19].some(h=>byH[h]?.n>=3));ok('peak cars on screen ≤ 10% of residents (realistic drive times)',Math.max(...samples.map(s=>s.n))<=info.res*0.1,String(Math.max(...samples.map(s=>s.n))));
ok('rush hour has traffic',Math.max(...samples.map(s=>s.n))>=5,String(Math.max(...samples.map(s=>s.n))));
// panel
await p.evaluate(()=>{__fx.setDay(Math.ceil(__city.sim().day/24)*24+7)});await p.waitForTimeout(2500);await p.evaluate(()=>__city.setSpeed(0));
await p.keyboard.press('Shift+D');await p.click('[data-tab="Transportation"]');await p.waitForTimeout(1200);
const pn=await p.evaluate(()=>({bad:document.getElementById('liveVehBad')?.textContent,ratio:document.getElementById('liveVehRatio')?.textContent,budgetTab:!!document.querySelector('#dataTabs [data-tab="Budget"]')}));
ok('panel shows driver ages, 0 bad drivers, a ratio',pn.bad==='0'&&!!pn.ratio,JSON.stringify(pn));ok('City data has no duplicate Budget tab',!pn.budgetTab);
if(shots){await p.mouse.move(300,300);await p.screenshot({path:'screenshots/driver-ages-panel.png'})}
await p.keyboard.press('Shift+D');
// car tooltip
const pt=await p.evaluate(()=>{const cs=__city.cars().filter(c=>c.trip&&c.trip.kind!=='freight'&&c.s.visible);const c=cs[0]||__city.cars().find(c=>c.trip&&c.s.visible);if(!c)return null;const g=c.s.getGlobalPosition();return {x:g.x,y:g.y-2,kind:c.trip.kind}});
let tip='';if(pt){const ok2=await p.evaluate(pt=>{const r=__city.inspectAt?__city.inspectAt(pt.x,pt.y):null;return !!r},pt).catch(()=>false);if(!ok2){await p.evaluate(()=>__city.setTool&&__city.setTool('select'));await p.keyboard.press('1');await p.mouse.click(pt.x,pt.y)}await p.waitForTimeout(300);tip=await p.evaluate(()=>document.getElementById('info').innerText)}
console.log('tooltip:',tip.replace(/\n/g,' | '));ok('car tooltip shows driver and trip purpose',/Driver:/.test(tip)&&/Trip:/.test(tip)&&/Home|From/.test(tip),tip.slice(0,80));
if(shots){await p.mouse.move(pt?pt.x+40:300,pt?pt.y+40:300);await p.screenshot({path:'screenshots/car-tooltip.png'})}
await p.keyboard.press('Escape');
// one budget panel: menu and data tray both open #budget
await p.click('#uMenuBtn');await p.locator('#uMenu button').nth(2).click();await p.waitForTimeout(300);
const m1=await p.evaluate(()=>({b:document.getElementById('budget').style.display,d:document.getElementById('dataPanel').style.display,hist:!!document.querySelector('#budget #histCv')}));
if(shots){await p.mouse.move(300,300);await p.screenshot({path:'screenshots/budget-panel.png'})}
await p.keyboard.press('b');await p.click('#uBar button[data-c="data"]');await p.locator('#uTray button').first().click();await p.waitForTimeout(300);
const m2=await p.evaluate(()=>({b:document.getElementById('budget').style.display,d:document.getElementById('dataPanel').style.display}));
ok('menu opens the one Budget panel (with history)',m1.b==='block'&&m1.d==='none'&&m1.hist,JSON.stringify(m1));ok('City data tray opens the same Budget panel',m2.b==='block'&&m2.d==='none',JSON.stringify(m2));
ok('no page errors',!errs.length,errs.join(' | '));console.log(res.join('\n'));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
