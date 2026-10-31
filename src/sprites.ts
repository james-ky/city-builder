import { Assets, Graphics, Sprite, Texture, Container } from 'pixi.js';
export const TW = 64, TH = 32;

type Art = { tex: Texture; anchor: [number, number]; scale: number };
const art = new Map<string, Art>();          // asset name -> texture
const keyed = new Map<string, string>();     // lookup key (road_3, shore_16) -> asset name
const weights = new Map<string, number>(); // variant name -> pick weight (default 1)
const variants = new Map<string, string[]>(); // grass -> [grass_a, grass_b, ...]
const aliasOf = new Map<string, string>();   // bld_R_1 -> bld_R_1_a
const nights = new Map<string, string>();
const meta = new Map<string, any>();           // asset name -> its manifest entry (vehicle body fields etc.)     // building asset -> its night-lights overlay (bld_R_1_a -> bld_R_1_a_night)
/** Game keys that map onto differently-named art. Add entries here as new art arrives. */
const ALIAS: Record<string, string> = { grid: 'grid_overlay', civic_school: 'school_elem', civic_highschool: 'school_high', civic_police: 'police', civic_fire: 'fire_station', civic_clinic: 'clinic', civic_hospital: 'hospital' };

/** Loads assets/manifest.json (art set format: version/assets[]/autotile). Missing art falls back to code drawing. */
export async function loadManifest() { // the base art set, then add-on sets merged after it (16-direction vehicles)
  await loadOne('./assets/manifest.json'); await loadOne('./assets/vehicles/manifest_16dir.json');
}
async function loadOne(url: string) {
  let m: any;
  try { m = await (await fetch(url)).json(); } catch { return; }
  const defScale = m.displayScale ?? 1;
  await Promise.all((m.assets ?? []).map(async (a: any) => {
    try {
      const tex: Texture = await Assets.load('./assets/' + a.file);
      tex.source.autoGenerateMipmaps = true; tex.source.updateMipmaps?.(); // mipmaps: clean, non-grainy art when zoomed out
      // Pixi already treats '@2x' files as resolution 2; size the sprite to manifest size * scale regardless
      const want = (a.size?.[0] ?? tex.source.pixelWidth) * (a.scale ?? defScale);
      art.set(a.name, { tex, anchor: a.anchor ?? [0.5, 0.5], scale: want / tex.width });
    } catch { console.warn('missing art', a.file); return; }
    meta.set(a.name, a);
    if (a.aliasOf) aliasOf.set(a.name, a.aliasOf);
    if (a.nightOf || a.name.endsWith('_night')) { nights.set(a.nightOf ?? a.name.slice(0, -6), a.name); return; }
    // explicit variantOf, or implicit <base>_<letter> naming for buildings
    if (a.facing) return; // <name>_<NE|SE|SW|NW> are picked by facing, not as random variants
    const base = a.variantOf ?? (/^(bld_.+)_[a-z]$/.exec(a.name)?.[1]);
    if (a.weight != null) weights.set(a.name, +a.weight);
    const edge = (a.autotile?.set === 'forest_edge' || a.autotile?.set === 'sand_edge') && a.autotile.mask !== 15; // edge pieces are picked by mask, not as random variants
    if (base && !edge) variants.set(base, [...(variants.get(base) ?? []), a.name].sort());
    if (a.autotile && !(a.autotile.set === 'shore' && a.autotile.mask === 0)) keyed.set(`${a.autotile.set}_${a.autotile.mask}`, a.name);
  }));
  // legacy {sprites:{key:file}} support
  for (const [key, file] of Object.entries<string>(m.sprites ?? {})) {
    try { art.set(key, { tex: await Assets.load('./assets/' + file), anchor: [0.5, 0.75], scale: defScale }); } catch { /* ignore */ }
  }
}

