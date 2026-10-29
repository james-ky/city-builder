# Art assets
Drop PNGs here and list them in `manifest.json` under `sprites`.
Keys: `grass`, `water`, `sand`, `forest`, `zone_R`, `zone_C`, `zone_I`,
`road_<mask>` where mask is 0-15 (bit 1 = +i neighbor, 2 = -i, 4 = +j, 8 = -j).
Tile footprint: 64x32 px diamond; image anchored at the tile's bottom corner.
Anything not listed is drawn in code.
