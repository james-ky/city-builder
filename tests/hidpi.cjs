// HiDPI: renderer follows devicePixelRatio (max 2) with autoDensity; Graphics quality Auto/1x/2x saved in localStorage. --shots <name>: close-up at max zoom
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4323/',shots=process.argv.includes('--shots');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const ctx=await b.newContext({viewport:{width:900,height:600},deviceScaleFactor:2});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
await p.goto(url+'?size=64&seed=5&city=Hi');await p.waitForFunction(()=>window.__city&&__city.N);
let g=await p.evaluate(()=>__city.gfx());ok('Auto renders at the screen pixel ratio (2x canvas, same CSS size)',g.res===2&&g.cw===1800&&g.css===900,JSON.stringify(g));
await p.evaluate(v=>{const s=document.getElementById('gfxQ');s.value=v;s.dispatchEvent(new Event('change'))},'1');g=await p.evaluate(()=>__city.gfx());ok('1x setting drops to 1x immediately',g.res===1&&g.cw===900,JSON.stringify(g));
await p.reload();await p.waitForFunction(()=>window.__city&&__city.N);g=await p.evaluate(()=>({...__city.gfx(),q:localStorage.getItem('gfxQuality'),sel:document.getElementById('gfxQ').value}));ok('setting is saved and restored on reload',g.res===1&&g.q==='1'&&g.sel==='1',JSON.stringify(g));
await p.evaluate(v=>{const s=document.getElementById('gfxQ');s.value=v;s.dispatchEvent(new Event('change'))},'auto');g=await p.evaluate(()=>__city.gfx());ok('back to Auto',g.res===2);
const z=await p.evaluate(()=>{__city.setZoom(99);return __city.zoom()});ok('max zoom stays 4',z===4);
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
