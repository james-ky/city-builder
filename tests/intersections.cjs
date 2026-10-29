// Intersection control: auto rule from finished road width/tier, stability during construction, player overrides, vehicle decisions, saves, hover.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/',shots=process.argv.includes('--shots');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Crossings');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-14;a<=14&&g;a++)for(let b2=-14;b2<=14;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
const r=await p.evaluate(([ci,cj])=>{const C=__city;const R=(i,j,w,t=2)=>{C.road[i][j]=true;C.rtier[i][j]=t;C.rstage[i][j]=0;C.rw[i][j]=w;C.zone[i][j]='';C.bld[i][j]=0};
 const S=x=>x?{k:x.k,stops:x.stops.slice().sort().join('/')}:null;
 // A: two Streets crossing at (ci-8,cj-8)
 for(let d=-3;d<=3;d++){R(ci-8+d,cj-8,1);R(ci-8,cj-8+d,1)}
 // B: two 2-lane roads crossing at (ci-8,cj+4)
 for(let d=-3;d<=3;d++){R(ci-8+d,cj+4,0);R(ci-8,cj+4+d,0)}
 // C: 2-lane stem joining a Street: Street along i at j=cj-8+... use (ci+4,cj-8): Street runs i, stem goes +j
 for(let d=-3;d<=3;d++)R(ci+4+d,cj-8,1);for(let d=1;d<=3;d++)R(ci+4,cj-8+d,0);
 // D: same-size T of 2-lane roads at (ci+4,cj+4)
 for(let d=-3;d<=3;d++)R(ci+4+d,cj+4,0);for(let d=1;d<=3;d++)R(ci+4,cj+4+d,0);
 // E: Street T stem at (ci+10,cj-8)
 for(let d=-3;d<=3;d++)R(ci+10+d,cj-8,0);for(let d=1;d<=3;d++)R(ci+10,cj-8+d,1);
 C.refresh();return{A:S(C.ctrlAt(ci-8,cj-8)),B:S(C.ctrlAt(ci-8,cj+4)),C:S(C.ctrlAt(ci+4,cj-8)),D:S(C.ctrlAt(ci+4,cj+4)),E:S(C.ctrlAt(ci+10,cj-8))}},c);
ok('two 4-lane Streets crossing get a traffic light',r.A.k==='L',JSON.stringify(r.A));
ok('two 2-lane roads crossing get an all-way stop',r.B.k==='S'&&r.B.stops.split('/').length===4,JSON.stringify(r.B));
ok('a 2-lane road joining a Street stops on the minor road only',r.C.k==='S'&&r.C.stops==='NE',JSON.stringify(r.C));
ok('same-size T stops on the stem',r.D.k==='S'&&r.D.stops==='NE',JSON.stringify(r.D));
ok('a Street T-ing into a road gets a light',r.E.k==='L',JSON.stringify(r.E));
// stability: upgrading the 2-lane crossing to Streets keeps the stop until the work is done; nearby growth never flips it
const st=await p.evaluate(([ci,cj])=>{const C=__city;const i=ci-8,j=cj+4;for(let d=-3;d<=3;d++)for(const [a,b] of [[i+d,j],[i,j+d]]){C.rw[a][b]=1;C.rstage[a][b]=3;C.rfrom[a][b]=2}
 const during=C.ctrlAt(i,j).k;for(let a=-4;a<=4;a++)for(let b=-4;b<=4;b++)if(!C.road[i+a][j+b]){C.zone[i+a][j+b]='C';C.bld[i+a][j+b]=3}const growth=C.ctrlAt(i,j).k;
 for(let d=-3;d<=3;d++)for(const [a,b] of [[i+d,j],[i,j+d]]){C.rstage[a][b]=0;C.rfrom[a][b]=0}const after=C.ctrlAt(i,j).k;
 // and the A crossing stays a light with lots of buildings or none
 const i2=ci-8,j2=cj-8;const k1=C.ctrlAt(i2,j2).k;return{during,growth,after,k1}},c);
ok('control does not change while the upgrade is under construction',st.during==='S'&&st.growth==='S',JSON.stringify(st));
ok('control switches once construction completes',st.after==='L');
// overrides
const ov=await p.evaluate(([ci,cj])=>{const C=__city;const i=ci+4,j=cj+4,o={};const S=x=>({k:x.k,stops:x.stops.slice().sort().join('/'),cyc:x.cyc,g0:x.g0});
 C.setIx(i,j,{mode:'light',cyc:60,split:'even'});o.light=S(C.ctrlAt(i,j));C.setIx(i,j,{mode:'allstop'});o.all=S(C.ctrlAt(i,j));
 C.setIx(i,j,{mode:'twostop',axis:0});o.two0=S(C.ctrlAt(i,j));C.setIx(i,j,{axis:1});o.two1=S(C.ctrlAt(i,j));C.setIx(i,j,{mode:'yield',axis:0});o.yld=S(C.ctrlAt(i,j));C.setIx(i,j,{mode:'none'});o.none=S(C.ctrlAt(i,j));
 C.setIx(i,j,{mode:'light',cyc:45,split:'auto'});return o},c);
