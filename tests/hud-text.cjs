// Status icons in the hover HUD and the debt toast render as images, not as raw "<img ...>" text. Usage: node tests/hud-text.cjs URL
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Hud');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-4;a<=4&&g;a++)for(let b=-4;b<=4;b++)if(!t[i+a]||t[i+a][j+b]!=='grass'){g=false;break}if(g)return[i,j]}});
const [ci,cj]=c;const hud=()=>p.evaluate(()=>{const e=document.getElementById('hud');return{text:e.innerText,imgs:[...e.querySelectorAll('img')].map(x=>x.getAttribute('src'))}});
// 1. hovering a zoned tile that has no road: icon + words, no markup as text
await p.evaluate(([i,j])=>{const C=__city;C.zone[i][j]='R';C.refresh();C.paint('road',i-3,j-3,i-3,j+3);C.setTool('select');C.setZoom(1.5);C.centerOn(i,j)},c);await p.waitForTimeout(300);
const s=await p.evaluate(([i,j])=>__city.tileToScreen(i,j),c);await p.mouse.move(s.x,s.y);await p.waitForTimeout(300);let h=await hud();
ok('hover: no-road-access shows an icon, not markup',/no road access/.test(h.text)&&!/<img|svg"|class=/.test(h.text)&&h.imgs.some(x=>/status_no_road/.test(x)),JSON.stringify(h));
// 2. dragging a zone with no road on its front: same
await p.evaluate(()=>__city.setTool('R'));const a=await p.evaluate(([i,j])=>__city.tileToScreen(i-2,j-2),c),e=await p.evaluate(([i,j])=>__city.tileToScreen(i+2,j+2),c);
await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(e.x,e.y,{steps:5});await p.waitForTimeout(200);h=await hud();await p.mouse.up();
ok('zone drag: no-road warning shows an icon, not markup',/no road access/.test(h.text)&&!/<img|svg"|class=/.test(h.text)&&h.imgs.some(x=>/status_no_road/.test(x)),JSON.stringify(h));
// 2b. dragging a road shows its cost while dragging (the hover text used to overwrite it every frame)
await p.evaluate(()=>__city.setTool('road'));const r0=await p.evaluate(([i,j])=>__city.tileToScreen(i+3,j-3),c),r1=await p.evaluate(([i,j])=>__city.tileToScreen(i+3,j+3),c);
await p.mouse.move(r0.x,r0.y);await p.mouse.down();await p.mouse.move(r1.x,r1.y,{steps:5});await p.waitForTimeout(300);h=await hud();await p.mouse.up();ok('road drag: cost stays visible while dragging',/^Cost: \$[1-9]/.test(h.text),h.text);
// 3. debt toast
await p.evaluate(()=>{__city.setTool('select');__city.sim().funds=-5000;__city.fastForward(35)});const t=await p.evaluate(()=>{const e=document.getElementById('toast');return{text:e.innerText,imgs:[...e.querySelectorAll('img')].map(x=>x.getAttribute('src'))}});
ok('debt toast shows an icon, not markup',/in debt/.test(t.text)&&!/<img|svg"|class=/.test(t.text)&&t.imgs.some(x=>/status_debt/.test(x)),JSON.stringify(t));
// 4. player text in toasts stays plain text (city names are not HTML)
await p.evaluate(()=>{__city.city().name='<b>x</b>'});await p.mouse.click(700,300);await p.keyboard.press('Control+s');await p.waitForTimeout(2500);
const t2=await p.evaluate(()=>{const e=document.getElementById('toast');return{text:e.innerText,b:e.querySelectorAll('b').length}});ok('city name in a toast is plain text',t2.b===0&&t2.text.includes('<b>x</b>'),JSON.stringify(t2));
ok('no page errors',!errs.length,errs.join('; '));console.log(res.join('\n'));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