function resolveName(key: string, seed: number): string | undefined {
  // variants first (e.g. bld_R_1 -> bld_R_1_a/_b/_c, stable per tile via seed), then the base name
  const v = variants.get(key);
  if (v?.length) { let tot = 0; for (const n of v) tot += weights.get(n) ?? 1; // weighted, stable per tile
    let r = ((Math.imul(seed >>> 0, 2654435761) >>> 0) / 4294967296) * tot; for (const n of v) { r -= weights.get(n) ?? 1; if (r < 0) return n; } return v[v.length - 1]; }
  const name = ALIAS[key] ?? keyed.get(key) ?? key;
  if (art.has(name)) return name;
}
const resolve = (key: string, seed: number) => { const n = resolveName(key, seed); return n ? art.get(n) : undefined; };
/** Night-lights overlay for the same variant `place` would pick; additive blend. Nothing if no art exists. */
export function placeNight(key: string, x: number, y: number, layer: Container, seed = 0): Sprite | undefined {
  const n = resolveName(key, seed), night = n && (nights.get(n) ?? nights.get(aliasOf.get(n) ?? ''));
  const a = night ? art.get(night) : undefined; if (!a) return undefined;
  const s = new Sprite(a.tex); s.anchor.set(a.anchor[0], a.anchor[1]); s.scale.set(a.scale); s.position.set(x, y); s.blendMode = 'add'; layer.addChild(s); return s;
}
/** the variant `place` would pick for this tile, turned to face `dir` (NE/SE/SW/NW); unsuffixed art when that facing is missing */
export function facingName(key: string, seed: number, dir: string): string { const n = resolveName(key, seed); if (!n) return key; const f = `${n}_${dir}`; return art.has(f) ? f : n; }
/** raw manifest entry for an asset (undefined if none) */
export const artMeta = (name: string) => meta.get(name);
export const hasArt = (key: string) => !!resolve(key, 0);
export const artTex = (name: string) => art.get(name)?.tex;

export const ZONE_COLORS: Record<string, number> = { R: 0x3ecf4a, C: 0x3b8cff, I: 0xf2c230 };
const GROUND: Record<string, number[]> = { water: [0x2f6fb3, 0x3478bd], sand: [0xd9c58b, 0xe0cd95], grass: [0x5aa346, 0x62ad4d, 0x55993f] };
/** Road / shore bit directions (manifest convention): NE=1, SE=2, SW=4, NW=8 as screen offsets to the edge midpoint */
const EDGE: [number, number][] = [[16, -8], [16, 8], [-16, 8], [-16, -8]];

