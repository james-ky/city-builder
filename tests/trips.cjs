// Agent-based trips: deterministic assignment, reachability, routes on roads, cars are real trips, query tools.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=128&seed=3&city=Tripville');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<60;r++)for(let i=64-r;i<=64+r;i++)for(let j=64-r;j<=64+r;j++){let g=true;for(let a=-12;a<=12&&g;a++)for(let b2=-12;b2<=12;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
// two parallel roads 6 apart (not connected); homes along A, shops/offices along B, a school on A
await p.evaluate(([ci,cj])=>{const C=__city;const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.zone[i][j]='';C.bld[i][j]=0};
 for(let i=ci-10;i<=ci+10;i++){R(i,cj-3);R(i,cj+3)}
 for(let i=ci-9;i<=ci+9;i++){C.zone[i][cj-4]='R';C.bld[i][cj-4]=2;C.zone[i][cj+4]='C';C.bld[i][cj+4]=1}
 C.markTripsDirty();C.fastForward(1)},c);
let st=await p.evaluate(()=>__city.trips().stats);ok('disconnected: workers have no reachable job',st.noJobReachable>0&&st.employed===0,JSON.stringify({u:Math.round(st.noJobReachable),e:st.employed}));
// connect with a cross street
await p.evaluate(([ci,cj])=>{const C=__city;for(let j=cj-2;j<=cj+2;j++){C.road[ci][j]=true;C.rtier[ci][j]=2;C.rstage[ci][j]=0;C.zone[ci][j]='';C.bld[ci][j]=0}C.markTripsDirty();C.fastForward(1)},c);
st=await p.evaluate(()=>__city.trips().stats);ok('connected: workers get jobs',st.employed>0&&st.noJobReachable===0,Math.round(st.employed));
const chk=await p.evaluate(()=>{const T=__city.trips(),N=__city.N();let bad=0,n=0,dest=0;for(const f of T.flows){const r=T.route(T.access[f.home],T.access[f.dest]);if(!r){bad++;continue}n++;
 const di=(f.dest/N|0),dj=f.dest%N;if(f.kind==='work'&&!['C','I'].includes(__city.zone[di][dj]))dest++;
 for(let k=0;k<r.length;k++){const i=r[k]/N|0,j=r[k]%N;if(!__city.road[i][j])bad++;if(k){const pi=r[k-1]/N|0,pj=r[k-1]%N;if(Math.abs(pi-i)+Math.abs(pj-j)!==1)bad++}}}return {bad,n,dest}});
ok('every route follows connected road tiles',chk.bad===0&&chk.n>0,JSON.stringify(chk));ok('work trips end at job buildings',chk.dest===0);
const det=await p.evaluate(()=>{const T=__city.trips();T.assign(5);const a=JSON.stringify(T.flows);T.assign(5);const b2=JSON.stringify(T.flows);T.assign(6);return [a===b2,a.length]});ok('assignment is deterministic',det[0],det[1]+' chars');
// cars are trips
await p.evaluate(([ci,cj])=>{__city.setZoom(1.5);__city.centerOn(ci,cj);__fx.setDay(31*24+7)},c);await p.waitForTimeout(400);
for(let h=0;h<4;h++){await p.evaluate(()=>{__city.sim().day++;__city.spawnTrips()})}
await p.evaluate(()=>__city.setSpeed(1));await p.waitForTimeout(2500);await p.evaluate(()=>__city.setSpeed(0));
const cs=await p.evaluate(()=>{const cs=__city.cars();return {n:cs.length,trip:cs.filter(c=>c.trip&&c.route).length,on:cs.filter(c=>c.route.includes(c.i*__city.N()+c.j)).length}});
ok('morning cars exist and all are routed trips',cs.n>0&&cs.trip===cs.n&&cs.on===cs.n,JSON.stringify(cs));
const ci2=await p.evaluate(()=>{const c=__city.cars().find(c=>c.s.visible);if(!c)return null;const w=__city.layers.groundL.parent;const x=c.s.x*w.scale.x+w.position.x,y=(c.s.y-2)*w.scale.y+w.position.y;__city.inspectAt(x,y);return document.getElementById('info').innerText});
ok('clicking a car shows who/where',!!ci2&&/min/.test(ci2)&&/(Going to|heading home)/.test(ci2),ci2&&ci2.replace(/\n/g,' | '));
const bi=await p.evaluate(([ci,cj])=>{const s=__city.tileToScreen(ci-5,cj-4);__city.inspectAt(s.x,s.y);return document.getElementById('info').innerText},c);
ok('clicking a home shows commutes',/Where residents go/.test(bi)&&/min drive|walk/.test(bi),bi.replace(/\n/g,' | '));
await p.evaluate(()=>{__city.fastForward(40);__city.setCovView('traffic')});const vol=await p.evaluate(()=>{let s=0;for(const v of __city.trips().volume)s+=v;return s});ok('traffic volume map fills',vol>0,Math.round(vol)+' veh/day');
const sv=await p.evaluate(()=>{const o=JSON.parse(JSON.stringify(__city.serialize()));const v=o.version;__city.applySave(o);let s=0;for(const x of __city.trips().volume)s+=x;delete o.traffic;o.version=4;__city.applySave(o);return [v,s>0]});ok('save v5 keeps traffic; v4 loads',sv[0]===5&&sv[1],JSON.stringify(sv));
ok('no page errors',!errs.length,errs.join(' | '));console.log(res.join('\n'));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
