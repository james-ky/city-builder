# Art assets (art set v1)
`manifest.json` lists every sprite (file, size, anchor, scale, layer, variantOf, autotile).
All art is @2x and drawn at displayScale 0.5 on a 64x32 tile; ground/road/overlay anchor (0.5,0.5), objects (0.5,0.75), placed at the tile centre.
Draw order: ground (terrain + shore) < roads < zone tint < grid overlay (toggle G) < trees & buildings (sorted by i+j).

Game keys the code asks for (missing ones are drawn in code):
- `grass`, `water`, `sand` (variants via `variantOf`), `forest` (object over grass)
- `shore_<mask>` on water tiles: NE=1 SE=2 SW=4 NW=8, corners N=16 E=32 S=64 W=128 (corner only if both adjacent sides are water)
- `road_<mask>`: NE=1 SE=2 SW=4 NW=8; isolated road uses the NE dead-end
- `zone_R|C|I` (zone layer, shown only on empty zoned tiles), `grid` (alias of grid_overlay)
- `bld_<R|C|I>_<1..3>` buildings (1 low, 2 medium, 3 high density). Map art names to these in `ALIAS` in `src/sprites.ts` (v2 ships all nine bld_* names directly; R_3 and C_3 are 128x192 anchored 0.5,0.8333).

## v3: variants and construction
- Variants: `bld_<Z>_<T>_a|b|c` (variantOf `bld_<Z>_<T>`). Each tile picks one stably from its coordinates; if no variants exist the base name is used.
- Construction: `construction_1x1_stage1..3` (128x128) and `construction_1x1_tall_stage1..3` (128x192, anchor 0.5,0.8333) for tall targets (R/C tier 3). Each stage lasts 2 game-days.

## Night lights
Optional per-building overlays: `bld_<Z>_<T>_<v>_night` (or any asset with `"nightOf": "<building asset name>"`), same size/anchor as the building.
Drawn above the night shading with additive blending and faded in with darkness. If a building has no night overlay, it shows no lights.
