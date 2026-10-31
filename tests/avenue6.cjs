// Avenue = 3 lanes each way + median: lane paint drawn on every straight half, and cars in lanes 0/1/2 sit in 3 distinct, evenly spaced lanes inside the widened carriageway.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4420/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1000,height:700}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Av6');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-12;a<=12&&g;a++)for(let b=-6;b<=6;b++)if(!t[i+a]||t[i+a][j+b]==='water'){g=false;break}if(g)return[i,j]}});
const r=await p.evaluate(([ci,cj])=>{const C=__city,N=C.N();C.setRoadTier(2);C.setRoadWidth(2);C.paint('road',ci-10,cj,ci+10,cj);for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.road[i][j])C.rstage[i][j]=0;C.refresh();C.setCarsOnly(true);C.centerOn(ci,cj);C.setZoom(3);
 const hs=[];for(let j=cj-2;j<=cj+2;j++)if(C.rw[ci][j]>=2)hs.push([j,C.rpd[ci][j]]);return {hs,N}},c);
ok('avenue is two halves with partners',r.hs.length===2,JSON.stringify(r.hs));
await p.waitForTimeout(800);
const paint=await p.evaluate(()=>{let n=0;const walk=o=>{if(o.__avLanes)n++;for(const k of o.children||[])walk(k)};Object.values(__city.layers).forEach(walk);return n});
ok('3-lane paint drawn on the avenue straights',paint>=20,'tiles '+paint);
const off=await p.evaluate(([ci,cj,hs])=>{const C=__city,N=C.N(),out=[];for(const [j,pd] of hs){const dir=pd===1?1:-1,route=[];for(let k=-8;k<=8;k++)route.push((ci+dir*k)*N+j);
 const row=[];for(let ln=0;ln<3;ln++){C.spawnCar(route.slice(ln*3));const x=C.cars()[C.cars().length-1];x.ln=ln;row.push(x)}out.push(row.length)}return out},[c[0],c[1],r.hs]);
await p.evaluate(()=>{for(const x of __city.cars())x.sp=0});await p.waitForTimeout(500);
const pos=await p.evaluate(([ci,cj])=>{const C=__city,a=C.tileToScreen(ci,cj),b=C.tileToScreen(ci+1,cj),z=C.zoom();const ux=(b.x-a.x),uy=(b.y-a.y),L=Math.hypot(ux,uy),nx=-uy/L,ny=ux/L;
 return C.cars().map(x=>({ln:x.ln,dir:x.i-x.pi,perp:((x.s.x*z+0)-(0))*nx+(x.s.y*z)*ny,j:x.j}))},c);
const bad=[];for(const dir of [1,-1]){const q=pos.filter(x=>x.dir===dir).sort((a,b)=>a.ln-b.ln);if(q.length!==3){bad.push('dir '+dir+' n '+q.length);continue}const d1=q[1].perp-q[0].perp,d2=q[2].perp-q[1].perp;if(Math.abs(d1)<2||Math.abs(d1-d2)>0.5||Math.sign(d1)!==Math.sign(d2))bad.push(`dir ${dir} spacing ${d1.toFixed(2)},${d2.toFixed(2)}`)}
ok('cars in lanes 0,1,2 sit in 3 evenly spaced lanes each way',bad.length===0,bad.join(' | '));
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
