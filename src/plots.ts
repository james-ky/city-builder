// Plot Builder v1: player-designed lots assembled from parts on a 0.25-tile (5 m) grid.
// A design is drawn with its FRONT on the +i (SE) edge; when placed it rotates so the front faces the road.
// Stats are computed from the parts with real-world numbers (whole people), see plotStats().
import { Container, Graphics, Sprite } from 'pixi.js';
import { HOUSEHOLD_MIX } from './realism';

export const CELLS = 4; // grid cells per tile (5 m)
export type PartType = 'house' | 'shop' | 'factory' | 'parking' | 'driveway' | 'sidewalk' | 'tree' | 'fence';
export type Part = { t: PartType; x: number; y: number; f?: number; v?: number }; // x along i (front = high x), y along j; f floors; v variant
export type Design = { id: string; name: string; s: number; face: number; parts: Part[] }; // face 0 = auto, 1..4 = locked NE/SE/SW/NW
export const PARTS: Record<PartType, { w: number; h: number; cost: number; name: string; tip: string; body?: boolean; floors?: [number, number] }> = {
  house:    { w: 2, h: 2, cost: 400, name: 'House / flats', tip: '10×10 m. 1–2 floors = one house; 3+ floors = flats (≈70 m² each)', body: true, floors: [1, 4] },
  shop:     { w: 2, h: 2, cost: 450, name: 'Shop / offices', tip: '10×10 m. Ground floor retail, upper floors offices. Draws shoppers to the front door', body: true, floors: [1, 4] },
  factory:  { w: 2, h: 2, cost: 500, name: 'Workshop / factory', tip: '10×10 m light industry. Ships freight; trucks may use any road within 1 tile', body: true, floors: [1, 2] },
  parking:  { w: 1, h: 1, cost: 20, name: 'Parking space', tip: 'One stall (5×5 m incl. aisle). Needs a driveway on the front edge' },
  driveway: { w: 1, h: 1, cost: 10, name: 'Driveway / entrance', tip: 'Paved entrance. Put one on the front edge so cars can reach the parking' },
  sidewalk: { w: 1, h: 1, cost: 8, name: 'Walkway', tip: 'Paved path' },
  tree:     { w: 1, h: 1, cost: 15, name: 'Tree', tip: 'Landscaping' },
  fence:    { w: 1, h: 1, cost: 5, name: 'Fence / hedge', tip: 'Low fence' },
};
export const footOf = (p: Part) => ({ w: PARTS[p.t].w, h: PARTS[p.t].h });
export const fits = (d: Design, p: Part, ignore?: Part) => { const n = d.s * CELLS, { w, h } = footOf(p); if (p.x < 0 || p.y < 0 || p.x + w > n || p.y + h > n) return false;
  return !d.parts.some(q => q !== ignore && !(q.x >= p.x + w || q.x + footOf(q).w <= p.x || q.y >= p.y + h || q.y + footOf(q).h <= p.y)); };
export const partAt = (d: Design, x: number, y: number) => d.parts.find(q => x >= q.x && x < q.x + footOf(q).w && y >= q.y && y < q.y + footOf(q).h);

/** whole residents for `homes` homes, each a household size drawn deterministically from the census mix */
const people = (homes: number, mix: number[], seed: number) => { let h = seed >>> 0 || 1, n = 0; for (let u = 0; u < homes; u++) { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; let x = h / 4294967296, k = 0; while (k < mix.length - 1 && x >= mix[k]) { x -= mix[k]; k++; } n += k + 1; } return n; };
const hash = (s: string) => { let h = 2166136261; for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619); return h >>> 0; };
export type PlotStats = { homes: number; residents: number; jobsC: number; jobsI: number; spaces: number; stalls: number; kw: number; gpd: number; cost: number; shop: boolean; industry: boolean; bodies: number; warnings: string[] };
/** Realistic numbers per 10×10 m body (100 m² per floor):
 *  homes: 1–2 floors = 1 detached house (household mix of houses); 3+ floors = flats, 100 m² × floors × 80 % net ÷ 70 m² (mid-rise mix)
 *  shop: ground floor retail 1 job / 46 m² (500 sq ft), upper floors offices 1 job / 23 m² (250 sq ft), 85 % net
 *  factory: 1 job / 93 m² (1,000 sq ft), 90 % net
 *  power: house 1.25 kW, flat 0.9 kW; retail/office 15 kWh/sq ft/yr; light industry 50 kWh/sq ft/yr (average kW)
 *  water: house 300 gal/day, flat 175; commercial 0.1 gal/sq ft/day; industry 0.5 */
