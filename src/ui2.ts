// UI redesign MOCKUP (preview only). Re-homes the existing controls into one top bar, one category toolbar with trays,
// one right-side panel, a Views menu, a single ☰ menu and a '?' shortcut sheet. Every action forwards to the original
// (now hidden) control, so game logic is untouched. Add ?ui=old to the URL for the classic layout.
const $ = (s: string) => document.querySelector<HTMLElement>(s);
const click = (s: string) => $(s)?.click();
const svc = (k: string) => () => click(`#services button[data-t="svc:${k}"]`);
const tool = (n: number) => () => click(`#toolbar button:nth-child(${n})`);
type Item = { label: string; tip: string; key?: string; icon?: string; img?: string; run: (ev?: MouseEvent) => void; on?: () => boolean };
const I = (id: string, cls = 'ic') => `<img class="${cls}" src="./assets/ui/icons2/svg/${id}.svg" alt="">`;
const CSS = `
:root{--u-bg:rgba(16,22,30,.94);--u-line:#33404f;--u-acc:#4f8cff;--u-txt:#e8eef6;--u-dim:#93a3b8}
#toolbar,#services,#help,#viewGrp,#stats>.grp{position:fixed!important;left:-9999px!important;top:-9999px!important}
#stats{height:40px;gap:14px;background:var(--u-bg);border-bottom:1px solid var(--u-line)}
#hud{top:auto!important;bottom:12px;left:12px;font-size:12px;padding:4px 10px}
#roadTiers,#zoneBar{bottom:128px!important}
#info,#budget,#fxMenu,#saveMenu,#dataPanel{position:fixed!important;top:52px!important;right:10px!important;left:auto!important;transform:none!important;width:380px!important;max-height:calc(100vh - 150px);overflow:auto;box-sizing:border-box;background:var(--u-bg)!important;border:1px solid var(--u-line);border-radius:12px!important;z-index:15!important}
#dataPanel{bottom:auto!important;height:calc(100vh - 150px)}
#uBar{position:fixed;bottom:12px;left:0;right:0;margin:0 auto;width:max-content;display:flex;gap:4px;padding:6px;background:var(--u-bg);border:1px solid var(--u-line);border-radius:14px;z-index:9}
#uBar button,#uTray button,#uMenu button,#uTop button{background:transparent;color:var(--u-txt);border:1px solid transparent;border-radius:9px;cursor:pointer;font:13px system-ui}
#uBar button{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:68px;padding:6px 6px 4px}
#uBar button i{font-style:normal;font-size:20px;line-height:22px}#uBar button:hover,#uTray button:hover,#uMenu button:hover{background:#243142}
#uBar button.on{background:#20314a;border-color:var(--u-acc)}
#uTray{position:fixed;bottom:84px;left:0;right:0;margin:0 auto;width:max-content;max-width:94vw;display:none;flex-wrap:wrap;gap:4px;padding:8px;background:var(--u-bg);border:1px solid var(--u-line);border-radius:12px;z-index:9;color:var(--u-dim);font:12px system-ui}
#uTray h5{width:100%;margin:0 0 2px 4px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--u-dim)}
#uTray button{padding:6px 10px;background:#1c2633;border-color:#2c3a4b}#uTray button.on{border-color:var(--u-acc);background:#20314a}
#uTop{display:flex;gap:4px;margin-left:8px}#uTop button{padding:4px 9px;background:#1c2633;border-color:#2c3a4b}
#uMenu{position:fixed;top:46px;right:10px;display:none;flex-direction:column;min-width:220px;padding:6px;background:var(--u-bg);border:1px solid var(--u-line);border-radius:12px;z-index:16}
#uMenu button{text-align:left;padding:7px 10px;display:flex;justify-content:space-between;gap:16px}#uMenu kbd,#uTip kbd,#uHelp kbd{font:11px ui-monospace,monospace;color:#cfe0ff;background:#2a3850;border-radius:4px;padding:0 5px}
#uTip{position:fixed;pointer-events:none;display:none;z-index:30;background:#0b1118;color:var(--u-txt);border:1px solid var(--u-line);border-radius:8px;padding:6px 9px;font:12px system-ui;max-width:280px}
#uHelp{position:fixed;inset:0;margin:auto;width:560px;height:max-content;display:none;z-index:40;background:var(--u-bg);color:var(--u-txt);border:1px solid var(--u-line);border-radius:14px;padding:16px 20px;font:13px/1.9 system-ui;columns:2}
#uHelp h4{column-span:all;margin:0 0 6px}#uMenu{grid-template-columns:repeat(4,44px);min-width:0!important}#uMenu button{justify-content:center!important;padding:8px!important}
.ic{width:18px;height:18px;vertical-align:-4px}.ic22{width:22px;height:22px}.ic28{width:28px;height:28px;display:block}
#uTray .sep{width:1px;align-self:stretch;background:var(--u-line);margin:0 4px}#uTray{flex-wrap:nowrap!important;max-width:96vw;overflow-x:auto}
#uBar button{min-width:0;padding:7px 9px}#uTray button{padding:6px}#uTop button{padding:4px 6px}#uTop .ic{width:20px;height:20px}
#roadTiers button,#zoneBar button{display:flex!important;align-items:center;gap:4px}#roadTiers small{display:none}#roadTiers>span{margin:0 2px!important;padding:0!important}
#dataTabs button{padding:5px 7px!important}#speed .ic{width:16px;height:16px}
#uBadge{position:fixed;left:12px;top:48px;z-index:9;font:11px system-ui;color:#ffd27a;background:#3a2a0a;border:1px solid #6b5220;border-radius:6px;padding:2px 8px}`;
export function mountUI2() {
  if (new URLSearchParams(location.search).get('ui') === 'old') return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const covSel = $('#covSel') as HTMLSelectElement;
  const cov = (v: string) => () => { covSel.value = covSel.value === v ? '' : v; covSel.dispatchEvent(new Event('change')); };
  const isOn = (s: string) => () => !!$(s)?.classList.contains('on');
  const toolOn = (t: string) => () => !!$(`#toolbar button[data-t="${t}"], #services button[data-t="${t}"]`)?.classList.contains('on');
  const imgOf = (b: HTMLElement) => b.querySelector('img')?.getAttribute('src')?.replace(/^.*\/svg\/(.+)\.svg$/, '$1');
  const parks: Item[] = Array.from(document.querySelectorAll<HTMLElement>('#parkGroup button')).map(b => ({ label: b.textContent!.trim(), tip: b.title, icon: imgOf(b), run: () => b.click(), on: () => b.classList.contains('on') }));
  const svcItems = (keys: string[]): Item[] => keys.filter(k => $(`#services button[data-t="svc:${k}"]`)).map(k => { const b = $(`#services button[data-t="svc:${k}"]`)!; return { label: b.title.split(':')[0], tip: b.title.split(':').slice(1).join(':').trim(), icon: imgOf(b), run: svc(k), on: toolOn('svc:' + k) }; });
  const utilKeys = Array.from(document.querySelectorAll<HTMLElement>('#services button[data-t^="svc:"]')).map(b => b.dataset.t!.slice(4)).filter(k => /coal|wind|pump|tower/.test(k));
  const dataTab = (t: string) => () => { const p = $('#dataPanel')!; if (p.style.display === 'none') click('#dataBtn'); click(`#dataTabs button[data-tab="${t}"]`); };
  const TABS = ['Demand', 'Transportation', 'Population', 'Education', 'Jobs', 'Utilities'];
  // the Data panel's tab strip: icons only, name in the tooltip
  document.querySelectorAll<HTMLElement>('#dataTabs button[data-tab]').forEach(b => { const t = b.dataset.tab!; b.title = t; b.innerHTML = I('data_' + t.toLowerCase(), 'ic ic22'); });
  // road bar: icons only (prices stay in the tooltip; the hidden <small> keeps the game's live price updates working)
  document.querySelectorAll<HTMLElement>('#roadTiers button[data-tier]').forEach(b => { b.insertAdjacentHTML('afterbegin', I(['', 'road_dirt', 'road_asphalt', 'road_concrete'][+b.dataset.tier!], 'ic ic22')); Array.from(b.childNodes).forEach(n => { if (n.nodeType === 3) n.remove(); }); });
  document.querySelectorAll<HTMLElement>('#roadTiers button[data-w]').forEach(b => { b.innerHTML = I(['road_width_2lane', 'road_width_street', 'road_width_avenue'][+b.dataset.w!], 'ic ic22'); });
  document.querySelectorAll<HTMLElement>('#roadTiers > span').forEach(sp => { sp.textContent = ''; });
  const CATS: { id: string; icon: string; name: string; key?: string; direct?: () => void; on?: () => boolean; groups?: Item[][] | (() => Item[][]) }[] = [
    { id: 'select', icon: 'cat_select', name: 'Select / pan', key: '1', direct: tool(1), on: toolOn('select') },
    { id: 'roads', icon: 'cat_roads', name: 'Roads', groups: [[{ label: 'Road', tip: 'Drag to build. Type and width in the bar above.', key: '2', icon: 'road_asphalt', run: tool(2), on: toolOn('road') }, { label: 'Intersection', tip: 'Click a junction: lights, stop signs, yield', icon: 'road_intersection', run: () => click('#roadTiers button[data-ix]'), on: toolOn('ix') }, { label: 'Traffic circle', tip: 'Click to place a small 1-lane roundabout (3×3). Cars enter at the 4 arms and yield to the circle.', icon: 'road_roundabout', run: () => click('#roadTiers button[data-rab]'), on: () => ($('#roadTiers button[data-rab]') as HTMLElement | null)?.style.background === 'rgb(61, 111, 209)' }, { label: '2-lane roundabout', tip: 'Click to place a 2-lane roundabout (3×3). Right lane: right turns and straight on (outer lane); left lane: left turns and U-turns (inner lane).', icon: 'road_roundabout2', run: () => click('#roadTiers button[data-rab2]'), on: () => ($('#roadTiers button[data-rab2]') as HTMLElement | null)?.style.background === 'rgb(61, 111, 209)' }]] },
    { id: 'zones', icon: 'cat_zones', name: 'Zones', groups: [[{ label: 'Residential', tip: 'R rotates facing', key: '3', icon: 'zone_R_2', run: tool(3), on: toolOn('R') }, { label: 'Commercial', tip: '', key: '4', icon: 'zone_C_2', run: tool(4), on: toolOn('C') }, { label: 'Industrial', tip: '', key: '5', icon: 'zone_I_2', run: tool(5), on: toolOn('I') }]] },
    { id: 'util', icon: 'cat_utilities', name: 'Utilities', groups: [[{ label: 'Power line', tip: '', key: '7', icon: 'tool_power_line', run: tool(7), on: toolOn('pline') }, { label: 'Water pipe', tip: 'Shows the underground view', key: '8', icon: 'tool_pipe', run: tool(8), on: toolOn('pipe') }], svcItems(utilKeys)] },
    { id: 'svc', icon: 'cat_services', name: 'Services', groups: [svcItems(['police', 'fire']), svcItems(['clinic', 'hospital']), svcItems(['school', 'highschool'])] },
    { id: 'transit', icon: 'cat_transit', name: 'Transit', groups: [[...svcItems(['busdepot']), { label: 'Bus stop', tip: 'Click a road to add a stop', icon: 'tool_bus_stop', run: () => click('#roadTiers button[data-stop]'), on: toolOn('stop') }], svcItems(['garage', 'garage2'])] },
    { id: 'parks', icon: 'cat_parks', name: 'Parks', groups: [parks] },
    { id: 'plots', icon: 'cat_plots', name: 'Custom lots', groups: () => (window as any).__plots?.items() ?? [] },
    { id: 'doze', icon: 'cat_bulldoze', name: 'Bulldoze', key: '6', direct: tool(6), on: toolOn('bulldoze') },
    { id: 'views', icon: 'cat_views', name: 'Views', groups: [[{ label: 'Grid', tip: '', key: 'G', icon: 'view_grid', run: () => click('#gridBtn'), on: isOn('#gridBtn') }, { label: 'Zone colours', tip: '', key: 'Z', icon: 'view_zone_colours', run: () => click('#zoneBtn'), on: isOn('#zoneBtn') }, { label: 'Underground', tip: 'Pipes', key: 'U', icon: 'view_underground', run: () => click('#ugBtn'), on: isOn('#ugBtn') }],
      Array.from(covSel.options).filter(o => o.value).map(o => ({ label: o.text, tip: 'Overlay. Click again to turn off.', icon: 'overlay_' + o.value, run: cov(o.value), on: () => covSel.value === o.value }))] },
    { id: 'data', icon: 'cat_data', name: 'City data', key: '⇧D', groups: [[{ label: 'Budget', tip: 'Taxes, funding, loan and history', key: 'B', icon: 'btn_budget', run: () => click('#budgetBtn') }, ...TABS.map(t => ({ label: t, tip: '', icon: 'data_' + t.toLowerCase(), run: dataTab(t) }))]] },
  ];
  const bar = document.createElement('div'); bar.id = 'uBar'; const tray = document.createElement('div'); tray.id = 'uTray';
  const tip = document.createElement('div'); tip.id = 'uTip'; document.body.append(bar, tray, tip);
  for (const el of [bar, tray]) el.addEventListener('pointerdown', e => e.stopPropagation());
  const withTip = (b: HTMLElement, title: string, body: string, key?: string) => { b.removeAttribute('title');
    b.onmouseenter = () => { tip.innerHTML = `<b>${title}</b>${key ? ` <kbd>${key}</kbd>` : ''}${body ? '<br>' + body : ''}`; const r = b.getBoundingClientRect(); tip.style.display = 'block'; tip.style.left = Math.min(innerWidth - 290, r.left) + 'px'; tip.style.top = (r.top < 80 ? r.bottom + 6 : r.top - tip.offsetHeight - 6) + 'px'; };
    b.onmouseleave = () => tip.style.display = 'none'; };
  let open = '';
  const refresh = () => { bar.querySelectorAll<HTMLElement>('button').forEach(b => { const c = CATS.find(x => x.id === b.dataset.c)!; b.classList.toggle('on', open === c.id || !!c.on?.()); });
    tray.querySelectorAll<HTMLElement>('button').forEach((b, k) => b.classList.toggle('on', !!(b as any).__it.on?.())); };
  const openTray = (id: string) => { open = open === id ? '' : id; const c = CATS.find(x => x.id === id)!; tray.innerHTML = ''; tray.style.display = open ? 'flex' : 'none';
    (typeof c.groups === 'function' ? c.groups() : c.groups ?? []).forEach((items, gi) => { if (gi) { const sep = document.createElement('span'); sep.className = 'sep'; tray.appendChild(sep); }
      for (const it of items) { const b = document.createElement('button'); (b as any).__it = it; b.innerHTML = it.img ? `<img class="ic ic28" style="object-fit:contain" src="${it.img}" alt="">` : it.icon ? I(it.icon, 'ic ic28') : it.label; withTip(b, it.label, it.tip, it.key); b.onclick = ev => { it.run(ev); if (c.id === 'plots') { open = ''; openTray(c.id); } setTimeout(refresh, 30); }; tray.appendChild(b); } });
    refresh(); };
  for (const c of CATS) { const b = document.createElement('button'); b.dataset.c = c.id; b.innerHTML = I(c.icon, 'ic ic28');
    withTip(b, c.name, '', c.key); b.onclick = () => { if (c.direct) { open = ''; tray.style.display = 'none'; c.direct(); refresh(); } else openTray(c.id); }; bar.appendChild(b); }
  // top bar: ☰ menu (file, budget, audio, settings, full screen) and ? help
  const top = document.createElement('span'); top.id = 'uTop'; const rci = $('#rci')!; rci.after(top);
  top.innerHTML = `<button id="uHelpBtn">${I('cat_help')}</button><button id="uMenuBtn">${I('cat_menu')}</button>`;
  const menu = document.createElement('div'); menu.id = 'uMenu'; document.body.appendChild(menu); menu.addEventListener('pointerdown', e => e.stopPropagation());
  const M: [string, string, string, () => void][] = [['btn_new_city', 'New city', '', () => click('#newBtn')], ['btn_save', 'Save / load', 'Ctrl+S', () => click('#saveBtn')], ['btn_budget', 'Budget', 'B', () => click('#budgetBtn')], ['cat_data', 'City data', '⇧D', () => click('#dataBtn')],
    ['btn_music', 'Music on/off', '', () => click('#musicBtn')], ['btn_settings', 'Audio, effects & graphics', '', () => click('#fxBtn')], ['btn_fullscreen', 'Full screen', 'F', () => click('#fsBtn')], ['btn_keyboard', 'Keyboard shortcuts', '?', () => toggleHelp()], ['mark_ok', 'First-city checklist', '', () => (window as any).__tut?.setMode('open')]];
  for (const [ic, l, k, f] of M) { const b = document.createElement('button'); b.innerHTML = I(ic, 'ic ic28'); withTip(b, l, '', k); b.onclick = e => { e.stopPropagation(); menu.style.display = 'none'; tip.style.display = 'none'; f(); }; menu.appendChild(b); }
  $('#uMenuBtn')!.onclick = e => { e.stopPropagation(); menu.style.display = menu.style.display === 'grid' ? 'none' : 'grid'; };
  withTip($('#uMenuBtn')!, 'Menu', ''); withTip($('#uHelpBtn')!, 'Keyboard shortcuts', '', '?');
  const help = document.createElement('div'); help.id = 'uHelp'; document.body.appendChild(help);
  help.innerHTML = '<h4>Keyboard shortcuts</h4>' + [['1', 'Select / pan'], ['2', 'Road'], ['3 4 5', 'Residential / Commercial / Industrial'], ['6', 'Bulldoze'], ['7', 'Power line'], ['8', 'Pipe'], ['R', 'Rotate zone facing'], ['Esc', 'Cancel / close panel'], ['Space', 'Pause / resume'], ['WASD / arrows', 'Pan'], ['Q E / wheel', 'Zoom'], ['G', 'Grid'], ['Z', 'Zone colours'], ['U', 'Underground'], ['B', 'Budget'], ['⇧D', 'City data'], ['F', 'Full screen'], ['Ctrl+S', 'Save'], ['?', 'This sheet']].map(([k, v]) => `<div><kbd>${k}</kbd> ${v}</div>`).join('');
  const toggleHelp = () => help.style.display = help.style.display === 'block' ? 'none' : 'block';
  $('#uHelpBtn')!.onclick = e => { e.stopPropagation(); toggleHelp(); };
  addEventListener('keydown', e => { if (e.key === '?' && !(e.target instanceof HTMLInputElement)) toggleHelp(); if (e.key === 'Escape') { help.style.display = 'none'; menu.style.display = 'none'; open = ''; tray.style.display = 'none'; refresh(); } });
  addEventListener('pointerdown', () => { menu.style.display = 'none'; help.style.display = 'none'; });
  addEventListener('keyup', () => setTimeout(refresh, 30));
  // every other control with a title gets the same styled tooltip; a trailing "(X)" becomes the hotkey chip
  document.addEventListener('mouseover', e => { const el = (e.target as HTMLElement).closest?.('[title],[data-tip]') as HTMLElement | null; if (!el || el.onmouseenter) return;
    if (el.title) { el.dataset.tip = el.title; el.removeAttribute('title'); }
    const m = /^(.*?)\s*\(([^()]{1,12})\)\s*$/.exec(el.dataset.tip!), txt = m ? m[1] : el.dataset.tip!, key = m && /^(Shift\+|Ctrl\+)?[A-Z0-9 ]{1,3}$|Space|Esc/.test(m[2]) ? m[2] : '';
    const [head, ...rest] = (key ? txt : el.dataset.tip!).split(/:\s/); tip.innerHTML = `<b>${head}</b>${key ? ` <kbd>${key}</kbd>` : ''}${rest.length ? '<br>' + rest.join(': ') : ''}`;
    const r = el.getBoundingClientRect(); tip.style.display = 'block'; tip.style.left = Math.max(4, Math.min(innerWidth - 290, r.left)) + 'px'; tip.style.top = (r.top < 120 ? r.bottom + 6 : r.top - tip.offsetHeight - 6) + 'px'; });
  document.addEventListener('mouseout', e => { const el = (e.target as HTMLElement).closest?.('[data-tip]') as HTMLElement | null; if (el && !el.onmouseenter) tip.style.display = 'none'; });
  (window as any).__ui2 = { openTray, cats: CATS.map(c => c.id) };
}
