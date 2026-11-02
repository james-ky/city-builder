// End game: milestones unlock high-rises (level 4), 2x2 supertalls (level 5) and higher-tier utilities; Milestones panel + unlock toast; save v15 round trip.
// --shot writes screenshots/endgame-*.png
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4500/',shot=process.argv.includes('--shot');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1600,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(url+'?size=64&seed=5&city=Skyline');await p.waitForFunction(()=>window.__city&&__city.N&&window.__ms);await p.evaluate(()=>__city.setSpeed(0));
const FIND=`window.__put=(t,s,ti,tj)=>{const C=__city,N=C.N();for(let r=0;r<20;r++)for(let i0=ti-r;i0<=ti+r;i0++)for(let j0=tj-r;j0<=tj+r;j0++){if(i0<1||j0<1||i0+s>=N||j0+s>=N)continue;let ok=true;for(let a=0;a<s&&ok;a++)for(let b=0;b<s;b++){const x=i0+a,y=j0+b;if(C.terrain[x][y]==='water'||C.road[x][y]||C.civs.some(c=>x>=c.i&&x<c.i+c.s&&y>=c.j&&y<c.j+c.s)){ok=false;break}}if(!ok)continue;
 const sv=[];for(let a=0;a<s;a++)for(let b=0;b<s;b++){const x=i0+a,y=j0+b;sv.push([x,y,C.zone[x][y],C.bld[x][y],C.pline[x][y],C.pipe[x][y]]);C.zone[x][y]='';C.bld[x][y]=0;C.consT[x][y]=0;C.pline[x][y]=false;C.pipe[x][y]=false}C.refresh();
 if(C.plop(t,i0+((s-1)>>1),j0+((s-1)>>1)))return [i0,j0];for(const [x,y,z,l,pl,pp] of sv){C.zone[x][y]=z;C.bld[x][y]=l;C.pline[x][y]=pl;C.pipe[x][y]=pp}}return null}`;
await p.evaluate(FIND);const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const s0=await p.evaluate(()=>({ach:__ms.list().length,locked:[...document.querySelectorAll('#services button[data-util]')].filter(b=>b.dataset.locked).map(b=>b.dataset.t),cap:__ms.levelCap(1,1)}));
ok('new city: no milestones, 6 locked utilities, zones cap at level 3',s0.ach===0&&s0.locked.length===6&&s0.cap===3,JSON.stringify(s0));
const lockTry=await p.evaluate(()=>{const C=__city;C.sim().funds=1e7;const f=C.sim().funds;const r=C.plop('nuclear',30,30);return {r,spent:f-C.sim().funds}});
const g1=await p.evaluate(()=>{__ms.grant('pop500');return {wf:__ms.unlocked('windfarm'),gas:__ms.unlocked('gas'),btn:document.querySelector('#services button[data-t="svc:windfarm"]').dataset.locked}});
ok('earning Town unlocks only the wind farm',g1.wf&&!g1.gas&&!g1.btn,JSON.stringify(g1));
ok('a locked plant cannot be built',!lockTry.r&&lockTry.spent===0,JSON.stringify(lockTry));
await p.evaluate(()=>__ms.open());
const panel=await p.evaluate(()=>({tiles:document.querySelectorAll('#milestones .ms').length,got:document.querySelectorAll('#milestones .ms.got').length,text:document.querySelector('#milestones').innerText.trim().length}));
if(shot){await p.evaluate(()=>{window.__tut?.setMode?.('off');__ms.open()});await p.waitForTimeout(500);await p.screenshot({path:'screenshots/endgame-milestones.png'});await p.evaluate(()=>{document.querySelector('#milestones').style.display='none';__ui2.openTray('util')});await p.waitForTimeout(600);await p.screenshot({path:'screenshots/endgame-utilities.png'});await p.evaluate(()=>__ui2.openTray('util'))}
ok('Milestones panel: 8 icon tiles, minimal text',panel.tiles===8&&panel.got<=1&&panel.text<40,JSON.stringify(panel));
// a dense city: services in the middle, streets, a park, bus stops
const setup=await p.evaluate(()=>{const C=__city,N=C.N();C.genDense(3);C.sim().funds=1e8;
 const put=[];for(const [t,s,i,j] of [['hospital',3,20,20],['highschool',3,20,28],['police',2,28,20],['fire',2,28,28],['hospital',3,36,36],['highschool',3,36,28],['police',2,28,36],['fire',2,36,20],['clinic',1,20,36]])put.push(!!__put(t,s,i,j));
 const pk=Object.keys(C.sim?{}:{});for(const [i,j] of [[26,26],[34,34],[22,34],[34,22]])put.push(!!(__put('park_neighborhood',2,i,j)||__put('park_plaza',1,i,j)));
 for(const id of ['pop500','pop1k','pop5k','pop20k','pop50k','black6','black24','grid12'])__ms.grant(id);put.push(!!__put('nuclear',4,8,8));__put('treatment',3,50,50);__put('desal',3,50,10);for(let k=0;k<24;k++)__put('tower',1,8+((k*7)%48),8+((k*13)%48));
 C.setRoadTier(2);C.setRoadWidth(1);for(const k of [16,24,32,40])C.paint('road',k,8,k,48);for(const k of [16,24,32,40])C.paint('road',8,k,48,k);
 for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.road[i][j])C.rstage[i][j]=0;
 for(const [i,j] of [[16,20],[24,20],[32,36],[24,28],[40,36],[28,24],[36,32]])C.toggleStop(i,j);
 C.refresh();C.computeAll();return put},);
