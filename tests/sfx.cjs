// Sound effects: build / zone / bulldoze / line / error sounds play (synthesized, no files), and the gear-menu toggle mutes them and is remembered.
// Usage: node tests/sfx.cjs URL
const {chromium}=require('playwright');(async()=>{const url=process.argv[2]||'http://localhost:4180/';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});const p=await b.newPage({viewport:{width:1400,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'?size=64&seed=5&city=Sfx');await p.waitForFunction(()=>window.__city&&__city.N&&window.__sfx);
await p.evaluate(()=>{localStorage.setItem('music','off');window.__tut&&__tut.setMode&&__tut.setMode('hidden')});
const res=[];const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
ok('sound effects button in the gear menu, on by default',await p.evaluate(()=>!!document.getElementById('sfxBtn')&&document.getElementById('sfxBtn').classList.contains('on')&&__sfx.on));
const c=await p.evaluate(()=>{const t=__city.terrain;for(let r=0;r<30;r++)for(let i=32-r;i<=32+r;i++)for(let j=32-r;j<=32+r;j++){let g=true;for(let a=-9;a<=9&&g;a++)for(let b=-9;b<=9;b++)if(!t[i+a]||t[i+a][j+b]!=='grass'){g=false;break}if(g)return[i,j]}});
ok('silent before the first click or key (browser rule)',await p.evaluate(([i,j])=>{__city.setSpeed(0);__city.sim().funds=1e6;__city.paint('road',i,j-8,i,j-6);return __sfx.log.length===0},c));
await p.keyboard.press('Shift');
const kinds=await p.evaluate(async([i,j])=>{const C=__city,w=()=>new Promise(r=>setTimeout(r,120));C.paint('road',i,j-5,i,j+8);await w();C.paint('R',i+1,j-7,i+2,j-1);await w();C.paint('svc:wind',i-2,j-7,i-2,j-7);await w();C.paint('pline',i-1,j-7,i-1,j-5);await w();C.paint('bulldoze',i+1,j-2,i+1,j-1);await w();C.sim().funds=10;C.paint('road',i+5,j-8,i+5,j+8);await w();return __sfx.log.map(e=>e.kind)},c);
ok('road, zone, building, power line, bulldoze and no-money sounds play',['road','zone','build','line','bulldoze','error'].every(k=>kinds.includes(k)),kinds.join());
ok('audio engine running',await p.evaluate(()=>__sfx.ctx&&__sfx.ctx.state==='running'),await p.evaluate(()=>__sfx.ctx&&__sfx.ctx.state));
await p.evaluate(()=>__city.sim().funds=1e6);
await p.click('#uMenuBtn');await p.waitForTimeout(150);await p.evaluate(()=>document.getElementById('fxBtn').click());await p.waitForTimeout(150);
const vis=await p.evaluate(()=>{const r=document.getElementById('sfxBtn').getBoundingClientRect();return r.width>0&&r.left>=0&&r.top>=0});ok('toggle visible when the settings panel is open',vis);
await p.click('#sfxBtn');const n0=await p.evaluate(()=>__sfx.log.length);
await p.evaluate(([i,j])=>__city.paint('road',i+4,j-8,i+4,j+8),c);await p.waitForTimeout(100);
ok('muted: no sounds play',await p.evaluate(n=>!__sfx.on&&__sfx.log.length===n&&/Off/.test(document.getElementById('sfxBtn').textContent),n0));
await p.evaluate(()=>{document.getElementById('sfxVol').value='0.2';document.getElementById('sfxVol').dispatchEvent(new Event('input'))});
await p.reload();await p.waitForFunction(()=>window.__city&&__city.N&&window.__sfx);
ok('mute and volume remembered after reload',await p.evaluate(()=>!__sfx.on&&Math.abs(__sfx.volume-0.2)<1e-6&&!document.getElementById('sfxBtn').classList.contains('on')));
await p.evaluate(()=>document.getElementById('sfxBtn').click());ok('turning it back on plays a preview',await p.evaluate(()=>__sfx.on&&__sfx.log.length===1));
const rend=await p.evaluate(async()=>{const out={};const S=__sfx.constructor;for(const k of ['road','zone','build','bulldoze','line','error']){const s=new S();s.armed=true;const ctx=new OfflineAudioContext(1,44100,44100);
 s.ctx=ctx;s.g=ctx.createGain();s.g.gain.value=0.5;s.g.connect(ctx.destination);const nb=s.noise=ctx.createBuffer(1,22050,44100),d=nb.getChannelData(0);for(let q=0;q<22050;q++)d[q]=Math.random()*2-1;
 s.play(k);const a=(await ctx.startRendering()).getChannelData(0);let pk=0,last=0;for(let q=0;q<a.length;q++){const v=Math.abs(a[q]);if(v>pk)pk=v;if(v>0.001)last=q}out[k]=[+pk.toFixed(3),+(last/44100).toFixed(2)]}return out});
ok('every sound is audible, short (<0.5 s) and not clipping',Object.values(rend).every(([pk,len])=>pk>0.02&&pk<0.9&&len<0.5),JSON.stringify(rend));
ok('no page errors',!errs.length,errs.join('; '));console.log(res.join('\n'));await b.close();process.exit(res.some(r=>r.startsWith('FAIL'))?1:0)})();
