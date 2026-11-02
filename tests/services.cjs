// City services: staff, caseloads, crime that responds to police over time, hospitals/schools numbers, per-building radius + staff sliders, saves.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4191/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.stack));
await p.goto(url+'?size=128&seed=3&city=Servton');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<60;r++)for(let i=64-r;i<=64+r;i++)for(let j=64-r;j<=64+r;j++){let g=true;for(let a=-14;a<=14&&g;a++)for(let b2=-22;b2<=22;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
const setup=await p.evaluate(([ci,cj])=>{const C=__city;C.sim().funds=1e7;const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.zone[i][j]='';C.bld[i][j]=0};
 for(let j=cj-20;j<=cj+20;j++)R(ci,j);for(let j=cj-12;j<=cj-1;j++){C.zone[ci+1][j]='R';C.bld[ci+1][j]=2;C.zden[ci+1][j]=2}for(let j=cj+1;j<=cj+12;j++){C.zone[ci+1][j]='C';C.bld[ci+1][j]=2;C.zden[ci+1][j]=2}
 C.refresh();C.markTripsDirty();C.fastForward(2);C.computeAll();C.computeRisks();
 const homes=[];for(let j=cj-12;j<=cj-1;j++)homes.push([ci+1,j]);return {homes}},c);
const avg=()=>p.evaluate(h=>h.reduce((s,[i,j])=>s+__city.crime[i][j],0)/h.length,setup.homes);
const before=await avg();ok('homes have a crime rate in a realistic range (per 1,000 / month)',before>0.5&&before<8,before.toFixed(2));
const st0=await p.evaluate(()=>__city.svcTot());ok('City Data counts incidents per month',st0.crime>0,JSON.stringify({crime:st0.crime,people:st0.people}));
const pol=await p.evaluate(([ci,cj])=>{const C=__city;const okp=C.plop('police',ci-2,cj-7);C.fastForward(1);const civ=C.civs.find(x=>x.type==='police');const s=C.svcStat(civ);return{okp,s:{...s},w:C.trips().stats.workers}},c);
ok('police station placed and staffed from the workforce',pol.okp&&pol.s.staff>=6&&pol.s.staffNeed>=6,JSON.stringify(pol));
const after1=await avg();ok('crime does not vanish instantly when a station opens',after1>before*0.75,`${before.toFixed(2)} -> ${after1.toFixed(2)}`);
await p.evaluate(()=>__city.fastForward(90));const after90=await avg();
ok('crime near a new police station drops measurably over 3 months',after90<before*0.88,`${before.toFixed(2)} -> ${after90.toFixed(2)}`);
const ps=await p.evaluate(()=>{const C=__city;const civ=C.civs.find(x=>x.type==='police');return {...C.svcStat(civ)}});ok('station shows incidents, arrests and inmates',ps.a>0&&ps.b>0&&ps.c>0&&ps.c<=ps.cap,JSON.stringify(ps));
// sliders: wider radius thins the effect and costs more; staff slider changes staff and wages
const sl=await p.evaluate(()=>{const C=__city;const civ=C.civs.find(x=>x.type==='police');if(!civ)return {err:C.civs.map(x=>x.type)};const s0={...C.svcStat(civ)},u0=C.svcUpkeep(civ);civ.rr=1.5;C.computeAll();C.computeRisks();const s1={...C.svcStat(civ)},u1=C.svcUpkeep(civ);
 delete civ.rr;civ.sf=2;C.computeAll();C.computeRisks();const s2={...C.svcStat(civ)},u2=C.svcUpkeep(civ);civ.sf=999;C.computeRisks();const s3={...C.svcStat(civ)};
 const html=C.serviceHtml(civ);civ.sf=10;C.computeRisks();const sv=JSON.parse(JSON.stringify(C.serialize()));C.applySave(sv);const back=C.civs.find(x=>x.type==='police');
 return{s0,s1,s2,s3,u0,u1,u2,max:C.svcMax(civ),html:/svcRR/.test(html)&&/svcSF/.test(html),saved:back.sf,ver:sv.version}});
if(sl.err)console.log('ERR',JSON.stringify(sl.err));ok('wider radius = lower service quality, higher upkeep',sl.s1.strength<sl.s0.strength&&sl.u1>sl.u0,JSON.stringify([sl.s0.strength,sl.s1.strength,sl.u0,sl.u1]));
ok('cutting staff = understaffed, lower quality, lower wages',sl.s2.staff===2&&sl.s2.strength<sl.s0.strength&&sl.u2<sl.u0,JSON.stringify([sl.s2.staff,sl.s2.strength,sl.u2]));
ok('staff capped by building max',sl.s3.staff<=sl.max,JSON.stringify([sl.s3.staff,sl.max]));
ok('info panel has radius and staff sliders',sl.html);ok('saves keep per-building staff (v16)',sl.saved===10&&sl.ver>=16,JSON.stringify([sl.saved,sl.ver]));
// hospital: doctors, nurses, patients; better schooling -> fewer patients per 1,000
const hp=await p.evaluate(([ci,cj])=>{const C=__city;const hok=C.plop('hospital',ci-2,cj+4);C.computeAll();C.computeRisks();const h=C.civs.find(x=>x.type==='hospital');if(!h)return{err:[hok,C.sim().funds,C.zone[ci-2][cj+4],C.bld[ci-2][cj+4],C.civs.map(x=>x.type+x.i+','+x.j)]};const a={...C.svcStat(h)};
 C.plop('highschool',ci-2,cj-14);C.plop('school',ci-2,cj-3);C.computeAll();C.computeRisks();const b2={...C.svcStat(h)};return{a,b:b2,html:C.serviceHtml(h)}},c);
if(hp.err)console.log('HERR',JSON.stringify(hp.err),c);ok('hospital shows doctors, nurses and patients',hp.a.c>=4&&hp.a.d>=10&&hp.a.a>0&&/svcDoctors/.test(hp.html),JSON.stringify(hp.a));
const r0=hp.a.inDem/hp.a.served*1000,r1=hp.b.inDem/hp.b.served*1000;ok('inpatients ≈ 1–2 per 1,000 and fall when schools raise education',r0>0.8&&r0<3&&r1<r0,`${r0.toFixed(2)} -> ${r1.toFixed(2)} per 1k`);
const sc=await p.evaluate(()=>{const C=__city;const s=C.civs.find(x=>x.type==='school');return{...C.svcStat(s)}});
ok('school: students from school-age kids, 16 per teacher',sc.a>0&&Math.abs(sc.a-sc.served)<1&&sc.staff===Math.max(1,Math.ceil(sc.a/16)),JSON.stringify(sc));
const fr=await p.evaluate(([ci,cj])=>{const C=__city;C.plop('fire',ci-2,cj+9);C.computeAll();C.computeRisks();const f=C.civs.find(x=>x.type==='fire');return{...C.svcStat(f)}},c);
ok('fire station: firefighters, trucks, calls, fires',fr.staff>=12&&fr.c>=1&&fr.b>0&&fr.a>0,JSON.stringify(fr));
const bud=await p.evaluate(()=>{const C=__city;const t=C.svcTot();return t.staff>0&&t.fill>0});ok('public staff counted against the workforce',bud);
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