export const plotStats = (d: Design): PlotStats => { const st: PlotStats = { homes: 0, residents: 0, jobsC: 0, jobsI: 0, spaces: 0, stalls: 0, kw: 0, gpd: 0, cost: 0, shop: false, industry: false, bodies: 0, warnings: [] }; const SQFT = 107.6;
  let houseSeed = hash(d.id);
  for (const p of d.parts) { st.cost += PARTS[p.t].cost * (PARTS[p.t].body ? (p.f ?? 1) : 1); const f = p.f ?? 1;
    if (p.t === 'house') { st.bodies++; if (f <= 2) { st.homes += 1; st.residents += people(1, HOUSEHOLD_MIX[1], houseSeed++); st.kw += 1.25; st.gpd += 300; } else { const n = Math.floor(100 * f * 0.8 / 70); st.homes += n; st.residents += people(n, HOUSEHOLD_MIX[2], houseSeed++); st.kw += 0.9 * n; st.gpd += 175 * n; } }
    if (p.t === 'shop') { st.bodies++; st.shop = true; st.jobsC += Math.round(85 / 46) + Math.round((f - 1) * 85 / 23); st.kw += f * SQFT * 15 / 8760; st.gpd += f * SQFT * 0.1; }
    if (p.t === 'factory') { st.bodies++; st.industry = true; st.jobsI += Math.max(1, Math.round(f * 90 / 93)); st.kw += f * SQFT * 50 / 8760; st.gpd += f * SQFT * 0.5; }
    if (p.t === 'parking') st.stalls++; }
  const n = d.s * CELLS, frontDrive = d.parts.some(p => p.t === 'driveway' && p.x === n - 1);
  st.spaces = frontDrive ? st.stalls : 0;
  if (!st.bodies) st.warnings.push('Add a building');
  if (st.stalls && !frontDrive) st.warnings.push('Parking needs a driveway on the front edge');
  st.kw = Math.round(st.kw * 10) / 10; st.gpd = Math.round(st.gpd);
  return st; };

