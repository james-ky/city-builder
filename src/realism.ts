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

// =====================================================================================
// TRIPS — who travels where and when (agent-based traffic).
//   - US BLS: employment-population ratio ≈ 60 % of adults → ≈ 0.48 workers per resident (matches 2.1 residents/job).
//   - US Census: ≈ 18 % of residents are school-age (5–17).
//   - NHTS 2017: ≈ 85 % of commutes are by car (≈ 76 % drive alone, 9 % carpool); ~1.1 people per car;
//     school trips ≈ 45 % by private car (rest bus/walk); ≈ 1 shopping/errand trip per person per day,
//     ~85 % by car. Trips under ~400 m (≈ 4 tiles) are mostly walked.
//   - Traffic engineering: a 2-lane local street carries ~8,000–12,000 vehicles/day before it jams;
//     BPR curve travel time = free-flow × (1 + 0.15 (volume/capacity)^4).
//   - Free-flow speeds: dirt ~30 km/h, asphalt ~45 km/h, concrete ~50 km/h on city streets.
// =====================================================================================
export const TRIPS = {
  workersPerResident: 0.48,
  kidsPerResident: 0.18,
  carShare: { work: 0.85, school: 0.45, errand: 0.85, leisure: 0.7, freight: 1 } as Record<string, number>,
  // freight: ≈ 0.1–0.2 truck trips per industrial job per day (FHWA Quick Response Freight Manual: ~0.1 per employee
  // for manufacturing, more for warehousing). Half go to local shops, half leave the map via edge roads.
  truckTripsPerIndJob: 0.15,
  freightToShops: 0.5,
  peoplePerCar: 1.1,
  errandsPerPersonPerDay: 1.0,
  walkTiles: 4,                     // trips this short (≈ 400 m) are walked
  dailyCapacityPerLane: 5000,       // vehicles/day per lane before the BPR curve bites (≈ 10k per 2-lane road)
  speedKmh: { 1: 30, 2: 45, 3: 50 } as Record<number, number>,
  tileMeters: 20,
  schoolSeats: { school: 500, highschool: 1500 } as Record<string, number>,
  // share of each trip type leaving in each hour (0–23); return trips mirror these
  out: { work: { 6: 0.25, 7: 0.45, 8: 0.25, 9: 0.05 }, school: { 7: 0.7, 8: 0.3 }, errand: { 10: 0.12, 11: 0.12, 12: 0.18, 13: 0.12, 14: 0.08, 15: 0.08, 17: 0.1, 18: 0.1, 19: 0.06, 21: 0.03, 22: 0.01 }, leisure: { 9: 0.1, 10: 0.15, 15: 0.15, 16: 0.2, 17: 0.25, 18: 0.15 }, freight: { 5: 0.08, 6: 0.1, 7: 0.1, 8: 0.1, 9: 0.12, 10: 0.12, 11: 0.1, 12: 0.08, 13: 0.08, 14: 0.07, 15: 0.05 } } as Record<string, Record<number, number>>,
  back: { work: { 16: 0.2, 17: 0.45, 18: 0.3, 19: 0.05 }, school: { 15: 0.8, 16: 0.2 }, errand: { 11: 0.1, 12: 0.12, 13: 0.18, 14: 0.12, 15: 0.1, 16: 0.08, 18: 0.1, 19: 0.1, 20: 0.06, 22: 0.03, 23: 0.01 }, leisure: { 11: 0.1, 12: 0.15, 17: 0.15, 18: 0.2, 19: 0.25, 20: 0.15 }, freight: { 7: 0.08, 8: 0.1, 9: 0.1, 10: 0.1, 11: 0.12, 12: 0.12, 13: 0.1, 14: 0.08, 15: 0.08, 16: 0.07, 17: 0.05 } } as Record<string, Record<number, number>>,
};

// =====================================================================================
// TRANSIT — basic local bus.
//   - Walk access: people walk ≈ 400 m (¼ mile) to a bus stop (TCRP Report 165) → 20 tiles at 20 m/tile.
//   - US small/mid-city bus mode share for trips that are served at both ends ≈ 5–15 %; we use 12 % for
//     work/school and 6 % for errands, fading with walk distance.
//   - A depot (garage + maintenance) costs ≈ $1M (scaled $1000); a sheltered stop ≈ $15–30k ($20); a bus in service
//     costs ≈ $500k/yr to operate (~$40/month scaled per bus).
// =====================================================================================
export const TRANSIT = { walkTiles: 20, share: { work: 0.12, school: 0.12, errand: 0.06, leisure: 0.04 } as Record<string, number>, stopCost: 20, stopUpkeep: 2, depotCost: 1000, depotUpkeep: 100, busUpkeep: 40, stopsPerBus: 4, maxBuses: 6 };

