// Run: npm i -D playwright pngjs && npx playwright install chromium && node tests/smoke-terrain.cjs <url> [screenshot.png]
// Smoke test: found a city through the New City screen at every size and check the map area is drawn (not background).
const {chromium}=require('playwright');const {PNG}=require('pngjs');(async()=>{const url=process.argv[2];let fail=0;
for(const flags of [['--use-gl=swiftshader','--enable-unsafe-swiftshader'],['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-features=WebGPU']]){
 const b=await chromium.launch({args:flags});
 for(const size of [128,192,256,384]){const p=await b.newPage({viewport:{width:1280,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto(url);await p.waitForSelector('#ncGo');await p.click(`#ncSize button[data-s="${size}"]`);await p.click('#ncGo');
  await p.waitForFunction(()=>window.__city,null,{timeout:60000});await p.waitForTimeout(2500);
  const png=PNG.sync.read(await p.screenshot());let land=0,tot=0;const bgs=[[0x1b,0x24,0x30],[0x0d,0x12,0x20]];
  for(let y=130;y<500;y+=7)for(let x=40;x<1240;x+=7){const k=(y*png.width+x)*4,r=png.data[k],g=png.data[k+1],bb=png.data[k+2];tot++;if(!bgs.some(([R,G,B])=>Math.abs(r-R)+Math.abs(g-G)+Math.abs(bb-B)<24))land++;}
  const pct=Math.round(land/tot*100),ok=pct>60&&!errs.length;if(!ok)fail++;console.log(flags[0],size,ok?'PASS':'FAIL',pct+'% map pixels',errs.slice(0,2).join(' | '));if(size===128&&flags[0].includes('angle')&&process.argv[3])await p.screenshot({path:process.argv[3]});await p.close();}
 await b.close();}
process.exit(fail?1:0)})();
