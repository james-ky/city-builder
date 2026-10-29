// Jams drain: build a gridlock with lots of cars on a small grid, stop new trips (off-peak) and check the queues clear.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/',shots=process.argv.includes('--shots');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Jamtown');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-9;a<=9&&g;a++)for(let b2=-9;b2<=9;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
await p.evaluate(([ci,cj])=>{const C=__city;const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.rw[i][j]=0;C.zone[i][j]='';C.bld[i][j]=0};
 for(let d=-8;d<=8;d++)for(const o of [-8,-4,0,4,8]){R(ci+o,cj+d);R(ci+d,cj+o)}C.refresh();C.markTripsDirty();C.fastForward(1);C.centerOn(ci+2,cj+2);C.setZoom(3);C.setCarsOnly(true);__fx.setDay(36);},c);
await p.waitForTimeout(800);
const spawn=n=>p.evaluate(([ci,cj,n])=>{const C=__city,N=C.N(),T=C.trips();const pts=[];for(let d=-8;d<=8;d++)for(const o of [-8,-4,0,4,8]){pts.push((ci+o)*N+cj+d,(ci+d)*N+cj+o)}let m=0;
 for(let k=0;k<n*3&&m<n;k++){const a=pts[(Math.random()*pts.length)|0],z=pts[(Math.random()*pts.length)|0];const r=T.route(a,z);if(r&&r.length>6){C.spawnCar(r);m++}}return C.cars().length},[...c,n]);
// peak: pour cars in for 20 s
let peakMax=0,stuckPeak=0;for(let s=0;s<10;s++){await spawn(40);const k0=await p.evaluate(()=>__city.carClock());await p.waitForFunction(k0=>__city.carClock()>k0+2,k0,{timeout:120000});const st=await p.evaluate(()=>{const cs=__city.cars();return{n:cs.length,stuck:cs.filter(c=>(c.stuck||0)>3).length}});peakMax=Math.max(peakMax,st.n);stuckPeak=Math.max(stuckPeak,st.stuck)}
ok('a jam forms at peak',stuckPeak>20,JSON.stringify({peakMax,stuckPeak}));
if(shots){await p.screenshot({path:'screenshots/jam-peak.png'})}
// off-peak: no new trips; queues must drain
const c0=await p.evaluate(()=>__city.carClock());let t=0,left=0;for(let k=0;k<120;k++){await p.waitForTimeout(5000);const r=await p.evaluate(()=>({n:__city.cars().length,c:__city.carClock()}));left=r.n;t=r.c-c0;if(left<=3||t>150)break}
const f=await p.evaluate(()=>__city.failed());
ok('queues clear off-peak within 150 s of traffic animation (1 s = 1 game hour at 1×)',left<=3,JSON.stringify({secs:Math.round(t),left,failed:f.total}));
ok('cars that gave up count as failed trips',f.total>0);
if(shots){await p.screenshot({path:'screenshots/jam-after.png'})}
// failed trips feed a demand penalty at month end
const pen=await p.evaluate(()=>{const C=__city;C.setCarsOnly(false);const d=C.sim().day;C.sim().day=Math.ceil((d+1)/30)*30-1;C.fastForward(1);return C.jamPenalty()});ok('failed commutes lower demand next month',pen>0,String(pen));
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
