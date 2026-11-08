// =====================================================================
//  THE MIDBOSS REGISTRY, sim side (build plan LS2-0; the recipe is in src/CLAUDE.md "Adding a midboss").
//  One row per kind in ROSTER, one file per kind beside this one, and that is every list there is: the picker, the
//  biome tables, the run save, the warm-up, the HUD and the probes all read from here.
//
//  This file is a leaf and stays one: no imports, types that erase, so midpick.ts, runsave.ts and warmplan.ts stay pure,
//  the tools can read it from plain Node, and a row is there at any point in the boot's import cycles. That is why the
//  picker's fields sit in a row here and not in the kind's file, which imports the sim (and through core.ts, the DOM).
// =====================================================================

/** the skill a midboss tests (spec §6.1) */
export type MidTag = 'LINE' | 'SPACE' | 'RANGE' | 'CROWD' | 'WINDOW' | 'ANGLE' | 'RACE' | 'DRIFT';
/** which pool a kind belongs to (spec §6.2): a biome's, Open Orbit's, or the ship's (interiors and the Drive approach) */
export type MidPool = 'ice' | 'acid' | 'fire' | 'snot' | 'orbit' | 'ship';

export interface MidRow {
  /** the kind: e.k, the file names, and the key in the saves (meta.mb, the run save), so it never changes */
  k: string;
  /** the WARNING banner and HUD name; a crossover keeps it */
  name: string;
  /** the probes' column heading, 12 characters at most */
  label: string;
  tag: MidTag;
  pool: MidPool;
  /** first descent it can appear in, 0-based like G.loop (ANGLE and RACE members are 1: never in Descent 1) */
  min: number;
  /** the art and hitbox it uses, when it shares another kind's (a recolour); the picker excludes by body too */
  body?: string;
  /** body clearance for the terrain fit, px from e.y (enemies/midhost.ts MID_BODY). Every biome-pool kind needs one:
   *  it can fight as a crossover. Measured off the art at its largest pulse, hittable parts only; up + dn stays under the
   *  108 px minimum corridor. Checked by `node tools/midboss-probe.mjs <url> matrix` */
  fit?: { up: number; dn: number; hw: number };
  /** its home fight is terrain-fitted too (midhost.ts fitsTerrain), not only its crossovers */
  homeFit?: boolean;
  /** its art is built at boot and held all session (src/warmplan.ts): for a kind no route choice decides */
  boot?: boolean;
  /** not finished: pickable only under ?mids=wip or the mids=wip LAB row (src/lab.ts), so it can sit on main unseen */
  wip?: boolean;
}

// ---------------- the rows ----------------
// One block per LS2 lane, so lanes working at once each edit their own lines and rebase without a conflict. Order is
// load-bearing only among finished rows: the picker's draw walks them in ROSTER order, and within a pool the first
// finished row is that biome's home midboss. A `wip` row moves nothing (biomePool drops it), and un-wiping one is a
// re-baseline anyway. So: add a row at the end of your lane's block, and never reorder finished rows.

/** the midbosses that shipped before LS2: the four homes and the Saucer */
const CORE: readonly MidRow[] = [
  // nailbars orbit at 31 px and are 15 px half-long: the bars must stay shootable
  { k: 'choir', name: 'THE NAIL CHOIR', label: 'NAIL CHOIR', tag: 'LINE', pool: 'ice', min: 0, fit: { up: 46, dn: 46, hw: 34 } },
  // membrane rim 22 px x 1.25 swell; the crown sits at -23
  { k: 'cyst', name: 'THE DISSOLVING WOMB', label: 'DISS. WOMB', tag: 'SPACE', pool: 'acid', min: 0, fit: { up: 28, dn: 30, hw: 28 } },
  // carcass ellipse -18..24, head and spit point to -24, cleaver arm below
  { k: 'prentice', name: "THE BUTCHER'S APPRENTICE", label: 'APPRENTICE', tag: 'RANGE', pool: 'fire', min: 0, fit: { up: 30, dn: 30, hw: 18 } },
  // sac rim 21-24 px x 1.16 heave; eyes at -16. homeFit: her +-20% PH bob predates the Sinus walls and put a hittable part
  // of her inside them on 28% of on-screen frames (LS1 P0 matrix); the other three never clip at home
  { k: 'brood', name: 'THE BROOD MOTHER', label: 'BROOD MOM', tag: 'CROWD', pool: 'snot', min: 0, fit: { up: 28, dn: 28, hw: 26 }, homeFit: true },
  // Open Orbit slot A, its row's drift entry (src/layout.ts). boot: every descent flies Orbit
  { k: 'ufo', name: 'THE SQUIDFUCKED SAUCER', label: 'SQUID SAUCER', tag: 'DRIFT', pool: 'orbit', min: 0, boot: true },
];
/** LS2-ice: the Cryosleeper, the Hanging Spine */
const ICE: readonly MidRow[] = [];
/** LS2-acid */
const ACID: readonly MidRow[] = [];
/** LS2-fire */
const FIRE: readonly MidRow[] = [];
/** LS2-snot */
const SNOT: readonly MidRow[] = [];
/** LS2-orbit+ship: Open Orbit's and the ship's kinds */
const ORBIT_SHIP: readonly MidRow[] = [];

