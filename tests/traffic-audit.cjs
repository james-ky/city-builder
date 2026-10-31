// Traffic audit regressions: avenue crossings connect, avenue halves one-way + lane-aware, bus riders need a real loop, no overlapping spawns, camera-independent sim, edge freight, scaling cap, rush hour.
const {chromium}=require('playwright');const fs=require('fs');(async()=>{const url=process.argv[2]||'http://localhost:4400/',shots=process.argv.includes('--shots');const OUT='screenshots/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1600,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(url+'?size=96&seed=3&city=Audit');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const R0=18;const c=await p.evaluate(R0=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=48-r;i<=48+r;i++)for(let j=48-r;j<=48+r;j++){let g=true;for(let a=-R0;a<=R0&&g;a++)for(let b2=-R0;b2<=R0;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}},R0);

const build=await p.evaluate(([ci,cj,R0])=>{const C=__city,N=C.N();C.sim().funds=1e9;const log=[];
 const road=(w,i0,j0,i1,j1)=>{C.setRoadWidth(w);C.paint('road',i0,j0,i1,j1)};
 const L=[-15,-9,-3,3,9,15];
 // rows: avenue at -3 (2 tiles: -3,-2), street at 9, others 2-lane; cols: avenue at 3, street at -9
 for(const o of L){if(o===-3)road(2,ci-3,cj-15,ci-3,cj+15);else road(o===9?1:0,ci+o,cj-15,ci+o,cj+15)}
 for(const o of L){if(o===3)road(2,ci-15,cj+3,ci+15,cj+3);else road(o===-9?1:0,ci-15,cj+o,ci+15,cj+o)}
 road(0,ci+15,0,ci+15,cj-15);for(let j=0;j<cj-15;j++)if(C.terrain[ci+15][j]==='water')log.push(['edgewater',j]); // to the west map edge
 road(0,ci+5,cj-9,ci+5,cj-3); // rear lane behind shops (shops on ci+4 face main row ci+3)
 // finish construction instantly
 for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.road[i][j]){C.rstage[i][j]=0;C.consT&&0}
 const Z=(i,j,z,d)=>{if(C.road[i][j]||C.terrain[i][j]==='water')return;C.zone[i][j]=z;C.bld[i][j]=d;C.zden[i][j]=d};
 for(let i=ci-14;i<=ci+14;i++)for(let j=cj-14;j<=cj+14;j++){const bi=Math.floor((i-ci+15)/6),bj=Math.floor((j-cj+15)/6);
  let z=(bi+bj)%3===0?'R':(bi*2+bj)%5===0?'C':'R';if(bj===0&&bi>=3)z='I';if(bi===3&&bj===1)z='C';const d=1+((bi*3+bj)%3);Z(i,j,z,d)}
 // shops row ci+4 cols -8..-4 facing NW onto row ci+3, rear lane ci+5
 for(let j=cj-8;j<=cj-4;j++){C.zone[ci+4][j]='C';C.bld[ci+4][j]=1;C.zden[ci+4][j]=1;C.zface[ci+4][j]=4}
 const pl=(t,i,j)=>{for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){/*clear*/}const ok=C.plop(t,i,j);log.push([t,i,j,ok]);return ok};
 for(const [i,j] of [[ci-14,cj+5],[ci-13,cj+5]])for(let a=0;a<2;a++)for(let b=0;b<2;b++){C.zone[i+a][j+b]='';C.bld[i+a][j+b]=0}
 pl('busdepot',ci-14,cj+5);
 for(const [i,j] of [[ci+10,cj+4],[ci-8,cj-14],[ci+1,cj-1]]){C.zone[i][j]='';C.bld[i][j]=0;pl('garage',i,j)}
 for(let a=0;a<3;a++)for(let b=0;b<3;b++){C.zone[ci+10+a][cj-14+b]='';C.bld[ci+10+a][cj-14+b]=0}pl('coal',ci+11,cj-13);for(const [i,j] of [[ci-7,cj-7],[ci+11,cj+11],[ci-13,cj+11],[ci+5,cj+5],[ci-7,cj+11]]){for(let a=0;a<2;a++)for(let b=0;b<2;b++){C.zone[i+a][j+b]='';C.bld[i+a][j+b]=0}pl('pump',i,j)}for(const [i,j] of [[ci-1,cj-13],[ci+7,cj-1]]){C.zone[i][j]='';C.bld[i][j]=0;pl('tower',i,j)}
 // stops along row ci+9 (street) and col cj-9
 for(const [i,j] of [[ci+9,cj-12],[ci+9,cj-6],[ci+9,cj],[ci+9,cj+12],[ci,cj-9],[ci-12,cj-9]])log.push(['stop',i,j,C.toggleStop(i,j)]);
 // mixed controls
 const modes=['light','allstop','twostop','yield','none','auto'];let n=0;for(const a of L)for(const bb of L){const m=modes[n++%modes.length];log.push(['ix',ci+a,cj+bb,m,C.setIx(ci+a,cj+bb,{mode:m,axis:n%2,cyc:45,split:'auto'})])}
 for(let i=0;i<N;i++)for(let j=0;j<N;j++){if(C.road[i][j])C.rstage[i][j]=0;if(C.zone[i][j]){C.pline[i][j]=true;C.pipe[i][j]=true}}
 C.refresh();C.markTripsDirty();C.fastForward(2);C.centerOn(ci,cj);C.setZoom(0.9);log.push(['util',JSON.stringify(C.util).slice(0,300)]);return log},[...c,R0]);

