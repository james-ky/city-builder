import { Playlist, Ambience } from './audio';
import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { loadManifest, place, placeNight, hasArt } from './sprites';

const N = 64, TW = 64, TH = 32;
const hud = document.getElementById('hud')!;

// --- simple seeded value noise for original procedural terrain ---
function rng(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
const r = rng(1234);
const G = 9, grid: number[][] = [];
for (let y = 0; y < G; y++) { grid.push([]); for (let x = 0; x < G; x++) grid[y].push(r()); }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sm = (t: number) => t * t * (3 - 2 * t);
function noise(i: number, j: number) {
  const fx = (i / (N - 1)) * (G - 1), fy = (j / (N - 1)) * (G - 1);
  const x0 = Math.min(G - 2, Math.floor(fx)), y0 = Math.min(G - 2, Math.floor(fy));
  const tx = sm(fx - x0), ty = sm(fy - y0);
  return lerp(lerp(grid[y0][x0], grid[y0][x0 + 1], tx), lerp(grid[y0 + 1][x0], grid[y0 + 1][x0 + 1], tx), ty);
}
type T = 'water' | 'sand' | 'grass' | 'forest';
const terrain: T[][] = [];
for (let i = 0; i < N; i++) { terrain.push([]); for (let j = 0; j < N; j++) {
  const h = noise(i, j) + (r() - 0.5) * 0.04;
  terrain[i].push(h < 0.32 ? 'water' : h < 0.36 ? 'sand' : h > 0.72 ? 'forest' : 'grass');
}}
const colors: Record<T, number[]> = {
  water: [0x2f6fb3, 0x3478bd], sand: [0xd9c58b, 0xe0cd95],
  grass: [0x5aa346, 0x62ad4d, 0x55993f], forest: [0x3c7a33, 0x417f37],
};

const toScreen = (i: number, j: number) => ({ x: (i - j) * TW / 2, y: (i + j) * TH / 2 });
const toTile = (x: number, y: number) => {
  const a = x / (TW / 2), b = y / (TH / 2);
  return { i: Math.floor((a + b) / 2 + 0.5), j: Math.floor((b - a) / 2 + 0.5) };
};
function diamond(g: Graphics, i: number, j: number) {
  const { x, y } = toScreen(i, j);
  g.poly([x, y - TH / 2, x + TW / 2, y, x, y + TH / 2, x - TW / 2, y]);
}

(async () => {
  const app = new Application();
  await app.init({ resizeTo: window, background: 0x1b2430, antialias: true });
  document.body.appendChild(app.canvas);
  const world = new Container();
  app.stage.addChild(world);

  await loadManifest();
  const groundL = new Container(), roadL = new Container(), zoneL = new Container(), gridL = new Container(), objL = new Container();
  const pollL = new Container(), carL = new Container(), cloudL = new Container(), nightG = new Graphics(), skyL = new Container(), smokeL = new Container();
  // night shading darkens ground layers; objects (objL) are darkened by tint so each building's night-lights
  // overlay can sit right after it in the same depth-sorted container (correct occlusion).
  const pipeL = new Container(), iconL = new Container();
  world.addChild(groundL, roadL, carL, zoneL, pollL, gridL, pipeL, nightG, objL, smokeL, cloudL, skyL, iconL);
  const lights: Sprite[] = []; let lastNightTint = -1, curTint = 0xffffff;
  type Car = { s: Sprite | Graphics; n?: Sprite; key: string; i: number; j: number; pi: number; pj: number; t: number; sp: number; dir: string };
  const cars: Car[] = []; // vehicles live in objL (depth-sorted with buildings) and survive redraws
  const trees: { s: { skew: { x: number } }; ph: number }[] = [];
  const blds: { x: number; y: number; z: string; L: number; seed: number }[] = [];
  const road: boolean[][] = [...Array(N)].map(() => Array(N).fill(false));
  const zone: string[][] = [...Array(N)].map(() => Array(N).fill(''));
  const bld: number[][] = [...Array(N)].map(() => Array(N).fill(0)); // 0 none, 1 low, 2 medium, 3 high
  const consT: number[][] = [...Array(N)].map(() => Array(N).fill(0)); // construction target level (0 = none)
  const consD: number[][] = [...Array(N)].map(() => Array(N).fill(0)); // days under construction
  const CONS_DAYS = 2; // days per construction stage (3 stages)
  const isTall = (z: string, L: number) => L === 3 && (z === 'R' || z === 'C');
  const inb = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N;
  // ---- civic services (plopped buildings) ----
  type Kind = 'edu' | 'police' | 'fire' | 'health' | 'power' | 'water';
  const SERV: Record<string, { name: string; size: number; cost: number; radius: number; kind: Kind; util?: boolean; out?: number; needsWater?: boolean; key?: string }> = {
    school: { name: 'Elementary School', size: 2, cost: 400, radius: 10, kind: 'edu' },
    highschool: { name: 'High School', size: 3, cost: 900, radius: 16, kind: 'edu' },
    police: { name: 'Police Station', size: 2, cost: 500, radius: 12, kind: 'police' },
    fire: { name: 'Fire Station', size: 2, cost: 500, radius: 12, kind: 'fire' },
    clinic: { name: 'Clinic', size: 1, cost: 250, radius: 7, kind: 'health' },
    hospital: { name: 'Hospital', size: 3, cost: 1200, radius: 16, kind: 'health' },
    coal: { name: 'Coal Power Plant', size: 3, cost: 3000, radius: 0, kind: 'power', util: true, out: 600, key: 'util_coal' },
    wind: { name: 'Wind Turbine', size: 1, cost: 400, radius: 0, kind: 'power', util: true, out: 40, key: 'util_wind' },
    pump: { name: 'Water Pump', size: 2, cost: 800, radius: 0, kind: 'water', util: true, out: 500, needsWater: true, key: 'util_pump' },
    tower: { name: 'Water Tower', size: 1, cost: 500, radius: 0, kind: 'water', util: true, out: 150, key: 'util_tower' },
  };
  type Civ = { type: string; i: number; j: number; s: number };
  const UPKEEP: Record<string, number> = { school: 60, highschool: 120, police: 80, fire: 80, clinic: 40, hospital: 180, coal: 150, wind: 15, pump: 40, tower: 30 }; // $/month at 100% funding
  const funding: Record<string, number> = Object.fromEntries(Object.keys(SERV).map(k => [k, 1])); // 0..1 per service type
  const civs: Civ[] = [];
  const civAt: (Civ | null)[][] = [...Array(N)].map(() => Array(N).fill(null));
  const KINDS: Kind[] = ['edu', 'police', 'fire', 'health'];
  // ---- power & water ----
  const pline: boolean[][] = [...Array(N)].map(() => Array(N).fill(false)), pipe: boolean[][] = [...Array(N)].map(() => Array(N).fill(false));
  const powered: boolean[][] = [...Array(N)].map(() => Array(N).fill(false)), watered: boolean[][] = [...Array(N)].map(() => Array(N).fill(false));
  const PDEM: Record<string, number[]> = { R: [0, 2, 6, 15], C: [0, 3, 8, 18], I: [0, 5, 12, 25] }, WDEM: Record<string, number[]> = { R: [0, 2, 6, 15], C: [0, 2, 5, 12], I: [0, 4, 10, 20] };
  const util = { pCap: 0, pUse: 0, pWant: 0, wCap: 0, wUse: 0, wWant: 0 };
  const consumerDemand = (i: number, j: number, D: Record<string, number[]>) => { const c = civAt[i][j]; if (c) return SERV[c.type].util ? 0 : (i === c.i && j === c.j ? 10 : 0); return bld[i][j] && zone[i][j] ? D[zone[i][j]][bld[i][j]] : 0; };
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const computeUtilities = () => {
    for (const r of powered) r.fill(false); for (const r of watered) r.fill(false);
    Object.assign(util, { pCap: 0, pUse: 0, pWant: 0, wCap: 0, wUse: 0, wWant: 0 });
    // power: conductors are power lines, zoned tiles (built or not), service and utility buildings
    const conducts = (i: number, j: number) => inb(i, j) && (pline[i][j] || !!zone[i][j] || !!civAt[i][j]);
    const seen: boolean[][] = [...Array(N)].map(() => Array(N).fill(false));
    for (let si = 0; si < N; si++) for (let sj = 0; sj < N; sj++) {
      if (seen[si][sj] || !conducts(si, sj)) continue;
      const comp: [number, number][] = [[si, sj]]; seen[si][sj] = true; const plants = new Set<Civ>();
      for (let h = 0; h < comp.length; h++) { const [i, j] = comp[h]; const c = civAt[i][j]; if (c && SERV[c.type].kind === 'power') plants.add(c);
        for (const [a, b] of D4) { const ni = i + a, nj = j + b; if (conducts(ni, nj) && !seen[ni][nj]) { seen[ni][nj] = true; comp.push([ni, nj]); } } }
      let cap = 0; for (const p of plants) cap += SERV[p.type].out!; util.pCap += cap;
      for (const [i, j] of comp) { const d = consumerDemand(i, j, PDEM); if (!d) continue; util.pWant += d; if (cap >= d) { cap -= d; util.pUse += d; markCiv(powered, i, j); } }
    }
    // water: pipes connect to pumps/towers; anything within 3 tiles of a connected pipe (or the facility) is served
    const wseen: boolean[][] = [...Array(N)].map(() => Array(N).fill(false));
    const assigned: boolean[][] = [...Array(N)].map(() => Array(N).fill(false));
    for (const src of civs) { if (SERV[src.type].kind !== 'water' || wseen[src.i][src.j]) continue;
      const net: [number, number][] = []; const facs = new Set<Civ>();
      const isNet = (i: number, j: number) => inb(i, j) && (pipe[i][j] || (!!civAt[i][j] && SERV[civAt[i][j]!.type].kind === 'water'));
      net.push([src.i, src.j]); wseen[src.i][src.j] = true;
      for (let h = 0; h < net.length; h++) { const [i, j] = net[h]; const c = civAt[i][j]; if (c && SERV[c.type].kind === 'water') facs.add(c);
        for (const [a, b] of D4) { const ni = i + a, nj = j + b; if (isNet(ni, nj) && !wseen[ni][nj]) { wseen[ni][nj] = true; net.push([ni, nj]); } } }
      let cap = 0; for (const f of facs) cap += SERV[f.type].out!; util.wCap += cap;
      const dist: number[][] = [...Array(N)].map(() => Array(N).fill(99)); const q: [number, number][] = [];
      for (const [i, j] of net) { dist[i][j] = 0; q.push([i, j]); }
      for (let h = 0; h < q.length; h++) { const [i, j] = q[h]; if (dist[i][j] >= 3) continue;
        for (const [a, b] of D4) { const ni = i + a, nj = j + b; if (inb(ni, nj) && dist[ni][nj] > dist[i][j] + 1) { dist[ni][nj] = dist[i][j] + 1; q.push([ni, nj]); } } }
      for (const [i, j] of q) { if (assigned[i][j]) continue; assigned[i][j] = true; const d = consumerDemand(i, j, WDEM); if (!d) continue; util.wWant += d; if (cap >= d) { cap -= d; util.wUse += d; markCiv(watered, i, j); } }
    }
  };
  const markCiv = (m: boolean[][], i: number, j: number) => { const c = civAt[i][j]; if (c) { for (let a = 0; a < c.s; a++) for (let b = 0; b < c.s; b++) m[c.i + a][c.j + b] = true; } else m[i][j] = true; };
  const cov: Record<Kind, number[][]> = Object.fromEntries(KINDS.map(k => [k, [...Array(N)].map(() => Array(N).fill(0))])) as any;
  const computeCoverage = () => { // 1 at the building, fading to 0 at its radius; best provider wins
    for (const k of KINDS) for (const row of cov[k]) row.fill(0);
    for (const c of civs) { const S = SERV[c.type], ci = c.i + (c.s - 1) / 2, cj = c.j + (c.s - 1) / 2, r = S.radius * funding[c.type]; if (r < 0.5) continue; // lower funding shrinks coverage
      for (let i = Math.max(0, Math.floor(ci - r)); i <= Math.min(N - 1, Math.ceil(ci + r)); i++) for (let j = Math.max(0, Math.floor(cj - r)); j <= Math.min(N - 1, Math.ceil(cj + r)); j++) {
        const v = 1 - Math.hypot(i - ci, j - cj) / r; if (v > cov[S.kind][i][j]) cov[S.kind][i][j] = v; } }
  };
  const crime: number[][] = [...Array(N)].map(() => Array(N).fill(0)), fireRisk: number[][] = [...Array(N)].map(() => Array(N).fill(0));
  const computeRisks = () => { // crime grows with density nearby, police coverage suppresses it; fire risk likewise (used by disasters later)
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      let dens = 0; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (inb(i + a, j + b)) dens += bld[i + a][j + b] ** 2;
      crime[i][j] = dens * 0.08 * (1 - 0.85 * cov.police[i][j]);
      fireRisk[i][j] = bld[i][j] ? (zone[i][j] === 'I' ? 2 : 1) * bld[i][j] * (1 - 0.85 * cov.fire[i][j]) : 0;
    }
  };
  const resCap = (i: number, j: number) => Math.round(CAP.R[bld[i][j]] * (1 + 0.15 * cov.health[i][j])); // health care raises population
  const seedOf = (i: number, j: number) => ((i * 73856093) ^ (j * 19349663)) >>> 0;
  // manifest directions: NE=(0,-1) SE=(1,0) SW=(0,1) NW=(-1,0); corners N=(-1,-1) E=(1,-1) S=(1,1) W=(-1,1)
  const isLand = (i: number, j: number) => inb(i, j) && terrain[i][j] !== 'water';
  const shoreMask = (i: number, j: number) => {
    const ne = isLand(i, j - 1), se = isLand(i + 1, j), sw = isLand(i, j + 1), nw = isLand(i - 1, j);
    let m = (ne ? 1 : 0) | (se ? 2 : 0) | (sw ? 4 : 0) | (nw ? 8 : 0);
    if (isLand(i - 1, j - 1) && !nw && !ne) m |= 16;
    if (isLand(i + 1, j - 1) && !ne && !se) m |= 32;
    if (isLand(i + 1, j + 1) && !se && !sw) m |= 64;
    if (isLand(i - 1, j + 1) && !sw && !nw) m |= 128;
    return m;
  };
  const sandKey = hasArt('sand') ? 'sand' : hasArt('grass') ? 'grass' : 'sand';
  for (let s = 0; s < 2 * N - 1; s++) for (let i = 0; i < N; i++) { const j = s - i; if (j < 0 || j >= N) continue;
    const { x, y } = toScreen(i, j), t = terrain[i][j];
    let key: string = t === 'sand' ? sandKey : t === 'forest' ? 'grass' : t;
    if (t === 'water') { const m = shoreMask(i, j); if (m && hasArt('shore_' + m)) key = 'shore_' + m; }
    place(key, x, y, groundL, seedOf(i, j));
    place('grid', x, y, gridL);
  }
  gridL.visible = localStorage.getItem('grid') !== 'off';
  const gridBtn = document.getElementById('gridBtn')!;
  const setGrid = (v: boolean) => { gridL.visible = v; gridBtn.classList.toggle('on', v); localStorage.setItem('grid', v ? 'on' : 'off'); };
  gridBtn.onclick = () => setGrid(!gridL.visible); setGrid(gridL.visible);
  window.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'g') setGrid(!gridL.visible); });
  let zonesOn = localStorage.getItem('zones') !== 'off';
  let tool = 'select' as string;
  const zoneBtn = document.getElementById('zoneBtn')!;
  const syncZones = () => { zoneL.visible = zonesOn || ['R', 'C', 'I'].includes(tool); zoneBtn.classList.toggle('on', zonesOn); };
  const setZones = (v: boolean) => { zonesOn = v; localStorage.setItem('zones', v ? 'on' : 'off'); syncZones(); };
  zoneBtn.onclick = () => setZones(!zonesOn);
  window.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'z') setZones(!zonesOn); });
  let near: number[][] = [];
  const computeNear = () => { // BFS distance from nearest road (4-neighbour steps)
    near = [...Array(N)].map(() => Array(N).fill(99)); const q: [number, number][] = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (road[i][j]) { near[i][j] = 0; q.push([i, j]); }
    for (let h = 0; h < q.length; h++) { const [i, j] = q[h];
      for (const [a, b] of [[1,0],[-1,0],[0,1],[0,-1]]) { const ni=i+a, nj=j+b; if (inb(ni,nj) && near[ni][nj] > near[i][j]+1) { near[ni][nj]=near[i][j]+1; q.push([ni,nj]); } } }
  };
  const clear = (c: Container) => c.removeChildren().forEach(o => o.destroy());
  const isRoad = (i: number, j: number) => inb(i, j) && road[i][j];
  let curZ = 0; objL.sortableChildren = true; // buildings take their tile's screen y; vehicles use theirs, so they sort together
  objL.on('childAdded', (c: any) => { if (!c.__veh) c.zIndex = curZ; });
  const redraw = () => {
    computeCoverage(); clear(roadL); clear(zoneL); objL.removeChildren().forEach(o => { if (!(o as any).__veh) o.destroy(); }); for (const c of cars) { objL.addChild(c.s); if (c.n) objL.addChild(c.n); } clear(pipeL); clear(iconL); lights.length = 0; lastNightTint = -1; trees.length = 0; blds.length = 0;
    computeNear();
    for (let s = 0; s < 2 * N - 1; s++) for (let i = 0; i < N; i++) { const j = s - i; if (j < 0 || j >= N) continue;
      const { x, y } = toScreen(i, j), seed = seedOf(i, j); curZ = y;
      const cv = civAt[i][j];
      if (cv) {
        place('civic_lot', x, y, zoneL, seed);
        if (i === cv.i + cv.s - 1 && j === cv.j) { // depth key i0+j0+size-1 (manifest placement); anchor = footprint centre
          const c = toScreen(cv.i + (cv.s - 1) / 2, cv.j + (cv.s - 1) / 2), key = SERV[cv.type].key ?? 'civic_' + cv.type;
          place(key, c.x, c.y, objL, seed); const l = placeNight(key, c.x, c.y, objL, seed); if (l) { l.alpha = 0; lights.push(l); }
        }
      } else if (pline[i][j] && !road[i][j]) {
        const pl = (a: number, b: number) => inb(a, b) && (pline[a][b] || (!!civAt[a][b] && SERV[civAt[a][b]!.type].kind === 'power'));
        place('power_line_' + ((pl(i, j - 1) ? 1 : 0) | (pl(i + 1, j) ? 2 : 0) | (pl(i, j + 1) ? 4 : 0) | (pl(i - 1, j) ? 8 : 0)), x, y, objL, seed);
      } else if (road[i][j]) {
        const m = (isRoad(i, j - 1) ? 1 : 0) | (isRoad(i + 1, j) ? 2 : 0) | (isRoad(i, j + 1) ? 4 : 0) | (isRoad(i - 1, j) ? 8 : 0);
        place('road_' + (m || (hasArt('road_0') ? 0 : 1)), x, y, roadL, seed);
      } else if (zone[i][j]) {
        if (!bld[i][j] && !consT[i][j]) place('zone_' + zone[i][j], x, y, zoneL, seed);
        if (consT[i][j]) place(`construction_1x1_${isTall(zone[i][j], consT[i][j]) ? 'tall_' : ''}stage${Math.min(3, 1 + Math.floor(consD[i][j] / CONS_DAYS))}`, x, y, objL, seed);
        else if (bld[i][j]) { place(`bld_${zone[i][j]}_${bld[i][j]}`, x, y, objL, seed); { const l = placeNight(`bld_${zone[i][j]}_${bld[i][j]}`, x, y, objL, seed); if (l) { l.alpha = 0; lights.push(l); } } blds.push({ x, y, z: zone[i][j], L: bld[i][j], seed }); }
      }
      if (road[i][j] && pline[i][j]) { const pl = (a: number, b: number) => inb(a, b) && pline[a][b]; place('power_line_' + ((pl(i, j - 1) ? 1 : 0) | (pl(i + 1, j) ? 2 : 0) | (pl(i, j + 1) ? 4 : 0) | (pl(i - 1, j) ? 8 : 0)), x, y, objL, seed); }
      if (pipe[i][j]) { const pp = (a: number, b: number) => inb(a, b) && (pipe[a][b] || (!!civAt[a][b] && SERV[civAt[a][b]!.type].kind === 'water')); place('pipe_' + ((pp(i, j - 1) ? 1 : 0) | (pp(i + 1, j) ? 2 : 0) | (pp(i, j + 1) ? 4 : 0) | (pp(i - 1, j) ? 8 : 0)), x, y, pipeL, seed); }
      if (!zone[i][j] && !road[i][j] && !civAt[i][j] && !pline[i][j] && terrain[i][j] === 'forest') trees.push({ s: place('forest', x, y, objL, seed), ph: (seed % 628) / 100 });
    }
  };
  redraw();
  const preview = new Graphics(), hl = new Graphics();
  world.addChild(preview, hl);

  // ---- tools ----
  type Tool = string; // select | road | R | C | I | bulldoze | svc:<type>
  const tools: [Tool, string][] = [['select','Select / Pan'],['road','Road'],['R','Residential'],['C','Commercial'],['I','Industrial'],['bulldoze','Bulldoze'],['pline','Power line'],['pipe','Pipe']];
  let toolHook: ((t: string) => void) | undefined;
  const bar = document.getElementById('toolbar')!;
  const setTool = (t: Tool) => { tool = t; syncZones(); toolHook?.(t); if (t.startsWith('svc:')) setCovView(SERV[t.slice(4)].kind); document.querySelectorAll<HTMLElement>('#toolbar button, #services button[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t)); };
  tools.forEach(([t, label], k) => { const b = document.createElement('button'); b.dataset.t = t; b.innerHTML = `<b>${k+1}</b> ${label}`; b.onclick = () => setTool(t); bar.appendChild(b); });
  // Services toolbar group
  const svcBar = document.getElementById('services')!;
  const ICON: Record<string, string> = { school: 'school_elem', highschool: 'school_high', police: 'police', fire: 'fire_station', clinic: 'clinic', hospital: 'hospital' };
  svcBar.innerHTML = '<span>Services</span>' + Object.entries(SERV).filter(([, v]) => !v.util).map(([k, v]) => `<button data-t="svc:${k}" title="${v.name}: ${v.size}x${v.size}, $${v.cost}, radius ${v.radius}"><img src="./assets/ui/icons/icon_${ICON[k]}@2x.png" alt="">${v.name.replace(' Station', '')} <small>$${v.cost}</small></button>`).join('')
    + '<span class="sep">Utilities</span>' + Object.entries(SERV).filter(([, v]) => v.util).map(([k, v]) => `<button data-t="svc:${k}" title="${v.name}: ${v.size}x${v.size}, $${v.cost}, output ${v.out}${v.needsWater ? ', must touch water' : ''}">${{ coal: '🏭', wind: '🌬', pump: '⛲', tower: '🗼' }[k]} ${v.name.replace(' Power Plant', '').replace('Water ', '').replace(' Turbine', '')} <small>$${v.cost}</small></button>`).join('')
    + '<select id="covSel" title="Coverage overlay"><option value="">Coverage: off</option><option value="edu">Education</option><option value="police">Police</option><option value="fire">Fire</option><option value="health">Health</option><option value="crime">Crime</option><option value="fireRisk">Fire risk</option><option value="power">Powered</option><option value="water">Water served</option></select>';
  svcBar.querySelectorAll('button[data-t]').forEach(b => (b as HTMLElement).onclick = () => setTool((b as HTMLElement).dataset.t!));
  setTool('select');
  window.addEventListener('keydown', e => { const k = +e.key; if (k >= 1 && k <= 8) setTool(tools[k-1][0]); if (e.key === 'Escape') { drag = null; preview.clear(); } });

  let drag: { i: number; j: number; ci: number; cj: number } | null = null;
  const dragTiles = (): [number, number][] => {
    if (!drag) return [];
    const out: [number, number][] = [];
    if (tool === 'road' || tool === 'pline' || tool === 'pipe') {
      const di = drag.ci - drag.i, dj = drag.cj - drag.j;
      if (Math.abs(di) >= Math.abs(dj)) for (let k = 0; k <= Math.abs(di); k++) out.push([drag.i + Math.sign(di) * k, drag.j]);
      else for (let k = 0; k <= Math.abs(dj); k++) out.push([drag.i, drag.j + Math.sign(dj) * k]);
    } else {
      for (let i = Math.min(drag.i, drag.ci); i <= Math.max(drag.i, drag.ci); i++)
        for (let j = Math.min(drag.j, drag.cj); j <= Math.max(drag.j, drag.cj); j++) out.push([i, j]);
    }
    return out.filter(([i, j]) => inb(i, j));
  };
  const svcFoot = (t: string, hi: number, hj: number) => { const S = SERV[t], o = Math.floor((S.size - 1) / 2), i0 = hi - o, j0 = hj - o, out: [number, number][] = [];
    for (let a = 0; a < S.size; a++) for (let b = 0; b < S.size; b++) out.push([i0 + a, j0 + b]); return { i0, j0, s: S.size, tiles: out }; };
  const tileFree = (i: number, j: number) => inb(i, j) && terrain[i][j] !== 'water' && !road[i][j] && !zone[i][j] && !civAt[i][j];
  const touchesRoad = (i0: number, j0: number, s: number) => { for (let k = 0; k < s; k++) if (isRoad(i0 - 1, j0 + k) || isRoad(i0 + s, j0 + k) || isRoad(i0 + k, j0 - 1) || isRoad(i0 + k, j0 + s)) return true; return false; };
  const touchesWater = (i0: number, j0: number, s: number) => { const w = (i: number, j: number) => inb(i, j) && terrain[i][j] === 'water'; for (let k = 0; k < s; k++) if (w(i0 - 1, j0 + k) || w(i0 + s, j0 + k) || w(i0 + k, j0 - 1) || w(i0 + k, j0 + s)) return true; return false; };
  const canPlop = (t: string, hi: number, hj: number) => { const f = svcFoot(t, hi, hj), S = SERV[t];
    return f.tiles.every(([i, j]) => tileFree(i, j) && !pline[i][j]) && (S.util ? true : touchesRoad(f.i0, f.j0, f.s)) && (!S.needsWater || touchesWater(f.i0, f.j0, f.s)); };
  const plop = (t: string, hi: number, hj: number) => {
    if (!canPlop(t, hi, hj)) return false; if (!spend(SERV[t].cost)) return false; const f = svcFoot(t, hi, hj), c: Civ = { type: t, i: f.i0, j: f.j0, s: f.s };
    civs.push(c); for (const [i, j] of f.tiles) civAt[i][j] = c; redraw(); census(); updateStats(); return true;
  };
  const removeCiv = (c: Civ) => { civs.splice(civs.indexOf(c), 1); for (let a = 0; a < c.s; a++) for (let b = 0; b < c.s; b++) civAt[c.i + a][c.j + b] = null; };
  const valid = (i: number, j: number) => {
    if (tool === 'road') return terrain[i][j] !== 'water' && !civAt[i][j] && !pline[i][j];
    if (tool === 'pline') return !civAt[i][j] && !zone[i][j] && !pline[i][j]; // lines can span water and cross roads
    if (tool === 'pipe') return !pipe[i][j] && terrain[i][j] !== 'water';
    if (tool === 'bulldoze' && underground) return pipe[i][j];
    if (tool === 'bulldoze') return pline[i][j] || road[i][j] || !!zone[i][j] || bld[i][j] > 0 || consT[i][j] > 0 || !!civAt[i][j];
    return terrain[i][j] !== 'water' && !road[i][j] && !civAt[i][j] && !pline[i][j] && near[i][j] <= 3;
  };
  const showPreview = () => {
    preview.clear();
    if (tool.startsWith('svc:')) { if (drag) { const t = tool.slice(4), ok = canPlop(t, drag.ci, drag.cj); for (const [i, j] of svcFoot(t, drag.ci, drag.cj).tiles) if (inb(i, j)) { diamond(preview, i, j); preview.fill({ color: ok ? 0xffffff : 0xff2020, alpha: 0.5 }); } } return; }
    const col = tool === 'pline' ? 0xffd23f : tool === 'pipe' ? 0x4fa3ff : tool === 'road' ? 0x9aa0a6 : tool === 'bulldoze' ? 0xff8800 : ({R:0x3ecf4a,C:0x3b8cff,I:0xf2c230} as any)[tool];
    let c = 0; for (const [i, j] of dragTiles()) if (valid(i, j)) c += tool === 'pline' ? COST.pline : tool === 'pipe' ? COST.pipe : tool === 'road' ? (road[i][j] ? 0 : COST.road) : tool === 'bulldoze' ? COST.bulldoze : (zone[i][j] !== tool ? COST.zone : 0);
    hud.textContent = `Cost: $${c.toLocaleString()}` + (c > sim.funds ? ' (not enough funds)' : '');
    for (const [i, j] of dragTiles()) { diamond(preview, i, j); preview.fill({ color: valid(i, j) ? col : 0xff2020, alpha: 0.55 }); }
  };
  const commit = () => {
    if (tool.startsWith('svc:')) { if (drag) plop(tool.slice(4), drag.ci, drag.cj); drag = null; preview.clear(); return; }
    const tiles = dragTiles().filter(([i, j]) => valid(i, j)), seen = new Set<Civ>();
    let cost = 0;
    for (const [i, j] of tiles) {
      if (tool === 'road') { if (!road[i][j]) cost += COST.road; }
      else if (tool === 'pline') cost += COST.pline;
      else if (tool === 'pipe') cost += COST.pipe;
      else if (tool === 'bulldoze' && underground) cost += COST.bulldoze;
      else if (tool === 'bulldoze') { const c = civAt[i][j]; if (c) { if (!seen.has(c)) { seen.add(c); cost += COST.bulldozeCivic; } } else cost += COST.bulldoze; }
      else if (zone[i][j] !== tool) cost += COST.zone;
    }
    if (!spend(cost)) { drag = null; preview.clear(); return; }
    for (const [i, j] of tiles) {
      if (tool === 'pline') { pline[i][j] = true; continue; }
      if (tool === 'pipe') { pipe[i][j] = true; continue; }
      if (tool === 'bulldoze' && underground) { pipe[i][j] = false; continue; }
      if (tool === 'road') { road[i][j] = true; zone[i][j] = ''; bld[i][j] = 0; consT[i][j] = 0; }
      else if (tool === 'bulldoze') { if (civAt[i][j]) removeCiv(civAt[i][j]!); else if (pline[i][j]) { pline[i][j] = false; continue; } else if (!road[i][j] && !zone[i][j]) continue; road[i][j] = false; zone[i][j] = ''; bld[i][j] = 0; consT[i][j] = 0; }
      else { if (zone[i][j] !== tool) { bld[i][j] = 0; consT[i][j] = 0; } zone[i][j] = tool; } }
    drag = null; preview.clear(); redraw(); census(); updateStats();
  };
  const tileAt = (sx: number, sy: number) => toTile((sx - world.position.x) / zoom, (sy - world.position.y) / zoom);
  (window as any).__city = { tileToScreen: (i: number, j: number) => { const p = toScreen(i, j); return { x: p.x * zoom + world.position.x, y: p.y * zoom + world.position.y }; }, road, zone, bld, consT, terrain, civs, plop, cov, crime, fireRisk, setTool, sim: () => sim, setSpeed: (n: number) => setSpeed(n), fastForward: (n: number) => { for (let k = 0; k < n; k++) tick(); }, centerOn: (i: number, j: number) => { const p = toScreen(i, j); camX = p.x; camY = p.y; } };

  // camera
  const center = toScreen(N / 2, N / 2);
  let zoom = Math.min(window.innerWidth / (N * TW), window.innerHeight / (N * TH)) * 1.6;
  let camX = center.x, camY = center.y;
  const keys = new Set<string>();
  const apply = () => {
    world.scale.set(zoom);
    world.position.set(app.screen.width / 2 - camX * zoom, app.screen.height / 2 - camY * zoom);
  };
  const clampZoom = (z: number) => Math.max(0.2, Math.min(4, z));
  const zoomAt = (sx: number, sy: number, nz: number) => {
    const wx = (sx - world.position.x) / zoom, wy = (sy - world.position.y) / zoom;
    zoom = clampZoom(nz);
    camX = wx - (sx - app.screen.width / 2) / zoom; camY = wy - (sy - app.screen.height / 2) / zoom;
  };

  let mouse: { x: number; y: number } | null = null;
  const updateHover = () => {
    hl.clear();
    if (!mouse) { hud.textContent = 'Tile: —'; return; }
    const { i, j } = toTile((mouse.x - world.position.x) / zoom, (mouse.y - world.position.y) / zoom);
    if (i < 0 || j < 0 || i >= N || j >= N) { hud.textContent = 'Tile: —'; return; }
    if (tool.startsWith('svc:') && !drag) { const t = tool.slice(4), ok = canPlop(t, i, j); for (const [a, b] of svcFoot(t, i, j).tiles) if (inb(a, b)) { diamond(hl, a, b); hl.fill({ color: ok ? 0xffffff : 0xff2020, alpha: 0.35 }); } }
    else { diamond(hl, i, j); hl.fill({ color: 0xffffff, alpha: 0.25 }).stroke({ width: 2 / zoom, color: 0xffff66 }); }
    if (civAt[i][j]) { hud.textContent = `Tile: ${i}, ${j}  (${SERV[civAt[i][j]!.type].name})`; return; }
    hud.textContent = `Tile: ${i}, ${j}  (${road[i][j] ? 'road' : zone[i][j] ? ZNAME[zone[i][j]] + (bld[i][j] ? ' · ' + DNAME[bld[i][j]] + ' building' : ' zone') : terrain[i][j]})`;
  };

  // ---- simulation ----
  const ZNAME: Record<string, string> = { R: 'Residential', C: 'Commercial', I: 'Industrial' };
  const DNAME = ['', 'Low density', 'Medium density', 'High density'];
  const CAP: Record<string, number[]> = { R: [0, 12, 45, 140], C: [0, 6, 22, 70], I: [0, 10, 32, 90] };
  const sim = { day: 0, speed: 1, pop: 0, jobsC: 0, jobsI: 0, dR: 0, dC: 0, dI: 0, spent: 0, funds: 20000, loan: 0 };
  // ---- budget ----
  const tax: Record<string, number> = { R: 9, C: 9, I: 9 };
  const COST = { road: 10, zone: 5, bulldoze: 2, bulldozeCivic: 50, pline: 5, pipe: 6 };
  const LOAN = 10000, LOAN_RATE = 0.01; // 1% per month
  type Report = { income: Record<string, number>; expense: Record<string, number>; net: number };
  let lastMonth: Report | null = null;
  const toastEl = document.getElementById('toast')!; let toastT = 0;
  const toast = (msg: string) => { toastEl.textContent = msg; toastEl.style.opacity = '1'; clearTimeout(toastT); toastT = window.setTimeout(() => toastEl.style.opacity = '0', 2600); };
  const spend = (cost: number) => { // returns false (and explains) if the city can't afford it
    if (cost <= 0) return true;
    if (sim.funds < cost) { toast(`Not enough funds: this costs $${cost.toLocaleString()}, you have $${Math.floor(sim.funds).toLocaleString()}` + (sim.loan ? '' : ' (a loan is available in the Budget panel, B)')); return false; }
    sim.funds -= cost; sim.spent += cost; return true;
  };
  const projection = (): Report => {
    let roads = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (road[i][j]) roads++;
    const income: Record<string, number> = {
      'Residential tax': Math.round(tax.R / 100 * sim.pop * 10),
      'Commercial tax': Math.round(tax.C / 100 * sim.jobsC * 12),
      'Industrial tax': Math.round(tax.I / 100 * sim.jobsI * 12) };
    const expense: Record<string, number> = { 'Road upkeep': roads * 1 };
    for (const c of civs) { const k = SERV[c.type].name; expense[k] = (expense[k] ?? 0) + Math.round(UPKEEP[c.type] * funding[c.type]); }
    extraExpenses(expense);
    if (sim.loan) expense['Loan interest'] = Math.round(sim.loan * LOAN_RATE);
    const net = Object.values(income).reduce((a, b) => a + b, 0) - Object.values(expense).reduce((a, b) => a + b, 0);
    return { income, expense, net };
  };
  let extraExpenses = (_e: Record<string, number>) => {}; // utilities hook in here
  const monthly = () => {
    lastMonth = projection(); sim.funds += lastMonth.net;
    if (sim.funds < 0) toast(`⚠ The city is in debt ($${Math.floor(sim.funds).toLocaleString()}). Raise taxes, cut funding, or take a loan.`);
    renderBudget();
  };
  let downAt: { x: number; y: number } | null = null;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const poll: number[][] = [...Array(N)].map(() => Array(N).fill(0));
  const computePollution = () => { // spreads up to 5 tiles from industry, stronger for higher tiers
    for (const row of poll) row.fill(0);
    for (const c of civs) if (c.type === 'coal') { const ci = c.i + 1, cj = c.j + 1; for (let a = -7; a <= 7; a++) for (let b = -7; b <= 7; b++) { const d = Math.hypot(a, b); if (d <= 7 && inb(ci + a, cj + b)) poll[ci + a][cj + b] += 6 * (1 - d / 8); } }
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (zone[i][j] === 'I' && bld[i][j]) {
      const L = bld[i][j];
      for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) { const d = Math.hypot(a, b); if (d <= 5 && inb(i + a, j + b)) poll[i + a][j + b] += L * (1 - d / 6); }
    }
  };
  const census = () => {
    computeUtilities(); drawIcons(); computePollution(); drawPollution(); computeRisks(); drawCoverage();
    sim.pop = sim.jobsC = sim.jobsI = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (bld[i][j]) {
      const v = zone[i][j] === 'R' ? resCap(i, j) : CAP[zone[i][j]][bld[i][j]];
      if (zone[i][j] === 'R') sim.pop += v; else if (zone[i][j] === 'C') sim.jobsC += v; else sim.jobsI += v;
    }
    const jobs = sim.jobsC + sim.jobsI, workers = sim.pop * 0.6;
    sim.dR = clamp((jobs * 1.6 + 60 - sim.pop) / Math.max(60, sim.pop * 0.4));      // people come for jobs
    sim.dC = clamp((sim.pop * 0.35 + 10 - sim.jobsC) / Math.max(15, sim.pop * 0.12));  // shops follow residents
    sim.dI = clamp((60 + sim.day * 0.4 + workers * 0.6 - sim.jobsI) / Math.max(30, sim.jobsI * 0.4)); // outside demand + workforce
    // taxes: each point below the 9% default boosts that zone's demand, each point above lowers it
    sim.dR = clamp(sim.dR + (9 - tax.R) * 0.05); sim.dC = clamp(sim.dC + (9 - tax.C) * 0.05); sim.dI = clamp(sim.dI + (9 - tax.I) * 0.05);
  };
  const tick = () => {
    lastTick = performance.now(); sim.day++; if (sim.day % 30 === 0) monthly(); let changed = false;
    const d: Record<string, number> = { R: sim.dR, C: sim.dC, I: sim.dI };
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const z = zone[i][j]; if (!z) continue;
      if (consT[i][j]) { // advance construction
        consD[i][j]++;
        if (consD[i][j] >= CONS_DAYS * 3) { bld[i][j] = consT[i][j]; consT[i][j] = 0; changed = true; }
        else if (consD[i][j] % CONS_DAYS === 0) changed = true;
        continue;
      }
      const L = bld[i][j];
      const dem = d[z] - Math.min(0.3, crime[i][j] * 0.05) // crime lowers desirability everywhere
        + (z === 'R' ? -Math.min(0.4, poll[i][j] * 0.04) + 0.15 * cov.edu[i][j] + 0.15 * cov.health[i][j] : 0); // pollution vs schools & health care
      if (near[i][j] > 3) { if (L && Math.random() < 0.05) { bld[i][j]--; changed = true; } continue; } // lost road access
      const before = bld[i][j];
      if (dem > 0 && L < 3) {
        const need = [0, 0, 0.15, 0.3][L + 1]; // higher density needs sustained strong demand
        const utilOk = L + 1 < 2 || (powered[i][j] && watered[i][j]); // no power or water: stays low density
        const eduOk = utilOk && !(z === 'R' && L + 1 === 3 && cov.edu[i][j] <= 0); // high-density housing needs a school nearby
        if (eduOk && dem > need && Math.random() < (L === 0 ? 0.06 : 0.02) * dem) { consT[i][j] = L + 1; consD[i][j] = 0; changed = true; }
      } else if (L > 0 && dem < -0.5 && Math.random() < 0.02 * -dem) bld[i][j]--;
      if (bld[i][j] !== before) changed = true;
    }
    if (changed) redraw(); census(); updateStats();
  };
  // top HUD
  const stats = document.getElementById('stats')!;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = () => `${MONTHS[Math.floor(sim.day / 30) % 12]} ${sim.day % 30 + 1}, Year ${Math.floor(sim.day / 360) + 1}`;
  const rbar = (k: string, v: number, c: string) => `<div class="rci"><div class="half"><div style="height:${Math.max(0, v) * 100}%;background:${c}"></div></div><div class="half neg"><div style="height:${Math.max(0, -v) * 100}%;background:${c}"></div></div><span>${k}</span></div>`;
  const updateStats = () => {
    stats.querySelector('#nums')!.innerHTML = `<span class="it"><b>${dateStr()}</b> <span id="tod"></span></span><span class="it">Pop <b>${sim.pop.toLocaleString()}</b></span><span class="it" title="Commercial ${sim.jobsC} / Industrial ${sim.jobsI}">Jobs <b>${(sim.jobsC + sim.jobsI).toLocaleString()}</b></span><span class="it${util.pWant > util.pCap ? ' neg' : ''}" title="Power: used / capacity (demand ${util.pWant})">⚡ <b>${util.pUse}/${util.pCap}</b></span><span class="it${util.wWant > util.wCap ? ' neg' : ''}" title="Water: used / capacity (demand ${util.wWant})">💧 <b>${util.wUse}/${util.wCap}</b></span><span class="it${sim.funds < 0 ? ' neg' : ''}" title="Funds${sim.loan ? ' (loan $' + sim.loan.toLocaleString() + ')' : ''}">${sim.funds < 0 ? '⚠ ' : ''}Funds <b>$${Math.floor(sim.funds).toLocaleString()}</b></span>`;
    if (document.getElementById('budget')!.style.display === 'block') renderBudget();
    stats.querySelector('#rci')!.innerHTML = rbar('R', sim.dR, '#3ecf4a') + rbar('C', sim.dC, '#3b8cff') + rbar('I', sim.dI, '#f2c230');
  };
  let timer = 0;
  const setSpeed = (n: number) => {
    sim.speed = n; clearInterval(timer);
    if (n > 0) timer = window.setInterval(tick, 1000 / n);
    stats.querySelectorAll('#speed button').forEach(b => b.classList.toggle('on', +(b as HTMLElement).dataset.s! === n));
  };
  let lastSpeed = 1;
  stats.querySelectorAll('#speed button').forEach(b => (b as HTMLElement).onclick = () => setSpeed(+(b as HTMLElement).dataset.s!));
  window.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); if (sim.speed) { lastSpeed = sim.speed; setSpeed(0); } else setSpeed(lastSpeed); } });
  // ---- "alive" effects (all code-drawn; toggled in the gear menu) ----
  const FX = ['clouds', 'smoke', 'pollution', 'cars', 'daynight', 'nature'] as const;
  const FXNAME: Record<string, string> = { clouds: 'Cloud shadows', smoke: 'Factory smoke', pollution: 'Pollution overlay', cars: 'Traffic', daynight: 'Day / night', nature: 'Birds & swaying trees' };
  const fx: Record<string, boolean> = { clouds: true, smoke: true, pollution: false, cars: true, daynight: true, nature: true, ...JSON.parse(localStorage.getItem('fx') ?? '{}') };
  let lastTick = performance.now();
  const covL = new Container(); world.addChildAt(covL, world.getChildIndex(gridL));
  let covView = '';
  const COVCOL: Record<string, number> = { edu: 0xffd23f, police: 0x3b6cff, fire: 0xff5a36, health: 0x3fe0c5, crime: 0xb000ff, fireRisk: 0xff8800, power: 0xffd23f, water: 0x3d8fe0 };
  const drawCoverage = () => {
    clear(covL); if (!covView) return;
    const g = new Graphics(); covL.addChild(g);
    const src: any = covView === 'power' ? powered.map(r => r.map(Number)) : covView === 'water' ? watered.map(r => r.map(Number)) : covView === 'crime' ? crime : covView === 'fireRisk' ? fireRisk : cov[covView as Kind], scale = covView === 'crime' ? 0.25 : covView === 'fireRisk' ? 0.25 : 1;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = Math.min(1, src[i][j] * scale); if (v > 0.02) { diamond(g, i, j); g.fill({ color: COVCOL[covView], alpha: 0.12 + 0.45 * v }); } }
  };
  const setCovView = (v: string) => { covView = v; (document.getElementById('covSel') as HTMLSelectElement).value = v; drawCoverage(); };
  document.getElementById('covSel')!.onchange = e => setCovView((e.target as HTMLSelectElement).value);
  const drawPollution = () => {
    clear(pollL); if (!fx.pollution) return;
    const g = new Graphics(); pollL.addChild(g);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (poll[i][j] > 0.3) { diamond(g, i, j); g.fill({ color: 0x6b4a1e, alpha: Math.min(0.55, poll[i][j] * 0.07) }); }
  };
  census(); updateStats(); setSpeed(1);
  // ---- music (real CC0 / CC-BY tracks, see CREDITS.md) + separate ambience ----
  const jazz = new Playlist(), amb = new Ambience();
  const musicBtn = document.getElementById('musicBtn')!, vol = document.getElementById('vol') as HTMLInputElement;
  const ambBtn = document.getElementById('ambBtn')!, ambVol = document.getElementById('ambVol') as HTMLInputElement;
  const credit = document.getElementById('credit')!;
  let musicOn = localStorage.getItem('music') !== 'off', ambOn = localStorage.getItem('ambience') === 'on', started = false;
  jazz.volume = vol.valueAsNumber = +(localStorage.getItem('volume') ?? 0.5);
  amb.volume = ambVol.valueAsNumber = +(localStorage.getItem('ambVolume') ?? 0.15);
  jazz.onTrack = t => { credit.innerHTML = t ? `♪ “${t.title}” — ${t.artist} · <a href="${t.url}" target="_blank" rel="noopener">${t.license}</a>` : '♪ procedural jazz (fallback)'; };
  const syncMusic = () => {
    musicBtn.classList.toggle('on', musicOn); musicBtn.title = musicOn ? 'Music on (click to mute)' : 'Music off';
    ambBtn.classList.toggle('on', ambOn); ambBtn.textContent = ambOn ? '🏙 Ambience' : '🏙 Off';
    credit.style.display = musicOn && started ? 'block' : 'none';
    if (started) { musicOn ? jazz.start() : jazz.stop(); ambOn ? amb.start() : amb.stop(); }
  };
  musicBtn.onclick = e => { e.stopPropagation(); musicOn = !musicOn; localStorage.setItem('music', musicOn ? 'on' : 'off'); started = true; syncMusic(); };
  ambBtn.onclick = e => { e.stopPropagation(); ambOn = !ambOn; localStorage.setItem('ambience', ambOn ? 'on' : 'off'); started = true; syncMusic(); };
  vol.oninput = () => { jazz.setVolume(vol.valueAsNumber); localStorage.setItem('volume', String(vol.valueAsNumber)); };
  ambVol.oninput = () => { amb.setVolume(ambVol.valueAsNumber); localStorage.setItem('ambVolume', String(ambVol.valueAsNumber)); };
  const firstGesture = () => { if (!started) { started = true; syncMusic(); } };
  window.addEventListener('pointerdown', firstGesture); window.addEventListener('keydown', firstGesture);
  syncMusic();
  (window as any).__jazz = jazz; (window as any).__amb = amb;
  // ---- missing-utility icons + underground view ----
  let underground = false;
  function drawIcons() {
    clear(iconL); const g = new Graphics(); iconL.addChild(g);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (zone[i][j] && bld[i][j] && (!powered[i][j] || !watered[i][j])) {
      const { x, y } = toScreen(i, j), yy = y - 26 - bld[i][j] * 6; let xx = x - (!powered[i][j] && !watered[i][j] ? 6 : 0);
      if (!powered[i][j]) { g.circle(xx, yy, 5).fill(0xd62828).stroke({ width: 1, color: 0xffffff }); g.poly([xx + 1, yy - 4, xx - 2, yy + 0.5, xx + 0.3, yy + 0.5, xx - 1, yy + 4, xx + 2.5, yy - 1, xx + 0.3, yy - 1]).fill(0xffe14d); xx += 12; }
      if (!watered[i][j]) { g.circle(xx, yy, 5).fill(0xd62828).stroke({ width: 1, color: 0xffffff }); g.poly([xx, yy - 3.8, xx + 2.4, yy + 0.8, xx, yy + 3, xx - 2.4, yy + 0.8]).fill(0x7cc8ff); }
    }
  }
  const ugBtn = document.getElementById('ugBtn')!;
  const setUnderground = (v: boolean) => { underground = v; ugBtn.classList.toggle('on', v);
    for (const L of [roadL, carL, zoneL, objL, smokeL, cloudL, skyL, iconL]) L.alpha = v ? 0.12 : 1;
    groundL.alpha = v ? 0.55 : 1; pipeL.visible = v; };
  ugBtn.onclick = e => { e.stopPropagation(); setUnderground(!underground); };
  window.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'u') setUnderground(!underground); });
  setUnderground(false);
  toolHook = t => { if (t === 'pipe') setUnderground(true); else if (t !== 'bulldoze' && t !== 'select' && underground) setUnderground(false); };
  // ---- Budget panel (button + B) ----
  Object.assign((window as any).__city, { tax, funding, monthly, pline, pipe, powered, watered, util, setUnderground, budget: () => ({ funds: sim.funds, loan: sim.loan, lastMonth, projection: projection() }) });
  const budgetEl = document.getElementById('budget')!;
  const money = (v: number) => (v < 0 ? '−$' : '$') + Math.abs(Math.round(v)).toLocaleString();
  const renderBudget = () => {
    const p = projection(), lm = lastMonth;
    const rows = (o: Record<string, number>, sign: string) => Object.entries(o).map(([k, v]) => `<tr><td>${k}</td><td>${sign}${money(v)}</td></tr>`).join('');
    const types = [...new Set(civs.filter(c => !SERV[c.type].util).map(c => c.type))];
    budgetEl.innerHTML = `<div class="bh"><b>Budget</b><button id="bClose">✕</button></div>
      <div>Funds <b>${money(sim.funds)}</b>${sim.loan ? ` · Loan ${money(sim.loan)} (1%/month)` : ''}${sim.funds < 0 ? ' <span class="neg">⚠ in debt</span>' : ''}</div>
      <div>Last month's net: <b class="${lm && lm.net < 0 ? 'neg' : 'pos'}">${lm ? money(lm.net) : '—'}</b> · Next month (projected): <b class="${p.net < 0 ? 'neg' : 'pos'}">${money(p.net)}</b></div>
      <h4>Taxes</h4>${(['R', 'C', 'I'] as const).map(z => `<label class="sl">${ZNAME[z]} <input type="range" min="0" max="20" step="1" value="${tax[z]}" data-tax="${z}"> <b>${tax[z]}%</b></label>`).join('')}
      <h4>Next month</h4><table>${rows(p.income, '+')}${rows(p.expense, '−')}<tr class="tot"><td>Net</td><td>${money(p.net)}</td></tr></table>
      ${types.length ? `<h4>Service funding</h4>${types.map(t => `<label class="sl">${SERV[t].name} <input type="range" min="0" max="100" step="10" value="${Math.round(funding[t] * 100)}" data-fund="${t}"> <b>${Math.round(funding[t] * 100)}%</b></label>`).join('')}` : ''}
      <h4>Loan</h4>${sim.loan ? `<button id="bRepay">Repay ${money(sim.loan)}</button>` : `<button id="bLoan">Take a ${money(LOAN)} loan (1% interest per month)</button>`}`;
    budgetEl.querySelector('#bClose')!.addEventListener('click', () => budgetEl.style.display = 'none');
    budgetEl.querySelectorAll<HTMLInputElement>('input[data-tax]').forEach(el => el.onchange = () => { tax[el.dataset.tax!] = el.valueAsNumber; census(); updateStats(); renderBudget(); });
    budgetEl.querySelectorAll<HTMLInputElement>('input[data-tax]').forEach(el => el.oninput = () => { el.nextElementSibling!.textContent = el.value + '%'; });
    budgetEl.querySelectorAll<HTMLInputElement>('input[data-fund]').forEach(el => { el.oninput = () => { el.nextElementSibling!.textContent = el.value + '%'; }; el.onchange = () => { funding[el.dataset.fund!] = el.valueAsNumber / 100; computeCoverage(); census(); updateStats(); renderBudget(); }; });
    budgetEl.querySelector('#bLoan')?.addEventListener('click', () => { sim.loan = LOAN; sim.funds += LOAN; updateStats(); renderBudget(); });
    budgetEl.querySelector('#bRepay')?.addEventListener('click', () => { if (sim.funds < sim.loan) { toast('Not enough funds to repay the loan yet'); return; } sim.funds -= sim.loan; sim.loan = 0; updateStats(); renderBudget(); });
  };
  budgetEl.addEventListener('pointerdown', e => e.stopPropagation());
  const toggleBudget = () => { budgetEl.style.display = budgetEl.style.display === 'block' ? 'none' : 'block'; if (budgetEl.style.display === 'block') renderBudget(); };
  document.getElementById('budgetBtn')!.onclick = e => { e.stopPropagation(); toggleBudget(); };
  window.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'b' && !(e.target instanceof HTMLInputElement)) toggleBudget(); });
  // info panel
  const info = document.getElementById('info')!;
  const inspect = ({ i, j }: { i: number; j: number }) => {
    if (inb(i, j) && consT[i][j]) { info.innerHTML = `<b>${ZNAME[zone[i][j]]} — under construction</b><br>Building: ${DNAME[consT[i][j]]}<br>Stage ${Math.min(3, 1 + Math.floor(consD[i][j] / CONS_DAYS))} of 3<br><small>Tile ${i}, ${j}</small>`; info.style.display = 'block'; return; }
    const pct = (v: number) => Math.round(v * 100) + '%';
    if (inb(i, j) && civAt[i][j]) { const c = civAt[i][j]!, S = SERV[c.type], ci = c.i + (c.s - 1) / 2, cj = c.j + (c.s - 1) / 2;
      let served = 0; for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) if (zone[a][b] === 'R' && bld[a][b] && Math.hypot(a - ci, b - cj) <= S.radius) served += resCap(a, b);
      info.innerHTML = S.util ? `<b>${S.name}</b><br>Size ${S.size}×${S.size} · Cost $${S.cost} · Upkeep $${UPKEEP[c.type]}/month<br>Output: <b>${S.out}</b> ${S.kind === 'power' ? '⚡' : '💧'}<br>City ${S.kind === 'power' ? `power: ${util.pUse}/${util.pCap} (demand ${util.pWant})` : `water: ${util.wUse}/${util.wCap} (demand ${util.wWant})`}<br>` : `<b>${S.name}</b><br>Size ${S.size}×${S.size} · Cost $${S.cost}<br>Coverage radius: ${S.radius} tiles<br>Residents covered: <b>${served}</b><br>Power ${powered[i][j] ? '✔' : '✘'} · Water ${watered[i][j] ? '✔' : '✘'}<br><small>Tile ${c.i}, ${c.j}</small>`; info.style.display = 'block'; return; }
    if (!inb(i, j) || !bld[i][j]) { info.style.display = 'none'; return; }
    const z = zone[i][j], v = z === 'R' ? resCap(i, j) : CAP[z][bld[i][j]];
    info.innerHTML = `<b>${ZNAME[z]} building</b><br>${DNAME[bld[i][j]]} (level ${bld[i][j]})<br>${z === 'R' ? 'Residents' : 'Jobs'}: <b>${v}</b><br>Education ${pct(cov.edu[i][j])} · Health ${pct(cov.health[i][j])}<br>Police ${pct(cov.police[i][j])} · Fire ${pct(cov.fire[i][j])}<br>Crime: ${crime[i][j] < 1.5 ? 'low' : crime[i][j] < 3.5 ? 'medium' : 'high'} · Fire risk: ${fireRisk[i][j] < 1 ? 'low' : fireRisk[i][j] < 3 ? 'medium' : 'high'}<br>Power ${powered[i][j] ? '✔' : '✘ none'} · Water ${watered[i][j] ? '✔' : '✘ none'}${powered[i][j] && watered[i][j] ? '' : ' (stays low density)'}<br>Pollution: ${poll[i][j] < 0.5 ? 'none' : poll[i][j] < 3 ? 'low' : poll[i][j] < 6 ? 'medium' : 'high'}<br><small>Tile ${i}, ${j}</small>`;
    info.style.display = 'block';
  };

  // pointers: drag pan + pinch zoom
  const ptrs = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;
  const c = app.canvas;
  c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); if (ptrs.size === 0) downAt = { x: e.clientX, y: e.clientY };
    if (tool !== 'select' && ptrs.size === 0 && e.button === 0) { const t = tileAt(e.clientX, e.clientY); drag = { i: t.i, j: t.j, ci: t.i, cj: t.j }; showPreview(); }
    else if (drag) { drag = null; preview.clear(); } // second finger cancels build -> pinch
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinchDist = Math.hypot(a.x - b.x, a.y - b.y); } });
  c.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') mouse = { x: e.clientX, y: e.clientY };
    const p = ptrs.get(e.pointerId);
    if (p) {
      if (drag) { const t = tileAt(e.clientX, e.clientY); if (t.i !== drag.ci || t.j !== drag.cj) { drag.ci = t.i; drag.cj = t.j; showPreview(); } }
      else if (ptrs.size === 1 && tool === 'select') { camX -= (e.clientX - p.x) / zoom; camY -= (e.clientY - p.y) / zoom; }
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, zoom * d / pinchDist);
        pinchDist = d;
      }
    }
  });
  const up = (e: PointerEvent) => { if (e.type === 'pointerup' && tool === 'select' && ptrs.size === 1 && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) inspect(tileAt(e.clientX, e.clientY)); if (drag && e.type === 'pointerup') commit(); else if (drag) { drag = null; preview.clear(); } ptrs.delete(e.pointerId); pinchDist = 0; if (e.pointerType !== 'mouse') mouse = { x: e.clientX, y: e.clientY }; };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  c.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') mouse = null; });
  c.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, zoom * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  window.addEventListener('keydown', e => keys.add(e.key.toLowerCase()));
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  const dot = (() => { const g = new Graphics().circle(16, 16, 16).fill(0xffffff); const t = app.renderer.generateTexture(g); g.destroy(); return t; })();
  const cloudTex = (() => { const g = new Graphics(); for (let k = 10; k >= 1; k--) g.ellipse(160, 80, 16 * k, 8 * k).fill({ color: 0x000000, alpha: 0.03 }); const t = app.renderer.generateTexture(g); g.destroy(); return t; })();
  const W0 = toScreen(0, N - 1).x - TW, W1 = toScreen(N - 1, 0).x + TW, H1 = toScreen(N - 1, N - 1).y + TH;
  const clouds = [...Array(7)].map((_, k) => { const s = new Sprite(cloudTex); s.anchor.set(0.5); s.scale.set(1.5 + (k % 3) * 0.8, 1.2 + (k % 2) * 0.6); s.position.set(W0 + (W1 - W0) * k / 7, H1 * ((k * 37) % 100) / 100); cloudL.addChild(s); return s; });
  type P = { s: Sprite; vx: number; vy: number; life: number; max: number };
  const smoke: P[] = []; let smokeAcc = 0;
  const CAR_COLORS = [0xd94040, 0xf0f0f0, 0x3a6fd8, 0xf2c230, 0x333333, 0x40a060];
  const LANE: Record<string, [number, number]> = { NE: [4.8, 2.4], SE: [-4.8, 2.4], SW: [-4.8, -2.4], NW: [4.8, -2.4] }; // right-hand lanes
  const VEH: Record<string, string[]> = { sedan: ['a', 'b', 'c'], hatchback: ['a', 'b', 'c'], pickup: ['a', 'b', 'c'], van: ['a', 'b', 'c'], taxi: ['a'], bus: ['a'], delivery_truck: ['a', 'b'], semi: ['a', 'b'] };
  const pickVehicle = (i: number, j: number) => { // weight by what is around: trucks near industry/commerce, taxis downtown, buses now and then
    let nI = 0, nC = 0, nR = 0; for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (inb(i + a, j + b) && bld[i + a][j + b]) { const z = zone[i + a][j + b]; if (z === 'I') nI++; else if (z === 'C') nC++; else nR++; }
    const tot = nI + nC + nR || 1, fI = nI / tot, fC = nC / tot;
    const w: [string, number][] = [['sedan', 30], ['hatchback', 22], ['pickup', 12 + 10 * fI], ['van', 8 + 6 * fC], ['taxi', 2 + 12 * fC], ['bus', 3], ['delivery_truck', 2 + 14 * fC + 8 * fI], ['semi', 1 + 30 * fI]];
    let r = Math.random() * w.reduce((t, x) => t + x[1], 0), t = w[0][0]; for (const [k, v] of w) { if ((r -= v) < 0) { t = k; break; } }
    const vs = VEH[t]; return `veh_${t}_${vs[Math.floor(Math.random() * vs.length)]}`;
  };
  const dropCar = (k: number) => { const c = cars[k]; c.s.destroy(); c.n?.destroy(); cars.splice(k, 1); };
  const roadNbrs = (i: number, j: number) => ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const).map(([a, b]) => [i + a, j + b]).filter(([a, b]) => isRoad(a, b));
  const activity = (i: number, j: number) => { let v = 0; for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (inb(i + a, j + b) && bld[i + a][j + b]) v += CAP[zone[i + a][j + b]][bld[i + a][j + b]]; return v; };
  const roadList = () => { const r: [number, number][] = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (road[i][j]) r.push([i, j]); return r; };
  const water: [number, number][] = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (terrain[i][j] === 'water' && shoreMask(i, j) === 0) water.push([i, j]);
  const flocks = [...Array(Math.min(4, water.length))].map((_, k) => {
    const [i, j] = water[Math.floor(water.length * (k + 0.5) / 4)]; const c = toScreen(i, j);
    const birds = [...Array(4)].map(() => { const g = new Graphics().moveTo(-4, -1).lineTo(0, 1).lineTo(4, -1).stroke({ width: 1.2, color: 0x222222 }); skyL.addChild(g); return g; });
    return { cx: c.x, cy: c.y - 40, r: 40 + k * 15, ph: k * 1.7, birds };
  });
  const setFxVisibility = () => { cloudL.visible = fx.clouds; skyL.visible = fx.nature; smokeL.visible = fx.smoke; if (!fx.daynight) { nightG.clear(); applyNight(0); app.renderer.background.color = 0x1b2430; } drawPollution(); };
  const menu = document.getElementById('fxMenu')!;
  menu.addEventListener('pointerdown', e => e.stopPropagation());
  document.getElementById('fxList')!.innerHTML = FX.map(k => `<label><input type="checkbox" data-k="${k}" ${fx[k] ? 'checked' : ''}> ${FXNAME[k]}</label>`).join('');
  menu.querySelectorAll<HTMLInputElement>('#fxList input').forEach(el => el.onchange = () => { fx[el.dataset.k!] = el.checked; localStorage.setItem('fx', JSON.stringify(fx)); setFxVisibility(); });
  document.getElementById('fxBtn')!.onclick = e => { e.stopPropagation(); menu.style.display = menu.style.display === 'block' ? 'none' : 'block'; };
  setFxVisibility();
  let clock = 0;
  let night = 0;
  const applyNight = (n: number) => { // tint objects to match the shading; lights fade in additively
    if (Math.abs(n - lastNightTint) < 0.01) return; lastNightTint = n;
    const r = Math.round(255 * (1 - 0.48 * n)), g = Math.round(255 * (1 - 0.46 * n)), b = Math.round(255 * (1 - 0.36 * n)), tint = (r << 16) | (g << 8) | b;
    const isLight = new Set<unknown>(lights); curTint = tint; for (const c of cars) if (c.n) isLight.add(c.n);
    for (const c of objL.children) if (!isLight.has(c)) (c as Sprite).tint = tint;
    for (const l of lights) l.alpha = n;
    smokeL.alpha = 1 - 0.5 * n;
  };
  app.ticker.add(t => {
    const dt = t.deltaMS / 1000; clock += dt;
    // day/night: one full cycle every 24 game-days, smoothed between ticks
    const frac = sim.speed ? Math.min(1, (performance.now() - lastTick) * sim.speed / 1000) : 0;
    const hour = (((sim.day + frac) % 24) + 24) % 24;
    night = fx.daynight ? Math.max(0, Math.min(1, Math.cos(2 * Math.PI * hour / 24) * 1.3 + 0.15)) : 0;
    const tod = document.getElementById('tod'); if (tod) tod.textContent = (night > 0.5 ? '🌙 ' : '☀️ ') + String(Math.floor(hour)).padStart(2, '0') + ':00';
    if (fx.daynight) {
      nightG.clear().rect(W0 - 2000, -2000, W1 - W0 + 4000, H1 + 4000).fill({ color: 0x0a1030, alpha: night * 0.5 });
      applyNight(night);
      app.renderer.background.color = night > 0.5 ? 0x0d1220 : 0x1b2430;
    }
    if (fx.clouds) for (const c of clouds) { c.x += 12 * dt; c.y += 3 * dt; if (c.x > W1 + 300) { c.x = W0 - 300; c.y = Math.random() * H1; } }
    if (fx.nature) {
      for (const tr of trees) tr.s.skew.x = Math.sin(clock * 1.3 + tr.ph) * 0.03;
      for (const f of flocks) f.birds.forEach((b, k) => { const a = clock * 0.4 + f.ph + k * 0.25; b.position.set(f.cx + Math.cos(a) * f.r + k * 6, f.cy + Math.sin(a) * f.r * 0.5 - k * 3); b.scale.y = 0.6 + Math.abs(Math.sin(clock * 8 + k)) * 0.8; });
    }
    for (const f of flocks) for (const b of f.birds) b.visible = fx.nature;
    if (fx.smoke) {
      smokeAcc += dt;
      if (smokeAcc > 0.12) { smokeAcc = 0;
        for (const b of blds) if (b.z === 'I' && smoke.length < 260 && Math.random() < 0.12 * b.L) {
          const s = new Sprite(dot); s.anchor.set(0.5); s.tint = 0xcfcac2; s.alpha = 0.5; s.scale.set(0.12);
          s.position.set(b.x + 10 + (b.seed % 7) - 3, b.y - 22 - b.L * 6); smokeL.addChild(s);
          smoke.push({ s, vx: 4 + Math.random() * 4, vy: -10 - Math.random() * 6, life: 0, max: 3 + Math.random() * 2 });
        } }
    }
    for (let k = smoke.length - 1; k >= 0; k--) { const p = smoke[k]; p.life += dt;
      if (p.life > p.max || !fx.smoke) { p.s.destroy(); smoke.splice(k, 1); continue; }
      p.s.x += p.vx * dt; p.s.y += p.vy * dt; p.s.scale.set(0.12 + p.life * 0.12); p.s.alpha = 0.5 * (1 - p.life / p.max); }
    if (fx.cars) {
      const roadCount = road.flat().filter(Boolean).length;
      const target = Math.min(70, Math.floor((sim.pop + sim.jobsC + sim.jobsI) / 30), Math.floor(roadCount * 0.45));
      if (cars.length < target && Math.random() < 0.3) {
        const rl = roadList();
        if (rl.length > 1) { const [i, j] = rl[Math.floor(Math.random() * rl.length)];
          if (Math.random() < Math.min(1, activity(i, j) / 150 + 0.05)) { const nb = roadNbrs(i, j);
            if (nb.length) { const key = pickVehicle(i, j), big = /semi|bus|truck/.test(key);
              const c: Car = { s: new Graphics(), key, pi: i, pj: j, i: nb[0][0], j: nb[0][1], t: Math.random(), sp: (big ? 0.9 : 1.2) + Math.random() * 0.6, dir: '' };
              if (!hasArt(key + '_NE')) { const g = new Graphics().roundRect(-3.5, -2, 7, 4, 1.2).fill(CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]); (g as any).__veh = true; objL.addChild(g); c.s = g; }
              cars.push(c); } } }
      } else if (cars.length > target + 5) { dropCar(cars.length - 1); }
    }
    for (let k = cars.length - 1; k >= 0; k--) { const c = cars[k];
      if (!isRoad(c.i, c.j) || !isRoad(c.pi, c.pj) || !fx.cars) { dropCar(k); continue; }
      if (sim.speed) c.t += dt * c.sp;
      if (c.t >= 1) { const nb = roadNbrs(c.i, c.j).filter(([a, b]) => a !== c.pi || b !== c.pj); const nx = nb.length ? nb[Math.floor(Math.random() * nb.length)] : [c.pi, c.pj];
        c.pi = c.i; c.pj = c.j; c.i = nx[0]; c.j = nx[1]; c.t = 0; }
      const a = toScreen(c.pi, c.pj), b = toScreen(c.i, c.j), dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
      const di = c.i - c.pi, dir = di > 0 ? 'SE' : di < 0 ? 'NW' : c.j < c.pj ? 'NE' : 'SW';
      if (c.s instanceof Graphics && !hasArt(c.key + '_NE')) { const ox = -dy / L * 5, oy = dx / L * 5; c.s.position.set(a.x + dx * c.t + ox, a.y + dy * c.t + oy); c.s.rotation = Math.atan2(dy, dx); }
      else {
        if (dir !== c.dir) { // swap to the sprite facing the new direction
          c.dir = dir; c.s.destroy(); c.n?.destroy();
          c.s = place(c.key + '_' + dir, 0, 0, objL); (c.s as any).__veh = true; (c.s as Sprite).tint = curTint;
          c.n = placeNight(c.key + '_' + dir, 0, 0, objL); if (c.n) (c.n as any).__veh = true;
        }
        const [lx, ly] = LANE[dir], x = a.x + dx * c.t + lx, y = a.y + dy * c.t + ly;
        c.s.position.set(x, y); c.s.zIndex = y + 1; // depth: same key as buildings (screen y)
        if (c.n) { c.n.position.set(x, y); c.n.zIndex = y + 1.01; c.n.alpha = night; }
      }
    }
  });
  (window as any).__fx = { fx, cars, smoke, setDay: (d: number) => { sim.day = d; lastTick = performance.now(); } };
  app.ticker.add(t => {
    const sp = 600 * (t.deltaMS / 1000) / zoom;
    if (keys.has('a') || keys.has('arrowleft')) camX -= sp;
    if (keys.has('d') || keys.has('arrowright')) camX += sp;
    if (keys.has('w') || keys.has('arrowup')) camY -= sp;
    if (keys.has('s') || keys.has('arrowdown')) camY += sp;
    if (keys.has('q') || keys.has('-')) zoomAt(app.screen.width / 2, app.screen.height / 2, zoom * (1 - t.deltaMS / 1000));
    if (keys.has('e') || keys.has('=')) zoomAt(app.screen.width / 2, app.screen.height / 2, zoom * (1 + t.deltaMS / 1000));
    apply(); updateHover();
  });
})();
