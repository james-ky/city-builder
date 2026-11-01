// Traffic circle (small 1-lane 3x3): placement + cost, art pieces, one-way CCW ring, entries only at the 4 arms, routing round the ring,
// cars follow the ring (angle decreasing = counter-clockwise on screen), entering cars yield to circulating cars, save/load v12 + pre-v12 migration.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4420/',shot=process.argv.includes('--shot')?process.argv[process.argv.indexOf('--shot')+1]:'';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1600,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(url+'?size=64&seed=5&city=Circle');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-11;a<=11&&g;a++)for(let b=-11;b<=11;b++)if(!t[i+a]||t[i+a][j+b]==='water'){g=false;break}if(g)return[i,j]}});
const [ci,cj]=c;
const placed=await p.evaluate(([ci,cj])=>{const C=__city;C.sim().funds=1e6;const f0=C.sim().funds;const okp=C.placeRab(ci,cj);return {okp,cost:f0-C.sim().funds,cells:C.rab.flat().filter(v=>v>0).length,stage:C.rstage[ci][cj]}},c);
ok('placing a traffic circle fills a 3x3, costs money and starts construction',placed.okp&&placed.cells===9&&placed.cost>0&&placed.stage>0,JSON.stringify(placed));
const again=await p.evaluate(([ci,cj])=>__city.placeRab(ci+1,cj),c);ok('cannot overlap another circle',!again);
await p.evaluate(([ci,cj])=>{const C=__city;C.setRoadTier(2);C.setRoadWidth(1);C.paint('road',ci,cj-2,ci,cj-10);C.paint('road',ci+2,cj,ci+10,cj);C.paint('road',ci,cj+2,ci,cj+10);C.paint('road',ci-2,cj,ci-10,cj);
 const N=C.N();for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.road[i][j])C.rstage[i][j]=0;C.refresh();C.setCarsOnly(true);C.trips().assign(0)},c);
const L=await p.evaluate(([ci,cj])=>{const C=__city,i0=ci-1,j0=cj-1;return {
  ringCCW:C.rabOK(i0+1,j0,-1,0),ringCW:C.rabOK(i0,j0,1,0),armIn:C.rabOK(ci,cj-2,0,1),armOut:C.rabOK(ci,cj-1,0,-1),cornerOut:C.rabOK(i0,j0,0,-1),cornerIn:C.rabOK(i0,j0-1,0,1),centre:C.rabOK(ci,cj-1,0,1)}},c);
