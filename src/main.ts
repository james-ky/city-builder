import { TripSim } from './trips';
import { PARKING, TRIPS, RESIDENTS, JOBS, POWER_KW, WATER_GPD, CIVIC, ECON, fmtPower, fmtWater, ROAD_TIERS, ROAD_WIDTHS, roadBuild, roadUpkeep, type RoadTier } from './realism';
import { Playlist, Ambience } from './audio';
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { loadManifest, place, placeNight, hasArt, artTex } from './sprites';

const TW = 64, TH = 32;
const hud = document.getElementById('hud')!;

import { chooseCity, type CityCfg } from './newcity';
import { type T, TERRAIN_VERSION } from './terrain';
import { SAVE_FORMAT, SAVE_VERSION, listSaves, getSave, putSave, deleteSave, compress, decompress, b64, unb64, metaFrom, download, type SaveMeta } from './save';
const TT: T[] = ['water', 'sand', 'grass', 'forest'];
const decodeTerrain = (o: any): T[][] => { const n = o.city.size, u = unb64(o.grids.terrain), t: T[][] = []; for (let i = 0; i < n; i++) { t.push([]); for (let j = 0; j < n; j++) t[i].push(TT[u[i * n + j]]); } return t; };
const readFile = (f: File) => decompress(f);
const ago = (ts: number) => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : new Date(ts).toLocaleDateString(); };
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const gameDate = (d: number) => `${MON[Math.floor(d / 30) % 12]} Y${Math.floor(d / 360) + 1}`;
let N = 128; let terrain: T[][] = []; let city: CityCfg = { name: '', size: 128, seed: 0 };
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
  let loaded: any = null; const pend = sessionStorage.getItem('loadId'); sessionStorage.removeItem('loadId');
  if (pend) { try { const r = await getSave(pend); if (r) loaded = await decompress(r.data); } catch (e) { alert('Could not load that save: ' + (e as Error).message); } }
  const boot = loaded ? { cfg: loaded.city, terrain: decodeTerrain(loaded) } : await chooseCity((el, done) => { // New City screen: load / import too
    el.innerHTML = '<button id="ncLoad">📂 Load city…</button> <label class="imp">⬆ Import .city<input type="file" id="ncImp" accept=".city,application/octet-stream" hidden></label><div id="ncList"></div>';
    const list = el.querySelector('#ncList') as HTMLElement;
    (el.querySelector('#ncLoad') as HTMLElement).onclick = async () => { const ss = await listSaves();
      list.innerHTML = ss.length ? ss.map(m => `<button data-id="${m.id}">${m.slot === 'Autosave' ? '⟳ ' : ''}<b>${m.city.replace(/</g, '&lt;')}</b> · ${m.slot.replace(/</g, '&lt;')} · ${m.size}² · ${gameDate(m.day)} · pop ${m.pop.toLocaleString()} · ${ago(m.ts)}</button>`).join('') : '<i>No saved cities yet</i>';
      list.querySelectorAll<HTMLElement>('button[data-id]').forEach(b => b.onclick = async () => { const r = await getSave(b.dataset.id!); if (!r) return; const o = await decompress(r.data); done({ cfg: o.city, terrain: decodeTerrain(o), save: o }); }); };
    (el.querySelector('#ncImp') as HTMLInputElement).onchange = async e => { const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return; try { const o = await readFile(f); done({ cfg: o.city, terrain: decodeTerrain(o), save: o }); } catch (err) { alert('Could not import: ' + (err as Error).message); } };
  });
  if (boot.save) loaded = boot.save;
  city = boot.cfg; N = city.size; terrain = boot.terrain;
  document.title = city.name + ' — City Builder';
  const app = new Application();
  await app.init({ resizeTo: window, background: 0x1b2430, antialias: false });
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
  let lastNightTint = -1, curTint = 0xffffff;
  type Car = { s: Sprite | Graphics; n?: Sprite; key: string; i: number; j: number; pi: number; pj: number; t: number; sp: number; dir: string; ln?: number; route?: number[]; ri?: number; trip?: { kind: string; home: number; dest: number; back: boolean; scale: number }; nx?: [number, number]; res?: number; din?: string; dout?: string; wait?: number };
  const cars: Car[] = []; // vehicles live in objL (depth-sorted with buildings) and survive redraws
  const road: boolean[][] = [...Array(N)].map(() => Array(N).fill(false));
  const pk: number[][] = [...Array(N)].map(() => Array(N).fill(0)); // private parking that grew on a C tile: 1 surface lot, 2 garage
  // road tiers & construction: rtier 1 dirt/2 asphalt/3 concrete; rstage 0 = finished, 1 surveyed, 2 graded, 3 gravel, 4 surfacing;
  // rday = days spent in the current stage; rfrom = tier being upgraded from (old road stays drivable), 0 = new road
  const rtier: number[][] = [...Array(N)].map(() => Array(N).fill(0));
  const rstage: number[][] = [...Array(N)].map(() => Array(N).fill(0));
  const rday: number[][] = [...Array(N)].map(() => Array(N).fill(0));
  const rfrom: number[][] = [...Array(N)].map(() => Array(N).fill(0));
  const rw: number[][] = [...Array(N)].map(() => Array(N).fill(0)); // width: 0 2-lane · 1 street (4-lane) · 2 avenue running along i · 3 avenue along j
  let roadTier: RoadTier = 2, roadW = 0;
  const wKind = (v: number) => v >= 2 ? 2 : v;
  const rpd: number[][] = [...Array(N)].map(() => Array(N).fill(0)); // avenue halves: explicit partner direction bit (NE=1 SE=2 SW=4 NW=8), 0 = none
  const BITV: Record<number, [number, number]> = { 1: [0, -1], 2: [1, 0], 4: [0, 1], 8: [-1, 0] }, BITOF = (a: number, b: number) => b < 0 ? 1 : a > 0 ? 2 : b > 0 ? 4 : 8, OPP: Record<number, number> = { 1: 4, 2: 8, 4: 1, 8: 2 };
  const avCases = new Map<string, number>(); // stopgap avenue shapes drawn as straight half + overlay
  const zone: string[][] = [...Array(N)].map(() => Array(N).fill(''));
  const bld: number[][] = [...Array(N)].map(() => Array(N).fill(0)); // 0 none, 1 low, 2 medium, 3 high
  const zden: number[][] = [...Array(N)].map(() => Array(N).fill(0)); // zone density cap: 1 light, 2 medium, 3 dense (0 = uncapped, legacy/test)
  const zface: number[][] = [...Array(N)].map(() => Array(N).fill(0)); // 0 auto, 1 NE, 2 SE, 3 SW, 4 NW
  let volRef: Float32Array | null = null; // trips.volume once the trip sim exists
  const consT: number[][] = [...Array(N)].map(() => Array(N).fill(0)); // construction target level (0 = none)
  const consD: number[][] = [...Array(N)].map(() => Array(N).fill(0)); // days under construction
  // ---- suburban lots: low-density houses on 1 tile of frontage x 1-3 tiles deep, facing their road ----
  type Lot = { i0: number; j0: number; wi: number; dj: number; dir: 'NE' | 'SE' | 'SW' | 'NW'; v: string };
  const lot: (Lot | null)[][] = [...Array(N)].map(() => Array(N).fill(null));
  const lots = new Set<Lot>();
  const lotTiles = (l: Lot) => { const t: [number, number][] = []; for (let a = 0; a < l.wi; a++) for (let b = 0; b < l.dj; b++) t.push([l.i0 + a, l.j0 + b]); return t; };
  const lotReady = (l: Lot) => lotTiles(l).every(([i, j]) => bld[i][j] >= 1 && !consT[i][j]);
  const lotKey = (l: Lot) => `r1_lot_1x${Math.max(l.wi, l.dj)}_${l.dir}_${l.v}`;
  const CONS_DAYS = 2; // days per construction stage (3 stages)
  const isTall = (z: string, L: number) => L === 3 && (z === 'R' || z === 'C');
  const inb = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N;
  // ---- civic services (plopped buildings) ----
  type Kind = 'edu' | 'police' | 'fire' | 'health' | 'power' | 'water' | 'parking';
  const SERV: Record<string, { name: string; size: number; cost: number; radius: number; kind: Kind; util?: boolean; out?: number; needsWater?: boolean; key?: string }> = {
    school: { name: 'Elementary School', size: 2, cost: 400, radius: 10, kind: 'edu' },
    highschool: { name: 'High School', size: 3, cost: 900, radius: 16, kind: 'edu' },
    police: { name: 'Police Station', size: 2, cost: 500, radius: 12, kind: 'police' },
    fire: { name: 'Fire Station', size: 2, cost: 500, radius: 12, kind: 'fire' },
    clinic: { name: 'Clinic', size: 1, cost: 250, radius: 7, kind: 'health' },
    hospital: { name: 'Hospital', size: 3, cost: 1200, radius: 16, kind: 'health' },
    coal: { name: 'Coal Power Plant', size: 3, cost: 3000, radius: 0, kind: 'power', util: true, out: CIVIC.coal.outKw, key: 'util_coal' },
    wind: { name: 'Wind Turbine', size: 1, cost: 400, radius: 0, kind: 'power', util: true, out: CIVIC.wind.outKw, key: 'util_wind' },
    pump: { name: 'Water Pump', size: 2, cost: 800, radius: 0, kind: 'water', util: true, out: CIVIC.pump.outGpd, needsWater: true, key: 'util_pump' },
    garage: { name: PARKING.garage.name, size: 1, cost: PARKING.garage.cost, radius: 0, kind: 'parking' },
    garage2: { name: PARKING.garage2.name, size: 2, cost: PARKING.garage2.cost, radius: 0, kind: 'parking' },
    tower: { name: 'Water Tower', size: 1, cost: 500, radius: 0, kind: 'water', util: true, out: CIVIC.tower.outGpd, key: 'util_tower' },
  };
  type Civ = { type: string; i: number; j: number; s: number };
  const UPKEEP: Record<string, number> = { school: 60, highschool: 120, police: 80, fire: 80, clinic: 40, hospital: 180, coal: 150, wind: 15, pump: 40, tower: 30, garage: PARKING.garage.upkeep, garage2: PARKING.garage2.upkeep }; // $/month at 100% funding
  const funding: Record<string, number> = Object.fromEntries(Object.keys(SERV).map(k => [k, 1])); // 0..1 per service type
  const civs: Civ[] = [];
  const civAt: (Civ | null)[][] = [...Array(N)].map(() => Array(N).fill(null));
  const KINDS: Kind[] = ['edu', 'police', 'fire', 'health'];
  // ---- power & water ----
  const pline: boolean[][] = [...Array(N)].map(() => Array(N).fill(false)), pipe: boolean[][] = [...Array(N)].map(() => Array(N).fill(false));
  const powered: boolean[][] = [...Array(N)].map(() => Array(N).fill(false)), watered: boolean[][] = [...Array(N)].map(() => Array(N).fill(false));
  const PDEM: Record<string, number[]> = POWER_KW, WDEM: Record<string, number[]> = WATER_GPD; // see src/realism.ts
  const util = { pCap: 0, pUse: 0, pWant: 0, wCap: 0, wUse: 0, wWant: 0 };
  const consumerDemand = (i: number, j: number, D: Record<string, number[]>) => { const c = civAt[i][j]; if (c) return SERV[c.type].util ? 0 : (i === c.i && j === c.j ? ((D === PDEM ? CIVIC[c.type]?.kw : CIVIC[c.type]?.gpd) ?? 0) : 0); return bld[i][j] && zone[i][j] ? D[zone[i][j]][bld[i][j]] : 0; };
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const seenA = new Uint8Array(N * N), wseenA = new Uint8Array(N * N), asgA = new Uint8Array(N * N), dstamp = new Int32Array(N * N), dval = new Uint8Array(N * N);
  const qA = new Int32Array(N * N), q2 = new Int32Array(N * N), prevPW = new Uint8Array(N * N); let stamp = 0;
  const computeUtilities = () => { // flood fills on flat typed arrays (no per-call allocation)
    for (const r of powered) r.fill(false); for (const r of watered) r.fill(false);
    Object.assign(util, { pCap: 0, pUse: 0, pWant: 0, wCap: 0, wUse: 0, wWant: 0 });
    // power: conductors are power lines, zoned tiles (built or not), service and utility buildings
    const conducts = (i: number, j: number) => pline[i][j] || !!zone[i][j] || !!civAt[i][j];
    seenA.fill(0);
    for (let si = 0; si < N; si++) for (let sj = 0; sj < N; sj++) {
      const k0 = si * N + sj; if (seenA[k0] || !conducts(si, sj)) continue;
      let tl = 0; qA[tl++] = k0; seenA[k0] = 1; let cap = 0; const plants = new Set<Civ>();
      for (let h = 0; h < tl; h++) { const k = qA[h], i = (k / N) | 0, j = k - i * N; const c = civAt[i][j]; if (c && SERV[c.type].kind === 'power' && !plants.has(c)) { plants.add(c); cap += SERV[c.type].out!; }
        if (i > 0 && !seenA[k - N] && conducts(i - 1, j)) { seenA[k - N] = 1; qA[tl++] = k - N; } if (i < N - 1 && !seenA[k + N] && conducts(i + 1, j)) { seenA[k + N] = 1; qA[tl++] = k + N; }
        if (j > 0 && !seenA[k - 1] && conducts(i, j - 1)) { seenA[k - 1] = 1; qA[tl++] = k - 1; } if (j < N - 1 && !seenA[k + 1] && conducts(i, j + 1)) { seenA[k + 1] = 1; qA[tl++] = k + 1; } }
      util.pCap += cap;
      for (let h = 0; h < tl; h++) { const k = qA[h], i = (k / N) | 0, j = k - i * N; const d = consumerDemand(i, j, PDEM); if (!d) continue; util.pWant += d; if (cap >= d) { cap -= d; util.pUse += d; markCiv(powered, i, j); } }
    }
    // water: pipes connect to pumps/towers; anything within 3 tiles of a connected pipe (or the facility) is served
    wseenA.fill(0); asgA.fill(0);
    const isNet = (i: number, j: number) => pipe[i][j] || (!!civAt[i][j] && SERV[civAt[i][j]!.type].kind === 'water');
    for (const src of civs) { const k0 = src.i * N + src.j; if (SERV[src.type].kind !== 'water' || wseenA[k0]) continue;
      let tl = 0; qA[tl++] = k0; wseenA[k0] = 1; let cap = 0; const facs = new Set<Civ>();
      for (let h = 0; h < tl; h++) { const k = qA[h], i = (k / N) | 0, j = k - i * N; const c = civAt[i][j]; if (c && SERV[c.type].kind === 'water' && !facs.has(c)) { facs.add(c); cap += SERV[c.type].out!; }
        for (const [a, b] of D4) { const ni = i + a, nj = j + b; if (inb(ni, nj) && !wseenA[ni * N + nj] && isNet(ni, nj)) { wseenA[ni * N + nj] = 1; qA[tl++] = ni * N + nj; } } }
      util.wCap += cap; stamp++; let t2 = 0;
      for (let h = 0; h < tl; h++) { dstamp[qA[h]] = stamp; dval[qA[h]] = 0; q2[t2++] = qA[h]; }
      for (let h = 0; h < t2; h++) { const k = q2[h], i = (k / N) | 0, j = k - i * N; if (dval[k] >= 3) continue;
        for (const [a, b] of D4) { const ni = i + a, nj = j + b; if (!inb(ni, nj)) continue; const nk = ni * N + nj; if (dstamp[nk] !== stamp) { dstamp[nk] = stamp; dval[nk] = dval[k] + 1; q2[t2++] = nk; } } }
      for (let h = 0; h < t2; h++) { const k = q2[h]; if (asgA[k]) continue; asgA[k] = 1; const i = (k / N) | 0, j = k - i * N; const d = consumerDemand(i, j, WDEM); if (!d) continue; util.wWant += d; if (cap >= d) { cap -= d; util.wUse += d; markCiv(watered, i, j); } }
    }
    for (const k of zlist) { const i = (k / N) | 0, j = k - i * N, v = (powered[i][j] ? 1 : 0) | (watered[i][j] ? 2 : 0); if (v !== prevPW[k]) { prevPW[k] = v; chunkOf(i, j).iconDirty = true; } }
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
  const pre = new Float64Array((N + 1) * (N + 1));
  const computeRisks = () => { // crime grows with density nearby (5x5 window via prefix sums), police coverage suppresses it; fire risk likewise
    const W = N + 1;
    for (let i = 0; i < N; i++) { let row = 0; for (let j = 0; j < N; j++) { row += bld[i][j] ** 2; pre[(i + 1) * W + j + 1] = pre[i * W + j + 1] + row; } }
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const a = Math.max(0, i - 2), b = Math.max(0, j - 2), c = Math.min(N, i + 3), d = Math.min(N, j + 3);
      const dens = pre[c * W + d] - pre[a * W + d] - pre[c * W + b] + pre[a * W + b];
      crime[i][j] = dens * 0.08 * (1 - 0.85 * cov.police[i][j]);
      fireRisk[i][j] = bld[i][j] ? (zone[i][j] === 'I' ? 2 : 1) * bld[i][j] * (1 - 0.85 * cov.fire[i][j]) : 0;
    }
  };
  const resCap = (i: number, j: number) => CAP.R[bld[i][j]] * (1 + 0.15 * cov.health[i][j]); // health care raises population
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
  // shore_sand when strictly more of the land neighbours that set bits are sand than not; sand_edge bits count sand or water (or off-map)
  const SHORE_NB: [number, number, number][] = [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0], [16, -1, -1], [32, 1, -1], [64, 1, 1], [128, -1, 1]];
  const sandyShore = (i: number, j: number, m: number) => { let s = 0, g = 0; for (const [bit, a, b] of SHORE_NB) if (m & bit) { if (inb(i + a, j + b) && terrain[i + a][j + b] === 'sand') s++; else g++; } return s > g; };
  const beachy = (i: number, j: number) => !inb(i, j) || terrain[i][j] === 'sand' || terrain[i][j] === 'water';
  const sandKey = hasArt('sand') ? 'sand' : hasArt('grass') ? 'grass' : 'sand';
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
  const FACE: [string, number, number][] = [['Auto', 0, 0], ['NE', 0, -1], ['SE', 1, 0], ['SW', 0, 1], ['NW', -1, 0]]; // facing -> offset to the front road tile
  const capOf = (i: number, j: number) => zden[i][j] || 3;
  /** the road side a building on (i,j) faces: locked facing if that side has a road, else on Auto the busiest adjacent road (stable NE,SE,SW,NW tie-break); 0 = no road on the front */
  const autoFace = (i: number, j: number) => { let best = 0, bv = -1; for (let f = 1; f <= 4; f++) { const a = i + FACE[f][1], b = j + FACE[f][2]; if (!isRoad(a, b)) continue; const v = volRef ? volRef[a * N + b] : 0; if (v > bv + 1e-6) { bv = v; best = f; } } return best; };
  const faceFor = (i: number, j: number, want: number) => want ? (isRoad(i + FACE[want][1], j + FACE[want][2]) ? want : 0) : autoFace(i, j);
  const facingOf = (i: number, j: number) => faceFor(i, j, zface[i][j]);
  /** every building needs its own road: a lot counts if its front edge touches a road on its facing side */
  const hasAccess = (i: number, j: number): boolean => { const l = lot[i][j]; if (l) { const f = FACE.findIndex(x => x[0] === l.dir); for (const [a, b] of lotTiles(l)) if (isRoad(a + FACE[f][1], b + FACE[f][2])) return true; return false; } return facingOf(i, j) > 0; };
  /** road tile in front of the building's entrance (-1 none) */
  const entranceOf = (i: number, j: number) => { if (!zone[i][j]) return -1; const l = lot[i][j]; if (l) { const f = FACE.findIndex(x => x[0] === l.dir); for (const [a, b] of lotTiles(l)) { const x = a + FACE[f][1], y = b + FACE[f][2]; if (isRoad(x, y)) return x * N + y; } return -1; } const f = facingOf(i, j); return f ? (i + FACE[f][1]) * N + j + FACE[f][2] : -1; };
  const drawFace = (i: number, j: number) => { const l = lot[i][j]; if (l) return FACE.findIndex(x => x[0] === l.dir); return facingOf(i, j) || zface[i][j] || 2; };
  const DENN = ['', 'Light', 'Medium', 'Dense'];
  const CAPNAME: Record<string, string[]> = { R: ['', 'single-family homes', 'up to mid-rise apartments', 'up to towers'], C: ['', 'storefronts', 'main-street blocks & small offices', 'up to office towers'], I: ['', 'workshops', 'mid-size factories', 'heavy industry'] };
  let zoneDen = 2, zoneFace = 0;
  /** (i,j)->(i+a,j+b) is a real road connection: the two halves of an avenue sit side by side but are not joined */
  const partner = (i: number, j: number, a: number, b: number) => { const d = rpd[i][j]; return !!d && (a !== 0) !== (b !== 0) && BITOF(a, b) === d && inb(i + a, j + b) && road[i + a][j + b] && rpd[i + a][j + b] === OPP[d]; };
  const guessPartners = () => { for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) rpd[i][j] = 0; // old saves: pair halves side by side (along-i avenues pair on j, along-j on i)
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = rw[i][j]; if (v < 2 || rpd[i][j]) continue; const [a, b] = v === 2 ? [0, 1] : [1, 0];
      if (inb(i + a, j + b) && rw[i + a][j + b] === v && !rpd[i + a][j + b]) { rpd[i][j] = BITOF(a, b); rpd[i + a][j + b] = OPP[BITOF(a, b)]; } } };
  const link = (i: number, j: number, a: number, b: number) => isRoad(i + a, j + b) && !partner(i, j, a, b);
  const drivable = (i: number, j: number) => inb(i, j) && road[i][j] && (rstage[i][j] === 0 || rfrom[i][j] > 0);
  const roadWorks: number[] = []; // tiles under construction (i*N+j)
  const startRoad = (i: number, j: number, t: RoadTier, w = 0, pd = 0) => { rw[i][j] = w; rpd[i][j] = w >= 2 ? pd : 0; const up = road[i][j] && rtier[i][j] > 0 && rstage[i][j] === 0; rfrom[i][j] = up ? rtier[i][j] : 0; rtier[i][j] = t; rstage[i][j] = up ? 3 : 1; rday[i][j] = 0; road[i][j] = true; roadWorks.push(i * N + j); };
  const tickRoads = () => { for (let k = roadWorks.length - 1; k >= 0; k--) { const i = (roadWorks[k] / N) | 0, j = roadWorks[k] - i * N;
      if (!road[i][j] || rstage[i][j] === 0) { roadWorks.splice(k, 1); continue; }
      const days = ROAD_TIERS[rtier[i][j] as RoadTier].days;
      if (++rday[i][j] >= days[rstage[i][j] - 1]) { rday[i][j] = 0; rstage[i][j]++; if (rstage[i][j] > days.length) { rstage[i][j] = 0; rfrom[i][j] = 0; roadWorks.splice(k, 1); } markDirty(i, j, i, j); } } };
  // ---- chunked rendering: 16x16-tile chunks per layer, built lazily when visible, rebuilt only when dirty ----
  const CH = 16, NCH = Math.ceil(N / CH);
  type Bld = { x: number; y: number; z: string; L: number; seed: number };
  // intersections: 'L' = traffic lights, 'S' = stop signs on the listed approaches (dir = the way approaching traffic travels)
  type TL = { axis: number; sp: Record<string, Sprite>; nt: Record<string, Sprite | undefined>; st: string; ph: number };
  const ctrl = new Map<number, { k: 'L' | 'S'; stops: string[]; ph: number }>();
  const APPR: [number, number, string][] = [[0, 1, 'NE'], [-1, 0, 'SE'], [0, -1, 'SW'], [1, 0, 'NW']]; // neighbour offset -> dir of traffic coming from it
  const CORNER: Record<string, [number, number]> = { NE: [0, 11.2], SE: [-22.4, 0], SW: [0, -11.2], NW: [22.4, 0] };
  const straightLen = (i: number, j: number, a: number, b: number) => { let n = 0; for (let k = 1; k <= 8 && isRoad(i + a * k, j + b * k); k++) n++; return n; };
  const classify = (i: number, j: number) => { const ap = APPR.filter(([a, b]) => link(i, j, a, b)); if (ap.length < 3) return null;
    if (ap.length === 4) { const act = activity(i, j), busy = straightLen(i, j, 1, 0) + straightLen(i, j, -1, 0) >= 6 && straightLen(i, j, 0, 1) + straightLen(i, j, 0, -1) >= 6;
      return busy && act >= 40 ? { k: 'L' as const, stops: [], ph: (i * 7 + j * 13) % 15 } : { k: 'S' as const, stops: ap.map(x => x[2]), ph: 0 }; }
    const stem = ap.find(([a, b]) => !link(i, j, -a, -b)) ?? ap[0]; return { k: 'S' as const, stops: [stem[2]], ph: 0 }; }; // T: only the side road stops
  const LCYCLE = 15, lightState = (axis: number, ph: number) => { const t = (clock + ph) % LCYCLE, u = axis ? (t + 7.5) % LCYCLE : t; return u < 6 ? 'green' : u < 7.5 ? 'yellow' : 'red'; };
  const axisOf = (dir: string) => dir === 'SE' || dir === 'NW' ? 0 : 1;
  type Chunk = { ci: number; cj: number; g: Container; gr: Container; rd: Container; zn: Container; ob: Container; pp: Container; ic: Container;
    ground: boolean; built: boolean; dirty: boolean; iconDirty: boolean; vis: boolean; seen: number; lights: Sprite[]; winds: Sprite[]; trees: { s: any; ph: number }[]; blds: Bld[]; roads: [number, number][]; tls: TL[]; trucks: any[];
    tint: number; la: number; x0: number; x1: number; y0: number; y1: number };
  const chunks: Chunk[] = [];
  objL.sortableChildren = true;
  for (let ci = 0; ci < NCH; ci++) for (let cj = 0; cj < NCH; cj++) {
    const mk = (L: Container) => { const c = new Container(); c.visible = false; L.addChild(c); return c; }; // render groups: static chunk content is not re-walked every frame
    const ob = mk(objL); ob.sortableChildren = true; ob.zIndex = ci + cj; // chunks drawn back to front; inside a chunk sprites sort by screen y
    const i0 = ci * CH, j0 = cj * CH, i1 = Math.min(N, i0 + CH) - 1, j1 = Math.min(N, j0 + CH) - 1;
    chunks.push({ ci, cj, g: mk(groundL), gr: mk(gridL), rd: mk(roadL), zn: mk(zoneL), ob, pp: mk(pipeL), ic: mk(iconL), ground: false, built: false, dirty: true, iconDirty: true, vis: false, seen: 0,
      lights: [], winds: [], trees: [], blds: [], roads: [], tls: [], trucks: [], tint: -1, la: -1, x0: (i0 - j1) * 32 - 96, x1: (i1 - j0) * 32 + 96, y0: (i0 + j0) * 16 - 240, y1: (i1 + j1) * 16 + 48 });
  }
  const chunkOf = (i: number, j: number) => chunks[Math.min(NCH - 1, Math.max(0, Math.floor(i / CH))) * NCH + Math.min(NCH - 1, Math.max(0, Math.floor(j / CH)))];
  let ovDirty = true;
  const markDirty = (ia: number, ja: number, ib: number, jb: number) => { ovDirty = true;
    const c0 = Math.max(0, Math.floor((Math.min(ia, ib) - 1) / CH)), c1 = Math.min(NCH - 1, Math.floor((Math.max(ia, ib) + 1) / CH));
    const d0 = Math.max(0, Math.floor((Math.min(ja, jb) - 1) / CH)), d1 = Math.min(NCH - 1, Math.floor((Math.max(ja, jb) + 1) / CH));
    for (let a = c0; a <= c1; a++) for (let b = d0; b <= d1; b++) chunks[a * NCH + b].dirty = true; };
  const markAll = () => { ovDirty = true; for (const c of chunks) { c.dirty = true; c.iconDirty = true; } };
  const chunkTiles = (ch: Chunk, f: (i: number, j: number) => void) => { const i0 = ch.ci * CH, j0 = ch.cj * CH, i1 = Math.min(N, i0 + CH) - 1, j1 = Math.min(N, j0 + CH) - 1;
    for (let s = i0 + j0; s <= i1 + j1; s++) for (let i = Math.max(i0, s - j1); i <= Math.min(i1, s - j0); i++) f(i, s - i); };
  const isWood = (i: number, j: number) => inb(i, j) && terrain[i][j] === 'forest' && !zone[i][j] && !road[i][j] && !civAt[i][j] && !pline[i][j];
  const forestKey = (i: number, j: number) => { const m = (isWood(i, j - 1) ? 1 : 0) | (isWood(i + 1, j) ? 2 : 0) | (isWood(i, j + 1) ? 4 : 0) | (isWood(i - 1, j) ? 8 : 0); // NE SE SW NW
    return m === 15 || !hasArt('forest_edge_' + m) ? 'forest' : 'forest_edge_' + m; };
  const buildGround = (ch: Chunk) => { chunkTiles(ch, (i, j) => {
    const { x, y } = toScreen(i, j), t = terrain[i][j];
    let key: string = t === 'sand' ? sandKey : t === 'forest' ? 'grass' : t;
    if (t === 'water') { const m = shoreMask(i, j); if (m && hasArt('shore_' + m)) key = (sandyShore(i, j, m) && hasArt('shore_sand_' + m) ? 'shore_sand_' : 'shore_') + m; }
    else if (t === 'sand') { const m = (beachy(i, j - 1) ? 1 : 0) | (beachy(i + 1, j) ? 2 : 0) | (beachy(i, j + 1) ? 4 : 0) | (beachy(i - 1, j) ? 8 : 0); if (m !== 15 && hasArt('sand_edge_' + m)) key = 'sand_edge_' + m; }
    place(key, x, y, ch.g, seedOf(i, j)); }); 
    // grid: one Graphics of lines per chunk (much cheaper to fill than a sprite per tile)
    const g = new Graphics(), i0 = ch.ci * CH, j0 = ch.cj * CH, i1 = Math.min(N, i0 + CH), j1 = Math.min(N, j0 + CH), pt = (i: number, j: number) => toScreen(i - 0.5, j - 0.5);
    for (let i = i0; i <= i1; i++) { const a = pt(i, j0), b = pt(i, j1); g.moveTo(a.x, a.y).lineTo(b.x, b.y); }
    for (let j = j0; j <= j1; j++) { const a = pt(i0, j), b = pt(i1, j); g.moveTo(a.x, a.y).lineTo(b.x, b.y); }
    g.stroke({ width: 1, color: 0xffffff, alpha: 0.16 }); ch.gr.addChild(g); ch.ground = true; };
  // road tile: tier art if City Art Studio has drawn it (road_<tier>_<mask>), else the asphalt art recoloured, plus procedural construction overlays
  const TIERN = ['', 'dirt', 'asphalt', 'concrete'];
  const drawRoadTile = (ch: Chunk, i: number, j: number, x: number, y: number, m: number, seed: number) => {
    const st = rstage[i][j], shownTier = st === 0 ? rtier[i][j] : rfrom[i][j], base = 'road_' + (m || (hasArt('road_0') ? 0 : 1));
    let wk = wKind(rw[i][j]), wname = ['road', 'street', 'avenue'][wk];
    let artM: number | string = m, over = 0, picked = false; // avenue art is keyed by its straight-half shape: along-axis bits + the partner bit (median side); 15 = intersection
    if (wk === 2) { const pd = rpd[i][j], axis = rw[i][j] === 2 ? 10 : 5;
      if (pd) { const DN: Record<number, string> = { 1: 'NE', 2: 'SE', 4: 'SW', 8: 'NW' }, O = OPP[pd], Lb = pd === 1 ? 8 : pd >> 1, Rb = pd === 8 ? 1 : pd << 1, [qi, qj] = [i + BITV[pd][0], j + BITV[pd][1]];
        const lm = (a: number, b: number) => [1, 2, 4, 8].reduce((t, bb) => t | (link(a, b, BITV[bb][0], BITV[bb][1]) ? bb : 0), 0), pOut = inb(qi, qj) && rpd[qi][qj] === O ? !!(lm(qi, qj) & pd) : false;
        const ex = m === (Lb | Rb) ? (pOut ? `gap_${DN[pd]}` : '') : m === (Lb | Rb | O) ? (pOut ? `cross_${DN[pd]}` : `tee_${DN[pd]}`) : m === Lb ? `end_${DN[pd]}_L` : m === Rb ? `end_${DN[pd]}_R` : m === (Lb | O) ? `corner_${DN[pd]}_L` : m === (Rb | O) ? `corner_${DN[pd]}_R` : null;
        if (ex !== null && shownTier && (ex === '' || hasArt(`avenue_${TIERN[shownTier]}_${ex}`))) { artM = ex === '' ? (m | pd) : ex; picked = true; }
      }
      if (pd && !picked) { artM = axis | pd; over = m & ~axis; const cs = ((m & axis) === axis ? 'side-street T' : m === 0 ? 'isolated half' : over ? 'end/corner with side street' : 'avenue end') + ' m=' + m + ' pd=' + pd; avCases.set(cs, (avCases.get(cs) ?? 0) + 1); } }
    let jn = false; if (!wk && shownTier) for (const bb of [1, 2, 4, 8]) { const [di, dj] = BITV[bb]; if ((m & bb) && inb(i + di, j + dj) && rw[i + di][j + dj] >= 2) jn = true; } // 2-lane road meeting an avenue: 12 m street junction tile so it matches the avenue's outer-edge profile
    if (jn && hasArt(`street_${TIERN[shownTier]}_${m}`)) { wk = 1; wname = 'street'; }
    if (shownTier && wk && hasArt(`${wname}_${TIERN[shownTier]}_${artM}`)) { place(`${wname}_${TIERN[shownTier]}_${artM}`, x, y, ch.rd, seed);
      if (over) { const g = new Graphics(), col = shownTier === 3 ? 0xa9a59b : 0x4a4b50; // stopgap intersection overlay: pave over the median/curb toward each side street
        for (const b of [1, 2, 4, 8]) if (over & b) { const [di, dj] = BITV[b], e = toScreen(i + di / 2, j + dj / 2), q = toScreen(i, j), ex = x + e.x - q.x, ey = y + e.y - q.y;
          g.moveTo(x, y).lineTo(ex, ey).stroke({ width: 13, color: col }); }
        ch.rd.addChild(g); } }
    else if (shownTier) { const tk = `road_${TIERN[shownTier]}_${m}`;
      if (hasArt(tk)) place(tk, x, y, ch.rd, seed);
      else { const o = place(base, x, y, ch.rd, seed) as any; if (shownTier === 1) o.tint = 0xc49a64;
        if (shownTier === 3) { const g = new Graphics().poly([x, y - 15, x + 31, y, x, y + 15, x - 31, y]).fill({ color: 0xd8d4c8, alpha: 0.45 }); g.moveTo(x - 15, y - 7.5).lineTo(x + 15, y + 7.5).stroke({ width: 0.6, color: 0x8a867c, alpha: 0.6 }); ch.rd.addChild(g); } } }
    if (shownTier && wk && !hasArt(`${wname}_${TIERN[shownTier]}_${artM}`)) { // placeholder lane paint for wider roads
      const g = new Graphics(), along: [number, number] | null = m === 5 ? [-32, 16] : m === 10 ? [32, 16] : null;
      if (along) { const L = Math.hypot(...along), px = -along[1] / L, py = along[0] / L, ux = along[0] / L, uy = along[1] / L;
        if (wk === 1) { for (const o of [-5.4, 5.4]) for (let k = -2; k < 2; k++) g.moveTo(x + px * o + ux * (k * 9 + 1), y + py * o + uy * (k * 9 + 1)).lineTo(x + px * o + ux * (k * 9 + 5), y + py * o + uy * (k * 9 + 5));
          g.stroke({ width: 0.8, color: 0xffffff, alpha: 0.85 }); for (const o of [-0.7, 0.7]) g.moveTo(x + px * o - ux * 17, y + py * o - uy * 17).lineTo(x + px * o + ux * 17, y + py * o + uy * 17); g.stroke({ width: 0.6, color: 0xf2c230 }); }
        else { const ax = rw[i][j] === 2 ? 0 : 1, side = [0, 1, -1].find(d => d && partner(i, j, ax ? d : 0, ax ? 0 : d)) ?? 0; // median on the edge shared with the other half
          const e = toScreen(i + (ax ? side / 2 : 0), j + (ax ? 0 : side / 2)), q = toScreen(i, j), mx = x + e.x - q.x, my = y + e.y - q.y;
          g.moveTo(mx - ux * 17, my - uy * 17).lineTo(mx + ux * 17, my + uy * 17).stroke({ width: 4, color: 0x9a9a8c }).moveTo(mx - ux * 16, my - uy * 16).lineTo(mx + ux * 16, my + uy * 16).stroke({ width: 2.4, color: 0x5d9a48 });
          for (let k = -2; k < 2; k++) g.moveTo(x + ux * (k * 9 + 1), y + uy * (k * 9 + 1)).lineTo(x + ux * (k * 9 + 5), y + uy * (k * 9 + 5)); g.stroke({ width: 0.8, color: 0xffffff, alpha: 0.85 }); } }
      else if (wk === 2 && [7, 11, 13, 14, 15].includes(m)) { for (const [, , d] of APPR.filter(([a, b]) => link(i, j, a, b))) { const [ox, oy] = CORNER[d], cx = x + ox * 0.55, cy = y + oy * 0.55; g.poly([cx - 2, cy, cx + 2, cy, cx, cy - 3]).fill({ color: 0xffffff, alpha: 0.85 }); } } // turn-lane arrows
      ch.rd.addChild(g); }
    if (st === 0) return;
    const key = `road_stage_${['', 'surveyed', 'graded', 'gravel', 'surfacing'][st]}_${m}`;
    if (hasArt(key)) { place(key, x, y, ch.rd, seed); }
    else { const g = new Graphics(), dia = [x, y - 15, x + 31, y, x, y + 15, x - 31, y];
      if (st === 1) { g.moveTo(x - 20, y - 10).lineTo(x + 20, y + 10).stroke({ width: 1, color: 0xff8a00, alpha: 0.9 }); // survey paint line + stakes
        for (const [a, b] of [[-14, -2], [14, 2], [-2, 9], [2, -9]]) g.rect(x + a - 0.6, y + b - 5, 1.2, 5).fill(0xe8d3a0).rect(x + a - 0.8, y + b - 5, 1.6, 1.4).fill(0xff3d00); }
      else if (rfrom[i][j]) { g.poly(dia).fill({ color: st === 3 ? 0x8f8676 : 0x3d3d40, alpha: 0.35 }); for (const [a, b] of [[-16, 6], [16, -6]]) g.poly([x + a, y + b - 4, x + a + 2, y + b, x + a - 2, y + b]).fill(0xff7a00); }
      else g.poly(dia).fill(st === 2 ? 0x8b6a45 : st === 3 ? 0x9a9284 : (rtier[i][j] === 3 ? 0xbdb9ae : 0x3f4045));
      if (st === 3 && !rfrom[i][j]) for (let k = 0; k < 14; k++) { const h = (seed * (k + 3) * 2654435761) >>> 0; g.rect(x - 14 + (h % 28), y - 6 + ((h >> 8) % 12), 1, 1).fill(0x6c665c); }
      ch.rd.addChild(g);
      if (st === 2 || st === 4 || (st === 3 && seed % 2 === 0)) { // a little work truck shuttling across the tile
        const kind = st === 2 ? 'grader' : st === 3 ? 'dump' : rtier[i][j] === 3 ? 'mixer' : 'paver', axI = (m & 10) && !(m & 5), dirs = axI ? ['SE', 'NW'] : ['SW', 'NE'];
        const t: any = hasArt(`work_truck_${kind}_${dirs[0]}`) ? place(`work_truck_${kind}_${dirs[0]}`, x, y, ch.ob, seed) : new Graphics().rect(-2.6, -1.6, 5.2, 3.2).fill(st === 4 ? 0x555555 : 0xf2b705).rect(1, -1.6, 1.6, 3.2).fill(0x333333);
        if (!(t.parent)) ch.ob.addChild(t); if (t instanceof Graphics) t.rotation = Math.atan2(16, axI ? 32 : -32);
        t.__truck = { x, y, ph: (seed % 100) / 16, vx: axI ? 12 : -12, vy: 6, keys: dirs.map(d => `work_truck_${kind}_${d}`), d: 0 }; t.zIndex = y + 0.4; ch.trucks.push(t); } } };
  // parking art (v3-soft3d-g); procedural fallback if missing: parking_lot / parking_garage / civic_garage / civic_garage2
  const drawParking = (ch: Chunk, i: number, j: number, x: number, y: number, seed: number, kind: number, size = 1) => {
    const key = kind === 1 ? 'parking_lot' : kind === 2 ? 'parking_garage' : size === 2 ? 'civic_garage2' : 'civic_garage';
    if (hasArt(key)) { const lyr = kind === 1 ? ch.zn : ch.ob, o = place(key, x, y, lyr, seed); o.zIndex = y; const l = placeNight(key, x, y, ch.ob, seed); if (l) { l.zIndex = y + 0.001; l.alpha = 0; l.visible = false; (l as any).__light = true; ch.lights.push(l); } return; }
    const g = new Graphics(), hw = 32 * size, hh = 16 * size;
    if (kind === 1) { g.poly([x, y - 15, x + 31, y, x, y + 15, x - 31, y]).fill(0x54575c); for (let k = -2; k <= 2; k++) g.moveTo(x + k * 8 - 6, y + k * 4 - 7).lineTo(x + k * 8 + 2, y + k * 4 - 3).stroke({ width: 0.7, color: 0xffffff, alpha: 0.8 }); ch.zn.addChild(g); return; }
    const lv = kind === 2 || size === 2 ? 5 : 4, H = lv * 6; // stacked concrete decks with dark openings
    g.poly([x - hw + 2, y, x, y + hh - 1, x, y + hh - 1 - H, x - hw + 2, y - H]).fill(0xb9b6ae).poly([x, y + hh - 1, x + hw - 2, y, x + hw - 2, y - H, x, y + hh - 1 - H]).fill(0x9d9a92).poly([x, y - hh + 1 - H, x + hw - 2, y - H, x, y + hh - 1 - H, x - hw + 2, y - H]).fill(0xcfccc4);
    for (let l = 0; l < lv; l++) { const yy = -l * 6 - 3.5; g.poly([x - hw + 4, y + yy - 1, x - 2, y + hh + yy - 2, x - 2, y + hh + yy, x - hw + 4, y + yy + 1]).fill(0x3a3c40).poly([x + 2, y + hh + yy - 2, x + hw - 4, y + yy - 1, x + hw - 4, y + yy + 1, x + 2, y + hh + yy]).fill(0x2f3134); }
    if (kind === 3) g.circle(x, y - H - 1, 4.5).fill(0x1e5bd8).stroke({ width: 1, color: 0xffffff }); // blue P sign for city garages
    g.zIndex = y; ch.ob.addChild(g); };
  const drawChunk = (ch: Chunk) => {
    for (const o of [...ch.ob.children]) if (!(o as any).__veh) { ch.ob.removeChild(o); o.destroy(); }
    clear(ch.rd); clear(ch.zn); clear(ch.pp); ch.lights = []; ch.winds = []; ch.trees = []; ch.blds = []; ch.roads = []; ch.tls = []; ch.trucks = []; ch.tint = -1; ch.la = -1;
    const P = (key: string, x: number, y: number, seed: number, z: number) => { const o = place(key, x, y, ch.ob, seed); o.zIndex = z; return o; };
    const PN = (key: string, x: number, y: number, seed: number, z: number) => { const l = placeNight(key, x, y, ch.ob, seed); if (l) { l.zIndex = z; l.alpha = 0; l.visible = false; (l as any).__light = true; ch.lights.push(l); } return l; };
    chunkTiles(ch, (i, j) => {
      const { x, y } = toScreen(i, j), seed = seedOf(i, j);
      const cv = civAt[i][j];
      if (cv) {
        place('civic_lot', x, y, ch.zn, seed);
        if (i === cv.i + cv.s - 1 && j === cv.j) { // depth key i0+j0+size-1 (manifest placement); anchor = footprint centre
          const c = toScreen(cv.i + (cv.s - 1) / 2, cv.j + (cv.s - 1) / 2), key = SERV[cv.type].key ?? 'civic_' + cv.type;
          if (SERV[cv.type].kind === 'parking' && !hasArt(key)) { drawParking(ch, i, j, c.x, c.y, seed, 3, cv.s); return; }
          const o = P(key, c.x, c.y, seed, y); PN(key, c.x, c.y, seed, y); if (cv.type === 'wind' && o instanceof Sprite) { (o as any).__ph = seed % 4; ch.winds.push(o); }
        }
      } else if (pline[i][j] && !road[i][j]) {
        const pl = (a: number, b: number) => inb(a, b) && (pline[a][b] || (!!civAt[a][b] && SERV[civAt[a][b]!.type].kind === 'power'));
        P('power_line_' + ((pl(i, j - 1) ? 1 : 0) | (pl(i + 1, j) ? 2 : 0) | (pl(i, j + 1) ? 4 : 0) | (pl(i - 1, j) ? 8 : 0)), x, y, seed, y);
      } else if (road[i][j]) {
        const m = (link(i, j, 0, -1) ? 1 : 0) | (link(i, j, 1, 0) ? 2 : 0) | (link(i, j, 0, 1) ? 4 : 0) | (link(i, j, -1, 0) ? 8 : 0);
        drawRoadTile(ch, i, j, x, y, m, seed); if (drivable(i, j)) { ch.roads.push([i, j]); if (rw[i][j]) ch.roads.push([i, j]); } // wider roads carry more traffic
        const cc = classify(i, j); if (cc) ctrl.set(i * N + j, cc); else ctrl.delete(i * N + j);
        if (cc) for (const [, , dir] of APPR.filter(([a, b]) => link(i, j, a, b))) { const [ox, oy] = CORNER[dir], px = x + ox, py = y + oy, z = y + 0.5 + (py - y) * 0.001; // with the intersection tile, after the road
          if (cc.k === 'S') { if (cc.stops.includes(dir)) { P('prop_stop_sign_' + dir, px, py, seed, z); PN('prop_stop_sign_' + dir, px, py, seed, z); } }
          else { const tl: TL = { axis: axisOf(dir), sp: {}, nt: {}, st: '', ph: cc.ph };
            for (const c of ['red', 'yellow', 'green']) { const o = P(`prop_traffic_light_${c}_${dir}`, px, py, seed, z) as Sprite; o.visible = false; tl.sp[c] = o;
              const n = placeNight(`prop_traffic_light_${c}_${dir}`, px, py, ch.ob, seed); if (n) { n.zIndex = z + 0.0001; n.visible = false; } tl.nt[c] = n; }
            ch.tls.push(tl); } }
      } else if (zone[i][j]) {
        if (pk[i][j]) drawParking(ch, i, j, x, y, seed, pk[i][j]);
        else if (!bld[i][j] && !consT[i][j]) { const o = place('zone_' + zone[i][j], x, y, ch.zn, seed), d = zden[i][j] || 2; o.alpha = [1, 0.4, 0.75, 1][d]; if (d === 3) (o as any).tint = 0xb0b0b0; }
        if (!hasAccess(i, j) && !lot[i][j]) { const g = new Graphics(); g.circle(x, y - 2, 4).fill({ color: 0xff3030, alpha: 0.9 }).stroke({ width: 1.5, color: 0xffffff }); g.moveTo(x - 2.5, y - 2).lineTo(x + 2.5, y - 2).stroke({ width: 1.5, color: 0xffffff }); g.zIndex = y + 50; ch.ob.addChild(g); } // landlocked marker
        const flip = (o: any) => { if (o && (drawFace(i, j) === 3 || drawFace(i, j) === 4)) o.scale.x = -Math.abs(o.scale.x); }; // stopgap: SE-facing art mirrored for SW/NW
        if (consT[i][j]) flip(P(`construction_1x1_${isTall(zone[i][j], consT[i][j]) ? 'tall_' : ''}stage${Math.min(3, 1 + Math.floor(consD[i][j] / CONS_DAYS))}`, x, y, seed, y));
        else if (lot[i][j] && lotReady(lot[i][j]!)) { const l = lot[i][j]!; // one sprite for the lot, drawn at its front-most (max i, max j) tile
          if (i === l.i0 + l.wi - 1 && j === l.j0 + l.dj - 1) { const o = toScreen(l.i0, l.j0), lx = o.x + (l.wi - l.dj) * 16, ly = o.y + (l.wi + l.dj - 2) * 8, k = lotKey(l);
            P(k, lx, ly, seed, y + i * 0.001); PN(k, lx, ly, seed, y + i * 0.001); ch.blds.push({ x, y, z: 'R', L: 1, seed }); } }
        else if (bld[i][j]) { const k = `bld_${zone[i][j]}_${bld[i][j]}`; flip(P(k, x, y, seed, y)); flip(PN(k, x, y, seed, y)); ch.blds.push({ x, y, z: zone[i][j], L: bld[i][j], seed }); }
      }
      if (road[i][j] && pline[i][j]) { const pl = (a: number, b: number) => inb(a, b) && pline[a][b]; P('power_line_' + ((pl(i, j - 1) ? 1 : 0) | (pl(i + 1, j) ? 2 : 0) | (pl(i, j + 1) ? 4 : 0) | (pl(i - 1, j) ? 8 : 0)), x, y, seed, y); }
      if (pipe[i][j]) { const pp = (a: number, b: number) => inb(a, b) && (pipe[a][b] || (!!civAt[a][b] && SERV[civAt[a][b]!.type].kind === 'water')); place('pipe_' + ((pp(i, j - 1) ? 1 : 0) | (pp(i + 1, j) ? 2 : 0) | (pp(i, j + 1) ? 4 : 0) | (pp(i - 1, j) ? 8 : 0)), x, y, ch.pp, seed); }
      if (!zone[i][j] && !road[i][j] && !civAt[i][j] && !pline[i][j] && terrain[i][j] === 'forest') ch.trees.push({ s: P(forestKey(i, j), x, y, seed, y), ph: (seed % 628) / 100 });
    });
    ch.dirty = false; ch.built = true; ch.iconDirty = true;
  };
  const STATUS_H = [0, 34, 52, 86]; // bubble sits a few px above each density's roof
  const drawChunkIcons = (ch: Chunk) => { clear(ch.ic); ch.iconDirty = false; const g = new Graphics(); ch.ic.addChild(g); const art = hasArt('status_no_power');
    chunkTiles(ch, (i, j) => { if (!(zone[i][j] && bld[i][j] && (!powered[i][j] || !watered[i][j]))) return; const lt = lot[i][j]; if (lt && (i !== lt.i0 + lt.wi - 1 || j !== lt.j0 + lt.dj - 1)) return;
      if (art) { const { x, y } = toScreen(i, j), yy = y - STATUS_H[bld[i][j]], two = !powered[i][j] && !watered[i][j];
        if (!powered[i][j]) place('status_no_power', x - (two ? 7 : 0), yy, ch.ic); if (!watered[i][j]) place('status_no_water', x + (two ? 7 : 0), yy, ch.ic); return; }
      const { x, y } = toScreen(i, j), yy = y - 26 - bld[i][j] * 6; let xx = x - (!powered[i][j] && !watered[i][j] ? 6 : 0);
      if (!powered[i][j]) { g.circle(xx, yy, 5).fill(0xd62828).stroke({ width: 1, color: 0xffffff }); g.poly([xx + 1, yy - 4, xx - 2, yy + 0.5, xx + 0.3, yy + 0.5, xx - 1, yy + 4, xx + 2.5, yy - 1, xx + 0.3, yy - 1]).fill(0xffe14d); xx += 12; }
      if (!watered[i][j]) { g.circle(xx, yy, 5).fill(0xd62828).stroke({ width: 1, color: 0xffffff }); g.poly([xx, yy - 3.8, xx + 2.4, yy + 0.8, xx, yy + 3, xx - 2.4, yy + 0.8]).fill(0x7cc8ff); } }); };
  // ---- tile textures: one pixel-diamond per tile (8x4 px), shown scaled x8; used for the far-zoom overview and data overlays ----
  const tileTex = (parent: Container) => {
    const cv = document.createElement('canvas'); cv.width = 8 * N; cv.height = 4 * N; const ctx = cv.getContext('2d')!; const img = ctx.createImageData(cv.width, cv.height);
    const tex = Texture.from(cv); tex.source.scaleMode = 'nearest'; const sp = new Sprite(tex); sp.scale.set(8); sp.position.set(-32 * N, -16); parent.addChild(sp);
    const d32 = new Uint32Array(img.data.buffer), W = cv.width;
    const paint = (fn: (i: number, j: number) => number) => { // fn returns 0xAABBGGRR (little-endian RGBA) or 0 for none
      d32.fill(0);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = fn(i, j); if (!v) continue; const cx = (i - j) * 4 + 4 * N, ty = (i + j) * 2;
        let o = ty * W; d32.fill(v, o + cx - 2, o + cx + 2); o += W; d32.fill(v, o + cx - 4, o + cx + 4); o += W; d32.fill(v, o + cx - 4, o + cx + 4); o += W; d32.fill(v, o + cx - 2, o + cx + 2); }
      ctx.putImageData(img, 0, 0); tex.source.update(); };
    return { sp, paint };
  };
  const rgba = (c: number, a = 1) => ((Math.round(a * 255) << 24) | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff)) >>> 0;
  const OVC = { water: rgba(0x3478bd), sand: rgba(0xdccb92), grass: rgba(0x5ea849), forest: rgba(0x2f6a2a), road: rgba(0x6b6f76), civ: rgba(0xe8e2d6), line: rgba(0xc9b26a),
    R: [rgba(0x7fd08a), rgba(0xd8b48a), rgba(0xc77f5e), rgba(0xa7b4c4)], C: [rgba(0x86b6f0), rgba(0x9fc3e8), rgba(0x6f9fd6), rgba(0x8fb0d0)], I: [rgba(0xe8d47a), rgba(0xb8b2a8), rgba(0x9a948c), rgba(0x86807a)] } as any;
  const overviewL = new Container(); world.addChildAt(overviewL, world.getChildIndex(groundL) + 1);
  const overview = tileTex(overviewL); overviewL.visible = false; // only for far zoom (or if detailed drawing fails); never under detailed tiles
  const paintOverview = () => { ovDirty = false; overview.paint((i, j) => civAt[i][j] ? OVC.civ : road[i][j] ? OVC.road : zone[i][j] ? OVC[zone[i][j]][bld[i][j]] : pline[i][j] ? OVC.line : OVC[terrain[i][j]]); };
  const FAR = 0.2; let far = false, lastOv = 0, visRoads: [number, number][] = [];
  const updateChunks = () => {
    const vx0 = -world.position.x / zoom, vy0 = -world.position.y / zoom, vx1 = vx0 + app.screen.width / zoom, vy1 = vy0 + app.screen.height / zoom, now = performance.now();
    far = zoom < FAR; overviewL.visible = far || chunkErr;
    if (ovDirty && (far || !lastOv || now - lastOv > 5000) && now - lastOv > 700) { lastOv = now; paintOverview(); }
    const t0 = now, showGrid = zoom > 0.3; visRoads = [];
    for (const ch of chunks) {
      const v = !far && ch.x1 > vx0 && ch.x0 < vx1 && ch.y1 > vy0 && ch.y0 < vy1;
      if (v) { ch.seen = now;
        if (performance.now() - t0 < 8 || !ch.ground) { if (!ch.ground) buildGround(ch); if (ch.dirty) drawChunk(ch); if (ch.iconDirty) drawChunkIcons(ch); }
        for (const r of ch.roads) visRoads.push(r);
      } else if (ch.ground && now - ch.seen > 20000) { clear(ch.g); clear(ch.gr); ch.ground = false; // free far-away chunks
        for (const o of [...ch.ob.children]) if (!(o as any).__veh) { ch.ob.removeChild(o); o.destroy(); } clear(ch.rd); clear(ch.zn); clear(ch.pp); clear(ch.ic); ch.lights = []; ch.trees = []; ch.blds = []; ch.roads = []; ch.tls = []; ch.dirty = true; ch.iconDirty = true; }
      ch.vis = v; ch.g.visible = ch.rd.visible = ch.zn.visible = ch.ob.visible = ch.pp.visible = ch.ic.visible = v; ch.gr.visible = v && showGrid;
    }
  };
  let zlist: number[] = []; let overlayHook = () => {};
  const addLot = (l: Lot) => { lots.add(l); for (const [i, j] of lotTiles(l)) lot[i][j] = l; markDirty(l.i0, l.j0, l.i0 + l.wi - 1, l.j0 + l.dj - 1); };
  /** dissolve: tiles stay as square buildings; clear: the whole lot is bulldozed */
  const removeLot = (l: Lot, clearAll = false) => { lots.delete(l); for (const [i, j] of lotTiles(l)) { lot[i][j] = null; if (clearAll) { zone[i][j] = ''; bld[i][j] = 0; consT[i][j] = 0; } } markDirty(l.i0, l.j0, l.i0 + l.wi - 1, l.j0 + l.dj - 1); };
  const LOTDIR: [Lot['dir'], number, number][] = [['NE', 0, -1], ['SE', 1, 0], ['SW', 0, 1], ['NW', -1, 0]]; // road side -> offset to the road tile
  const tryMakeLot = (i: number, j: number) => { // (i,j) is the front tile; the lot extends away from the road
    const f = facingOf(i, j); if (!f) return null;
    const sd = seedOf(i, j), [dir, a, b] = LOTDIR[f - 1];
    const free = (x: number, y: number) => inb(x, y) && zone[x][y] === 'R' && !bld[x][y] && !consT[x][y] && !lot[x][y] && !road[x][y] && !civAt[x][y];
    let max = 1; while (max < 3 && free(i - a * max, j - b * max)) max++;
    const w = [6, 5, 4].slice(0, max), r = ((sd >>> 8) % 1000) / 1000 * w.reduce((x, y) => x + y, 0); let D = 1, acc = 0; for (let k = 0; k < max; k++) { acc += w[k]; if (r < acc) { D = k + 1; break; } }
    const back = [i - a * (D - 1), j - b * (D - 1)], i0 = Math.min(i, back[0]), j0 = Math.min(j, back[1]);
    const l: Lot = { i0, j0, wi: a ? D : 1, dj: b ? D : 1, dir, v: 'abc'[(sd >>> 4) % 3] };
    if (!hasArt(lotKey(l))) return null; addLot(l); return l;
  };
  const rebuildZ = () => { zlist = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (zone[i][j]) zlist.push(i * N + j); };
  computeNear(); rebuildZ();
  const preview = new Graphics(), hl = new Graphics();
  world.addChild(preview, hl);

  // ---- tools ----
  type Tool = string; // select | road | R | C | I | bulldoze | svc:<type>
  const tools: [Tool, string][] = [['select','Select / Pan'],['road','Road'],['R','Residential'],['C','Commercial'],['I','Industrial'],['bulldoze','Bulldoze'],['pline','Power line'],['pipe','Pipe']];
  let toolHook: ((t: string) => void) | undefined;
  const bar = document.getElementById('toolbar')!;
  const setTool = (t: Tool) => { tool = t; syncZones(); toolHook?.(t); if (t.startsWith('svc:') && SERV[t.slice(4)].kind !== 'parking') setCovView(SERV[t.slice(4)].kind); document.querySelectorAll<HTMLElement>('#toolbar button, #services button[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t)); };
  tools.forEach(([t, label], k) => { const b = document.createElement('button'); b.dataset.t = t; b.innerHTML = `<b>${k+1}</b> ${t === 'pline' ? '<img src="./assets/ui/icons/icon_power_line@2x.png" alt="">' : t === 'pipe' ? '<img src="./assets/ui/icons/icon_pipe@2x.png" alt="">' : ''}${label}`; b.onclick = () => setTool(t); bar.appendChild(b); });
  // road tier picker: shown above the toolbar while the Road tool is active
  const tierBar = document.createElement('div'); tierBar.id = 'roadTiers'; tierBar.style.cssText = 'position:fixed;bottom:62px;left:0;right:0;margin:0 auto;width:max-content;display:none;gap:5px;background:rgba(0,0,0,.7);padding:5px 8px;border-radius:10px;color:#ddd;font-size:12px;z-index:3';
  tierBar.addEventListener('pointerdown', e => e.stopPropagation());
  tierBar.innerHTML = '<span style="align-self:center">Road type</span>' + ([1, 2, 3] as RoadTier[]).map(t => { const r = ROAD_TIERS[t]; return `<button data-tier="${t}" title="${r.name}: build $${r.build}/tile, upkeep $${r.upkeep}/tile/month, speed ×${r.speed}. Paint over an existing road to upgrade it (you pay the difference)." style="background:#2b3442;color:#fff;border:1px solid #445;border-radius:6px;padding:5px 8px;cursor:pointer">${r.name} <small style="color:#9cf">$${r.build}/tile · $${r.upkeep}/mo</small></button>`; }).join('');
  tierBar.innerHTML += '<span style="align-self:center;margin-left:8px;border-left:1px solid #556;padding-left:8px">Width</span>' + ROAD_WIDTHS.map((w, k) => `<button data-w="${k}" title="${w.name}: ${w.lanes} lanes of ${w.laneFt} ft, ${w.tiles} tile${w.tiles > 1 ? 's' : ''} wide, capacity ×${w.capacity}, build ×${w.buildMul}" style="background:#2b3442;color:#fff;border:1px solid #445;border-radius:6px;padding:5px 8px;cursor:pointer">${w.name}${k === 2 ? ' (2 tiles)' : ''}</button>`).join('');
  document.body.appendChild(tierBar);
  const refreshTierBar = () => { tierBar.querySelectorAll<HTMLElement>('button[data-tier]').forEach(b => { const t = +b.dataset.tier! as RoadTier, dis = t === 1 && roadW > 0; b.style.background = t === roadTier ? '#3d6fd1' : '#2b3442'; b.style.opacity = dis ? '0.4' : '1'; b.querySelector('small')!.textContent = `$${roadBuild(t, roadW)}/tile · $${+roadUpkeep(t, roadW).toFixed(2)}/mo`; });
    tierBar.querySelectorAll<HTMLElement>('button[data-w]').forEach(b => b.style.background = +b.dataset.w! === roadW ? '#3d6fd1' : '#2b3442'); };
  const setRoadWidth = (w: number) => { roadW = w; if (w > 0 && roadTier === 1) { roadTier = 2; toast('Streets and avenues need pavement: switched to Asphalt'); } refreshTierBar(); };
  tierBar.querySelectorAll<HTMLElement>('button[data-w]').forEach(b => b.onclick = () => setRoadWidth(+b.dataset.w!));
  const setRoadTier = (t: RoadTier) => { if (t === 1 && roadW > 0) { roadW = 0; toast('Dirt only comes as a 2-lane road'); } roadTier = t; refreshTierBar(); };
  tierBar.querySelectorAll<HTMLElement>('button[data-tier]').forEach(b => b.onclick = () => setRoadTier(+b.dataset.tier! as RoadTier)); setRoadTier(2);
  const zoneBar = document.createElement('div'); zoneBar.id = 'zoneBar'; zoneBar.style.cssText = tierBar.style.cssText; zoneBar.addEventListener('pointerdown', e => e.stopPropagation()); document.body.appendChild(zoneBar);
  const BS = 'background:#2b3442;color:#fff;border:1px solid #445;border-radius:6px;padding:5px 8px;cursor:pointer';
  const refreshZoneBar = () => { const z = ['R', 'C', 'I'].includes(tool) ? tool : 'R';
    zoneBar.innerHTML = '<span style="align-self:center">Density</span>' + [1, 2, 3].map(d => `<button data-den="${d}" title="${DENN[d]} ${ZNAME[z]}: ${CAPNAME[z][d]}. Never grows past this. Free." style="${BS};background:${d === zoneDen ? '#3d6fd1' : '#2b3442'}">${DENN[d]} <small style="color:#9cf">${CAPNAME[z][d]}</small></button>`).join('')
      + `<span style="align-self:center;margin-left:8px;border-left:1px solid #556;padding-left:8px">Facing</span><button data-face="1" title="Which way entrances face. Auto faces the busiest adjacent road. Press R to cycle." style="${BS}">${['⟳ Auto', '↗ NE', '↘ SE', '↙ SW', '↖ NW'][zoneFace]} <small style="color:#9cf">(R)</small></button>`;
    zoneBar.querySelectorAll<HTMLElement>('button[data-den]').forEach(b => b.onclick = () => setZoneDen(+b.dataset.den!));
    zoneBar.querySelector<HTMLElement>('button[data-face]')!.onclick = () => setZoneFace((zoneFace + 1) % 5); };
  const setZoneDen = (d: number) => { zoneDen = d; refreshZoneBar(); showPreview(); };
  const setZoneFace = (f: number) => { zoneFace = f; refreshZoneBar(); showPreview(); };
  let confirmDown = (n: number) => window.confirm(`${n} building${n > 1 ? 's are' : ' is'} bigger than the new density allows. Demolish and rebuild ${n > 1 ? 'them' : 'it'} smaller?`);
  window.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'r' && ['R', 'C', 'I'].includes(tool) && !(e.target instanceof HTMLInputElement)) setZoneFace((zoneFace + 1) % 5); });
  { const prev = toolHook; toolHook = t => { prev?.(t); zoneBar.style.display = ['R', 'C', 'I'].includes(t) ? 'flex' : 'none'; if (zoneBar.style.display === 'flex') refreshZoneBar(); }; }
  { const prev = toolHook; toolHook = t => { prev?.(t); tierBar.style.display = t === 'road' ? 'flex' : 'none'; document.getElementById('services')!.style.visibility = t === 'road' ? 'hidden' : ''; }; }
  // Services toolbar group
  const svcBar = document.getElementById('services')!;
  const ICON: Record<string, string> = { school: 'school_elem', highschool: 'school_high', police: 'police', fire: 'fire_station', clinic: 'clinic', hospital: 'hospital', garage: 'parking', garage2: 'parking' };
  svcBar.innerHTML = '<span>Services</span>' + Object.entries(SERV).filter(([, v]) => !v.util).map(([k, v]) => `<button data-t="svc:${k}" title="${v.name}: ${v.size}x${v.size}, $${v.cost}, radius ${v.radius}">${ICON[k] ? `<img src="./assets/ui/icons/icon_${ICON[k]}@2x.png" alt="">` : '🅿️ '}${v.name.replace(' Station', '')} <small>$${v.cost}</small></button>`).join('')
    + '<span class="sep">Utilities</span>' + Object.entries(SERV).filter(([, v]) => v.util).map(([k, v]) => `<button data-t="svc:${k}" title="${v.name}: ${v.size}x${v.size}, $${v.cost}, output ${v.kind === 'power' ? fmtPower(v.out!) : fmtWater(v.out!)}${v.needsWater ? ', its south-east side must be on water' : ''}"><img src="./assets/ui/icons/icon_${k}@2x.png" alt="">${v.name.replace(' Power Plant', '').replace('Water ', '').replace(' Turbine', '')} <small>$${v.cost}</small></button>`).join('')
    + '<select id="covSel" title="Coverage overlay"><option value="">Coverage: off</option><option value="edu">Education</option><option value="police">Police</option><option value="fire">Fire</option><option value="health">Health</option><option value="traffic">Traffic volume</option><option value="crime">Crime</option><option value="fireRisk">Fire risk</option><option value="power">Powered</option><option value="water">Water served</option></select>';
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
  const seWater = (i0: number, j0: number, s: number) => { for (let k = 0; k < s; k++) if (!inb(i0 + s, j0 + k) || terrain[i0 + s][j0 + k] !== 'water') return false; return true; }; // pump intake faces SE
  const touchesWater = (i0: number, j0: number, s: number) => { const w = (i: number, j: number) => inb(i, j) && terrain[i][j] === 'water'; for (let k = 0; k < s; k++) if (w(i0 - 1, j0 + k) || w(i0 + s, j0 + k) || w(i0 + k, j0 - 1) || w(i0 + k, j0 + s)) return true; return false; };
  const canPlop = (t: string, hi: number, hj: number) => { const f = svcFoot(t, hi, hj), S = SERV[t];
    return f.tiles.every(([i, j]) => tileFree(i, j) && !pline[i][j]) && (S.util ? true : touchesRoad(f.i0, f.j0, f.s)) && (!S.needsWater || seWater(f.i0, f.j0, f.s)); };
  const plop = (t: string, hi: number, hj: number) => {
    if (!canPlop(t, hi, hj)) return false; if (!spend(SERV[t].cost)) return false; tripsDirty = true; const f = svcFoot(t, hi, hj), c: Civ = { type: t, i: f.i0, j: f.j0, s: f.s };
    civs.push(c); for (const [i, j] of f.tiles) civAt[i][j] = c; markDirty(f.i0, f.j0, f.i0 + f.s, f.j0 + f.s); census(); updateStats(); return true;
  };
  const removeCiv = (c: Civ) => { markDirty(c.i, c.j, c.i + c.s, c.j + c.s); civs.splice(civs.indexOf(c), 1); for (let a = 0; a < c.s; a++) for (let b = 0; b < c.s; b++) civAt[c.i + a][c.j + b] = null; };
  const valid = (i: number, j: number) => {
    if (tool === 'road') return terrain[i][j] !== 'water' && !civAt[i][j] && (!pline[i][j] || road[i][j]);
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
    if (tool === 'road') { let c = 0; const rt = roadTiles(dragTiles()); for (const [i, j, w] of rt) if (valid(i, j)) c += roadCost(i, j, wKind(w)); hud.textContent = `Cost: $${c.toLocaleString()}` + (c > sim.funds ? ' (not enough funds)' : ''); for (const [i, j] of rt) { diamond(preview, i, j); preview.fill({ color: valid(i, j) ? col : 0xff2020, alpha: 0.55 }); } return; }
    let c = 0; for (const [i, j] of dragTiles()) if (valid(i, j)) c += tool === 'pline' ? COST.pline : tool === 'pipe' ? COST.pipe : tool === 'road' ? roadCost(i, j) : tool === 'bulldoze' ? COST.bulldoze : 0;
    hud.textContent = `Cost: $${c.toLocaleString()}` + (c > sim.funds ? ' (not enough funds)' : '');
    for (const [i, j] of dragTiles()) { diamond(preview, i, j); preview.fill({ color: valid(i, j) ? col : 0xff2020, alpha: 0.55 }); }
    if (['R', 'C', 'I'].includes(tool)) { let bad = 0; for (const [i, j] of dragTiles()) { if (!valid(i, j)) continue; const f = faceFor(i, j, zoneFace), d = f || zoneFace; if (!f) bad++;
        const p = toScreen(i, j), q = toScreen(i + (FACE[d || 2][1]) * 0.42, j + (FACE[d || 2][2]) * 0.42), c = f ? 0xffffff : 0xff3030;
        if (!d) { preview.circle(p.x, p.y, 3).fill({ color: c }); continue; }
        const dx = q.x - p.x, dy = q.y - p.y; preview.moveTo(p.x - dx * 0.3, p.y - dy * 0.3).lineTo(q.x, q.y).stroke({ width: 2, color: c }); preview.poly([q.x, q.y, q.x - dx * 0.35 - dy * 0.3, q.y - dy * 0.35 + dx * 0.3, q.x - dx * 0.35 + dy * 0.3, q.y - dy * 0.35 - dx * 0.3]).fill(c); }
      hud.textContent = `${DENN[zoneDen]} ${ZNAME[tool]} (cap: ${CAPNAME[tool][zoneDen]}) · Facing ${FACE[zoneFace][0]} (R to change) · Free` + (bad ? ` · ⚠ ${bad} tile${bad > 1 ? 's' : ''} with no road access on the front` : ''); }
  };
  const commit = () => {
    if (tool.startsWith('svc:')) { if (drag) plop(tool.slice(4), drag.ci, drag.cj); drag = null; preview.clear(); return; }
    const rtiles = tool === 'road' ? roadTiles(dragTiles()).filter(([i, j]) => valid(i, j)) : [], wAt = new Map(rtiles.map(([i, j, w]) => [i * N + j, w])), pdAt = new Map(rtiles.map(([i, j, , d]) => [i * N + j, d ?? 0]));
    const tiles = tool === 'road' ? rtiles.map(([i, j]) => [i, j] as [number, number]) : dragTiles().filter(([i, j]) => valid(i, j)), seen = new Set<Civ>();
    let cost = 0;
    for (const [i, j] of tiles) {
      if (tool === 'road') cost += roadCost(i, j, wKind(wAt.get(i * N + j)!));
      else if (tool === 'pline') cost += COST.pline;
      else if (tool === 'pipe') cost += COST.pipe;
      else if (tool === 'bulldoze' && underground) cost += COST.bulldoze;
      else if (tool === 'bulldoze') { const c = civAt[i][j]; if (c) { if (!seen.has(c)) { seen.add(c); cost += COST.bulldozeCivic; } } else cost += COST.bulldoze; }
    }
    if (['R', 'C', 'I'].includes(tool)) { const down = tiles.filter(([i, j]) => zone[i][j] === tool && Math.max(bld[i][j], consT[i][j]) > zoneDen).length;
      if (down && !confirmDown(down)) { drag = null; preview.clear(); return; } }
    if (!spend(cost)) { drag = null; preview.clear(); return; }
    for (const [i, j] of tiles) {
      if (lot[i][j] && (tool === 'bulldoze' && !underground)) { removeLot(lot[i][j]!, true); continue; }
      if (lot[i][j] && (tool === 'road' || ['R', 'C', 'I'].includes(tool))) removeLot(lot[i][j]!);
      if (tool !== 'pline' && tool !== 'pipe' && !(tool === 'bulldoze' && underground)) pk[i][j] = 0;
      if (tool === 'pline') { pline[i][j] = true; continue; }
      if (tool === 'pipe') { pipe[i][j] = true; continue; }
      if (tool === 'bulldoze' && underground) { pipe[i][j] = false; continue; }
      if (tool === 'road') { const w = wAt.get(i * N + j)!; if (roadCost(i, j, wKind(w)) > 0) startRoad(i, j, Math.max(roadTier, rtier[i][j] || 0) as RoadTier, w, pdAt.get(i * N + j) ?? 0); zone[i][j] = ''; bld[i][j] = 0; consT[i][j] = 0; zden[i][j] = zface[i][j] = 0; }
      else if (tool === 'bulldoze') { if (civAt[i][j]) removeCiv(civAt[i][j]!); else if (pline[i][j]) { pline[i][j] = false; continue; } else if (!road[i][j] && !zone[i][j]) continue; road[i][j] = false; rw[i][j] = 0; rpd[i][j] = 0; rtier[i][j] = 0; rstage[i][j] = 0; rfrom[i][j] = 0; zone[i][j] = ''; bld[i][j] = 0; consT[i][j] = 0; zden[i][j] = zface[i][j] = 0; }
      else { if (zone[i][j] !== tool) { bld[i][j] = 0; consT[i][j] = 0; }
        zone[i][j] = tool; zden[i][j] = zoneDen; zface[i][j] = zoneFace;
        if (Math.max(bld[i][j], consT[i][j]) > zoneDen) { const old = Math.max(bld[i][j], consT[i][j]); if (lot[i][j]) removeLot(lot[i][j]!); bld[i][j] = 0; consT[i][j] = hasAccess(i, j) ? Math.min(old, zoneDen) : 0; consD[i][j] = 0; } } } // over the new cap: demolish and rebuild smaller
    if (tiles.length) { let a = N, b = N, c2 = 0, d = 0; for (const [i, j] of tiles) { a = Math.min(a, i); b = Math.min(b, j); c2 = Math.max(c2, i); d = Math.max(d, j); } markDirty(a, b, c2, d); }
    tripsDirty = true; if (tool === 'road' || tool === 'bulldoze') computeNear(); if (tool !== 'pline' && tool !== 'pipe') rebuildZ();
    drag = null; preview.clear(); census(); updateStats();
  };
  const tileAt = (sx: number, sy: number) => toTile((sx - world.position.x) / zoom, (sy - world.position.y) / zoom);
  (window as any).__city = { N: () => N, city: () => city, zoom: () => zoom, setZoom: (z: number) => { zoom = clampZoom(z); }, tileToScreen: (i: number, j: number) => { const p = toScreen(i, j); return { x: p.x * zoom + world.position.x, y: p.y * zoom + world.position.y }; }, road, rtier, rstage, rfrom, rw, pk, growParking: () => growParking(), parkingIncome: () => parkingIncome(), trips: () => trips, cars: () => cars, spawnTrips: () => spawnTrips(), inspectAt: (x: number, y: number) => inspectAt(x, y), setCovView: (v: string) => setCovView(v), markTripsDirty: () => { tripsDirty = true; }, setRoadWidth: (w: number) => setRoadWidth(w), setRoadTier: (t: RoadTier) => setRoadTier(t), roadCost: (i: number, j: number) => roadCost(i, j), zone, bld, consT, zden, zface, facingOf: (i: number, j: number) => FACE[facingOf(i, j)][0], hasAccess: (i: number, j: number) => hasAccess(i, j), entranceOf: (i: number, j: number) => entranceOf(i, j), lotAt: (i: number, j: number) => lot[i][j], setZoneDensity: (d: number) => setZoneDen(d), setZoneFacing: (f: number) => setZoneFace(f), paint: (t: string, i0: number, j0: number, i1: number, j1: number) => { setTool(t); drag = { i: i0, j: j0, ci: i1, cj: j1 }; commit(); }, setConfirm: (f: (n: number) => boolean) => { confirmDown = f; }, refresh: () => { computeNear(); rebuildZ(); markAll(); }, terrain, civs, plop, cov, crime, fireRisk, setTool, sim: () => sim, setSpeed: (n: number) => setSpeed(n), fastForward: (n: number) => { for (let k = 0; k < n; k++) tick(); }, centerOn: (i: number, j: number) => { const p = toScreen(i, j); camX = p.x; camY = p.y; } };

  // camera
  const center = toScreen(N / 2, N / 2);
  let zoom = 0.6;
  let camX = center.x, camY = center.y;
  const keys = new Set<string>();
  const apply = () => {
    world.scale.set(zoom);
    world.position.set(app.screen.width / 2 - camX * zoom, app.screen.height / 2 - camY * zoom);
  };
  const minZoom = Math.min(0.2, Math.min(window.innerWidth / (N * TW), window.innerHeight / (N * TH)) * 0.9);
  const clampZoom = (z: number) => Math.max(minZoom, Math.min(4, z));
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
    hud.textContent = `Tile: ${i}, ${j}  (${road[i][j] ? ROAD_TIERS[rtier[i][j] as RoadTier]?.name.toLowerCase() + ' ' + ROAD_WIDTHS[wKind(rw[i][j])].name.toLowerCase() + (rstage[i][j] ? ' · ' + ['', 'surveyed', 'graded', 'gravel base', 'surfacing'][rstage[i][j]] + (rfrom[i][j] ? ' (upgrade, still open)' : ' (closed)') : '') : zone[i][j] ? `${DENN[zden[i][j]] || 'Uncapped'} ${ZNAME[zone[i][j]]} zone (cap: ${CAPNAME[zone[i][j]][capOf(i, j)]})` + (bld[i][j] ? ' · ' + DNAME[bld[i][j]] + ' building' : '') + ` · facing ${zface[i][j] ? FACE[zface[i][j]][0] : 'Auto' + (facingOf(i, j) ? ' (' + FACE[facingOf(i, j)][0] + ')' : '')}` + (hasAccess(i, j) ? '' : ' · ⚠ no road access') : terrain[i][j]})`;
  };

  // ---- simulation ----
  const ZNAME: Record<string, string> = { R: 'Residential', C: 'Commercial', I: 'Industrial' };
  const DNAME = ['', 'Low density', 'Medium density', 'High density'];
  const CAP: Record<string, number[]> = { R: RESIDENTS.R, C: JOBS.C, I: JOBS.I }; // see src/realism.ts
  const sim = { day: 0, speed: 1, pop: 0, jobsC: 0, jobsI: 0, dR: 0, dC: 0, dI: 0, spent: 0, funds: 20000, loan: 0 };
  // ---- budget ----
  const tax: Record<string, number> = { R: 9, C: 9, I: 9 };
  /** what painting the current tier on (i,j) costs: full price on bare ground, the difference when upgrading, 0 if already that tier or better / under works */
  const roadCost = (i: number, j: number, w = roadW) => { if (!road[i][j]) return roadBuild(roadTier, w); if (rstage[i][j]) return 0;
    const ct = rtier[i][j] as RoadTier, cw = wKind(rw[i][j]); if (roadTier < ct || w < cw || (roadTier === ct && w === cw)) return 0; return Math.max(1, roadBuild(roadTier, w) - roadBuild(ct, cw)); };
  const avAxis = () => { if (!drag) return 2; const t = dragTiles(); let a = N, b = -1, c = N, d = -1; for (const [i, j] of t) { a = Math.min(a, i); b = Math.max(b, i); c = Math.min(c, j); d = Math.max(d, j); } return b - a >= d - c ? 2 : 3; };
  /** road tiles a drag covers: avenues add the second lane-pair beside the dragged line */
  const roadTiles = (base: [number, number][]) => { if (roadW !== 2) return base.map(([i, j]) => [i, j, roadW, 0] as [number, number, number, number]); const ax = avAxis(), out: [number, number, number, number][] = [], seen = new Set<number>();
    for (const [i, j] of base) { const [pi, pj] = ax === 2 ? [i, j + 1] : [i + 1, j], fwd = BITOF(pi - i, pj - j); // explicit partner: first half points at the second and back
      for (const [a, b, d] of [[i, j, fwd], [pi, pj, OPP[fwd]]]) if (inb(a, b) && !seen.has(a * N + b)) { seen.add(a * N + b); out.push([a, b, ax, inb(pi, pj) ? d : 0]); } } return out; };
  const COST = { zone: 0, // zoning and de-zoning are free (you pay for roads/services, not paperwork)
    bulldoze: 2, bulldozeCivic: 50, pline: 5, pipe: 6 };
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
    let roads = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (road[i][j]) { const t = rstage[i][j] ? rfrom[i][j] : rtier[i][j]; if (t) roads += roadUpkeep(t as RoadTier, wKind(rw[i][j])); }
    const income: Record<string, number> = {
      'Residential tax': Math.round(tax.R / 100 * sim.pop * 5),
      'Commercial tax': Math.round(tax.C / 100 * sim.jobsC * 6),
      'Industrial tax': Math.round(tax.I / 100 * sim.jobsI * 6) };
    const pf = Math.round(parkingIncome()); if (pf) income['Parking fees'] = pf;
    const expense: Record<string, number> = { 'Road upkeep': Math.round(roads) };
    for (const c of civs) { const k = SERV[c.type].name; expense[k] = (expense[k] ?? 0) + Math.round(UPKEEP[c.type] * funding[c.type]); }
    extraExpenses(expense);
    if (sim.loan) expense['Loan interest'] = Math.round(sim.loan * LOAN_RATE);
    const net = Object.values(income).reduce((a, b) => a + b, 0) - Object.values(expense).reduce((a, b) => a + b, 0);
    return { income, expense, net };
  };
  let extraExpenses = (_e: Record<string, number>) => {}; // utilities hook in here
  let onMonth = () => {}; let tripTick = () => {}; let tripPenalty = 0, parkPenalty = 0;
  const monthly = () => {
    lastMonth = projection(); sim.funds += lastMonth.net;
    if (sim.funds < 0) toast(`⚠ The city is in debt ($${Math.floor(sim.funds).toLocaleString()}). Raise taxes, cut funding, or take a loan.`);
    renderBudget(); onMonth();
  };
  let downAt: { x: number; y: number } | null = null;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const poll: number[][] = [...Array(N)].map(() => Array(N).fill(0));
  const computePollution = () => { // spreads up to 5 tiles from industry, stronger for higher tiers
    for (const row of poll) row.fill(0);
    for (const c of civs) if (c.type === 'coal') { const ci = c.i + 1, cj = c.j + 1; for (let a = -7; a <= 7; a++) for (let b = -7; b <= 7; b++) { const d = Math.hypot(a, b); if (d <= 7 && inb(ci + a, cj + b)) poll[ci + a][cj + b] += 6 * (1 - d / 8); } }
    for (const k of zlist) { const i = (k / N) | 0, j = k - i * N; if (zone[i][j] !== 'I' || !bld[i][j]) continue;
      const L = bld[i][j];
      for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) { const d = Math.hypot(a, b); if (d <= 5 && inb(i + a, j + b)) poll[i + a][j + b] += L * (1 - d / 6); }
    }
  };
  let phase = 0; const perf = { tick: 0, tickMax: 0, census: 0, n: 0 };
  const census = (full = true) => { // after edits everything is recomputed; during play the heavy passes take turns, one per tick
    const t0 = performance.now(), ph = phase++ % 3;
    if (full || ph === 0) computeUtilities();
    if (full || ph === 1) { computePollution(); drawPollution(); }
    if (full || ph === 2) { computeCoverage(); computeRisks(); drawCoverage(); }
    sim.pop = sim.jobsC = sim.jobsI = 0;
    for (const k of zlist) { const i = (k / N) | 0, j = k - i * N; if (!bld[i][j]) continue;
      const v = zone[i][j] === 'R' ? resCap(i, j) : CAP[zone[i][j]][bld[i][j]];
      if (zone[i][j] === 'R') sim.pop += v; else if (zone[i][j] === 'C') sim.jobsC += v; else sim.jobsI += v;
    }
    sim.pop = Math.round(sim.pop); sim.jobsC = Math.round(sim.jobsC); sim.jobsI = Math.round(sim.jobsI);
    const jobs = sim.jobsC + sim.jobsI;
    sim.dR = clamp((jobs * ECON.residentsPerJob + 60 - sim.pop) / Math.max(60, sim.pop * 0.4));      // people come for jobs
    sim.dC = clamp((sim.pop * ECON.commercialJobsPerResident + 10 - sim.jobsC) / Math.max(15, sim.pop * 0.12));  // shops & offices follow residents
    sim.dI = clamp((60 + sim.day * 0.4 + sim.pop * ECON.industrialJobsPerResident - sim.jobsI) / Math.max(30, sim.jobsI * 0.4)); // outside (export) demand + local need
    // taxes: each point below the 9% default boosts that zone's demand, each point above lowers it
    sim.dR = clamp(sim.dR + (9 - tax.R) * 0.05 - tripPenalty); // people won't move where jobs/schools can't be reached by road sim.dC = clamp(sim.dC + (9 - tax.C) * 0.05 - parkPenalty); // shoppers who can't park go elsewhere sim.dI = clamp(sim.dI + (9 - tax.I) * 0.05);
    perf.census = performance.now() - t0;
  };
  const tick = () => {
    const t0 = performance.now();
    lastTick = t0; sim.day++; tickRoads(); tripTick(); if (sim.day % 30 === 0) monthly();
    const d: Record<string, number> = { R: sim.dR, C: sim.dC, I: sim.dI };
    for (const k of zlist) { const i = (k / N) | 0, j = k - i * N;
      const z = zone[i][j]; if (!z || pk[i][j]) continue; // private parking holds the lot
      if (consT[i][j]) { // advance construction
        consD[i][j]++;
        if (consD[i][j] >= CONS_DAYS * 3) { bld[i][j] = consT[i][j]; consT[i][j] = 0; markDirty(i, j, i, j); }
        else if (consD[i][j] % CONS_DAYS === 0) markDirty(i, j, i, j);
        continue;
      }
      const L = bld[i][j];
      if (!hasAccess(i, j)) { if (L && Math.random() < 0.01) { if (lot[i][j]) removeLot(lot[i][j]!); bld[i][j]--; markDirty(i, j, i, j); } continue; } // no road on the front: never grows, landlocked buildings are abandoned over time
      const dem = d[z] - Math.min(0.3, crime[i][j] * 0.05) // crime lowers desirability everywhere
        + (z === 'R' ? -Math.min(0.4, poll[i][j] * 0.04) + 0.15 * cov.edu[i][j] + 0.15 * cov.health[i][j] : 0); // pollution vs schools & health care
      if (near[i][j] > 3) { if (L && Math.random() < 0.05) { if (lot[i][j]) removeLot(lot[i][j]!); bld[i][j]--; markDirty(i, j, i, j); } continue; } // lost road access
      if (dem > 0 && L < capOf(i, j)) {
        const need = [0, 0, 0.15, 0.3][L + 1]; // higher density needs sustained strong demand
        const utilOk = L + 1 < 2 || (powered[i][j] && watered[i][j]); // no power or water: stays low density
        const eduOk = utilOk && !(z === 'R' && L + 1 === 3 && cov.edu[i][j] <= 0); // high-density housing needs a school nearby
        if (eduOk && dem > need && Math.random() < (L === 0 ? 0.06 : 0.02) * dem) {
          if (lot[i][j] && L + 1 >= 2) removeLot(lot[i][j]!); // denser buildings replace the lot with square buildings
          const nl = z === 'R' && L === 0 && !lot[i][j] ? tryMakeLot(i, j) : null;
          if (nl) { for (const [a, b] of lotTiles(nl)) { consT[a][b] = 1; consD[a][b] = consD[i][j] = 0; } }
          else { consT[i][j] = L + 1; consD[i][j] = 0; markDirty(i, j, i, j); } }
      } else if (L > 0 && dem < -0.5 && Math.random() < 0.02 * -dem) { if (lot[i][j]) removeLot(lot[i][j]!); bld[i][j]--; markDirty(i, j, i, j); }
    }
    census(false); updateStats();
    const dt = performance.now() - t0; perf.tick = perf.tick * 0.9 + dt * 0.1; perf.tickMax = Math.max(perf.tickMax, dt); perf.n++;
  };
  // top HUD
  const stats = document.getElementById('stats')!;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = () => `${MONTHS[Math.floor(sim.day / 30) % 12]} ${sim.day % 30 + 1}, Year ${Math.floor(sim.day / 360) + 1}`;
  const rbar = (k: string, v: number, c: string) => `<div class="rci"><div class="half"><div style="height:${Math.max(0, v) * 100}%;background:${c}"></div></div><div class="half neg"><div style="height:${Math.max(0, -v) * 100}%;background:${c}"></div></div><span>${k}</span></div>`;
  const updateStats = () => {
    stats.querySelector('#nums')!.innerHTML = `<span class="it cityName" title="${city.size}×${city.size} · seed ${city.seed}">🏙 <b>${city.name.replace(/</g, '&lt;')}</b></span><span class="it"><b>${dateStr()}</b> <span id="tod"></span></span><span class="it">Pop <b>${sim.pop.toLocaleString()}</b></span><span class="it" title="Commercial ${sim.jobsC} / Industrial ${sim.jobsI}">Jobs <b>${(sim.jobsC + sim.jobsI).toLocaleString()}</b></span><span class="it${util.pWant > util.pCap ? ' neg' : ''}" title="Power: used / capacity (demand ${fmtPower(util.pWant)})">⚡ <b>${fmtPower(util.pUse)} / ${fmtPower(util.pCap)}</b></span><span class="it${util.wWant > util.wCap ? ' neg' : ''}" title="Water: used / capacity (demand ${fmtWater(util.wWant)})">💧 <b>${fmtWater(util.wUse)} / ${fmtWater(util.wCap)}</b></span><span class="it${sim.funds < 0 ? ' neg' : ''}" title="Funds${sim.loan ? ' (loan $' + sim.loan.toLocaleString() + ')' : ''}">${sim.funds < 0 ? '⚠ ' : ''}Funds <b>$${Math.floor(sim.funds).toLocaleString()}</b></span>`;
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
  const fx: Record<string, boolean> = { clouds: true, smoke: true, pollution: false, cars: true, daynight: true, nature: true, ...(() => { try { const o = JSON.parse(localStorage.getItem('fx') ?? '{}'); return o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'boolean')) : {}; } catch { return {}; } })() };
  let lastTick = performance.now();
  const covL = new Container(); world.addChildAt(covL, world.getChildIndex(gridL));
  let covView = '';
  const COVCOL: Record<string, number> = { edu: 0xffd23f, police: 0x3b6cff, fire: 0xff5a36, health: 0x3fe0c5, crime: 0xb000ff, fireRisk: 0xff8800, power: 0xffd23f, water: 0x3d8fe0 };
  const covG = new Graphics(), pollG = new Graphics(); covL.addChild(covG); pollL.addChild(pollG); let covDirty = true, pollDirty = true, ovKey = '';
  let covFn: ((i: number, j: number) => [number, number] | null) | null = null;
  const pollFn = (i: number, j: number): [number, number] | null => poll[i][j] > 0.3 ? [0x6b4a1e, Math.min(0.55, poll[i][j] * 0.07)] : null;
  const paintOverlay = (g: Graphics, fn: (i: number, j: number) => [number, number] | null) => { g.clear();
    for (const ch of chunks) if (ch.vis) chunkTiles(ch, (i, j) => { const v = fn(i, j); if (v) { diamond(g, i, j); g.fill({ color: v[0], alpha: v[1] }); } }); };
  const bx = (g: Graphics) => { const r = g.getLocalBounds(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  Object.assign((window as any).__city, { align: () => ({ far, overview: overviewL.visible, cov: covG.visible ? bx(covG) : null, poll: pollG.visible ? bx(pollG) : null, grid: gridL.visible }) });
  overlayHook = () => { let key = ''; for (let k = 0; k < chunks.length; k++) if (chunks[k].vis) key += k + ','; const moved = key !== ovKey;
    if (covView && covFn && (covDirty || moved)) { covDirty = false; paintOverlay(covG, covFn); } if (fx.pollution && (pollDirty || moved)) { pollDirty = false; paintOverlay(pollG, pollFn); } ovKey = key; };
  const drawCoverage = () => {
    covG.visible = !!covView; covDirty = true; if (!covView) return;
    if (covView === 'traffic') { covFn = (i, j) => { const k = i * N + j, v = trips.volume[k]; if (!road[i][j] || v < 1) return null; const vc = v / trips.w.capacity(i, j); return [vc < 0.5 ? 0x3ecf4a : vc < 0.8 ? 0xf2c230 : vc < 1 ? 0xff8800 : 0xe02020, 0.35 + 0.4 * Math.min(1, vc)]; }; return; }
    const src: any = covView === 'power' ? powered.map(r => r.map(Number)) : covView === 'water' ? watered.map(r => r.map(Number)) : covView === 'crime' ? crime : covView === 'fireRisk' ? fireRisk : cov[covView as Kind], scale = covView === 'crime' ? 0.25 : covView === 'fireRisk' ? 0.25 : 1;
    covFn = (i, j) => { const v = Math.min(1, src[i][j] * scale); return v > 0.02 ? [COVCOL[covView], 0.12 + 0.45 * v] : null; };
  };
  const setCovView = (v: string) => { covView = v; (document.getElementById('covSel') as HTMLSelectElement).value = v; drawCoverage(); };
  document.getElementById('covSel')!.onchange = e => setCovView((e.target as HTMLSelectElement).value);
  const drawPollution = () => {
    pollG.visible = fx.pollution; pollDirty = true;
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
  const ugBtn = document.getElementById('ugBtn')!;
  const setUnderground = (v: boolean) => { underground = v; ugBtn.classList.toggle('on', v);
    for (const L of [roadL, carL, zoneL, objL, smokeL, cloudL, skyL, iconL]) L.alpha = v ? 0.12 : 1;
    groundL.alpha = v ? 0.55 : 1; pipeL.visible = v; };
  ugBtn.onclick = e => { e.stopPropagation(); setUnderground(!underground); };
  window.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'u') setUnderground(!underground); });
  setUnderground(false);
  { const prevHook = toolHook; toolHook = t => { prevHook?.(t); if (t === 'pipe') setUnderground(true); else if (t !== 'bulldoze' && t !== 'select' && underground) setUnderground(false); }; }
  document.getElementById('newBtn')!.onclick = e => { e.stopPropagation(); if (confirm('Start a new city? Unsaved progress in this one will be lost.')) location.href = location.pathname; };
  // ---- Budget panel (button + B) ----
  Object.assign((window as any).__city, { rpd, avCases: () => Object.fromEntries(avCases), tax, funding, monthly, pline, pipe, powered, watered, util, setUnderground, budget: () => ({ funds: sim.funds, loan: sim.loan, lastMonth, projection: projection() }) });
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
  // ---- agent-based trips (logic in src/trips.ts): the cars on screen are sampled real trips ----
  const trips = new TripSim({ N, seed: city.seed ?? 1, entrance: (i, j) => entranceOf(i, j), drivable: (i, j) => drivable(i, j), linked: (i, j, a, b) => !partner(i, j, a, b),
    tileSecs: (i, j) => TRIPS.tileMeters / (TRIPS.speedKmh[(rtier[i][j] || 2)] / 3.6),
    capacity: (i, j) => TRIPS.dailyCapacityPerLane * ROAD_WIDTHS[wKind(rw[i][j])].lanes * ROAD_TIERS[(rtier[i][j] || 2) as RoadTier].capacity,
    residents: (i, j) => zone[i][j] === 'R' && bld[i][j] ? resCap(i, j) : 0, jobs: (i, j) => (zone[i][j] === 'C' || zone[i][j] === 'I') && bld[i][j] ? CAP[zone[i][j]][bld[i][j]] : 0,
    shop: (i, j) => zone[i][j] === 'C' && bld[i][j] > 0,
    schools: () => civs.filter(c => TRIPS.schoolSeats[c.type]).map(c => ({ k: c.i * N + c.j, seats: TRIPS.schoolSeats[c.type] })),
    parkSpaces: (i, j) => { const c = civAt[i][j]; if (c) return SERV[c.type].kind === 'parking' && i === c.i && j === c.j ? (PARKING as any)[c.type].spaces : 0;
      if (pk[i][j]) return pk[i][j] === 1 ? PARKING.privateLot.spaces : PARKING.privateGarage.spaces; return drivable(i, j) ? PARKING.streetSpaces[wKind(rw[i][j])] : 0; },
    needsParking: (i, j) => { const c = civAt[i][j]; if (c) return c.type === 'hospital' || c.type === 'highschool'; return zone[i][j] === 'C' && bld[i][j] >= 2; } });
  volRef = trips.volume;
  /** private parking grows on its own where drivers can't find spaces: a free or low-density C tile near the shortfall becomes a lot (a garage next to C3) */
  const growParking = () => { let made = 0; const cand: [number, number][] = []; for (let k = 0; k < N * N; k++) if (trips.unmet[k] > 8) cand.push([k, trips.unmet[k]]); cand.sort((a, b) => b[1] - a[1]);
    for (const [k] of cand) { if (made >= 4) break; const [di, dj] = tileOf(k); let done = false;
      for (let r = 1; r <= 2 && !done; r++) for (let a = -r; a <= r && !done; a++) for (let b = -r; b <= r && !done; b++) { const i = di + a, j = dj + b;
        if (!inb(i, j) || zone[i][j] !== 'C' || pk[i][j] || consT[i][j] || bld[i][j] > 1 || trips.access[i * N + j] < 0) continue;
        pk[i][j] = bld[di][dj] >= 3 ? 2 : 1; bld[i][j] = 0; markDirty(i, j, i, j); made++; done = true; } }
    if (made) tripsDirty = true; return made; };
  const parkInfo = (k: number) => { const cap = trips.spaces[k], occ = trips.occ[k]; return `<br><b>Occupancy</b>: ${Math.round(occ)} / ${Math.round(cap)} spaces at peak (${cap ? Math.round(occ / cap * 100) : 0}%)`; };
  const garageFees = (k: number) => { let wk = 0, sh = 0; for (const f of trips.flows) if (f.park === k) { const cars = f.people * TRIPS.carShare[f.kind] / TRIPS.peoplePerCar; if (f.kind === 'work') wk += cars; else sh += cars; } return (wk * PARKING.feeCommuterPerDay + sh * PARKING.feeVisit) * 30; };
  const parkingIncome = () => { let v = 0; for (const c of civs) if (SERV[c.type].kind === 'parking') v += garageFees(c.i * N + c.j); return v; };
  let lastTripHour = -1, tripsDirty = true; const MAXCARS = 320;
  tripTick = () => { if (tripsDirty || sim.day % 30 === 0) { tripsDirty = false; trips.assign(Math.floor(sim.day / 30)); if (sim.day % 30 === 0 && growParking()) trips.assign(Math.floor(sim.day / 30)); const s = trips.stats; tripPenalty = s.residents ? Math.min(0.5, (s.noJobReachable + 0.5 * s.noSchoolReachable) / s.residents) : 0; parkPenalty = s.residents ? Math.min(0.4, s.lostShoppers / s.residents * 2) : 0; } trips.sampleVolume(12); };
  const tileOf = (k: number): [number, number] => [(k / N) | 0, k % N];
  const routeNext = (c: Car): [number, number] | undefined => c.route && (c.ri ?? 0) + 1 < c.route.length ? tileOf(c.route[(c.ri ?? 0) + 1]) : undefined;
  const spawnTrips = () => { const dep = trips.departures(sim.day % 24, 80, Math.random); let made = 0;
    for (const { f, back } of dep.trips) { if (cars.length >= MAXCARS || made >= 40) break;
      let o = trips.access[f.home], d = trips.end(f); if (back) [o, d] = [d, o]; const r = trips.route(o, d); if (!r || r.length < 2) continue;
      let seen = false; for (let x = 0; x < r.length && !seen; x += 2) { const [a, b] = tileOf(r[x]); if (chunkOf(a, b).vis) seen = true; } if (!seen) continue; // only trips that cross the screen get a car
      const [pi, pj] = tileOf(r[0]), [i, j] = tileOf(r[1]), key = pickVehicle(pi, pj), big = /semi|bus|truck/.test(key);
      const c: Car = { s: new Graphics(), key, pi, pj, i, j, t: 0, sp: (big ? 0.9 : 1.2) + Math.random() * 0.6, dir: '', ln: big ? 1 : Math.random() < 0.5 ? 0 : 1, route: r, ri: 1, trip: { kind: f.kind, home: f.home, dest: f.dest, back, scale: dep.scale } };
      if (!hasArt(key + '_NE')) { const g = new Graphics().roundRect(-3.5, -2, 7, 4, 1.2).fill(CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]); (g as any).__veh = true; chunkOf(pi, pj).ob.addChild(g); c.s = g; }
      cars.push(c); made++; } };
  // ---- save / load (milestone 6) ----
  const ZZ = ['', 'R', 'C', 'I'];
  const serialize = () => {
    const n = N * N, fl = new Uint8Array(n), zn = new Uint8Array(n), bl = new Uint8Array(n), ct = new Uint8Array(n), cd = new Uint8Array(n), tr = new Uint8Array(n), rt = new Uint8Array(n), rs = new Uint8Array(n), rd = new Uint8Array(n), rf = new Uint8Array(n), ww = new Uint8Array(n), pd = new Uint8Array(n);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const k = i * N + j;
      fl[k] = (road[i][j] ? 1 : 0) | (pline[i][j] ? 2 : 0) | (pipe[i][j] ? 4 : 0); zn[k] = ZZ.indexOf(zone[i][j]); bl[k] = bld[i][j]; ct[k] = consT[i][j]; cd[k] = Math.min(255, consD[i][j]); tr[k] = TT.indexOf(terrain[i][j]); rt[k] = rtier[i][j]; rs[k] = rstage[i][j]; rd[k] = Math.min(255, rday[i][j]); rf[k] = rfrom[i][j]; ww[k] = rw[i][j]; pd[k] = rpd[i][j]; }
    return { format: SAVE_FORMAT, version: SAVE_VERSION, terrainVersion: TERRAIN_VERSION, savedAt: new Date().toISOString(), city, sim: { ...sim }, tax: { ...tax }, funding: { ...funding }, lastMonth,
      civs: civs.map(c => ({ type: c.type, i: c.i, j: c.j, s: c.s })), lots: [...lots].map(l => ({ ...l })), cam: { x: camX, y: camY, zoom }, grids: { terrain: b64(tr), flags: b64(fl), zone: b64(zn), bld: b64(bl), consT: b64(ct), consD: b64(cd), rtier: b64(rt), rstage: b64(rs), rday: b64(rd), rfrom: b64(rf), rwidth: b64(ww), rpart: b64(pd), zden: b64(Uint8Array.from(zden.flat())), zface: b64(Uint8Array.from(zface.flat())), pk: b64(Uint8Array.from(pk.flat())) }, traffic: { volume: b64(new Uint8Array(new Uint16Array(trips.volume.map(v => Math.min(65535, v))).buffer)) } };
  };
  const applySave = (o: any) => {
    const g = (k: string) => unb64(o.grids[k]), fl = g('flags'), zn = g('zone'), bl = g('bld'), ct = g('consT'), cd = g('consD'), z0 = new Uint8Array(N * N), rt = o.grids.rtier ? g('rtier') : null, rs = o.grids.rstage ? g('rstage') : z0, rd = o.grids.rday ? g('rday') : z0, rf = o.grids.rfrom ? g('rfrom') : z0, ww = o.grids.rwidth ? g('rwidth') : z0, pkg = o.grids.pk ? g('pk') : null, pd = o.grids.rpart ? g('rpart') : null, zdg = o.grids.zden ? g('zden') : null, zfg = o.grids.zface ? g('zface') : null; roadWorks.length = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const k = i * N + j;
      road[i][j] = !!(fl[k] & 1); pline[i][j] = !!(fl[k] & 2); pipe[i][j] = !!(fl[k] & 4); zone[i][j] = ZZ[zn[k]] ?? ''; bld[i][j] = bl[k]; consT[i][j] = ct[k]; consD[i][j] = cd[k]; civAt[i][j] = null;
      rtier[i][j] = road[i][j] ? (rt ? rt[k] || 2 : 2) : 0; rstage[i][j] = road[i][j] ? rs[k] : 0; rday[i][j] = rd[k]; rfrom[i][j] = rf[k]; rw[i][j] = road[i][j] ? ww[k] : 0; pk[i][j] = pkg ? pkg[k] : 0; rpd[i][j] = pd && rw[i][j] >= 2 ? pd[k] : 0; if (rstage[i][j]) roadWorks.push(k);
      zden[i][j] = zdg ? zdg[k] : zone[i][j] ? (bld[i][j] || consT[i][j] || 2) : 0; zface[i][j] = zfg ? zfg[k] : 0; } // pre-v7: density of the current building (empty = Medium), Auto facing
    if (!pd) guessPartners();
    civs.length = 0; for (const c of o.civs) { if (!SERV[c.type]) continue; const v: Civ = { type: c.type, i: c.i, j: c.j, s: c.s }; civs.push(v); for (let a = 0; a < c.s; a++) for (let b = 0; b < c.s; b++) if (inb(c.i + a, c.j + b)) civAt[c.i + a][c.j + b] = v; }
    for (const r of lot) r.fill(null); lots.clear(); for (const l of o.lots ?? []) addLot({ ...l });
    Object.assign(sim, o.sim); Object.assign(tax, o.tax); Object.assign(funding, o.funding); lastMonth = o.lastMonth ?? null;
    if (o.cam) { camX = o.cam.x; camY = o.cam.y; zoom = clampZoom(o.cam.zoom); }
    tripsDirty = true; trips.volume.fill(0); if (o.traffic?.volume) { const u = new Uint16Array(unb64(o.traffic.volume).buffer); trips.volume.set(u.subarray(0, N * N)); }
    computeNear(); rebuildZ(); markAll(); census(); updateStats(); setSpeed(o.sim.speed ?? 1);
  };
  const saveTo = async (slot: string, id: string) => { const o = serialize(), data = await compress(o); await putSave(metaFrom(o, slot, id, data)); return data; };
  const slug = (t: string) => t.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'city';
  const autoId = () => `auto:${city.name}:${city.size}:${city.seed}`;
  let autosaveOn = localStorage.getItem('autosave') !== 'off';
  onMonth = () => { if (autosaveOn && Math.floor(sim.day / 30) % 3 === 0) saveTo('Autosave', autoId()).then(() => toastOk('Autosaved')).catch(() => {}); };
  const toastOk = (m: string) => { toast(m); toastEl.style.background = 'rgba(30,110,60,.92)'; setTimeout(() => toastEl.style.background = '', 2700); };
  const saveEl = document.getElementById('saveMenu')!;
  saveEl.addEventListener('pointerdown', e => e.stopPropagation());
  const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
  const renderSaves = async () => {
    const ss: SaveMeta[] = await listSaves();
    saveEl.innerHTML = `<div class="bh"><b>💾 Save / Load</b><button id="sClose">✕</button></div>
      <div class="sv"><input id="sName" maxlength="40" value="${esc(city.name)}" title="Slot name"><button id="sSave">Save</button></div>
      <label class="chk"><input type="checkbox" id="sAuto" ${autosaveOn ? 'checked' : ''}> Autosave every 3 game-months</label>
      <h4>Saved cities</h4><div id="sList">${ss.length ? ss.map(m => `<div class="slot" data-id="${esc(m.id)}"><div><b>${esc(m.city)}</b> · ${esc(m.slot)}<br><small>${m.size}×${m.size} · ${gameDate(m.day)} · pop ${m.pop.toLocaleString()} · $${Math.floor(m.funds).toLocaleString()} · ${ago(m.ts)} · ${Math.ceil(m.bytes / 1024)} KB</small></div><span><button data-a="load">Load</button><button data-a="exp" title="Download .city file">⬇</button><button data-a="del" title="Delete">🗑</button></span></div>`).join('') : '<i>Nothing saved yet</i>'}</div>
      <h4>Move or back up</h4><div class="sv"><button id="sExp">⬇ Export this city (.city)</button><label class="imp">⬆ Import .city<input type="file" id="sImp" accept=".city,application/octet-stream" hidden></label></div>
      <small class="hint">Saves live in this browser. Export a .city file to back up or open the city on another device (e.g. iPad: AirDrop or Files, then Import).</small>`;
    saveEl.querySelector('#sClose')!.addEventListener('click', () => saveEl.style.display = 'none');
    (saveEl.querySelector('#sAuto') as HTMLInputElement).onchange = e => { autosaveOn = (e.target as HTMLInputElement).checked; localStorage.setItem('autosave', autosaveOn ? 'on' : 'off'); };
    saveEl.querySelector('#sSave')!.addEventListener('click', async () => { const slot = (saveEl.querySelector('#sName') as HTMLInputElement).value.trim() || city.name; await saveTo(slot, 'slot:' + slot); toastOk(`Saved “${slot}”`); renderSaves(); });
    saveEl.querySelector('#sExp')!.addEventListener('click', async () => { download(await compress(serialize()), slug(city.name) + '.city'); });
    (saveEl.querySelector('#sImp') as HTMLInputElement).onchange = async e => { const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
      try { const o = await readFile(f), data = await compress(o), id = 'import:' + Date.now(); await putSave(metaFrom(o, 'Imported ' + new Date().toLocaleDateString(), id, data)); toastOk(`Imported “${o.city.name}”`); renderSaves(); }
      catch (err) { toast('Could not import: ' + (err as Error).message); } };
    saveEl.querySelectorAll<HTMLElement>('.slot').forEach(row => row.querySelectorAll<HTMLElement>('button[data-a]').forEach(b => b.onclick = async () => { const id = row.dataset.id!, a = b.dataset.a;
      if (a === 'load') { if (!confirm('Load this city? Unsaved progress here will be lost.')) return; sessionStorage.setItem('loadId', id); location.href = location.pathname; }
      else if (a === 'exp') { const r = await getSave(id); if (r) download(r.data, slug(r.city) + '.city'); }
      else if (a === 'del') { if (confirm('Delete this save?')) { await deleteSave(id); renderSaves(); } } }));
  };
  const toggleSave = () => { saveEl.style.display = saveEl.style.display === 'block' ? 'none' : 'block'; if (saveEl.style.display === 'block') renderSaves(); };
  document.getElementById('saveBtn')!.onclick = e => { e.stopPropagation(); toggleSave(); };
  window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveTo(city.name, 'slot:' + city.name).then(() => toastOk(`Saved “${city.name}”`)); } });
  if (loaded) applySave(loaded);
  Object.assign((window as any).__city, { lots: () => [...lots], lotAt: (i: number, j: number) => lot[i][j], serialize, applySave, saveTo, listSaves });
  // info panel
  const info = document.getElementById('info')!;
  const KNAME: Record<string, string> = { work: 'commuting to work', school: 'school run', errand: 'shopping / errand' };
  const placeName = (k: number) => { const [i, j] = tileOf(k), c = civAt[i][j]; return c ? SERV[c.type].name : zone[i][j] ? `${ZNAME[zone[i][j]]} ${DNAME[bld[i][j]] ?? ''} building` : 'road'; };
  const inspectAt = (sx: number, sy: number) => { const wx = (sx - world.position.x) / zoom, wy = (sy - world.position.y) / zoom;
    let best: Car | null = null, bd = 9; for (const c of cars) if (c.s.visible && c.trip) { const d = Math.hypot(c.s.x - wx, c.s.y - 2 - wy); if (d < bd) { bd = d; best = c; } }
    if (!best) return inspect(tileAt(sx, sy)); const t = best.trip!, [hi, hj] = tileOf(t.home), [di, dj] = tileOf(t.dest), left = best.route!.slice(best.ri ?? 0);
    info.innerHTML = `<b>🚗 ${best.key.replace(/_/g, ' ')}</b> — ${KNAME[t.kind]}${t.back ? ' (heading home)' : ''}<br>${t.back ? 'From' : 'Home'}: ${t.back ? placeName(t.dest) + ` (${di}, ${dj})` : `house at ${hi}, ${hj}`}<br>${t.back ? 'To: home at ' + hi + ', ' + hj : 'Going to: ' + placeName(t.dest) + ` (${di}, ${dj})`}<br>${left.length} road tiles left · about ${Math.max(1, Math.round(trips.minutes(left)))} min<br><small>Each car on screen stands for ~${Math.max(1, Math.round(t.scale))} real trips this hour</small>`;
    info.style.display = 'block'; return best; };
  const commuteHtml = (k: number) => { const fl = trips.homeFlows.get(k); if (!fl) return trips.access[k] < 0 ? '<br>⚠ No road access' : '<br>⚠ No jobs, schools or shops reachable by road';
    return '<br><b>Where residents go</b>' + fl.map(f => { const p = trips.route(trips.access[k], trips.end(f)), walk = trips.md(k, f.dest) <= TRIPS.walkTiles;
      return `<br>${f.kind === 'work' ? '💼' : f.kind === 'school' ? '🎒' : '🛒'} ${Math.round(f.people * 10) / 10} → ${placeName(f.dest)} · ${walk ? 'walk' : p ? Math.max(1, Math.round(trips.minutes(p))) + ' min drive' + (f.walk ? ` + ${f.walk * 20} m walk from parking` : '') + (f.extraMin ? ` (+${f.extraMin} min hunting for a space)` : '') : 'no route'}`; }).join(''); };
  const workersHtml = (k: number) => { let w = 0, homes = 0, mins = 0; for (const f of trips.flows) if (f.dest === k && f.kind === 'work') { w += f.people; homes++; const p = trips.route(trips.access[f.home], trips.access[k]); if (p) mins += trips.minutes(p) * f.people; }
    return `<br><b>Workers</b>: ${Math.round(w * 10) / 10} from ${homes} homes${w ? ` · avg commute ${Math.max(1, Math.round(mins / w))} min` : ''}`; };
  const inspect = ({ i, j }: { i: number; j: number }) => {
    if (inb(i, j) && consT[i][j]) { info.innerHTML = `<b>${ZNAME[zone[i][j]]} — under construction</b><br>Building: ${DNAME[consT[i][j]]}<br>Stage ${Math.min(3, 1 + Math.floor(consD[i][j] / CONS_DAYS))} of 3<br><small>Tile ${i}, ${j}</small>`; info.style.display = 'block'; return; }
    const pct = (v: number) => Math.round(v * 100) + '%';
    if (inb(i, j) && civAt[i][j]) { const c = civAt[i][j]!, S = SERV[c.type], ci = c.i + (c.s - 1) / 2, cj = c.j + (c.s - 1) / 2;
      if (S.kind === 'parking') { const k = c.i * N + c.j; info.innerHTML = `<b>🅿️ ${S.name}</b><br>Size ${S.size}×${S.size} · ${(PARKING as any)[c.type].spaces} spaces · Cost $${S.cost} · Upkeep $${UPKEEP[c.type]}/month${parkInfo(k)}<br>Fee income: ~$${Math.round(garageFees(k))}/month<br><small>Drivers park here for nearby offices, shops and hospitals, then walk</small>`; info.style.display = 'block'; return; }
      let served = 0; for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) if (zone[a][b] === 'R' && bld[a][b] && Math.hypot(a - ci, b - cj) <= S.radius) served += resCap(a, b);
      info.innerHTML = S.util ? `<b>${S.name}</b><br>Size ${S.size}×${S.size} · Cost $${S.cost} · Upkeep $${UPKEEP[c.type]}/month<br>Output: <b>${S.kind === 'power' ? fmtPower(S.out!) : fmtWater(S.out!)}</b> ${S.kind === 'power' ? '⚡' : '💧'}<br>City ${S.kind === 'power' ? `power: ${fmtPower(util.pUse)} / ${fmtPower(util.pCap)} (demand ${fmtPower(util.pWant)})` : `water: ${fmtWater(util.wUse)} / ${fmtWater(util.wCap)} (demand ${fmtWater(util.wWant)})`}<br>` : `<b>${S.name}</b><br>Size ${S.size}×${S.size} · Cost $${S.cost}<br>Coverage radius: ${S.radius} tiles<br>Residents covered: <b>${Math.round(served)}</b><br>Power ${powered[i][j] ? '✔' : '✘'} · Water ${watered[i][j] ? '✔' : '✘'}<br><small>Tile ${c.i}, ${c.j}</small>`; info.style.display = 'block'; return; }
    if (inb(i, j) && pk[i][j]) { info.innerHTML = `<b>${pk[i][j] === 1 ? 'Private parking lot' : 'Private parking garage'}</b>${parkInfo(i * N + j)}<br><small>Grew here because drivers nearby couldn't find spaces · Tile ${i}, ${j}</small>`; info.style.display = 'block'; return; }
    if (!inb(i, j) || !bld[i][j]) { info.style.display = 'none'; return; }
    const z = zone[i][j], v = z === 'R' ? resCap(i, j) : CAP[z][bld[i][j]];
    const lt = lot[i][j];
    info.innerHTML = `<b>${lt ? 'Suburban house' : ZNAME[z] + ' building'}</b><br>${lt ? `Lot 1×${Math.max(lt.wi, lt.dj)}, facing ${lt.dir} road` : `${DNAME[bld[i][j]]} (level ${bld[i][j]})`}<br>${z === 'R' ? 'Residents' : 'Jobs'}: <b>${Math.round(v * 10) / 10}</b> · Power ${fmtPower(PDEM[z][bld[i][j]])} · Water ${fmtWater(WDEM[z][bld[i][j]])}<br>Education ${pct(cov.edu[i][j])} · Health ${pct(cov.health[i][j])}<br>Police ${pct(cov.police[i][j])} · Fire ${pct(cov.fire[i][j])}<br>Crime: ${crime[i][j] < 1.5 ? 'low' : crime[i][j] < 3.5 ? 'medium' : 'high'} · Fire risk: ${fireRisk[i][j] < 1 ? 'low' : fireRisk[i][j] < 3 ? 'medium' : 'high'}<br>Power ${powered[i][j] ? '✔' : '✘ none'} · Water ${watered[i][j] ? '✔' : '✘ none'}${powered[i][j] && watered[i][j] ? '' : ' (stays low density)'}<br>Pollution: ${poll[i][j] < 0.5 ? 'none' : poll[i][j] < 3 ? 'low' : poll[i][j] < 6 ? 'medium' : 'high'}<br><small>Tile ${i}, ${j}</small>`;
    info.innerHTML += `<br>${DENN[zden[i][j]] || 'Uncapped'} zone (cap: ${CAPNAME[z][capOf(i, j)]}) · faces ${FACE[drawFace(i, j)][0]}${zface[i][j] ? ' (locked)' : ' (auto)'}` + (hasAccess(i, j) ? '' : '<br>⚠ No road access on the front: this building is being abandoned');
    info.innerHTML += zone[i][j] === 'R' ? commuteHtml(i * N + j) : workersHtml(i * N + j) + (trips.unmet[i * N + j] > 0.5 ? `<br>⚠ ${Math.round(trips.unmet[i * N + j])} cars can't find parking nearby` : '');
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
  const up = (e: PointerEvent) => { if (e.type === 'pointerup' && tool === 'select' && ptrs.size === 1 && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) inspectAt(e.clientX, e.clientY); if (drag && e.type === 'pointerup') commit(); else if (drag) { drag = null; preview.clear(); } ptrs.delete(e.pointerId); pinchDist = 0; if (e.pointerType !== 'mouse') mouse = { x: e.clientX, y: e.clientY }; };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  c.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') mouse = null; });
  c.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, zoom * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  window.addEventListener('keydown', e => keys.add(e.key.toLowerCase()));
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  const dot = (() => { const g = new Graphics().circle(16, 16, 16).fill(0xffffff); const t = app.renderer.generateTexture(g); g.destroy(); return t; })();
  const cloudTex = (() => { const g = new Graphics(); for (let k = 10; k >= 1; k--) g.ellipse(160, 80, 16 * k, 8 * k).fill({ color: 0x000000, alpha: 0.03 }); const t = app.renderer.generateTexture(g); g.destroy(); return t; })();
  const W0 = toScreen(0, N - 1).x - TW, W1 = toScreen(N - 1, 0).x + TW, H1 = toScreen(N - 1, N - 1).y + TH;
  const NC = Math.max(7, Math.round(7 * N / 64)); const clouds = [...Array(NC)].map((_, k) => { const s = new Sprite(cloudTex); s.anchor.set(0.5); s.scale.set(1.5 + (k % 3) * 0.8, 1.2 + (k % 2) * 0.6); s.position.set(W0 + (W1 - W0) * k / NC, H1 * ((k * 37) % 100) / 100); cloudL.addChild(s); return s; });
  type P = { s: Sprite; vx: number; vy: number; life: number; max: number };
  const smoke: P[] = []; let smokeAcc = 0;
  const CAR_COLORS = [0xd94040, 0xf0f0f0, 0x3a6fd8, 0xf2c230, 0x333333, 0x40a060];
  const VSCALE = 1; // the sedan sprite is ~10 m long at full size (0.5 tile of 20 m); 0.47 makes it ~4.7 m like a real mid-size car
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
  const roadNbrs = (i: number, j: number) => ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const).map(([a, b]) => [i + a, j + b]).filter(([a, b]) => drivable(a, b) && !partner(i, j, a - i, b - j));
  const activity = (i: number, j: number) => { let v = 0; for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (inb(i + a, j + b) && bld[i + a][j + b]) v += CAP[zone[i + a][j + b]][bld[i + a][j + b]]; return v; };
  const roadList = () => { const r: [number, number][] = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (drivable(i, j)) r.push([i, j]); return r; };
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
  { const rb = document.createElement('button'); rb.textContent = '↺ Reset view & settings'; rb.style.marginTop = '6px';
    rb.onclick = () => { for (const k of ['fx', 'grid', 'zones', 'music', 'ambience', 'volume', 'ambVolume', 'autosave']) localStorage.removeItem(k); location.reload(); }; menu.appendChild(rb); }
  if (new URLSearchParams(location.search).has('debug')) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:10px;bottom:120px;z-index:20;background:#000c;color:#9f9;font:11px monospace;padding:6px;white-space:pre;pointer-events:none'; document.body.appendChild(d);
    setInterval(() => { d.textContent = `renderer ${app.renderer.name} ${app.canvas.width}x${app.canvas.height} dpr ${devicePixelRatio}\ncam ${camX.toFixed(0)},${camY.toFixed(0)} zoom ${zoom.toFixed(3)} far ${far}\nworld vis ${world.visible} a ${world.alpha}\n` + world.children.map((c, k) => `${k} vis ${c.visible} a ${c.alpha.toFixed(2)} n ${c.children.length}`).join('\n'); }, 500); }
  document.getElementById('fxBtn')!.onclick = e => { e.stopPropagation(); menu.style.display = menu.style.display === 'block' ? 'none' : 'block'; };
  setFxVisibility();
  let clock = 0, windF = -1, chunkErr = false;
  let night = 0;
  function applyNight(n: number) { // function declaration: hoisted, because setFxVisibility can call it during init (day/night off) // objects are tinted to match the shading (per visible chunk, lazily); lights fade in additively
    if (Math.abs(n - lastNightTint) < 0.01) return; lastNightTint = n;
    const r = Math.round(255 * (1 - 0.48 * n)), g = Math.round(255 * (1 - 0.46 * n)), b = Math.round(255 * (1 - 0.36 * n)); curTint = (r << 16) | (g << 8) | b;
    smokeL.alpha = 1 - 0.5 * n;
  }
  const syncChunkNight = () => { for (const ch of chunks) if (ch.vis) {
    if (ch.tint !== curTint) { ch.tint = curTint; for (const c of ch.ob.children) if (!(c as any).__light) (c as Sprite).tint = curTint; }
    if (ch.la !== lastNightTint) { ch.la = lastNightTint; for (const l of ch.lights) { l.alpha = Math.max(0, lastNightTint); l.visible = l.alpha > 0.02; } } } };
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
    try { updateChunks(); syncChunkNight(); overlayHook(); } catch (err) { if (!chunkErr) { chunkErr = true; console.error('map drawing failed', err); toast('Map drawing problem: ' + (err as Error).message + ' (showing the simple map)'); overviewL.visible = true; } }
    { const f = Math.floor(clock * 8); if (f !== windF) { windF = f; const fr = [0, 1, 2, 3].map(k => artTex('util_wind_f' + k)); if (fr[0]) for (const ch of chunks) if (ch.vis) for (const w of ch.winds) w.texture = fr[(f + (w as any).__ph) % 4]!; } } // turbines spin at 8 fps
    if (fx.clouds) for (const c of clouds) { c.x += 12 * dt; c.y += 3 * dt; if (c.x > W1 + 300) { c.x = W0 - 300; c.y = Math.random() * H1; } }
    if (fx.nature) {
      for (const ch of chunks) if (ch.vis) for (const tr of ch.trees) tr.s.skew.x = Math.sin(clock * 1.3 + tr.ph) * 0.03;
      for (const f of flocks) f.birds.forEach((b, k) => { const a = clock * 0.4 + f.ph + k * 0.25; b.position.set(f.cx + Math.cos(a) * f.r + k * 6, f.cy + Math.sin(a) * f.r * 0.5 - k * 3); b.scale.y = 0.6 + Math.abs(Math.sin(clock * 8 + k)) * 0.8; });
    }
    for (const f of flocks) for (const b of f.birds) b.visible = fx.nature;
    if (fx.smoke) {
      smokeAcc += dt;
      if (smokeAcc > 0.12) { smokeAcc = 0;
        const smokeCap = Math.min(140, 30 + 4 * chunks.filter(c => c.vis).length); // particles scale with the visible area
        for (const ch of chunks) if (ch.vis) for (const b of ch.blds) if (b.z === 'I' && smoke.length < smokeCap && Math.random() < 0.12 * b.L) {
          const s = new Sprite(dot); s.anchor.set(0.5); s.tint = 0xcfcac2; s.alpha = 0.5; s.scale.set(0.12);
          s.position.set(b.x + 10 + (b.seed % 7) - 3, b.y - 22 - b.L * 6); smokeL.addChild(s);
          smoke.push({ s, vx: 4 + Math.random() * 4, vy: -10 - Math.random() * 6, life: 0, max: 3 + Math.random() * 2 });
        } }
    }
    for (let k = smoke.length - 1; k >= 0; k--) { const p = smoke[k]; p.life += dt;
      if (p.life > p.max || !fx.smoke) { p.s.destroy(); smoke.splice(k, 1); continue; }
      p.s.x += p.vx * dt; p.s.y += p.vy * dt; p.s.scale.set(0.12 + p.life * 0.12); p.s.alpha = 0.5 * (1 - p.life / p.max); }
    if (fx.cars) {
      if (sim.day !== lastTripHour) { lastTripHour = sim.day; if (!far && fx.cars) spawnTrips(); }
    }
    for (const ch of chunks) if (ch.vis) for (const t of ch.trucks) { const w = t.__truck, f = Math.sin(clock * 1.3 + w.ph), d = Math.cos(clock * 1.3 + w.ph) >= 0 ? 0 : 1; t.x = w.x + f * w.vx; t.y = w.y + f * w.vy; if (d !== w.d) { w.d = d; if (t instanceof Sprite) { const tx = artTex(w.keys[d]); if (tx) t.texture = tx; } else t.scale.x = d ? -1 : 1; } }
    const lane = new Map<number, number[]>(), segK = (pi: number, pj: number, i: number, j: number, ln = 0) => (((pi * N + pj) * 8 + (i - pi + 1) * 2 + (j - pj + 1 >> 1)) * 2 + (rw[i][j] ? ln : 0)) | 0; // multi-lane roads: one queue per lane
    for (const c of cars) { const k = segK(c.pi, c.pj, c.i, c.j, c.ln); const l = lane.get(k); if (l) l.push(c.t); else lane.set(k, [c.t]); }
    for (const ch of chunks) if (ch.vis) for (const tl of ch.tls) { const st = lightState(tl.axis, tl.ph); { tl.st = st;
      for (const c of ['red', 'yellow', 'green']) { tl.sp[c].visible = c === st; tl.sp[c].tint = curTint; const n = tl.nt[c]; if (n) { n.visible = c === st && night > 0.02; n.alpha = night; } } } }
    // intersection reservation: a car holds the junction tile from its stop line until it is half way out the other side
    const resv = new Map<number, Car[]>(); for (const c of cars) if (c.res != null) { const l = resv.get(c.res); if (l) l.push(c); else resv.set(c.res, [c]); }
    const compatible = (a: Car, b: { din: string; dout: string }) => { const opp: Record<string, string> = { NE: 'SW', SW: 'NE', SE: 'NW', NW: 'SE' };
      return a.din === b.din && a.dout === b.dout ? true : opp[a.din!] === b.din && a.din === a.dout && b.din === b.dout; }; // same movement (spacing handles it) or straight through from opposite sides
    const STOPLINE = 0.3;
    const GAP = 0.55; // simple spacing: keep about half a tile behind the car ahead in the same lane
    const blocked = (k: number, t: number, self: boolean) => { const l = lane.get(k); if (!l) return false; for (const u of l) if (u > t + (self ? 1e-6 : -1) && u - t < GAP && !(self && u === t)) return true; return false; };
    for (let k = cars.length - 1; k >= 0; k--) { const c = cars[k];
      if (!drivable(c.i, c.j) || !drivable(c.pi, c.pj) || !fx.cars) { dropCar(k); continue; } const vis = chunkOf(c.i, c.j).vis;
      const ck = segK(c.pi, c.pj, c.i, c.j, c.ln);
      if (c.res != null && c.res !== c.i * N + c.j && c.res !== c.pi * N + c.pj) c.res = undefined; // left the junction
      if (c.res != null && c.res === c.pi * N + c.pj && c.t > 0.5) c.res = undefined;
      let hold = false; const jk = c.i * N + c.j, cc = ctrl.get(jk);
      if (cc && c.res !== jk && c.t <= STOPLINE + 0.001 && sim.speed && c.t + dt * c.sp >= STOPLINE) { // approaching a controlled junction
        const din = c.i - c.pi > 0 ? 'SE' : c.i - c.pi < 0 ? 'NW' : c.j < c.pj ? 'NE' : 'SW';
        if (!c.nx) c.nx = routeNext(c);
        const dout = !c.nx ? din : c.nx[0] - c.i > 0 ? 'SE' : c.nx[0] - c.i < 0 ? 'NW' : c.nx[1] < c.j ? 'NE' : 'SW';
        let go = true;
        if (cc.k === 'L') go = lightState(axisOf(din), cc.ph) === 'green';
        else if (cc.stops.includes(din)) { c.wait = (c.wait ?? 0) + dt; go = c.wait > 0.8; }
        const occ = resv.get(jk) ?? []; if (go && occ.some(o => o !== c && !compatible(o, { din, dout }))) go = false;
        if (go) { c.res = jk; c.din = din; c.dout = dout; c.wait = 0; const l = resv.get(jk); if (l) l.push(c); else resv.set(jk, [c]); } else { hold = true; c.t = Math.max(c.t, Math.min(c.t, STOPLINE)); }
      }
      if (!c.nx && c.t > 0.4) c.nx = routeNext(c);
      if (!hold && c.nx && c.t > 1 - GAP) { const nl2 = lane.get(segK(c.i, c.j, c.nx[0], c.nx[1], c.ln)); if (nl2 && nl2.some(u => u < c.t + GAP - 1)) hold = true; } // car just ahead on the next stretch
      if (sim.speed && !hold && !blocked(ck, c.t, true)) { const l = lane.get(ck)!, ix = l.indexOf(c.t); c.t = Math.min(1, c.t + dt * c.sp * (ROAD_TIERS[(rtier[c.i][c.j] || 2) as RoadTier].speed)); if (ix >= 0) l[ix] = c.t; }
      if (c.t >= 1) { const nx = c.nx ?? routeNext(c); if (!nx) { dropCar(k); continue; } // arrived: the driver parks and walks in
        const nk = segK(c.i, c.j, nx[0], nx[1], c.ln), nl = lane.get(nk); if (nl && nl.some(u => u < GAP)) { c.t = 1; } else {
        const ol = lane.get(ck); if (ol) { const ix = ol.indexOf(c.t); if (ix >= 0) ol.splice(ix, 1); } if (nl) nl.push(0); else lane.set(nk, [0]);
        c.pi = c.i; c.pj = c.j; c.i = nx[0]; c.j = nx[1]; c.t = 0; c.ri = (c.ri ?? 0) + 1; c.nx = undefined; const ob = chunkOf(c.i, c.j).ob; if (c.s.parent !== ob) { ob.addChild(c.s); if (c.n) ob.addChild(c.n); } } }
      const a = toScreen(c.pi, c.pj), b = toScreen(c.i, c.j), dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
      const di = c.i - c.pi, dir = di > 0 ? 'SE' : di < 0 ? 'NW' : c.j < c.pj ? 'NE' : 'SW';
      if (c.s instanceof Graphics && !hasArt(c.key + '_NE')) { const ox = -dy / L * 5, oy = dx / L * 5; c.s.position.set(a.x + dx * c.t + ox, a.y + dy * c.t + oy); c.s.rotation = Math.atan2(dy, dx); }
      else {
        if (dir !== c.dir) { // swap to the sprite facing the new direction
          c.dir = dir; c.s.destroy(); c.n?.destroy();
          const ob = chunkOf(c.i, c.j).ob; c.s = place(c.key + '_' + dir, 0, 0, ob); (c.s as any).__veh = true; (c.s as Sprite).tint = curTint; c.s.scale.set(c.s.scale.x * VSCALE, c.s.scale.y * VSCALE);
          c.n = placeNight(c.key + '_' + dir, 0, 0, ob); if (c.n) { (c.n as any).__veh = true; (c.n as any).__light = true; c.n.scale.set(c.n.scale.x * VSCALE, c.n.scale.y * VSCALE); }
        }
        const avd = rw[c.i][c.j] >= 2 ? rpd[c.i][c.j] : 0; let lx: number, ly: number;
        if (avd) { const [di, dj] = BITV[avd], e = toScreen(c.i + di, c.j + dj), q = toScreen(c.i, c.j), px = e.x - q.x, py = e.y - q.y, k = (LANE[dir][0] * px + LANE[dir][1] * py) > 0 ? 0.5 - 0.1325 : 0.5 - 0.2975; lx = px * k; ly = py * k; } // avenue half: lanes 0.1325 / 0.2975 tile from the shared median edge
        else { const lf = rw[c.i][c.j] ? (c.ln ? 1.5 : 0.5) : 1; lx = LANE[dir][0] * lf; ly = LANE[dir][1] * lf; } // 0.15 tile; streets 0.075 / 0.225
        const x = a.x + dx * c.t + lx, y = a.y + dy * c.t + ly;
        c.s.position.set(x, y); c.s.zIndex = y + 1; // depth: same key as buildings (screen y)
        if (c.n) { c.n.position.set(x, y); c.n.zIndex = y + 1.01; c.n.alpha = night; c.n.visible = vis && night > 0.02; } (c.s as Sprite).tint = curTint;
      }
      c.s.visible = vis;
    }
  });
  let frames = 0, cpuAcc = 0, tF = 0; app.ticker.add(() => { frames++; tF = performance.now(); }, undefined, 1000); // highest priority: start of frame work
  app.ticker.add(() => { cpuAcc += performance.now() - tF; }, undefined, -1000); // after Pixi has rendered: JS + scene submission time per frame
  const genDense = (seed = 7) => { // test helper: a dense, fully built city on every land tile
    let h = seed >>> 0; const rnd = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { if (terrain[i][j] === 'water' || civAt[i][j]) continue;
      if (i % 8 === 0 || j % 8 === 0) { rw[i][j] = 0; road[i][j] = true; rtier[i][j] = 2; rstage[i][j] = 0; pline[i][j] = true; pipe[i][j] = true; zone[i][j] = ''; bld[i][j] = 0; continue; }
      const bi = (i / 8) | 0, bj = (j / 8) | 0;
      if ((bi * 7 + bj * 3) % 5 === 0 && i % 8 === 2 && j % 8 === 2) { let ok = true; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (!inb(i + a, j + b) || terrain[i + a][j + b] === 'water' || (i + a) % 8 === 0 || (j + b) % 8 === 0) ok = false;
        if (ok) { const c: Civ = { type: 'coal', i, j, s: 3 }; civs.push(c); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) civAt[i + a][j + b] = c; const t: Civ = { type: 'tower', i: i + 4, j, s: 1 }; if (!civAt[i + 4][j] && (i + 4) % 8) { civs.push(t); civAt[i + 4][j] = t; } continue; } }
      if (civAt[i][j]) continue;
      zone[i][j] = (bi + bj) % 6 === 0 ? 'I' : (bi * 3 + bj) % 4 === 0 ? 'C' : 'R'; bld[i][j] = 1 + Math.floor(rnd() * 3); consT[i][j] = 0; zden[i][j] = 3;
    }
    computeNear(); rebuildZ(); markAll(); census(); updateStats();
  };
  const measure = async (ms = 5000) => { const f0 = frames, t0 = performance.now(); perf.tickMax = 0; cpuAcc = 0; await new Promise(r => setTimeout(r, ms)); const cpu = Math.round(cpuAcc / Math.max(1, frames - f0) * 10) / 10; return { cpuFrameMs: cpu, fps: Math.round((frames - f0) * 1000 / (performance.now() - t0) * 10) / 10, tickAvgMs: Math.round(perf.tick * 10) / 10, tickMaxMs: Math.round(perf.tickMax * 10) / 10, censusMs: Math.round(perf.census * 10) / 10, visibleChunks: chunks.filter(c => c.vis).length, cars: cars.length, smoke: smoke.length }; };
  Object.assign((window as any).__city, { layers: { groundL, gridL, roadL, zoneL, objL, smokeL, cloudL, nightG, iconL, skyL, pipeL }, genDense, measure, perf, chunks: () => chunks.length, far: () => far, pan: (dx: number, dy: number) => { camX += dx; camY += dy; } });
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