ok('services placed',setup.slice(0,9).every(Boolean),JSON.stringify(setup));
await p.evaluate(()=>__city.fastForward(1));
const earned=await p.evaluate(()=>({ach:__ms.list(),pop:__city.sim().pop,toast:document.querySelector('#msToast').style.opacity,toastTxt:document.querySelector('#msToast').innerText,locked:[...document.querySelectorAll('#services button[data-util]')].filter(b=>b.dataset.locked).map(b=>b.dataset.t)}));
ok('population milestones are earned and toast',earned.ach.includes('pop500')&&earned.ach.includes('pop5k')&&+earned.toast>0.5&&earned.toastTxt.length>3,JSON.stringify(earned));

// grow: force strong demand by repeated ticks; level 4 appears only where gates pass
let g={};for(let r=0;r<40;r++){g=await p.evaluate(()=>{const C=__city,N=C.N();C.sim().funds=1e8;for(const z of ['R','C','I'])C.sim()['d'+z]=1;C.fastForward(10);let pw=0,wt=0,zt=0;for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.zone[i][j]&&C.bld[i][j]){zt++;if(C.powered[i][j])pw++;if(C.watered[i][j])wt++}let l4=0,l5=0,bad4=0;for(let i=0;i<N;i++)for(let j=0;j<N;j++){const L=C.bld[i][j];if(L===4)l4++;if(L===5)l5++}return {pw,wt,zt,dem:[C.sim().dR,C.sim().dC,C.sim().dI].map(v=>+v.toFixed(2)),l4,l5,big:__ms.big().length,cap:__ms.levelCap(18,26),ach:__ms.list()}});if(g.l4>8&&(g.big>0||!g.ach.includes('pop20k')))break}
ok('high-rises (level 4) grow once unlocked',g.l4>0,JSON.stringify(g));
const v4=await p.evaluate(()=>{const C=__city,N=C.N();let n=0,bad=0,res=[],jobs=[];for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.bld[i][j]===4){n++;const c=C.cov;if(!(c.fire[i][j]>0&&c.police[i][j]>0&&c.health[i][j]>0))bad++;if(C.zone[i][j]==='R')res.push(C.resCap(i,j))}return {n,bad,resAvg:res.length?res.reduce((a,b)=>a+b,0)/res.length:null}});
ok('every high-rise has fire, police and health cover',v4.bad===0,JSON.stringify(v4));
ok('a residential high-rise holds ~120 flats (180-280 people)',v4.resAvg===null||(v4.resAvg>=180&&v4.resAvg<=280),JSON.stringify(v4));
// deterministic block: two parallel Streets 3 apart with a 2-deep Dense commercial strip between them (every tile fronts a road), services, power, water, a bus stop
const p2=await b.newPage({viewport:{width:1600,height:1000}});p2.on('pageerror',e=>errs.push(e.message));
await p2.goto(url+'?size=64&seed=11&city=Towers');await p2.waitForFunction(()=>window.__city&&__city.N&&window.__ms,null,{timeout:150000});await p2.evaluate(()=>{__city.setSpeed(0);window.__tut?.setMode?.('off')});
const g5=await p2.evaluate(()=>{const C=__city,N=C.N(),t=C.terrain;let o=null;for(let r=0;r<30&&!o;r++)for(let i=32-r;i<=32+r&&!o;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-2;a<10&&g;a++)for(let b=-1;b<26;b++)if(!t[i+a]||t[i+a][j+b]==='water'||t[i+a][j+b]===undefined){g=false;break}if(g){o=[i,j];break}}
 if(!o)return {err:'no land'};const [oi,oj]=o;for(const id of ['pop500','pop1k','pop5k','pop20k','pop50k','black6','black24','grid12'])__ms.grant(id);C.sim().funds=1e8;
 C.setRoadTier(2);C.setRoadWidth(1);C.paint('road',oi,oj,oi,oj+24);C.paint('road',oi+3,oj,oi+3,oj+24);C.paint('road',oi,oj,oi+3,oj);
 for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.road[i][j])C.rstage[i][j]=0;
 C.paint('pipe',oi,oj,oi,oj+24);C.paint('pipe',oi+3,oj,oi+3,oj+24);C.paint('pline',oi+3,oj,oi+3,oj+24);C.paint('pline',oi,oj,oi,oj+24);
 C.setZoneDensity(3);C.paint('C',oi+1,oj+2,oi+2,oj+12);
 const put=[C.plop('hospital',oi+5,oj+5),C.plop('police',oi+4,oj+8),C.plop('fire',oi+4,oj+11),C.plop('tower',oi+4,oj+14),C.plop('tower',oi+4,oj+15),C.plop('nuclear',oi+5,oj+18)];
 C.toggleStop(oi+3,oj+6);C.setTool('select');
 for(let i=oi+1;i<=oi+2;i++)for(let j=oj+2;j<=oj+12;j++){C.bld[i][j]=3;C.consT[i][j]=0}C.refresh();C.fastForward(1);
 let l4=0,first=-1;for(let k=0;k<400&&!(first>=0&&k>first+10);k++){C.sim().funds=1e8;C.sim().dC=1;C.fastForward(1);let n=0;for(let i=oi+1;i<=oi+2;i++)for(let j=oj+2;j<=oj+12;j++)if(C.bld[i][j]===4)n++;l4=Math.max(l4,n);if(first<0&&__ms.big().length)first=k}
 window.__o=o;return {o,put,l4,big:__ms.big().length,first}});
