// Density-capped zones, building facing, road-access rule, trip entrances, saves.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Zoneville');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain,N=__city.N();for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-8;a<=8&&g;a++)for(let b2=-8;b2<=8;b2++)if(!t[i+a]||t[i+a][j+b2]!=='grass'&&t[i+a][j+b2]!=='forest'&&t[i+a][j+b2]!=='sand'){g=false;break}if(g)return [i,j]}});const [ci,cj]=c;
await p.evaluate(([ci,cj])=>{const C=__city;C.sim().funds=1e6;C.setConfirm(()=>true);for(let i=ci-8;i<=ci+8;i++){C.road[i][cj]=true;C.rtier[i][cj]=2;C.rstage[i][cj]=0;C.zone[i][cj]='';C.bld[i][cj]=0}C.markTripsDirty();C.refresh();},c);
// cap: light R strip at cj+1..cj+2 must never pass level 1
await p.evaluate(([ci,cj])=>{const C=__city;C.setZoneDensity(1);C.setZoneFacing(0);C.paint('R',ci-6,cj+1,ci-1,cj+2);C.setZoneDensity(3);C.paint('C',ci+1,cj-1,ci+6,cj-1);C.sim().dR=1;},c);
await p.evaluate(()=>{const C=__city;for(let k=0;k<400;k++){C.sim().dR=1;C.sim().dC=1;C.fastForward(1)}});
const g=await p.evaluate(([ci,cj])=>{const C=__city;let maxR=0,builtR=0;for(let i=ci-6;i<=ci-1;i++)for(let j=cj+1;j<=cj+2;j++){maxR=Math.max(maxR,C.bld[i][j],C.consT[i][j]);if(C.bld[i][j])builtR++}let maxC=0;for(let i=ci+1;i<=ci+6;i++)maxC=Math.max(maxC,C.bld[i][cj-1]);return{maxR,builtR,maxC}},c);
ok('light residential never grows past single-family',g.maxR<=1&&g.builtR>0,JSON.stringify(g));
// lots merge the back tile into a 1x2 facing the road; no landlocked squares behind
const lm=await p.evaluate(([ci,cj])=>{const C=__city;let bad=0,lots=0;for(let i=ci-6;i<=ci-1;i++){const back=C.bld[i][cj+2],l=C.lotAt(i,cj+2);if(back&&!l)bad++;if(l)lots++;}return{bad,lots}},c);
ok('back tiles only build as part of a lot facing the road',lm.bad===0,JSON.stringify(lm));
// downgrade: force dense C buildings, rezone to light
await p.evaluate(([ci,cj])=>{const C=__city;for(let i=ci+1;i<=ci+6;i++){C.bld[i][cj-1]=3;C.consT[i][cj-1]=0}C.setZoneDensity(1);C.paint('C',ci+1,cj-1,ci+6,cj-1)},c);
const dg=await p.evaluate(([ci,cj])=>{const C=__city;let over=0,re=0;for(let i=ci+1;i<=ci+6;i++){if(C.bld[i][cj-1]>1)over++;if(C.consT[i][cj-1]===1)re++}return{over,re,den:C.zden[ci+1][cj-1]}},c);
ok('rezoning lower demolishes over-cap buildings and rebuilds them smaller',dg.over===0&&dg.re===6&&dg.den===1,JSON.stringify(dg));
const cancel=await p.evaluate(([ci,cj])=>{const C=__city;C.bld[ci+1][cj-1]=3;C.consT[ci+1][cj-1]=0;C.setConfirm(()=>false);C.paint('C',ci+1,cj-1,ci+1,cj-1);C.setConfirm(()=>true);return C.bld[ci+1][cj-1]},c);
ok('declining the confirm keeps the building',cancel===3);
// facing
const f=await p.evaluate(([ci,cj])=>{const C=__city;C.setZoneDensity(2);C.setZoneFacing(0);C.paint('I',ci+7,cj+1,ci+7,cj+1);const auto=C.facingOf(ci+7,cj+1);
 C.setZoneFacing(2);C.paint('I',ci+7,cj+3,ci+7,cj+3);const lockedNoRoad=C.hasAccess(ci+7,cj+3);
 for(let k=0;k<200;k++){C.sim().dI=1;C.fastForward(1)}return{auto,lockedNoRoad,grewLocked:C.bld[ci+7][cj+3]+C.consT[ci+7][cj+3],ent:C.entranceOf(ci+7,cj+1),N:C.N()}},c);
ok('auto facing picks the adjacent road',f.auto==='NE',f.auto);ok('locked facing with no road has no access',f.lockedNoRoad===false);ok('tile with no road on its front never grows',f.grewLocked===0);
ok('trip entrance is the road tile on the front side',f.ent===(ci+7)*f.N+cj,String(f.ent));
const tr=await p.evaluate(([ci,cj])=>{const C=__city;C.markTripsDirty();C.fastForward(1);const T=C.trips(),N=C.N();return T.access[(ci+7)*N+cj+1]===(ci+7)*N+cj},c);
ok('trips use the front-door road tile',tr);
// landlocked old building is flagged and abandoned over time, not instantly
const ll=await p.evaluate(([ci,cj])=>{const C=__city;const i=ci+7,j=cj+5;C.zone[i][j]='R';C.bld[i][j]=2;C.zden[i][j]=2;C.zface[i][j]=0;C.refresh();const flagged=!C.hasAccess(i,j);C.fastForward(1);const after1=C.bld[i][j];for(let k=0;k<1500;k++)C.fastForward(1);return{flagged,after1,end:C.bld[i][j]}},c);
ok('landlocked building flagged',ll.flagged);ok('landlocked building abandoned over time, not instantly',ll.after1>=1&&ll.end===0,JSON.stringify(ll));
// hover note
const hov=await p.evaluate(([ci,cj])=>{const C=__city;C.setTool('select');const s=C.tileToScreen(ci+7,cj+5);return s},c);await p.mouse.move(hov.x,hov.y);await p.waitForTimeout(200);
const hud=await p.evaluate(()=>document.body.innerText);ok('hover shows zone cap and no road access',/no road access/.test(hud)&&/cap:/.test(hud));
// saves round-trip and legacy migration
const sv=await p.evaluate(([ci,cj])=>{const C=__city;const i=ci+7,j=cj+3;const o=JSON.parse(JSON.stringify(C.serialize()));C.zden[i][j]=0;C.zface[i][j]=0;C.applySave(o);const rt={den:C.zden[i][j],face:C.zface[i][j],v:o.version};
 const a=[ci+8,cj+1],b2=[ci+8,cj+2];C.zone[a[0]][a[1]]='C';C.bld[a[0]][a[1]]=3;C.zone[b2[0]][b2[1]]='I';C.bld[b2[0]][b2[1]]=0;C.consT[b2[0]][b2[1]]=0;C.zface[a[0]][a[1]]=3;const old=JSON.parse(JSON.stringify(C.serialize()));delete old.grids.zden;delete old.grids.zface;old.version=6;C.applySave(old);
 return{...rt,legBuilt:C.zden[a[0]][a[1]],legEmpty:C.zden[b2[0]][b2[1]],legFace:C.zface[a[0]][a[1]]}},c);
ok('save round-trips density and facing (v7)',sv.den===2&&sv.face===2&&sv.v>=7,JSON.stringify(sv));ok('old saves: density from current building, empty = Medium, Auto facing',sv.legBuilt===3&&sv.legEmpty===2&&sv.legFace===0);
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