/** Place sprite `key` on the tile centred at (x,y) into `layer`. PNG art if the manifest has it, else code art. */
export function place(key: string, x: number, y: number, layer: Container, seed = 0): Sprite | Graphics {
  const a = resolve(key, seed);
  if (a) {
    const s = new Sprite(a.tex); s.anchor.set(a.anchor[0], a.anchor[1]); s.scale.set(a.scale); s.position.set(x, y);
    layer.addChild(s); return s;
  }
  const g = new Graphics(); layer.addChild(g);
  const dia = (k = 1) => g.poly([x, y - TH / 2 * k, x + TW / 2 * k, y, x, y + TH / 2 * k, x - TW / 2 * k, y]);
  const h01 = ((seed >>> 0) % 1000) / 1000;
  if (key in GROUND || key.startsWith('shore_')) {
    const c = GROUND[key in GROUND ? key : 'water']; dia().fill(c[(seed >>> 0) % c.length]).stroke({ width: 1, color: 0, alpha: 0.08 });
  } else if (key === 'forest') {
    g.circle(x - 6, y - 4, 6).fill(0x2a5e25).circle(x + 7, y - 1, 5).fill(0x2f6a29);
  } else if (key === 'grid') {
    dia().stroke({ width: 1, color: 0xffffff, alpha: 0.25 });
  } else if (key.startsWith('zone_')) {
    const c = ZONE_COLORS[key.slice(5)]; dia(0.8).fill({ color: c, alpha: 0.5 }).stroke({ width: 1.5, color: c });
  } else if (key.startsWith('road_')) {
    const mask = +key.slice(5);
    dia().fill(0x8a8f86);
    const arms = EDGE.filter((_, b) => mask & (1 << b));
    if (arms.length !== 2 || arms[0][0] !== -arms[1][0] || arms[0][1] !== -arms[1][1]) g.ellipse(x, y, 10, 5).fill(0x3d3f44);
    for (const [dx, dy] of arms) g.moveTo(x, y).lineTo(x + dx * 2, y + dy * 2).stroke({ width: 14, color: 0x3d3f44 });
    for (const [dx, dy] of arms) g.moveTo(x + dx * 0.3, y + dy * 0.3).lineTo(x + dx * 1.9, y + dy * 1.9).stroke({ width: 1.5, color: 0xf5d547 });
  } else if (key.startsWith('power_line_')) {
    const mask = +key.slice(11), H = 16, arms = EDGE.filter((_, b) => mask & (1 << b));
    g.moveTo(x, y + 2).lineTo(x, y - H).stroke({ width: 2, color: 0x6b4a2b }); g.moveTo(x - 4, y - H + 2).lineTo(x + 4, y - H + 2).stroke({ width: 1.5, color: 0x6b4a2b });
    for (const [dx, dy] of arms) g.moveTo(x, y - H + 2).quadraticCurveTo(x + dx, y + dy - H + 6, x + dx * 2, y + dy * 2 - H + 2).stroke({ width: 0.8, color: 0x222222 });
  } else if (key.startsWith('pipe_')) {
    const mask = +key.slice(5), arms = EDGE.filter((_, b) => mask & (1 << b));
    g.circle(x, y, 4).fill(0x3d8fe0);
    for (const [dx, dy] of arms) g.moveTo(x, y).lineTo(x + dx * 2, y + dy * 2).stroke({ width: 6, color: 0x3d8fe0 });
    for (const [dx, dy] of arms) g.moveTo(x, y).lineTo(x + dx * 2, y + dy * 2).stroke({ width: 2, color: 0x9fd0ff });
  } else if (key.startsWith('util_')) {
    const t = key.slice(5);
    if (t === 'wind') { g.moveTo(x, y + 2).lineTo(x, y - 44).stroke({ width: 3, color: 0xf2f2f2 }); for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 3 + 0.3; g.moveTo(x, y - 44).lineTo(x + Math.cos(a) * 16, y - 44 + Math.sin(a) * 16).stroke({ width: 2.5, color: 0xffffff }); } g.circle(x, y - 44, 2.5).fill(0xcccccc); }
    else if (t === 'tower') { for (const d of [-7, 7]) g.moveTo(x + d, y + 3).lineTo(x + d * 0.5, y - 22).stroke({ width: 2, color: 0x777777 }); g.ellipse(x, y - 30, 12, 6).fill(0x5fa8e8); g.rect(x - 12, y - 30, 24, 10).fill(0x4a90d9); g.ellipse(x, y - 20, 12, 6).fill(0x3d7fc4); g.ellipse(x, y - 30, 12, 6).fill(0x8cc4f2); }
    else if (t === 'pump') { box(g, x, y, TW * 0.8, TH * 0.8, 16, 0x8fa8b8, 0x4a6f8a); g.circle(x + 12, y - 20, 6).fill(0x3d8fe0); g.rect(x - 20, y - 24, 6, 10).fill(0x5f7f95); }
    else if (t === 'coal') { box(g, x, y, TW * 1.2, TH * 1.2, 26, 0x8a7f78, 0x4e4844); for (const [cx, h] of [[-14, 40], [4, 48]]) { g.rect(x + cx, y - 26 - h, 8, h).fill(0x6e6560); g.rect(x + cx, y - 26 - h, 8, 4).fill(0xc0392b); } g.ellipse(x + 26, y - 4, 10, 5).fill(0x2a2522); }
  } else if (key === 'civic_lot') {
    dia().fill(0xa7a59c).stroke({ width: 1, color: 0x000000, alpha: 0.1 });
  } else if (key.startsWith('civic_') && !key.endsWith('_night')) {
    const t = key.slice(6), c = CIVIC[t]; if (!c) return g;
    const k = 0.8 * c.size, a = TW / 2 * k, b = TH / 2 * k;
    box(g, x, y, a, b, c.h, c.wall, c.roof);
    const ry = y - c.h; // roof centre
    if (t === 'hospital' || t === 'clinic') { g.rect(x - 7, ry - 2.5, 14, 5).fill(0xffffff); g.rect(x - 2.5, ry - 7, 5, 14).fill(0xffffff); g.rect(x - 5, ry - 1.5, 10, 3).fill(0xd62828); g.rect(x - 1.5, ry - 5, 3, 10).fill(0xd62828); }
    else if (t === 'police') { g.circle(x, ry, 7).fill(0xf2c230); g.circle(x, ry, 4).fill(0x1d3f8f); }
    else if (t === 'fire') { g.poly([x - 6, ry + 4, x, ry - 8, x + 6, ry + 4]).fill(0xffd23f); g.poly([x - 3, ry + 4, x, ry - 3, x + 3, ry + 4]).fill(0xff5a36); }
    else { g.moveTo(x, ry).lineTo(x, ry - 18).stroke({ width: 1.5, color: 0x333333 }); g.rect(x, ry - 18, 9, 6).fill(0x2f7de1); }
    if (t === 'fire') for (let d = 0; d < 2; d++) { const dx = -a * (0.25 + d * 0.4), dy = b * (0.25 + d * 0.4); g.poly([x + dx - 5, y + dy - 2, x + dx + 3, y + dy + 2, x + dx + 3, y + dy - 10, x + dx - 5, y + dy - 14]).fill(0x7a1d12); }
  } else if (key.startsWith('construction_')) {
    const st = +key.slice(-1), tall = key.includes('tall'), k = 0.7, H = (tall ? 60 : 24) * st / 3;
    dia(k).fill(0x8b7355);
    if (st >= 2) box(g, x, y, TW / 2 * k * 0.9, TH / 2 * k * 0.9, H, 0xb0a89a, 0x9a9184);
    for (let f = 0; f <= H; f += 8) g.moveTo(x - TW / 2 * k, y - f).lineTo(x, y + TH / 2 * k - f).lineTo(x + TW / 2 * k, y - f).stroke({ width: 1, color: 0xe0a030 });
    if (st === 3) g.moveTo(x + 10, y + 4).lineTo(x + 10, y - H - 18).lineTo(x - 14, y - H - 18).stroke({ width: 2, color: 0xf2b200 });
  } else if (key.startsWith('bld_')) {
    const [, z, lv] = key.split('_'); const L = +lv;
    const pal: Record<string, number[]> = { R: [0xe8d9b5, 0xd9a07a, 0xc9cfd6], C: [0x9fc3e8, 0x7aa7d9, 0x8fb0c8], I: [0xb9a57a, 0x9a8f80, 0x8c8a86] };
    const roofs: Record<string, number> = { R: 0xb5523b, C: 0x2f5f9e, I: 0x5c5650 };
    const base = pal[z][Math.floor(h01 * 3)], k = [0, 0.55, 0.68, 0.78][L], h = [0, 10, 26, 52][L] * (0.75 + h01 * 0.6);
    box(g, x, y, TW / 2 * k, TH / 2 * k, h, base, L === 1 ? roofs[z] : shade(base, 1.1));
    if (z === 'I') g.rect(x + 6, y - h - 12 - L * 4, 4, 10 + L * 4).fill(0x6b6460);
    if (L >= 2) for (let f = 1; f < h / 8; f++) g.moveTo(x - TW / 2 * k + 2, y - f * 8 + 1).lineTo(x - 2, y + TH / 2 * k - f * 8 - 1).stroke({ width: 1, color: 0x334455, alpha: 0.35 });
  }
  return g;
}
const CIVIC: Record<string, { size: number; h: number; wall: number; roof: number }> = {
  school: { size: 2, h: 22, wall: 0xd9a066, roof: 0x8f4f2f }, highschool: { size: 3, h: 30, wall: 0xc98b5a, roof: 0x7a3f24 },
  police: { size: 2, h: 24, wall: 0x9fb4d6, roof: 0x34507f }, fire: { size: 2, h: 24, wall: 0xd65a46, roof: 0x8f2a1e },
  clinic: { size: 1, h: 16, wall: 0xf0f0ec, roof: 0x9ad3c6 }, hospital: { size: 3, h: 46, wall: 0xf2f2ee, roof: 0x7fc8b8 },
};
const shade = (c: number, f: number) => { const ch = (s: number) => Math.min(255, Math.round(((c >> s) & 255) * f)); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
function box(g: Graphics, x: number, y: number, a: number, b: number, h: number, wall: number, roof: number) {
  g.poly([x - a, y, x, y + b, x, y + b - h, x - a, y - h]).fill(shade(wall, 0.85));
  g.poly([x + a, y, x, y + b, x, y + b - h, x + a, y - h]).fill(shade(wall, 0.65));
  g.poly([x, y - b - h, x + a, y - h, x, y + b - h, x - a, y - h]).fill(roof);
}
