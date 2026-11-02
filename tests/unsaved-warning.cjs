// Unsaved-progress warning: after a game day of play since the last save, closing/reloading the tab asks first
// (browser "Leave site?" prompt); right after Ctrl+S, export or a fresh city it doesn't. Usage: node tests/unsaved-warning.cjs URL
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
await p.goto(url+'?size=64&seed=7&city=UnsavedTest');await p.waitForFunction(()=>window.__city&&__city.N,null,{timeout:120000});await p.evaluate(()=>__city.setSpeed(0));
ok('fresh city: no warning',await p.evaluate(()=>!__city.unsaved()));
await p.evaluate(()=>{const C=__city;C.paint('road',32,26,32,38);C.paint('R',29,27,31,31);C.setTool('select');C.fastForward(3)});
ok('after building and a few days: warning on',await p.evaluate(()=>__city.unsaved()));
await p.mouse.click(700,300);await p.keyboard.press('Control+s');await p.waitForTimeout(2500);
ok('after Ctrl+S: no warning',await p.evaluate(()=>!__city.unsaved()));
await p.evaluate(()=>__city.fastForward(3));ok('more play after saving: warning back on',await p.evaluate(()=>__city.unsaved()));
let dlg=null;p.on('dialog',async d=>{dlg=d.type();await d.accept();});
await p.mouse.click(700,300);await p.reload({timeout:60000}).catch(()=>{});await p.waitForTimeout(1500);
ok('reload with unsaved play shows the leave-site prompt',dlg==='beforeunload',String(dlg));
ok('no page errors',!errs.length,errs.join('; '));console.log(res.join('\n'));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
