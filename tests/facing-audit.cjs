// Facing audit: every building type (suburban lots 1x1/1x2, zone buildings R/C/I 1-3, construction stages) in all 4 facings,
// each next to a road on its intended side. Asserts the chosen file per facing, checks lots follow a re-zoned facing,
// and writes the contact sheet screenshots/facing-audit.png.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1700,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=128&seed=5&city=Facetown');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const out=await p.evaluate(()=>{const C=__city,N=C.N(),t=C.terrain;
 let ci=0,cj=0;search:for(let i=20;i<N-12;i++)for(let j=20;j<N-12;j++){let g=true;for(let a=-17;a<=9&&g;a++)for(let q=-17;q<=9;q++)if(t[i+a][j+q]==='water'||t[i+a][j+q]==='sand'){g=false;break}if(g){ci=i;cj=j;break search}}
 for(let i=ci-16;i<=ci+8;i++)for(let j=cj-16;j<=cj+8;j++)t[i][j]='grass';
 const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.zone[i][j]=''};
 const F={NE:1,SE:2,SW:3,NW:4},TYPES=['lot1x1','lot1x2','R1','R2','R3','C1','C2','C3','I1','I2','I3','cons','consTall'];
 // block A (along i): NE row at j=cj-3 (road j=cj-4), SW row at j=cj (road j=cj+1); block B (along j): NW col at i=ci-3 (road ci-4), SE col at i=ci (road ci+1)
 const L=TYPES.length;for(let k=-1;k<=L;k++){R(ci-16+k,cj-4);R(ci-16+k,cj+1);R(ci-4,cj-16+k+6);R(ci+1,cj-16+k+6)}
 const want=[];const put=(type,dir,i,j,bi,bj)=>{const z=type[0]==='l'||type.startsWith('cons')?'R':type[0];
  C.zone[i][j]=z;C.zden[i][j]=3;C.zface[i][j]=F[dir];C.bld[i][j]=0;C.consT[i][j]=0;
  if(type==='lot1x1'||type==='lot1x2'){const two=type==='lot1x2',tiles=[[i,j]].concat(two?[[i+bi,j+bj]]:[]);for(const[a,c]of tiles){C.zone[a][c]='R';C.zden[a][c]=1;C.zface[a][c]=F[dir];C.bld[a][c]=1}
   const i0=Math.min(...tiles.map(x=>x[0])),j0=Math.min(...tiles.map(x=>x[1]));C.addLot({i0,j0,wi:two&&bi?2:1,dj:two&&bj?2:1,dir,v:'a'});want.push({type,dir,i,j,re:new RegExp('^r1_lot_1x'+(two?2:1)+'_'+dir+'_a$')});return}
  if(type.startsWith('cons')){C.consT[i][j]=type==='consTall'?3:1;want.push({type,dir,i,j,re:new RegExp('^construction_1x1_'+(type==='consTall'?'tall_':'')+'stage1_'+dir+'$')});return}
  C.bld[i][j]=+type[1];want.push({type,dir,i,j,re:new RegExp('^bld_'+type[0]+'_'+type[1]+'_[a-c]_'+dir+'$')})};
 TYPES.forEach((ty,k)=>{put(ty,'NE',ci-16+k,cj-3,0,1);put(ty,'SW',ci-16+k,cj,0,-1);put(ty,'NW',ci-3,cj-10+k,1,0);put(ty,'SE',ci,cj-10+k,-1,0)});
 C.refresh();const got=want.map(w=>({type:w.type,dir:w.dir,file:C.spriteFor(w.i,w.j),face:C.facingOf(w.i,w.j),ok:w.re.test(C.spriteFor(w.i,w.j))}));
 C.centerOn(ci-6,cj-6);C.setZoom(1.25);return{got,ci,cj}});
