// Agent-based trip simulation (no rendering here). People live in residential tiles as groups
// (workers / kids / others); each group has real destinations (a job tile, a school, shops) reachable on
// the road network. Routes are A* over drivable road tiles weighted by speed and congestion and cached per
// origin/destination road tile. Visible cars are sampled from these trips by the renderer.
import { TRIPS } from './realism';

export type Kind = 'work' | 'school' | 'errand';
export type Flow = { home: number; dest: number; kind: Kind; people: number }; // people making this trip each day (one way)
export type World = {
  N: number;
  drivable: (i: number, j: number) => boolean;
  linked: (i: number, j: number, a: number, b: number) => boolean; // real road connection between neighbours
  tileSecs: (i: number, j: number) => number;   // free-flow seconds to cross the tile
  capacity: (i: number, j: number) => number;   // vehicles/day
  residents: (i: number, j: number) => number;  // 0 if not housing
  jobs: (i: number, j: number) => number;       // 0 if no jobs
  shop: (i: number, j: number) => boolean;
  schools: () => { k: number; seats: number }[];
  seed: number;
};
const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const rng = (s: number) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export class TripSim {
  N: number; w: World;
  access: Int32Array;   // tile -> nearest drivable road tile within 3 steps (-1 none)
  comp: Int32Array;     // road tile -> connected component id (-1 not road)
  flows: Flow[] = [];
  homeFlows = new Map<number, Flow[]>();
  volume: Float32Array; // vehicles/day per tile (smoothed)
  private volSamples = 0; private volCursor = 0;
  stats = { residents: 0, workers: 0, employed: 0, noJobReachable: 0, jobless: 0, kids: 0, schooled: 0, noSchoolReachable: 0, assignMs: 0, routes: 0, cacheHits: 0, routeMs: 0 };
  private cache = new Map<number, number[] | null>(); version = 0;
  constructor(w: World) { this.w = w; this.N = w.N; const n = w.N * w.N; this.access = new Int32Array(n).fill(-1); this.comp = new Int32Array(n).fill(-1); this.volume = new Float32Array(n); }

  /** recompute access, components and everybody's destinations (call monthly or after road edits) */
  assign(month = 0) {
    const t0 = performance.now(), { N, w } = this, n = N * N, R = rng(w.seed * 7919 + month);
    this.cache.clear(); this.version++;
    // road components
    const comp = this.comp.fill(-1); let nc = 0; const q = new Int32Array(n);
    for (let s = 0; s < n; s++) { const si = (s / N) | 0, sj = s - si * N; if (comp[s] >= 0 || !w.drivable(si, sj)) continue;
      let h = 0, t = 0; q[t++] = s; comp[s] = nc;
      while (h < t) { const k = q[h++], i = (k / N) | 0, j = k - i * N; for (const [a, b] of D4) { const ni = i + a, nj = j + b; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const nk = ni * N + nj; if (comp[nk] < 0 && w.drivable(ni, nj) && w.linked(i, j, a, b)) { comp[nk] = nc; q[t++] = nk; } } }
      nc++; }
    // access road: multi-source BFS up to 3 steps
    const acc = this.access.fill(-1), dist = new Uint8Array(n).fill(255); let h = 0, t = 0;
    for (let k = 0; k < n; k++) if (comp[k] >= 0) { acc[k] = k; dist[k] = 0; q[t++] = k; }
    while (h < t) { const k = q[h++], i = (k / N) | 0, j = k - i * N; if (dist[k] >= 3) continue; for (const [a, b] of D4) { const ni = i + a, nj = j + b; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const nk = ni * N + nj; if (dist[nk] === 255) { dist[nk] = dist[k] + 1; acc[nk] = acc[k]; q[t++] = nk; } } }
    // destinations per component
    const jobsLeft = new Map<number, number>(), jobTiles: number[][] = [...Array(nc)].map(() => []), shopTiles: number[][] = [...Array(nc)].map(() => []), homes: number[] = [];
    const schools: { k: number; left: number; c: number }[] = [];
    for (let k = 0; k < n; k++) { const i = (k / N) | 0, j = k - i * N, a = acc[k]; if (w.residents(i, j) > 0) homes.push(k); if (a < 0) continue; const c = comp[a];
      const jb = w.jobs(i, j); if (jb > 0) { jobTiles[c].push(k); jobsLeft.set(k, jb); } if (w.shop(i, j)) shopTiles[c].push(k); }
    for (const s of w.schools()) { const a = acc[s.k]; if (a >= 0) schools.push({ k: s.k, left: s.seats, c: comp[a] }); }
    const st = this.stats; st.residents = st.workers = st.employed = st.noJobReachable = st.jobless = st.kids = st.schooled = st.noSchoolReachable = 0;
    const md = (x: number, y: number) => Math.abs(((x / N) | 0) - ((y / N) | 0)) + Math.abs((x % N) - (y % N));
    // shuffle homes so nobody gets first pick every month
    for (let k = homes.length - 1; k > 0; k--) { const r = (R() * (k + 1)) | 0; [homes[k], homes[r]] = [homes[r], homes[k]]; }
    this.flows = []; this.homeFlows.clear(); this.byKind = null;
    for (const hk of homes) { const i = (hk / N) | 0, j = hk - i * N, res = w.residents(i, j), a = acc[hk]; st.residents += res;
      let workers = res * TRIPS.workersPerResident, kids = res * TRIPS.kidsPerResident; const others = res - workers - kids; st.workers += workers; st.kids += kids;
      const fl: Flow[] = [];
      if (a < 0) { st.noJobReachable += workers; st.noSchoolReachable += kids; continue; }
      const c = comp[a], jt = jobTiles[c];
      if (!jt.length) st.noJobReachable += workers;
      else for (let tries = 0; tries < 3 && workers > 0.01; tries++) { // up to 3 workplaces per home, near + roomy preferred
        let best = -1, bs = -1; for (let s = 0; s < 8; s++) { const d = jt[(R() * jt.length) | 0], left = jobsLeft.get(d)!; if (left <= 0.01) continue; const sc = Math.min(left, workers) / (1 + md(hk, d) / 12); if (sc > bs) { bs = sc; best = d; } }
        if (best < 0) break; const take = Math.min(workers, jobsLeft.get(best)!); jobsLeft.set(best, jobsLeft.get(best)! - take); workers -= take; st.employed += take; fl.push({ home: hk, dest: best, kind: 'work', people: take }); }
      if (jt.length) st.jobless += workers;
      // school: nearest one in the same network with seats
      if (kids > 0.01) { let best: typeof schools[0] | null = null, bd = 1e9; for (const s of schools) if (s.c === c && s.left > 0) { const d = md(hk, s.k); if (d < bd) { bd = d; best = s; } }
        if (best) { const take = Math.min(kids, best.left); best.left -= take; st.schooled += take; fl.push({ home: hk, dest: best.k, kind: 'school', people: take }); } else st.noSchoolReachable += kids; }
      // errands: a nearby shop (best of 4 samples)
      const sh = shopTiles[c]; if (sh.length) { let best = -1, bd = 1e9; for (let s = 0; s < 4; s++) { const d = sh[(R() * sh.length) | 0], dd = md(hk, d); if (dd < bd) { bd = dd; best = d; } } fl.push({ home: hk, dest: best, kind: 'errand', people: res * TRIPS.errandsPerPersonPerDay * (others / res + 0.3) }); }
      for (const f of fl) this.flows.push(f); if (fl.length) this.homeFlows.set(hk, fl); }
    st.assignMs = performance.now() - t0;
  }

  /** seconds to drive across a tile right now (free flow × BPR congestion) */
  tileCost(k: number) { const N = this.N, i = (k / N) | 0, j = k - i * N, vc = this.volume[k] / Math.max(1, this.w.capacity(i, j)); return this.w.tileSecs(i, j) * (1 + 0.15 * vc ** 4); }

  /** A* between two road tiles; cached per pair until the network or congestion changes */
  route(o: number, d: number): number[] | null {
    if (o < 0 || d < 0 || this.comp[o] < 0 || this.comp[o] !== this.comp[d]) return null;
    const key = o * this.N * this.N + d, hit = this.cache.get(key); if (hit !== undefined) { this.stats.cacheHits++; return hit; }
    const t0 = performance.now(), N = this.N, w = this.w, di = (d / N) | 0, dj = d % N, hmin = 20 / (55 / 3.6);
    const g = new Map<number, number>(), from = new Map<number, number>(), heap: [number, number][] = [];
    const push = (f: number, k: number) => { heap.push([f, k]); let x = heap.length - 1; while (x) { const p = (x - 1) >> 1; if (heap[p][0] <= heap[x][0]) break; [heap[p], heap[x]] = [heap[x], heap[p]]; x = p; } };
    const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let x = 0; for (;;) { const l = 2 * x + 1, r = l + 1; let m = x; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === x) break; [heap[m], heap[x]] = [heap[x], heap[m]]; x = m; } } return top; };
    g.set(o, 0); push(0, o); let found = false;
    while (heap.length) { const [, k] = pop(); if (k === d) { found = true; break; } const i = (k / N) | 0, j = k - i * N, gk = g.get(k)!;
      for (const [a, b] of D4) { const ni = i + a, nj = j + b; if (ni < 0 || nj < 0 || ni >= N || nj >= N || !w.drivable(ni, nj) || !w.linked(i, j, a, b)) continue; const nk = ni * N + nj, ng = gk + this.tileCost(nk);
        if (ng < (g.get(nk) ?? 1e18)) { g.set(nk, ng); from.set(nk, k); push(ng + (Math.abs(ni - di) + Math.abs(nj - dj)) * hmin, nk); } } }
    let path: number[] | null = null; if (found) { path = [d]; let k = d; while (k !== o) { k = from.get(k)!; path.push(k); } path.reverse(); }
    if (this.cache.size > 20000) this.cache.clear(); this.cache.set(key, path); this.stats.routes++; this.stats.routeMs += performance.now() - t0; return path;
  }
  /** travel time in minutes along a path */
  minutes(p: number[]) { let s = 0; for (const k of p) s += this.tileCost(k); return s / 60; }

  /** traffic volume: route a few sampled flows per call and blend into the daily volume map */
  sampleVolume(n = 25) { const fl = this.flows; if (!fl.length) return; const N = this.N, A = 0.05, w = fl.length / n * A; // running estimate: decay, then add this sample scaled up to the whole city
    if (this.volSamples % 10 === 0) { const f = (1 - A) ** 10; for (let k = 0; k < N * N; k++) if (this.volume[k]) this.volume[k] *= f; } // decay in batches (cheaper)
    for (let s = 0; s < n; s++) { const f = fl[this.volCursor++ % fl.length]; if (this.md(f.home, f.dest) <= TRIPS.walkTiles) continue; const p = this.route(this.access[f.home], this.access[f.dest]); if (!p) continue;
      const cars = f.people * TRIPS.carShare[f.kind] / TRIPS.peoplePerCar * 2 * w; for (const k of p) this.volume[k] += cars; }
    if (++this.volSamples % 240 === 0) this.cache.clear(); } // re-route with fresh congestion now and then
  md(x: number, y: number) { const N = this.N; return Math.abs(((x / N) | 0) - ((y / N) | 0)) + Math.abs((x % N) - (y % N)); }

  private byKind: Record<string, { idx: number[]; cum: number[]; tot: number }> | null = null;
  private buildKinds() { const bk: Record<string, { idx: number[]; cum: number[]; tot: number }> = { work: { idx: [], cum: [], tot: 0 }, school: { idx: [], cum: [], tot: 0 }, errand: { idx: [], cum: [], tot: 0 } };
    this.flows.forEach((f, x) => { if (this.md(f.home, f.dest) <= TRIPS.walkTiles) return; const k = bk[f.kind]; k.tot += f.people * TRIPS.carShare[f.kind] / TRIPS.peoplePerCar; k.idx.push(x); k.cum.push(k.tot); }); return (this.byKind = bk); }
  /** cars leaving in this hour, sampled: returns up to `max` trips, each standing for `scale` real cars (O(log n) per pick) */
  departures(hour: number, max: number, R: () => number) {
    const bk = this.byKind ?? this.buildKinds(), parts: { k: string; w: number; o: number; b: number }[] = []; let tot = 0;
    for (const k of ['work', 'school', 'errand']) { const o = TRIPS.out[k][hour] ?? 0, b = TRIPS.back[k][hour] ?? 0, w = bk[k].tot * (o + b); if (w > 0) { parts.push({ k, w, o, b }); tot += w; } }
    const picks: { f: Flow; back: boolean }[] = []; if (tot <= 0) return { trips: picks, total: 0, scale: 1 }; const n = Math.min(max, Math.ceil(tot));
    for (let s = 0; s < n; s++) { let x = R() * tot, pt = parts[0]; for (const q of parts) { if (x < q.w) { pt = q; break; } x -= q.w; }
      const K = bk[pt.k], y = R() * K.tot; let lo = 0, hi = K.cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (K.cum[m] < y) lo = m + 1; else hi = m; }
      picks.push({ f: this.flows[K.idx[lo]], back: R() * (pt.o + pt.b) >= pt.o }); }
    return { trips: picks, total: tot, scale: tot / n };
  }
}
