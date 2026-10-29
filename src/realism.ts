// =====================================================================================
// REALISM CONFIG — every per-building number the simulation uses lives here.
// Goal: start from real-world figures, then tune for fun later (change numbers here only).
//
// Scale assumption: one map tile ≈ 20 m × 20 m ≈ 400 m² ≈ 4,300 sq ft (about 0.1 acre).
// Building floor area per tile (density levels 1/2/3):
//   Residential: 1 house · 4 apartments (3-storey walk-up) · ~60 apartments (15-storey tower)
//   Commercial:  ~3,000 sq ft shop · ~12,000 sq ft (4 floors) offices · ~70,000 sq ft (20 floors) tower
//   Industrial:  ~3,000 sq ft workshop/warehouse · ~8,000 sq ft factory · ~12,000 sq ft heavy plant
// Index 0 of each array = empty lot.
//
// Sources / rules of thumb (rounded):
//   - US Census: ~2.5 people per household (smaller in apartments, ~1.8 in towers).
//   - US EIA: avg home uses ~10,500 kWh/yr ≈ 30 kWh/day ≈ 1.25 kW average; apartments ~0.8–0.9 kW.
//   - EIA CBECS: commercial buildings ~14–20 kWh per sq ft per year; warehouses ~7; manufacturing far higher.
//   - US EPA WaterSense: ~300 gal/day per household (apartments ~150–200);
//     offices/retail ~0.1 gal per sq ft per day; light/heavy industry ~0.05–1 gal/sq ft/day.
//   - Employment density (ITE / planning guides): office ~1 job / 250 sq ft, retail ~1 / 500 sq ft,
//     industrial/warehouse ~1 / 500–1,000 sq ft.
//   - US BLS: ~160 M jobs for ~335 M people → ~2.1 residents per job; ~80 % of jobs are services/commerce.
//   - Plants: small municipal coal units are 25–100 MW; a modern onshore wind turbine is ~3 MW nameplate
//     at ~35 % capacity factor ≈ 1 MW average; small surface-water treatment plants ≈ 1–5 million gal/day;
//     a municipal well ≈ 350–700 gal/min ≈ 0.5–1 million gal/day.
// Units used in the sim: power in kW (average demand), water in gallons per day.
// =====================================================================================

/** Residents per tile at density 1/2/3 (households × people per household). */
export const RESIDENTS = { R: [0, 2.5, 4 * 2.2, 60 * 1.8] };   // 2.5 · 8.8 · 108

/** Jobs per tile at density 1/2/3 (floor area ÷ sq ft per job). */
export const JOBS: Record<'C' | 'I', number[]> = {
  C: [0, 3000 / 500, 12000 / 250, 70000 / 250],                  // 6 · 48 · 280 (retail → offices)
  I: [0, 3000 / 1000, 8000 / 700, 12000 / 500],                  // 3 · ~11 · 24
};

/** Average electricity demand per tile, kW. */
export const POWER_KW: Record<'R' | 'C' | 'I', number[]> = {
  R: [0, 1.25, 4 * 0.9, 60 * 0.8 * 1.2],                         // 1.25 · 3.6 · ~58 (towers add 20 % for lifts/common areas)
  C: [0, 3000 * 15 / 8760, 12000 * 15 / 8760, 70000 * 20 / 8760],// ~5 · ~21 · ~160
  I: [0, 3000 * 7 / 8760, 8000 * 50 / 8760, 12000 * 95 / 8760],  // ~2.4 · ~46 · ~130
};

/** Water demand per tile, gallons/day. */
export const WATER_GPD: Record<'R' | 'C' | 'I', number[]> = {
  R: [0, 300, 4 * 175, 60 * 150],                                // 300 · 700 · 9,000
  C: [0, 3000 * 0.1, 12000 * 0.1, 70000 * 0.1],                  // 300 · 1,200 · 7,000
  I: [0, 3000 * 0.05, 8000 * 0.5, 12000 * 1.0],                  // 150 · 4,000 · 12,000
};

/** Civic buildings: what they draw (consumers) or produce (plants). */
export const CIVIC: Record<string, { kw?: number; gpd?: number; outKw?: number; outGpd?: number }> = {
  school:     { kw: 70,   gpd: 3000 },    // ~500 pupils, ~60k sq ft
  highschool: { kw: 200,  gpd: 10000 },   // ~1,500 pupils
  police:     { kw: 30,   gpd: 500 },
  fire:       { kw: 15,   gpd: 1000 },
  clinic:     { kw: 20,   gpd: 500 },
  hospital:   { kw: 1000, gpd: 50000 },   // ~300 beds × ~150 gal/bed/day; ~30 kWh/sq ft/yr
  coal:       { outKw: 50000 },           // 50 MW small municipal coal plant
  wind:       { outKw: 1000 },            // 3 MW turbine × 35 % capacity factor
  pump:       { outGpd: 2_000_000 },      // 2 million gal/day surface-water intake + treatment
  tower:      { outGpd: 500_000 },        // groundwater well + elevated storage tank
};

