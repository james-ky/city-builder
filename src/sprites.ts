import { Assets, Graphics, Sprite, Texture, Container } from 'pixi.js';
export const TW = 64, TH = 32;

type Art = { tex: Texture; anchor: [number, number]; scale: number };
const art = new Map<string, Art>();          // asset name -> texture
const keyed = new Map<string, string>();     // lookup key (road_3, shore_16) -> asset name
const variants = new Map<string, string[]>(); // grass -> [grass_a, grass_b, ...]
/** Game keys that map onto differently-named art. Add entries here as new art arrives. */
const ALIAS: Record<string, string> = { bld_R_1: 'house_lowdensity_1x1', grid: 'grid_overlay' };

/** Loads assets/manifest.json (art set format: version/assets[]/autotile). Missing art falls back to code drawing. */
export async function loadManifest() {
  let m: any;
  try { m = await (await fetch('./assets/manifest.json')).json(); } catch { return; }
  const defScale = m.displayScale ?? 1;
  await Promise.all((m.assets ?? []).map(async (a: any) => {
    try {
      const tex: Texture = await Assets.load('./assets/' + a.file);
      // Pixi already treats '@2x' files as resolution 2; size the sprite to manifest size * scale regardless
      const want = (a.size?.[0] ?? tex.source.pixelWidth) * (a.scale ?? defScale);
      art.set(a.name, { tex, anchor: a.anchor ?? [0.5, 0.5], scale: want / tex.width });
    } catch { console.warn('missing art', a.file); return; }
    if (a.variantOf) variants.set(a.variantOf, [...(variants.get(a.variantOf) ?? []), a.name].sort());
    if (a.autotile && !(a.autotile.set === 'shore' && a.autotile.mask === 0)) keyed.set(`${a.autotile.set}_${a.autotile.mask}`, a.name);
  }));
  // legacy {sprites:{key:file}} support
  for (const [key, file] of Object.entries<string>(m.sprites ?? {})) {
    try { art.set(key, { tex: await Assets.load('./assets/' + file), anchor: [0.5, 0.75], scale: defScale }); } catch { /* ignore */ }
  }
}

function resolve(key: string, seed: number): Art | undefined {
  const name = ALIAS[key] ?? keyed.get(key) ?? key;
  if (art.has(name)) return art.get(name);
  const v = variants.get(key);
  if (v?.length) return art.get(v[(seed >>> 0) % v.length]);
}
export const hasArt = (key: string) => !!resolve(key, 0);

export const ZONE_COLORS: Record<string, number> = { R: 0x3ecf4a, C: 0x3b8cff, I: 0xf2c230 };
const GROUND: Record<string, number[]> = { water: [0x2f6fb3, 0x3478bd], sand: [0xd9c58b, 0xe0cd95], grass: [0x5aa346, 0x62ad4d, 0x55993f] };
/** Road / shore bit directions (manifest convention): NE=1, SE=2, SW=4, NW=8 as screen offsets to the edge midpoint */
const EDGE: [number, number][] = [[16, -8], [16, 8], [-16, 8], [-16, -8]];

/** Place sprite `key` on the tile centred at (x,y) into `layer`. PNG art if the manifest has it, else code art. */
export function place(key: string, x: number, y: number, layer: Container, seed = 0) {
  const a = resolve(key, seed);
  if (a) {
    const s = new Sprite(a.tex); s.anchor.set(a.anchor[0], a.anchor[1]); s.scale.set(a.scale); s.position.set(x, y);
    layer.addChild(s); return;
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
  } else if (key.startsWith('bld_')) {
    const [, z, lv] = key.split('_'); const L = +lv;
    const pal: Record<string, number[]> = { R: [0xe8d9b5, 0xd9a07a, 0xc9cfd6], C: [0x9fc3e8, 0x7aa7d9, 0x8fb0c8], I: [0xb9a57a, 0x9a8f80, 0x8c8a86] };
    const roofs: Record<string, number> = { R: 0xb5523b, C: 0x2f5f9e, I: 0x5c5650 };
    const base = pal[z][Math.floor(h01 * 3)], k = [0, 0.55, 0.68, 0.78][L], h = [0, 10, 26, 52][L] * (0.75 + h01 * 0.6);
    box(g, x, y, TW / 2 * k, TH / 2 * k, h, base, L === 1 ? roofs[z] : shade(base, 1.1));
    if (z === 'I') g.rect(x + 6, y - h - 12 - L * 4, 4, 10 + L * 4).fill(0x6b6460);
    if (L >= 2) for (let f = 1; f < h / 8; f++) g.moveTo(x - TW / 2 * k + 2, y - f * 8 + 1).lineTo(x - 2, y + TH / 2 * k - f * 8 - 1).stroke({ width: 1, color: 0x334455, alpha: 0.35 });
  }
}
const shade = (c: number, f: number) => { const ch = (s: number) => Math.min(255, Math.round(((c >> s) & 255) * f)); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
function box(g: Graphics, x: number, y: number, a: number, b: number, h: number, wall: number, roof: number) {
  g.poly([x - a, y, x, y + b, x, y + b - h, x - a, y - h]).fill(shade(wall, 0.85));
  g.poly([x + a, y, x, y + b, x, y + b - h, x + a, y - h]).fill(shade(wall, 0.65));
  g.poly([x, y - b - h, x + a, y - h, x, y + b - h, x - a, y - h]).fill(roof);
}