// =====================================================================================
// PARKING — one tile ≈ 400 m²; a parking space incl. aisles takes ≈ 30 m² → ≈ 13 spaces per level per tile.
//   - Surface lot: ≈ 13–14 spaces/tile; ≈ $5k per space to build (US).
//   - Structured garage: ≈ $25–30k per above-ground space (WGI/Carl Walker cost reports), O&M ≈ $700/space/yr.
//   - Downtown fees: commuters ≈ $10–15/day, short visits ≈ $2–4; a garage space earns ≈ $2–3k/yr.
//   - Street parking: ≈ 3 cars per 20 m kerb per side → ~6 per 2-lane tile; 4-lane streets have none; avenues ~2.
//   - Shops on low-density (C1) and industry have their own lots; dense commercial (C2/C3), hospitals and
//     high schools need shared parking within a short walk (≈ 4 tiles ≈ 400 m; up to 8 if desperate).
// Game money ≈ 1/1,000 of real dollars (same as roads).
// =====================================================================================
export const PARKING = {
  privateLot: { spaces: 14 },          // grows by itself on a C tile when parking demand is high
  privateGarage: { spaces: 65 },       // 5 levels, grows next to C3
  garage:  { name: 'Parking Garage',       size: 1, spaces: 50,  cost: 1350, upkeep: 3 },   // 4 levels × ~13 = 50 spaces × $27k
  garage2: { name: 'Parking Garage (big)', size: 2, spaces: 260, cost: 7000, upkeep: 15 },  // 5 levels × 4 tiles × 13
  feeCommuterPerDay: 0.012,            // $12/day real
  feeVisit: 0.003,                     // $3 per visit real
  visitTurnover: 3,                    // shoppers per space per day
  shopperStay: 0.25,                   // share of a day a shopper's car sits there (≈ 2 h of the 8 h day)
  streetSpaces: [6, 0, 2],             // per road tile: 2-lane, 4-lane street, avenue half
  walkTiles: 4, maxWalkTiles: 8,
  circleMinutes: 8,                    // extra driving when the driver has to hunt for a space
};

// =====================================================================================
// PARKS — player-placed only (zones never grow them). Game money ≈ 1/1,000 of real dollars.
//   - Real build costs (US, 2020s): pocket park / garden ≈ $80–300k, playground ≈ $250k installed,
//     dog park ≈ $150k, 0.4-acre neighbourhood park ≈ $600k, lit sports field ≈ $1–1.5M,
//     botanical garden section ≈ $1.5M, 1-ha regional park with lake / sports complex ≈ $2.5–6M.
//   - Upkeep ≈ $10–15k per acre per year (NRPA medians) → a 2x2 (0.4 acre) ≈ $6k/yr ≈ $0.5/month here;
//     staffed / irrigated parks (botanical, sports complex) cost several times more. Rounded up to whole $.
//   - Home values rise ≈ 5–15% within ~150–500 m of a park, fading with distance and bigger for larger parks
//     (Crompton 2005): radius and strength below scale with footprint.
//   - Trees and lawns absorb a little local pollution; sports parks and playgrounds draw a few car trips.
// =====================================================================================
export const PARKS: Record<string, { name: string; size: number; cost: number; upkeep: number; leisure?: number }> = {
  pocket: { name: 'Pocket Park', size: 1, cost: 150, upkeep: 1 },
  community_garden: { name: 'Community Garden', size: 1, cost: 80, upkeep: 1 },
  flower_garden: { name: 'Flower Garden', size: 1, cost: 120, upkeep: 2 },
  playground: { name: 'Playground', size: 1, cost: 250, upkeep: 2, leisure: 60 },
  dog: { name: 'Dog Park', size: 1, cost: 150, upkeep: 1 },
  plaza: { name: 'Plaza', size: 1, cost: 300, upkeep: 2 },
  basketball: { name: 'Basketball Court', size: 1, cost: 120, upkeep: 1, leisure: 40 },
  neighborhood: { name: 'Neighborhood Park', size: 2, cost: 600, upkeep: 3 },
  botanical: { name: 'Botanical Garden', size: 2, cost: 1500, upkeep: 12 },
  sports_field: { name: 'Sports Field', size: 2, cost: 1200, upkeep: 8, leisure: 200 },
  tennis: { name: 'Tennis Courts', size: 2, cost: 500, upkeep: 3, leisure: 80 },
  skate: { name: 'Skate Park', size: 2, cost: 700, upkeep: 3, leisure: 100 },
  pond: { name: 'Pond Park', size: 2, cost: 900, upkeep: 5 },
  city_lake: { name: 'City Lake Park', size: 3, cost: 3500, upkeep: 15 },
  sports_complex: { name: 'Sports Complex', size: 3, cost: 6000, upkeep: 35, leisure: 600 },
  memorial: { name: 'Memorial Park', size: 3, cost: 2500, upkeep: 8 },
};
/** boost reach in tiles and strength (0..1) by footprint; pollution soaked up per park tile */
export const PARK_EFFECT = { radius: [0, 4, 7, 10], strength: [0, 0.35, 0.6, 0.85], desirability: 0.3, pollutionPerTile: 0.6, leisurePerPersonPerDay: 0.05, leisureMaxTiles: 30 };
