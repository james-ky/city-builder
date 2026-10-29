const {chromium}=require('playwright');(async()=>{const url=process.argv[2];
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});
await p.goto(url+'?size=64&seed=5&city=Parkton');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-10;a<=10&&g;a++)for(let b2=-10;b2<=10;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
await p.evaluate(([ci,cj])=>{const C=__city;C.sim().funds=1e6;const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0};
 for(let i=ci-9;i<=ci+9;i++){R(i,cj-5);R(i,cj+5)}for(let j=cj-5;j<=cj+5;j++){R(ci-9,j);R(ci+9,j)}
 for(let i=ci-8;i<=ci+8;i++){C.zone[i][cj-4]='R';C.bld[i][cj-4]=1;C.zden[i][cj-4]=1;C.zone[i][cj+4]='R';C.bld[i][cj+4]=2;C.zden[i][cj+4]=2}C.refresh();
 const P=[['park_city_lake',ci-6,cj],['park_sports_field',ci-2,cj-2],['park_playground',ci-2,cj+1],['park_plaza',ci-1,cj+2],['park_neighborhood',ci+1,cj-2],['park_tennis',ci+1,cj+1],['park_flower_garden',ci+3,cj],['park_pond',ci+5,cj-2],['park_skate',ci+5,cj+1],['park_dog',ci+7,cj-3],['park_basketball',ci+7,cj+3],['park_pocket',ci+7,cj]];
 for(const [t,i,j] of P)C.plop(t,i,j);C.fastForward(2);C.centerOn(ci,cj);C.setZoom(1.6);},c);
await p.waitForTimeout(1500);await p.screenshot({path:'screenshots/parks.png'});await b.close()})();
