// Milestones: achievements that unlock end-game buildings and utilities. Pure data + checks; main.ts owns the state (saved in sim.ach).
export type MState = { pop: number; surplusStreak: number; reliableStreak: number };
export type Milestone = { id: string; name: string; icon: string; need: string; unlocks: string; goal: number; prog: (s: MState) => number };
export const MILESTONES: Milestone[] = [
  { id: 'pop500',   name: 'Town',           icon: 'ms_pop1', need: '500 residents',              unlocks: 'Wind farm',                          goal: 500,    prog: s => s.pop },
  { id: 'pop1k',    name: 'Small city',     icon: 'ms_pop2', need: '1,000 residents',            unlocks: 'Solar farm',                         goal: 1000,   prog: s => s.pop },
  { id: 'black6',   name: 'In the black',   icon: 'ms_budget', need: '6 months in a row with a budget surplus', unlocks: 'Water treatment plant', goal: 6, prog: s => s.surplusStreak },
  { id: 'pop5k',    name: 'City',           icon: 'ms_pop3', need: '5,000 residents',            unlocks: 'High-rise towers (level 4) and combined-cycle gas plant', goal: 5000, prog: s => s.pop },
  { id: 'grid12',   name: 'Reliable grid',  icon: 'ms_grid', need: '12 months with no power or water shortage (1,000+ residents)', unlocks: 'Desalination plant', goal: 12, prog: s => s.reliableStreak },
  { id: 'pop20k',   name: 'Big city',       icon: 'ms_pop4', need: '20,000 residents',           unlocks: 'Supertall 2×2 towers (level 5)',     goal: 20000,  prog: s => s.pop },
  { id: 'black24',  name: 'AAA rating',     icon: 'ms_budget2', need: '24 months in a row with a budget surplus', unlocks: 'Nuclear plant (with Metropolis)', goal: 24, prog: s => s.surplusStreak },
  { id: 'pop50k',   name: 'Metropolis',     icon: 'ms_pop5', need: '50,000 residents',           unlocks: 'Nuclear plant (with AAA rating)',    goal: 50000,  prog: s => s.pop },
];
/** what unlocks each gated thing: every listed milestone must be earned */
export const GATES: Record<string, string[]> = {
  windfarm: ['pop500'], solar: ['pop1k'], treatment: ['black6'], gas: ['pop5k'], desal: ['grid12'], nuclear: ['pop50k', 'black24'],
  level4: ['pop5k'], level5: ['pop20k'],
};
export const gateText = (k: string) => (GATES[k] ?? []).map(id => MILESTONES.find(m => m.id === id)!.need).join(' and ');
/** ids newly earned for this state */
export const newlyEarned = (have: Set<string>, s: MState) => MILESTONES.filter(m => !have.has(m.id) && m.prog(s) >= m.goal).map(m => m.id);
