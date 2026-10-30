// Commuters and freight may use any road within 1 tile (back/side roads), cheapest wins; shoppers/errands/school use the front door.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4324/',shots=process.argv.includes('--shots');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1300,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Backlane');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>__city.setSpeed(0));
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-10;a<=10&&g;a++)for(let b=-10;b<=10;b++)if(!t[i+a]||t[i+a][j+b]==='water'){g=false;break}if(g)return[i,j]}});
// main street (row ci) in front of a row of shops (ci+1, facing NW); a rear lane (ci+2) behind them; industry and homes (ci+3) front onto the rear lane; the two roads only meet at the far east end
await p.evaluate(([ci,cj])=>{const C=__city;const R=(i,j)=>{C.road[i][j]=true;C.rtier[i][j]=2;C.rstage[i][j]=0;C.rw[i][j]=0;C.zone[i][j]='';C.bld[i][j]=0};
 for(let j=cj-8;j<=cj+8;j++){R(ci,j);R(ci+2,j)}R(ci+1,cj+8);
 const Z=(i,j,z)=>{C.zone[i][j]=z;C.bld[i][j]=1;C.zden[i][j]=1;C.zface[i][j]=4};for(let j=cj-6;j<=cj+6;j++)Z(ci+1,j,'C');for(let j=cj-7;j<=cj-2;j++)Z(ci+3,j,'I');for(let j=cj;j<=cj+6;j++)Z(ci+3,j,'R');
 C.refresh();C.markTripsDirty();C.fastForward(1);C.centerOn(ci+1,cj);C.setZoom(2.2);__fx.setDay(36)},c);
const r=await p.evaluate(([ci,cj])=>{const T=__city.trips(),N=__city.N(),row=k=>(k/N)|0;const by=kind=>T.flows.filter(f=>f.kind===kind&&__city.zone[row(f.dest)][f.dest%N]==='C');
 const fr=by('freight').map(f=>{const q=__city.pathOf(f);return{start:row(q[0]),end:row(q[q.length-1]),len:q.length}});
 const er=by('errand').map(f=>{const q=__city.pathOf(f);return{start:row(q[0]),end:row(q[q.length-1]),len:q.length}});
 const wk=T.flows.filter(f=>f.kind==='work'&&__city.zone[row(f.dest)][f.dest%N]==='C').map(f=>{const q=__city.pathOf(f);return{end:row(q[q.length-1])}});return{fr,er,wk,ci}},c);
ok('freight trucks deliver to shops via the rear lane behind them (cheaper than the main street)',r.fr.length>0&&r.fr.every(x=>x.end===r.ci+2),JSON.stringify(r.fr.slice(0,3)));
ok('commuters to the shops may use the rear lane too',r.wk.length>0&&r.wk.every(x=>x.end===r.ci+2),JSON.stringify(r.wk.slice(0,3)));
ok('shoppers still go to the front door on the main street',r.er.length>0&&r.er.every(x=>x.end===r.ci),JSON.stringify(r.er.slice(0,3)));
if(shots){await p.evaluate(([ci,cj])=>{const C=__city,T=C.trips(),N=C.N();C.setCarsOnly(true);for(const f of T.flows.filter(f=>f.kind==='freight').slice(0,6)){const q=C.pathOf(f);if(q&&q.length>1)C.spawnCar(q,'veh_delivery_truck_a')}const sv=document.getElementById('services');if(sv)sv.style.display='none'},c);
 const k0=await p.evaluate(()=>__city.carClock());await p.waitForFunction(k0=>__city.carClock()>k0+3,k0);await p.screenshot({path:'screenshots/side-roads.png'})}
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
