// The LAB: a persisted dev row on the title screen (build plan LS1 sprint 2 item D2). The Capacitor APK loads its
// bundled page with no query string, so this is the only way to reach the long layout (and later the WIP midbosses
// and the checkpoint-on-death option) on the phone. It lives under its own key, outside the meta save (grodius.v1)
// and the run save (grodius.run), so a bad LAB blob can never cost either.
//
// Precedence for each setting: URL flag > LAB > default. The choice is a pure function (layoutChoice) so tests can
// drive it without a DOM; the module keeps a cached copy of the stored LAB so draw code never touches storage.
import { clearRun } from './runsave';
import { LAYOUTS, layout, setLayout } from './layout';

export const LAB_KEY = 'grodius.lab';

/** the LAB's own values. layout: which descent a new run flies; mids: LS2's greybox midbosses (no consumer yet);
 *  cp: the checkpoint trigger, spec §4 option a (app kill or quit only, the default) or b (also on death; item H) */
export interface Lab { layout: 'short' | 'long'; mids: '' | 'wip'; cp: 'a' | 'b' }
export const LAB_DEFAULT: Lab = { layout: 'short', mids: '', cp: 'a' };

/** the LAB layout name -> the layout table id it flies (src/layout.ts LAYOUTS) */
export const LAYOUT_ID = { short: 'short', long: 'long4' } as const;
/** the ?layout= values and the layout entry each selects; any other value is tried as an entry id (item D) */
export const LAYOUT_FLAG: Record<string, string> = { long: 'long4', long4: 'long4', short: 'short' };

/** a well-formed LAB from anything (a stored blob, a hand-edited one): unknown values fall back to the default */
export function labOf(v: unknown): Lab {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    layout: o.layout === 'long' ? 'long' : 'short',
    mids: o.mids === 'wip' ? 'wip' : '',
    cp: o.cp === 'b' ? 'b' : 'a',
  };
}

/** the raw ?layout= value, or null when the URL does not set one */
export function urlLayout(search: string): string | null {
  try { return new URLSearchParams(search).get('layout'); } catch (e) { return null; }
}

export interface LayoutChoice {
  /** the layout entry id the next run flies ('short' when nothing chose: the caller keeps the active entry) */
  id: string;
  src: 'url' | 'lab' | 'default';
  /** a ?layout= value that names no registered entry: ignored (warned at boot), the LAB or short applies */
  bad?: string;
}
/** THE layout choice (the boot flag parse and every run start go through it): a registered ?layout= flag beats the
 *  LAB, the LAB beats `short`. Pure; `has` is the registry check (LAYOUTS own keys) */
export function layoutChoice(search: string, lab: Lab | null, has: (id: string) => boolean = (id) => Object.hasOwn(LAYOUTS, id)): LayoutChoice {
  const v = urlLayout(search);
  if (v != null) {
    const id = Object.hasOwn(LAYOUT_FLAG, v) ? LAYOUT_FLAG[v] : v;
    if (has(id)) return { id, src: 'url' };
    if (lab) return { id: LAYOUT_ID[lab.layout], src: 'lab', bad: v };
    return { id: 'short', src: 'default', bad: v };
  }
  return lab ? { id: LAYOUT_ID[lab.layout], src: 'lab' } : { id: 'short', src: 'default' };
}
/** the title's name for a layout id */
export const layoutName = (id: string) => (id === 'long4' ? 'LONG' : id.toUpperCase());

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
/** the layout a run started now would fly (URL > LAB > short), with its source for the title. With neither a flag
 *  nor a LAB key the run keeps the active entry (short at boot; a probe's --layout sets it in-page before Enter) */
export function activeLayout(): LayoutChoice {
  const c = layoutChoice(search(), cur);
  return c.src === 'default' ? { ...c, id: layout().id } : c;
}
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

/** apply the chosen layout (the setLayout contract: only before newGame()): at boot (main.ts) and again at every
 *  run start (menus.ts startRun), so a LAB change on the title takes effect at the next run, never mid-run. With no
 *  flag and no LAB key it leaves the active entry alone. Returns the choice; the entry flown is layout().id */
export function applyRunLayout(): LayoutChoice {
  const c = layoutChoice(search(), cur);
  if (c.src !== 'default') setLayout(c.id);
  return c;
}
