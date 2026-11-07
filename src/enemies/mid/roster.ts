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

/** every midboss. The order is load-bearing: the picker's draw walks it, so a new row goes at the end, and within a pool
 *  the first finished row is that biome's home midboss */
export const ROSTER: readonly MidRow[] = [
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
}
/** kind -> its sim side, filled as the kinds' files load (enemies/mid/index.ts loads them). Read at call time only */
export const MID_SIM: Record<string, MidSim> = {};
/** the midboss rows of spawn.ts ET; ET is this same object, so a row lands whichever module the boot reaches first */
export const MID_ET: Record<string, any> = {};

/** register a kind's sim side (each file in enemies/mid/ does, at load). A kind with no roster row is a bug: fail now */
export function defineMid(k: string, sim: MidSim): void {
  if (!midRow(k)) throw new Error(`midboss '${k}' has no row in enemies/mid/roster.ts ROSTER`);
  if (MID_SIM[k]) throw new Error(`midboss '${k}' is defined twice`);
  MID_SIM[k] = sim;
  MID_ET[k] = sim.et;
}
