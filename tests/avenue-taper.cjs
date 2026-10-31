// Avenue -> Street / dirt road taper: the last avenue pair uses taper_<kind>_<D>_<P>_<main|side> art, and cars slide from 3 avenue lanes into the street lanes without jumping.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4420/',shot=process.argv.includes('--shot')?process.argv[process.argv.indexOf('--shot')+1]:'';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:2000,height:1300}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Taper');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-12;a<=12&&g;a++)for(let b=-6;b<=6;b++)if(!t[i+a]||t[i+a][j+b]==='water'){g=false;break}if(g)return[i,j]}});
const info=await p.evaluate(([ci,cj])=>{const C=__city,N=C.N();C.setRoadTier(2);C.setRoadWidth(2);C.paint('road',ci-10,cj,ci,cj);C.setRoadWidth(1);C.paint('road',ci+1,cj,ci+10,cj);
 for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.road[i][j])C.rstage[i][j]=0;C.refresh();C.setCarsOnly(true);
 const halves=[];for(let j=cj-2;j<=cj+2;j++)if(C.rw[ci][j]>=2)halves.push([j,C.rpd[ci][j],C.taperAt(ci,j),C.taperAt(ci-1,j)]);return halves},c);
const ctl=await p.evaluate(([ci,hs])=>hs.map(h=>__city.ctrlAt(ci,h[0])),[c[0],info]);ok('no traffic lights / stop signs on the taper (it is a merge)',ctl.every(x=>!x),JSON.stringify(ctl));
ok('last avenue pair picks main + side taper tiles, the one before is plain',info.length===2&&info.some(h=>/_main$/.test(h[2]))&&info.some(h=>/_side$/.test(h[2]))&&info.every(h=>h[3]===''),JSON.stringify(info));
const files=await p.evaluate(async t=>{const out=[];for(const n of t){const r=await fetch('./assets/roads/avenue_asphalt_'+n+'@2x.png');out.push(r.ok)}return out},info.map(h=>h[2]));
ok('taper art exists for both halves',files.every(Boolean),JSON.stringify(files));
// NW-bound car on the street-continuing half drives from the street into the avenue (median on its left): lateral path is continuous
const main=info.find(h=>/_main$/.test(h[2]));const tr=await p.evaluate(([ci,j])=>{const C=__city,N=C.N(),r=[];for(let i=ci-6;i<=ci+8;i++)r.push(i*N+j);C.spawnCar(r,'veh_sedan_a');const x=C.cars()[C.cars().length-1];x.ln=2;x.sp=1;return C.cars().length-1},[c[0],main[0]]);
const pts=[];for(let k=0;k<140;k++){await p.waitForTimeout(40);const q=await p.evaluate(n=>{const x=__city.cars()[n];return x?[x.s.x,x.s.y,x.i]:null},tr);if(!q)break;pts.push(q)}
const a=await p.evaluate(([ci,cj])=>{const C=__city,s0=C.tileToScreen(ci,cj),s1=C.tileToScreen(ci+1,cj),z=C.zoom();const ux=(s1.x-s0.x)/z,uy=(s1.y-s0.y)/z,L=Math.hypot(ux,uy);return [-uy/L,ux/L]},c);
const lat=pts.map(q=>q[0]*a[0]+q[1]*a[1]);let jump=0;for(let k=1;k<lat.length;k++)jump=Math.max(jump,Math.abs(lat[k]-lat[k-1]));
ok('car slides between lane layouts (no sideways jump > 1.5 px per frame)',pts.length>20&&jump<1.5,'max '+jump.toFixed(2)+' n '+pts.length);
if(shot){await p.addStyleTag({content:'body>*:not(canvas){visibility:hidden}'});await p.evaluate(([ci,cj])=>{const C=__city,N=C.N();for(let s=0;s<8;s++)for(const [j,pd] of [[cj-1,0],[cj,0],[cj+1,0]]){} 
  const hs=[];for(let j=cj-2;j<=cj+2;j++)if(C.rw[ci][j]>=2)hs.push([j,C.rpd[ci][j]]);for(const [j,pd] of hs){const dir=pd===1?1:-1;for(let s=0;s<7;s++)for(let ln=0;ln<3;ln++){const r=[];for(let k=-10;k<=10;k++)r.push((ci-3+dir*k)*N+j);C.spawnCar(r.slice(s));C.cars()[C.cars().length-1].ln=ln}}
  // street traffic heading into the avenue
  C.setZoom(5);C.centerOn(ci,cj);__fx.setDay(Math.floor(C.sim().day/24)*24+36)},c);await p.waitForTimeout(2200);await p.evaluate(()=>{for(const x of __city.cars())x.sp=0});await p.waitForTimeout(300);await p.screenshot({path:shot,clip:{x:350,y:200,width:1300,height:850}})}
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
