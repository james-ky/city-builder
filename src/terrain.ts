// Procedural terrain: lakes from fractal value noise, meandering rivers, forests. Deterministic per (size, seed).
export type T = 'water' | 'sand' | 'grass' | 'forest';
export const TERRAIN_VERSION = 1;
export function rng(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
const hash = (x: number, y: number, s: number) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const sm = (t: number) => t * t * (3 - 2 * t);
function vnoise(x: number, y: number, s: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = sm(x - x0), ty = sm(y - y0);
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
function fbm(x: number, y: number, s: number, oct = 4) { let v = 0, amp = 0.5, f = 1, tot = 0; for (let o = 0; o < oct; o++) { v += vnoise(x * f, y * f, s + o * 101) * amp; tot += amp; amp *= 0.5; f *= 2; } return v / tot; }

export function genTerrain(n: number, seed: number): T[][] {
  const S = seed >>> 0, r = rng(S ^ 0x9e3779b9);
  const H: number[][] = [], F = 1 / 40; // lake features ~40 tiles across: bigger maps get more lakes, not bigger ones
  for (let i = 0; i < n; i++) { H.push([]); for (let j = 0; j < n; j++) H[i].push(fbm(i * F, j * F, S)); }
  const t: T[][] = H.map(row => row.map(h => (h < 0.3 ? 'water' : 'grass') as T));
  // rivers: one per ~110 tiles of map size, edge to edge with a meandering heading
  const rivers = Math.max(1, Math.round(n / 110));
  for (let k = 0; k < rivers; k++) {
    const side = Math.floor(r() * 4), p = n * (0.2 + 0.6 * r());
    let x = side === 0 ? 0 : side === 1 ? n - 1 : p, y = side === 2 ? 0 : side === 3 ? n - 1 : p;
    let ang = side === 0 ? 0 : side === 1 ? Math.PI : side === 2 ? Math.PI / 2 : -Math.PI / 2; const base = ang;
    let w = 1 + r() * 0.8;
    for (let step = 0; step < n * 3; step++) {
      ang += (vnoise(step * 0.05, k * 7, S + 999) - 0.5) * 0.35; ang = base + Math.max(-1, Math.min(1, ang - base));
      x += Math.cos(ang); y += Math.sin(ang); w = Math.min(3.2, w + 0.004);
      if (x < -2 || y < -2 || x > n + 1 || y > n + 1) break;
      for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { const i = Math.round(x + a), j = Math.round(y + b); if (i >= 0 && j >= 0 && i < n && j < n && Math.hypot(a, b) <= w) t[i][j] = 'water'; }
    }
  }
  // tiny single-tile ponds look like noise: drop water tiles with <2 water neighbours
  const isW = (i: number, j: number) => i >= 0 && j >= 0 && i < n && j < n && t[i][j] === 'water';
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (t[i][j] === 'water' && (+isW(i + 1, j) + +isW(i - 1, j) + +isW(i, j + 1) + +isW(i, j - 1)) < 2) t[i][j] = 'grass';
  // beaches and forests
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (t[i][j] === 'water') continue;
    let wn = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (isW(i + a, j + b)) wn++;
    if (wn && H[i][j] < 0.335 && hash(i, j, S + 5) < 0.85) { t[i][j] = 'sand'; continue; }
    const f = fbm(i / 22, j / 22, S + 555, 3);
    if (f > 0.6 || (f > 0.52 && hash(i, j, S + 7) < 0.35)) t[i][j] = 'forest';
  }
  return t;
}
export const TCOL: Record<T, string> = { water: '#3478bd', sand: '#dccb92', grass: '#5ea849', forest: '#2f6a2a' };
/** draw an isometric minimap of a terrain onto a canvas */
export function drawMini(cv: HTMLCanvasElement, t: T[][]) {
  const n = t.length, W = cv.width, Hh = cv.height, ctx = cv.getContext('2d')!; ctx.clearRect(0, 0, W, Hh);
  const sx = W / (2 * n), sy = Hh / (2 * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.fillStyle = TCOL[t[i][j]]; ctx.fillRect(W / 2 + (i - j) * sx - sx, (i + j) * sy, sx * 2 + 0.5, sy * 2 + 0.5); }
}
