// XL (384) dense city stress test for agent trips. Prints timings. Usage: node tests/stress-trips.cjs URL
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1600,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=384&seed=5&city=Megaville');await p.waitForFunction(()=>window.__city&&__city.N,null,{timeout:120000});await p.evaluate(()=>__city.setSpeed(0));
const r=await p.evaluate(()=>{__city.genDense(9);const T=__city.trips();const t0=performance.now();T.assign(1);const assign=performance.now()-t0;
 T.stats.routes=0;T.stats.routeMs=0;const t1=performance.now();for(let k=0;k<30;k++)T.sampleVolume(25);const vol=performance.now()-t1;
 const t2=performance.now();const d=T.departures(7,80,Math.random);const dep=performance.now()-t2;
 const t3=performance.now();__city.fastForward(30);const ff=(performance.now()-t3)/30;
 return {residents:Math.round(T.stats.residents),workers:Math.round(T.stats.workers),employed:Math.round(T.stats.employed),flows:T.flows.length,assignMs:Math.round(assign),routesPerMs:+(T.stats.routes/Math.max(1,T.stats.routeMs)).toFixed(2),avgRouteMs:+(T.stats.routeMs/Math.max(1,T.stats.routes)).toFixed(2),volume750Ms:Math.round(vol),departuresMs:+dep.toFixed(1),tickAvgMs:+ff.toFixed(1),carsPerHourReal:Math.round(d.total)}});
console.log('sim',JSON.stringify(r));
await p.evaluate(()=>{__city.setZoom(1);__city.centerOn(192,192);__fx.setDay(7);__city.setSpeed(1)});await p.waitForTimeout(3000);
const m=await p.evaluate(()=>__city.measure(6000));console.log('render',JSON.stringify(m));
await p.evaluate(()=>__city.setSpeed(3));const m3=await p.evaluate(()=>__city.measure(6000));console.log('render@3x',JSON.stringify(m3));
console.log(errs.length?'ERRORS '+errs.join(' | '):'errors none');await b.close()})();
