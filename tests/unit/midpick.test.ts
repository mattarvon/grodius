import { describe, expect, it } from 'vitest';
import { HOME, MIDS, PHASE1_BIOME_POOL, midWeight, newDescentMids, noteMids, pickBiomeMids, pickMids, type MidDef, type MidState } from '../../src/midpick';

// LS1-F0, design/content-expansion.md §6.3. The picker is pure and not wired yet; these tests drive it with a
// seeded stream the way choose()/buildStage() will, through simulated runs.

/** mulberry32: a small seeded [0, 1) stream so every run of this suite draws the same numbers */
function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BIOME_KEYS = Object.keys(HOME);
const RUNS = 1000, DESCENTS_PER_RUN = 10; // 10,000 simulated descents
const fresh = (): MidState => ({ mbUsed: [], mbLast: {} });

describe('roster', () => {
  it('keeps HOME in step with the four existing biome midbosses', () => {
    expect(Object.values(HOME).sort()).toEqual([...PHASE1_BIOME_POOL].sort());
    for (const k of PHASE1_BIOME_POOL) expect(MIDS[k]).toBeDefined();
  });

  it('gives every phase-1 pool member a different tag and body', () => {
    const tags = PHASE1_BIOME_POOL.map(k => MIDS[k].tag), bodies = PHASE1_BIOME_POOL.map(k => MIDS[k].body);
    expect(new Set(tags).size).toBe(PHASE1_BIOME_POOL.length);
    expect(new Set(bodies).size).toBe(PHASE1_BIOME_POOL.length);
  });
});

describe('10k simulated descents, phase 1 (Orbit -> biome A -> biome B -> Drive)', () => {
  // A run: Orbit always meets the Saucer (single slot), then two forks each pick any biome (a biome may repeat
  // inside a descent, the hardest case for step 2), and meta.mb accumulates across runs so step 4 is exercised.
  const stats = { stages: 0, repeats: 0, sameTag: 0, short: 0, relax1: 0, relax2: 0, crossCase: 0, crossBad: 0, homeMissedWhenFree: 0 };
  const met: Record<string, number> = {};
  const seen = new Map<string, number>();
  const rng = rngOf(0xf0);
  for (let run = 0; run < RUNS; run++) {
    const st = fresh();
    for (let L = 0; L < DESCENTS_PER_RUN; L++) {
      newDescentMids(st);
      const orbit = pickMids({ pool: ['ufo'], L, n: 1, used: st.mbUsed, last: st.mbLast.orbit, met, rng });
      noteMids(st, 'orbit', orbit.picks);
      const bodies: string[] = orbit.picks.map(k => MIDS[k].body);
      const route = [BIOME_KEYS[Math.floor(rng() * 4)], BIOME_KEYS[Math.floor(rng() * 4)]];
      let firstPicks: string[] = [];
      route.forEach((b, slot) => {
        const homeFree = !st.mbUsed.includes(HOME[b]) && !(st.mbLast[b] || []).includes(HOME[b]);
        const out = pickBiomeMids(st, b, L, rng, met);
        stats.stages++;
        if (out.picks.length !== 2) stats.short++;
        if (out.relaxed === 1) stats.relax1++;
        if (out.relaxed === 2) stats.relax2++;
        const [a, bb] = out.picks;
        if (a && bb && MIDS[a].tag === MIDS[bb].tag) stats.sameTag++;
        for (const k of out.picks) {
          if (bodies.includes(MIDS[k].body)) stats.repeats++;
          bodies.push(MIDS[k].body);
          met[k] = (met[k] || 0) + 1;
          seen.set(`${b}:${k}`, (seen.get(`${b}:${k}`) || 0) + 1);
        }
        if (homeFree && a !== HOME[b]) stats.homeMissedWhenFree++;
        // biome A took biome B's home midboss as its crossover: B must get two different crossovers
        if (slot === 1 && route[0] !== b && firstPicks.includes(HOME[b])) {
          stats.crossCase++;
          const ok = out.picks.length === 2 && a !== bb && !out.picks.includes(HOME[b]) && !out.picks.some(k => firstPicks.includes(k));
          if (!ok) stats.crossBad++;
        }
        if (slot === 0) firstPicks = out.picks.slice();
      });
    }
  }

  it('never repeats a body within a descent', () => expect(stats.repeats).toBe(0));
  it('always gives slot B a different tag from slot A', () => expect(stats.sameTag).toBe(0));
  it('never needs step 2 relaxed: every biome stage gets two midbosses', () => {
    expect(stats.stages).toBe(RUNS * DESCENTS_PER_RUN * 2);
    expect(stats.short).toBe(0);
  });
  it('never relaxes the descent gate in phase 1 (every existing midboss is min 0)', () => expect(stats.relax2).toBe(0));
  it('gives biome B two different crossovers when biome A took its home midboss', () => {
    expect(stats.crossCase).toBeGreaterThan(500); // spec: about 1 route in 3 across distinct-biome routes
    expect(stats.crossBad).toBe(0);
  });
  it('takes the home midboss as slot A whenever the rules leave it free', () => expect(stats.homeMissedWhenFree).toBe(0));
  it('meets every existing midboss in every biome', () => {
    for (const b of BIOME_KEYS) for (const k of PHASE1_BIOME_POOL) expect(seen.get(`${b}:${k}`) || 0).toBeGreaterThan(0);
  });
  it('reports how often step 3 was relaxed (observation, not a gate)', () => {
    // a second visit to a biome in the same run often has its previous pair and this descent's picks covering 3+ of 4
    expect(stats.relax1).toBeGreaterThanOrEqual(0);
    console.log(`[midpick] stages ${stats.stages}, step-3 relaxed ${stats.relax1}, gate relaxed ${stats.relax2}, crossover case ${stats.crossCase}`);
  });
});

