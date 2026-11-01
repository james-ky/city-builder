// Roundabouts under traffic (overlap = two cars both on roundabout paths with centres < 0.1 tile apart): 1-lane 3x3 and 2-lane 5x5 side by side. Circulating speed below street speed, no cars overlapping in/around
// either circle, cars queue at the yield line, 2-lane lane choice (right/straight outer, left/U inner), both lanes carry traffic, save v14 keeps 5x5s.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4191/',shot=process.argv.includes('--shot');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1600,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(url+'?size=96&seed=5&city=Circles');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain,N=__city.N();for(let r=0;r<40;r++)for(let i=48-r;i<=48+r;i++)for(let j=48-r;j<=48+r;j++){let g=true;for(let a=-13;a<=13&&g;a++)for(let b=-19;b<=19;b++)if(!t[i+a]||t[i+a][j+b]==='water'){g=false;break}if(g)return[i,j]}});
const [ci,cj]=c,A=[ci,cj-9],B=[ci,cj+8];
const pl=await p.evaluate(([ci,cj,A,B])=>{const C=__city;C.sim().funds=1e7;C.setRoadTier(2);C.setRoadWidth(1);C.paint('road',ci,cj-18,ci,cj+18);
 const f0=C.sim().funds;const a=C.placeRab(A[0],A[1],3),f1=C.sim().funds,b2=C.placeRab(B[0],B[1],5),f2=C.sim().funds;
 C.paint('road',A[0]-12,A[1],A[0]-2,A[1]);C.paint('road',A[0]+2,A[1],A[0]+12,A[1]);C.paint('road',B[0]-12,B[1],B[0]-3,B[1]);C.paint('road',B[0]+3,B[1],B[0]+12,B[1]);
 const N=C.N();for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.road[i][j])C.rstage[i][j]=0;C.refresh();C.setCarsOnly(true);C.trips().assign(0);C.centerOn(ci,cj);C.setZoom(1.1);
 return {a,b:b2,c3:f0-f1,c5:f1-f2,cells5:C.rab.flat().filter(v=>v===(B[0]-2)*N+B[1]-2+1).length,sz:C.rabS.get((B[0]-2)*N+B[1]-2)}},[ci,cj,A,B]);
