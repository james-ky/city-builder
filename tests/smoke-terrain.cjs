// Run: npm i -D playwright pngjs && npx playwright install chromium && node tests/smoke-terrain.cjs <url> [screenshot.png]
// Smoke test: found a city through the New City screen at every size and check the map area is drawn (not background).
const {chromium}=require('playwright');const {PNG}=require('pngjs');(async()=>{const url=process.argv[2];let fail=0;
for(const flags of [['--use-gl=swiftshader','--enable-unsafe-swiftshader'],['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-features=WebGPU']]){
 const b=await chromium.launch({args:flags});
 for(const [state,ls] of [['fresh',{}],['all effects off (old settings)',{fx:JSON.stringify({clouds:false,smoke:false,pollution:false,cars:false,daynight:false,nature:false}),grid:'off',zones:'off',music:'off'}],['all effects on',{fx:JSON.stringify({clouds:true,smoke:true,pollution:true,cars:true,daynight:true,nature:true}),ambience:'on'}],['junk settings',{fx:'{not json',volume:'abc'}]])
 for(const size of (state==='fresh'?[128,192,256,384]:[128])){const ctx=await b.newContext({viewport:{width:2560,height:1400},deviceScaleFactor:state==='all effects on'?1.25:1});await ctx.addInitScript(o=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');for(const k in o)localStorage.setItem(k,o[k])}},ls);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto(url);await p.waitForSelector('#ncGo');await p.click(`#ncSize button[data-s="${size}"]`);await p.click('#ncGo');
  await Promise.race([p.waitForFunction(()=>window.__city,null,{timeout:30000}).catch(()=>{}),new Promise(r=>setTimeout(r,30000))]);await p.waitForTimeout(2500);
  const png=PNG.sync.read(await p.screenshot());let land=0,tot=0;const bgs=[[0x1b,0x24,0x30],[0x0d,0x12,0x20]];
  for(let y=150;y<1000;y+=11)for(let x=40;x<2500;x+=11){const k=(y*png.width+x)*4,r=png.data[k],g=png.data[k+1],bb=png.data[k+2];tot++;if(!bgs.some(([R,G,B])=>Math.abs(r-R)+Math.abs(g-G)+Math.abs(bb-B)<24))land++;}
  const pct=Math.round(land/tot*100),ok=pct>60&&!errs.length;if(!ok)fail++;console.log(flags[0],state,size,ok?'PASS':'FAIL',pct+'% map pixels',errs.slice(0,2).join(' | '));if(size===128&&flags[0].includes('angle')&&process.argv[3])await p.screenshot({path:process.argv[3]});await ctx.close();}
 await b.close();}
process.exit(fail?1:0)})();
