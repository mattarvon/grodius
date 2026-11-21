// The booth's short-lived render caches (plugin.ts): pure bookkeeping, no files and no ffmpeg here, so the rules are
// unit-tested on their own (tests/unit/booth-cache.test.ts).
//  - a preview's render, kept for a while under a random id the page gets back: a keep that names the id, of the same
//    raw bytes, line, pause setting, rack and FX chain, is filed from it instead of being rendered again;
//  - a raw take's cleaned-up wav (plugin.ts prepTake), shared by a preview's clean A and racked B, and by the next
//    preview of the same take with another rack.
// A plain field per class member, no parameter properties: the CLI (reprocess.mjs) runs plugin.ts, and so this file,
// under Node's type stripping.
import { FX_CHAIN, cleanFx, fxOn, type FxSet } from './fx.ts';

/** what a render was made from: a keep may use it only when every field is its own */
export type RenderKey = { cat: string; sha: string; squeeze: boolean; fx: string; chain: number };

/** the rack as the key holds it: the cleanFx'd rack's JSON, or '' when no effect is on (processTake renders such a
 *  rack as the clean take, and a keep files it clean) */
export const fxKey = (fx: FxSet | null | undefined): string => {
  const c = cleanFx(fx);
  return fxOn(c) ? JSON.stringify(c) : '';
};
/** the key of a render: the slot, the raw bytes' sha-256 (hex), the pause squeeze, the rack, the FX chain version */
export const renderKey = (cat: string, sha: string, squeeze: boolean, fx: FxSet | null | undefined, chain: number = FX_CHAIN): RenderKey =>
  ({ cat, sha, squeeze, fx: fxKey(fx), chain });
export const sameKey = (a: RenderKey, b: RenderKey) =>
  a.cat === b.cat && a.sha === b.sha && a.squeeze === b.squeeze && a.fx === b.fx && a.chain === b.chain;

/** a preview id as the page sends it back: 24 hex digits (12 random bytes) */
export const PREVIEW_ID_RE = /^[0-9a-f]{24}$/;
/** the keep's ?preview=, or null when it is missing or malformed (then the keep renders as ever) */
export const previewParam = (q: URLSearchParams): string | null => {
  const s = q.get('preview');
  return s != null && PREVIEW_ID_RE.test(s) ? s : null;
};

/** a small LRU with a time to live: an entry not used for `ttl` ms is gone, and past `max` entries the least
 *  recently used go first. `drop` is called for every entry it lets go of (its files deleted), never for one handed
 *  out by take(). An entry held (hold/release: a render reading its wav) is never dropped: it may overstay its time
 *  or the size cap until released. `now` is the clock (a test's own) */
export class Shelf<V> {
  readonly max: number;
  readonly ttl: number;
  private readonly drop: (v: V) => void;
  private readonly now: () => number;
  private readonly m = new Map<string, { v: V; at: number; busy: number }>();
  constructor(o: { max: number; ttl: number; drop?: (v: V) => void; now?: () => number }) {
    this.max = o.max;
    this.ttl = o.ttl;
    this.drop = o.drop ?? (() => {});
    this.now = o.now ?? Date.now;
  }
  get size() { return this.m.size; }
  private live(k: string) {
    const e = this.m.get(k);
    if (!e) return undefined;
    if (!e.busy && this.now() - e.at > this.ttl) { this.m.delete(k); this.drop(e.v); return undefined; }
    return e;
  }
  /** the live value, now the most recently used (its time restarts) */
  get(k: string): V | undefined {
    const e = this.live(k);
    if (!e) return undefined;
    e.at = this.now();
    this.m.delete(k);
    this.m.set(k, e);
    return e.v;
  }
  /** the value, replacing (and dropping) any under the same key; then the expired and the overflow go */
  put(k: string, v: V) {
    const old = this.m.get(k);
    this.m.delete(k);
    if (old && old.v !== v) this.drop(old.v);
    this.m.set(k, { v, at: this.now(), busy: 0 });
    this.sweep();
  }
  /** the live value under k when `ok` accepts it, removed from the shelf and handed over (the caller's to clean up);
   *  else undefined, and a live entry stays where it is */
  take(k: string, ok: (v: V) => boolean = () => true): V | undefined {
    const e = this.live(k);
    if (!e || e.busy || !ok(e.v)) return undefined;
    this.m.delete(k);
    return e.v;
  }
  /** forgets k without dropping it (a render that failed: nothing of it to clean up) */
  forget(k: string, v?: V) {
    if (v === undefined || this.m.get(k)?.v === v) this.m.delete(k);
  }
  hold(k: string) { const e = this.m.get(k); if (e) e.busy++; }
  release(k: string) {
    const e = this.m.get(k);
    if (!e || !e.busy) return;
    e.busy--;
    e.at = this.now();
    this.sweep();
  }
  /** drops the expired entries, then the least recently used past `max`. A held entry stays either way, and so does
   *  the most recent (the one just put: the shelf runs over its cap rather than drop it) */
  sweep() {
    const t = this.now();
    for (const [k, e] of [...this.m]) if (!e.busy && t - e.at > this.ttl) { this.m.delete(k); this.drop(e.v); }
    for (const [k, e] of [...this.m].slice(0, -1)) {
      if (this.m.size <= this.max) break;
      if (!e.busy) { this.m.delete(k); this.drop(e.v); }
    }
  }
  /** drops every entry, held or not (the server is closing) */
  clear() {
    const all = [...this.m.values()];
    this.m.clear();
    for (const e of all) this.drop(e.v);
  }
}