ok('2-lane roundabout places as a 5x5 and costs more than the 3x3',pl.a&&pl.b&&pl.cells5===25&&pl.sz===5&&pl.c5>pl.c3,JSON.stringify(pl));
const L=await p.evaluate(([B])=>{const C=__city,i0=B[0]-2,j0=B[1]-2;return {ccw:C.rabOK(i0+2,j0,-1,0),cw:C.rabOK(i0+1,j0,1,0),island:C.rabOK(i0+1,j0+2,0,0)||C.rabOK(i0+2,j0+1,0,1),armIn:C.rabOK(i0+2,j0-1,0,1),cornerIn:C.rabOK(i0,j0-1,0,1)}},[B]);
ok('5x5 ring is one-way CCW, entries only at arms, island not drivable',L.ccw&&!L.cw&&!L.island&&L.armIn&&!L.cornerIn,JSON.stringify(L));
// endpoints: the 4 arm roads of each circle
const ends=[[ci,cj-18],[A[0]-12,A[1]],[A[0]+12,A[1]],[B[0]-12,B[1]],[B[0]+12,B[1]],[ci,cj+18]];
const spawn=n=>p.evaluate(([ends,n])=>{const C=__city,N=C.N(),T=C.trips();let m=0;for(let k=0;k<n*4&&m<n;k++){const a=ends[(Math.random()*ends.length)|0],z=ends[(Math.random()*ends.length)|0];if(a===z)continue;const r=T.route(a[0]*N+a[1],z[0]*N+z[1]);if(r&&r.length>4){C.spawnCar(r);m++}}return m},[ends,n]);
const dbg=[];let over=0,samples=0,pairs=0,ringV=[],streetV=[],inner=0,outer=0,laneBad=0,laneChk=0,waited=0;const seen=new Map();
const t0=await p.evaluate(()=>__city.carClock());let prev=null,pc=t0;
for(let s=0;s<120;s++){if(s<40?s%8===0:s%4===0&&s<100)await spawn(s<40?2:6);await p.waitForTimeout(150);
 const st=await p.evaluate(([B])=>{const C=__city,N=C.N(),g=C.carG(),k5=(B[0]-2)*N+B[1]-2+1;let ov=0,pr=0;const ovd=[];const rl=[];
  for(let a=0;a<g.length;a++)for(let b2=a+1;b2<g.length;b2++){const x=g[a],y=g[b2];if(!x.rg||!y.rg)continue;const d=Math.hypot(x.x-y.x,x.y-y.y);if(d<0.6)pr++;if(d<0.1){ov++;if(ovd.length<6)ovd.push([x.i,x.j,x.pi,x.pj,+x.t.toFixed(2),y.i,y.j,y.pi,y.pj,+y.t.toFixed(2),+d.toFixed(3)])}}
  // lane choice on the 5x5: count ring steps entry arm -> exit arm along the route
  const R=[[2,0],[1,0],[0,0],[0,1],[0,2],[0,3],[0,4],[1,4],[2,4],[3,4],[4,4],[4,3],[4,2],[4,1],[4,0],[3,0]];const idx=k=>{const i=(k/N|0)-B[0]+2,j=k%N-B[1]+2;return R.findIndex(([p,q])=>p===i&&q===j)};
  for(const x of g){if(x.k!==k5||!x.on||x.rl===undefined)continue;let s0=x.ri,s1=x.ri;const inR=k=>C.rab[k/N|0][k%N]===k5;while(s0>0&&inR(x.route[s0-1]))s0--;while(s1+1<x.route.length&&inR(x.route[s1+1]))s1++;const steps=((idx(x.route[s1])-idx(x.route[s0])+16)%16)||16;rl.push([x.rl,steps])}
  return {ovd,n:g.length,ov,pr,rl,clock:C.carClock(),pos:g.map(x=>[x.x,x.y,x.on,x.k,x.id,x.sp,x.st])}},[B]);
 samples++;if(st.ovd.length&&dbg.length<12)dbg.push(...st.ovd);over+=st.ov;pairs+=st.pr;for(const [rl,steps] of st.rl){laneChk++;if((steps>8?1:0)!==rl)laneBad++;if(rl)inner++;else outer++}
 if(prev&&st.clock>pc){const dt=st.clock-pc;const m=new Map(prev.map(q=>[q[4],q]));for(const q of st.pos){const o=m.get(q[4]);if(!o||s>=40)continue;const v=Math.hypot(q[0]-o[0],q[1]-o[1])/dt/q[5];if(v<0.05)continue;(q[2]&&o[2]?ringV:!q[3]&&!o[3]?streetV:[]).push(v)}}
 prev=st.pos;pc=st.clock}
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[s.length>>1]||0};
const fails=await p.evaluate(()=>__city.failed());
ok('cars use both circles',ringV.length>30,ringV.length+' ring samples');
ok('circulating speed is well below street speed',med(ringV)<0.75*med(streetV)&&med(ringV)>0.2*med(streetV),'ring '+med(ringV).toFixed(2)+' vs street '+med(streetV).toFixed(2)+' tiles/traffic-s');
ok('no cars overlap in or around the roundabouts',over===0,over+' overlapping pairs in '+samples+' samples ('+pairs+' close pairs)');
ok('2-lane: right/straight on the outer lane, left/U on the inner lane',laneChk>10&&laneBad===0,JSON.stringify({laneChk,laneBad}));
ok('2-lane: both lanes carry traffic',inner>0&&outer>0,JSON.stringify({inner,outer}));
const sv=await p.evaluate(([B])=>{const C=__city,N=C.N(),o=JSON.parse(JSON.stringify(C.serialize()));const k=(B[0]-2)*N+B[1]-2;C.applySave(o);return {v:o.version,r5:o.rabs5,kept:C.rabS.get(k)===5&&C.rab[B[0]][B[1]]===k+1}},[B]);
ok('save v14 keeps the 2-lane roundabout',sv.v>=14&&sv.kept,JSON.stringify(sv));
if(shot){await p.evaluate(()=>{__city.setCarsOnly(true);__fx.setDay(Math.floor(__city.sim().day/24)*24+12)});await spawn(30);await p.waitForTimeout(3000);await p.evaluate(([ci,cj])=>{__city.centerOn(ci,cj);__city.setZoom(1.6)},[ci,cj]);await p.waitForTimeout(1500);await p.screenshot({path:'screenshots/roundabouts-1and2-lane.png'})}
ok('no page errors',!errs.length,errs.slice(0,3).join(' | '));console.log(res.join('\n'));if(dbg.length)console.log('overlaps',JSON.stringify(dbg));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
