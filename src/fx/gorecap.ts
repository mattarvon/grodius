// =====================================================================
//  GORE DENSITY (decision 32, gate T3: the phone frame budget). The render is bound by canvas calls: hundreds of gibs,
//  thousands of drops and sparks are one call each, and on the phone profile (perf-probe, 4x CPU) the Open Orbit knots
//  and breach went over 16.7 ms on them alone (r4-perf: the scene with every particle removed costs ~3 ms CPU p95, x4
//  ~12 ms). LITE caps how many particles live at once; FULL keeps the desktop caps.
//
//  fx side only: every particle here is born and moved on the render stream (srnd), never the sim's R(), so the sim is
//  untouched whatever the mode. FULL is the old behaviour exactly, so desktop, the harness (T1, the long4 sig: it counts
//  drops.length) and parity never see LITE.
//
//  Which mode: ?gore=lite|full in the URL (probes, testing) wins; then the GORE DENSITY setting (SET.gore: 'auto' |
//  'full' | 'lite'); 'auto' (the default) is LITE on the Capacitor app or a touch-first screen (pointer: coarse), FULL
//  otherwise. A WebGL particle layer that would lift the caps is its own later project (decision 32).
// =====================================================================

/** the live particle caps per mode. FULL: the long-standing caps in fx/spawn.ts. LITE [FIT] r4-perf, measured with
 *  tools/perf-probe.mjs knots/breach at 4x and main-thread CPU x4; the art-director approved the read */
export const GORE_CAPS = {
  full: { drops: 4800, gibs: 720, sparks: 500, mists: 340, decals: 1800, flashes: 140, ropes: Infinity, eyes: Infinity },
  // ropes (three strokes each) and eye gibs (a hi-res eyeball each) are the dear gib kinds: LITE holds them to a few
  lite: { drops: 700, gibs: 180, sparks: 140, mists: 100, decals: 500, flashes: 60, ropes: 12, eyes: 14 },
} as const;
/** live gibs of kind k (the rope / eye caps) */
export function gibCount(list: readonly { k: string }[], k: string): number {
  let n = 0;
  for (const q of list) if (q.k === k) n++;
  return n;
}
export type GoreMode = 'auto' | 'full' | 'lite';

/** the mode the auto rule picks for a device: the native app or a coarse (touch-first) pointer is a phone. Pure */
export function autoLite(native: boolean, coarse: boolean): boolean {
  return native || coarse;
}
/** the URL's ?gore= override, or null. Pure */
export function urlGore(search: string): 'full' | 'lite' | null {
  const m = /[?&]gore=(full|lite)\b/.exec(search || '');
  return m ? (m[1] as 'full' | 'lite') : null;
}

let setting: GoreMode = 'auto';
let cached: boolean | null = null;
/** the GORE DENSITY setting changed (save.ts load, the options menu) */
export function setGoreMode(m: GoreMode): void {
  setting = m === 'full' || m === 'lite' ? m : 'auto';
  cached = null;
}
export const goreMode = (): GoreMode => setting;
function detect(): boolean {
  const g: any = globalThis as any;
  const u = urlGore(g.location ? g.location.search : '');
  if (u) return u === 'lite';
  if (setting !== 'auto') return setting === 'lite';
  const native = !!(g.Capacitor && g.Capacitor.isNativePlatform && g.Capacitor.isNativePlatform());
  let coarse = false;
  try { coarse = !!(g.matchMedia && g.matchMedia('(pointer: coarse)').matches); } catch (e) {}
  return autoLite(native, coarse);
}
/** LITE is in force (read once, again after a setting change) */
export function goreLite(): boolean {
  if (cached == null) cached = detect();
  return cached;
}
/** the caps in force */
export const goreCaps = () => (goreLite() ? GORE_CAPS.lite : GORE_CAPS.full);
