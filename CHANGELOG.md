# Changelog

## Alignment fix
- The blurry low-detail "overview" map was always drawn under the real tiles. Its chunky pixels showed through as a dark sawtooth along roads and as blocky squares under forests. It now only shows when you're zoomed far out, or if detailed drawing fails.
- The coverage and pollution overlays were painted as stretched, pixelated textures, so they looked like jagged staircases that were offset from the tiles. They're now drawn as crisp tile-shaped diamonds on the same grid as everything else.
- Added tests/align.cjs, which checks that the overlays sit on the tile grid at zoom 0.5, 1 and 2, and that the overview stays hidden.
