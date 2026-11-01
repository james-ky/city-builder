// First-city checklist: a small, hideable list of the first steps of a working town. Each step ticks itself off from
// the live game state (nothing to click). Collapse it to a small pill; hide it for good from the menu (☰).
// localStorage 'tutorial': 'off' = hidden, 'min' = collapsed, anything else = open.
export type Progress = { road: boolean; R: boolean; CI: boolean; plant: boolean; poweredR: boolean; water: boolean; wateredR: boolean; pop: number; budget: boolean; saved: boolean };
const I = (id: string, cls = 'ic') => `<img class="${cls}" src="./assets/ui/icons2/svg/${id}.svg" alt="">`;
export const POP_GOAL = 50;
const STEPS: { k: string; icon: string; text: string; how: string; done: (p: Progress) => boolean }[] = [
  { k: 'road', icon: 'road_asphalt', text: 'Build a road', how: 'Roads tool, then drag', done: p => p.road },
  { k: 'R', icon: 'zone_R_2', text: 'Zone homes', how: 'Zones › Residential, drag along the road', done: p => p.R },
  { k: 'CI', icon: 'zone_C_2', text: 'Zone shops and industry', how: 'Commercial and Industrial give people jobs', done: p => p.CI },
  { k: 'plant', icon: 'svc_coal', text: 'Build a power plant', how: 'Utilities › Coal plant or Wind turbine', done: p => p.plant },
  { k: 'poweredR', icon: 'tool_power_line', text: 'Get power to homes', how: 'Run power lines from the plant to your zones; it ticks when a home has power', done: p => p.poweredR },
  { k: 'water', icon: 'svc_pump', text: 'Build a water pump', how: 'Next to a lake or river (or a water tower)', done: p => p.water },
  { k: 'wateredR', icon: 'tool_pipe', text: 'Get water to homes', how: 'Lay pipes within 3 tiles of your homes (Utilities › Water pipe)', done: p => p.wateredR },
  { k: 'pop', icon: 'stat_population', text: `Grow to ${POP_GOAL} residents`, how: 'Let time run; watch the demand bars', done: p => p.pop >= POP_GOAL },
  { k: 'budget', icon: 'btn_budget', text: 'Check your budget', how: 'Press B (or ☰ › Budget)', done: p => p.budget },
  { k: 'saved', icon: 'btn_save', text: 'Save your city', how: 'Ctrl+S (or ☰ › Save / load)', done: p => p.saved },
];
const CSS = `#uTut{position:fixed;left:12px;top:52px;z-index:8;width:250px;background:rgba(16,22,30,.94);color:#e8eef6;border:1px solid #33404f;border-radius:12px;font:12px system-ui;box-sizing:border-box}
#uTut .hd{display:flex;align-items:center;gap:6px;padding:7px 8px 7px 10px;cursor:pointer;user-select:none}#uTut .hd b{flex:1;font-size:12px}#uTut .hd span{color:#93a3b8}
#uTut .hd button{background:transparent;border:0;padding:2px;cursor:pointer;opacity:.7}#uTut .hd button:hover{opacity:1}
#uTut .bar{height:3px;margin:0 10px 6px;background:#243142;border-radius:2px}#uTut .bar i{display:block;height:100%;background:#4f8cff;border-radius:2px;transition:width .4s}
#uTut ol{list-style:none;margin:0;padding:0 8px 8px}#uTut li{display:flex;gap:8px;align-items:flex-start;padding:4px 4px;border-radius:7px}
#uTut li .ic{width:18px;height:18px;flex:none;margin-top:1px}#uTut li small{display:block;color:#93a3b8;font-size:11px}
#uTut li.ok{opacity:.5}#uTut li.ok .t{text-decoration:line-through}#uTut li.next{background:#20314a}
#uTut.min{width:auto}#uTut.min ol,#uTut.min .bar,#uTut.min .fin,#uTut.min .hd b{display:none}#uTut .fin{padding:0 12px 10px;color:#7dff9a}`;
export function mountTutorial(get: () => Progress) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'uTut'; document.body.appendChild(el);
  el.addEventListener('pointerdown', e => e.stopPropagation());
  const ticked = new Set<string>(); // once a step is done it stays done (e.g. bulldozing the first road later doesn't un-tick it)
  let mode = localStorage.getItem('tutorial') ?? 'open', sig = '';
  const setMode = (m: string) => { mode = m; localStorage.setItem('tutorial', m); sig = ''; render(); };
  const render = () => {
    const p = get(); for (const s of STEPS) if (s.done(p)) ticked.add(s.k);
    const n = ticked.size, next = STEPS.find(s => !ticked.has(s.k)), key = `${mode}|${[...ticked].join()}`;
    el.style.display = mode === 'off' ? 'none' : 'block'; if (key === sig) return; sig = key;
    el.classList.toggle('min', mode === 'min');
    el.innerHTML = `<div class="hd" data-tip="${mode === 'min' ? 'Show the checklist' : 'Collapse'}">${I('mark_ok')}<b>First city</b><span>${n}/${STEPS.length}</span><button class="x" data-tip="Hide checklist: reopen from the menu (☰)">${I('btn_close', 'ic')}</button></div>`
      + `<div class="bar"><i style="width:${(100 * n / STEPS.length).toFixed(0)}%"></i></div>`
      + (next ? '' : '<div class="fin">All done. Your town is up and running!</div>')
      + `<ol>${STEPS.map(s => `<li class="${ticked.has(s.k) ? 'ok' : s === next ? 'next' : ''}" data-k="${s.k}">${I(ticked.has(s.k) ? 'mark_ok' : s.icon)}<div><span class="t">${s.text}</span>${s === next ? `<small>${s.how}</small>` : ''}</div></li>`).join('')}</ol>`;
    (el.querySelector('.hd') as HTMLElement).onclick = () => setMode(mode === 'min' ? 'open' : 'min');
    (el.querySelector('.x') as HTMLElement).onclick = e => { e.stopPropagation(); setMode('off'); };
  };
  render(); setInterval(render, 500);
  (window as any).__tut = { state: () => ({ mode, done: [...ticked], total: STEPS.length }), render, setMode };
}
