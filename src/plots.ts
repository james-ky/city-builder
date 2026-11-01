// Plot Builder v1: player-designed lots assembled from parts on a 0.25-tile (5 m) grid.
// A design is drawn with its FRONT on the +i (SE) edge; when placed it rotates so the front faces the road.
// Stats are computed from the parts with real-world numbers (whole people), see plotStats().
import { Container, Graphics, Sprite } from 'pixi.js';
import { HOUSEHOLD_MIX } from './realism';

export const CELLS = 4; // grid cells per tile (5 m)
export type PartType = 'house' | 'shop' | 'factory' | 'parking' | 'driveway' | 'sidewalk' | 'tree' | 'fence';
export type Part = { t: PartType; x: number; y: number; f?: number; v?: number; g?: boolean }; // v: fence style (0 picket, 1 chain-link, 2 hedge) / tree kind; g: gate // x along i (front = high x), y along j; f floors; v variant
export type Design = { id: string; name: string; s: number; face: number; parts: Part[] }; // face 0 = auto, 1..4 = locked NE/SE/SW/NW
export const PARTS: Record<PartType, { w: number; h: number; cost: number; name: string; tip: string; body?: boolean; floors?: [number, number] }> = {
  house:    { w: 2, h: 2, cost: 400, name: 'House / flats', tip: '10×10 m. 1–2 floors = one house; 3+ floors = flats (≈70 m² each)', body: true, floors: [1, 4] },
  shop:     { w: 2, h: 2, cost: 450, name: 'Shop / offices', tip: '10×10 m. Ground floor retail, upper floors offices. Draws shoppers to the front door', body: true, floors: [1, 4] },
  factory:  { w: 2, h: 2, cost: 500, name: 'Workshop / factory', tip: '10×10 m light industry. Ships freight; trucks may use any road within 1 tile', body: true, floors: [1, 2] },
  parking:  { w: 1, h: 1, cost: 20, name: 'Parking space', tip: 'One stall (5×5 m incl. aisle). Needs a driveway on the front edge' },
  driveway: { w: 1, h: 1, cost: 10, name: 'Driveway / entrance', tip: 'Paved entrance. Put one on the front edge so cars can reach the parking' },
  sidewalk: { w: 1, h: 1, cost: 8, name: 'Walkway', tip: 'Paved path' },
  tree:     { w: 1, h: 1, cost: 15, name: 'Tree', tip: 'Landscaping. Click a tree again for another kind (round, conifer, poplar, shrub)' },
  fence:    { w: 1, h: 1, cost: 5, name: 'Fence / hedge', tip: 'Drag to run a fence; pieces join up. Click one again to cycle picket, gate, chain-link, gate, hedge, gate' },
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
export type Drawer = { toScreen: (i: number, j: number) => { x: number; y: number }; place: (key: string, x: number, y: number, layer: Container, seed?: number) => Sprite | Graphics; hasArt: (k: string) => boolean;
  meta?: (k: string) => any; night?: (key: string, x: number, y: number, z: number) => void };
export const DN = ['', 'NE', 'SE', 'SW', 'NW'];
/** world edge bit (NE1 SE2 SW4 NW8) of a design-space step (du,dv) after rotating to `face` */
const bitOf = (du: number, dv: number, face: number) => { const [a, b] = rotUV(du, dv, 0, face); return a > 0 ? 2 : a < 0 ? 8 : b > 0 ? 4 : 1; };
export const maskOf = (d: Design, p: Part, face: number, same: (q: Part) => boolean) => { let m = 0; for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = partAt(d, p.x + du, p.y + dv); if (q && same(q)) m |= bitOf(du, dv, face); } return m; };
const STRAIGHT = (m: number) => (m & 5) && !(m & 10) ? 5 : (m & 10) && !(m & 5) ? 10 : (m & 5) === 5 ? 5 : 10;
/** sidewalk pieces: straight 5/10, corners 3/6/12/9, tees 7/11/13/14; 0- and 1-bit masks -> straight, cross 15 -> a tee */
export const walkPiece = (m: number) => [3, 6, 12, 9, 5, 10, 7, 11, 13, 14].includes(m) ? m : m === 15 ? 7 : STRAIGHT(m);
/** fence/hedge pieces: straight 5/10 and corners 3/6/12/9 only; tees/cross/ends fall back to the straight run through them */
export const fencePiece = (m: number) => [3, 6, 12, 9, 5, 10].includes(m) ? m : STRAIGHT(m);
export const FENCE_STYLES = ['fence_picket', 'fence_chainlink', 'hedge'];
const LAWN_TINT = 0xb8cca4; // part_lawn renders bright under the high sun; pull it toward the terrain grass
/** draw a design at lot origin tile (i0,j0) facing `face` into `layer` (children get zIndex by screen depth) */
export const drawPlot = (D: Drawer, d: Design, i0: number, j0: number, face: number, layer: Container, opts: { grid?: boolean; ghost?: number } = {}) => {
  const s = d.s, n = s * CELLS, P = (u: number, v: number) => { const [a, b] = rotUV(u, v, s, face); return D.toScreen(i0 - 0.5 + a, j0 - 0.5 + b); };
  const quad = (u0: number, v0: number, u1: number, v1: number) => [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)].flatMap(p => [p.x, p.y]);
  const dir = DN[face], art = (k: string) => D.hasArt(k);
  const spr = (k: string, x: number, y: number, z: number) => { const o = D.place(k, x, y, layer); o.zIndex = z; if (D.meta?.(k)?.nightLitPx !== 0) D.night?.(k, x, y, z + 0.001); return o; }; // parts with empty overlays (nightLitPx 0) add no light sprite
  const ground = new Graphics(); ground.zIndex = -1e9; layer.addChild(ground);
  let gz = -1e8; const gspr = (k: string, x: number, y: number) => { const o = D.place(k, x, y, layer); o.zIndex = gz + y * 1e-3; return o; }; // flat parts: above the lawn, under every object
  // lawn: part_lawn per cell (tinted), else a flat fill
  const occupied = new Set(d.parts.filter(p => ['parking', 'driveway', 'sidewalk'].includes(p.t)).map(p => p.x + ',' + p.y));
  if (art('part_lawn')) for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) if (!occupied.has(x + ',' + y)) { const c = P((x + 0.5) / CELLS, (y + 0.5) / CELLS); const o = D.place('part_lawn', c.x, c.y, layer) as Sprite; o.zIndex = -2e8 + c.y * 1e-3; o.tint = LAWN_TINT; }
  ground.poly(quad(0, 0, s, s)).fill({ color: art('part_lawn') ? 0x6aa651 : 0x6fb257, alpha: opts.grid || art('part_lawn') ? 1 : 0.55 }); // base under the cells (paving sprites are smaller than a cell)
  const grid = new Graphics(); grid.zIndex = -5e7; layer.addChild(grid);
  if (opts.grid) { for (let k = 0; k <= n; k++) { const a = P(k / CELLS, 0), b = P(k / CELLS, s), c = P(0, k / CELLS), e = P(s, k / CELLS); grid.moveTo(a.x, a.y).lineTo(b.x, b.y).moveTo(c.x, c.y).lineTo(e.x, e.y); } grid.stroke({ width: 0.5, color: 0xffffff, alpha: 0.25 });
    const f0 = P(s, 0), f1 = P(s, s); grid.moveTo(f0.x, f0.y).lineTo(f1.x, f1.y).stroke({ width: 2, color: 0xffd27a, alpha: 0.9 }); }
  const depth = (p: Part) => P(p.x / CELLS + footOf(p).w / CELLS, p.y / CELLS + footOf(p).h / CELLS).y;
  const sorted = [...d.parts].sort((a, b) => depth(a) - depth(b));
  const paved = (q: Part) => q.t === 'sidewalk' || q.t === 'driveway';
  for (const p of sorted) { const u0 = p.x / CELLS, v0 = p.y / CELLS, u1 = u0 + footOf(p).w / CELLS, v1 = v0 + footOf(p).h / CELLS, c = P((u0 + u1) / 2, (v0 + v1) / 2), z = Math.max(...[P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)].map(q => q.y));
    if (p.t === 'driveway' || p.t === 'sidewalk' || p.t === 'parking') {
      const key = p.t === 'sidewalk' ? 'part_sidewalk_' + walkPiece(maskOf(d, p, face, paved)) : p.t === 'driveway' ? 'part_driveway_' + dir : 'part_parking_stall_' + dir;
      if (art(key)) gspr(key, c.x, c.y); else ground.poly(quad(u0, v0, u1, v1)).fill(p.t === 'sidewalk' ? 0xd6d2c6 : 0x6b707a);
      if (p.t === 'parking') { const keys = ['veh_sedan_a', 'veh_hatchback_b', 'veh_pickup_c', 'veh_sedan_c', 'veh_van_a', 'veh_hatchback_a'], vk = keys[((p.x * 7 + p.y * 13) >>> 0) % keys.length];
        const [fa, fb] = rotUV(1, 0, 0, face), K = ((Math.round(Math.atan2(-fb, fa) / (Math.PI / 8)) % 16) + 16) % 16; // nose toward the front (along +u)
        const nm = `${vk}_d${String(K).padStart(2, '0')}`; if (D.hasArt(nm)) { const sp = D.place(nm, c.x, c.y, layer); sp.zIndex = z; (sp as any).__plotCar = true; } }
      continue; }
    if (p.t === 'tree') { const k = ['part_tree_a', 'part_tree_b', 'part_tree_c', 'part_shrub_a'][(p.v ?? (p.x * 3 + p.y)) % 4]; // real size (≈6–7 m trees for a 5 m cell)
      if (art(k)) spr(k, c.x, c.y, z); else { const g = new Graphics().circle(c.x, c.y - 6, 4).fill(0x3d8a3a); g.zIndex = z; layer.addChild(g); } continue; }
    if (p.t === 'fence') { const st = FENCE_STYLES[(p.v ?? 0) % 3], m = fencePiece(maskOf(d, p, face, q => q.t === 'fence')), key = p.g && (m === 5 || m === 10) ? `part_${st}_gate_${m}` : `part_${st}_${m}`; // along the cell centreline
      if (art(key)) spr(key, c.x, c.y, z); else { const g = new Graphics(); const a = P(u0, (v0 + v1) / 2), b = P(u1, (v0 + v1) / 2); g.moveTo(a.x, a.y - 3).lineTo(b.x, b.y - 3).stroke({ width: 1.2, color: 0xf2efe6 }); g.zIndex = z; layer.addChild(g); } continue; }
    // building body: whole-building art per floor count and facing
    const f = p.f ?? 1, key = p.t === 'house' ? (f <= 2 ? `part_house_${f}f_${dir}` : `part_flats_${Math.min(f, 4)}f_${dir}`) : p.t === 'shop' ? `part_shop_${Math.min(f, 4)}f_${dir}` : `part_workshop_${Math.min(f, 2)}f_${dir}`;
    if (art(key)) { const o = spr(key, c.x, c.y, z); if (opts.ghost) o.alpha = opts.ghost;
      if (face === 1 || face === 4) { const mc = P(u1 + 0.125, (v0 + v1) / 2), mk = 'part_door_marker_' + dir; // door faces away from the camera: a subtle arrow/path out of the door so the front still reads
        if (u1 + 0.125 <= s && !partAt(d, p.x + footOf(p).w, p.y + 1)) { if (art(mk)) { const o2 = gspr(mk, mc.x, mc.y) as Sprite; o2.alpha = opts.grid ? 0.9 : 0.55; (o2 as any).__doorMarker = true; } } else { (o as any).__doorPath = true; } }
      continue; }
    // fallback prism (no art): real storey height from the manifest (12.54 px @2x = 6.27 px per 3.2 m storey)
    const fh = D.meta?.('part_house_1f_SE')?.floorHeightPx2x / 2 || 6.27, H = f * fh, [wl, wr, rf, re] = BODY_COL[p.t], g = new Graphics(); g.zIndex = z;
    const pts = [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], top = pts.map(q => ({ x: q.x, y: q.y - H }));
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0]].map(([a, b]) => ({ a, b, y: (pts[a].y + pts[b].y) / 2 })).sort((x, y) => y.y - x.y).slice(0, 2);
    for (const e of edges) { const A = pts[e.a], B = pts[e.b], left = (A.x + B.x) / 2 < c.x; g.poly([A.x, A.y, B.x, B.y, B.x, B.y - H, A.x, A.y - H]).fill(left ? wl : wr); }
    g.poly(top.flatMap(q => [q.x, q.y])).fill(rf).stroke({ width: 0.6, color: re }); if (opts.ghost) g.alpha = opts.ghost; layer.addChild(g); }
  return ground; };
export const newDesign = (s = 1): Design => ({ id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name: 'Custom lot', s, face: 0, parts: [] });
