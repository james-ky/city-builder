// Pull City Art Studio's latest avenue + roundabout (1- and 2-lane) tiles + manifest into public/assets when the art workspace is on this machine.
// No-op elsewhere (CI builds use the committed copies). Keeps the repo's own status_* icon entries (new UI icon set).
const fs=require('fs'),path=require('path');const SRC=process.env.CITY_ART||'/workspace/city-art/assets',DST=path.join(__dirname,'..','public','assets');
if(!fs.existsSync(SRC)){console.log('sync-art: no',SRC,'- using committed art');process.exit(0)}
let n=0;for(const f of fs.readdirSync(path.join(SRC,'roads')))if(/^(avenue|roundabout2?)_/.test(f)){const a=path.join(SRC,'roads',f),b=path.join(DST,'roads',f);if(!fs.existsSync(b)||!fs.readFileSync(a).equals(fs.readFileSync(b))){fs.copyFileSync(a,b);n++}}
// roundabout construction stages + Roads-tray icon
const cdir=path.join(SRC,'roads','construction');if(fs.existsSync(cdir)){fs.mkdirSync(path.join(DST,'roads','construction'),{recursive:true});for(const f of fs.readdirSync(cdir))if(/^roundabout2?_/.test(f)){const a=path.join(cdir,f),b=path.join(DST,'roads','construction',f);if(!fs.existsSync(b)||!fs.readFileSync(a).equals(fs.readFileSync(b))){fs.copyFileSync(a,b);n++}}}
for(const [from,to] of [['ui/icons/svg/road_roundabout.svg','ui/icons2/svg/road_roundabout.svg'],['ui/icons/png48/road_roundabout.png','ui/icons2/png48/road_roundabout.png'],['ui/icons/svg/road_roundabout2.svg','ui/icons2/svg/road_roundabout2.svg'],['ui/icons/png48/road_roundabout2.png','ui/icons2/png48/road_roundabout2.png']]){const a=path.join(SRC,from),b=path.join(DST,to);if(fs.existsSync(a)&&fs.existsSync(path.dirname(b))&&(!fs.existsSync(b)||!fs.readFileSync(a).equals(fs.readFileSync(b)))){fs.copyFileSync(a,b);n++}}
const src=JSON.parse(fs.readFileSync(path.join(SRC,'manifest.json'))),mp=path.join(DST,'manifest.json'),cur=JSON.parse(fs.readFileSync(mp));
const keep=Object.fromEntries(cur.assets.filter(x=>x.name.startsWith('status_')).map(x=>[x.name,x]));src.assets=src.assets.map(x=>keep[x.name]||x);if(src.revision&&src.artRevision!==src.revision)src.artRevision=src.revision; // tests and the game read artRevision
const out=JSON.stringify(src,null,1);if(out!==JSON.stringify(cur,null,1)){fs.writeFileSync(mp,out);n++}
console.log('sync-art:',n,'file(s) updated, manifest',src.revision);
// Plot Builder parts (own manifest) -> public/assets/plot_parts + a game-format manifest (assets[] with nightOf); new 'plots' icons -> icons2
{const P=path.join(SRC,'plot_parts');if(fs.existsSync(P)){let k=0;const cp=(a,b)=>{fs.mkdirSync(path.dirname(b),{recursive:true});if(!fs.existsSync(b)||!fs.readFileSync(a).equals(fs.readFileSync(b))){fs.copyFileSync(a,b);k++}};
 const walk=d=>{for(const f of fs.readdirSync(d)){const a=path.join(d,f);if(fs.statSync(a).isDirectory())walk(a);else cp(a,path.join(DST,'plot_parts',path.relative(P,a)))}};walk(P);
 const pm=JSON.parse(fs.readFileSync(path.join(P,'manifest.json'))),assets=[];for(const x of pm.parts){const {id,file,night,...rest}=x;delete rest.facing;assets.push({name:id,file:'plot_parts/'+file,...rest});if(night)assets.push({name:id+'_night',file:'plot_parts/'+night,nightOf:id,size:x.size,anchor:x.anchor,scale:x.scale})}
 const out=JSON.stringify({version:1,set:'plot_parts',artRevision:pm.artRevision,assets},null,1),mp=path.join(DST,'manifest_plot_parts.json');if(!fs.existsSync(mp)||fs.readFileSync(mp,'utf8')!==out){fs.writeFileSync(mp,out);k++}
 const im=JSON.parse(fs.readFileSync(path.join(SRC,'ui','icons','manifest.json'))),ids=Object.entries(im.icons||{}).filter(([id,x])=>x.group==='plots'||id==='cat_plots').map(([id])=>id);
 for(const id of ids)for(const [s,e] of [['svg','svg'],['png48','png'],['png24','png']]){const a=path.join(SRC,'ui','icons',s,id+'.'+e);if(fs.existsSync(a))cp(a,path.join(DST,'ui','icons2',s,id+'.'+e))}
 console.log('sync-art: plot parts',pm.parts.length,'icons',ids.length,'-',k,'file(s) updated')}}
