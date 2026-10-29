// Parking: drivers park near dense destinations, shortfalls grow private lots, city garages fill and earn fees.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=128&seed=3&city=Parkville');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<60;r++)for(let i=64-r;i<=64+r;i++)for(let j=64-r;j<=64+r;j++){let g=true;for(let a=-14;a<=14&&g;a++)for(let b2=-14;b2<=14;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});const [ci,cj]=c;
// suburbs on a loop road 12 tiles away, downtown towers on a main street, a few empty C lots
await p.evaluate(([ci,cj])=>{const C=__city;const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.zone[i][j]='';C.bld[i][j]=0};
 for(let i=ci-12;i<=ci+12;i++){R(i,cj);R(i,cj+12)} for(let j=cj;j<=cj+12;j++)R(ci-12,j);
 for(let i=ci-11;i<=ci+11;i++){C.zone[i][cj+13]='R';C.bld[i][cj+13]=3;C.zone[i][cj+11]='R';C.bld[i][cj+11]=2}
 for(let i=ci-6;i<=ci+3;i++){C.zone[i][cj-1]='C';C.bld[i][cj-1]=3}for(let i=ci-6;i<=ci+6;i++){C.zone[i][cj+1]='C';C.bld[i][cj+1]=i%3?2:0}
 C.markTripsDirty();C.fastForward(1)},c);
let st=await p.evaluate(()=>{const s=__city.trips().stats;let u=0;for(const v of __city.trips().unmet)u+=v;return {...s,unmet:u}});
ok('downtown without parking: cars go unparked and shoppers are lost',st.unmet>0&&st.lostShoppers>0,JSON.stringify({unmet:Math.round(st.unmet),lost:Math.round(st.lostShoppers),parked:Math.round(st.parkedCars)}));
ok('street parking used near destinations',st.parkedCars>0);
const hunt=await p.evaluate(()=>__city.trips().flows.some(f=>f.extraMin>0));ok('drivers without a space take longer (hunting)',hunt);
const g1=await p.evaluate(()=>__city.growParking());await p.evaluate(()=>__city.trips().assign(1));
const st2=await p.evaluate(()=>{let u=0;for(const v of __city.trips().unmet)u+=v;let n=0;for(const r of __city.pk)for(const v of r)if(v)n++;return {u,n}});
ok('private parking grows where demand is high',g1>0&&st2.n>0,JSON.stringify({grew:g1,...st2}));ok('shortfall drops after it grows',st2.u<st.unmet,Math.round(st.unmet)+' -> '+Math.round(st2.u));
// city garage
await p.evaluate(()=>{__city.sim().funds+=20000});
const gk=await p.evaluate(([ci,cj])=>{for(const [a,b] of [[ci+5,cj-2],[ci+6,cj-2]])if(__city.plop('garage2',a,b))return [a,b];return null},c);
ok('big city garage placed',!!gk,JSON.stringify(gk));
await p.evaluate(()=>{__city.markTripsDirty();__city.fastForward(1)});
const gs=await p.evaluate(()=>{const T=__city.trips(),N=__city.N();const g=__city.civs.find(x=>x.type==='garage2');const k=g.i*N+g.j;const fl=T.flows.filter(f=>f.park===k);
 const r=fl[0]&&T.route(T.access[fl[0].home],T.end(fl[0]));return {occ:T.occ[k],cap:T.spaces[k],n:fl.length,ends:r?r[r.length-1]===T.access[k]:false,income:__city.parkingIncome(),k}});
ok('garage fills with drivers and trips end there',gs.occ>0&&gs.n>0&&gs.ends,JSON.stringify(gs));ok('garage earns fees',gs.income>0,'$'+gs.income.toFixed(1)+'/mo');
const txt=await p.evaluate(([ci,cj])=>{const g=__city.civs.find(x=>x.type==='garage2');const s=__city.tileToScreen(g.i,g.j);__city.setZoom(1);__city.centerOn(g.i,g.j);return null},c);
await p.waitForTimeout(300);const info=await p.evaluate(()=>{const g=__city.civs.find(x=>x.type==='garage2');const s=__city.tileToScreen(g.i,g.j);__city.inspectAt(s.x,s.y);return document.getElementById('info').innerText});
ok('garage shows occupancy readout',/Occupancy/.test(info)&&/spaces at peak/.test(info),info.replace(/\n/g,' | '));
if(process.env.SHOT){await p.evaluate(([ci,cj])=>{__city.setZoom(2);__city.centerOn(ci+2,cj);__fx.setDay(24*40+8)},c);await p.waitForTimeout(1500);const g=await p.evaluate(()=>{const g=__city.civs.find(x=>x.type==='garage2');const s=__city.tileToScreen(g.i,g.j);__city.inspectAt(s.x,s.y)});await p.waitForTimeout(300);await p.screenshot({path:'screenshots/parking.png'})}
const sv=await p.evaluate(()=>{const o=JSON.parse(JSON.stringify(__city.serialize()));let n0=0;for(const r of __city.pk)for(const v of r)n0+=!!v;__city.applySave(o);let n1=0;for(const r of __city.pk)for(const v of r)n1+=!!v;delete o.grids.pk;o.version=5;__city.applySave(o);let n2=0;for(const r of __city.pk)for(const v of r)n2+=!!v;return [o.version,n0,n1,n2]});
ok('save v6 keeps private parking; v5 loads',sv[1]>0&&sv[1]===sv[2]&&sv[3]===0,JSON.stringify(sv));
ok('no page errors',!errs.length,errs.join(' | '));console.log(res.join('\n'));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