const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const [ci,cj]=c;
const net=await p.evaluate(([ci,cj])=>{const C=__city,T=C.trips(),N=C.N();const s=new Set();for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.road[i][j]&&T.comp[i*N+j]>=0)s.add(T.comp[i*N+j]);return{parts:s.size,north:T.comp[(ci-10)*N+cj-9],south:T.comp[(ci+10)*N+cj-9]}},c);
ok('a road drawn across an existing Avenue connects through the median (one network)',net.parts===1&&net.north===net.south,JSON.stringify(net));
const bw=await p.evaluate(()=>({loop:!!__city.busLoop(),warn:__city.busWarn(),riders:__city.trips().stats.busRiders}));ok('bus loop runs once the network is connected',bw.loop&&!bw.warn,JSON.stringify(bw));
// unconnected stop -> warning and no riders
const bw2=await p.evaluate(()=>{const C=__city,N=C.N();let k=-1;for(let j=2;j<N-2&&k<0;j++)if(C.terrain[3][j]!=='water'&&C.terrain[3][j+1]!=='water'&&!C.road[3][j]){k=j}C.road[3][k]=true;C.road[3][k+1]=true;C.rtier[3][k]=C.rtier[3][k+1]=2;C.rstage[3][k]=C.rstage[3][k+1]=0;C.rw[3][k]=C.rw[3][k+1]=0;C.refresh();C.markTripsDirty();C.fastForward(1);C.toggleStop(3,k);C.markTripsDirty();C.fastForward(1);const o={loop:!!C.busLoop(),warn:C.busWarn(),riders:C.trips().stats.busRiders};C.toggleStop(3,k);C.markTripsDirty();C.fastForward(1);return o});
ok('stops that are not connected: no buses, no riders, visible warning',!bw2.loop&&bw2.riders===0&&/connected/.test(bw2.warn),JSON.stringify(bw2));
const fe=await p.evaluate(()=>{const C=__city,T=C.trips(),N=C.N();const e=T.flows.filter(f=>f.kind==='freight'&&(f.dest%N===0||((f.dest/N)|0)===0));const q=e.map(f=>C.pathOf(f)).filter(Boolean);return{n:q.length,atEdge:q.filter(r=>r[r.length-1]%N===0||((r[r.length-1]/N)|0)===0).length}});
ok('edge freight drives all the way to the map-edge tile',fe.n>0&&fe.atEdge===fe.n,JSON.stringify(fe));
const cap=await p.evaluate(()=>{__city.spawnTrips();return __city.maxCars()});ok('car cap scales with the city',cap>320,String(cap));
const curve=await p.evaluate(()=>{const T=__city.trips();const h=[];for(let x=0;x<24;x++)h.push(Math.round(T.departures(x,0,Math.random).total));return h});
const peak=Math.max(...curve.slice(6,10)),pm=Math.max(...curve.slice(15,19)),night=Math.max(...curve.slice(0,5));ok('demand has a morning and evening rush hour over a quiet night',peak>2*night&&pm>2*night,curve.join(','));
// run traffic
await p.evaluate(()=>{__fx.setDay(5*24+6);__city.setSpeed(2)});const k0=await p.evaluate(()=>__city.carClock());await p.waitForFunction(k0=>__city.carClock()>k0+12,k0,{timeout:240000});
const sp=await p.evaluate(()=>{let ov=0;const cs=__fx.cars;for(let a=0;a<cs.length;a++)for(let b=a+1;b<cs.length;b++){const A=cs[a],B=cs[b];if(A.pi===B.pi&&A.pj===B.pj&&A.i===B.i&&A.j===B.j&&(A.ln??0)===(B.ln??0)&&Math.abs(A.t-B.t)<0.05&&A.t<0.3)ov++}return{ov,n:cs.length}});
ok('new cars never spawn on top of each other',sp.ov===0&&sp.n>20,JSON.stringify(sp));
const av=await p.evaluate(()=>{const C=__city,N=C.N(),m={};for(const c of __fx.cars){if(C.rw[c.i][c.j]<2||!C.rpd[c.i][c.j]||C.rw[c.pi][c.pj]<2)continue;const pd=C.rpd[c.i][c.j],along=(pd===2||pd===8)?c.pi===c.i:c.pj===c.j;if(!along)continue;const d=c.i-c.pi+','+(c.j-c.pj);const k=c.i+':'+c.j;(m[k]=m[k]||new Set()).add(d)}let both=0,n=0,bt=[];for(const k in m){n++;if(m[k].size>1){both++;bt.push(k+'='+[...m[k]].join('|')+':'+C.rpd[+k.split(':')[0]][+k.split(':')[1]])}}
 let ov=0;const cs=__fx.cars.filter(c=>C.rw[c.i][c.j]>=2&&c.s.visible!==undefined);for(let a=0;a<cs.length;a++)for(let b=a+1;b<cs.length;b++){const A=cs[a],B=cs[b];if(A.s&&B.s&&Math.hypot(A.s.x-B.s.x,A.s.y-B.s.y)<2.5)ov++}return{tiles:n,both,ov,bt,n:cs.length}});
