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
      } else if (zone[i][j]) drawSprite('zone_' + zone[i][j], x, y, objG, objSprites);
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
    if (tool === 'bulldoze') return road[i][j] || !!zone[i][j];
    return terrain[i][j] !== 'water' && !road[i][j] && near[i][j] <= 3;
  };
  const showPreview = () => {
    preview.clear();
    const col = tool === 'road' ? 0x9aa0a6 : tool === 'bulldoze' ? 0xff8800 : ({R:0x3ecf4a,C:0x3b8cff,I:0xf2c230} as any)[tool];
    for (const [i, j] of dragTiles()) { diamond(preview, i, j); preview.fill({ color: valid(i, j) ? col : 0xff2020, alpha: 0.55 }); }
  };
  const commit = () => {
    for (const [i, j] of dragTiles()) { if (!valid(i, j)) continue;
      if (tool === 'road') { road[i][j] = true; zone[i][j] = ''; }
      else if (tool === 'bulldoze') { road[i][j] = false; zone[i][j] = ''; }
      else zone[i][j] = tool; }
    drag = null; preview.clear(); redraw();
  };
  const tileAt = (sx: number, sy: number) => toTile((sx - world.position.x) / zoom, (sy - world.position.y) / zoom);
  (window as any).__city = { tileToScreen: (i: number, j: number) => { const p = toScreen(i, j); return { x: p.x * zoom + world.position.x, y: p.y * zoom + world.position.y }; }, road, zone, terrain, setTool, centerOn: (i: number, j: number) => { const p = toScreen(i, j); camX = p.x; camY = p.y; } };

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
    hud.textContent = `Tile: ${i}, ${j}  (${road[i][j] ? 'road' : zone[i][j] ? ({R:'residential',C:'commercial',I:'industrial'} as any)[zone[i][j]] + ' zone' : terrain[i][j]})`;
  };

  // pointers: drag pan + pinch zoom
  const ptrs = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;
  const c = app.canvas;
  c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId);
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
  const up = (e: PointerEvent) => { if (drag && e.type === 'pointerup') commit(); else if (drag) { drag = null; preview.clear(); } ptrs.delete(e.pointerId); pinchDist = 0; if (e.pointerType !== 'mouse') mouse = { x: e.clientX, y: e.clientY }; };
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