// ---- drawing ----
/** rotate design coords (tile units, 0..s) so the +i front edge lands on `face` (1 NE, 2 SE, 3 SW, 4 NW) */
const ROT: Record<number, number> = { 2: 0, 3: 1, 4: 2, 1: 3 };
export const rotUV = (u: number, v: number, s: number, face: number): [number, number] => { let a = u, b = v; for (let k = 0; k < (ROT[face] ?? 0); k++) { const na = s - b, nb = a; a = na; b = nb; } return [a, b]; };
const BODY_COL: Record<string, [number, number, number, number]> = { house: [0xf1e4c8, 0xd9c8a6, 0xb8553f, 0x8f3f2f], shop: [0xdfe7ee, 0xbccbd8, 0x8d99a6, 0x6f7a86], factory: [0xd4d0c6, 0xb4afa3, 0x8a8f96, 0x6c7178] }; // left wall, right wall, roof, roof edge
export type Drawer = { toScreen: (i: number, j: number) => { x: number; y: number }; place: (key: string, x: number, y: number, layer: Container, seed?: number) => Sprite | Graphics; hasArt: (k: string) => boolean };
/** draw a design at lot origin tile (i0,j0) facing `face` into `layer` (objects get zIndex by screen depth); `z0` offsets depth */
export const drawPlot = (D: Drawer, d: Design, i0: number, j0: number, face: number, layer: Container, opts: { grid?: boolean; ghost?: number } = {}) => {
  const s = d.s, n = s * CELLS, P = (u: number, v: number) => { const [a, b] = rotUV(u, v, s, face); return D.toScreen(i0 - 0.5 + a, j0 - 0.5 + b); };
  const quad = (u0: number, v0: number, u1: number, v1: number) => [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)].flatMap(p => [p.x, p.y]);
  const ground = new Graphics(); ground.zIndex = -1e9; layer.addChild(ground); // flat parts under everything
  ground.poly(quad(0, 0, s, s)).fill({ color: 0x6fb257, alpha: opts.grid ? 1 : 0.55 }); // lawn
  if (opts.grid) { for (let k = 0; k <= n; k++) { const a = P(k / CELLS, 0), b = P(k / CELLS, s), c = P(0, k / CELLS), e = P(s, k / CELLS); ground.moveTo(a.x, a.y).lineTo(b.x, b.y).moveTo(c.x, c.y).lineTo(e.x, e.y); } ground.stroke({ width: 0.5, color: 0xffffff, alpha: 0.25 });
    const f0 = P(s, 0), f1 = P(s, s); ground.moveTo(f0.x, f0.y).lineTo(f1.x, f1.y).stroke({ width: 2, color: 0xffd27a, alpha: 0.9 }); } // the front edge (road side)
  const depth = (u: number, v: number) => P(u, v).y;
  const sorted = [...d.parts].sort((a, b) => depth(a.x / CELLS + footOf(a).w / CELLS, a.y / CELLS + footOf(a).h / CELLS) - depth(b.x / CELLS + footOf(b).w / CELLS, b.y / CELLS + footOf(b).h / CELLS));
  for (const p of sorted) { const u0 = p.x / CELLS, v0 = p.y / CELLS, u1 = u0 + footOf(p).w / CELLS, v1 = v0 + footOf(p).h / CELLS, c = P((u0 + u1) / 2, (v0 + v1) / 2), z = Math.max(...[P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)].map(q => q.y));
    if (p.t === 'driveway' || p.t === 'sidewalk' || p.t === 'parking') { ground.poly(quad(u0, v0, u1, v1)).fill(p.t === 'sidewalk' ? 0xd6d2c6 : 0x6b707a);
      if (p.t === 'parking') { const a = P(u0 + 0.02, v0 + 0.02), b = P(u0 + 0.02, v1 - 0.02); ground.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 0.6, color: 0xf4f4ee });
        const keys = ['veh_sedan_a', 'veh_hatchback_b', 'veh_pickup_c', 'veh_sedan_c', 'veh_van_a', 'veh_hatchback_a'], key = keys[((p.x * 7 + p.y * 13) >>> 0) % keys.length];
        const [fa, fb] = [rotUV(1, 0, 0, face)[0], rotUV(1, 0, 0, face)[1]]; const K = ((Math.round(Math.atan2(-fb, fa) / (Math.PI / 8)) % 16) + 16) % 16; // nose toward the front (along +u)
        const nm = `${key}_d${String(K).padStart(2, '0')}`; if (D.hasArt(nm)) { const sp = D.place(nm, c.x, c.y, layer); sp.zIndex = c.y; (sp as any).__plotCar = true; } }
      continue; }
    if (p.t === 'tree') { const k = 'forest_' + 'abcd'[(p.x * 3 + p.y) % 4]; if (D.hasArt(k)) { const sp = D.place(k, c.x, c.y + 2, layer) as Sprite; sp.scale.set(sp.scale.x * 0.32); sp.zIndex = z; } else { const g = new Graphics().circle(c.x, c.y - 6, 4).fill(0x3d8a3a); g.zIndex = z; layer.addChild(g); } continue; }
    if (p.t === 'fence') { const g = new Graphics(); const a = P(u0, v0), b = P(u1, v0), e = P(u1, v1); for (const [q, r] of [[a, b], [b, e]]) { g.moveTo(q.x, q.y - 3).lineTo(r.x, r.y - 3).stroke({ width: 1.2, color: 0xf2efe6 }); g.moveTo(q.x, q.y).lineTo(q.x, q.y - 3.5).stroke({ width: 0.8, color: 0xe2ded2 }); } g.zIndex = z; layer.addChild(g); continue; }
    // building body: iso prism, 3.2 m per floor
    const f = p.f ?? 1, H = f * 3.2 * 1.6, [wl, wr, rf, re] = BODY_COL[p.t], g = new Graphics(); g.zIndex = z;
    const pts = [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], top = pts.map(q => ({ x: q.x, y: q.y - H }));
    // the two faces toward the viewer: the ones whose lower edge is lowest on screen
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0]].map(([a, b]) => ({ a, b, y: (pts[a].y + pts[b].y) / 2 })).sort((x, y) => y.y - x.y).slice(0, 2);
    for (const e of edges) { const A = pts[e.a], B = pts[e.b], left = (A.x + B.x) / 2 < c.x; g.poly([A.x, A.y, B.x, B.y, B.x, B.y - H, A.x, A.y - H]).fill(left ? wl : wr).stroke({ width: 0.5, color: 0x000000, alpha: 0.15 });
      for (let fl = 0; fl < f; fl++) for (const t of [0.25, 0.5, 0.75]) { const x = A.x + (B.x - A.x) * t, y = A.y + (B.y - A.y) * t - fl * 3.2 * 1.6 - 3.4; g.rect(x - 0.9, y - 1.6, 1.8, 2).fill({ color: 0x3b4a5c, alpha: 0.85 }); } }
    // front door on the face toward the front edge (+u)
    const front = [pts[1], pts[2]], fy = (front[0].y + front[1].y) / 2; if (edges.some(e => (e.a === 1 && e.b === 2))) { const mx = (front[0].x + front[1].x) / 2, my = fy; g.rect(mx - 1.3, my - 4.2, 2.6, 4.2).fill(0x6b4a2f); } else { (g as any).__doorHidden = true; }
    if (p.t === 'house' && f <= 2) { const ridge = [P((u0 + u1) / 2, v0), P((u0 + u1) / 2, v1)].map(q => ({ x: q.x, y: q.y - H - 5 })); g.poly([top[0].x, top[0].y, top[1].x, top[1].y, ridge[1].x, ridge[1].y, ridge[0].x, ridge[0].y]).fill(re); g.poly([top[3].x, top[3].y, top[2].x, top[2].y, ridge[1].x, ridge[1].y, ridge[0].x, ridge[0].y]).fill(rf); g.poly([top[1].x, top[1].y, top[2].x, top[2].y, ridge[1].x, ridge[1].y]).fill(wr); }
    else { g.poly(top.flatMap(q => [q.x, q.y])).fill(rf).stroke({ width: 0.6, color: re }); }
    if (p.t === 'shop') { const A = pts[1], B = pts[2]; g.poly([A.x, A.y - 4.6, B.x, B.y - 4.6, B.x, B.y - 6, A.x, A.y - 6]).fill(0x3b7fd1); } // awning sign band over the shop front
    if (p.t === 'factory') { const q = top[2]; g.rect(q.x - 2, q.y - 9, 3, 9).fill(0x9a8f86); } // stack
    if (opts.ghost) g.alpha = opts.ghost; layer.addChild(g); }
  return ground; };
export const newDesign = (s = 1): Design => ({ id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name: 'Custom lot', s, face: 0, parts: [] });