// promoted end-game towers + 2x2/3x3 construction sets live in assets/buildings: copy them so the main manifest's entries load
{const B=path.join(SRC,'buildings');let k=0;if(fs.existsSync(B))for(const f of fs.readdirSync(B))if(/^(bld_[RCMI]_[45]_|construction_(2x2|3x3))/.test(f)){const a=path.join(B,f),b=path.join(DST,'buildings',f);if(!fs.existsSync(b)||!fs.readFileSync(a).equals(fs.readFileSync(b))){fs.copyFileSync(a,b);k++}}console.log('sync-art: end-game buildings',k,'file(s) updated')}
// end-game utilities + icons: promoted copies if present, else City Art Studio's staging sets (staging/endgame_utilities, staging/endgame_icons)
{const ST=path.join(SRC,'..','staging');let k=0;const cp=(a,b)=>{fs.mkdirSync(path.dirname(b),{recursive:true});if(!fs.existsSync(b)||!fs.readFileSync(a).equals(fs.readFileSync(b))){fs.copyFileSync(a,b);k++}};
 const um=path.join(ST,'endgame_utilities','manifest.json');if(fs.existsSync(um)){const m=JSON.parse(fs.readFileSync(um)),mp=path.join(DST,'manifest.json'),cur=JSON.parse(fs.readFileSync(mp)),have=new Set(cur.assets.map(x=>x.name));let add=0;
  for(const x of m.assets){const f=path.basename(x.file),prom=path.join(SRC,x.file),stg=path.join(ST,'endgame_utilities',f),src=fs.existsSync(prom)?prom:stg;if(!fs.existsSync(src))continue;cp(src,path.join(DST,x.file));if(!have.has(x.name)){const {night,...r}=x;cur.assets.push(r);add++}}
  if(add){fs.writeFileSync(mp,JSON.stringify(cur,null,1));k++}}
 for(const s of ['svg','png48','png24']){const d=path.join(ST,'endgame_icons',s);if(fs.existsSync(d))for(const f of fs.readdirSync(d)){const prom=path.join(SRC,'ui','icons',s,f);cp(fs.existsSync(prom)?prom:path.join(d,f),path.join(DST,'ui','icons2',s,f))}}
 console.log('sync-art: end-game utilities/icons',k,'change(s)')}
// Walking people (own manifest): assets/people -> public/assets/people (sheets + night overlays + manifest.json)
{const P=path.join(SRC,'people');if(fs.existsSync(P)){let k=0;fs.mkdirSync(path.join(DST,'people'),{recursive:true});for(const f of fs.readdirSync(P)){const a=path.join(P,f),b=path.join(DST,'people',f);if(fs.statSync(a).isFile()&&(!fs.existsSync(b)||!fs.readFileSync(a).equals(fs.readFileSync(b)))){fs.copyFileSync(a,b);k++}}console.log('sync-art: people -',k,'file(s) updated')}}
