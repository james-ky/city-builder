// James's block: dense R block 5 deep, wind turbine placed with the tool, some zones locked to a side with no road. --out <png>
const {chromium}=require('playwright');(async()=>{const url=process.argv[2],out=process.argv[process.argv.indexOf('--out')+1];
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1200,height:760}});await p.addInitScript(()=>localStorage.setItem('zones','off'));p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto(url+'?size=64&seed=5&city=Block');await p.waitForFunction(()=>window.__city&&__city.N);
const c=await p.evaluate(()=>{const C=__city,t=C.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-8;a<=8&&g;a++)for(let b=-8;b<=8;b++)if(!t[i+a]||t[i+a][j+b]==='water'){g=false;break}if(g)return[i,j]}});
const r=await p.evaluate(([ci,cj])=>{const C=__city;C.setSpeed(0);C.sim().funds=1e6;const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.rw[i][j]=0};for(let d=-6;d<=6;d++){R(ci-3,cj+d);R(ci+3,cj+d);R(ci+d,cj-6);R(ci+d,cj+6)}
 for(let i=ci-2;i<=ci+2;i++)for(let j=cj-5;j<=cj+5;j++){C.zone[i][j]='R';C.bld[i][j]=(i+j)%3===0?0:3;C.zden[i][j]=3}
 for(let j=cj-5;j<=cj+5;j++)C.zface[ci+2][j]=1; // front row locked NE (no road there; the road is on its SE side)
 C.zone[ci+2][cj-5]='C';C.bld[ci+2][cj-5]=0;C.pk[ci+2][cj-5]=1;C.zone[ci-2][cj+5]='C';C.bld[ci-2][cj+5]=0;C.pk[ci-2][cj+5]=1;C.pline[ci-3][cj+1]=C.pline[ci-4][cj+1]=true;C.refresh();C.paint('svc:wind',ci-5,cj+1,ci-5,cj+1);C.setTool('select');C.fastForward(1);C.computeAll();C.centerOn(ci+2,cj);C.setZoom(2);const sv=document.getElementById('services');if(sv)sv.style.display='none';__fx.setDay(36);
 const acc=[];for(let i=ci-2;i<=ci+2;i++){let s='';for(let j=cj-5;j<=cj+5;j++)s+=C.hasAccess(i,j)?'.':'X';acc.push(s)}return acc},c);
console.log(r.join('\n'));await p.waitForTimeout(2500);await p.screenshot({path:out});await b.close()})();