for(const d of ['NE','SE','SW','NW'])ok(`${d}: every type uses its ${d} file`,out.got.filter(g=>g.dir===d).every(g=>g.ok&&g.face===d),JSON.stringify(out.got.filter(g=>g.dir===d&&!(g.ok&&g.face===d))));
console.log('facing -> file:');for(const g of out.got)console.log(`  ${g.dir} ${g.type.padEnd(9)} ${g.file}`);
await p.evaluate(()=>{__city.setTool('select');__fx.setDay(Math.floor(__city.sim().day/24)*24+36)});
// contact sheet: one close-up per facing (types left->right: lot 1x1, lot 1x2, R1-3, C1-3, I1-3, construction, tall construction), stitched in the browser
const {ci,cj}=out,shots={};const rows={NE:[ci-10,cj-3],SW:[ci-10,cj],NW:[ci-3,cj-4],SE:[ci,cj-4]};
for(const [d,[i,j]] of Object.entries(rows)){await p.evaluate(([i,j])=>{__city.centerOn(i,j);__city.setZoom(1.9)},[i,j]);await p.waitForTimeout(900);shots[d]=(await p.screenshot({clip:{x:250,y:180,width:1200,height:620}})).toString('base64')}
const sheet=await p.evaluate(async(shots)=>{const cv=document.createElement('canvas');cv.width=2400;cv.height=1290;const x=cv.getContext('2d');x.fillStyle='#222';x.fillRect(0,0,2400,1290);let k=0;
 const lab={NE:'NE (road up-right)',SE:'SE (road down-right)',SW:'SW (road down-left)',NW:'NW (road up-left)'};
 for(const d of ['NE','SE','SW','NW']){const im=new Image();im.src='data:image/png;base64,'+shots[d];await im.decode();const X=(k%2)*1200,Y=Math.floor(k/2)*645;x.drawImage(im,X,Y+25);x.fillStyle='#fff';x.font='bold 22px sans-serif';x.fillText('Facing '+lab[d]+': lot1x1, lot1x2, R1-3, C1-3, I1-3, construction, tall construction',X+10,Y+20);k++}
 return cv.toDataURL('image/png').split(',')[1]},shots);require('fs').writeFileSync('screenshots/facing-audit.png',Buffer.from(sheet,'base64'));
// regression: a house lot built facing SE keeps facing SE after James re-zones it to face SW (road on both sides)
const re=await p.evaluate(()=>{const C=__city;let ci=0,cj=0;const t=C.terrain;search:for(let i=10;i<C.N()-10;i++)for(let j=10;j<C.N()-10;j++){let g=true;for(let a=-1;a<=1&&g;a++)for(let q=-1;q<=1;q++)if(t[i+a][j+q]==='water'||C.road[i+a][j+q]||C.zone[i+a][j+q]){g=false;break}if(g){ci=i;cj=j;break search}}
 const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0};R(ci+1,cj);R(ci,cj+1);C.zone[ci][cj]='R';C.zden[ci][cj]=1;C.zface[ci][cj]=0;C.bld[ci][cj]=1;
 C.addLot({i0:ci,j0:cj,wi:1,dj:1,dir:'SE',v:'b'});C.refresh();const before=C.spriteFor(ci,cj);
 C.setZoneDensity(1);C.setZoneFacing(3);C.paint('R',ci,cj,ci,cj);const after=C.spriteFor(ci,cj);
 // a deep lot re-zoned to face the other axis splits into 1x1 lots that face the new road
 return{before,after}});
// Auto corner: a row of houses fronting a SW street, with a side street on the SE end, faces SW (old tie-break always picked SE)
const corner=await p.evaluate(()=>{const C=__city,ci=20,cj=70;for(let i=ci-8;i<=ci+2;i++)for(let j=cj-3;j<=cj+2;j++){C.terrain[i][j]='grass';C.road[i][j]=false;C.zone[i][j]=''}
 const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0};for(let i=ci-6;i<=ci+1;i++)R(i,cj+1);for(let j=cj-2;j<=cj+1;j++)R(ci+1,j);
 for(let i=ci-5;i<=ci;i++)for(let j=cj-1;j<=cj;j++){C.zone[i][j]='R';C.zden[i][j]=1;C.zface[i][j]=0;C.bld[i][j]=1}C.refresh();return C.facingOf(ci,cj)});
ok('Auto corner house faces the street its row lines (SW)',corner==='SW',corner);
// James's repro: a Medium house locked SW, re-zoned to Light with the zone tool on Auto, rebuilds still facing SW
const rz=await p.evaluate(()=>{const C=__city,ci=30,cj=30;for(let i=ci-2;i<=ci+2;i++)for(let j=cj-2;j<=cj+2;j++){C.terrain[i][j]='grass';C.road[i][j]=false;C.zone[i][j]=''}
 const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0};R(ci,cj+1);R(ci+1,cj);C.zone[ci][cj]='R';C.zden[ci][cj]=2;C.zface[ci][cj]=3;C.bld[ci][cj]=2;C.refresh();const before=C.spriteFor(ci,cj);
 C.setConfirm(()=>true);C.setZoneDensity(1);C.setZoneFacing(0);C.paint('R',ci,cj,ci,cj);const mid=C.spriteFor(ci,cj);C.fastForward(400);return{before,mid,after:C.spriteFor(ci,cj),face:C.facingOf(ci,cj),zface:C.zface[ci][cj]}});
ok('Medium SW house re-zoned to Light (tool on Auto) stays SW',/_SW$/.test(rz.before)&&/_SW$/.test(rz.mid)&&(!rz.after||/_SW(_[a-c])?$/.test(rz.after))&&rz.zface===3&&rz.face==='SW',JSON.stringify(rz));
ok('re-zoning a built SE house lot to SW turns the house SW',re.before==='r1_lot_1x1_SE_b'&&/_SW(_[a-c])?$/.test(re.after),JSON.stringify(re));
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
