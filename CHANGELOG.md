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

## Balance and feature checks
- Taxes brought in too much money. A small town with almost no services went from $20k to about $100k in 5 game years (roughly 30 minutes of play) and $205k in 8. Tax income per resident or job is now halved, which gives about $46k after 5 years and $86k after 8, with the same steady growth. Logs are in screenshots/balance-*.txt.
- Added tests/features.cjs. It checks:
  - Refused placements: on water, on a road, a pump away from water, and building with no money.
  - Pump and coal plant on a shoreline.
  - Power lines crossing a road.
  - Suburban lots growing and upgrading to square buildings.
  - Lots surviving save and load, and Ctrl+S.
  - Bulldozing lots and services.
  - All pass.
