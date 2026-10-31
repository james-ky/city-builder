// Classic-layout controls (?ui=old); the new UI opens the same panel from its Data category.
// City Data panel: toggles (button, Shift+D), every tab renders real numbers, education model drifts with school coverage, save v11 + migration.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4318/',shots=process.argv.includes('--shots');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Datatown&ui=old');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-12;a<=12&&g;a++)for(let b2=-12;b2<=12;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
// a town: main street along row ci from the map edge, homes on the west, shops in the middle, industry on the east
await p.evaluate(([ci,cj])=>{const C=__city,N=C.N();const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.rw[i][j]=0;C.zone[i][j]='';C.bld[i][j]=0};
 for(let j=0;j<N;j++)R(ci,j);for(let d=-10;d<=10;d++){R(ci+d,cj-10);R(ci+d,cj+10)}
 const Z=(i,j,z)=>{if(C.road[i][j]||C.terrain[i][j]==='water')return;C.zone[i][j]=z;C.bld[i][j]=1};
 for(let d=-9;d<=9;d++){Z(ci+d,cj-11,'R');Z(ci+d,cj-9,'R');Z(ci+d,cj+9,'I');Z(ci+d,cj+11,'I')}for(let j=cj-6;j<=cj+6;j++){Z(ci-1,j,'C');Z(ci+1,j,'C')}
 C.refresh();C.markTripsDirty();C.fastForward(1);C.centerOn(ci,cj);C.setZoom(1.6);},c);
// 1. no random buses or semis
await p.evaluate(([ci,cj])=>{const C=__city;for(const [i,j] of [[ci,cj-8],[ci,cj+8]])C.toggleStop(i,j);C.paint('svc:busdepot',ci+1,cj-8,ci+1,cj-8);C.paint('svc:school',ci-11,cj-9,ci-11,cj-9);C.setTool('select');C.markTripsDirty();for(let k=0;k<3;k++)C.fastForward(1);C.computeAll()},c);
await p.click('#dataBtn');let vis=await p.evaluate(()=>getComputedStyle(document.getElementById('dataPanel')).display);ok('📊 button opens the panel',vis==='flex');
await p.keyboard.press('Shift+D');vis=await p.evaluate(()=>getComputedStyle(document.getElementById('dataPanel')).display);ok('Shift+D closes it',vis==='none');
await p.keyboard.press('Shift+D');
// a few months of history
const e0=await p.evaluate(()=>__city.sim().edu.slice());await p.evaluate(()=>{for(let k=0;k<12;k++)__city.monthly()});
const want={Budget:/Total income[\s\S]*Net[\s\S]*Funds/,Demand:/Residential[\s\S]*Why — Residential[\s\S]*Jobs vs residents/,Transportation:/Car[\s\S]*Bus[\s\S]*Walk[\s\S]*Average commute[\s\S]*Failed commutes[\s\S]*Bus ridership[\s\S]*Freight trucks[\s\S]*Spaces in use/,Population:/Population[\s\S]*Households[\s\S]*Children[\s\S]*Adults[\s\S]*Seniors/,Education:/No diploma[\s\S]*Bachelor[\s\S]*school coverage/,Jobs:/Commercial jobs filled[\s\S]*Unemployment/,Utilities:/Power[\s\S]*Water/};
for(const [t,re] of Object.entries(want)){await p.click(`[data-tab="${t}"]`);const tx=await p.evaluate(()=>__city.dataText());ok(`${t} tab shows its stats`,re.test(tx)&&!/NaN|undefined|Infinity/.test(tx),tx.replace(/\n+/g,' | ').slice(0,140))}
const tr=await p.evaluate(()=>{__city.dataPanel(true,'Transportation');return __city.dataText()});ok('transport numbers are real (bus riders and trucks > 0)',/Bus ridership\s*[1-9]/.test(tr)&&/Freight trucks\s*[1-9]/.test(tr));
const nt=await p.evaluate(()=>{__city.dataPanel(true,'Population');return __city.dataText()});ok('unsimulated stats say "not tracked yet"',/not tracked yet/.test(nt));
const hs=await p.evaluate(()=>__city.hist().length);ok('monthly budget history recorded',hs>=12,String(hs));
const e1=await p.evaluate(()=>({edu:__city.sim().edu,cov:__city.eduCoverage()}));ok('education rises with school coverage',e1.cov>0&&e1.edu[3]>e0[3]&&Math.abs(e1.edu.reduce((a,b)=>a+b,0)-1)<1e-6,JSON.stringify({e0,e1}));
const sv=await p.evaluate(()=>{const o=__city.serialize();return{v:o.version,edu:o.sim.edu,h:o.hist.length}});ok('save v11+ stores education and history',sv.v>=11&&sv.edu.length===4&&sv.h>=12,JSON.stringify(sv));
const mg=await p.evaluate(()=>{const o=JSON.parse(JSON.stringify(__city.serialize()));delete o.sim.edu;delete o.hist;o.version=10;__city.applySave(o);return{edu:__city.sim().edu,h:__city.hist().length}});ok('pre-v11 saves migrate (default education, empty history)',mg.edu.length===4&&mg.h===0,JSON.stringify(mg));
await p.evaluate(()=>{for(let k=0;k<12;k++)__city.monthly()});
if(shots){await p.setViewportSize({width:1500,height:900});await p.evaluate(()=>__city.dataPanel(true,'Budget'));await p.waitForTimeout(600);const a=await p.locator('#dataPanel').screenshot({path:'/tmp/dp1.png'});
 for(const t of ['Transportation','Education']){await p.evaluate(t=>__city.dataPanel(true,t),t);await p.waitForTimeout(400);await p.locator('#dataPanel').screenshot({path:'/tmp/dp_'+t+'.png'})}
 await p.evaluate(()=>__city.dataPanel(true,'Demand'));await p.waitForTimeout(600);await p.screenshot({path:'screenshots/data-panel-full.png'})}
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