ok('ring is one-way counter-clockwise; in/out only at the arms; centre not drivable',L.ringCCW&&!L.ringCW&&L.armIn&&L.armOut&&!L.cornerOut&&!L.cornerIn&&!L.centre,JSON.stringify(L));
const art=await p.evaluate(async()=>{const out=[];for(const t of ['dirt','asphalt','concrete'])for(const k of ['00','01','02','10','11','12','20','21','22']){const r=await fetch(`./assets/roads/roundabout_${t}_${k}@2x.png`);out.push(r.ok)}return out.filter(Boolean).length});
ok('27 roundabout art pieces load',art===27,String(art));
const extra=await p.evaluate(async()=>{let n=0,s=0;for(const t of ['dirt','asphalt','concrete'])for(const k of ['00','01','02','10','11','12','20','21','22'])if((await fetch(`./assets/roads/roundabout_${t}_${k}_night@2x.png`)).ok)n++;for(const st of ['surveyed','graded','gravel','surfacing'])for(const k of ['00','01','02','10','11','12','20','21','22'])if((await fetch(`./assets/roads/construction/roundabout_stage_${st}_${k}@2x.png`)).ok)s++;return {n,s}});
ok('night overlays (27) and construction stages (36) load',extra.n===27&&extra.s===36,JSON.stringify(extra));
const tex=()=>p.evaluate(()=>{const out=[];const walk=o=>{const l=o.texture?.label;if(l&&/roundabout_/.test(l))out.push({l:l.replace(/^.*\//,''),v:o.visible,a:o.alpha});for(const k of o.children||[])walk(k)};Object.values(__city.layers).forEach(walk);return out});
await p.evaluate(([ci,cj])=>{const C=__city;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)C.rstage[ci+a][cj+b]=1;C.refresh();C.centerOn(ci,cj);C.setZoom(3)},c);await p.waitForTimeout(800);
const stg=await tex();await p.evaluate(([ci,cj])=>{const C=__city;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)C.rstage[ci+a][cj+b]=0;C.refresh()},c);ok('under construction the circle shows the stage art',stg.some(x=>/roundabout_stage_surveyed_\d\d/.test(x.l)),stg.slice(0,3).map(x=>x.l).join(','));
const geo=await p.evaluate(async()=>{const m=await (await fetch('./assets/manifest.json')).json();return {rev:m.revision,ring:m.autotile.roundabout.geometry.ring.polyline.length}});ok('manifest v3-soft3d-o with ring geometry',geo.rev>='v3-soft3d-o'&&geo.ring===48,JSON.stringify(geo));
// routing: NE street -> SE street goes round the ring CCW (NE arm -> W corner -> NW arm -> ... -> SE arm) = 3/4 of the circle; SE -> NE is the short way
const rt=await p.evaluate(([ci,cj])=>{const C=__city,N=C.N(),T=C.trips();const a=T.route(ci*N+cj-6,(ci+6)*N+cj),b=T.route((ci+6)*N+cj,ci*N+cj-6);const inr=p=>p?p.filter(k=>C.rab[(k/N)|0][k%N]).length:-1;return {a:inr(a),b:inr(b)}},c);
ok('routing knows the ring: NE->SE goes 3/4 round (7 ring cells), SE->NE the short way (3)',rt.a===7&&rt.b===3,JSON.stringify(rt));
// traffic: 4 streams in; watch ring angles decrease and entering cars respect the gap
await p.evaluate(([ci,cj])=>{const C=__city,N=C.N(),T=C.trips();const ends=[[ci,cj-9],[ci+9,cj],[ci,cj+9],[ci-9,cj]];
 window.__rabSpawn=setInterval(()=>{for(let a=0;a<4;a++){const d=(a+1+Math.floor(Math.random()*3))%4;const r=T.route(ends[a][0]*N+ends[a][1],ends[d][0]*N+ends[d][1]);if(r&&C.cars().length<70)C.spawnCar(r)}},900)},c);
const k0=await p.evaluate(()=>__city.carClock());const samples=[];let viol=0,ccw=0,cw=0,maxWait=0;
for(let s=0;s<120;s++){await p.waitForTimeout(100);const q=await p.evaluate(()=>__city.cars().map((x,k)=>({k:x,ra:x.ra,on:!!(__city.rab[x.i][x.j]&&__city.rab[x.pi][x.pj]),w:x.wait||0})).map(o=>({ra:o.ra,on:o.on,w:o.w})));
 samples.push(q);maxWait=Math.max(maxWait,...q.map(o=>o.w),0)}
const tr=await p.evaluate(async()=>{const a=new Map(__city.cars().map(x=>[x,x.ra]));await new Promise(r=>setTimeout(r,250));const out=[];for(const [x,r0] of a){if(r0===undefined||x.ra===undefined)continue;let d=x.ra-r0;while(d>Math.PI)d-=2*Math.PI;while(d<=-Math.PI)d+=2*Math.PI;if(Math.abs(d)>1e-4)out.push(d)}return out});
ccw=tr.filter(d=>d<0).length;cw=tr.filter(d=>d>0).length;
ok('cars circulate counter-clockwise on screen (ring angle decreasing)',ccw>0&&cw===0,`ccw ${ccw} cw ${cw}`);
const clash=await p.evaluate(()=>{let n=0;const cs=__city.cars().filter(x=>x.ra!==undefined);for(let a=0;a<cs.length;a++)for(let b=a+1;b<cs.length;b++){const d=Math.hypot(cs[a].s.x-cs[b].s.x,cs[a].s.y-cs[b].s.y);if(d<3)n++}return n});
ok('no two cars on top of each other on the ring',clash===0,String(clash));
const waited=await p.evaluate(()=>__city.cars().some(x=>(x.wait||0)>0)||window.__waited);ok('some entering cars had to yield',maxWait>0,'max wait '+maxWait.toFixed(2)+' s');
const moved=await p.evaluate(()=>__city.failed().total);ok('traffic flows (cars on the map, not all failing)',samples[samples.length-1].length>5,'cars '+samples[samples.length-1].length+' failed '+moved);
{await p.evaluate(()=>__fx.setDay(Math.floor(__city.sim().day/24)*24+24));await p.waitForTimeout(900);const nt=await tex();ok('finished circle shows its art and night lamps light up after dark',nt.some(x=>/roundabout_asphalt_11@/.test(x.l))&&nt.some(x=>/_night@/.test(x.l)&&x.v&&x.a>0.3),JSON.stringify(nt.filter(x=>/_night/.test(x.l)).slice(0,2)))}
if(shot){await p.addStyleTag({content:'body>*:not(canvas){visibility:hidden}'});await p.evaluate(([ci,cj])=>{__city.setZoom(5);__city.centerOn(ci,cj);__fx.setDay(Math.floor(__city.sim().day/24)*24+36);__city.layers.iconL.visible=false},c);await p.waitForTimeout(1500);await p.screenshot({path:shot,clip:{x:300,y:150,width:1000,height:700}})}
await p.evaluate(()=>clearInterval(window.__rabSpawn));
// save / load
const sv=await p.evaluate(([ci,cj])=>{const C=__city,o=C.serialize();const v=o.version,r=o.rabs;C.applySave(JSON.parse(JSON.stringify(o)));const back=C.rab.flat().filter(x=>x>0).length;const old=JSON.parse(JSON.stringify(o));old.version=11;delete old.rabs;C.applySave(old);const mig=C.rab.flat().filter(x=>x>0).length;C.applySave(o);return {v,r,back,mig,again:C.rab.flat().filter(x=>x>0).length}},c);
ok('save v12 stores the circle and loads it back; a v11 save loads with none',sv.v>=12&&sv.r.length===1&&sv.back===9&&sv.mig===0&&sv.again===9,JSON.stringify(sv));
const dz=await p.evaluate(([ci,cj])=>{const C=__city;C.setTool('bulldoze');C.paint('bulldoze',ci+1,cj+1,ci+1,cj+1);return C.rab.flat().filter(x=>x>0).length},c);ok('bulldozing one cell removes the whole circle',dz===0,String(dz));
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs.slice(0,5));process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
