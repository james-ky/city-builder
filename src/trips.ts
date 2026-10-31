// Agent-based trip simulation (no rendering here). People live in residential tiles as groups
// (workers / kids / others); each group has real destinations (a job tile, a school, shops) reachable on
// the road network. Routes are A* over drivable road tiles weighted by speed and congestion and cached per
// origin/destination road tile. Visible cars are sampled from these trips by the renderer.
import { TRIPS, PARKING, PARK_EFFECT, TRANSIT } from './realism';

export type Kind = 'work' | 'school' | 'errand' | 'leisure' | 'freight';
export type Flow = { home: number; dest: number; kind: Kind; people: number; bus?: number; park?: number; walk?: number; extraMin?: number }; // park: tile where the car ends (walk tiles from there) // people making this trip each day (one way)
export type World = {
  N: number;
  drivable: (i: number, j: number) => boolean;
  linked: (i: number, j: number, a: number, b: number) => boolean; // real road connection between neighbours
  tileSecs: (i: number, j: number) => number;   // free-flow seconds to cross the tile
  capacity: (i: number, j: number) => number;   // vehicles/day
  residents: (i: number, j: number) => number;  // 0 if not housing
  jobs: (i: number, j: number) => number;       // 0 if no jobs
  shop: (i: number, j: number) => boolean;
  industry?: (i: number, j: number) => boolean; // industrial tile (ships freight)
  schools: () => { k: number; seats: number }[];
  parkSpaces: (i: number, j: number) => number;   // spaces at this tile (garages, lots, kerb)
  needsParking: (i: number, j: number) => boolean; // destination with no own parking (dense commercial, big civic)
  seed: number;
  leisure?: () => { k: number; draw: number }[]; // sports parks & playgrounds people drive to
  entrance?: (i: number, j: number) => number; // road tile on the building's front side (-1 none)
  nearRoads?: (i: number, j: number) => number[]; // road tiles within 1 tile of the building (any side, diagonals too)
  transit?: () => { stops: number[]; depot: boolean }; // bus stops (road tiles) and whether a depot runs buses
};
/** vehicles per day for a flow (freight: people = trucks; bus riders leave their car at home) */
export const carsOf = (f: Flow) => f.people * TRIPS.carShare[f.kind] * (1 - (f.bus ?? 0)) / (f.kind === 'freight' ? 1 : TRIPS.peoplePerCar);
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
  occ: Float32Array; spaces: Float32Array; unmet: Float32Array; parkKind: Uint8Array; // peak cars parked / capacity per tile; unmet demand at destinations
  stats = { parkedCars: 0, unparkedCars: 0, lostShoppers: 0, residents: 0, workers: 0, employed: 0, noJobReachable: 0, jobless: 0, kids: 0, schooled: 0, noSchoolReachable: 0, trucks: 0, busRiders: 0, assignMs: 0, routes: 0, cacheHits: 0, routeMs: 0 };
  riders = new Map<number, number>(); // stop tile -> boardings + alightings per day
  private cache = new Map<number, number[] | null>(); version = 0;
  constructor(w: World) { this.w = w; this.N = w.N; const n = w.N * w.N; this.access = new Int32Array(n).fill(-1); this.comp = new Int32Array(n).fill(-1); this.volume = new Float32Array(n); this.occ = new Float32Array(n); this.spaces = new Float32Array(n); this.unmet = new Float32Array(n); this.parkKind = new Uint8Array(n); }

  /** recompute access, components and everybody's destinations (call monthly or after road edits) */
  assign(month = 0) {
    const t0 = performance.now(), { N, w } = this, n = N * N, R = rng(w.seed * 7919 + month);
    this.cache.clear(); this.mcache.clear(); this.version++;
    // road components
    const comp = this.comp.fill(-1); let nc = 0; const q = new Int32Array(n);
    for (let s = 0; s < n; s++) { const si = (s / N) | 0, sj = s - si * N; if (comp[s] >= 0 || !w.drivable(si, sj)) continue;
      let h = 0, t = 0; q[t++] = s; comp[s] = nc;
      while (h < t) { const k = q[h++], i = (k / N) | 0, j = k - i * N; for (const [a, b] of D4) { const ni = i + a, nj = j + b; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const nk = ni * N + nj; if (comp[nk] < 0 && w.drivable(ni, nj) && (w.linked(i, j, a, b) || w.linked(ni, nj, -a, -b))) { comp[nk] = nc; q[t++] = nk; } } }
      nc++; }
    // access road: multi-source BFS up to 3 steps
    const acc = this.access.fill(-1), dist = new Uint8Array(n).fill(255); let h = 0, t = 0;
    for (let k = 0; k < n; k++) if (comp[k] >= 0) { acc[k] = k; dist[k] = 0; q[t++] = k; }
    while (h < t) { const k = q[h++], i = (k / N) | 0, j = k - i * N; if (dist[k] >= 3) continue; for (const [a, b] of D4) { const ni = i + a, nj = j + b; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const nk = ni * N + nj; if (dist[nk] === 255) { dist[nk] = dist[k] + 1; acc[nk] = acc[k]; q[t++] = nk; } } }
    if (w.entrance) for (let k = 0; k < n; k++) { const e = w.entrance((k / N) | 0, k % N); if (e >= 0 && comp[e] >= 0) acc[k] = e; } // trips use the front door
    // destinations per component
    const jobsLeft = new Map<number, number>(), jobTiles: number[][] = [...Array(nc)].map(() => []), shopTiles: number[][] = [...Array(nc)].map(() => []), homes: number[] = [];
    const schools: { k: number; left: number; c: number }[] = [];
    for (let k = 0; k < n; k++) { const i = (k / N) | 0, j = k - i * N, a = acc[k]; if (w.residents(i, j) > 0) homes.push(k); if (a < 0) continue; const c = comp[a];
      const jb = w.jobs(i, j); if (jb > 0) { jobTiles[c].push(k); jobsLeft.set(k, jb); } if (w.shop(i, j)) shopTiles[c].push(k); }
    for (const s of w.schools()) { const a = acc[s.k]; if (a >= 0) schools.push({ k: s.k, left: s.seats, c: comp[a] }); }
    const fun: { k: number; c: number; draw: number }[] = []; for (const l of w.leisure?.() ?? []) { const a = acc[l.k]; if (a >= 0) fun.push({ k: l.k, c: comp[a], draw: l.draw }); }
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
      // leisure: a few residents drive to the most attractive sports park / playground nearby (draw / distance)
      if (fun.length) { let best = -1, bs = 0; for (const l of fun) { if (l.c !== c) continue; const d = md(hk, l.k); if (d > PARK_EFFECT.leisureMaxTiles) continue; const sc = l.draw / (4 + d); if (sc > bs) { bs = sc; best = l.k; } }
        if (best >= 0) fl.push({ home: hk, dest: best, kind: 'leisure', people: res * PARK_EFFECT.leisurePerPersonPerDay }); }
      for (const f of fl) this.flows.push(f); if (fl.length) this.homeFlows.set(hk, fl); }
    // freight: industry ships to shops in reach and out through edge roads (trucks/day from industrial jobs)
    st.trucks = 0; const edges: number[][] = [...Array(nc)].map(() => []);
    for (let k = 0; k < n; k++) { const i = (k / N) | 0, j = k - i * N; if (comp[k] >= 0 && (i === 0 || j === 0 || i === N - 1 || j === N - 1)) edges[comp[k]].push(k); }
    for (let k = 0; k < n; k++) { const i = (k / N) | 0, j = k - i * N, a = acc[k]; if (a < 0 || w.shop(i, j)) continue; const jb = w.jobs(i, j); if (jb <= 0 || !w.industry?.(i, j)) continue;
      const c = comp[a], tr = jb * TRIPS.truckTripsPerIndJob, sh = shopTiles[c], ed = edges[c]; st.trucks += tr;
      const toShop = ed.length ? (sh.length ? TRIPS.freightToShops : 0) : sh.length ? 1 : 0;
      if (toShop > 0) { let best = -1, bd = 1e9; for (let s = 0; s < 4; s++) { const d = sh[(R() * sh.length) | 0], dd = md(k, d); if (dd < bd) { bd = dd; best = d; } } this.flows.push({ home: k, dest: best, kind: 'freight', people: tr * toShop }); }
      if (toShop < 1 && ed.length) { let best = ed[0], bd = 1e9; for (const e of ed) { const dd = md(k, e); if (dd < bd) { bd = dd; best = e; } } this.flows.push({ home: k, dest: best, kind: 'freight', people: tr * (1 - toShop) }); } }
    // transit: people with a stop within a short walk at both ends (and a running bus service) ride some of the time
    this.riders.clear(); st.busRiders = 0; const tn = w.transit?.();
    const loopOK = (st: number[]) => st.every((a, x) => !!this.route(a, st[(x + 1) % st.length])); // riders only when the buses can actually run the loop
    if (tn && tn.depot && tn.stops.length >= 2 && loopOK(tn.stops)) { const near = (k: number) => { let b = -1, bd = TRANSIT.walkTiles + 1; for (const s of tn.stops) { const d = md(k, s); if (d < bd) { bd = d; b = s; } } return [b, bd]; };
      for (const f of this.flows) { const sh = TRANSIT.share[f.kind]; if (!sh || md(f.home, f.dest) <= TRIPS.walkTiles) continue; const [s0, d0] = near(f.home), [s1, d1] = near(f.dest); if (s0 < 0 || s1 < 0 || s0 === s1) continue;
        f.bus = sh * (1 - 0.5 * (d0 + d1) / (2 * TRANSIT.walkTiles)); const r = f.people * f.bus * 2; st.busRiders += f.people * f.bus; this.riders.set(s0, (this.riders.get(s0) ?? 0) + r); this.riders.set(s1, (this.riders.get(s1) ?? 0) + r); } }
    this.parkAll(); st.assignMs = performance.now() - t0;
  }

  /** where the car stops: a parking tile near the destination (or the destination itself) */
  end(f: Flow) { return this.access[f.park ?? f.dest]; }
  /** give every car trip to a parking-short destination a space within walking distance; shoppers who can't park go elsewhere/home */
  private parkAll() { const { N, w } = this, n = N * N, st = this.stats; st.parkedCars = st.unparkedCars = st.lostShoppers = 0;
    this.occ.fill(0); this.unmet.fill(0); for (let k = 0; k < n; k++) this.spaces[k] = w.parkSpaces((k / N) | 0, k % N);
    const order = this.flows.filter(f => f.kind !== 'school' && f.kind !== 'freight' && this.md(f.home, f.dest) > TRIPS.walkTiles && w.needsParking((f.dest / N) | 0, f.dest % N));
    order.sort((a, b) => (a.kind === 'work' ? 0 : 1) - (b.kind === 'work' ? 0 : 1)); // commuters arrive first and take the close spaces
    for (const f of order) { const cars = carsOf(f), need = f.kind === 'work' ? cars : cars * PARKING.shopperStay; let left = need;
      const di = (f.dest / N) | 0, dj = f.dest % N;
      for (let r = 0; r <= PARKING.maxWalkTiles && left > 1e-3; r++) for (let a = -r; a <= r && left > 1e-3; a++) for (const b of r - Math.abs(a) ? [r - Math.abs(a), -(r - Math.abs(a))] : [0]) {
        const i = di + a, j = dj + b; if (i < 0 || j < 0 || i >= N || j >= N) continue; const k = i * N + j, free = this.spaces[k] - this.occ[k]; if (free <= 1e-3 || this.access[k] < 0) continue;
        const take = Math.min(free, left); this.occ[k] += take; left -= take; if (f.park === undefined || r < (f.walk ?? 99)) { f.park = k; f.walk = r; }
        if (r > PARKING.walkTiles) f.extraMin = PARKING.circleMinutes; if (left <= 1e-3) break; }
      st.parkedCars += need - left;
      if (left > 1e-3) { this.unmet[f.dest] += left; st.unparkedCars += left;
        if (f.kind === 'errand') { const lost = f.people * (left / need); f.people -= lost; st.lostShoppers += lost; } else f.extraMin = PARKING.circleMinutes * 2; } } }
  /** seconds to drive across a tile right now (free flow × BPR congestion) */
  tileCost(k: number) { const N = this.N, i = (k / N) | 0, j = k - i * N, vc = this.volume[k] / Math.max(1, this.w.capacity(i, j)); return this.w.tileSecs(i, j) * (1 + 0.15 * vc ** 4); }

  /** commuters and freight may use any road within a tile of the building (back and side roads); shoppers, errands, school and leisure trips use the front door */
  flexible(f: Flow) { return f.kind === 'work' || f.kind === 'freight'; }
  private around(k: number, flex: boolean) { const a = this.access[k]; if (a < 0) return []; if (!flex || !this.w.nearRoads) return [a]; const N = this.N, out = [a], c = this.comp[a];
    for (const r of this.w.nearRoads((k / N) | 0, k % N)) if (this.comp[r] === c && !out.includes(r)) out.push(r); return out; }
  starts(f: Flow) { return this.around(f.home, this.flexible(f)); }
  ends(f: Flow) { const N = this.N, di = (f.dest / N) | 0, dj = f.dest % N; if (f.kind === 'freight' && (di === 0 || dj === 0 || di === N - 1 || dj === N - 1) && this.comp[f.dest] >= 0) return [f.dest]; // edge freight drives to the map edge itself
    return f.park !== undefined ? [this.access[f.park]].filter(x => x >= 0) : this.around(f.dest, this.flexible(f)); }
  /** cheapest route for a flow (home/origin -> destination), choosing among its allowed start and end roads */
  pathOf(f: Flow) { return this.routeMulti(this.starts(f), this.ends(f)); }
  /** the trip home: routed on its own (avenues are one-way, so the outbound path reversed may be illegal) */
  pathBack(f: Flow) { return this.routeMulti(this.ends(f), this.starts(f)); }
  private mcache = new Map<string, number[] | null>();
  routeMulti(os: number[], ds: number[]): number[] | null {
    if (!os.length || !ds.length) return null; if (os.length === 1 && ds.length === 1) return this.route(os[0], ds[0]);
    const key = os.join(',') + '>' + ds.join(','), hit = this.mcache.get(key); if (hit !== undefined) { this.stats.cacheHits++; return hit; }
    const N = this.N, w = this.w, hmin = 20 / (55 / 3.6), dset = new Set(ds), dt = ds.map(d => [(d / N) | 0, d % N]);
    const h = (i: number, j: number) => { let m = 1e9; for (const [a, b] of dt) m = Math.min(m, Math.abs(i - a) + Math.abs(j - b)); return m * hmin; };
    const g = new Map<number, number>(), from = new Map<number, number>(), heap: [number, number][] = [];
    const push = (f: number, k: number) => { heap.push([f, k]); let x = heap.length - 1; while (x) { const p = (x - 1) >> 1; if (heap[p][0] <= heap[x][0]) break; [heap[p], heap[x]] = [heap[x], heap[p]]; x = p; } };
    const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let x = 0; for (;;) { const l = 2 * x + 1, r = l + 1; let m = x; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === x) break; [heap[m], heap[x]] = [heap[x], heap[m]]; x = m; } } return top; };
    for (const o of os) { if (this.comp[o] < 0) continue; g.set(o, this.tileCost(o)); push(g.get(o)! + h((o / N) | 0, o % N), o); }
    let end = -1;
    while (heap.length) { const [fv, k] = pop(); const i = (k / N) | 0, j = k - i * N, gk = g.get(k)!; if (fv > gk + h(i, j) + 1e-9) continue; if (dset.has(k)) { end = k; break; }
      for (const [a, b] of D4) { const ni = i + a, nj = j + b; if (ni < 0 || nj < 0 || ni >= N || nj >= N || !w.drivable(ni, nj) || !w.linked(i, j, a, b)) continue; const nk = ni * N + nj, ng = gk + this.tileCost(nk);
        if (ng < (g.get(nk) ?? 1e18)) { g.set(nk, ng); from.set(nk, k); push(ng + h(ni, nj), nk); } } }
    let path: number[] | null = null; if (end >= 0) { path = [end]; let k = end; while (from.has(k)) { k = from.get(k)!; path.push(k); } path.reverse(); }
    if (this.mcache.size > 20000) this.mcache.clear(); this.mcache.set(key, path); this.stats.routes++; return path; }
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
    for (let s = 0; s < n; s++) { const f = fl[this.volCursor++ % fl.length]; if (this.md(f.home, f.dest) <= TRIPS.walkTiles) continue; const p = this.pathOf(f); if (!p) continue;
      const cars = carsOf(f) * 2 * w; for (const k of p) this.volume[k] += cars; }
    if (++this.volSamples % 240 === 0) { this.cache.clear(); this.mcache.clear(); } } // re-route with fresh congestion now and then
  md(x: number, y: number) { const N = this.N; return Math.abs(((x / N) | 0) - ((y / N) | 0)) + Math.abs((x % N) - (y % N)); }

  private byKind: Record<string, { idx: number[]; cum: number[]; tot: number }> | null = null;
  private buildKinds() { const bk: Record<string, { idx: number[]; cum: number[]; tot: number }> = { work: { idx: [], cum: [], tot: 0 }, school: { idx: [], cum: [], tot: 0 }, errand: { idx: [], cum: [], tot: 0 }, leisure: { idx: [], cum: [], tot: 0 }, freight: { idx: [], cum: [], tot: 0 } };
    this.flows.forEach((f, x) => { if (this.md(f.home, f.dest) <= TRIPS.walkTiles) return; const k = bk[f.kind]; k.tot += carsOf(f); k.idx.push(x); k.cum.push(k.tot); }); return (this.byKind = bk); }
  /** cars leaving in this hour, sampled: returns up to `max` trips, each standing for `scale` real cars (O(log n) per pick) */
  departures(hour: number, max: number, R: () => number) {
    const bk = this.byKind ?? this.buildKinds(), parts: { k: string; w: number; o: number; b: number }[] = []; let tot = 0;
    for (const k of ['work', 'school', 'errand', 'leisure', 'freight']) { const o = TRIPS.out[k][hour] ?? 0, b = TRIPS.back[k][hour] ?? 0, w = bk[k].tot * (o + b); if (w > 0) { parts.push({ k, w, o, b }); tot += w; } }
    const picks: { f: Flow; back: boolean }[] = []; if (tot <= 0) return { trips: picks, total: 0, scale: 1 }; const n = Math.min(max, Math.ceil(tot));
    for (let s = 0; s < n; s++) { let x = R() * tot, pt = parts[0]; for (const q of parts) { if (x < q.w) { pt = q; break; } x -= q.w; }
      const K = bk[pt.k], y = R() * K.tot; let lo = 0, hi = K.cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (K.cum[m] < y) lo = m + 1; else hi = m; }
      picks.push({ f: this.flows[K.idx[lo]], back: R() * (pt.o + pt.b) >= pt.o }); }
    return { trips: picks, total: tot, scale: tot / n };
  }
}
