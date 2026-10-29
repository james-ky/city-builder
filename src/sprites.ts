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
export function drawSprite(key: string, x: number, y: number, g: Graphics, layer: Container) {
  const tex = textures.get(key);
  if (tex) {
    const s = new Sprite(tex); s.anchor.set(0.5, 1); s.position.set(x, y + TH / 2); layer.addChild(s); return;
  }
  if (key.startsWith('zone_')) {
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
