// =====================================================================
//  THE WARM-UP RUNNER (build plan LS1 row K). src/warmplan.ts says what the run needs; this builds it one piece per
//  idle slot and drops what the route has left behind. Render-side: it reads $, writes only render caches, and draws
//  no sim RNG (every builder is seeded or hashed, so a rebuilt piece is the same art). Every lazy draw path still
//  works, so a piece that isn't built yet costs a hitch on first draw and nothing worse.
// =====================================================================
import { $ } from '../state';
import { gibs } from '../world';
import { BOOT_ART, routeArt, routeKeys, warmBlocked } from '../warmplan';
import { warmHeroEye } from './heroeye';
import { warmEyes } from './eyes';
import { warmDerelict } from './terrain';
import { dropMawVariant, mawVariantBuilt, warmMawVariant } from './gross/maw';
import { warmDrive } from './gross/drive';
import { MID_ART } from './gross/mid';
import { dropBiomeBoss, biomeBossBuilt, warmBiomeBoss } from './gross/biomebosses';

/** one piece of art. warm: build one slice, true while more slices remain. drop: free it (route art only) */
interface Unit { warm: () => boolean; drop?: () => void; built?: () => boolean }
const mawV = (v: string): Unit => ({ warm: () => warmMawVariant(v), drop: () => dropMawVariant(v), built: () => mawVariantBuilt(v) });
const bb = (k: string): Unit => ({ warm: () => warmBiomeBoss(k), drop: () => dropBiomeBoss(k), built: () => biomeBossBuilt(k) });
const UNITS: Record<string, Unit> = {
  hero: { warm: warmHeroEye }, eyes: { warm: warmEyes }, derelict: { warm: warmDerelict },
  'maw:orbit': mawV('orbit'), drive: { warm: warmDrive },
  ...MID_ART, // every midboss (render/gross/mid/): its art carries warm, built and drop
  crux: bb('crux'), butcher: bb('butcher'), 'maw:acid': mawV('acid'), 'maw:snot': mawV('snot'),
};

/** the art the route owns and can drop: not the boot art, which stays built all session (warmplan.ts routeKeys) */
const ROUTE_KEYS = routeKeys(UNITS);
const boot = [...BOOT_ART];

/** the slice log the probes read (window.__warm): bounded, and slices are rare, so it costs nothing in play */
export const warmLog: { k: string; op: string; ms: number; t: number; stage: number; scroll: number; state: string; banner: string; warn: boolean }[] = [];
function note(k: string, op: string, ms: number) {
  const G = $.G;
  if (warmLog.length < 400) warmLog.push({ k, op, ms, t: G ? G.t : -1, stage: G ? G.stage : -1, scroll: G ? G.scroll : -1, state: $.state, banner: (G && G.banner && G.banner.text) || '', warn: !!G && G.t < (G.warnEnd || 0) });
}
const timed = (k: string, op: string, f: () => boolean | void) => { const t0 = performance.now(), r = f(); note(k, op, performance.now() - t0); return r; };

/** do at most one piece of work: a boot slice, else a route build, else a drop. True if it did something */
export function warmPump(): boolean {
  if (warmBlocked($.state, $.G)) return false;
  if (boot.length) {
    const k = boot[0];
    if (!timed(k, 'boot', UNITS[k].warm)) boot.shift();
    return true;
  }
  const want = routeArt($.G);
  for (const k of want) {
    const u = UNITS[k];
    if (u && u.built && !u.built()) { timed(k, 'route', u.warm); return true; }
  }
  // a split midboss or Maw redraws its dead body through the same lazy builders (gore.ts 'half'): a drop now would rebuild
  // next frame. Ordinary enemies split too, but they use no route art, so they mustn't starve the drop
  if (gibs.some((q) => q.k === 'half' && q.e.mini)) return false;
  for (const k of ROUTE_KEYS) {
    const u = UNITS[k];
    if (u.built!() && !want.includes(k)) { timed(k, 'drop', u.drop!); return true; }
  }
  return false;
}

/** build these keys now, whatever the gate says. Probes only: a scene staged without its real route */
export function warmNow(keys: readonly string[]) { for (const k of keys) { const u = UNITS[k]; if (u) while (u.warm()); } }
/** which route keys are built right now (probes) */
export const warmBuilt = () => ROUTE_KEYS.filter((k) => UNITS[k].built!());

// the idle slots run back to back while there is work; between jobs a 4 Hz poll watches the route
const POLL_MS = 250;
const idle = (f: () => void) => (window.requestIdleCallback || ((g) => setTimeout(g, 50)))(f, { timeout: 1000 });
function loop() {
  if (warmPump()) idle(loop);
  else setTimeout(loop, POLL_MS);
}
/** start the warm-up (main.ts start()): the same 1.5 s after boot the old all-at-boot pass waited */
export function startWarm() { setTimeout(loop, 1500); }
