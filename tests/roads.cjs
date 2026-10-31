// Road tiers, construction stages and free zoning. Usage: node tests/roads.cjs URL
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1600,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{if(!sessionStorage.s){sessionStorage.s=1;localStorage.clear();indexedDB.deleteDatabase('city-builder')}});
await p.goto(url+'?size=128&seed=3&city=Roadville');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const S=(i,j)=>p.evaluate(([i,j])=>__city.tileToScreen(i,j),[i,j]);
async function drag(a,bb){await p.evaluate(([i,j])=>{__city.setZoom(1);__city.centerOn(i,j)},[(a[0]+bb[0])/2,(a[1]+bb[1])/2]);await p.waitForTimeout(150);const s=await S(...a),e=await S(...bb);await p.mouse.move(s.x,s.y);await p.mouse.down();await p.mouse.move(e.x,e.y,{steps:6});await p.mouse.up();await p.waitForTimeout(100)}
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<60;r++)for(let i=64-r;i<=64+r;i++)for(let j=64-r;j<=64+r;j++){let g=true;for(let a=-8;a<=8&&g;a++)for(let b2=-8;b2<=8;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});const [ci,cj]=c;
const F=()=>p.evaluate(()=>__city.sim().funds);
// asphalt road: 11 tiles
let f0=await F();await p.keyboard.press('2');await drag([ci-5,cj],[ci+5,cj]);let f1=await F();
ok('asphalt road costs 11 x $25',Math.round(f0-f1)===275,f0-f1);
ok('new road starts surveyed and closed',await p.evaluate(([i,j])=>__city.rstage[i][j]===1&&__city.rtier[i][j]===2,[ci,cj]));
const seen=new Set();for(let d=0;d<16;d++){await p.evaluate(()=>__city.fastForward(1));seen.add(await p.evaluate(([i,j])=>__city.rstage[i][j],[ci,cj]))}
ok('asphalt goes through surveyed/graded/gravel/surface/done',[1,2,3,4,0].every(x=>seen.has(x)),[...seen].join(','));
// dirt road stops after grading
await p.evaluate(()=>__city.setRoadTier(1));f0=await F();await drag([ci,cj+2],[ci,cj+6]);f1=await F();ok('dirt road costs 5 x $6',Math.round(f0-f1)===30,f0-f1);
const ds=new Set();for(let d=0;d<8;d++){await p.evaluate(()=>__city.fastForward(1));ds.add(await p.evaluate(([i,j])=>__city.rstage[i][j],[ci,cj+4]))}ok('dirt skips gravel/surface',!ds.has(3)&&!ds.has(4)&&ds.has(0),[...ds].join(','));
// upgrade dirt -> concrete pays the difference, stays open
await p.evaluate(()=>__city.setRoadTier(3));f0=await F();await drag([ci,cj+2],[ci,cj+6]);f1=await F();ok('upgrade pays difference 5 x $64',Math.round(f0-f1)===320,f0-f1);
ok('upgrade starts at gravel with old road open',await p.evaluate(([i,j])=>__city.rstage[i][j]===3&&__city.rfrom[i][j]===1,[ci,cj+4]));
await p.evaluate(()=>__city.fastForward(20));ok('upgrade finishes as concrete',await p.evaluate(([i,j])=>__city.rstage[i][j]===0&&__city.rtier[i][j]===3,[ci,cj+4]));
// free zoning & dezoning
await p.keyboard.press('3');f0=await F();await drag([ci-4,cj-3],[ci-1,cj-1]);f1=await F();ok('zoning is free',f0===f1,f0-f1);
ok('zone actually placed',await p.evaluate(([i,j])=>__city.zone[i][j]==='R',[ci-2,cj-2]));
await p.keyboard.press('4');f0=await F();await drag([ci-4,cj-3],[ci-1,cj-1]);f1=await F();ok('re-zoning is free',f0===f1,f0-f1);
// save round trip + v2 migration
const rt=await p.evaluate(()=>{const o=JSON.parse(JSON.stringify(__city.serialize()));const t=o.grids.rtier;__city.applySave(o);const a=__city.serialize().grids.rtier===t;
 delete o.grids.rtier;delete o.grids.rstage;delete o.grids.rday;delete o.grids.rfrom;o.version=2;__city.applySave(o);let bad=0;for(let i=0;i<__city.N();i++)for(let j=0;j<__city.N();j++)if(__city.road[i][j]&&(__city.rtier[i][j]!==2||__city.rstage[i][j]!==0))bad++;return [a,bad]});
ok('save round trip keeps tiers',rt[0]);ok('old saves load as finished asphalt',rt[1]===0,'bad '+rt[1]);
// widths: street (1 tile, 4 lanes) and avenue (2 tiles)
await p.evaluate(()=>{__city.sim().funds+=20000;__city.setRoadTier(2);__city.setRoadWidth(1)});await p.keyboard.press('2');f0=await F();await drag([ci-5,cj-6],[ci+5,cj-6]);f1=await F();
ok('asphalt street costs 11 x $45',Math.round(f0-f1)===495,f0-f1);ok('street tiles are width 1',await p.evaluate(([i,j])=>__city.rw[i][j]===1,[ci,cj-6]));
await p.evaluate(()=>__city.setRoadWidth(2));f0=await F();await drag([ci-5,cj-9],[ci+5,cj-9]);f1=await F();
const av=await p.evaluate(([i,j])=>[__city.rw[i][j-9],__city.rw[i][j-8],__city.road[i][j-8]],[ci,cj]);ok('avenue drag lays 2 tiles side by side',av[0]===2&&av[1]===2&&av[2],JSON.stringify(av));
ok('avenue costs 22 tiles x $57 (6-lane divided)',Math.round(f0-f1)===22*57,f0-f1);
await p.evaluate(()=>{__city.setRoadWidth(1);__city.setRoadTier(1)});ok('dirt forces 2-lane',await p.evaluate(()=>__city.roadCost(0,0)===6));
await p.evaluate(()=>__city.fastForward(20));
const sv=await p.evaluate(()=>{const o=JSON.parse(JSON.stringify(__city.serialize()));const w=o.grids.rwidth;__city.applySave(o);const a=__city.serialize().grids.rwidth===w;delete o.grids.rwidth;__city.applySave(o);let n=0;for(const r of __city.rw)for(const v of r)n+=v;return [a,n]});
ok('save keeps widths; old saves load as 2-lane',sv[0]&&sv[1]===0,JSON.stringify(sv));
ok('no page errors',!errs.length,errs.join(' | '));console.log(res.join('\n'));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