// A wave-1 shaped roster (pools of 4, one tag each, ANGLE gated to Descent 2): the shape LS2 will fill in.
const W1: Record<string, MidDef> = {
  i1: { body: 'i1', tag: 'LINE', min: 0 }, i2: { body: 'i2', tag: 'WINDOW', min: 0 }, i3: { body: 'i3', tag: 'ANGLE', min: 1 }, i4: { body: 'i4', tag: 'DRIFT', min: 0 },
  a1: { body: 'a1', tag: 'SPACE', min: 0 }, a2: { body: 'a2', tag: 'WINDOW', min: 0 }, a3: { body: 'a3', tag: 'ANGLE', min: 1 }, a4: { body: 'a4', tag: 'RACE', min: 1 },
};
const W1_POOLS: Record<string, string[]> = { ice: ['i1', 'i2', 'i3', 'i4'], acid: ['a1', 'a2', 'a3', 'a4'] };

describe('pickMids rules', () => {
  it('gates by descent: Descent 1 never shows a min-1 member', () => {
    const rng = rngOf(1);
    for (let i = 0; i < 2000; i++) {
      const { picks, relaxed } = pickMids({ pool: W1_POOLS.acid, L: 0, used: [], rng, defs: W1 });
      expect(relaxed).toBe(0);
      expect(picks.sort()).toEqual(['a1', 'a2']);
    }
  });

  it('excludes by body as well as by kind (a recolour shares its parent body)', () => {
    const defs = { ...W1, i1r: { body: 'i1', tag: 'SPACE' as const, min: 0 } };
    const rng = rngOf(2);
    for (let i = 0; i < 500; i++) {
      const { picks } = pickMids({ pool: ['i1r', 'i2', 'i4'], L: 0, used: ['i1'], rng, defs });
      expect(picks).not.toContain('i1r');
    }
  });

  it('relaxes step 3 before step 1', () => {
    // previous pair leaves only i4 eligible at L 0; dropping step 3 is enough, so the gated i3 stays out
    const out = pickMids({ pool: W1_POOLS.ice, L: 0, used: [], last: ['i1', 'i2'], rng: rngOf(3), defs: W1 });
    expect(out.relaxed).toBe(1);
    expect(out.picks).not.toContain('i3');
    expect(out.picks).toHaveLength(2);
  });

  it('relaxes the gate only when step 3 alone is not enough', () => {
    const out = pickMids({ pool: W1_POOLS.ice, L: 0, used: ['i1', 'i2'], rng: rngOf(4), defs: W1 });
    expect(out.relaxed).toBe(2);
    expect(out.picks.sort()).toEqual(['i3', 'i4']);
  });

  it('never relaxes step 2: returns fewer midbosses rather than a repeat', () => {
    expect(pickMids({ pool: W1_POOLS.ice, L: 3, used: ['i1', 'i2', 'i3'], rng: rngOf(5), defs: W1 })).toEqual({ picks: ['i4'], relaxed: 2 });
    expect(pickMids({ pool: W1_POOLS.ice, L: 3, used: ['i1', 'i2', 'i3', 'i4'], rng: rngOf(5), defs: W1 })).toEqual({ picks: [], relaxed: 2 });
  });

  it('never pairs two members with the same tag, even when the pool would allow it', () => {
    const defs: Record<string, MidDef> = { x: { body: 'x', tag: 'LINE', min: 0 }, y: { body: 'y', tag: 'LINE', min: 0 }, z: { body: 'z', tag: 'SPACE', min: 0 } };
    const rng = rngOf(6);
    for (let i = 0; i < 1000; i++) {
      const { picks } = pickMids({ pool: ['x', 'y', 'z'], L: 0, used: [], rng, defs });
      expect(picks).toContain('z');
    }
    expect(pickMids({ pool: ['x', 'y'], L: 0, used: [], rng, defs }).picks).toHaveLength(1);
  });

  it('weights by 1 / (1 + times met): the unmet member is drawn about 4x as often as one met 3 times', () => {
    expect(midWeight('a', { a: 3 })).toBe(0.25);
    expect(midWeight('a', {})).toBe(1);
    const defs: Record<string, MidDef> = { p: { body: 'p', tag: 'LINE', min: 0 }, q: { body: 'q', tag: 'SPACE', min: 0 } };
    const rng = rngOf(7);
    let p = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) if (pickMids({ pool: ['p', 'q'], L: 0, n: 1, used: [], met: { q: 3 }, rng, defs }).picks[0] === 'p') p++;
    expect(p / N).toBeGreaterThan(0.78); // expected 0.8
    expect(p / N).toBeLessThan(0.82);
  });

  it('ignoreMeta draws as if nothing had been met (the D10 hook)', () => {
    for (let s = 0; s < 200; s++) {
      const a = pickMids({ pool: W1_POOLS.ice, L: 2, used: [], met: { i1: 9, i2: 4 }, ignoreMeta: true, rng: rngOf(s), defs: W1 });
      const b = pickMids({ pool: W1_POOLS.ice, L: 2, used: [], rng: rngOf(s), defs: W1 });
      expect(a).toEqual(b);
    }
  });

  it('is deterministic for a given stream', () => {
    const run = (seed: number) => {
      const st = fresh(), rng = rngOf(seed), out: string[][] = [];
      for (let L = 0; L < 5; L++) {
        newDescentMids(st);
        for (const b of ['ice', 'fire']) out.push(pickBiomeMids(st, b, L, rng).picks);
      }
      return out;
    };
    expect(run(42)).toEqual(run(42));
  });

  it('carries the previous pair across descents but forgets what was met', () => {
    const st = fresh();
    noteMids(st, 'ice', ['choir', 'cyst']);
    newDescentMids(st);
    expect(st.mbUsed).toEqual([]);
    expect(st.mbLast.ice).toEqual(['choir', 'cyst']);
  });
});

