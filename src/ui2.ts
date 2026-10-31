// UI redesign MOCKUP (preview only). Re-homes the existing controls into one top bar, one category toolbar with trays,
// one right-side panel, a Views menu, a single ☰ menu and a '?' shortcut sheet. Every action forwards to the original
// (now hidden) control, so game logic is untouched. Add ?ui=old to the URL to see the current layout.
const $ = (s: string) => document.querySelector<HTMLElement>(s);
const click = (s: string) => $(s)?.click();
const svc = (k: string) => () => click(`#services button[data-t="svc:${k}"]`);
const tool = (n: number) => () => click(`#toolbar button:nth-child(${n})`);
type Item = { label: string; tip: string; key?: string; run: () => void; on?: () => boolean };
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
#uHelp h4{column-span:all;margin:0 0 6px}#uBadge{position:fixed;left:12px;top:48px;z-index:9;font:11px system-ui;color:#ffd27a;background:#3a2a0a;border:1px solid #6b5220;border-radius:6px;padding:2px 8px}`;
export function mountUI2() {
  if (new URLSearchParams(location.search).get('ui') === 'old') return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const covSel = $('#covSel') as HTMLSelectElement;
  const cov = (v: string) => () => { covSel.value = covSel.value === v ? '' : v; covSel.dispatchEvent(new Event('change')); };
  const isOn = (s: string) => () => !!$(s)?.classList.contains('on');
  const toolOn = (t: string) => () => !!$(`#toolbar button[data-t="${t}"], #services button[data-t="${t}"]`)?.classList.contains('on');
  const parks = Array.from(document.querySelectorAll<HTMLElement>('#parkGroup button')).map(b => ({ label: b.textContent!.replace('🌳 ', ''), tip: b.title, run: () => b.click(), on: () => b.classList.contains('on') }));
  const svcItems = (keys: string[]) => keys.filter(k => $(`#services button[data-t="svc:${k}"]`)).map(k => { const b = $(`#services button[data-t="svc:${k}"]`)!; return { label: b.textContent!.trim(), tip: b.title, run: svc(k), on: toolOn('svc:' + k) }; });
  const utilKeys = Array.from(document.querySelectorAll<HTMLElement>('#services button[data-t^="svc:"]')).map(b => b.dataset.t!.slice(4)).filter(k => /coal|wind|pump|tower/.test(k));
  const dataTab = (t: string) => () => { const p = $('#dataPanel')!; if (p.style.display === 'none') click('#dataBtn'); click(`#dataTabs button[data-tab="${t}"]`); };
  const CATS: { id: string; icon: string; name: string; key?: string; direct?: () => void; on?: () => boolean; groups?: [string, Item[]][] }[] = [
    { id: 'select', icon: '🖐', name: 'Select', key: '1', direct: tool(1), on: toolOn('select') },
    { id: 'roads', icon: '🛣', name: 'Roads', key: '2', groups: [['Build', [{ label: 'Road', tip: 'Drag to build. Pick type and width in the bar above.', key: '2', run: tool(2), on: toolOn('road') }, { label: '🚦 Intersection', tip: 'Click a junction to set lights, stop signs or yield.', run: () => click('#roadTiers button[data-ix]'), on: toolOn('ix') }]]] },
    { id: 'zones', icon: '🏘', name: 'Zones', groups: [['Zone', [{ label: '🟩 Residential', tip: 'Paint homes. R rotates facing.', key: '3', run: tool(3), on: toolOn('R') }, { label: '🟦 Commercial', tip: 'Paint shops and offices.', key: '4', run: tool(4), on: toolOn('C') }, { label: '🟨 Industrial', tip: 'Paint factories.', key: '5', run: tool(5), on: toolOn('I') }]]] },
    { id: 'util', icon: '⚡', name: 'Utilities', groups: [['Networks', [{ label: 'Power line', tip: 'Carries power between plants and zones.', key: '7', run: tool(7), on: toolOn('pline') }, { label: 'Water pipe', tip: 'Underground; switches to the underground view.', key: '8', run: tool(8), on: toolOn('pipe') }]], ['Plants', svcItems(utilKeys)]] },
    { id: 'svc', icon: '🏛', name: 'Services', groups: [['Safety', svcItems(['police', 'fire'])], ['Health', svcItems(['clinic', 'hospital'])], ['Education', svcItems(['school', 'highschool'])]] },
    { id: 'transit', icon: '🚌', name: 'Transit', groups: [['Buses', [...svcItems(['busdepot']), { label: '🚏 Bus stop', tip: 'Click a road to add a stop; buses loop through stops in order.', run: () => click('#roadTiers button[data-stop]'), on: toolOn('stop') }]], ['Parking', svcItems(['garage', 'garage2'])]] },
    { id: 'parks', icon: '🌳', name: 'Parks', groups: [['Parks', parks]] },
    { id: 'doze', icon: '🧨', name: 'Bulldoze', key: '6', direct: tool(6), on: toolOn('bulldoze') },
    { id: 'views', icon: '👁', name: 'Views', groups: [['Map', [{ label: '▦ Grid', tip: 'Tile grid', key: 'G', run: () => click('#gridBtn'), on: isOn('#gridBtn') }, { label: '◧ Zone colours', tip: 'Tint zoned land', key: 'Z', run: () => click('#zoneBtn'), on: isOn('#zoneBtn') }, { label: '⛏ Underground', tip: 'Pipes view', key: 'U', run: () => click('#ugBtn'), on: isOn('#ugBtn') }]],
      ['Overlays', Array.from(covSel.options).filter(o => o.value).map(o => ({ label: o.text, tip: 'Colour the map by ' + o.text.toLowerCase() + '. Click again to turn off.', run: cov(o.value), on: () => covSel.value === o.value }))]] },
    { id: 'data', icon: '📊', name: 'Data', key: '⇧D', groups: [['City data (opens on the right)', ['Budget', 'Demand', 'Transportation', 'Population', 'Education', 'Jobs', 'Utilities'].map(t => ({ label: t, tip: 'Open the ' + t + ' page in the side panel', run: dataTab(t) }))]] },
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
    for (const [g, items] of c.groups ?? []) { const h = document.createElement('h5'); h.textContent = g; tray.appendChild(h);
      for (const it of items) { const b = document.createElement('button'); (b as any).__it = it; b.textContent = it.label; withTip(b, it.label, it.tip, it.key); b.onclick = () => { it.run(); setTimeout(refresh, 30); }; tray.appendChild(b); } }
    refresh(); };
  for (const c of CATS) { const b = document.createElement('button'); b.dataset.c = c.id; b.innerHTML = `<i>${c.icon}</i>${c.name}`;
    withTip(b, c.name, c.direct ? '' : 'Opens a tray of tools', c.key); b.onclick = () => { if (c.direct) { open = ''; tray.style.display = 'none'; c.direct(); refresh(); } else openTray(c.id); }; bar.appendChild(b); }
  // top bar: ☰ menu (file, budget, audio, settings, full screen) and ? help
  const top = document.createElement('span'); top.id = 'uTop'; const rci = $('#rci')!; rci.after(top);
  top.innerHTML = '<button id="uHelpBtn">?</button><button id="uMenuBtn">☰ Menu</button>';
  const menu = document.createElement('div'); menu.id = 'uMenu'; document.body.appendChild(menu); menu.addEventListener('pointerdown', e => e.stopPropagation());
  const M: [string, string, () => void][] = [['🆕 New city', '', () => click('#newBtn')], ['💾 Save / Load', 'Ctrl+S', () => click('#saveBtn')], ['$ Budget', 'B', () => click('#budgetBtn')], ['📊 City data', '⇧D', () => click('#dataBtn')],
    ['♪ Music on/off', '', () => click('#musicBtn')], ['⚙ Audio, effects & graphics', '', () => click('#fxBtn')], ['⛶ Full screen', 'F', () => click('#fsBtn')], ['⌨ Keyboard shortcuts', '?', () => toggleHelp()]];
  for (const [l, k, f] of M) { const b = document.createElement('button'); b.innerHTML = `<span>${l}</span>${k ? `<kbd>${k}</kbd>` : ''}`; b.onclick = e => { e.stopPropagation(); menu.style.display = 'none'; f(); }; menu.appendChild(b); }
  $('#uMenuBtn')!.onclick = e => { e.stopPropagation(); menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex'; };
  withTip($('#uMenuBtn')!, 'Menu', 'New, save/load, budget, audio, settings, full screen'); withTip($('#uHelpBtn')!, 'Keyboard shortcuts', '', '?');
  const help = document.createElement('div'); help.id = 'uHelp'; document.body.appendChild(help);
  help.innerHTML = '<h4>Keyboard shortcuts</h4>' + [['1', 'Select / pan'], ['2', 'Road'], ['3 4 5', 'Residential / Commercial / Industrial'], ['6', 'Bulldoze'], ['7', 'Power line'], ['8', 'Pipe'], ['R', 'Rotate zone facing'], ['Esc', 'Cancel / close panel'], ['Space', 'Pause / resume'], ['WASD / arrows', 'Pan'], ['Q E / wheel', 'Zoom'], ['G', 'Grid'], ['Z', 'Zone colours'], ['U', 'Underground'], ['B', 'Budget'], ['⇧D', 'City data'], ['F', 'Full screen'], ['Ctrl+S', 'Save'], ['?', 'This sheet']].map(([k, v]) => `<div><kbd>${k}</kbd> ${v}</div>`).join('');
  const toggleHelp = () => help.style.display = help.style.display === 'block' ? 'none' : 'block';
  $('#uHelpBtn')!.onclick = e => { e.stopPropagation(); toggleHelp(); };
  addEventListener('keydown', e => { if (e.key === '?' && !(e.target instanceof HTMLInputElement)) toggleHelp(); if (e.key === 'Escape') { help.style.display = 'none'; menu.style.display = 'none'; open = ''; tray.style.display = 'none'; refresh(); } });
  addEventListener('pointerdown', () => { menu.style.display = 'none'; help.style.display = 'none'; });
  addEventListener('keyup', () => setTimeout(refresh, 30));
  const badge = document.createElement('div'); badge.id = 'uBadge'; badge.textContent = 'UI preview (mockup) · add ?ui=old for the current layout'; document.body.appendChild(badge);
  (window as any).__ui2 = { openTray, cats: CATS.map(c => c.id) };
}
