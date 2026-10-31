// Pull City Art Studio's latest avenue + roundabout tiles + manifest into public/assets when the art workspace is on this machine.
// No-op elsewhere (CI builds use the committed copies). Keeps the repo's own status_* icon entries (new UI icon set).
const fs=require('fs'),path=require('path');const SRC=process.env.CITY_ART||'/workspace/city-art/assets',DST=path.join(__dirname,'..','public','assets');
if(!fs.existsSync(SRC)){console.log('sync-art: no',SRC,'- using committed art');process.exit(0)}
let n=0;for(const f of fs.readdirSync(path.join(SRC,'roads')))if(/^(avenue|roundabout)_/.test(f)){const a=path.join(SRC,'roads',f),b=path.join(DST,'roads',f);if(!fs.existsSync(b)||!fs.readFileSync(a).equals(fs.readFileSync(b))){fs.copyFileSync(a,b);n++}}
// roundabout construction stages + Roads-tray icon
const cdir=path.join(SRC,'roads','construction');if(fs.existsSync(cdir)){fs.mkdirSync(path.join(DST,'roads','construction'),{recursive:true});for(const f of fs.readdirSync(cdir))if(f.startsWith('roundabout_')){const a=path.join(cdir,f),b=path.join(DST,'roads','construction',f);if(!fs.existsSync(b)||!fs.readFileSync(a).equals(fs.readFileSync(b))){fs.copyFileSync(a,b);n++}}}
for(const [from,to] of [['ui/icons/svg/road_roundabout.svg','ui/icons2/svg/road_roundabout.svg'],['ui/icons/png48/road_roundabout.png','ui/icons2/png48/road_roundabout.png']]){const a=path.join(SRC,from),b=path.join(DST,to);if(fs.existsSync(a)&&fs.existsSync(path.dirname(b))&&(!fs.existsSync(b)||!fs.readFileSync(a).equals(fs.readFileSync(b)))){fs.copyFileSync(a,b);n++}}
const src=JSON.parse(fs.readFileSync(path.join(SRC,'manifest.json'))),mp=path.join(DST,'manifest.json'),cur=JSON.parse(fs.readFileSync(mp));
const keep=Object.fromEntries(cur.assets.filter(x=>x.name.startsWith('status_')).map(x=>[x.name,x]));src.assets=src.assets.map(x=>keep[x.name]||x);if(src.revision&&src.artRevision!==src.revision)src.artRevision=src.revision; // tests and the game read artRevision
const out=JSON.stringify(src,null,1);if(out!==JSON.stringify(cur,null,1)){fs.writeFileSync(mp,out);n++}
console.log('sync-art:',n,'file(s) updated, manifest',src.revision);
