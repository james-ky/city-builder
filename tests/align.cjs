// Visual alignment test: every overlay sits on the same isometric tile lattice as the tiles,
// and the low-res fallback overview never draws under detailed chunks. Usage: node tests/align.cjs URL
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1600,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=128&seed=3');await p.waitForFunction(()=>window.__city&&__city.N&&__city.align);
await p.evaluate(()=>{__city.setSpeed(0);__city.centerOn(40,40);__city.setZoom(1)});await p.waitForTimeout(500);
await p.evaluate(()=>{for(let i=36;i<44;i++)for(let j=37;j<43;j++)__city.fireRisk[i][j]=4});await p.selectOption('#covSel','fireRisk');const fails=[];
for(const z of [0.5,1,2,0.1]){await p.evaluate(z=>__city.setZoom(z),z);await p.waitForTimeout(800);const a=await p.evaluate(()=>__city.align());
 if(!a.far&&a.overview)fails.push(`zoom ${z}: fallback overview drawn under detailed tiles`);
 if(a.far&&!a.overview)fails.push(`zoom ${z}: overview missing when zoomed out`);
 if(!a.far&&a.cov&&a.cov.width>0){const {x,y,width,height}=a.cov; // diamond corners lie on the (32,16) lattice offset by half a tile
  const off=v=>Math.abs(((v%16)+16)%16);if(off(x)>0.01||off(y)>0.01||off(width)>0.01||off(height)>0.01)fails.push(`zoom ${z}: coverage overlay off the tile grid ${JSON.stringify(a.cov)}`)}
 else if(!a.far)fails.push(`zoom ${z}: coverage overlay not drawn`);}
await p.screenshot({path:'/tmp/align-test.png'});await b.close();
if(errs.length)fails.push('page errors: '+errs.join('; '));
console.log(fails.length?'FAIL\n'+fails.join('\n'):'PASS alignment');process.exit(fails.length?1:0)})();
