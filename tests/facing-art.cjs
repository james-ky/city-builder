// 4-way facing art: each building and construction stage uses its <variant>_<facing> sprite. Also takes screenshots with --shots.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/',shots=process.argv.includes('--shots');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Facetown');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-8;a<=8&&g;a++)for(let b2=-8;b2<=8;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
const out=await p.evaluate(([ci,cj])=>{const C=__city;const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0};
 for(let i=ci-6;i<=ci+6;i++){R(i,cj-1);R(i,cj+2)}for(let j=cj-1;j<=cj+2;j++){R(ci-6,j);R(ci+6,j)}
 const F={NE:1,SE:2,SW:3,NW:4},Z=['R','C','I'],tiles=[];const put=(i,j,f,k)=>{C.zone[i][j]=Z[k%3];C.bld[i][j]=1+(k%3);C.zden[i][j]=3;C.zface[i][j]=F[f];tiles.push([i,j,f])};
 let k=0;for(let i=ci-4;i<=ci+4;i++){put(i,cj,'NE',k++);put(i,cj+1,'SW',k++)}put(ci-5,cj,'NW',k++);put(ci-5,cj+1,'NW',k++);put(ci+5,cj,'SE',k++);put(ci+5,cj+1,'SE',k++);
 C.refresh();const got=tiles.map(([i,j,f])=>({f,s:C.spriteFor(i,j)}));
 C.consT[ci+5][cj]=2;C.bld[ci+5][cj]=0;const cons=C.spriteFor(ci+5,cj);C.consT[ci+5][cj]=0;C.bld[ci+5][cj]=1;
 C.zface[ci-5][cj]=0;const auto=C.spriteFor(ci-5,cj);C.zface[ci-5][cj]=4;C.refresh();
 C.centerOn(ci,cj+0.5);C.setZoom(1.8);return{got,cons,auto}},c);
ok('every building uses its facing sprite',out.got.every(g=>g.s.endsWith('_'+g.f)),JSON.stringify(out.got.filter(g=>!g.s.endsWith('_'+g.f))));
ok('variants keep their letter',out.got.every(g=>/^bld_[RCI]_[123]_[a-c]_(NE|SE|SW|NW)$/.test(g.s)));
ok('construction stages use their facing',/^construction_1x1_stage[123]_SE$/.test(out.cons),out.cons);
ok('auto facing picks a road-side sprite',/_(NW|NE|SW)$/.test(out.auto),out.auto);
if(shots){await p.evaluate(()=>{__city.setTool('select');__fx.setDay(Math.floor(__city.sim().day/24)*24+36)});await p.waitForTimeout(1500);await p.screenshot({path:'screenshots/facing-4way.png'});
 await p.evaluate(()=>__fx.setDay(Math.floor(__city.sim().day/24)*24+46));await p.waitForTimeout(2000);await p.screenshot({path:'screenshots/facing-4way-night.png'});}
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
