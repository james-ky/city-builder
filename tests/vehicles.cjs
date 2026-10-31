// Vehicles (art v3-soft3d-l): bumper-to-bumper queues from manifest bodyFront/bodyRear, light pools under vehicles at night, travel direction -> sprite facing for every type.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4322/',shots=process.argv.includes('--shots');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1200,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Queue');await p.waitForFunction(()=>window.__city&&__city.N);
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const man=await p.evaluate(()=>fetch('./assets/manifest.json').then(r=>r.json()).then(m=>({rev:m.artRevision,fx:m.assets.filter(a=>/^fx_/.test(a.name)).map(a=>a.drawOrder),veh:Object.fromEntries(m.assets.filter(a=>/^veh_.*_(NE|SE|SW|NW)$/.test(a.name)).map(a=>[a.name,a.travelAxisPx]))})));
ok('manifest v3-soft3d-l, all glows drawOrder underVehicle',man.rev==='v3-soft3d-l'&&man.fx.length===8&&man.fx.every(x=>x==='underVehicle'));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-9;a<=9&&g;a++)for(let b=-9;b<=9;b++)if(!t[i+a]||t[i+a][j+b]==='water'){g=false;break}if(g)return[i,j]}});
await p.evaluate(([ci,cj])=>{const C=__city;C.setSpeed(0);const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.rw[i][j]=0};for(let d=-9;d<=9;d++){R(ci+d,cj);R(ci,cj+d)}C.refresh();C.markTripsDirty();C.fastForward(1);C.setCarsOnly(true);C.centerOn(ci+3,cj);C.setZoom(4);__fx.setDay(46)},c);
await p.waitForTimeout(500);
// queue: leader stopped near the end of a straight SE run, 5 followers of mixed types
const types=['veh_sedan_a','veh_delivery_truck_a','veh_hatchback_b','veh_bus_a','veh_pickup_c','veh_semi_a'];
const route=await p.evaluate(([ci,cj])=>{const N=__city.N(),r=[];for(let i=ci-9;i<=ci+9;i++)if(i!==ci)r.push(i*N+cj);return r},c);
for(let k=0;k<types.length;k++){await p.evaluate(([r,key])=>__city.spawnCar(r,key),[route,types[k]]);if(k===0){await p.waitForFunction(()=>__city.carInfo()[0].ri>=12,null,{timeout:60000});await p.evaluate(()=>__city.holdCar(0,0))}await p.evaluate(()=>__city.cars().forEach(x=>x.stuck=-1e6));
 const k0=await p.evaluate(()=>__city.carClock());await p.waitForFunction(k0=>__city.carClock()>k0+1.5,k0,{timeout:60000})}
const q0=await p.evaluate(()=>__city.carClock());for(let w=0;w<200;w++){await p.evaluate(()=>__city.cars().forEach(x=>x.stuck=-1e6));if(await p.evaluate(q0=>__city.carClock()>q0+25,q0))break;await p.waitForTimeout(500)} // keep the test queue from giving up
const q=await p.evaluate(()=>__city.carInfo());const pos=x=>x.ri+x.t; // tiles along the route
const gaps=[];for(let k=1;k<q.length;k++){const L=q[k-1],F=q[k];gaps.push({f:F.key,l:L.key,m:+(((pos(L)-pos(F))-F.bf-L.br)*20).toFixed(2)})}
ok('stopped queue is bumper to bumper (1–2.5 m between bumpers, using each body length)',gaps.length===5&&gaps.every(g=>g.m>=1&&g.m<=2.5),JSON.stringify(gaps));
// glows
const g=q.filter(x=>x.tex);ok('each vehicle has headlight + taillight glow under the vehicles, additive, visible at night',g.length>0&&g.every(x=>x.hg&&x.tg&&x.glowUnder&&x.hgBlend==='add'&&x.hgVis&&x.hgA>0.3),JSON.stringify(g.map(x=>[x.hg,x.tg,x.glowUnder,x.hgBlend,+x.hgA.toFixed(2)])));
if(shots){await p.evaluate(([ci,cj])=>{__city.centerOn(ci+5,cj);__city.setZoom(4.5)},c);await p.waitForTimeout(800);await p.screenshot({path:'screenshots/night-queue.png'})}
const day=await p.evaluate(()=>{__fx.setDay(36);return 0});await p.waitForTimeout(800);const dv=await p.evaluate(()=>__city.carInfo().every(x=>!x.hgVis));ok('no glow in daytime',dv);
if(shots){await p.screenshot({path:'screenshots/day-queue.png'})}
// direction mapping: every type in all 4 grid directions -> the matching 16-direction sprite (d00=SE, d04=NE, d08=NW, d12=SW)
await p.evaluate(()=>{const cs=__city.cars();while(cs.length)__city.cars().splice(0,1)[0].s.destroy()}).catch(()=>{});
const all=['sedan_a','hatchback_a','pickup_a','van_a','taxi_a','bus_a','delivery_truck_a','delivery_truck_b','semi_a','semi_b'];const bad=[];
for(const v of all){const routes=await p.evaluate(([ci,cj])=>{const N=__city.N(),mk=(di,dj)=>{const r=[];for(let s=-8;s<=8;s++){const i=ci+di*s,j=cj+dj*s;if(i===ci&&j===cj)continue;r.push(i*N+j)}return r};return{SE:mk(1,0),NW:mk(-1,0),SW:mk(0,1),NE:mk(0,-1)}},c);
 const n0=await p.evaluate(()=>__city.cars().length);for(const d of ['SE','NW','SW','NE'])await p.evaluate(([r,k])=>__city.spawnCar(r,k),[routes[d],'veh_'+v]);
 const a=await p.evaluate(n0=>__city.carInfo().slice(n0),n0);const k0=await p.evaluate(()=>__city.carClock());await p.waitForFunction(k0=>__city.carClock()>k0+0.6,k0);const z=await p.evaluate(n0=>__city.carInfo().slice(n0),n0);
 ['SE','NW','SW','NE'].forEach((d,k)=>{const A=a[k],B=z[k];if(!B){bad.push(v+' '+d+' missing');return}const mx=B.x-A.x,my=B.y-A.y,ax=man.veh[`veh_${v}_${d}`];
  const D16={SE:'d00',NE:'d04',NW:'d08',SW:'d12'}[d];if(B.dir!==D16||!B.tex.includes(`veh_${v}_${D16}`)||!ax||Math.sign(mx)!==Math.sign(ax[0])||Math.sign(my)!==Math.sign(ax[1]))bad.push(`${v} ${d}: dir ${B.dir} tex ${B.tex.replace(/^.*\//,'')} move ${mx.toFixed(1)},${my.toFixed(1)} axis ${ax}`)});
 await p.evaluate(n0=>{const cs=__city.cars();for(const x of cs.splice(n0)){x.s.destroy();x.n?.destroy();x.hg?.destroy();x.tg?.destroy()}},n0)}
ok('travel direction picks the matching sprite facing for every vehicle type (screen motion matches manifest travelAxisPx)',bad.length===0,bad.slice(0,4).join(' | '));
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
