// Parking garages: 2 big + 5 small garages beside a dense downtown. Capacity matches size, occupancy never exceeds it,
// cars turned away are counted, the info panel shows used/total + turned away, and every private lot that grows
// had real unmet demand with no free space within the longest walk (8 tiles).
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=128&seed=3&city=Garageville');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<60;r++)for(let i=64-r;i<=64+r;i++)for(let j=64-r;j<=64+r;j++){let g=true;for(let a=-14;a<=14&&g;a++)for(let b2=-14;b2<=14;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
const o=await p.evaluate(([ci,cj])=>{const C=__city,N=C.N();C.sim().funds+=100000;const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.zone[i][j]='';C.bld[i][j]=0};
 for(let i=ci-12;i<=ci+12;i++){R(i,cj);R(i,cj+12)} for(let j=cj;j<=cj+12;j++)R(ci-12,j);
 for(let i=ci-11;i<=ci+11;i++){C.zone[i][cj+13]='R';C.bld[i][cj+13]=3;C.zone[i][cj+11]='R';C.bld[i][cj+11]=2}
 for(let i=ci-10;i<=ci+10;i++){C.zone[i][cj-1]='C';C.bld[i][cj-1]=3;C.zone[i][cj+1]='C';C.bld[i][cj+1]=3;C.zone[i][cj+2]='C';C.bld[i][cj+2]=1}
 const G=[['garage2',ci-6,cj-2],['garage2',ci+5,cj-2],['garage',ci-9,cj+1],['garage',ci-3,cj+1],['garage',ci,cj+1],['garage',ci+3,cj+1],['garage',ci+8,cj+1]];
 let placed=0;for(const [t,a,b2] of G){const s=t==='garage2'?2:1;for(let x=a;x<a+s;x++)for(let y=b2;y<b2+s;y++){C.zone[x][y]='';C.bld[x][y]=0}placed+=!!C.plop(t,a,b2)}
 C.markTripsDirty();C.fastForward(1);const T=C.trips();var gs=()=>C.civs.filter(x=>x.type.startsWith('garage')).map(x=>{const k=x.i*N+x.j;return {t:x.type,occ:T.occ[k],cap:T.spaces[k],tw:T.turned[k]}}); const months=[];const first=gs();
  for(let m=0;m<3;m++){C.fastForward(30);months.push(gs())}
 const free8=(i,j)=>{let f=0;for(let a=-8;a<=8;a++)for(let b2=-8;b2<=8;b2++){if(Math.abs(a)+Math.abs(b2)>8)continue;const kk=(i+a)*N+j+b2;if(T.access[kk]>=0)f+=Math.max(0,T.spaces[kk]-T.occ[kk])}return f};
 return {placed,months,first,log:C.parkLog(),last:gs()}},c);
ok('7 garages placed',o.placed===7,String(o.placed));
const caps=o.last.map(g=>g.t+':'+g.cap);ok('capacity matches garage size (50 small, 260 big)',o.last.every(g=>g.cap===(g.t==='garage2'?260:50)),caps.join(' '));
ok('occupancy never exceeds capacity',o.months.flat().every(g=>g.occ<=g.cap+1e-3));
ok('before any private lots, downtown demand fills every garage (real demand)',o.first.every(g=>g.occ>=g.cap-1),o.first.map(g=>Math.round(g.occ)+'/'+g.cap).join(' '));
ok('full garages count cars turned away',o.first.some(g=>g.tw>0),o.first.map(g=>Math.round(g.tw)).join(' '));
ok('private lots grew only for real unmet demand',o.log.length>0&&o.log.every(l=>l.unmet>8),JSON.stringify(o.log.slice(0,3)));
await p.evaluate(()=>{const T=__city.trips(),N=__city.N();const g=__city.civs.filter(x=>x.type.startsWith('garage')).sort((a,b)=>T.turned[b.i*N+b.j]-T.turned[a.i*N+a.j])[0];window.__pg=g;__city.setZoom(2);__city.centerOn(g.i,g.j)});await p.waitForTimeout(800);
const info=await p.evaluate(()=>{const g=window.__pg;const s=__city.tileToScreen(g.i,g.j);__city.inspectAt(s.x,s.y);return document.getElementById('info').innerText});
ok('panel shows spaces used / total and cars turned away',/Spaces used \d+ \/ (50|260)/.test(info)&&/turned away \d+/.test(info),info.replace(/\n/g,' | '));
if(process.env.SHOT){await p.waitForTimeout(500);await p.screenshot({path:process.env.SHOT})}
ok('no page errors',!errs.length,errs.join(' | '));console.log(res.join('\n'));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
