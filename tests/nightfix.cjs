// Night-lighting fix (v3-soft3d-j): bld_I_2_c shows lit windows at night. --shots saves screenshots/night-lights.png
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/',shots=process.argv.includes('--shots');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Nightville');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const rev=await p.evaluate(async()=>(await (await fetch('./assets/manifest.json')).json()).artRevision);ok('manifest is v3-soft3d-j',rev==='v3-soft3d-j',rev);
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-8;a<=8&&g;a++)for(let b2=-8;b2<=8;b2++)if(!t[i+a]||t[i+a][j+b2]==='water'){g=false;break}if(g)return [i,j]}});
const info=await p.evaluate(([ci,cj])=>{const C=__city;const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.rw[i][j]=0};const F={NE:1,SE:2,SW:3,NW:4};
 for(let d=-7;d<=7;d++){R(ci+d,cj-1);R(ci+d,cj+2)}const names=[];for(let i=ci-6;i<=ci+6;i++)for(const [j,f] of [[cj,'NE'],[cj+1,'SW']]){C.zone[i][j]='I';C.bld[i][j]=2;C.zden[i][j]=3;C.zface[i][j]=F[f]}
 C.refresh();for(let i=ci-6;i<=ci+6;i++)for(const j of [cj,cj+1])names.push(C.spriteFor(i,j));C.centerOn(ci,cj+0.5);C.setZoom(2.4);__fx.setDay(46);return names},c);
const ic=info.filter(n=>n.startsWith('bld_I_2_c'));ok('test block includes bld_I_2_c buildings',ic.length>0,ic.join(','));
await p.waitForTimeout(2500);
const lit=await p.evaluate(()=>{let n=0,names=new Set();for(const L of [__city.layers.objL])L.children.forEach(ch=>ch.children&&ch.children.forEach(s=>{if(s.__light&&s.visible&&s.alpha>0.5){const lbl=(s.texture&&(s.texture.label||s.texture.source&&s.texture.source.label))||'';if(/bld_I_2_c/.test(lbl)){n++;names.add(lbl.split('/').pop())}}}));return{n,names:[...names]}});
ok('bld_I_2_c night overlays are lit at night',lit.n>0,JSON.stringify(lit));
if(shots)await p.screenshot({path:'screenshots/night-lights.png'});
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
