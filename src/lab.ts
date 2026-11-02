// The LAB: a persisted dev row on the title screen (build plan LS1 sprint 2 item D2). The Capacitor APK loads its
// bundled page with no query string, so this is the only way to reach the long layout (and later the WIP midbosses
// and the checkpoint-on-death option) on the phone. It lives under its own key, outside the meta save (grodius.v1)
// and the run save (grodius.run), so a bad LAB blob can never cost either.
//
// Precedence for each setting: URL flag > LAB > default. The choice is a pure function (layoutChoice) so tests can
// drive it without a DOM; the module keeps a cached copy of the stored LAB so draw code never touches storage.
import { clearRun } from './runsave';

export const LAB_KEY = 'grodius.lab';

/** the LAB's own values. layout: which descent a new run flies; mids: LS2's greybox midbosses (no consumer yet);
 *  cp: the checkpoint trigger, spec §4 option a (app kill or quit only, the default) or b (also on death; item H) */
export interface Lab { layout: 'short' | 'long'; mids: '' | 'wip'; cp: 'a' | 'b' }
export const LAB_DEFAULT: Lab = { layout: 'short', mids: '', cp: 'a' };

/** the LAB layout name -> the layout table id it flies (src/layout.ts LAYOUTS) */
export const LAYOUT_ID = { short: 'short', long: 'long4' } as const;

/** a well-formed LAB from anything (a stored blob, a hand-edited one): unknown values fall back to the default */
export function labOf(v: unknown): Lab {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    layout: o.layout === 'long' ? 'long' : 'short',
    mids: o.mids === 'wip' ? 'wip' : '',
    cp: o.cp === 'b' ? 'b' : 'a',
  };
}

/** the ?layout= flag (short | long; long4 is accepted as long), or null when the URL does not set one */
export function urlLayout(search: string): Lab['layout'] | null {
  let v: string | null = null;
  try { v = new URLSearchParams(search).get('layout'); } catch (e) { return null; }
  return v === 'long' || v === 'long4' ? 'long' : v === 'short' ? 'short' : null;
}

/** which layout a new run flies, and where that came from: the URL flag beats the LAB, the LAB beats `short` */
export function layoutChoice(search: string, lab: Lab | null): { layout: Lab['layout']; id: string; src: 'url' | 'lab' | 'default' } {
  const u = urlLayout(search);
  const layout = u ?? lab?.layout ?? 'short';
  return { layout, id: LAYOUT_ID[layout], src: u ? 'url' : lab ? 'lab' : 'default' };
}

// ---- storage. Every access is guarded, like save.ts: a private window or blocked storage must still boot.
/** the stored LAB, or null when there is none (or storage is unreadable) */
export function readLab(): Lab | null {
  try {
    const s = localStorage.getItem(LAB_KEY);
    return s == null ? null : labOf(JSON.parse(s));
  } catch (e) {
    return null;
  }
}
function writeLab(l: Lab) {
  try { localStorage.setItem(LAB_KEY, JSON.stringify(l)); } catch (e) {}
}
const search = () => (typeof location !== 'undefined' ? location.search : '');

// the cached LAB: read once at load, rewritten by setLab. null = no key stored (the harness's fresh save)
let cur: Lab | null = readLab();

/** the LAB as the title should show it (defaults filled in) */
export const lab = (): Lab => cur || LAB_DEFAULT;
/** the layout a run started now would fly (URL > LAB > short), with its source for the title */
export const activeLayout = () => layoutChoice(search(), cur);
/** LS2's WIP midboss flag: ?mids=wip, else the LAB */
export const midsWip = () => /[?&]mids=wip\b/.test(search()) || lab().mids === 'wip';
/** the checkpoint trigger for item H: 'a' = app kill or quit only (spec §4 default), 'b' = also on death */
export const cpTrigger = (): Lab['cp'] => lab().cp;

/** change one LAB setting and persist it. Changing the layout discards the run save (grodius.run): its layout id
 *  no longer matches the run a RESUME would rebuild. Returns the new LAB. */
export function setLab(patch: Partial<Lab>): Lab {
  const before = lab();
  const next = labOf({ ...before, ...patch });
  cur = next;
  writeLab(next);
  if (next.layout !== before.layout) {
    clearRun(); // guarded: never throws
  }
  return next;
}

/** apply the chosen layout before a run starts (the setLayout contract: only before newGame()). Wired to item D's
 *  setLayout when D lands; until then a non-short choice has no layout entry to switch to, so this is a no-op and
 *  every run flies `short`. Returns the id the run actually flies. */
export function applyRunLayout(): string {
  return 'short';
}
