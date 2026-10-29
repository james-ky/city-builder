import { Jazz } from './music';
import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { loadManifest, place, hasArt } from './sprites';

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
  const pollL = new Container(), carL = new Container(), cloudL = new Container(), nightG = new Graphics(), lightsG = new Graphics(), skyL = new Container();
  world.addChild(groundL, roadL, carL, zoneL, pollL, gridL, objL, cloudL, nightG, lightsG, skyL);
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
  const redraw = () => {
    clear(roadL); clear(zoneL); clear(objL); trees.length = 0; blds.length = 0;
    computeNear();
    for (let s = 0; s < 2 * N - 1; s++) for (let i = 0; i < N; i++) { const j = s - i; if (j < 0 || j >= N) continue;
      const { x, y } = toScreen(i, j), seed = seedOf(i, j);
      if (road[i][j]) {
        const m = (isRoad(i, j - 1) ? 1 : 0) | (isRoad(i + 1, j) ? 2 : 0) | (isRoad(i, j + 1) ? 4 : 0) | (isRoad(i - 1, j) ? 8 : 0);
        place('road_' + (m || (hasArt('road_0') ? 0 : 1)), x, y, roadL, seed);
      } else if (zone[i][j]) {
        if (!bld[i][j] && !consT[i][j]) place('zone_' + zone[i][j], x, y, zoneL, seed);
        if (consT[i][j]) place(`construction_1x1_${isTall(zone[i][j], consT[i][j]) ? 'tall_' : ''}stage${Math.min(3, 1 + Math.floor(consD[i][j] / CONS_DAYS))}`, x, y, objL, seed);
        else if (bld[i][j]) { place(`bld_${zone[i][j]}_${bld[i][j]}`, x, y, objL, seed); blds.push({ x, y, z: zone[i][j], L: bld[i][j], seed }); }
      } else if (terrain[i][j] === 'forest') trees.push({ s: place('forest', x, y, objL, seed), ph: (seed % 628) / 100 });
    }
  };
  redraw();
  const preview = new Graphics(), hl = new Graphics();
  world.addChild(preview, hl);

  // ---- tools ----
  type Tool = 'select' | 'road' | 'R' | 'C' | 'I' | 'bulldoze';
  const tools: [Tool, string][] = [['select','Select / Pan'],['road','Road'],['R','Residential'],['C','Commercial'],['I','Industrial'],['bulldoze','Bulldoze']];
  const bar = document.getElementById('toolbar')!;
  const setTool = (t: Tool) => { tool = t; syncZones(); bar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); };
  tools.forEach(([t, label], k) => { const b = document.createElement('button'); b.dataset.t = t; b.innerHTML = `<b>${k+1}</b> ${label}`; b.onclick = () => setTool(t); bar.appendChild(b); });
  setTool('select');
  window.addEventListener('keydown', e => { const k = +e.key; if (k >= 1 && k <= 6) setTool(tools[k-1][0]); if (e.key === 'Escape') { drag = null; preview.clear(); } });

  let drag: { i: number; j: number; ci: number; cj: number } | null = null;
  const dragTiles = (): [number, number][] => {
    if (!drag) return [];
    const out: [number, number][] = [];
    if (tool === 'road') {
      const di = drag.ci - drag.i, dj = drag.cj - drag.j;
      if (Math.abs(di) >= Math.abs(dj)) for (let k = 0; k <= Math.abs(di); k++) out.push([drag.i + Math.sign(di) * k, drag.j]);
      else for (let k = 0; k <= Math.abs(dj); k++) out.push([drag.i, drag.j + Math.sign(dj) * k]);
    } else {
      for (let i = Math.min(drag.i, drag.ci); i <= Math.max(drag.i, drag.ci); i++)
        for (let j = Math.min(drag.j, drag.cj); j <= Math.max(drag.j, drag.cj); j++) out.push([i, j]);
    }
    return out.filter(([i, j]) => inb(i, j));
  };
  const valid = (i: number, j: number) => {
    if (tool === 'road') return terrain[i][j] !== 'water';
    if (tool === 'bulldoze') return road[i][j] || !!zone[i][j] || bld[i][j] > 0 || consT[i][j] > 0;
    return terrain[i][j] !== 'water' && !road[i][j] && near[i][j] <= 3;
  };
  const showPreview = () => {
    preview.clear();
    const col = tool === 'road' ? 0x9aa0a6 : tool === 'bulldoze' ? 0xff8800 : ({R:0x3ecf4a,C:0x3b8cff,I:0xf2c230} as any)[tool];
    for (const [i, j] of dragTiles()) { diamond(preview, i, j); preview.fill({ color: valid(i, j) ? col : 0xff2020, alpha: 0.55 }); }
  };
  const commit = () => {
    for (const [i, j] of dragTiles()) { if (!valid(i, j)) continue;
      if (tool === 'road') { road[i][j] = true; zone[i][j] = ''; bld[i][j] = 0; consT[i][j] = 0; }
      else if (tool === 'bulldoze') { road[i][j] = false; zone[i][j] = ''; bld[i][j] = 0; consT[i][j] = 0; }
      else { if (zone[i][j] !== tool) { bld[i][j] = 0; consT[i][j] = 0; } zone[i][j] = tool; } }
    drag = null; preview.clear(); redraw();
  };
  const tileAt = (sx: number, sy: number) => toTile((sx - world.position.x) / zoom, (sy - world.position.y) / zoom);
  (window as any).__city = { tileToScreen: (i: number, j: number) => { const p = toScreen(i, j); return { x: p.x * zoom + world.position.x, y: p.y * zoom + world.position.y }; }, road, zone, bld, consT, terrain, setTool, sim: () => sim, setSpeed: (n: number) => setSpeed(n), fastForward: (n: number) => { for (let k = 0; k < n; k++) tick(); }, centerOn: (i: number, j: number) => { const p = toScreen(i, j); camX = p.x; camY = p.y; } };

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
    diamond(hl, i, j); hl.fill({ color: 0xffffff, alpha: 0.25 }).stroke({ width: 2 / zoom, color: 0xffff66 });
    hud.textContent = `Tile: ${i}, ${j}  (${road[i][j] ? 'road' : zone[i][j] ? ZNAME[zone[i][j]] + (bld[i][j] ? ' · ' + DNAME[bld[i][j]] + ' building' : ' zone') : terrain[i][j]})`;
  };

  // ---- simulation ----
  const ZNAME: Record<string, string> = { R: 'Residential', C: 'Commercial', I: 'Industrial' };
  const DNAME = ['', 'Low density', 'Medium density', 'High density'];
  const CAP: Record<string, number[]> = { R: [0, 12, 45, 140], C: [0, 6, 22, 70], I: [0, 10, 32, 90] };
  const sim = { day: 0, speed: 1, pop: 0, jobsC: 0, jobsI: 0, dR: 0, dC: 0, dI: 0 };
  let downAt: { x: number; y: number } | null = null;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const poll: number[][] = [...Array(N)].map(() => Array(N).fill(0));
  const computePollution = () => { // spreads up to 5 tiles from industry, stronger for higher tiers
    for (const row of poll) row.fill(0);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (zone[i][j] === 'I' && bld[i][j]) {
      const L = bld[i][j];
      for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) { const d = Math.hypot(a, b); if (d <= 5 && inb(i + a, j + b)) poll[i + a][j + b] += L * (1 - d / 6); }
    }
  };
  const census = () => {
    computePollution(); drawPollution();
    sim.pop = sim.jobsC = sim.jobsI = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (bld[i][j]) {
      const v = CAP[zone[i][j]][bld[i][j]];
      if (zone[i][j] === 'R') sim.pop += v; else if (zone[i][j] === 'C') sim.jobsC += v; else sim.jobsI += v;
    }
    const jobs = sim.jobsC + sim.jobsI, workers = sim.pop * 0.6;
    sim.dR = clamp((jobs * 1.6 + 60 - sim.pop) / Math.max(60, sim.pop * 0.4));      // people come for jobs
    sim.dC = clamp((sim.pop * 0.35 + 10 - sim.jobsC) / Math.max(15, sim.pop * 0.12));  // shops follow residents
    sim.dI = clamp((60 + sim.day * 0.4 + workers * 0.6 - sim.jobsI) / Math.max(30, sim.jobsI * 0.4)); // outside demand + workforce
  };
  const tick = () => {
    lastTick = performance.now(); sim.day++; let changed = false;
    const d: Record<string, number> = { R: sim.dR, C: sim.dC, I: sim.dI };
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const z = zone[i][j]; if (!z) continue;
      if (consT[i][j]) { // advance construction
        consD[i][j]++;
        if (consD[i][j] >= CONS_DAYS * 3) { bld[i][j] = consT[i][j]; consT[i][j] = 0; changed = true; }
        else if (consD[i][j] % CONS_DAYS === 0) changed = true;
        continue;
      }
      const dem = d[z] - (z === 'R' ? Math.min(0.4, poll[i][j] * 0.04) : 0), L = bld[i][j]; // pollution slightly discourages housing
      if (near[i][j] > 3) { if (L && Math.random() < 0.05) { bld[i][j]--; changed = true; } continue; } // lost road access
      const before = bld[i][j];
      if (dem > 0 && L < 3) {
        const need = [0, 0, 0.15, 0.3][L + 1]; // higher density needs sustained strong demand
        if (dem > need && Math.random() < (L === 0 ? 0.06 : 0.02) * dem) { consT[i][j] = L + 1; consD[i][j] = 0; changed = true; }
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
    stats.querySelector('#nums')!.innerHTML = `<b>${dateStr()}</b> <span id="tod"></span> · Population <b>${sim.pop.toLocaleString()}</b> · Jobs <b>${(sim.jobsC + sim.jobsI).toLocaleString()}</b> <small>(C ${sim.jobsC} / I ${sim.jobsI})</small>`;
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
  const FX = ['clouds', 'smoke', 'pollution', 'cars', 'daynight', 'nature', 'ambient'] as const;
  const FXNAME: Record<string, string> = { clouds: 'Cloud shadows', smoke: 'Factory smoke', pollution: 'Pollution overlay', cars: 'Traffic', daynight: 'Day / night', nature: 'Birds & swaying trees', ambient: 'City ambience (with music)' };
  const fx: Record<string, boolean> = { clouds: true, smoke: true, pollution: false, cars: true, daynight: true, nature: true, ambient: true, ...JSON.parse(localStorage.getItem('fx') ?? '{}') };
  let lastTick = performance.now();
  const drawPollution = () => {
    clear(pollL); if (!fx.pollution) return;
    const g = new Graphics(); pollL.addChild(g);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (poll[i][j] > 0.3) { diamond(g, i, j); g.fill({ color: 0x6b4a1e, alpha: Math.min(0.55, poll[i][j] * 0.07) }); }
  };
  census(); updateStats(); setSpeed(1);
  // ---- music (procedural, original) ----
  const jazz = new Jazz();
  const musicBtn = document.getElementById('musicBtn')!, vol = document.getElementById('vol') as HTMLInputElement;
  let musicOn = localStorage.getItem('music') !== 'off', started = false;
  jazz.volume = vol.valueAsNumber = +(localStorage.getItem('volume') ?? 0.5);
  const syncMusic = () => { musicBtn.classList.toggle('on', musicOn); musicBtn.textContent = musicOn ? '♪ Music' : '♪ Off'; if (started) musicOn ? jazz.start() : jazz.stop(); };
  musicBtn.onclick = e => { e.stopPropagation(); musicOn = !musicOn; localStorage.setItem('music', musicOn ? 'on' : 'off'); started = true; syncMusic(); };
  vol.oninput = () => { jazz.setVolume(vol.valueAsNumber); localStorage.setItem('volume', String(vol.valueAsNumber)); };
  const firstGesture = () => { if (!started) { started = true; syncMusic(); } };
  window.addEventListener('pointerdown', firstGesture); window.addEventListener('keydown', firstGesture);
  syncMusic();
  (window as any).__jazz = jazz;
  // info panel
  const info = document.getElementById('info')!;
  const inspect = ({ i, j }: { i: number; j: number }) => {
    if (inb(i, j) && consT[i][j]) { info.innerHTML = `<b>${ZNAME[zone[i][j]]} — under construction</b><br>Building: ${DNAME[consT[i][j]]}<br>Stage ${Math.min(3, 1 + Math.floor(consD[i][j] / CONS_DAYS))} of 3<br><small>Tile ${i}, ${j}</small>`; info.style.display = 'block'; return; }
    if (!inb(i, j) || !bld[i][j]) { info.style.display = 'none'; return; }
    const z = zone[i][j], v = CAP[z][bld[i][j]];
    info.innerHTML = `<b>${ZNAME[z]} building</b><br>${DNAME[bld[i][j]]} (level ${bld[i][j]})<br>${z === 'R' ? 'Residents' : 'Jobs'}: <b>${v}</b><br>Pollution: ${poll[i][j] < 0.5 ? 'none' : poll[i][j] < 3 ? 'low' : poll[i][j] < 6 ? 'medium' : 'high'}<br><small>Tile ${i}, ${j}</small>`;
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
  type Car = { s: Graphics; i: number; j: number; pi: number; pj: number; t: number; sp: number };
  const cars: Car[] = [];
  const CAR_COLORS = [0xd94040, 0xf0f0f0, 0x3a6fd8, 0xf2c230, 0x333333, 0x40a060];
  const roadNbrs = (i: number, j: number) => ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const).map(([a, b]) => [i + a, j + b]).filter(([a, b]) => isRoad(a, b));
  const activity = (i: number, j: number) => { let v = 0; for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (inb(i + a, j + b) && bld[i + a][j + b]) v += CAP[zone[i + a][j + b]][bld[i + a][j + b]]; return v; };
  const roadList = () => { const r: [number, number][] = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (road[i][j]) r.push([i, j]); return r; };
  const water: [number, number][] = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (terrain[i][j] === 'water' && shoreMask(i, j) === 0) water.push([i, j]);
  const flocks = [...Array(Math.min(4, water.length))].map((_, k) => {
    const [i, j] = water[Math.floor(water.length * (k + 0.5) / 4)]; const c = toScreen(i, j);
    const birds = [...Array(4)].map(() => { const g = new Graphics().moveTo(-4, -1).lineTo(0, 1).lineTo(4, -1).stroke({ width: 1.2, color: 0x222222 }); skyL.addChild(g); return g; });
    return { cx: c.x, cy: c.y - 40, r: 40 + k * 15, ph: k * 1.7, birds };
  });
  const setFxVisibility = () => { cloudL.visible = fx.clouds; carL.visible = fx.cars; skyL.visible = fx.nature || fx.smoke; if (!fx.daynight) { nightG.clear(); lightsG.alpha = 0; app.renderer.background.color = 0x1b2430; } drawPollution(); jazz.setAmbient(fx.ambient); };
  const menu = document.getElementById('fxMenu')!;
  menu.innerHTML = FX.map(k => `<label><input type="checkbox" data-k="${k}" ${fx[k] ? 'checked' : ''}> ${FXNAME[k]}</label>`).join('');
  menu.querySelectorAll('input').forEach(el => el.onchange = () => { fx[el.dataset.k!] = el.checked; localStorage.setItem('fx', JSON.stringify(fx)); setFxVisibility(); });
  document.getElementById('fxBtn')!.onclick = e => { e.stopPropagation(); menu.style.display = menu.style.display === 'block' ? 'none' : 'block'; };
  setFxVisibility();
  let clock = 0, lastLights = '';
  const drawLights = () => {
    lightsG.clear();
    for (const b of blds) {
      const H = b.L === 3 ? (b.z === 'I' ? 26 : 70) : b.L === 2 ? 34 : 18;
      const n = 2 + b.L * 3;
      for (let k = 0; k < n; k++) { const r1 = ((b.seed >>> (k * 3)) & 1023) / 1023, r2 = ((b.seed >>> (k * 2 + 5)) & 1023) / 1023;
        if (r2 < 0.3) continue;
        const side = k % 2 ? 1 : -1, ox = side * (4 + r1 * 14), oy = -6 - r2 * (H - 8);
        lightsG.rect(b.x + ox, b.y + oy, 2.5, 3).fill(0xffe28a); }
    }
  };
  let night = 0;
  app.ticker.add(t => {
    const dt = t.deltaMS / 1000; clock += dt;
    // day/night: one full cycle every 24 game-days, smoothed between ticks
    const frac = sim.speed ? Math.min(1, (performance.now() - lastTick) * sim.speed / 1000) : 0;
    const hour = (((sim.day + frac) % 24) + 24) % 24;
    night = fx.daynight ? Math.max(0, Math.min(1, Math.cos(2 * Math.PI * hour / 24) * 1.3 + 0.15)) : 0;
    const tod = document.getElementById('tod'); if (tod) tod.textContent = (night > 0.5 ? '🌙 ' : '☀️ ') + String(Math.floor(hour)).padStart(2, '0') + ':00';
    if (fx.daynight) {
      nightG.clear().rect(W0 - 2000, -2000, W1 - W0 + 4000, H1 + 4000).fill({ color: 0x0a1030, alpha: night * 0.5 });
      const sig = blds.length + ':' + sim.pop; if (sig !== lastLights) { drawLights(); lastLights = sig; }
      lightsG.alpha = night;
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
          s.position.set(b.x + 10 + (b.seed % 7) - 3, b.y - 22 - b.L * 6); skyL.addChild(s);
          smoke.push({ s, vx: 4 + Math.random() * 4, vy: -10 - Math.random() * 6, life: 0, max: 3 + Math.random() * 2 });
        } }
    }
    for (let k = smoke.length - 1; k >= 0; k--) { const p = smoke[k]; p.life += dt;
      if (p.life > p.max || !fx.smoke) { p.s.destroy(); smoke.splice(k, 1); continue; }
      p.s.x += p.vx * dt; p.s.y += p.vy * dt; p.s.scale.set(0.12 + p.life * 0.12); p.s.alpha = 0.5 * (1 - p.life / p.max); }
    if (fx.cars) {
      const target = Math.min(90, Math.floor((sim.pop + sim.jobsC + sim.jobsI) / 18));
      if (cars.length < target && Math.random() < 0.3) {
        const rl = roadList();
        if (rl.length > 1) { const [i, j] = rl[Math.floor(Math.random() * rl.length)];
          if (Math.random() < Math.min(1, activity(i, j) / 150 + 0.05)) { const nb = roadNbrs(i, j);
            if (nb.length) { const s = new Graphics().roundRect(-3.5, -2, 7, 4, 1.2).fill(CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]); carL.addChild(s);
              cars.push({ s, pi: i, pj: j, i: nb[0][0], j: nb[0][1], t: Math.random(), sp: 1.2 + Math.random() * 0.6 }); } } }
      } else if (cars.length > target + 5) { cars.pop()!.s.destroy(); }
    }
    for (let k = cars.length - 1; k >= 0; k--) { const c = cars[k];
      if (!isRoad(c.i, c.j) || !isRoad(c.pi, c.pj)) { c.s.destroy(); cars.splice(k, 1); continue; }
      if (sim.speed) c.t += dt * c.sp;
      if (c.t >= 1) { const nb = roadNbrs(c.i, c.j).filter(([a, b]) => a !== c.pi || b !== c.pj); const nx = nb.length ? nb[Math.floor(Math.random() * nb.length)] : [c.pi, c.pj];
        c.pi = c.i; c.pj = c.j; c.i = nx[0]; c.j = nx[1]; c.t = 0; }
      const a = toScreen(c.pi, c.pj), b = toScreen(c.i, c.j), dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
      const ox = -dy / L * 5, oy = dx / L * 5; // keep right
      c.s.position.set(a.x + dx * c.t + ox, a.y + dy * c.t + oy); c.s.rotation = Math.atan2(dy, dx);
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
