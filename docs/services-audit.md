# City services audit (Nov 2026)

## What was broken or missing
1. **Crime was a density blur.** It was the sum of building levels in a 5×5 window × a fixed constant. Unemployment, education and land value had no effect, and the number had no units. The info panel only said low/medium/high.
2. **Police had no staff or capacity.** A station removed up to 85 % of crime instantly, whether it had 1 resident or 50,000 to cover. The change was instant, so there was no "watch it improve" moment. It only showed when a tile crossed the coarse low/medium threshold, which is why it seemed like nothing changed.
3. **No staff anywhere.** Police, fire, hospitals, clinics and schools had no officers, firefighters, doctors, nurses or teachers. Upkeep was a flat number unrelated to workload or workforce.
4. **Hospitals had no patients.** Health coverage only added flats to homes. There were no beds, no caseload, and nothing based on age mix or education.
5. **Schools showed no students or teachers** in the building panel. Seats existed only inside the trip sim.
6. **Fire risk ignored staffing.** No calls, fires or trucks. A fire station always worked at full strength.
7. **Garbage and sewage aren't simulated at all.** Still true; tonnage is now reported (see below).
8. **The service panel** showed only radius and "residents covered".

## What changed
- `src/services.ts` holds every rate, with sources: FBI UCR, NFPA, AHA/CDC, NCES, EPA.
- Each home or job tile is served by the strongest nearby building of each service. The building's caseload sets the **staff it needs**:
  - Police: 2.4 officers per 1k residents, at least 6 and at most 60.
  - Fire: 1.1 firefighters per 1k, at least 12 and at most 36, across 3 shifts with 4 per truck.
  - Hospital: about 1 nurse and 0.3 doctors per inpatient, plus doctors for visits (20 visits a day each).
  - Schools: 16 students per teacher.
- Staff are public jobs filled from the resident workforce. If the city lacks workers, every service is understaffed by the same share. Funding scales staff.
- **Per-building sliders:**
  - **Radius** (50–150 %): a wider area cuts service quality by the stretch (slower response) and raises building upkeep with the area (more vehicles and fuel).
  - **Staff** (0 = auto, up to the building's max): more staff means more upkeep; too few means understaffed and lower quality.
  - Both are saved per building. The save version is now 15; older saves load as auto staff with a normal radius.
- **Upkeep** = 40 % building (× radius²) + wages for the staff actually on duty.
- **Crime** is now incidents per 1,000 people per month, set per tile:
  - Base: US 1.9.
  - Density: ×0.6 / 1.0 / 1.4.
  - Unemployment: ×(1 + 2u).
  - Education: low attainment raises crime.
  - Land value: parks raise it, pollution lowers it.
  - Police: × (1 − 50 % × coverage × staffing quality).
  - Job tiles get 1.2 per 1k workers.
  - Crime moves toward its target over about 20 days.
  - Each station shows incidents, arrests (20 % clearance), and inmates in 20 holding cells (2.5-day stay), with any overflow sent to county.
- **Fire:** fires per month (0.34 per 1k, ×2 for industry) are cut by staffed coverage. Stations show calls (9 per 1k per month), fires and trucks crewed.
- **Health:** inpatients per 1k are age-weighted (kids 0.5, adults 1, seniors 4) × an education factor (low-education areas use about 30 % more). Beds and visits are capped, and patients beyond the cap show as waiting or turned away.
- **Schools:** K–8 takes 69 % of school-age kids (18 % of residents), and high school takes the rest. Enrollment is capped by seats and teachers.
- **City Data has a new Services tab** with all of the above, plus garbage generated (4.9 lb per person per day; collection isn't simulated yet).
- **Crime overlay:** green → yellow → red per 1,000, spread to the 3×3 block so streets show it.

## Tests
`tests/services.cjs` checks:
- Crime is in a realistic range.
- Crime does not vanish on the day a station opens, and drops at least 12 % over 3 months near it (it was about 30 % in testing).
- Stations show arrests and inmates.
- A wider radius lowers quality and raises upkeep.
- Cutting staff makes the building understaffed and lowers wages; staff are capped at the building max.
- Sliders show in the info panel and save in v15.
- Hospital doctors, nurses and patients show, and patients per 1k fall when schools raise education.
- School students and teacher ratio are correct.
- Fire station numbers show.
- Public staff are counted against the workforce.

## Still not simulated / next
- Garbage collection (needs dump and truck art), sewage.
- Fire spreading or destroying buildings.
- Ambulance or police cars driving to calls.
- Colleges.
