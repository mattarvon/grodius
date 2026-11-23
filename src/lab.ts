// The LAB: a persisted dev row on the title screen (build plan LS1 sprint 2 item D2). The Capacitor APK loads its
// bundled page with no query string, so this is the only way to reach the short layout (long4 is the default since
// D24), the WIP midbosses, a forced wip midboss with its jump (D53) and the checkpoint-on-death option on the phone. It lives under its own key, outside the meta save (grodius.v1)
// and the run save (grodius.run), so a bad LAB blob can never cost either.
//
// Precedence for each setting: URL flag > LAB > default. The choice is a pure function (layoutChoice) so tests can
// drive it without a DOM; the module keeps a cached copy of the stored LAB so draw code never touches storage.
import { LAYOUTS, layout, setLayout } from './layout';
import { ROSTER, midRow } from './enemies/mid/roster';
import { TIER_DEFAULT, type Tier, tierOf } from './tier';

export const LAB_KEY = 'grodius.lab';

/** the LAB's own values. layout: which descent a new run flies; mids: LS2's unfinished midbosses (`wip` rows in enemies/mid/roster.ts; biomes.ts stageMids reads it);
 *  cp: the checkpoint trigger, spec §4 option a (app kill or quit only, the default) or b (also on death; item H);
 *  mid: the wip kind forced into slot A of every biome stage, the LAB's ?mid= (midForce), or '' (off, the default);
 *  tier: the difficulty tier (src/tier.ts) a long run flies, 0 Easy to 3 Very Hard (1 Normal, the default). It replaced
 *  D63's BRUTAL dial; a stored LAB's old `brutal` value is dropped and reads as Normal (its levers are gone) */
export interface Lab { layout: 'short' | 'long'; mids: '' | 'wip'; cp: 'a' | 'b'; mid: string; tier: Tier }
/** the layout a run flies when neither a ?layout= flag nor the LAB chose one. long4 since 2026-11-02 (D24, Matt:
 *  make long the default); short stays reachable through the LAB and ?layout=short until it is deleted */
export const DEFAULT_LAYOUT = 'long4';
export const LAB_DEFAULT: Lab = { layout: 'long', mids: '', cp: 'a', mid: '', tier: TIER_DEFAULT };

/** the LAB layout name -> the layout table id it flies (src/layout.ts LAYOUTS) */
export const LAYOUT_ID = { short: 'short', long: 'long4' } as const;
/** the ?layout= values and the layout entry each selects; any other value is tried as an entry id (item D) */
export const LAYOUT_FLAG: Record<string, string> = { long: 'long4', long4: 'long4', short: 'short' };

/** a well-formed LAB from anything (a stored blob, a hand-edited one): unknown values fall back to the default */
export function labOf(v: unknown): Lab {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    layout: o.layout === 'short' ? 'short' : 'long',
    mids: o.mids === 'wip' ? 'wip' : '',
    cp: o.cp === 'b' ? 'b' : 'a',
    mid: typeof o.mid === 'string' && midRow(o.mid)?.wip ? o.mid : '', // a wip kind only: finished or unknown is off
    tier: tierOf(o.tier) ?? TIER_DEFAULT, // an old blob's `brutal` key is not read: Normal (DIFFICULTY-SPEC §5.4)
  };
}

/** the difficulty tier a run started now flies on layout `id` (DIFFICULTY-SPEC §2.1 plumbing): a valid ?tier=N beats
 *  everything; a ?brutal= (any value, accepted for one release) reads as Normal; then the LAB; then Normal. null on
 *  any layout but long4: short stays today's game byte for byte and its G carries no tier. Pure */
export function tierChoice(search: string, l: Lab | null, id: string): Tier | null {
  if (id !== 'long4') return null;
  let p: URLSearchParams | null = null;
  try { p = new URLSearchParams(search); } catch (e) {}
  const t = p ? tierOf(p.get('tier')) : null;
  if (t != null) return t;
  if (p && p.has('brutal')) return TIER_DEFAULT; // D63's dial is gone; its old links fly Normal
  return l ? l.tier : TIER_DEFAULT;
}
/** the raw ?layout= value, or null when the URL does not set one */
export function urlLayout(search: string): string | null {
  try { return new URLSearchParams(search).get('layout'); } catch (e) { return null; }
}

export interface LayoutChoice {
  /** the layout entry id the next run flies (DEFAULT_LAYOUT when nothing chose: a run start keeps the active entry) */
  id: string;
  src: 'url' | 'lab' | 'default';
  /** a ?layout= value that names no registered entry: ignored (warned at boot), the LAB or DEFAULT_LAYOUT applies */
  bad?: string;
}
/** THE layout choice (the boot flag parse and every run start go through it): a registered ?layout= flag beats the
 *  LAB, the LAB beats DEFAULT_LAYOUT. Pure; `has` is the registry check (LAYOUTS own keys) */