ok('light override with 60s cycle and even split',ov.light.k==='L'&&ov.light.cyc===60&&ov.light.g0===0.5,JSON.stringify(ov.light));
ok('all-way stop override',ov.all.k==='S'&&ov.all.stops.split('/').length===3);
ok('two-way stop: chosen road stops',ov.two0.k==='S'&&ov.two0.stops==='NW/SE'&&ov.two1.stops==='NE',JSON.stringify([ov.two0,ov.two1]));
ok('yield override',ov.yld.k==='Y'&&ov.yld.stops==='NW/SE');ok('uncontrolled override',ov.none.k==='N');
// vehicle decisions
const dv=await p.evaluate(()=>{const C=__city,D=C.decide;const stop={k:'S',stops:['NE'],ph:0,cyc:45,g0:.5},y={...stop,k:'Y'},n={...stop,k:'N'};
 let g=0,r=0;for(let t=0;t<15;t+=0.05){/* sample both axes */}const L={k:'L',stops:[],ph:0,cyc:45,g0:0.7};
 return{stopNoWait:D(stop,'NE',0,false),stopWaited:D(stop,'NE',1,false),freeRoad:D(stop,'SE',0,false),yieldClear:D(y,'NE',0,false),yieldBusy:D(y,'NE',0,true),yieldBusyLong:D(y,'NE',5,true),none:D(n,'NE',0,true),
  lightsOpposite:['NE','SE'].map(d=>D(L,d,0,false)).filter(Boolean).length<=1}});
ok('stop: cars halt before going',!dv.stopNoWait&&dv.stopWaited&&dv.freeRoad,JSON.stringify(dv));
ok('yield: goes when clear, waits for cross traffic',dv.yieldClear&&!dv.yieldBusy&&!dv.yieldBusyLong);
ok('uncontrolled: no stop',dv.none);ok('lights never give both roads green',dv.lightsOpposite);
const gs=await p.evaluate(()=>{const C=__city;let g0=0,g1=0;/* use lightState over a cycle via ph offsets */for(let ph=0;ph<20;ph+=0.05){if(C.lightState(0,ph,60,0.7)==='green')g0++;if(C.lightState(1,ph,60,0.7)==='green')g1++}return{g0,g1}});
ok('green split favours the busier road',gs.g0>gs.g1*1.5,JSON.stringify(gs));
// saves
const sv=await p.evaluate(([ci,cj])=>{const C=__city;C.setIx(ci+4,cj+4,{mode:'yield',axis:1});const o=JSON.parse(JSON.stringify(C.serialize()));C.setIx(ci+4,cj+4,{mode:'auto',cyc:45,split:'auto'});C.applySave(o);const a=C.ctrlAt(ci+4,cj+4).k;
 const old=JSON.parse(JSON.stringify(C.serialize()));delete old.ix;old.version=8;C.applySave(old);return{a,v:o.version,legacy:C.ctrlAt(ci+4,cj+4).mode,n:C.ixSet.size}},c);
ok('saves keep each intersection setting',sv.a==='Y'&&sv.v>=9,JSON.stringify(sv));ok('old saves: intersections are Auto',sv.legacy==='auto'&&sv.n===0);
// hover + picker
await p.evaluate(([ci,cj])=>{const C=__city;C.setIx(ci-8,cj+4,{mode:'twostop',axis:0});C.centerOn(ci-8,cj+4);C.setZoom(2.4);C.setTool('ix')},c);await p.waitForTimeout(800);
const q=await p.evaluate(([ci,cj])=>__city.tileToScreen(ci-8,cj+4),c);await p.mouse.move(q.x,q.y);await p.waitForTimeout(300);
const hud=await p.evaluate(()=>document.body.innerText);ok('hover shows the control and waiting cars',/intersection · stop on .* waiting/.test(hud),(hud.match(/intersection[^\n]*/)||[''])[0]);
await p.mouse.click(q.x,q.y);await p.waitForTimeout(300);const pk=await p.evaluate(()=>document.getElementById('ixPicker').style.display==='block'&&/Two-way stop/.test(document.getElementById('ixPicker').innerText));ok('clicking a junction opens the picker',pk);
await p.mouse.click(q.x,q.y);await p.waitForTimeout(300);const flip=await p.evaluate(([ci,cj])=>__city.ixSet.get((ci-8)*__city.N()+cj+4).axis,c);ok('clicking again flips which road stops',flip===1);
const signs=await p.evaluate(([ci,cj])=>{const C=__city;return C.ctrlMap.get((ci-8)*C.N()+cj+4)?.stops.join('/')},c);ok('drawn signs match the setting',signs==='NE/SW'||signs==='SW/NE',signs);
if(shots){await p.evaluate(([ci,cj])=>{const C=__city;for(let i=0;i<C.N();i++)for(let j=0;j<C.N();j++)if(C.zone[i][j]){C.zone[i][j]='';C.bld[i][j]=0}C.refresh();__fx.setDay(36);__city.setIx(ci-8,cj-8,{mode:'light',cyc:60,split:'auto'});__city.centerOn(ci-8,cj-8);__city.setZoom(2.2);__city.pan(120,40)},c);await p.waitForTimeout(600);
 const a=await p.evaluate(([ci,cj])=>__city.tileToScreen(ci-8,cj-8),c);await p.mouse.click(a.x,a.y);await p.waitForTimeout(400);await p.mouse.move(a.x+2,a.y+2);await p.waitForTimeout(500);await p.screenshot({path:'screenshots/intersection-tool.png'});}
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
