// Roundabouts under traffic (overlap = two cars both on roundabout paths with centres < 0.1 tile apart): 1-lane and 2-lane 3x3 circles side by side. Circulating speed below street speed, no cars overlapping in/around
// either circle, cars queue at the yield line, 2-lane: approach lane by exit (right lane -> outer, left lane -> inner, no merge), both lanes carry traffic, save v14 (+ early 5x5 migration).
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4191/',shot=process.argv.includes('--shot');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1600,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(url+'?size=96&seed=5&city=Circles');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain,N=__city.N();for(let r=0;r<40;r++)for(let i=48-r;i<=48+r;i++)for(let j=48-r;j<=48+r;j++){let g=true;for(let a=-13;a<=13&&g;a++)for(let b=-19;b<=19;b++)if(!t[i+a]||t[i+a][j+b]==='water'){g=false;break}if(g)return[i,j]}});
const [ci,cj]=c,A=[ci,cj-9],B=[ci,cj+8];
const pl=await p.evaluate(([ci,cj,A,B])=>{const C=__city;C.sim().funds=1e7;C.setRoadTier(2);C.setRoadWidth(1);C.paint('road',ci,cj-18,ci,cj+18);
 const f0=C.sim().funds;const a=C.placeRab(A[0],A[1],3),f1=C.sim().funds,b2=C.placeRab(B[0],B[1],2),f2=C.sim().funds;
 C.paint('road',A[0]-12,A[1],A[0]-2,A[1]);C.paint('road',A[0]+2,A[1],A[0]+12,A[1]);C.paint('road',B[0]-12,B[1],B[0]-2,B[1]);C.paint('road',B[0]+2,B[1],B[0]+12,B[1]);
 const N=C.N();for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.road[i][j])C.rstage[i][j]=0;C.refresh();C.setCarsOnly(true);C.trips().assign(0);C.centerOn(ci,cj);C.setZoom(1.1);
 return {a,b:b2,c3:f0-f1,c5:f1-f2,cells2:C.rab.flat().filter(v=>v===(B[0]-1)*N+B[1]-1+1).length,lanes:C.rabS.get((B[0]-1)*N+B[1]-1)}},[ci,cj,A,B]);
