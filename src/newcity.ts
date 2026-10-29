import { genTerrain, drawMini, type T } from './terrain';
export type CityCfg = { name: string; size: number; seed: number };
export const SIZES: [string, number][] = [['Small', 128], ['Medium', 192], ['Large', 256], ['XL', 384]];
/** Shows the New City screen (unless ?size=&seed= is in the URL) and resolves with the choice and its terrain. */
export function chooseCity(extra?: (el: HTMLElement, done: (v: any) => void) => void): Promise<{ cfg: CityCfg; terrain: T[][] } | any> {
  const q = new URLSearchParams(location.search);
  if (q.get('size')) { const cfg = { name: q.get('city') || 'New City', size: +q.get('size')!, seed: +(q.get('seed') || 1) }; return Promise.resolve({ cfg, terrain: genTerrain(cfg.size, cfg.seed) }); }
  return new Promise(resolve => {
    const el = document.createElement('div'); el.id = 'newCity';
    el.innerHTML = `<div class="nc"><h1>🏙 New City</h1>
      <label>City name <input id="ncName" maxlength="40" value="${localStorage.getItem('lastCityName') || 'Riverton'}"></label>
      <div class="ncRow"><span>Map size</span><div id="ncSize">${SIZES.map(([l, s], k) => `<button data-s="${s}" class="${k === 0 ? 'on' : ''}"><b>${l}</b><small>${s}×${s}</small></button>`).join('')}</div></div>
      <label>Terrain seed <input id="ncSeed" type="number" min="0" max="999999999"> <button id="ncRand" title="Random terrain">🎲 Randomize</button></label>
      <canvas id="ncMini" width="520" height="260"></canvas>
      <div class="ncBtns"><span id="ncExtra"></span><button id="ncGo" class="go">Found city ▶</button></div></div>`;
    document.body.appendChild(el);
    const $ = (id: string) => el.querySelector('#' + id) as HTMLInputElement;
    let size = SIZES[0][1], t: T[][] = [];
    const seedEl = $('ncSeed'); seedEl.value = String(Math.floor(Math.random() * 1e6));
    let pend = 0; const preview = () => { clearTimeout(pend); pend = window.setTimeout(() => { t = genTerrain(size, +seedEl.value || 0); drawMini($('ncMini') as any, t); }, 60); };
    el.querySelectorAll<HTMLButtonElement>('#ncSize button').forEach(b => b.onclick = () => { size = +b.dataset.s!; el.querySelectorAll('#ncSize button').forEach(x => x.classList.toggle('on', x === b)); preview(); });
    $('ncRand').onclick = () => { seedEl.value = String(Math.floor(Math.random() * 1e6)); preview(); };
    seedEl.oninput = preview; preview();
    const done = (v: any) => { el.remove(); resolve(v); };
    $('ncGo').onclick = () => { const cfg = { name: $('ncName').value.trim() || 'New City', size, seed: +seedEl.value || 0 }; localStorage.setItem('lastCityName', cfg.name); done({ cfg, terrain: genTerrain(cfg.size, cfg.seed) }); };
    extra?.(el.querySelector('#ncExtra')!, done);
  });
}