/** every midboss, in the order the picker walks (see above) */
export const ROSTER: readonly MidRow[] = [...CORE, ...ICE, ...ACID, ...FIRE, ...SNOT, ...ORBIT_SHIP];

/** the pools a biome stage draws from */
export const BIOME_POOLS: readonly string[] = ['ice', 'acid', 'fire', 'snot'];
/** a kind's row, or undefined */
export const midRow = (k: string): MidRow | undefined => ROSTER.find((r) => r.k === k);
/** every kind's name, wherever it fights */
export const MID_NAMES: Readonly<Record<string, string>> = Object.fromEntries(ROSTER.map((r) => [r.k, r.name]));
/** the biome-stage candidates in roster order: finished kinds, plus the WIP ones when the flag is on (src/lab.ts midsWip).
 *  Phase 1 of spec §6.3: a stage draws from every biome pool, home preferred; narrowing to the stage's own pool is a
 *  picker rule for when the pools are full, not a registry one */
export const biomePool = (wip = false, rows: readonly MidRow[] = ROSTER): string[] =>
  rows.filter((r) => BIOME_POOLS.includes(r.pool) && (wip || !r.wip)).map((r) => r.k);

// ---------------- what each kind's file registers ----------------
/** a kind's sim side, given to defineMid by src/enemies/mid/<kind>.ts */
export interface MidSim {
  /** its row in enemies/spawn.ts ET: hp, r, score, bio, gore; big, mini and mid set */
  et: Record<string, number>;
  /** the banner on its kill */
  word: string;
  /** its per-frame update, called by updEnemy. No allocation in here (.claude/rules/ai-code.md) */
  update: (e: any) => void;
  /** where midboss() brings it in, as a share of PH (default the middle) */
  spawnY?: number;
  /** midboss(): after the spawn, before it takes G.mini (the Choir's nailbars) */
  onSpawn?: (e: any) => void;
  /** killEnemy, after the kill word */
  kill?: (e: any) => void;
  /** the multiplier for d damage landing at (hx, hy), screen px like e.x, travelling dir (+1 rightward). 1 full, .15 a
   *  closed WINDOW, 0 a tink. For WINDOW and ANGLE kinds (spec §6.2). Every damage path asks it: shots, beams, blasts,
   *  burn, acid, the slick. Area damage (blasts, the nuke, burn, acid, the slick) arrives at exactly (e.x, e.y) with
   *  dir 0: decide what an area hit does on purpose. Pure: no allocation, no R(), no state written */
  hurt?: (e: any, d: number, hx: number, hy: number, dir: number) => number;
  /** once, on the frame the withdraw clock runs out (before it slides off): reset what the fight changed. Fired by midLeave
   *  (held kinds) and by the Saucer's own withdraw block (DRIFT); any kind with its own withdraw must call it too */
  leave?: (e: any) => void;
  /** killEnemy, when a child it spawned with `own: e` (and kid: 1) dies: a fire patch, a split, a count */
  kidKill?: (kid: any, owner: any) => void;
}
/** kind -> its sim side, filled as the kinds' files load (enemies/mid/index.ts loads them). Read at call time only */
export const MID_SIM: Record<string, MidSim> = Object.create(null); // no prototype: a kind is never `constructor`
/** the midboss rows of spawn.ts ET; ET is this same object, so a row lands whichever module the boot reaches first */
export const MID_ET: Record<string, any> = {};

/** the damage share a hit on e takes (MidSim.hurt): 1 for anything that isn't a midboss with a hurt hook. Every damage
 *  path multiplies by this, so armour never needs a shared-file edit */
export function midMul(e: any, d: number, hx: number, hy: number, dir: number): number {
  const h = e.mid ? MID_SIM[e.k]?.hurt : undefined;
  if (!h) return 1;
  const m = h(e, d, hx, hy, dir);
  return m > 0 ? m : 0; // NaN or undefined (a branch with no return) reads as a tink, never as NaN HP
}

/** what is wrong with the registry: a row with no sim file (no defineMid), a row with no art file, an art file with no
 *  row. Empty when sound. main.ts refuses to boot on any (render/gross/mid/index.ts checkMids) */
export function midProblems(rows: readonly MidRow[], sim: Readonly<Record<string, unknown>>, art: readonly string[]): string[] {
  return [
    ...rows.filter((r) => !sim[r.k]).map((r) => `${r.k} (no enemies/mid/${r.k}.ts defineMid)`),
    ...rows.filter((r) => !art.includes(r.k)).map((r) => `${r.k} (no render/gross/mid/${r.k}.ts)`),
    ...art.filter((k) => !rows.some((r) => r.k === k)).map((k) => `${k} (art with no roster row)`),
  ];
}

/** register a kind's sim side (each file in enemies/mid/ does, at load). A kind with no roster row is a bug: fail now */
export function defineMid(k: string, sim: MidSim): void {
  if (!midRow(k)) throw new Error(`midboss '${k}' has no row in enemies/mid/roster.ts ROSTER`);
  if (MID_SIM[k]) throw new Error(`midboss '${k}' is defined twice`);
  MID_SIM[k] = sim;
  MID_ET[k] = sim.et;
}