describe('wave-1 shape: pools of 4, 10k descents', () => {
  it('first two visits to a biome in a run share no midboss, with no repeats and distinct tags', () => {
    const rng = rngOf(0x41);
    let overlap = 0, repeats = 0, sameTag = 0, short = 0;
    for (let run = 0; run < 2000; run++) {
      const st = fresh(), met: Record<string, number> = {}, visits: Record<string, string[][]> = {};
      for (let L = 0; L < 5; L++) {
        newDescentMids(st);
        for (const b of ['ice', 'acid']) {
          const { picks } = pickMids({ pool: W1_POOLS[b], L, used: st.mbUsed, last: st.mbLast[b], met, rng, defs: W1 });
          if (picks.length !== 2) short++;
          if (picks.some(k => st.mbUsed.includes(k))) repeats++;
          if (W1[picks[0]].tag === W1[picks[1]].tag) sameTag++;
          noteMids(st, b, picks);
          for (const k of picks) met[k] = (met[k] || 0) + 1;
          (visits[b] ||= []).push(picks);
        }
      }
      for (const b in visits) if (visits[b][1].some(k => visits[b][0].includes(k))) overlap++;
    }
    expect({ overlap, repeats, sameTag, short }).toEqual({ overlap: 0, repeats: 0, sameTag: 0, short: 0 });
  });
});
