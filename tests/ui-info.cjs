// Hover info follows the cursor and hides on leave; pinned info closes with X / Esc / tool change; fullscreen button + F key.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=UI');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
await p.mouse.move(500,400);await p.waitForTimeout(200);let h=await p.evaluate(()=>{const e=document.getElementById('hud');return{l:parseInt(e.style.left),t:parseInt(e.style.top),d:getComputedStyle(e).display}});
await p.mouse.move(800,300);await p.waitForTimeout(200);let h2=await p.evaluate(()=>{const e=document.getElementById('hud');return{l:parseInt(e.style.left),t:parseInt(e.style.top)}});
ok('hover info follows the cursor',Math.abs(h.l-518)<3&&h2.l>h.l&&h.d!=='none',JSON.stringify([h,h2]));
await p.evaluate(()=>document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerleave',{bubbles:true})));ok('hover info hides when the mouse leaves the map',await p.evaluate(()=>document.getElementById('hud').style.display==='none'));
const pin=async()=>{await p.evaluate(()=>{const C=__city;const N=C.N();for(let i=20;i<44;i++)for(let j=20;j<44;j++)if(C.terrain[i][j]!=='water'){C.road[i][j+1]=true;C.rstage[i][j+1]=0;C.zone[i][j]='C';C.bld[i][j]=1;C.refresh();const s=C.tileToScreen(i,j);window.__pt=s;return}});const s=await p.evaluate(()=>window.__pt);await p.evaluate(s=>__city.setTool('select'),s);await p.evaluate(s=>__city.inspectAt(s.x,s.y),s);return p.evaluate(()=>document.getElementById('info').style.display)};
ok('click pins building info',await pin()==='block');await p.click('#info .infoX');ok('X closes pinned info',await p.evaluate(()=>document.getElementById('info').style.display)==='none');
await pin();await p.keyboard.press('Escape');ok('Esc closes pinned info',await p.evaluate(()=>document.getElementById('info').style.display)==='none');
await pin();await p.keyboard.press('3');ok('changing tool closes pinned info',await p.evaluate(()=>document.getElementById('info').style.display)==='none');
ok('fullscreen button in the top bar',await p.evaluate(()=>!!document.querySelector('#viewGrp #fsBtn')));
await p.keyboard.press('f');await p.waitForTimeout(500);const fs=await p.evaluate(()=>!!document.fullscreenElement);
const sz=await p.evaluate(()=>{const c=document.querySelector('canvas');return [c.clientWidth,c.clientHeight,innerWidth,innerHeight]});
ok('F toggles full screen and the canvas fills the window',fs&&sz[0]===sz[2]&&sz[1]===sz[3],JSON.stringify({fs,sz}));
await p.keyboard.press('f');await p.waitForTimeout(300);ok('F again leaves full screen',!(await p.evaluate(()=>!!document.fullscreenElement)));
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
