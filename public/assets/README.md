# Art assets (art set v1)
`manifest.json` lists every sprite (file, size, anchor, scale, layer, variantOf, autotile).
All art is @2x and drawn at displayScale 0.5 on a 64x32 tile; ground/road/overlay anchor (0.5,0.5), objects (0.5,0.75), placed at the tile centre.
Draw order: ground (terrain + shore) < roads < zone tint < grid overlay (toggle G) < trees & buildings (sorted by i+j).

Game keys the code asks for (missing ones are drawn in code):
- `grass`, `water`, `sand` (variants via `variantOf`), `forest` (object over grass)
- `shore_<mask>` on water tiles: NE=1 SE=2 SW=4 NW=8, corners N=16 E=32 S=64 W=128 (corner only if both adjacent sides are water)
- `road_<mask>`: NE=1 SE=2 SW=4 NW=8; isolated road uses the NE dead-end
- `zone_R|C|I`, `grid`
- `bld_<R|C|I>_<1..3>` buildings (1 low, 2 medium, 3 high density). Map art names to these in `ALIAS` in `src/sprites.ts` (currently `bld_R_1` -> `house_lowdensity_1x1`).
