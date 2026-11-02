// =====================================================================================
// CITY SERVICES — staff, caseloads and outcomes for police, fire, health and schools.
// Sources (US, rounded):
//   - Police: ≈ 2.4 sworn officers per 1,000 residents (FBI UCR 2019). Reported crime ≈ 2,300 incidents per
//     100,000 people per year (property + violent, FBI 2019) ≈ 1.9 per 1,000 per month. Clearance (arrest) rate ≈ 20 %.
//     A precinct's holding cells keep arrestees ≈ 2–3 days before release or transfer to county jail.
//     Studies of extra policing find crime elasticities around −0.3 to −0.5; we cap the police effect at −50 %.
//     Crime rises with unemployment, low education, density and low land value (standard criminology correlates).
//   - Fire: ≈ 1.1 career firefighters per 1,000 residents (NFPA). Departments answer ≈ 9 calls per 1,000 people
//     per month (≈ 64 % medical); ≈ 0.34 structure/other fires per 1,000 per month (NFPA 1.35 M fires/yr).
//     A station runs 3 shifts; ≈ 4 firefighters crew one engine.
//   - Health: ≈ 104 hospital admissions per 1,000 per year × 4.6-day stay ≈ 1.3 inpatients per 1,000 at any time;
//     seniors use ≈ 3–4× the adult rate, children ≈ ½. Doctor visits ≈ 3.2 per person per year ≈ 8.8 per 1,000 per day.
//     Lower education → more hospital use (health-literacy gradient, ≈ +30–40 % for low-attainment areas).
//     Staffing ≈ 1 nurse per 5 patients per shift (≈ 1 nurse FTE per inpatient over 24/7) + ≈ 0.3 doctors per inpatient;
//     a clinic doctor sees ≈ 20 patients a day.
//   - Schools: school-age (5–17) ≈ 18 % of residents; K–8 is 9 of 13 grades (≈ 69 %), 9–12 the other 31 %.
//     ≈ 16 students per teacher (NCES).
// =====================================================================================
export const SVC = {
  police: { officersPer1k: 2.4, crimePer1kMonth: 1.9, jobCrimePer1kMonth: 1.2, clearance: 0.2, holdDays: 2.5, maxEffect: 0.5,
    station: { minOfficers: 6, maxOfficers: 60, cells: 20 } },
  fire: { ffPer1k: 1.1, callsPer1kMonth: 9, firesPer1kMonth: 0.34, maxEffect: 0.6, station: { minFF: 12, maxFF: 36, trucks: 2 }, crewPerTruck: 4 },
  health: { inpatientPer1k: { child: 0.5, adult: 1.0, senior: 4.0 }, visitsPer1kDay: 8.8, nursesPerInpatient: 1.0, doctorsPerInpatient: 0.3, visitsPerDoctor: 20,
    hospital: { beds: 150, visits: 400 }, clinic: { beds: 0, visits: 60 } },
  school: { kidsPerResident: 0.18, elemShare: 0.69, studentsPerTeacher: 16 },
  /** share of each service's monthly upkeep that is building costs; the rest is wages for the staff on duty */
  facilityShare: 0.4,
};
/** local education profile (none, HS, some college, bachelor's+) from school coverage: no schools → low attainment */
export const localEdu = (eduCov: number, none: number[], us: number[]) => none.map((v, k) => v + (us[k] - v) * Math.min(1, eduCov));
/** how much more (or less) an area uses hospitals than the US average, from its education mix */
export const healthEduFactor = (e: number[]) => Math.max(0.6, 1 + 1.6 * (e[0] - 0.10) - 0.5 * (e[3] - 0.35));
/** inpatients per 1,000 residents for an age mix (shares) and education mix */
export const inpatientRate = (age: { child: number; adult: number; senior: number }, e: number[]) => { const r = SVC.health.inpatientPer1k;
  return (age.child * r.child + age.adult * r.adult + age.senior * r.senior) * healthEduFactor(e); };
/** crime multiplier from education: low attainment raises crime */
export const crimeEduFactor = (e: number[]) => Math.max(0.6, 1 + 2 * (e[0] - 0.10) - 0.6 * (e[3] - 0.35));
/** monthly reported incidents per 1,000 residents at a home tile */
export const crimeRate = (o: { level: number; unemp: number; edu: number[]; landValue: number; police: number }) => {
  const dens = [0.6, 0.6, 1.0, 1.4, 1.5, 1.6][o.level] ?? 1.6; // more people per block, more targets and strangers
  return SVC.police.crimePer1kMonth * dens * (1 + 2 * o.unemp) * crimeEduFactor(o.edu) * (1.25 - 0.5 * Math.max(0, Math.min(1, o.landValue))) * (1 - SVC.police.maxEffect * Math.max(0, Math.min(1, o.police)));
};
export type SvcStat = { type: string; served: number; staffNeed: number; staff: number; strength: number; // strength = staff on duty / staff needed (0..1)
  a: number; b: number; c: number; d: number; cap: number }; // per-type numbers (see main.ts serviceHtml)
