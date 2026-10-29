import { Assets, Graphics, Sprite, Texture, Container } from 'pixi.js';
export const TW = 64, TH = 32;
const textures = new Map<string, Texture>();

/** Loads assets/manifest.json; any listed PNG overrides the code-drawn placeholder. */
export async function loadManifest() {
  try {
    const m = await (await fetch('./assets/manifest.json')).json();
    for (const [key, file] of Object.entries<string>(m.sprites ?? {})) {
      try { textures.set(key, await Assets.load('./assets/' + file)); } catch { console.warn('missing sprite', file); }
    }
  } catch { /* no manifest: all placeholders */ }
}

export const ZONE_COLORS: Record<string, number> = { R: 0x3ecf4a, C: 0x3b8cff, I: 0xf2c230 };

/** Draw sprite `key` centered on tile at (x,y). Uses PNG if available, else code art into g. */
export function drawSprite(key: string, x: number, y: number, g: Graphics, layer: Container, seed = 0) {
  const tex = textures.get(key);
  if (tex) {
    const s = new Sprite(tex); s.anchor.set(0.5, 1); s.position.set(x, y + TH / 2); layer.addChild(s); return;
  }
  if (key.startsWith('bld_')) {
    const [, z, lv] = key.split('_'); const L = +lv; const h01 = ((seed >>> 0) % 1000) / 1000;
    const pal: Record<string, number[]> = { R: [0xe8d9b5, 0xd9a07a, 0xc9cfd6], C: [0x9fc3e8, 0x7aa7d9, 0x8fb0c8], I: [0xb9a57a, 0x9a8f80, 0x8c8a86] };
    const roofs: Record<string, number> = { R: 0xb5523b, C: 0x2f5f9e, I: 0x5c5650 };
    const base = pal[z][Math.floor(h01 * 3)];
    const k = [0, 0.55, 0.68, 0.78][L];
    const h = [0, 10, 26, 52][L] * (0.75 + h01 * 0.6);
    box(g, x, y, TW / 2 * k, TH / 2 * k, h, base, L === 1 && z === 'R' ? roofs.R : L === 1 ? roofs[z] : shade(base, 1.1));
    if (z === 'I' && L >= 1) { const cx = x + 6, cy = y - h - 2; g.rect(cx, cy - 10 - L * 4, 4, 10 + L * 4).fill(0x6b6460); }
    if (L >= 2) for (let f = 1; f < h / 8; f++) g.moveTo(x - TW / 2 * k + 2, y - f * 8 + 1).lineTo(x - 2, y + TH / 2 * k - f * 8 - 1).stroke({ width: 1, color: 0x334455, alpha: 0.35 });
  } else if (key.startsWith('zone_')) {
    const c = ZONE_COLORS[key.slice(5)];
    const k = 0.8;
    g.poly([x, y - TH / 2 * k, x + TW / 2 * k, y, x, y + TH / 2 * k, x - TW / 2 * k, y]).fill({ color: c, alpha: 0.5 }).stroke({ width: 1.5, color: c });
  } else if (key.startsWith('road_')) {
    const mask = +key.slice(5);
    // tile base in asphalt-shoulder
    g.poly([x, y - TH / 2, x + TW / 2, y, x, y + TH / 2, x - TW / 2, y]).fill(0x8a8f86);
    const dirs: [number, number][] = [[16, 8], [-16, -8], [-16, 8], [16, -8]];
    const arms = dirs.filter((_, b) => mask & (1 << b));
    const w = 14;
    if (arms.length === 0) g.ellipse(x, y, 14, 7).fill(0x3d3f44);
    for (const [dx, dy] of arms) g.moveTo(x, y).lineTo(x + dx * 2, y + dy * 2).stroke({ width: w, color: 0x3d3f44, cap: 'butt' });
    if (arms.length !== 2 || (arms[0][0] !== -arms[1][0])) g.ellipse(x, y, 10, 5).fill(0x3d3f44);
    for (const [dx, dy] of arms) g.moveTo(x + dx * 0.3, y + dy * 0.3).lineTo(x + dx * 1.9, y + dy * 1.9).stroke({ width: 1.5, color: 0xf5d547 });
  }
}

const shade = (c: number, f: number) => { const ch = (s: number) => Math.min(255, Math.round(((c >> s) & 255) * f)); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
/** isometric box: half-width a, half-height b, height h */
function box(g: Graphics, x: number, y: number, a: number, b: number, h: number, wall: number, roof: number) {
  g.poly([x - a, y, x, y + b, x, y + b - h, x - a, y - h]).fill(shade(wall, 0.85));
  g.poly([x + a, y, x, y + b, x, y + b - h, x + a, y - h]).fill(shade(wall, 0.65));
  g.poly([x, y - b - h, x + a, y - h, x, y + b - h, x - a, y - h]).fill(roof);
}
