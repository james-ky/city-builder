// Bus art (v3-soft3d-k): depot art follows facing, stop props drawn by travel direction, buses use veh_bus_a and dwell ~10 s at stops.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4318/',shots=process.argv.includes('--shots');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Busart');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-12;a<=12&&g;a++)for(let b2=-12;b2<=12;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
// a town: main street along row ci from the map edge, homes on the west, shops in the middle, industry on the east
await p.evaluate(([ci,cj])=>{const C=__city,N=C.N();const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.rw[i][j]=0;C.zone[i][j]='';C.bld[i][j]=0};
 for(let j=0;j<N;j++)R(ci,j);for(let d=-10;d<=10;d++){R(ci+d,cj-10);R(ci+d,cj+10)}
 const Z=(i,j,z)=>{if(C.road[i][j]||C.terrain[i][j]==='water')return;C.zone[i][j]=z;C.bld[i][j]=1};
 for(let d=-9;d<=9;d++){Z(ci+d,cj-11,'R');Z(ci+d,cj-9,'R');Z(ci+d,cj+9,'I');Z(ci+d,cj+11,'I')}for(let j=cj-6;j<=cj+6;j++){Z(ci-1,j,'C');Z(ci+1,j,'C')}
 C.refresh();C.markTripsDirty();C.fastForward(1);C.centerOn(ci,cj);C.setZoom(1.6);},c);
// 1. no random buses or semis
const man=await p.evaluate(()=>fetch('./assets/manifest.json').then(r=>r.json()).then(m=>({rev:m.artRevision,n:m.assets.filter(a=>/bus_depot|bus_stop/.test(a.name)).length})));
ok('manifest is v3-soft3d-k with depot + stop art',man.rev==='v3-soft3d-k'&&man.n===18,JSON.stringify(man));
await p.evaluate(([ci,cj])=>{const C=__city;C.setCarsOnly(true);for(const [i,j] of [[ci,cj-10],[ci,cj-3],[ci,cj+4],[ci,cj+10]])C.toggleStop(i,j);C.paint('svc:busdepot',ci+1,cj-8,ci+1,cj-8);C.setTool('select');C.markTripsDirty();C.fastForward(1);__fx.setDay(36)},c);
const face=await p.evaluate(()=>{const d=__city.civs.find(c=>c.type==='busdepot');return d?['','NE','SE','SW','NW'][__city.civFace(d)]:null});
ok('depot faces the road it touches (main street on its NW side)',face==='NW',String(face));
await p.waitForFunction(()=>__city.buses()>0,null,{timeout:30000}).catch(()=>{});
const sd=await p.evaluate(()=>__city.stopDir());ok('every stop gets a bus travel direction from the loop',sd.length===4&&sd.every(([,d])=>/^(NE|SE|SW|NW)$/.test(d)),JSON.stringify(sd));
// dwell: watch buses until one is held at a stop and later moves on
let saw=null,moved=false;for(let k=0;k<120&&!moved;k++){await p.waitForTimeout(1000);const bs=await p.evaluate(()=>__city.busCars());const st=await p.evaluate(()=>__city.stops());for(const b of bs){if(!saw&&b.dwell>0&&st.includes(b.at))saw={...b,clock:await p.evaluate(()=>__city.carClock())};}
 if(saw){const b=bs.find(x=>x.ri>saw.ri);if(b){moved=true;saw.left=await p.evaluate(()=>__city.carClock())-saw.clock}}}
ok('buses pause at stops (~10 s of traffic animation) then continue',!!saw&&moved&&saw.left>=5,JSON.stringify(saw));
const spr=await p.evaluate(()=>__city.busCars());ok('buses are drawn with the veh_bus_a sprite, not a box',spr.length>0&&spr.every(b=>b.sprite),JSON.stringify(spr.map(b=>b.tex)));
if(shots){await p.evaluate(([ci,cj])=>{__city.centerOn(ci,cj-6);__city.setZoom(2.6);document.getElementById('info').style.display='none'},c);await p.waitForTimeout(1500);await p.screenshot({path:'screenshots/transit-art.png'});
 await p.evaluate(()=>__fx.setDay(46));await p.waitForTimeout(2000);await p.screenshot({path:'screenshots/transit-art-night.png'})}
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