ok('each Avenue half carries one direction only',av.tiles>0&&av.both===0,JSON.stringify(av));
ok('Avenue lanes drawn side by side (overlaps under 5% of avenue cars)',av.ov<=Math.max(3,av.n*0.05),JSON.stringify(av));
if(shots){await p.evaluate(([ci,cj])=>{__city.setSpeed(0);__city.centerOn(ci+3,cj+3.5);__city.setZoom(4)},c);await p.waitForTimeout(1500);await p.screenshot({path:OUT+'avenue-lanes.png'});await p.evaluate(([ci,cj])=>{__city.centerOn(ci,cj);__city.setZoom(0.9);__city.setSpeed(2)},c)}
// camera independence
const before=await p.evaluate(()=>{__city.setSpeed(0);return __fx.cars.length});
await p.evaluate(()=>{__city.centerOn(2,2);__city.setZoom(0.1);__city.setSpeed(2)});const k1=await p.evaluate(()=>__city.carClock());await p.waitForFunction(k1=>__city.carClock()>k1+6,k1,{timeout:240000});
const after=await p.evaluate(()=>{__city.setSpeed(0);return{n:__fx.cars.length,sp:__city.failed().spawned}});
ok('panning/zooming far away keeps the traffic sim running',after.n>=before*0.6&&after.n>20,JSON.stringify({before,after}));
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs.slice(0,5));process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
