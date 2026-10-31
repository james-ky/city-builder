// 16-direction vehicles: cars rotate through intermediate headings in turns; only the 16-dir set is used; glows follow the per-direction offsets.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4420/',shots=process.argv.includes('--shots');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:900,height:700}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Turns');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-6;a<=6&&g;a++)for(let b=-6;b<=6;b++)if(!t[i+a]||t[i+a][j+b]==='water'){g=false;break}if(g)return[i,j]}});
const route=await p.evaluate(([ci,cj])=>{const C=__city,N=C.N();const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.rw[i][j]=0;C.zone[i][j]='';C.bld[i][j]=0};const r=[];
 for(let i=ci-5;i<=ci;i++){R(i,cj);r.push(i*N+cj)}for(let j=cj-1;j>=cj-5;j--){R(ci,j);r.push(ci*N+j)} // SE then NE: a left turn on screen
 C.refresh();C.setCarsOnly(true);C.centerOn(ci,cj);C.setZoom(3);__fx.setDay(0);return r},c);
await p.evaluate(r=>__city.spawnCar(r,'veh_sedan_a'),route);
const seen=[],texs=new Set(),glow=[];let frames=0;
for(let k=0;k<160;k++){await p.waitForTimeout(60);const s=await p.evaluate(()=>{const x=__fx.cars[0];if(!x)return null;const m=x.hg&&x.s?{dx:(x.hg.x-x.s.x)*2,dy:(x.hg.y-x.s.y)*2}:null;return{dir:x.dir,tex:String(x.s?.texture?.label||''),m}});if(!s)break;if(seen[seen.length-1]!==s.dir)seen.push(s.dir);texs.add(s.tex.replace(/^.*\//,''));if(s.m)glow.push([s.dir,s.m]);
 if(shots&&k%2===0&&frames<40){await p.screenshot({path:`/tmp/turn/f${String(frames++).padStart(2,'0')}.png`})}}
ok('car passes through intermediate headings while turning (d00 -> d01..d03 -> d04)',seen.includes('d00')&&seen.includes('d04')&&seen.some(d=>['d01','d02','d03'].includes(d)),seen.join(' '));
ok('only 16-direction sprites are used (no 4-facing mix)',[...texs].every(t=>/_d\d\d/.test(t)),[...texs].join(','));
const man=await p.evaluate(async()=>{const m=await (await fetch('./assets/vehicles/manifest_16dir.json')).json();const o={};for(const a of m.assets)if(/^veh_sedan_a_d\d\d$/.test(a.name))o[a.name.slice(-3)]=a.headlightOffsetPx;return o});
const gbad=glow.filter(([d,m])=>{const w=man[d];return !w||Math.abs(w[0]-m.dx)>1||Math.abs(w[1]-m.dy)>1});
ok('headlight glow sits at the per-direction manifest offset',glow.length>0&&gbad.length===0,JSON.stringify(gbad.slice(0,3)));
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
