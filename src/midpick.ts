// =====================================================================
//  MIDBOSS PICKER (design/content-expansion.md §6.3, build plan row LS1-F0). Pure: no $, no G, no R().
//  The caller passes the descent, the run's midboss state and a random stream, and gets the picks back.
//  NOT WIRED YET: biomes.ts choose() still spawns B.mid. LS1-F (sprint 3) calls pickMids() from choose()/buildStage()
//  with the per-stage build stream Rs, stores the result in G.mb, and keeps G.mbUsed / G.mbLast with noteMids().
//
//  Steps, in order (spec §6.3):
//    1. descent gate     keep members with min <= L (L = G.loop, 0-based: Descent 1 is L 0)
//    2. no repeats       drop every kind AND every body already met this descent (G.mbUsed, reset in startLoop)
//    3. no repeat pair   drop this stage's previous pair (G.mbLast[b])
//    4. weight           1 / (1 + meta.mb[k]): a midboss never met comes first
//    5. draw             slot A, then slot B with a tag different from A's
//    6. fallback         too few left: relax 3, then 1. Step 2 is NEVER relaxed (Pillar 4: a repeat is a bug);
//                        if even that leaves too few, the stage gets fewer midbosses, never a repeat.
//  Phase 1 (before the new midbosses exist): every biome stage draws from the four existing biome midbosses and
//  prefers its home one for slot A, so a stage is home + one crossover. The home one is not guaranteed: when an
//  earlier stage this descent took it as a crossover, body exclusion removes it and the stage gets two crossovers.
// =====================================================================

/** the skill a midboss tests (spec §6.1); a pool never holds two members with the same tag */
export type MidTag = 'LINE' | 'SPACE' | 'RANGE' | 'CROWD' | 'WINDOW' | 'ANGLE' | 'RACE' | 'DRIFT';

export interface MidDef {
  /** the art and hitbox it uses; a recolour or crossover shares its parent's body, and step 2 excludes by body too */
  body: string;
  tag: MidTag;
  /** first descent it can appear in, 0-based like G.loop (ANGLE and RACE members are 1: never in Descent 1) */
  min: number;
}

/** the midbosses that exist today, keyed by the kind midboss()/ufoWarn() spawn. LS2 lanes add rows here */
export const MIDS: Record<string, MidDef> = {
  choir: { body: 'choir', tag: 'LINE', min: 0 }, //       THE NAIL CHOIR, ice home
  cyst: { body: 'cyst', tag: 'SPACE', min: 0 }, //        THE DISSOLVING WOMB, acid home
  prentice: { body: 'prentice', tag: 'RANGE', min: 0 }, // THE BUTCHER'S APPRENTICE, fire home
  brood: { body: 'brood', tag: 'CROWD', min: 0 }, //      THE BROOD MOTHER, snot home
  ufo: { body: 'ufo', tag: 'DRIFT', min: 0 }, //          THE SQUIDFUCKED SAUCER, Open Orbit slot A
};

/** each biome's own midboss; must match BIOMES[b].mid in biomes.ts (biomes.ts imports canvas/audio, so LS1-F wiring asserts this when it reads both) */
export const HOME: Record<string, string> = { ice: 'choir', acid: 'cyst', fire: 'prentice', snot: 'brood' };

/** phase 1: a biome stage draws from all four existing biome midbosses (home + crossovers) */
export const PHASE1_BIOME_POOL: readonly string[] = ['choir', 'cyst', 'prentice', 'brood'];

/** which relaxations the fallback needed: 0 none, 1 step 3 relaxed, 2 steps 3 and 1 relaxed. Step 2 has no level */
export type Relaxed = 0 | 1 | 2;

export interface PickIn {
  /** candidate kinds in a fixed order (the draw walks this order, so it must not depend on object key order) */
  pool: readonly string[];
  /** descent, 0-based (G.loop) */
  L: number;
  /** midbosses wanted: 2 for a biome or interior stage, 1 for a single slot */
  n?: 1 | 2;
  /** kinds already met this descent (G.mbUsed) */
  used: readonly string[];
  /** this stage's previous pair (G.mbLast[b]) */
  last?: readonly string[];
  /** times met across runs ($.meta.mb) */
  met?: Readonly<Record<string, number>>;
  /** seeded runs (D10) ignore meta.mb. A hook only: every caller passes false today, so D10 never changes the picker */
  ignoreMeta?: boolean;
  /** phase 1: the home midboss, taken as slot A whenever it survives the rules */
  prefer?: string;
  /** the per-stage build stream (Rs), a [0, 1) generator */
  rng: () => number;
  /** roster override for tests and future pools; defaults to MIDS */
  defs?: Readonly<Record<string, MidDef>>;
}

