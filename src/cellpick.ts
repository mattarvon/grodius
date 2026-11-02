// =====================================================================
//  CELL PICKER and FILLER GENERATOR for the long Open Orbit and Gravity Drive approach (design/content-expansion.md
//  §3.4 "Authoring method"; build plan LS1 row E). Pure: no $, no G, no R() — the caller passes the descent, the
//  run's cell memory and a random stream, and gets ids / a kind list back. scripts.ts owns the cells' content and
//  turns the ids and kinds into spawns.
//
//  A long stage is a row `plan` (src/layout.ts): tagged cell slots (`intro`, `build`, `peak`, and the Drive's
//  `floor`, the one slot where the corridor still has a floor for mutants) plus filler windows that the generator
//  fills from a mix table. pickV's per-section rules (scripts.ts) move down to the cell:
//    1. eligible      the slot's tag, and min <= L (L = G.loop, 0-based)
//    2. no repeats    never a cell already placed this descent. NEVER relaxed: a slot with no candidate stays empty
//    3. never last    prefer cells not in last descent's set
//    4. fresh         among those, prefer cells not seen this run
//    5. draw          uniform over the best non-empty tier; `relaxed` counts slots that fell back past rule 3
//  Descent 1 may start on a fixed opener (Orbit's teaching cells, about 15 s): the same ids in the same order on
//  every seed, with no draw. The opener cells carry min 2, so they come back as ordinary cells from Descent 3.
//
//  Streams: until build plan item B2 lands, `rnd` is the sim R() at build time (as pickV does today); B2 swaps in the
//  per-stage build stream Rs. Only the long layouts call this, so the short layout's draws are untouched.
// =====================================================================

export type CellTag = 'intro' | 'build' | 'peak' | 'floor';

export interface CellDef {
  id: string;
  /** slots this cell may fill (single-tagged today: an exact partition keeps rule 3 satisfiable, see the tests) */
  tags: readonly CellTag[];
  /** first descent it can be drawn in, 0-based like G.loop */
  min: number;
}

/** per stage kind, kept across descents in G.remixV (saved with the run, src/runsave.ts) */
export interface CellMem {
  /** every cell placed this run */
  used: string[];
  /** the cells placed last descent */
  last: string[];
}

export interface CellPick {
  /** one id per slot, null when rule 2 left no candidate (the slot stays empty, never a repeat) */
  ids: (string | null)[];
  /** slots whose pick had to fall back past rule 3 (a cell from last descent); 0 in a healthy pool */
  relaxed: number;
}

/** pick one cell per slot for descent L. Does not touch mem: commit the result with noteCells() */
export function pickCells(pool: readonly CellDef[], slots: readonly CellTag[], L: number, mem: CellMem, rnd: () => number, opener: readonly string[] = []): CellPick {
  const ids: (string | null)[] = [], cur = new Set<string>();
  let relaxed = 0;
  slots.forEach((tag, i) => {
    if (L === 0 && i < opener.length) { ids.push(opener[i]); cur.add(opener[i]); return; } // the fixed teaching opener
    const ok = pool.filter((c) => c.tags.includes(tag) && c.min <= L && !cur.has(c.id));
    const notLast = ok.filter((c) => !mem.last.includes(c.id)), fresh = notLast.filter((c) => !mem.used.includes(c.id));
    const tier = fresh.length ? fresh : notLast.length ? notLast : ok;
    if (!tier.length) { ids.push(null); return; }
    if (tier === ok && notLast.length === 0) relaxed++;
    const c = tier[Math.min(tier.length - 1, Math.floor(rnd() * tier.length))];
    ids.push(c.id);
    cur.add(c.id);
  });
  return { ids, relaxed };
}

/** commit a descent's picks: they become `last`, and join `used` */
export function noteCells(mem: CellMem, ids: readonly (string | null)[]) {
  const got = ids.filter((x): x is string => !!x);
  mem.last = [...got];
  for (const id of got) if (!mem.used.includes(id)) mem.used.push(id);
}

// ---------------- filler ----------------
/** the filler kinds the generator can place; scripts.ts maps each to a spawn call */
export type FillKind = 'drones' | 'sentry' | 'corpse' | 'flayer' | 'hatch' | 'mutant' | 'crawler' | 'womb' | 'eyes';
export type Mix = Partial<Record<FillKind, number>>;

/** the interior mix (spec §3.4): drones at about 30%, the rest the ship's own. mutant/crawler/womb/eyes need a floor,
 *  ceiling or wall, and their spawn helpers skip quietly where there is none */
export const INTERIOR_MIX: Mix = { drones: .3, sentry: .14, corpse: .14, flayer: .12, hatch: .1, mutant: .06, crawler: .06, womb: .04, eyes: .04 };
/** Open Orbit is open space, no terrain: the interior mix without the terrain kinds, drones still about 30% */
export const ORBIT_MIX: Mix = { drones: .3, sentry: .2, corpse: .2, flayer: .14, hatch: .16 };

/** a weighted draw from a mix table (keys in insertion order, so the draw is deterministic for a given rnd) */
export function mixPick(mix: Mix, u: number): FillKind {
  const ks = Object.keys(mix) as FillKind[], tot = ks.reduce((s, k) => s + mix[k]!, 0);
  let acc = 0;
  for (const k of ks) { acc += mix[k]! / tot; if (u < acc) return k; }
  return ks[ks.length - 1];
}

export interface FillBeat { x: number; k: FillKind; u: number }
/** filler beats over [a, b): one every `gap` px, each jittered by up to ±15% of the gap, kinds drawn from `mix`.
 *  `u` is a spare uniform the caller uses for y and side */
export function genFiller(a: number, b: number, gap: number, mix: Mix, rnd: () => number): FillBeat[] {
  const out: FillBeat[] = [];
  for (let x = a; x < b; x += gap) {
    const jx = Math.round(x + (rnd() * 2 - 1) * gap * .15), xx = Math.min(b - 1, Math.max(a, jx));
    out.push({ x: xx, k: mixPick(mix, rnd()), u: rnd() });
  }
  return out;
}
