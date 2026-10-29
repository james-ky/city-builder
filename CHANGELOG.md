# Changelog

## Alignment fix
- The blurry low-detail "overview" map was always drawn under the real tiles. Its chunky pixels showed through as a dark sawtooth along roads and as blocky squares under forests. It now only shows when you're zoomed far out, or if detailed drawing fails.
- The coverage and pollution overlays were painted as stretched, pixelated textures, so they looked like jagged staircases that were offset from the tiles. They're now drawn as crisp tile-shaped diamonds on the same grid as everything else.
- Added tests/align.cjs, which checks that the overlays sit on the tile grid at zoom 0.5, 1 and 2, and that the overview stays hidden.

## Traffic spacing
- Cars now keep about half a tile behind the car ahead in the same lane, and wait at a tile edge if the next stretch is already occupied. In a test drive, overlapping car pairs dropped from 23 to 5 (the rest are cars passing in opposite lanes or crossing at junctions).

## Art v2-polish
- Updated to art set v2-polish (450 assets). Roads now have sidewalks, there are more grass variants (rare ones show up less often), and there are four forest styles.
- Forests now use edge pieces chosen by which neighbouring tiles are also forest. Trees thin out to bushes toward open ground, and a single forest tile becomes a small copse, so forests no longer look like blocks.
