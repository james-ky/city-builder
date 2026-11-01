// First-city checklist: shows on a new city, ticks steps from live game state, collapses, hides (remembered) and reopens from the menu.
// Usage: node tests/tutorial.cjs URL [--shot out.png]
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/',si=process.argv.indexOf('--shot');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Tut');await p.waitForFunction(()=>window.__city&&__city.N&&window.__tut);
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const T=()=>p.evaluate(()=>{__tut.render();return __tut.state()});const vis=()=>p.evaluate(()=>{const e=document.getElementById('uTut');return e&&getComputedStyle(e).display!=='none'});
let s=await T();ok('checklist shows on a new city with nothing done',await vis()&&s.done.length===0&&s.total===10,JSON.stringify(s));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-9;a<=9&&g;a++)for(let b=-9;b<=9;b++)if(!t[i+a]||t[i+a][j+b]!=='grass'){g=false;break}if(g)return[i,j]}});
await p.evaluate(([i,j])=>{const C=__city;C.setSpeed(0);C.sim().funds=1e6;C.paint('road',i,j-8,i,j+8)},c);s=await T();ok('road ticks "Build a road"',s.done.includes('road')&&s.done.length===1,s.done.join());
await p.evaluate(([i,j])=>{const C=__city;C.paint('R',i+1,j-7,i+2,j-1);C.paint('C',i+1,j+1,i+1,j+3);C.paint('I',i-2,j+1,i-1,j+4)},c);s=await T();ok('zoning ticks homes and shops/industry',s.done.includes('R')&&s.done.includes('CI'),s.done.join());
await p.evaluate(([i,j])=>{const C=__city;C.paint('svc:wind',i-2,j-7,i-2,j-7);C.paint('pline',i-1,j-7,i+1,j-7)},c);
await p.evaluate(([i,j])=>{const C=__city;C.paint('svc:tower',i-2,j-5,i-2,j-5);C.paint('pipe',i-2,j-4,i+2,j-4);C.paint('pipe',i+2,j-7,i+2,j-1);for(let jj=j-7;jj<=j-1;jj++)C.bld[i+1][jj]=1;C.refresh();C.computeAll();C.fastForward(2)},c);for(let k=0;k<10&&!(await T()).done.includes('wateredR');k++)await p.evaluate(()=>__city.fastForward(1));
s=await T();ok('power plant and water ticked',s.done.includes('plant')&&s.done.includes('water'),s.done.join());ok('power and water reach homes',s.done.includes('poweredR')&&s.done.includes('wateredR'),s.done.join());
await p.evaluate(()=>__city.sim().pop=60);s=await T();ok('population goal ticks at 50',s.done.includes('pop'),s.done.join());
await p.mouse.click(700,420);await p.keyboard.press('b');s=await T();ok('opening the budget ticks it',s.done.includes('budget'),s.done.join());await p.keyboard.press('b');
await p.keyboard.press('Control+s');await p.waitForTimeout(1500);s=await T();ok('saving ticks it; all 10 done',s.done.includes('saved')&&s.done.length===10,s.done.join());
ok('finished message shows',await p.evaluate(()=>/All done/.test(document.getElementById('uTut').innerText)));
if(si>0){await p.evaluate(()=>{__tut.setMode('open')});await p.evaluate(([i,j])=>{__city.centerOn(i,j);__city.setZoom(1.3)},c);await p.waitForTimeout(1500);await p.screenshot({path:process.argv[si+1]})}
await p.click('#uTut .hd');s=await T();const hh=await p.evaluate(()=>document.getElementById('uTut').offsetHeight);ok('clicking the header collapses it',s.mode==='min'&&hh<50,s.mode+' h='+hh);
await p.click('#uTut .x');ok('close hides it',!(await vis()));
await p.reload();await p.waitForFunction(()=>window.__city&&__city.N&&window.__tut);ok('hidden stays hidden after reload',!(await vis()));
await p.click('#uMenuBtn');await p.waitForTimeout(200);const items=await p.$$('#uMenu button');await items[items.length-1].click();ok('menu item reopens it',await vis()&&(await T()).mode==='open');
ok('no page errors',!errs.length,errs.join('; '));console.log(res.join('\n'));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
