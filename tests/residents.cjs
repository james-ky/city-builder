// Residents are whole people (whole homes × whole household members), with realistic flats per building.
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4400/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1200,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Homes');await p.waitForFunction(()=>window.__city&&__city.N);await p.evaluate(()=>{__city.setSpeed(0);__city.genDense(3)});
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
const r=await p.evaluate(()=>{const C=__city,N=C.N(),by={1:[],2:[],3:[]};for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(C.zone[i][j]==='R'&&C.bld[i][j]&&!C.lotAt(i,j))by[C.bld[i][j]].push(C.resCap(i,j));
 const st=x=>x.length?{n:x.length,min:Math.min(...x),avg:+(x.reduce((a,b)=>a+b,0)/x.length).toFixed(1),max:Math.max(...x),allInt:x.every(Number.isInteger)}:null;return{1:st(by[1]),2:st(by[2]),3:st(by[3])}});
ok('every building has a whole number of residents',[1,2,3].every(l=>!r[l]||r[l].allInt),JSON.stringify(r));
ok('houses hold one household (1-6 people)',r[1]&&r[1].min>=1&&r[1].max<=6);
ok('a mid-rise holds ~12 flats (20-35 residents on average)',r[2]&&r[2].avg>=20&&r[2].avg<=35);
ok('a tower holds ~60 flats (90-140 residents on average)',r[3]&&r[3].avg>=90&&r[3].avg<=140);
await b.close();res.forEach(r=>console.log(r));if(errs.length)console.log('ERRORS',errs);process.exit(res.some(r=>r.startsWith('FAIL'))||errs.length?1:0)})();