export function layoutChoice(search: string, lab: Lab | null, has: (id: string) => boolean = (id) => Object.hasOwn(LAYOUTS, id)): LayoutChoice {
  const v = urlLayout(search);
  if (v != null) {
    const id = Object.hasOwn(LAYOUT_FLAG, v) ? LAYOUT_FLAG[v] : v;
    if (has(id)) return { id, src: 'url' };
    if (lab) return { id: LAYOUT_ID[lab.layout], src: 'lab', bad: v };
    return { id: DEFAULT_LAYOUT, src: 'default', bad: v };
  }
  return lab ? { id: LAYOUT_ID[lab.layout], src: 'lab' } : { id: DEFAULT_LAYOUT, src: 'default' };
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
/** the layout a run started now would fly (URL > LAB > DEFAULT_LAYOUT, long4), with its source for the title. With neither a flag
 *  nor a LAB key the run keeps the active entry (DEFAULT_LAYOUT at boot; a probe's --layout sets it in-page before Enter) */
export function activeLayout(): LayoutChoice {
  const c = layoutChoice(search(), cur);
  return c.src === 'default' ? { ...c, id: layout().id } : c;
}
/** LS2's WIP midboss flag: ?mids=wip, else the LAB */
export const midsWip = () => /[?&]mids=wip\b/.test(search()) || lab().mids === 'wip';
/** the kind a ?mid=<kind> query forces into slot A of every biome stage (biomes.ts stageMids), or null. Only a `wip`
 *  row: it is the test path for a kind the picker can't reach yet (a ship-pool row has no spawn path, src/CLAUDE.md
 *  "Not just a row"). A finished, unknown or missing name is null, so the query can't change a shipped run. Pure */
export function forcedMid(search: string): string | null {
  const m = /[?&]mid=([a-z0-9_-]+)/.exec(search), r = m ? midRow(m[1]) : undefined;
  return r && r.wip ? r.k : null;
}
/** the LAB's FORCE MID cycle: off, then each `wip` row in roster order (none since THE KEEPSAKE's row retired, D55: the row hides) */
export const wipMids = (): string[] => ['', ...ROSTER.filter((r) => r.wip).map((r) => r.k)];
/** the forced midboss: a ?mid=<wip kind> query, else the LAB's FORCE MID row, else null. A query that names no wip
 *  kind is ignored, so the LAB applies under it. Ungated, like ?mids=wip and the MIDBOSSES row: the query works on
 *  any web build, deployed included, and the row is how the APK (no query string) reaches it (D53). The
 *  &stage=&x=&kit= URL jump is dev-server-only; the LAB's JUMP TO MID row (menus.ts, jump.ts midJump) is its phone
 *  twin. A forced wip kind still leaves the profile alone: meetMid and firstKill skip wip rows (no meta.mb, meta.mbK
 *  or first-kill pay). With neither set it is null and no run changes */
export const midForce = () => forcedMid(search()) ?? (lab().mid || null);
/** the tier the next run flies on layout `id` (flow.ts newGame / jumpRun; menus.ts's LAB row), or null off long4 */
export const tierPick = (id: string = layout().id): Tier | null => tierChoice(search(), cur, id);
/** the checkpoint trigger for item H: 'a' = app kill or quit only (spec §4 default), 'b' = also on death */
export const cpTrigger = (): Lab['cp'] => lab().cp;

/** change one LAB setting and persist it. Returns the new LAB. The run save (grodius.run) is kept, layout change
 *  included (D33, Matt): it records its own layout, and RE-ENTER flies that one (the title row names it) */
export function setLab(patch: Partial<Lab>): Lab {
  const before = lab();
  const next = labOf({ ...before, ...patch });
  cur = next;
  writeLab(next);
  return next;
}

/** apply the chosen layout (the setLayout contract: only before newGame()): at boot (main.ts) and again at every
 *  run start (menus.ts startRun), so a LAB change on the title takes effect at the next run, never mid-run. With no
 *  flag and no LAB key it leaves the active entry alone. Returns the choice; the entry flown is layout().id */
export function applyRunLayout(boot = false): LayoutChoice {
  const c = layoutChoice(search(), cur);
  // at boot the default applies; at a run start it leaves the active entry alone (a probe's --layout set it in-page)
  if (c.src !== 'default' || boot) setLayout(c.id);
  return c;
}
