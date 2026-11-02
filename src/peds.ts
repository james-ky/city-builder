// Walking residents (agent-based). Each person shown is one resident on a short walk on the sidewalk:
// home -> nearby shop / job / school / park / bus stop (walk trips from the trip model), or parked car -> destination.
// They keep to one sidewalk, cross at junctions (waiting for cars to clear), are fewer at night and gone in the small hours.
// The sim runs for the whole city; only drawing is culled by the camera.
import { Assets, Rectangle, Sprite, Texture, Container } from 'pixi.js';
import { TRIPS } from './realism';

export type PedKind = 'adult' | 'kid' | 'senior' | 'stroller' | 'dogwalker';
export type Ped = { id: number; v: string; kind: PedKind; age: number; home: number; dest: number; purpose: string; back: boolean; via?: string;
  pts: [number, number][]; seg: number; t: number; lens: number[]; cross: number; ctiles: number[]; sp: number; wait: number; ft: number; ph: number;
  born: number; s?: Sprite; n?: Sprite; K: number; x: number; y: number; ti: number; tj: number; lead?: Ped };
type Deps = { N: number; road: (i: number, j: number) => boolean; toScreen: (i: number, j: number) => { x: number; y: number };
  layerAt: (i: number, j: number) => { ob: Container; vis: boolean }; cars: () => { i: number; j: number; pi: number; pj: number }[] };

const SIDE = 0.46; // sidewalk centre, tiles from the road centre line
const BASE_SP = 0.35; // walking pace, tiles per real second at 1x (scaled by game speed); cars cover ~6 tiles/s, so walkers stay clearly slower. Art walks at 10 fps at 0.06 tiles/s
const VARS: Record<PedKind, string[]> = { adult: ['adult_a', 'adult_b', 'adult_c', 'adult_d', 'adult_e', 'adult_f', 'adult_g', 'adult_h'], kid: ['kid_a', 'kid_b', 'kid_c'], senior: ['senior_a', 'senior_b'], stroller: ['stroller'], dogwalker: ['dogwalker'] };
const SPEED: Record<PedKind, number> = { adult: 1, kid: 1, senior: 0.7, stroller: 0.85, dogwalker: 0.8 };
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

