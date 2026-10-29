import { Application, Container, Graphics } from 'pixi.js';
import { loadManifest, drawSprite } from './sprites';

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

  const ground = new Graphics();
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const t = terrain[i][j], c = colors[t];
    diamond(ground, i, j);
    ground.fill(c[(i * 7 + j * 13) % c.length]).stroke({ width: 1, color: 0x000000, alpha: 0.08 });
  }
  world.addChild(ground);
  await loadManifest();
  const objG = new Graphics(), objSprites = new Container();
  world.addChild(objG, objSprites);
  const road: boolean[][] = [...Array(N)].map(() => Array(N).fill(false));
  const zone: string[][] = [...Array(N)].map(() => Array(N).fill(''));
  const bld: number[][] = [...Array(N)].map(() => Array(N).fill(0)); // 0 none, 1 low, 2 medium, 3 high
  const inb = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N;
  let near: number[][] = [];
  const computeNear = () => { // BFS distance from nearest road (4-neighbour steps)
    near = [...Array(N)].map(() => Array(N).fill(99)); const q: [number, number][] = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (road[i][j]) { near[i][j] = 0; q.push([i, j]); }
    for (let h = 0; h < q.length; h++) { const [i, j] = q[h];
      for (const [a, b] of [[1,0],[-1,0],[0,1],[0,-1]]) { const ni=i+a, nj=j+b; if (inb(ni,nj) && near[ni][nj] > near[i][j]+1) { near[ni][nj]=near[i][j]+1; q.push([ni,nj]); } } }
  };
  const redraw = () => {
    objG.clear(); objSprites.removeChildren().forEach(c => c.destroy());
    computeNear();
    for (let s = 0; s < 2 * N - 1; s++) for (let i = 0; i < N; i++) { const j = s - i; if (j < 0 || j >= N) continue;
      const { x, y } = toScreen(i, j);
      if (road[i][j]) {
        const m = (inb(i+1,j)&&road[i+1][j]?1:0)|(inb(i-1,j)&&road[i-1][j]?2:0)|(inb(i,j+1)&&road[i][j+1]?4:0)|(inb(i,j-1)&&road[i][j-1]?8:0);
        drawSprite('road_' + m, x, y, objG, objSprites);
      } else if (zone[i][j]) {
        drawSprite('zone_' + zone[i][j], x, y, objG, objSprites);
        if (bld[i][j]) drawSprite(`bld_${zone[i][j]}_${bld[i][j]}`, x, y, objG, objSprites, (i * 73856093) ^ (j * 19349663));
      }
      else if (terrain[i][j] === 'forest') objG.circle(x - 6, y - 4, 6).fill(0x2a5e25).circle(x + 7, y - 1, 5).fill(0x2f6a29);
    }
  };
  redraw();
  const preview = new Graphics(), hl = new Graphics();
  world.addChild(preview, hl);

  // ---- tools ----
  type Tool = 'select' | 'road' | 'R' | 'C' | 'I' | 'bulldoze';
  const tools: [Tool, string][] = [['select','Select / Pan'],['road','Road'],['R','Residential'],['C','Commercial'],['I','Industrial'],['bulldoze','Bulldoze']];
  let tool: Tool = 'select';
  const bar = document.getElementById('toolbar')!;
  const setTool = (t: Tool) => { tool = t; bar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); };
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
    if (tool === 'bulldoze') return road[i][j] || !!zone[i][j] || bld[i][j] > 0;
    return terrain[i][j] !== 'water' && !road[i][j] && near[i][j] <= 3;
  };
  const showPreview = () => {
    preview.clear();
    const col = tool === 'road' ? 0x9aa0a6 : tool === 'bulldoze' ? 0xff8800 : ({R:0x3ecf4a,C:0x3b8cff,I:0xf2c230} as any)[tool];
    for (const [i, j] of dragTiles()) { diamond(preview, i, j); preview.fill({ color: valid(i, j) ? col : 0xff2020, alpha: 0.55 }); }
  };
  const commit = () => {
    for (const [i, j] of dragTiles()) { if (!valid(i, j)) continue;
      if (tool === 'road') { road[i][j] = true; zone[i][j] = ''; bld[i][j] = 0; }
      else if (tool === 'bulldoze') { road[i][j] = false; zone[i][j] = ''; bld[i][j] = 0; }
      else { if (zone[i][j] !== tool) bld[i][j] = 0; zone[i][j] = tool; } }
    drag = null; preview.clear(); redraw();
  };
  const tileAt = (sx: number, sy: number) => toTile((sx - world.position.x) / zoom, (sy - world.position.y) / zoom);
  (window as any).__city = { tileToScreen: (i: number, j: number) => { const p = toScreen(i, j); return { x: p.x * zoom + world.position.x, y: p.y * zoom + world.position.y }; }, road, zone, bld, terrain, setTool, sim: () => sim, setSpeed: (n: number) => setSpeed(n), centerOn: (i: number, j: number) => { const p = toScreen(i, j); camX = p.x; camY = p.y; } };

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
  const census = () => {
    sim.pop = sim.jobsC = sim.jobsI = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (bld[i][j]) {
      const v = CAP[zone[i][j]][bld[i][j]];
      if (zone[i][j] === 'R') sim.pop += v; else if (zone[i][j] === 'C') sim.jobsC += v; else sim.jobsI += v;
    }
    const jobs = sim.jobsC + sim.jobsI, workers = sim.pop * 0.6;
    sim.dR = clamp((jobs * 1.3 + 40 - sim.pop) / Math.max(60, sim.pop * 0.5));      // people come for jobs
    sim.dC = clamp((sim.pop * 0.25 + 5 - sim.jobsC) / Math.max(15, sim.pop * 0.15));  // shops follow residents
    sim.dI = clamp((40 + workers * 0.5 - sim.jobsI) / Math.max(30, sim.jobsI * 0.5)); // outside demand + workforce
  };
  const tick = () => {
    sim.day++;
    const d: Record<string, number> = { R: sim.dR, C: sim.dC, I: sim.dI };
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const z = zone[i][j]; if (!z) continue;
      const dem = d[z], L = bld[i][j];
      if (near[i][j] > 3) { if (L && Math.random() < 0.05) bld[i][j]--; continue; } // lost road access
      if (dem > 0 && L < 3) {
        const need = [0, 0, 0.25, 0.5][L + 1]; // higher density needs sustained strong demand
        if (dem > need && Math.random() < (L === 0 ? 0.06 : 0.012) * dem) bld[i][j]++;
      } else if (L > 0 && dem < -0.5 && Math.random() < 0.02 * -dem) bld[i][j]--;
    }
    census(); redraw(); updateStats();
  };
  // top HUD
  const stats = document.getElementById('stats')!;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = () => `${MONTHS[Math.floor(sim.day / 30) % 12]} ${sim.day % 30 + 1}, Year ${Math.floor(sim.day / 360) + 1}`;
  const rbar = (k: string, v: number, c: string) => `<div class="rci"><div class="half"><div style="height:${Math.max(0, v) * 100}%;background:${c}"></div></div><div class="half neg"><div style="height:${Math.max(0, -v) * 100}%;background:${c}"></div></div><span>${k}</span></div>`;
  const updateStats = () => {
    stats.querySelector('#nums')!.innerHTML = `<b>${dateStr()}</b> · Population <b>${sim.pop.toLocaleString()}</b> · Jobs <b>${(sim.jobsC + sim.jobsI).toLocaleString()}</b> <small>(C ${sim.jobsC} / I ${sim.jobsI})</small>`;
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
  census(); updateStats(); setSpeed(1);
  // info panel
  const info = document.getElementById('info')!;
  const inspect = ({ i, j }: { i: number; j: number }) => {
    if (!inb(i, j) || !bld[i][j]) { info.style.display = 'none'; return; }
    const z = zone[i][j], v = CAP[z][bld[i][j]];
    info.innerHTML = `<b>${ZNAME[z]} building</b><br>${DNAME[bld[i][j]]} (level ${bld[i][j]})<br>${z === 'R' ? 'Residents' : 'Jobs'}: <b>${v}</b><br><small>Tile ${i}, ${j}</small>`;
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
