// Save slots in IndexedDB, gzip-compressed (CompressionStream). The same bytes are the .city export file.
export const SAVE_FORMAT = 'city-builder-save', SAVE_VERSION = 4;
export type SaveMeta = { id: string; slot: string; city: string; size: number; day: number; pop: number; funds: number; ts: number; bytes: number };
export type SaveRec = SaveMeta & { data: Blob };
const DB = 'city-builder', STORE = 'saves';
const db = () => new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) => { const d = await db(); return new Promise<T>((res, rej) => { const r = f(d.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); };
export const listSaves = async (): Promise<SaveMeta[]> => ((await tx('readonly', s => s.getAll())) as SaveRec[]).map(({ data, ...m }) => m).sort((a, b) => b.ts - a.ts);
export const getSave = (id: string) => tx<SaveRec | undefined>('readonly', s => s.get(id));
export const putSave = (rec: SaveRec) => tx('readwrite', s => s.put(rec));
export const deleteSave = (id: string) => tx('readwrite', s => s.delete(id));
export async function compress(obj: unknown): Promise<Blob> { const cs = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip')); return new Response(cs, { headers: { 'content-type': 'application/octet-stream' } }).blob(); }
export async function decompress(b: Blob): Promise<any> { const ds = b.stream().pipeThrough(new DecompressionStream('gzip')); const o = JSON.parse(await new Response(ds).text()); if (o?.format !== SAVE_FORMAT) throw new Error('Not a city save file'); if (o.version > SAVE_VERSION) throw new Error(`Save is from a newer version (${o.version})`); return migrate(o); }
/** Upgrade older saves step by step as the format changes (none yet). */
function migrate(o: any) { if (o.version < 2) { o.lots = []; o.version = 2; } /* v2: suburban lots */ if (o.version < 3) { o.version = 3; } if (o.version < 4) { o.version = 4; } /* v4: road widths (missing grid = 2-lane) */ /* v3: road tiers + construction; missing grids load as finished asphalt */ return o; }
export const b64 = (u: Uint8Array) => { let s = ''; for (let k = 0; k < u.length; k += 0x8000) s += String.fromCharCode(...u.subarray(k, k + 0x8000)); return btoa(s); };
export const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const metaFrom = (o: any, slot: string, id: string, data: Blob): SaveRec => ({ id, slot, city: o.city.name, size: o.city.size, day: o.sim.day, pop: o.sim.pop, funds: o.sim.funds, ts: Date.now(), bytes: data.size, data });
export function download(b: Blob, name: string) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