ok('2-lane roundabout fits a 3x3 and costs a bit more than the 1-lane one',pl.a&&pl.b&&pl.cells2===9&&pl.lanes===2&&pl.c5>pl.c3&&pl.c5<=pl.c3*1.6,JSON.stringify(pl));
const L=await p.evaluate(([B])=>{const C=__city,i0=B[0]-1,j0=B[1]-1;return {ccw:C.rabOK(i0+1,j0,-1,0),cw:C.rabOK(i0,j0,1,0),island:C.rabOK(i0+1,j0,0,1),armIn:C.rabOK(i0+1,j0-1,0,1),cornerIn:C.rabOK(i0,j0-1,0,1)}},[B]);
ok('2-lane ring is one-way CCW, entries only at arms, island not drivable',L.ccw&&!L.cw&&!L.island&&L.armIn&&!L.cornerIn,JSON.stringify(L));
// endpoints: the 4 arm roads of each circle
const ends=[[ci,cj-18],[A[0]-12,A[1]],[A[0]+12,A[1]],[B[0]-12,B[1]],[B[0]+12,B[1]],[ci,cj+18]];
const spawn=n=>p.evaluate(([ends,n])=>{const C=__city,N=C.N(),T=C.trips();let m=0;for(let k=0;k<n*4&&m<n;k++){const a=ends[(Math.random()*ends.length)|0],z=ends[(Math.random()*ends.length)|0];if(a===z)continue;const r=T.route(a[0]*N+a[1],z[0]*N+z[1]);if(r&&r.length>4){C.spawnCar(r);m++}}return m},[ends,n]);
const dbg=[];let apChk=0,apBad=0;let over=0,samples=0,pairs=0,ringV=[],streetV=[],inner=0,outer=0,laneBad=0,laneChk=0,waited=0;const seen=new Map();
const t0=await p.evaluate(()=>__city.carClock());let prev=null,pc=t0;
for(let s=0;s<120;s++){if(s<40?s%8===0:s%4===0&&s<100)await spawn(s<40?2:6);await p.waitForTimeout(150);
 const st=await p.evaluate(([B])=>{const C=__city,N=C.N(),g=C.carG(),k5=(B[0]-1)*N+B[1]-1+1;let ov=0,pr=0;const ovd=[];const rl=[];
  for(let a=0;a<g.length;a++)for(let b2=a+1;b2<g.length;b2++){const x=g[a],y=g[b2];if(!x.rg||!y.rg)continue;const d=Math.hypot(x.x-y.x,x.y-y.y);if(d<0.6)pr++;if(d<0.1){ov++;if(ovd.length<6)ovd.push([x.i,x.j,x.pi,x.pj,+x.t.toFixed(2),y.i,y.j,y.pi,y.pj,+y.t.toFixed(2),+d.toFixed(3)])}}
  // lane choice on the 5x5: count ring steps entry arm -> exit arm along the route
  const R=[[1,0],[0,0],[0,1],[0,2],[1,2],[2,2],[2,1],[2,0]];const idx=k=>{const i=(k/N|0)-B[0]+1,j=k%N-B[1]+1;return R.findIndex(([p,q])=>p===i&&q===j)};
  for(const x of g){if(x.k!==k5||!x.on||x.rl===undefined)continue;let s0=x.ri,s1=x.ri;const inR=k=>C.rab[k/N|0][k%N]===k5;while(s0>0&&inR(x.route[s0-1]))s0--;while(s1+1<x.route.length&&inR(x.route[s1+1]))s1++;const steps=((idx(x.route[s1])-idx(x.route[s0])+8)%8)||8;rl.push([x.rl,steps])}
  const ap=[];for(const x of g){if(C.rab[x.pi][x.pj]||C.rab[x.i][x.j]!==k5||x.t<0.3)continue;let s1=x.ri;const inR=k=>C.rab[k/N|0][k%N]===k5;while(s1+1<x.route.length&&inR(x.route[s1+1]))s1++;const steps=((idx(x.route[s1])-idx(x.route[x.ri])+8)%8)||8;ap.push([x.ln,steps])}
  return {ap,ovd,n:g.length,ov,pr,rl,clock:C.carClock(),pos:g.map(x=>[x.x,x.y,x.on,x.k,x.id,x.sp,x.st])}},[B]);
 samples++;if(st.ovd.length&&dbg.length<12)dbg.push(...st.ovd);over+=st.ov;pairs+=st.pr;for(const [rl,steps] of st.rl){laneChk++;if((steps>4?1:0)!==rl)laneBad++;if(rl)inner++;else outer++}for(const [ln,steps] of st.ap){apChk++;if((steps>4?0:1)!==ln)apBad++}
 if(prev&&st.clock>pc){const dt=st.clock-pc;const m=new Map(prev.map(q=>[q[4],q]));for(const q of st.pos){const o=m.get(q[4]);if(!o||s>=40)continue;const v=Math.hypot(q[0]-o[0],q[1]-o[1])/dt/q[5];if(v<0.05)continue;(q[2]&&o[2]?ringV:!q[3]&&!o[3]?streetV:[]).push(v)}}
 prev=st.pos;pc=st.clock}
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[s.length>>1]||0};
const fails=await p.evaluate(()=>__city.failed());
ok('cars use both circles',ringV.length>8,ringV.length+' ring samples');
ok('circulating speed is well below street speed',med(ringV)<0.75*med(streetV)&&med(ringV)>0.2*med(streetV),'ring '+med(ringV).toFixed(2)+' vs street '+med(streetV).toFixed(2)+' tiles/traffic-s');
ok('no cars overlap in or around the roundabouts',over===0,over+' overlapping pairs in '+samples+' samples ('+pairs+' close pairs)');
ok('2-lane: right/straight on the outer lane, left/U on the inner lane',laneChk>10&&laneBad===0,JSON.stringify({laneChk,laneBad}));
ok('2-lane: both approach lanes run to the yield line, chosen by exit (right lane -> outer, left lane -> inner)',apChk>10&&apBad===0,JSON.stringify({apChk,apBad}));
ok('2-lane: both lanes carry traffic',inner>0&&outer>0,JSON.stringify({inner,outer}));
const sv=await p.evaluate(([B])=>{const C=__city,N=C.N(),o=JSON.parse(JSON.stringify(C.serialize()));const k=(B[0]-1)*N+B[1]-1;C.applySave(o);const kept=C.rabS.get(k)===2&&C.rab[B[0]][B[1]]===k+1;
 const o2=JSON.parse(JSON.stringify(o));o2.rabs2=[];const k5=(B[0]-2)*N+B[1]-2;o2.rabs5=[k5];const fl=Uint8Array.from(atob(o2.grids.flags),ch=>ch.charCodeAt(0));for(let a=0;a<5;a++)for(let b2=0;b2<5;b2++)fl[(B[0]-2+a)*N+B[1]-2+b2]|=1;let bin='';for(const x of fl)bin+=String.fromCharCode(x);o2.grids.flags=btoa(bin);C.applySave(o2);
 return {v:o.version,r2:o.rabs2,kept,mig:C.rabS.get(k)===2&&C.rab[B[0]][B[1]]===k+1&&!C.road[B[0]-2][B[1]-2]&&C.road[B[0]-2][B[1]]&&!C.rab[B[0]-2][B[1]]}},[B]);
ok('save v14 keeps the 2-lane roundabout; an early 5x5 one loads as 3x3',sv.v>=14&&sv.kept&&sv.mig,JSON.stringify(sv));
if(shot){await p.evaluate(()=>{__city.setCarsOnly(true);__fx.setDay(Math.floor(__city.sim().day/24)*24+12)});await spawn(30);await p.waitForTimeout(3000);await p.evaluate(([ci,cj])=>{__city.centerOn(ci,cj);__city.setZoom(1.6)},[ci,cj]);await p.waitForTimeout(1500);await p.screenshot({path:'screenshots/roundabouts-1and2-lane.png'});await p.evaluate(([B])=>{__city.centerOn(B[0],B[1]);__city.setZoom(4)},[B]);await p.waitForTimeout(1500);await p.screenshot({path:'screenshots/roundabout2-closeup.png'})}
ok('no page errors',!errs.length,errs.slice(0,3).join(' | '));console.log(res.join('\n'));if(dbg.length)console.log('overlaps',JSON.stringify(dbg));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
