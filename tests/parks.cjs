// Parks: all types placeable without roads, variants + reroll, land value falloff, pollution, leisure trips, saves.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.stack));
await p.goto(url+'?size=128&seed=3&city=Parkton');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<60;r++)for(let i=64-r;i<=64+r;i++)for(let j=64-r;j<=64+r;j++){let g=true;for(let a=-20;a<=20&&g;a++)for(let b2=-20;b2<=20;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});const [ci,cj]=c;
const btns=await p.evaluate(()=>document.querySelectorAll('#parkGroup button').length);ok('Parks toolbar group lists every park type',btns===16,String(btns));
const pl=await p.evaluate(([ci,cj])=>{const C=__city;C.sim().funds=1e6;const types=[...document.querySelectorAll('#parkGroup button')].map(b=>b.dataset.t.slice(4));let placed=0,i=ci-18,j=cj-18;
 for(const t of types){if(C.plop(t,i,j))placed++;j+=4;if(j>cj+16){j=cj-18;i+=4}}const ps=C.civs.filter(x=>x.type.startsWith('park_'));return{placed,n:types.length,vars:ps.every(x=>!!x.v),noZone:ps.every(x=>!C.zone[x.i][x.j])}},c);
ok('all park types placed without a road',pl.placed===pl.n,JSON.stringify(pl));ok('each park gets an art variant',pl.vars);
const rr=await p.evaluate(()=>{const c=__city.civs.find(x=>x.type==='park_pocket');const v=c.v;const r=__city.rerollPark(c);return {v,nv:c.v,r}});ok('reroll picks a different variant',rr.r&&rr.v!==rr.nv,JSON.stringify(rr));
const eff=await p.evaluate(([ci,cj])=>{const C=__city;const i=ci-14,j=cj+30;const okp=C.plop('park_city_lake',i,j);C.computeAll();
 return{okp,at:C.cov.park[i][j],near:C.cov.park[i][j+4],far:C.cov.park[i][j+9],out:C.cov.park[i][j+12]}},c);
ok('park boost fades with distance',eff.at>eff.near&&eff.near>eff.far&&eff.out===0,JSON.stringify(eff));
const big=await p.evaluate(()=>{const C=__city;const t=C.terrain,N=C.N();return 1});
// pollution: industry with and without a park
const pol=await p.evaluate(([ci,cj])=>{const C=__city;const i=ci+22,j=cj;C.zone[i][j]='I';C.bld[i][j]=3;C.zden[i][j]=3;C.refresh();C.computeAll();const before=C.poll()[i][j+2];const okp=C.plop('park_neighborhood',i,j+3);C.computeAll();return{okp,before,after:C.poll()[i][j+2]}},c);
ok('parks reduce pollution a little',pol.after<pol.before&&pol.after>0,JSON.stringify(pol));
// leisure trips
const lt=await p.evaluate(([ci,cj])=>{const C=__city;const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.zone[i][j]='';C.bld[i][j]=0};for(let j=cj-20;j<=cj+20;j++)R(ci+24,j);
 for(let j=cj-15;j<=cj-5;j++){C.zone[ci+25][j]='R';C.bld[ci+25][j]=2}C.plop('park_sports_complex',ci+26,cj+8);C.plop('park_pond',ci+26,cj+2);C.refresh&&C.refresh();C.markTripsDirty();C.fastForward(1);const T=C.trips();
 const l=T.flows.filter(f=>f.kind==='leisure');console.log(JSON.stringify(l.slice(0,3)),JSON.stringify(C.civs.slice(-3)));const sc=C.civs.find(x=>x.type==='park_sports_complex');return{d:l.slice(0,3).map(f=>{const x=C.civs.find(c=>c.i*C.N()+c.j===f.dest);return x?x.type:f.dest}),sc:sc.i*C.N()+sc.j,n:l.length,toSports:l.some(f=>f.dest===sc.i*C.N()+sc.j),toPond:l.some(f=>{const pd=C.civs.find(x=>x.type==='park_pond');return f.dest===pd.i*C.N()+pd.j})}},c);
ok('sports parks attract leisure trips',lt.n>0&&lt.d.every(t=>['park_sports_complex','park_sports_field','park_tennis','park_skate','park_playground','park_basketball'].includes(t)),JSON.stringify(lt));ok('quiet parks draw no car trips',!lt.toPond);
const sv=await p.evaluate(()=>{const C=__city;const o=JSON.parse(JSON.stringify(C.serialize()));const before=C.civs.filter(x=>x.type.startsWith('park_')).map(x=>x.type+x.v).join();C.applySave(o);return{same:before===C.civs.filter(x=>x.type.startsWith('park_')).map(x=>x.type+x.v).join(),v:o.version}});
ok('saves keep parks and their variants',sv.same&&sv.v>=8,JSON.stringify(sv));
const up=await p.evaluate(()=>{const C=__city;return document.querySelector('#parkGroup button').title});ok('park costs shown',/upkeep \$\d/.test(up),up);
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