export class Peds {
  list: Ped[] = []; max = 160; scale = 1; spawned = 0; walkTrips = 0; private idN = 0; private tex = new Map<string, Texture[][]>(); private ntex = new Map<string, Texture[][]>(); ready = false; speed = 1; now = 0; maxHours = 4;
  constructor(private d: Deps) {}
  async load() { let m: any; try { m = await (await fetch('./assets/people/manifest.json')).json(); } catch { return; }
    await Promise.all(m.variants.map(async (v: any) => { for (const [file, map] of [[v.file, this.tex], [v.night, this.ntex]] as [string, Map<string, Texture[][]>][]) { if (!file) continue;
      try { const t: Texture = await Assets.load('./assets/' + file), src = t.source, fw = src.width / 9, fh = src.height / 16, rows: Texture[][] = [];
        for (let r = 0; r < 16; r++) { const row: Texture[] = []; for (let c = 0; c < 9; c++) row.push(new Texture({ source: src, frame: new Rectangle(c * fw, r * fh, fw, fh) })); rows.push(row); } map.set(v.id, rows); } catch { /* no art: that variant is skipped */ } } }));
    this.ready = this.tex.size > 0; }
  /** walk along road tiles: BFS on the road network from a to b, at most `lim` steps */
  private path(a: number, b: number, lim = 14): number[] | null { const N = this.d.N; if (a < 0 || b < 0) return null; if (a === b) return [a];
    const from = new Map<number, number>([[a, -1]]); let q = [a];
    for (let s = 0; s < lim && q.length; s++) { const nq: number[] = []; for (const k of q) { const i = (k / N) | 0, j = k % N; for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + x, nj = j + y; if (ni < 0 || nj < 0 || ni >= N || nj >= N || !this.d.road(ni, nj)) continue; const nk = ni * N + nj; if (from.has(nk)) continue; from.set(nk, k);
      if (nk === b) { const p = [b]; let c = k; while (c !== -1) { p.push(c); c = from.get(c)!; } return p.reverse(); } nq.push(nk); } } q = nq; }
    return null; }
  /** builds the sidewalk polyline (ground coords) for a walk from building `o` (via road tile ra) to building `t` (via rb) */
  private route(o: number, ra: number, t: number, rb: number) { const N = this.d.N, p = this.path(ra, rb); if (!p) return null;
    const g = (k: number): [number, number] => [(k / N) | 0, k % N], P = p.map(g), n = P.length - 1, go = g(o), gt = g(t);
    const dirAt = (k: number): [number, number] => k < n ? [P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]] : [P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]];
    const perp = (v: [number, number]): [number, number] => [-v[1], v[0]];
    const sideOf = (k: number, b: [number, number]) => { if (n === 0) return 1; const pv = perp(dirAt(k)), d = (b[0] - P[k][0]) * pv[0] + (b[1] - P[k][1]) * pv[1]; return d < 0 ? -1 : 1; };
    const fromRoad = o === ra, B = sideOf(n, gt), A = fromRoad ? (n > 0 ? sideOf(0, gt) : B) : sideOf(0, go); /* a parked driver gets out on the kerb side nearest the destination */ let X = n;;/* crossing node: the last junction (3+ road neighbours) before the end, else the end of the walk */
    if (A !== B) { X = -1; for (let k = n - 1; k >= 1; k--) { const [i, j] = P[k]; let c = 0; for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.d.road(i + x, j + y)) c++; if (c >= 3) { X = k; break; } } if (X < 0) X = Math.max(0, n - 1); }
    const pts: [number, number][] = fromRoad ? [] : [[go[0] + (P[0][0] - go[0]) * 0.45, go[1] + (P[0][1] - go[1]) * 0.45]];
    const off = (k: number, s: number): [number, number] => { if (n === 0) { const v: [number, number] = [P[0][0] - go[0], P[0][1] - go[1]]; return [-v[0] * SIDE * s, -v[1] * SIDE * s]; }
      const a = k > 0 ? perp(dirAt(k - 1)) : null, b = k < n ? perp(dirAt(k)) : null; let v = a && b ? (a[0] === b[0] && a[1] === b[1] ? a : a[0] === -b[0] && a[1] === -b[1] ? a : [a[0] + b[0], a[1] + b[1]] as [number, number]) : (a ?? b)!; return [v[0] * SIDE * s, v[1] * SIDE * s]; };
    if (n === 0) { const vd: [number, number] = [gt[0] - P[0][0], gt[1] - P[0][1]], vh: [number, number] = fromRoad ? vd : [go[0] - P[0][0], go[1] - P[0][1]]; // same road tile: cross it if the destination is across the street
      pts.push([P[0][0] + vh[0] * SIDE, P[0][1] + vh[1] * SIDE]); const across = vh[0] * vd[0] + vh[1] * vd[1] <= 0; if (across) pts.push([P[0][0] + vd[0] * SIDE, P[0][1] + vd[1] * SIDE]);
      pts.push([gt[0] + (P[0][0] - gt[0]) * 0.45, gt[1] + (P[0][1] - gt[1]) * 0.45]); const lens = pts.slice(1).map((q, x) => Math.hypot(q[0] - pts[x][0], q[1] - pts[x][1]) || 0.01); return { pts, lens, cross: across ? 1 : -1, ctiles: across ? [p[0]] : [] }; }
    if (fromRoad) { const o0 = off(0, A); pts.push([P[0][0] + o0[0] * 0.7, P[0][1] + o0[1] * 0.7]); }
    for (let k = 0; k <= n; k++) { const s = k <= X ? A : B, o2 = off(k, s); pts.push([P[k][0] + o2[0], P[k][1] + o2[1]]); if (k === X && A !== B) { const o3 = off(k, B); pts.push([P[k][0] + o3[0], P[k][1] + o3[1]]); } }
    pts.push([gt[0] + (P[n][0] - gt[0]) * 0.45, gt[1] + (P[n][1] - gt[1]) * 0.45]);
    const cross = A !== B ? X + 1 : -1, ctiles = A !== B ? [p[X], ...(X < n ? [p[X + 1]] : [])] : []; // segment index pts[cross] -> pts[cross+1] crosses the street
    const lens = pts.slice(1).map((q, x) => Math.hypot(q[0] - pts[x][0], q[1] - pts[x][1]) || 0.01); return { pts, lens, cross, ctiles }; }
  /** start one walk; returns the person or null (no sidewalk route / no art / full) */
  spawn(o: number, ra: number, t: number, rb: number, purpose: string, kind: PedKind, age: number, opts: { back?: boolean; via?: string; lead?: Ped } = {}): Ped | null {
    if (!this.ready || this.list.length >= this.max) return null; const r = this.route(o, ra, t, rb); if (!r) return null; let v = pick(VARS[kind]); if (!this.tex.has(v)) v = [...this.tex.keys()][0];
    const p: Ped = { id: ++this.idN, v, kind, age, home: opts.back ? t : o, dest: opts.back ? o : t, purpose, back: !!opts.back, via: opts.via, ...r, born: this.now, seg: 0, t: 0, sp: BASE_SP * SPEED[kind] * (0.9 + Math.random() * 0.2), wait: 0, ft: Math.random() * 8, ph: 0, K: 0, x: 0, y: 0, ti: -1, tj: -1, lead: opts.lead };
    if (opts.lead) { p.sp = opts.lead.sp; p.pts = p.pts.map(q => [q[0] + 0.07, q[1] - 0.07]); } // walks beside the grown-up
    this.list.push(p); this.spawned++; return p; }
  private drop(x: number) { const p = this.list[x]; p.s?.destroy(); p.n?.destroy(); this.list.splice(x, 1); }
  clear() { for (let x = this.list.length - 1; x >= 0; x--) this.drop(x); }
  /** advance every walker by `dt` seconds of traffic animation (0 while paused) and draw the visible ones */
  update(dt: number, tint: number, night: number, show: boolean) {
    const N = this.d.N; let busy: Set<number> | null = null;
    for (let x = this.list.length - 1; x >= 0; x--) { const p = this.list[x];
      if (dt > 0) { let hold = false;
        if (p.lead && this.list.includes(p.lead)) { p.seg = p.lead.seg; p.t = p.lead.t; hold = p.lead.wait > 0; }
        else if (p.seg === p.cross && p.t < 0.05 && p.wait < 6) { busy ??= new Set(this.d.cars().flatMap(c => [c.i * N + c.j, c.pi * N + c.pj])); if (p.ctiles.some(k => busy!.has(k))) { hold = true; p.wait += dt; } } // wait at the kerb for cars to clear
        if (!hold) { p.wait = 0; p.t += dt * p.sp / p.lens[p.seg]; while (p.t >= 1 && p.seg < p.lens.length) { p.t = (p.t - 1) * p.lens[p.seg]; p.seg++; if (p.seg < p.lens.length) p.t /= p.lens[p.seg]; } { const g = Math.max(1, this.speed); p.ft += dt * Math.min(40, 10 * p.sp / 0.06 * g) / g; } /* walk cycle scales with pace, capped at 40 fps */ }
        if (p.seg >= p.lens.length || this.now - p.born > this.maxHours) { this.drop(x); continue; } } // a walk never lasts past a few game hours (no one still out in the small hours)
      const a = p.pts[p.seg], b = p.pts[p.seg + 1], gi = a[0] + (b[0] - a[0]) * p.t, gj = a[1] + (b[1] - a[1]) * p.t, sc = this.d.toScreen(gi, gj);
      p.x = sc.x; p.y = sc.y; const ti = Math.round(gi), tj = Math.round(gj), L = this.d.layerAt(Math.max(0, Math.min(N - 1, ti)), Math.max(0, Math.min(N - 1, tj)));
      p.K = ((Math.round(Math.atan2(-(b[1] - a[1]), b[0] - a[0]) / (Math.PI / 8)) % 16) + 16) % 16; // (SE, NE) ground heading -> d00..d15
      const vis = show && L.vis; if (!vis) { if (p.s) p.s.visible = false; if (p.n) p.n.visible = false; continue; }
      const rows = this.tex.get(p.v)!, f = p.wait > 0 ? 8 : Math.floor(p.ft) % 8;
      if (!p.s) { p.s = new Sprite(rows[p.K][f]); p.s.anchor.set(0.5, 0.75); const nr = this.ntex.get(p.v); if (nr) { p.n = new Sprite(nr[p.K][f]); p.n.anchor.set(0.5, 0.75); p.n.blendMode = 'add'; (p.n as any).__light = true; } (p.s as any).__ped = p.id; }
      if (p.s.parent !== L.ob) { L.ob.addChild(p.s); if (p.n) L.ob.addChild(p.n); }
      p.s.texture = rows[p.K][f]; p.s.position.set(p.x, p.y); p.s.zIndex = p.y + 0.5; p.s.tint = tint; p.s.visible = true;
      if (p.n) { p.n.texture = this.ntex.get(p.v)![p.K][f]; p.n.position.set(p.x, p.y); p.n.zIndex = p.y + 0.51; p.n.alpha = night; p.n.visible = night > 0.02; } } }
  /** nearest visible walker to a world point (for the click tooltip) */
  at(wx: number, wy: number, r = 7) { let best: Ped | null = null, bd = r; for (const p of this.list) if (p.s?.visible) { const d = Math.hypot(p.x - wx, p.y - 6 - wy); if (d < bd) { bd = d; best = p; } } return best; }
  static ageFor(kind: PedKind, purpose: string) { return kind === 'kid' ? ri(6, 12) : kind === 'senior' ? ri(66, 88) : purpose === 'work' ? ri(19, 64) : kind === 'stroller' ? ri(24, 42) : purpose === 'school' ? ri(26, 48) : ri(16, 64); }
  static walkSharesNote = TRIPS.walkTiles;
}
