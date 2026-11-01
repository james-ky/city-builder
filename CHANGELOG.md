# Changelog

## Sound effects
- Building now makes small sounds: a gravelly thud for roads, a soft two-note chime for zoning, a knock and chime when a building, park, plot or traffic circle goes down, a quick tick for power lines, pipes and bus stops, a crunch for the bulldozer, and a low "nope" buzz when you can't afford something or a spot isn't allowed.
- All sounds are made live by the game's own code (no sound files, nothing borrowed from other games). They're short and quiet so they sit under the music.
- Turn them off or change their volume in Menu (☰) > Audio, effects & graphics, next to the ambience switch. The setting is remembered on this computer, and Reset puts it back to on.
- New test: tests/sfx.cjs.

## First-city checklist
- New players get a small "First city" checklist in the top-left: build a road, zone homes, zone shops and industry, build a power plant, get power to homes, build a water pump, get water to homes, grow to 50 residents, check the budget, and save.
- Each step ticks itself off from what's actually in the city (nothing to click), and the next step shows a one-line hint. A bar shows progress, and it says "All done" at 10/10.
- Click its header to shrink it to a small pill; the X hides it for good (remembered on this computer). Reopen it from the menu (☰).
- New test: tests/tutorial.cjs.

## Vehicle count matches the people
- A 50-person city could show 60+ vehicles. Cars take several game hours to drive across town, but new trips were spawned every hour regardless, so the same person's morning drive, evening drive and errands were on the road at once (one 5-person home had 11 cars out).
- Now each trip flow can only have as many cars out as its people really drive, and a home can't have more cars out than adult residents. Same ~50-person city: peak 62 → 37.
- City Data > Transportation splits live vehicles into Residents, Commuters from outside (none yet: residents fill every job) and Freight / service.
- New tests/vehicle-count.cjs.

## Test reliability
- tests/vehicles.cjs could check the wrong car when a background car finished its trip mid-test (the list shifted). It now follows the exact cars it spawned.
- tests/ui-info.cjs checked that F left full screen after only 0.3 s; leaving full screen is asynchronous, so it now waits up to 4 s.
- New tests/run-all.sh runs the whole suite (4 at a time) against the live game or a local build and lists any failures.

## HUD fixes
- The hover info and the zoning preview showed raw code like `<img class="ic" ...>` instead of the little "no road access" icon, and the "city is in debt" message did the same. They now show the icon.
- While dragging a road, zone, pipe, power line or bulldozer, the cost (and the "no road access on the front" warning for zones) was overwritten every frame by the tile under the mouse, so you never saw it. It now stays up while you drag.
- Player text (like a city name in "Saved …") is still shown as plain text.
- New test: tests/hud-text.cjs.

## Realism pass
- All per-building residents, jobs, power (kW) and water (gal/day) figures and plant outputs now come from src/realism.ts, based on real-world averages (sources in the file).
- Top bar shows power in kW/MW and water in gal/day.
- New City Art Studio parked-car art on police, fire station, hospital and suburban lots.
- tests/sim-years.cjs: headless multi-year balance run.

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

## Beaches
- Added the new sand art (511 assets). Water next to a beach now uses sandy shoreline pieces, so the green strip between the water and the sand is gone. Sand tiles pick edge pieces based on their neighbours and fade softly into grass, so beaches are no longer hard-edged blocks.

## Traffic signals
- Vehicles are drawn at 72% of their old size so a sedan fits inside one lane. Lane offsets are unchanged.
- Junction controls:
  - At T-junctions the side road gets a stop sign.
  - Quiet 4-way crossings are all-way stops.
  - Busy 4-ways, where both roads run at least 6 tiles and there is enough nearby activity, get traffic lights on a 15-second green/yellow/red cycle. The lights glow at night.
- Signs and lights use the new prop art and sort with their junction tile.
- How cars behave at junctions:
  - Cars stop at a stop line, wait about a second at stop signs and stop on red.
  - Before entering a junction a car reserves it. Another car can only share it if it makes the same move, or goes straight through from the opposite side.
  - Cars also keep their spacing across tile edges. Together these removed the remaining clipping (0 overlapping pairs in the test drive).
- The beach PR (#27) accidentally deleted public/assets/README.md when the art folder was re-copied. It's restored here with a new Traffic props section.
