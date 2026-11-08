// =====================================================================
//  MIDBOSS PICKER (design/content-expansion.md §6.3, build plan row LS1-F0). Pure: no $, no G, no R().
//  The caller passes the descent, the run's midboss state and a random stream, and gets the picks back.
//  WIRED (LS1-F) on layouts with `picker` set (long4, the default since D24): biomes.ts choose() calls pickBiomeMids() with
//  rng = midStream(i) (biomes.ts; seed src/rng.ts midSeedOf), NEVER stageStream(i): the pick has its own stream
//  per stage, so it is the same whatever the script drew and wherever in the build it runs. It stores the result in
//  G.mb[stage], and keeps G.mbUsed / G.mbLast with noteMids(). The short layout keeps one home midboss per biome stage.
//
//  Steps, in order (spec §6.3):
//    1. descent gate     keep members with min <= L (L = G.loop, 0-based: Descent 1 is L 0)
//    2. no repeats       drop every kind AND every body already met this descent (G.mbUsed, reset in startLoop)
//    3. no repeat pair   ban only the exact previous pair (G.mbLast[b], any order): with a two-member last, slot A
//                        may be either member, but then slot B may not be the other. A single slot (n = 1) drops
//                        last[0]. A last of any other length bans nothing
//    4. weight           1 / (1 + clamp(met - m0, 0, MID_PICK.cap)), m0 = the lowest meta.mb among the candidates
//                        in that draw: a midboss behind the others leads, by at most 3:1
//    5. draw             slot A (the preferred home when it survives), then slot B with a tag different from A's
//    6. fallback         no full set left: relax 3 (relaxed 1: the previous pair was the only full set under the
//                        gate), then 1 (relaxed 2). Step 2 is NEVER relaxed (Pillar 4: a repeat is a bug); if even
//                        that leaves too few, the stage gets fewer midbosses, never a repeat.
//  Phase 1 (before the new midbosses exist): every biome stage draws from the four existing biome midbosses and
//  prefers its home one for slot A, so a stage is home + one crossover. The home one is not guaranteed: when an
//  earlier stage this descent took it as a crossover, body exclusion removes it and the stage gets two crossovers.
// =====================================================================

import { BIOME_POOLS, ROSTER, biomePool, type MidRow, type MidTag } from './enemies/mid/roster';
export type { MidTag };

export interface MidDef {
  /** the art and hitbox it uses; a recolour or crossover shares its parent's body, and step 2 excludes by body too */
  body: string;
  tag: MidTag;
  /** first descent it can appear in, 0-based like G.loop (ANGLE and RACE members are 1: never in Descent 1) */
  min: number;
}

/** every midboss by kind, WIP ones too (a run saved under the flag must still load): enemies/mid/roster.ts is the list */
export const MIDS: Record<string, MidDef> = Object.fromEntries(ROSTER.map((r: MidRow) => [r.k, { body: r.body ?? r.k, tag: r.tag, min: r.min }]));

/** each biome's own midboss: the first finished row of its pool. Its keys are the biome list runsave.ts and jump.ts read */
export const HOME: Record<string, string> = Object.fromEntries(BIOME_POOLS.map((b) => {
  const r = ROSTER.find((r) => r.pool === b && !r.wip);
  if (!r) throw new Error(`midboss roster: pool '${b}' has no finished row, so the biome has no home midboss`);
  return [b, r.k];
}));

/** phase 1: a biome stage draws from every finished biome-pool midboss (home + crossovers) */
export const PHASE1_BIOME_POOL: readonly string[] = biomePool();

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
  /** the stage's midboss-pick stream, biomes.ts midStream(i) (never the script's stageStream(i)), a [0, 1) generator */
  rng: () => number;
  /** roster override for tests and future pools; defaults to MIDS */
  defs?: Readonly<Record<string, MidDef>>;
}

export interface PickOut {
  /** [slot A, slot B]; shorter than n only when step 2 leaves too few, never padded with a repeat */
  picks: string[];
  relaxed: Relaxed;
}

/** step 4 tuning (#15). cap: the most a kind's lead over the least-met candidate counts, so a never-met kind gets a
 *  3:1 lead, not a monopoly. Safe range 1-3; 0 makes every draw uniform. Measured by the pair-rotation sweep in
 *  tests/unit/midpick.test.ts */
export const MID_PICK = { cap: 2 };

/** times met, sanitised: NaN, negative, Infinity and missing all count as never met */
const metOf = (k: string, met: Readonly<Record<string, number>>) => (Number.isFinite(+met[k]) ? Math.max(0, +met[k]) : 0);