/** Labour market (drives zone demand). */
export const ECON = {
  residentsPerJob: 2.1,          // people the city attracts per job offered
  commercialJobsPerResident: 0.38, // shops, offices, services that local residents support
  industrialJobsPerResident: 0.07, // local manufacturing/warehousing
};

export const fmtPower = (kw: number) => kw >= 1000 ? (kw / 1000).toFixed(kw >= 100000 ? 0 : 1) + ' MW' : Math.round(kw) + ' kW';
export const fmtWater = (g: number) => g >= 1e6 ? (g / 1e6).toFixed(2) + ' Mgal/d' : g >= 1000 ? (g / 1000).toFixed(g >= 100000 ? 0 : 1) + 'k gal/d' : Math.round(g) + ' gal/d';

// =====================================================================================
// ROADS — per-tile (≈20 m of road) build cost, monthly upkeep, and construction time.
// Real-world rules of thumb (US, 2-lane local road, per lane-mile ≈ 80 tiles of 2-lane road per mile):
//   - Graded dirt/gravel road: ~$50k–150k per mile to build, but needs re-grading/dust control
//     several times a year (~$2–5k/mile/yr) — cheap to build, relatively costly to keep up.
//   - Asphalt 2-lane: ~$1.5–3 M per mile new; mill & overlay every ~12–15 yrs (~$8–15k/mile/yr).
//   - Jointed concrete: ~1.5–2× asphalt up front, lasts 30–40 yrs with little upkeep (~$2–4k/mile/yr).
// Game scale: the game economy is ~1/1,000–1/2,000 of real dollars, so a real $30k asphalt tile ≈ $25.
// Upkeep is per tile per month. Speed/capacity are multipliers on traffic (1 = asphalt).
// Construction days: marked → graded → gravel base → surface (dirt stops after grading).
// =====================================================================================
export type RoadTier = 1 | 2 | 3; // 1 dirt · 2 asphalt · 3 concrete
export const ROAD_TIERS: Record<RoadTier, { name: string; build: number; upkeep: number; speed: number; capacity: number; days: number[] }> = {
  1: { name: 'Dirt',     build: 6,   upkeep: 0.6,  speed: 0.6, capacity: 0.4, days: [2, 4] },        // survey 2 d, grade 4 d
  2: { name: 'Asphalt',  build: 25,  upkeep: 1.0,  speed: 1.0, capacity: 1.0, days: [2, 4, 3, 4] },  // + gravel base 3 d, paving 4 d
  3: { name: 'Concrete', build: 70,  upkeep: 0.25, speed: 1.1, capacity: 1.2, days: [2, 4, 3, 10] }, // concrete pour + curing ≈ 10 d
};
/** Upgrading in place costs the price difference; works start at the gravel stage, old road stays open meanwhile. */
export const roadUpgradeCost = (from: RoadTier, to: RoadTier) => Math.max(0, ROAD_TIERS[to].build - ROAD_TIERS[from].build);

// =====================================================================================
// ROAD WIDTHS — one tile ≈ 20 m ≈ 65 ft of right-of-way.
//   2-lane road: 2 × 12 ft lanes + parking + sidewalks (~60 ft ROW, typical US local street).
//   Street (1 tile, 4 lanes): 4 × 10 ft lanes (urban minimum per AASHTO/NACTO) = 40 ft + 2 × 6 ft
//     sidewalks ≈ 52–60 ft — fits in one 65 ft tile with no median or parking.
//   Avenue (2 tiles ≈ 130 ft): 4 × 11 ft through lanes + 16 ft median that becomes left-turn
//     lanes at junctions + bike/parking + wide sidewalks (a typical US arterial/boulevard).
// Build cost is a multiplier on the tier's per-tile price (avenue figures are per tile; it is 2 tiles wide).
// Real-world: 4-lane urban arterial ≈ $5–10 M/mile vs ≈ $2–3 M for 2 lanes → ~1.8× per tile for a street;
// avenue ≈ $10–15 M/mile spread across 2 tiles ≈ 1.6× per tile. Capacity ≈ lanes per direction.
// Widths 1–2 need a paved tier (asphalt or concrete).
// =====================================================================================
export const ROAD_WIDTHS = [
  { name: '2-lane road', lanes: 2, buildMul: 1,   upkeepMul: 1,   capacity: 1,   laneFt: 12, tiles: 1 },
  { name: 'Street',      lanes: 4, buildMul: 1.8, upkeepMul: 1.6, capacity: 2,   laneFt: 10, tiles: 1 },
  { name: 'Avenue',      lanes: 4, buildMul: 1.6, upkeepMul: 1.5, capacity: 2.5, laneFt: 11, tiles: 2 },
];
export const roadBuild = (t: RoadTier, w: number) => Math.round(ROAD_TIERS[t].build * ROAD_WIDTHS[w].buildMul);
export const roadUpkeep = (t: RoadTier, w: number) => ROAD_TIERS[t].upkeep * ROAD_WIDTHS[w].upkeepMul;