ok('a strip with services and a Street front grows high-rises',g5.l4>0,JSON.stringify(g5));
g.big=g5.big;
if(g.ach.includes('pop20k')){ok("supertall 2x2 blocks form (level 5)",g.big>0,JSON.stringify({...g,g5}));
 const blk=await p2.evaluate(()=>{const C=__city,N=C.N();const k=__ms.big()[0];if(k===undefined)return null;const i0=k/N|0,j0=k%N;return [0,1].flatMap(a=>[0,1].map(b=>[C.bld[i0+a][j0+b],C.consT[i0+a][j0+b],C.zone[i0+a][j0+b]]))});
 ok('a supertall covers 4 tiles of one zone',blk&&blk.every(x=>(x[0]===5||x[1]===5)&&x[2]===blk[0][2]),JSON.stringify(blk));}
if(shot&&g5.o){await p2.evaluate(()=>{const C=__city,[oi,oj]=window.__o;C.centerOn(oi+3,oj+12);C.setZoom(1.5);C.refresh()});await p2.waitForTimeout(1500);await p2.screenshot({path:'screenshots/endgame-highrise.png'});
 await p2.evaluate(()=>__ui2.openTray('util'));await p2.waitForTimeout(600);await p2.screenshot({path:'screenshots/endgame-utilities-unlocked.png'});await p2.evaluate(()=>__ui2.openTray('util'))}
// bulldoze one tile of a supertall: the rest fall back to level 4
const dz=await p2.evaluate(()=>{const C=__city,N=C.N();const k=__ms.big()[0];if(k===undefined)return null;const i0=k/N|0,j0=k%N;C.zone[i0][j0]='';C.bld[i0][j0]=0;C.fastForward(1);return {gone:!__ms.big().includes(k),rest:[C.bld[i0+1][j0],C.bld[i0][j0+1],C.bld[i0+1][j0+1]]}});
if(dz)ok('breaking a supertall block reverts the rest to high-rises',dz.gone&&dz.rest.every(v=>v<=4),JSON.stringify(dz));
// unlocked utilities can be built
const ut=await p.evaluate(()=>{const C=__city;__ms.grant('pop50k');__ms.grant('black24');return {nuc:__put('nuclear',4,10,10),gas:__put('gas',3,10,50),wf:__put('windfarm',3,50,10),solar:__put('solar',4,50,50)}});
ok('nuclear, gas, wind and solar farms build once unlocked',ut.nuc&&ut.gas&&ut.wf&&ut.solar,JSON.stringify(ut));
// save round trip
const sv=await p.evaluate(()=>{const C=__city,o=JSON.parse(JSON.stringify(C.serialize()));const a=__ms.list().length,bg=__ms.big().length;C.applySave(o);return {v:o.version,a,b:__ms.list().length,bg,bg2:__ms.big().length,towers:Array.isArray(o.towers)}});
ok('save v15 keeps milestones and supertalls',sv.v>=15&&sv.a===sv.b&&sv.bg===sv.bg2&&sv.towers,JSON.stringify(sv));
const old=await p.evaluate(()=>{const C=__city,o=JSON.parse(JSON.stringify(C.serialize()));delete o.sim.ach;delete o.towers;o.version=14;C.applySave(o);return {a:__ms.list().length,cap:__ms.levelCap(1,1)}});
ok('a v14 save loads with no milestones (re-earned from population)',old.a===0&&old.cap===3,JSON.stringify(old));
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs.slice(0,5));process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
