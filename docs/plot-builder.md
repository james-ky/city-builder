# Plot Builder: design doc (draft, nothing merged)

## 1. What it is
Right now each lot is one hand-drawn picture. The plot builder would put a lot together from many small **parts**: house walls, roofs, porches, garages, fences, hedges, trees, driveways, pools, parked cars (the same sprites as traffic), signs, bins and lamp posts. It follows **templates** (rules per zone, tier and lot size) and draws the result into one image that the game then treats like a normal sprite. That means thousands of parts can go into a city while the game still draws about one image per lot.

## 2. Data format
### 2.1 Part manifest (`public/assets/parts/parts.json`, from City Art Studio)
```jsonc
{
  "id": "roof_gable_red_2x1",
  "file": "parts/roofs/roof_gable_red_2x1@2x.png",
  "night": "parts/roofs/roof_gable_red_2x1_night@2x.png", // optional light overlay
  "anchor": [64, 118],        // pixel that sits on the part's ground point
  "footprint": [1.0, 0.5],    // size in tiles along i,j (0.05-tile grid, about 1 m)
  "height": 0.4,              // tiles, used for stacking and sorting
  "facing": "SE",             // NE/SE/SW/NW, mirrored variants are allowed
  "tags": ["roof","gable","r1","r2","warm"],
  "sockets": {"top": [64,40]},// snap points for stacking (chimney, AC unit)
  "weight": 1.0               // how often it gets picked
}
```
Vehicles are not copied. The manifest **references** `vehicles/veh_*` with `"scale": "traffic"`, so a parked car is always the exact size and art of a road car (James's rule).

### 2.2 Plot templates (`src/plots/templates/*.json`)
```jsonc
{
  "id": "r1_suburban_1x2",
  "zone": "R", "tier": 1, "lot": [1,2], "frontage": "SE",
  "slots": [
    {"name":"house",    "area":[[0.15,0.2],[0.85,0.9]], "pick":{"tags":["house_body","r1"]}},
    {"name":"roof",     "attachTo":"house", "pick":{"tags":["roof","r1"]}},
    {"name":"driveway", "edge":"frontage", "offset":0.75, "pick":{"tags":["driveway"]}},
    {"name":"car",      "on":"driveway", "chance":0.7, "count":[1,2], "pick":{"tags":["vehicle","car"]}},
    {"name":"fence",    "edge":["back","sides"], "chance":0.6, "pick":{"tags":["fence"]}},
    {"name":"trees",    "scatter":"free", "count":[1,5], "minGap":0.15, "pick":{"tags":["tree"]}},
    {"name":"props",    "scatter":"free", "count":[0,3], "pick":{"tags":["yard_prop"]}}
  ]
}
```
A template is a recipe. The seed decides which parts fill each slot.

## 3. Composition rules (in order)
1. **Ground first:** a lawn, gravel or paving base for the whole lot, picked by zone.
2. **Frontage:** the side that faces the road (found from neighbouring road tiles). Driveways, walkways and mailboxes go on that edge, and the whole template rotates to match.
3. **Main structure:** pick a body module, then stack roof, chimney and AC on its sockets. A stack has to fit the template's area and height limits (tier 1 up to 2 floors and so on).
4. **Attached items:** cars on driveways or parking bays, fences along edges with the corner pieces auto-picked (the same 4-bit mask idea as roads).
5. **Scatter:** trees and props go in the free space using a seeded scatter with minimum gaps. Nothing may overlap any footprint, and nothing goes within 0.1 tile of the road edge.
6. **Realism checks:** setbacks (house at least about 6 m from the road), at least one car spot per household on R1, parking count tied to jobs on C/I.
7. **Construction stages:** the same plot is drawn with parts filtered by stage (foundation → frame → walls → roof → yard), so building animations come free.

## 4. Baking and caching (PC performance)
- **When:** a lot is baked when it finishes a construction stage or is upgraded, and when it first comes on screen after a load.
- **How:** build a Pixi `Container` with the part sprites in sorted order, then `renderer.generateTexture()` into a `RenderTexture` sized to the lot's bounding box at 2x. Throw the container away and keep only the texture.
- **Atlas:** baked lots are packed into shared 2048×2048 atlas pages (shelf packer), so the map's chunk containers keep batching well. A new page is made when one fills, and least-recently-seen lots are evicted when there are more than about 6 pages (~100 MB of GPU memory).
- **Cache key:** `templateId + seed + stage + rotation + artRevision`. Same key, same texture. Common combinations get reused, and the key changes automatically when City Art Studio bumps `artRevision`.
- **Budget:** bake at most about 4 ms per frame from a queue (nearest to camera first). Until a lot is baked it shows its old single sprite or a construction placeholder, so nothing pops in empty.
- **Saves:** store only the template id and seed, never the image. Lots rebake on load.
- **Expected cost:** about 20–80 parts per lot, roughly 0.5 ms each on a desktop GPU. A 256-map city with about 15k lots spreads its baking over the first few seconds after a load.

## 5. Depth sorting
- **Inside a lot:** sort parts by the front-most point of their footprint (i+j of the footprint's far-front corner), then by height, so stacked items like a roof on a body go in socket order. That is the same rule as the map, just at sub-tile precision.
- **Between lots:** the baked lot is one sprite that goes into the existing i+j sort by its front-most tile, exactly like today's 1×2 and 1×3 lots. Anything that has to cross lot boundaries (tall trees overhanging the road) is kept as a separate live sprite, not baked.

## 6. Night overlays
Each part can have a `_night` overlay. The lot is baked twice: a **day texture** and a **night light texture** built from the same sorted list. Parts with no night file are drawn in solid black at that slot, so lights from a part behind are hidden by parts in front. That fixes the "glowing through" problem by construction. At runtime the night texture goes right after its day texture in the depth sort (same as PR #10). The light texture can be half-res to save memory.

## 7. Variety and seeding
- Seed = hash(mapSeed, i, j, buildCount). It is stable across save/load, and a rebuild after demolition gives a new look.
- Weighted picks per tag plus **palette groups** (roof colour, siding colour) so houses on a street vary but stay consistent with each other.
- Neighbourhood rules such as "no identical seed+template within 3 lots" and a district style tag (older brick vs newer siding) set by land value or age.
- With 10 bodies × 8 roofs × 6 palettes × fence/tree/car options there are thousands of distinct R1 lots from about 100 parts.

## 8. Editor (hand-tune plots)
A separate page in the same app (`/editor.html`, dev build only at first):
- Left: part browser with tag filters and thumbnails. Center: iso canvas with the lot grid, footprints shown as outlines. Right: slot list and properties.
- Drag parts in, snap to the 0.05-tile grid and sockets, rotate with R, mirror with M, and flag overlaps in red.
- "Reroll" button with seed shown. Hold Shift to lock a slot while rerolling the others.
- Save as a **template** (rules) or a **fixed plot** (exact placements, for landmarks and civic buildings).
- Toggles for day/night, construction stage and all four rotations.
- Exports JSON into `src/plots/templates/`, so a change is a reviewable PR.

## 9. Godot comparison
| | Stay on PixiJS (bake at runtime) | Switch to Godot 4 |
|---|---|---|
| Plot builder | Fully doable as described. Pixi's RenderTexture is the same baking technique engines use. | Built-in scene editor and `SubViewport` baking. The editor UI comes partly for free. |
| Editor tooling | We build it (about 1–2 milestones) | Godot editor + custom plugin. Better out of the box. |
| Web / GitHub Pages link | Works today, instant, small download | Web export works but is a 30–40 MB+ download, slower start, threading/WebGL quirks, weaker on iPad Safari |
| iPad later | Same web build | Needs separate iOS export, a Mac and Xcode signing, or the weaker web build |
| Performance | Fine for 2D iso with batching and baking. JS sim may need a Web Worker at XL maps | Faster for heavy sim (GDScript/C#), native builds |
| Rewrite cost | None | Everything: renderer, chunks/culling, autotiling, sim (R/C/I, services, budget, power/water), traffic, saves (compatible .city import), UI, audio, tests and CI. Roughly 6–10 of our milestone-sized chunks before we're back to today, with no new features in the meantime. Old saves need a converter. |
| Art | Reused as is | Reused as is (PNG + manifest) |

## 10. Recommendation
**Stay on PixiJS and build the plot builder in it.** What James wants (hundreds or thousands of parts in one plot) is a content-pipeline problem, not an engine problem, and baking to textures is what an engine would do under the hood anyway. Switching would burn weeks to get back where we are and would hurt the playable-link and iPad plans. Reconsider Godot only if the sim gets CPU-bound at XL maps even after moving it to a Web Worker, or if we want native 3D. Either way the part manifest and templates are engine-neutral JSON, so this work carries over.

## 11. Milestones
1. **P1: Parts and data (art + code):** City Art Studio splits the existing R1 house and lot art into about 40 parts (bodies, roofs, fences, trees, driveways, props) with `parts.json`. Cars reference the traffic sprites. Add a schema check test.
2. **P2: Composer + bake:** template engine, seeded picks, sub-tile depth sort, RenderTexture bake, cache key, bake queue. R1 1×1 and 1×2 lots only, behind a setting toggle. Screenshot compare against the old lots.
3. **P3: Night + construction stages:** dual bake with occlusion, stage filtering. Night glow-through test.
4. **P4: Atlas + perf:** atlas packing, eviction, a 256 and 384 map stress test (bake time, GPU memory, FPS).
5. **P5: Editor v1:** part browser, drag/snap, reroll, save templates.
6. **P6: Roll-out:** R2/R3, C and I templates (parking lots tied to jobs, loading docks with delivery trucks), civic fixed plots. Retire the single-image lots.
7. **P7: Polish:** street-level palette coherence, district styles, cross-lot trees as live sprites.

## Proof of concept
`tools/plot-poc.py` (Python/Pillow, offline, not part of the game) bakes a 2×2 lot from existing assets: random grass tiles, one of three R1 houses, a parked traffic sedan at about 0.66 scale, and seeded tree clumps, depth-sorted by i+j. Output: `screenshots/plot-poc.png` (three seeds + a night pass). It's crude because the current art is whole buildings rather than parts, which is what P1 fixes.