/** weight of one candidate (step 4): floor is m0, the lowest count among the candidates in the same draw */
export function midWeight(k: string, met: Readonly<Record<string, number>> | undefined, ignoreMeta = false, floor = 0): number {
  if (ignoreMeta || !met) return 1;
  return 1 / (1 + Math.min(MID_PICK.cap, Math.max(0, metOf(k, met) - floor)));
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
  // step 2, never relaxed: kinds and bodies met this descent
  const usedBodies = new Set(p.used.map(k => (defs[k] ? defs[k].body : k)));
  const fresh = p.pool.filter(k => defs[k] && !p.used.includes(k) && !usedBodies.has(defs[k].body));
  const G = fresh.filter(k => defs[k].min <= p.L); // step 1
  // slot B must differ from A in kind, body and tag
  const partners = (c: readonly string[], a: string) => c.filter(k => k !== a && defs[k].body !== defs[a].body && defs[k].tag !== defs[a].tag);
  // step 3: only the exact previous pair. Slot A may be either member; slot B is then not the other one
  const ban = (a: string) => (last.length === 2 && last.includes(a) ? last[last.indexOf(a) ^ 1] : null);
  interface Level { C: readonly string[]; As: readonly string[]; part: (a: string) => string[] }
  const plain = (C: readonly string[]): Level => ({ C, As: n === 1 ? C : C.filter(a => partners(C, a).length > 0), part: (a) => partners(C, a) });
  let level0: Level;
  if (n === 1) {
    const C0 = last.length === 1 ? G.filter(k => k !== last[0]) : G;
    level0 = { C: C0, As: C0, part: () => [] };
  } else {
    const part0 = (a: string) => partners(G, a).filter(k => k !== ban(a));
    level0 = { C: G, As: G.filter(a => part0(a).length > 0), part: part0 };
  }
  const levels: Level[] = [level0, plain(G), plain(fresh)]; // 0 all rules, 1 step 3 relaxed, 2 steps 3 and 1 relaxed
  let r: Relaxed = 0;
  while (r < 2 && levels[r].As.length === 0) r = (r + 1) as Relaxed;
  const { C, As, part } = levels[r];
  // step 4 (spec §6.3): each draw floors at m0, the lowest meta.mb among the candidates still in THAT draw (As for
  // slot A, A's partners for slot B, C for the fallback). Still one rng() call per draw
  const pick = (xs: readonly string[]) => {
    const met = p.met;
    const m0 = !p.ignoreMeta && met && xs.length ? Math.min(...xs.map(k => metOf(k, met))) : 0;
    return draw(xs, (k) => midWeight(k, met, p.ignoreMeta, m0), p.rng);
  };
  if (As.length === 0) {
    // not even step 2's leftovers make a full set: fewer midbosses rather than a repeat
    return { picks: C.length ? [pick(C)] : [], relaxed: r };
  }
  const a = p.prefer && As.includes(p.prefer) ? p.prefer : pick(As);
  if (n === 1) return { picks: [a], relaxed: r };
  return { picks: [a, pick(part(a))], relaxed: r };
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

/** phase 1 biome stage: home preferred, crossovers from the other biome midbosses. wip: the ?mids=wip flag (src/lab.ts
 *  midsWip), which lets the unfinished kinds in */
export function pickBiomeMids(st: MidState, b: string, L: number, rng: () => number, met?: Readonly<Record<string, number>>, ignoreMeta = false, wip = false): PickOut {
  const out = pickMids({ pool: biomePool(wip), L, used: st.mbUsed, last: st.mbLast[b], met, ignoreMeta, prefer: HOME[b], rng });
  noteMids(st, b, out.picks);
  return out;
}

// ---------------- slot clocks and the fork rule (spec §6.4, §6.5; LS1-F) ----------------
/** midboss leave clocks in frames (spec §6.4; was 1400 f for every midboss, which the short layout keeps). Every kind
 *  has one 8-11 s TTK band (D27); slot B's longer clock is its only slot difference. The clocks cap the worst-case
 *  stage (spec §3.1). Measured by midboss-probe --layout long4 --leave 1080/1260. A DRIFT member also has its
 *  forced-exit x (layout beats.driftLead): whichever first */
export const MID_CLOCK = {
  slot: [1080, 1260] as readonly number[], // slot A 18 s, slot B 21 s: caps the worst-case stage (spec §3.1 table)
  race: 900, //                              RACE members (wave 2): they escalate, so the fight is kept short
};
/** the leave clock of midboss k in slot s (0 = A, 1 = B) */
export function slotClock(k: string, s: number, defs: Readonly<Record<string, MidDef>> = MIDS): number {
  const c = MID_CLOCK.slot[Math.min(s, MID_CLOCK.slot.length - 1)];
  return defs[k] && defs[k].tag === 'RACE' ? Math.min(c, MID_CLOCK.race) : c;
}

/** biomes whose stage boss is the Maw body: the interim rule of spec §6.5 keeps them out of the same descent (with
 *  the Orbit Maw that would be three Maws in one descent, against Pillar 4) */
export const MAW_BIOMES: readonly string[] = ['acid', 'snot'];
/** may biome b be offered at a fork, given the descent's route so far (G.route)? */
export const forkAllows = (b: string, route: readonly (string | null)[]) => !MAW_BIOMES.includes(b) || !route.some((r) => r !== b && r != null && MAW_BIOMES.includes(r));
