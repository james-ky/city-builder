// Feature checks for things that were never exercised end to end. Usage: node tests/features.cjs URL
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1600,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{if(!sessionStorage.s){sessionStorage.s=1;localStorage.clear();indexedDB.deleteDatabase('city-builder')}});
await p.goto(url+'?size=128&seed=3&city=Testville');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const S=(i,j)=>p.evaluate(([i,j])=>__city.tileToScreen(i,j),[i,j]);const res=[];const ok=(n,c,d='')=>{res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''))};
async function look(i,j){await p.evaluate(([i,j])=>{__city.setZoom(1);__city.centerOn(i,j)},[i,j]);await p.waitForTimeout(200)}
async function drag(a,bb){await look((a[0]+bb[0])/2,(a[1]+bb[1])/2);const s=await S(...a),e=await S(...bb);await p.mouse.move(s.x,s.y);await p.mouse.down();await p.mouse.move(e.x,e.y,{steps:6});await p.mouse.up();await p.waitForTimeout(100)}
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<60;r++)for(let i=64-r;i<=64+r;i++)for(let j=64-r;j<=64+r;j++){let g=true;for(let a=-8;a<=8&&g;a++)for(let b2=-8;b2<=8;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
const [ci,cj]=c;
await p.keyboard.press('2');await drag([ci-7,cj],[ci+7,cj]);await drag([ci,cj-7],[ci,cj+7]);
await p.keyboard.press('3');await drag([ci-6,cj-4],[ci-1,cj-1]);await p.keyboard.press('5');await drag([ci+1,cj+1],[ci+6,cj+4]);await p.keyboard.press('1');
// refused placements
const r1=await p.evaluate(()=>{const t=__city.terrain,N=__city.N();for(let i=2;i<N-2;i++)for(let j=2;j<N-2;j++)if(t[i][j]==='water'&&t[i+1][j]==='water'&&t[i][j+1]==='water')return __city.plop('police',i,j);return 'nowater'});ok('police on water refused',r1===false,String(r1));
ok('pump far from water refused',await p.evaluate(([i,j])=>__city.plop('pump',i+3,j+3),[ci,cj])===false);
ok('service on a road refused',await p.evaluate(([i,j])=>__city.plop('police',i,j+2),[ci,cj])===false);
const f0=await p.evaluate(()=>__city.sim().funds);await p.evaluate(()=>{__city.sim().funds=50});ok('unaffordable coal refused',await p.evaluate(([i,j])=>__city.plop('coal',i+3,j+3),[ci,cj])===false);await p.evaluate(f=>{__city.sim().funds=f},f0);
// pump and coal on shoreline
const sh=await p.evaluate(()=>{const t=__city.terrain,N=__city.N();const out={};for(let i=3;i<N-4&&!out.pump;i++)for(let j=3;j<N-4;j++){if(t[i][j]!=='water'&&__city.plop('pump',i,j)){out.pump=[i,j];break}}
 for(let i=3;i<N-6&&!out.coal;i++)for(let j=3;j<N-6;j++){let land=0,wat=0;for(let a=-1;a<=3;a++)for(let b=-1;b<=3;b++){const v=t[i+a]&&t[i+a][j+b];if(a>=0&&a<3&&b>=0&&b<3){if(v!=='water')land++}else if(v==='water')wat++}if(land===9&&wat>0&&__city.plop('coal',i+1,j+1)){out.coal=[i,j];break}}return out});
ok('pump placed on a shoreline',!!sh.pump,JSON.stringify(sh.pump));ok('coal placed on a shoreline',!!sh.coal,JSON.stringify(sh.coal));
// power line across a road (pylons over roads)
await p.keyboard.press('7');await drag([ci+2,cj-3],[ci+2,cj+3]);await p.keyboard.press('1');ok('power line crosses road',await p.evaluate(([i,j])=>!!__city.pline[i+2][j],[ci,cj]),'');
await p.evaluate(([i,j])=>{__city.sim().funds+=20000;for(const [t,a,b] of [['wind',i-7,j-2],['wind',i-7,j-3],['wind',i-7,j-4],['tower',i-5,j-5],['tower',i-2,j-5],['wind',i+7,j+2],['tower',i+3,j+5]])__city.plop(t,a,b)},[ci,cj]);
// grow, then lots
await p.evaluate(()=>__city.fastForward(120));const nl=await p.evaluate(()=>__city.lots().length);ok('suburban lots grew',nl>0,'lots '+nl);
// save/load with lots
const rt=await p.evaluate(async()=>{const o=__city.serialize();const n=o.lots.length;__city.applySave(JSON.parse(JSON.stringify(o)));return [n,__city.lots().length]});ok('save/load keeps lots',rt[0]===rt[1],rt.join('->'));
// Ctrl+S
await p.keyboard.press('Control+s');await p.waitForTimeout(1500);const sv=await p.evaluate(async()=>(await __city.listSaves()).map(s=>s.id));ok('Ctrl+S saves',sv.some(x=>x.startsWith('slot:')),sv.join(','));
// lot-to-square upgrade: run long with services and see lots get replaced by bigger buildings
await p.evaluate(([i,j])=>{__city.plop('school',i+2,j-2);__city.plop('police',i-2,j+2);__city.plop('clinic',i+2,j+2)},[ci,cj]);
await p.evaluate(()=>__city.fastForward(1500));const up=await p.evaluate(()=>{let hi=0;const z=__city.zone,bl=__city.bld;for(let i=0;i<__city.N();i++)for(let j=0;j<__city.N();j++)if(z[i][j]==='R'&&bl[i][j]>=2&&!__city.lotAt(i,j))hi++;return [hi,__city.lots().length]});const dbg=await p.evaluate(()=>({pop:__city.sim().pop,dR:__city.sim().dR,u:__city.util}));ok('lots upgrade to square buildings',up[0]>0,JSON.stringify(dbg)+' '+'R level2+ non-lot tiles '+up[0]+', lots '+up[1]);
// bulldoze a lot and a service
const L=await p.evaluate(()=>__city.lots()[0]);if(L){await p.keyboard.press('6');await drag([L.i0,L.j0],[L.i0,L.j0]);await p.keyboard.press('1');ok('bulldoze lot',await p.evaluate(([i,j])=>!__city.lotAt(i,j)&&!__city.bld[i][j],[L.i0,L.j0]))}else ok('bulldoze lot',false,'no lot');
const cv=await p.evaluate(()=>{const c=__city.civs.find(c=>c.type==='police');return c&&[c.i,c.j,__city.civs.length]});if(cv){await p.keyboard.press('6');await drag([cv[0],cv[1]],[cv[0],cv[1]]);await p.keyboard.press('1');ok('bulldoze service',await p.evaluate(n=>__city.civs.length===n-1,cv[2]))}else ok('bulldoze service',false,'none');
await look(ci,cj);await p.screenshot({path:process.argv[3]||'/tmp/features.png'});
ok('no page errors',!errs.length,errs.join('; '));console.log(res.join('\n'));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
