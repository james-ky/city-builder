// Vehicle count realism (James: 50 pop, 64 vehicles): one car per person at a time, per-flow cap, panel splits residents / outside / freight. Also a tool: ~50-pop city, one game day, cars broken down by type/purpose, per-home concurrency.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4191/',nR=+(process.argv[3]||16);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=3&city=Fifty');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const c=await p.evaluate(()=>{const t=__city.terrain,N=__city.N();for(let r=0;r<30;r++)for(let i=N-12-r;i>=10;i--)for(let j=8;j<20;j++){let g=true;for(let a=-6;a<=6&&g;a++)for(let b2=-8;b2<=8;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
const info=await p.evaluate(([ci,cj,nR])=>{const C=__city,N=C.N();C.sim().funds=1e9;C.setRoadWidth(0);
 C.paint('road',ci,0,ci,cj+30); // street from the west map edge
 for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.road[i][j])C.rstage[i][j]=0;
 const Z=(i,j,z,d)=>{C.zone[i][j]=z;C.bld[i][j]=d;C.zden[i][j]=d};
 for(let x=0;x<nR;x++)Z(x%2?ci+1:ci-1,cj-6+(x>>1),'R',1);for(let x=0;x<3;x++)Z(ci+1,cj+22+x,'C',1);for(let x=0;x<3;x++)Z(ci-1,cj+22+x,'C',2);Z(ci+1,cj+28,'I',1);Z(ci-1,cj+28,'I',1);
 C.markTripsDirty();C.fastForward(2);return {pop:C.sim().pop,st:C.trips().stats}},[...c,nR]);
console.log('city',JSON.stringify({pop:info.pop,res:Math.round(info.st.residents*10)/10,workers:+info.st.workers.toFixed(1),employed:+info.st.employed.toFixed(1),trucks:+info.st.trucks.toFixed(1)}));
const flows=await p.evaluate(()=>__city.trips().flows.map(f=>({k:f.kind,p:+f.people.toFixed(2),h:f.home})));
const agg={};for(const f of flows){agg[f.k]=(agg[f.k]||0)+f.p}console.log('flows people/day',JSON.stringify(agg));
await p.evaluate(()=>{__fx.setDay(Math.ceil(__city.sim().day/24)*24+5)});await p.evaluate(s=>__city.setSpeed(s),+(process.argv[4]||3));
let bad=[];let peak={n:0},hours={},maxHome=0,maxHomeRes=0,dup=0;const t0=Date.now();let d0=await p.evaluate(()=>__city.sim().day);
while(Date.now()-t0<240000){const s=await p.evaluate(()=>{const C=__city,cs=C.cars(),N=C.N(),T={},P={},home={};for(const c of cs){const ty=/^veh_(.+)_[a-z]$/.exec(c.key)?.[1]||'?';T[ty]=(T[ty]||0)+1;const k=c.bus?'bus':c.trip?.kind||'none';P[k]=(P[k]||0)+1;if(c.trip&&c.trip.kind!=='freight'){home[c.trip.home]=(home[c.trip.home]||0)+1}}
 let mh=0,mhr=0;for(const [k,v] of Object.entries(home)){const r=C.trips().w.residents(k/N|0,k%N);if(v/Math.max(1,r)>mh/Math.max(1,mhr)||!mhr){mh=v;mhr=r}}
 const fl=new Map();let over=0,noTrip=0;for(const c of cs){if(c.bus)continue;if(!c.trip){noTrip++;continue}const f=c.trip.f;if(f)fl.set(f,(fl.get(f)||0)+1)}
 for(const [f,v] of fl){const cap=Math.max(1,Math.ceil(f.people*({work:0.85,school:0.45,errand:0.85,leisure:0.7,freight:1})[f.kind]*(1-(f.bus||0))/(f.kind==='freight'?1:1.1)-1e-6));if(v>cap)over++}
 let homeOver=0;for(const [k,v] of Object.entries(home)){const r=C.trips().w.residents(k/N|0,k%N);if(v>Math.max(1,Math.floor(r*0.82+1e-6)))homeOver++}
 return {day:C.sim().day,n:cs.length,T,P,mh,mhr,pop:C.sim().pop,over,noTrip,homeOver}});if(s.over||s.noTrip||s.homeOver)bad.push(s);
 if(s.n>peak.n)peak=s;const h=s.day%24;hours[h]=Math.max(hours[h]||0,s.n);if(s.mh>maxHome){maxHome=s.mh;maxHomeRes=s.mhr}if(s.day-d0>=26)break;await p.waitForTimeout(0);await p.waitForTimeout(250)}
console.log('peak',JSON.stringify(peak));console.log('max cars by hour',JSON.stringify(hours));console.log('max cars from one home',maxHome,'residents there',maxHomeRes);
await p.evaluate(s=>__city.setSpeed(0));await p.keyboard.press('Shift+D');await p.click('[data-tab="Transportation"]');await p.waitForTimeout(1200);
const pn=await p.evaluate(()=>({tot:+document.getElementById('liveVehN').textContent.replace(/,/g,''),res:+document.getElementById('liveVehRes').textContent,out:+document.getElementById('liveVehOut').textContent,fr:+document.getElementById('liveVehFr').textContent,n:__city.cars().length}));
if(process.argv.includes('--shot')){await p.evaluate(()=>document.getElementById('liveVehN').parentElement.parentElement.scrollIntoView({block:'start'}));await p.mouse.move(300,300);await p.waitForTimeout(300);await p.screenshot({path:'screenshots/vehicle-count-panel.png'})}
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
ok('no flow has more cars out than its people can drive',!bad.some(x=>x.over),JSON.stringify(bad[0]||''));
ok('no home has more cars out than adult residents',!bad.some(x=>x.homeOver));ok('every non-bus car is a real trip',!bad.some(x=>x.noTrip));
ok('peak vehicles stay below residents',peak.n<info.st.residents,peak.n+' vs '+Math.round(info.st.residents));
ok('panel split adds up to the total',pn.res+pn.out+pn.fr===pn.tot&&pn.tot===pn.n,JSON.stringify(pn));
ok('no page errors',!errs.length,errs.join(' | '));console.log(res.join('\n'));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
