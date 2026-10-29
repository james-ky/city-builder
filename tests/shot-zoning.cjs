const {chromium}=require('playwright');(async()=>{const url=process.argv[2];
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});
await p.goto(url+'?size=64&seed=5&city=Zoneville');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-9;a<=9&&g;a++)for(let b2=-9;b2<=9;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
await p.evaluate(([ci,cj])=>{const C=__city;C.sim().funds=1e6;C.setConfirm(()=>true);const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0};
 for(let i=ci-8;i<=ci+8;i++){R(i,cj);R(i,cj+5)}for(let j=cj;j<=cj+5;j++){R(ci-8,j);R(ci+8,j)}C.refresh();
 const Z=(t,d,i0,j0,i1,j1)=>{C.setZoneDensity(d);C.paint(t,i0,j0,i1,j1)};
 Z('R',1,ci-7,cj+1,ci-3,cj+2);Z('R',2,ci-2,cj+1,ci+2,cj+2);Z('R',3,ci+3,cj+1,ci+7,cj+2);
 Z('C',1,ci-7,cj+3,ci-3,cj+4);Z('C',2,ci-2,cj+3,ci+2,cj+4);Z('C',3,ci+3,cj+3,ci+7,cj+4);
 Z('I',1,ci-7,cj-2,ci-3,cj-1);Z('I',2,ci-2,cj-2,ci+2,cj-1);Z('I',3,ci+3,cj-2,ci+7,cj-1);
 for(let k=0;k<120;k++){C.sim().dR=1;C.sim().dC=1;C.sim().dI=1;C.fastForward(1)}C.centerOn(ci,cj+2);C.setZoom(1.3);C.setTool('R');},c);
await p.waitForTimeout(1500);await p.screenshot({path:'screenshots/density-zones.png'});
// facing: drag preview with locked SW facing over tiles with and without a road
await p.evaluate(([ci,cj])=>{__city.setZoneFacing(0)},c);
await p.evaluate(([ci,cj])=>{__city.centerOn(ci-5,cj-3);__city.setZoom(2.2)},c);await p.waitForTimeout(500);
const a=await p.evaluate(([ci,cj])=>__city.tileToScreen(ci-7,cj-2),c),bb=await p.evaluate(([ci,cj])=>__city.tileToScreen(ci-4,cj-1),c);
await p.keyboard.press('r');await p.keyboard.press('r');await p.keyboard.press('r');await p.keyboard.press('r'); // NW
await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(bb.x,bb.y,{steps:5});await p.waitForTimeout(800);
await p.screenshot({path:'screenshots/facing.png'});await p.mouse.up();await b.close()})();
