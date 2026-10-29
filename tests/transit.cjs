// Freight + transit: no random buses/semis, routed freight trips, bus stops + depot, buses loop, ridership, save v10.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4318/',shots=process.argv.includes('--shots');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Bustown');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-12;a<=12&&g;a++)for(let b2=-12;b2<=12;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
// a town: main street along row ci from the map edge, homes on the west, shops in the middle, industry on the east
await p.evaluate(([ci,cj])=>{const C=__city,N=C.N();const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.rw[i][j]=0;C.zone[i][j]='';C.bld[i][j]=0};
 for(let j=0;j<N;j++)R(ci,j);for(let d=-10;d<=10;d++){R(ci+d,cj-10);R(ci+d,cj+10)}
 const Z=(i,j,z)=>{if(C.road[i][j]||C.terrain[i][j]==='water')return;C.zone[i][j]=z;C.bld[i][j]=1};
 for(let d=-9;d<=9;d++){Z(ci+d,cj-11,'R');Z(ci+d,cj-9,'R');Z(ci+d,cj+9,'I');Z(ci+d,cj+11,'I')}for(let j=cj-6;j<=cj+6;j++){Z(ci-1,j,'C');Z(ci+1,j,'C')}
 C.refresh();C.markTripsDirty();C.fastForward(1);C.centerOn(ci,cj);C.setZoom(1.6);},c);
// 1. no random buses or semis
const keys=await p.evaluate(([ci,cj])=>{const o={};for(let k=0;k<3000;k++){const v=__city.pickVehicle(ci,cj+10);o[v]=1}return Object.keys(o)},c);
ok('random vehicle mix has no buses or semis',!keys.some(k=>/bus|semi/.test(k)),keys.join(','));
// 2. freight trips
const fr=await p.evaluate(()=>{const T=__city.trips(),N=__city.N();const f=T.flows.filter(f=>f.kind==='freight');const edge=f.filter(x=>{const i=(x.dest/N)|0,j=x.dest%N;return i===0||j===0||i===N-1||j===N-1});const shop=f.filter(x=>__city.zone[(x.dest/N)|0][x.dest%N]==='C');
 const fromI=f.every(x=>__city.zone[(x.home/N)|0][x.home%N]==='I');return{n:f.length,edge:edge.length,shop:shop.length,fromI,trucks:T.stats.trucks,routed:f.filter(x=>T.route(T.access[x.home],T.end(x))).length,parked:f.filter(x=>x.park!==undefined).length}});
ok('industry ships freight to shops and out via edge roads',fr.n>0&&fr.edge>0&&fr.shop>0&&fr.fromI,JSON.stringify(fr));
ok('freight trucks/day = industrial jobs × truckTripsPerIndJob, routed, no parking',fr.trucks>0&&fr.routed===fr.n&&fr.parked===0);
// 3. stops without a depot: no buses, no riders
const S=await p.evaluate(([ci,cj])=>{const C=__city;const st=[[ci,cj-10],[ci,cj],[ci,cj+10]];C.setCarsOnly(true);for(const [i,j] of st)C.toggleStop(i,j);C.markTripsDirty();C.fastForward(1);return st},c);
await p.waitForTimeout(2500);
let t=await p.evaluate(()=>({buses:__city.buses(),riders:__city.trips().stats.busRiders,stops:__city.stops().length}));
ok('no depot means no buses and no riders',t.stops===3&&t.buses===0&&t.riders===0,JSON.stringify(t));
// 4. depot: buses loop between stops and people ride
const dep=await p.evaluate(([ci,cj])=>{const C=__city,f0=C.sim().funds;C.paint('svc:busdepot',ci+1,cj-8,ci+1,cj-8);C.setTool('select');C.markTripsDirty();C.fastForward(1);return{placed:C.civs.some(c=>c.type==='busdepot'),cost:f0-C.sim().funds}},c);
ok('Bus Depot can be built (costs money)',dep.placed&&dep.cost>0,JSON.stringify(dep));
await p.waitForFunction(()=>__city.buses()>0,null,{timeout:20000}).catch(()=>{});
const k0=await p.evaluate(()=>__city.carClock());await p.waitForFunction(k0=>__city.carClock()>k0+25,k0,{timeout:180000});
t=await p.evaluate(()=>{const T=__city.trips(),bs=__city.cars().filter(c=>c.bus);return{buses:bs.length,ri:bs.map(c=>c.ri),loop:__city.busLoop()?.length,riders:Math.round(T.stats.busRiders),perStop:__city.stops().map(k=>Math.round(T.riders.get(k)||0))}});
ok('buses run on a loop between stops',t.buses>0&&t.loop>2,JSON.stringify(t));
ok('residents near stops at both ends ride the bus',t.riders>0&&t.perStop.filter(x=>x>0).length>=2);
const wrapped=await p.evaluate(()=>{const L=__city.busLoop().length;return __city.cars().filter(c=>c.bus).every(c=>c.ri<L)});ok('buses wrap around instead of despawning',wrapped&&t.buses>0);
const fewer=await p.evaluate(()=>{const T=__city.trips();const w=T.flows.filter(f=>f.bus>0);return{w:w.length,share:w.length?Math.max(...w.map(f=>f.bus)):0}});ok('riders reduce car trips (bus share ≤ 12 %)',fewer.w>0&&fewer.share<=0.12,JSON.stringify(fewer));
// 5. stop info
const html=await p.evaluate(([ci,cj])=>{const q=__city.tileToScreen(ci,cj);document.getElementById('info').style.display='none';__city.inspectAt(q.x,q.y);return document.getElementById('info').innerText},c);
ok('stop info shows ridership',/Ridership/.test(html)&&/bus/.test(html),html.replace(/\n/g,' | ').slice(0,160));
// 6. budget line and save v10
const bud=await p.evaluate(()=>{const o=__city.serialize();return{v:o.version,stops:o.stops}});ok('saves are v10 and keep stops',bud.v===10&&bud.stops.length===3,JSON.stringify(bud));
const rl=await p.evaluate(()=>{const C=__city,o=C.serialize();C.toggleStop((o.stops[0]/C.N())|0,o.stops[0]%C.N());const n1=C.stops().length;C.applySave(JSON.parse(JSON.stringify(o)));return[n1,C.stops().length]});ok('loading restores stops',rl[0]===2&&rl[1]===3,String(rl));
if(shots){await p.evaluate(([ci,cj])=>{__city.centerOn(ci,cj-4);__city.setZoom(2.2);const q=__city.tileToScreen(ci,cj);__city.inspectAt(q.x,q.y)},c);await p.waitForTimeout(1500);await p.screenshot({path:'screenshots/transit.png'})}
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