export interface PickOut {
  /** [slot A, slot B]; shorter than n only when step 2 leaves too few, never padded with a repeat */
  picks: string[];
  relaxed: Relaxed;
}

/** weight of one candidate (step 4) */
export function midWeight(k: string, met: Readonly<Record<string, number>> | undefined, ignoreMeta = false): number {
  if (ignoreMeta || !met) return 1;
  const m = +met[k] || 0;
  return 1 / (1 + Math.max(0, m));
}

/** weighted draw over xs in order; one rng() call */
function draw(xs: readonly string[], w: (k: string) => number, rng: () => number): string {
  let tot = 0;
  for (const k of xs) tot += w(k);
  let u = rng() * tot;
  for (const k of xs) {
    u -= w(k);
    if (u < 0) return k;
  }
  return xs[xs.length - 1]; // rng() rounding at the top end
}

/** pick a stage's midbosses (spec §6.3). Pure; draws only from in.rng */
export function pickMids(p: PickIn): PickOut {
  const defs = p.defs || MIDS, n = p.n ?? 2, last = p.last || [];
  const w = (k: string) => midWeight(k, p.met, p.ignoreMeta);
  // step 2, never relaxed: kinds and bodies met this descent
  const usedBodies = new Set(p.used.map(k => (defs[k] ? defs[k].body : k)));
  const fresh = p.pool.filter(k => defs[k] && !p.used.includes(k) && !usedBodies.has(defs[k].body));
  const gate = (k: string) => defs[k].min <= p.L, notLast = (k: string) => !last.includes(k);
  const levels: string[][] = [
    fresh.filter(k => gate(k) && notLast(k)), // 0: all rules
    fresh.filter(gate), //                       1: step 3 relaxed
    fresh, //                                    2: steps 3 and 1 relaxed
  ];
  // slot A must leave slot B a candidate with a different tag and a different body
  const partners = (c: string[], a: string) => c.filter(k => k !== a && defs[k].body !== defs[a].body && defs[k].tag !== defs[a].tag);
  const slotA = (c: string[]) => (n === 1 ? c : c.filter(a => partners(c, a).length > 0));
  let r: Relaxed = 0;
  while (r < 2 && slotA(levels[r]).length === 0) r = (r + 1) as Relaxed;
  const C = levels[r], As = slotA(C);
  if (As.length === 0) {
    // not even step 2's leftovers make a full set: fewer midbosses rather than a repeat
    return { picks: C.length ? [draw(C, w, p.rng)] : [], relaxed: r };
  }
  const a = p.prefer && As.includes(p.prefer) ? p.prefer : draw(As, w, p.rng);
  if (n === 1) return { picks: [a], relaxed: r };
  return { picks: [a, draw(partners(C, a), w, p.rng)], relaxed: r };
}

/** the run's midboss memory: G.mbUsed (this descent) and G.mbLast (per stage key, whole run) */
export interface MidState {
  mbUsed: string[];
  mbLast: Record<string, string[]>;
}

/** record a stage's picks: they count as met for the rest of the descent and become the stage's previous pair */
export function noteMids(st: MidState, key: string, picks: readonly string[]): void {
  st.mbUsed.push(...picks);
  st.mbLast[key] = picks.slice();
}

/** startLoop: a new descent forgets what it met, but each stage's previous pair carries over */
export function newDescentMids(st: MidState): void {
  st.mbUsed = [];
}

/** phase 1 biome stage: home preferred, crossovers from the other three existing biome midbosses */
export function pickBiomeMids(st: MidState, b: string, L: number, rng: () => number, met?: Readonly<Record<string, number>>, ignoreMeta = false): PickOut {
  const out = pickMids({ pool: PHASE1_BIOME_POOL, L, used: st.mbUsed, last: st.mbLast[b], met, ignoreMeta, prefer: HOME[b], rng });
  noteMids(st, b, out.picks);
  return out;
}
