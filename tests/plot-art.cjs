// Plot Builder art (plot-parts-v1): real part sprites replace placeholders; fences/hedges by neighbour mask with gates; sidewalk masks with
// straight/tee fallbacks; trees at real size; tinted lawn; NE/NW-facing lots get a door marker; night overlays through the light layer.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4431/',shots=process.argv.includes('--shots'),D='/workspace/cb-ui/screenshots/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1600,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(url+'?size=64&seed=5&city=PlotArt');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>{__city.setSpeed(0);localStorage.removeItem('plotLib')});
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const man=await p.evaluate(async()=>{const m=await (await fetch('./assets/manifest_plot_parts.json')).json();const ic=await Promise.all(['cat_plots','part_fence','plot_size'].map(async k=>(await (await fetch(`./assets/ui/icons2/svg/${k}.svg`)).text()).includes('id="halo"')));return {rev:m.artRevision,n:m.assets.filter(a=>!a.nightOf).length,nn:m.assets.filter(a=>a.nightOf).length,ic}});
ok('plot parts synced: 95 parts + 95 night overlays, halo icons',man.rev==='plot-parts-v1'&&man.n===95&&man.nn===95&&man.ic.every(Boolean),JSON.stringify(man));
const pc=await p.evaluate(()=>{const {walkPiece:w,fencePiece:f}=__city.plots.pieces;return {w:[w(5),w(3),w(7),w(15),w(1),w(0),w(2)],f:[f(5),f(6),f(7),f(15),f(4),f(0)]}});
ok('sidewalk pieces: exact masks kept, cross -> tee, ends -> straight',JSON.stringify(pc.w)==='[5,3,7,7,5,10,10]',JSON.stringify(pc.w));
ok('fence pieces: straight/corner kept, tee/cross/end -> straight',JSON.stringify(pc.f)==='[5,6,5,5,5,10]',JSON.stringify(pc.f));
const labels=()=>p.evaluate(()=>{const out=[];const walk=o=>{const l=o.texture?.label||o.texture?.source?.label;if(l&&/part_|veh_/.test(l))out.push({l:l.replace(/^.*\//,'').replace('@2x.png',''),sx:o.scale?.x,tint:o.tint,a:o.alpha,v:o.visible,light:!!o.__light,dm:!!o.__doorMarker});for(const k of o.children||[])walk(k)};walk(__city.layers.objL.parent.parent);return out});
await p.evaluate(()=>{__fx.setDay(12);const ps=__city.plots;ps.open();ps.setSize(3);const A=(x,y,t,f)=>ps.apply(x,y,t,f);
 A(1,1,'house',2);A(1,4,'house',4);A(4,4,'shop',2);A(4,8,'factory',2);
 for(let y=0;y<12;y++)A(0,y,'fence');for(let x=1;x<8;x++)A(x,0,'fence');A(0,6,'fence');// L run + a gate below
 for(let x=3;x<11;x++)A(x,3,'sidewalk');A(7,2,'sidewalk');A(7,4,'sidewalk');// cross at (7,3)
 A(11,6,'driveway');A(11,7,'driveway');for(let y=5;y<9;y++)A(10,y,'parking');
 for(const [x,y] of [[2,8],[2,10],[3,9],[9,10],[10,11],[8,11]])A(x,y,'tree');A(3,9,'tree');ps.cur().name='Art test';});
await p.waitForTimeout(600);const L1=await labels();
const has=r=>L1.filter(x=>r.test(x.l));
ok('builder draws real body sprites for house 2f, flats 4f, shop 2f, workshop 2f',['part_house_2f_SE','part_flats_4f_SE','part_shop_2f_SE','part_workshop_2f_SE'].every(k=>L1.some(x=>x.l===k)),[...new Set(has(/house|flats|shop_|workshop/).map(x=>x.l))].join(','));
ok('fence run uses mask pieces incl. a corner and a gate',has(/part_fence_picket_(3|6|12|9)$/).length>=1&&has(/part_fence_picket_gate_(5|10)/).length===1&&has(/part_fence_picket_(5|10)$/).length>10,[...new Set(has(/fence/).map(x=>x.l))].join(','));
ok('sidewalk: straight, tee (for the cross) and pieces by mask',has(/part_sidewalk_(5|10)$/).length>=5&&has(/part_sidewalk_(7|11|13|14)$/).length>=1,[...new Set(has(/sidewalk/).map(x=>x.l))].join(','));
ok('driveway + parking stall sprites, with parked cars',has(/part_driveway_SE/).length===2&&has(/part_parking_stall_SE/).length===4&&has(/^veh_/).length===4);
const tr=has(/part_tree_|part_shrub/);ok('trees at real size (no 0.32 forest scale) with a 2nd kind on re-click',tr.length===6&&tr.every(x=>x.sx>0.4)&&!L1.some(x=>/forest_/.test(x.l))&&new Set(tr.map(x=>x.l)).size>=2,tr.map(x=>x.l+':'+(+x.sx).toFixed(2)).join(','));
ok('lawn tiled and tinted toward the terrain grass',has(/part_lawn/).length>50&&has(/part_lawn/).every(x=>x.tint!==0xffffff&&x.tint!==16777215));
await p.waitForTimeout(300);if(shots)await p.screenshot({path:D+'plot-art-builder.png'});
const id=await p.evaluate(()=>{const ps=__city.plots,id=ps.save();ps.close();return id});
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-9;a<=9&&g;a++)for(let b=-9;b<=9;b++)if(!t[i+a]||t[i+a][j+b]==='water'){g=false;break}if(g)return[i,j]}});const [ci,cj]=c;
const pl=await p.evaluate(([ci,cj,id])=>{const C=__city,ps=C.plots;C.sim().funds=1e6;C.setRoadTier(2);C.setRoadWidth(1);C.paint('road',ci-6,cj+2,ci+8,cj+2);C.paint('road',ci-6,cj-5,ci+8,cj-5);const N=C.N();for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.road[i][j])C.rstage[i][j]=0;C.refresh();
 const a=ps.place(id,ci-3,cj),d=ps.designs()[0];ps.open(d);ps.setFace(1);const id2=ps.save();ps.close();const b=ps.place(id2,ci+3,cj-3);return {a,b,fa:ps.civ(ci-3,cj)?.face,fb:ps.civ(ci+3,cj-3)?.face}},[ci,cj,id]);
ok('placed one lot facing SW (auto) and one locked NE',pl.a&&pl.b&&pl.fa===3&&pl.fb===1,JSON.stringify(pl));
await p.evaluate(([ci,cj])=>{__fx.setDay(12);__city.centerOn(ci+0.5,cj-0.5);__city.setZoom(3.2)},[ci,cj]);await p.waitForTimeout(1500);const L2=await labels();
ok('city lots draw the rotated art (SW and NE bodies)',L2.some(x=>x.l==='part_shop_2f_SW')&&L2.some(x=>x.l==='part_shop_2f_NE'),[...new Set(L2.filter(x=>/shop/.test(x.l)).map(x=>x.l))].join(','));
ok('NE-facing lot shows a subtle door marker; SW lot does not need one',L2.some(x=>x.dm&&/door_marker_NE/.test(x.l))&&!L2.some(x=>/door_marker_SW/.test(x.l)),L2.filter(x=>x.dm).map(x=>x.l).join(','));
if(shots)await p.screenshot({path:D+'plot-art-day.png'});
await p.evaluate(([ci,cj])=>{__fx.setDay(46);__city.setSpeed(1);__city.centerOn(ci-1.5,cj+1.5);__city.setZoom(5.5)},[ci,cj]);await p.waitForTimeout(3000);await p.evaluate(()=>__city.setSpeed(0));const L3=await labels();const lit=L3.filter(x=>x.light&&x.v&&x.a>0.5&&/part_/.test(x.l));
ok('night overlays lit through the light layer',lit.length>=4&&lit.some(x=>/shop/.test(x.l)),[...new Set(lit.map(x=>x.l))].slice(0,6).join(','));
if(shots)await p.screenshot({path:D+'plot-art-night.png'});
ok('no console errors',errs.length===0,errs.slice(0,3).join(' | '));
console.log(res.join('\n'));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
