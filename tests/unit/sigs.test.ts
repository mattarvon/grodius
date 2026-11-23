// The biome signatures' tuning table (src/sigs.ts; DIFFICULTY-SPEC §2.4, levels.md §1 and §5): the space rules S2-S6 on
// every number, the plan that fits three escalating variations into the D31 band, and the window registry the probes read.
import { describe, expect, it } from 'vitest';
import {
  FURNACE, GRILL, GULLET, HAZ, ICICLE, SIG, SOLID_KILLS, INSET, INSET_MID, MORGUE, PH, SPACE, SWALLOW, TIDE, envelope, grillCols, grillLen,
  hazRankMul, insetOf, morgueLane, planSig, setSigWindows, sigAt, sigCheckpoints, sigWindows, throatInset, tideLen, tideLevel,
} from '../../src/sigs';
import { MID_DROP, midsWanted, pickBiomeMids } from '../../src/midpick';

const BIOMES = ['ice', 'acid', 'fire', 'snot'];
// long4's movement-B band start and limits as beatPlan gives them (layout.ts; early and late gate), slot A (next midboss
// WARNING - 40) and slot B (THE KEEPSAKE stage: breath 2's start + 150)
const BANDS: [number, number, number][] = [[0, 9010, 10485], [0, 9042, 10502], [1, 15227, 16846], [1, 15342, 16917]];

describe('space rules on the tuning table', () => {
  it('S4: every tell is at least 44 f, and the signature is seen 120 f before it reaches the ship', () => {
    for (const t of [MORGUE.tell, TIDE.tell, GRILL.warm, SWALLOW.tell, SWALLOW.plug.grow]) expect(t).toBeGreaterThanOrEqual(SPACE.tell);
    // a block is seen from its tell, enters at the right edge and flies at 2.2 px/f to its turn >= 120 px ahead of the
    // ship (it never flies on into the ship's x): for the nominal ship at x 150, tell + flight >= 120 f
    expect(MORGUE.tell + (480 + MORGUE.enter - Math.max(150 + MORGUE.stopLead, MORGUE.stopMin)) / MORGUE.vx).toBeGreaterThanOrEqual(SPACE.sigLead);
    // a grill column warms GRILL.lead px ahead of the ship, after the column has crossed the screen from x 480
    expect(GRILL.warm).toBeGreaterThanOrEqual(SPACE.tell);
  });
  it('S2: no terrain edge moves faster than .5 px/f (tide rise and drain, the throat clench)', () => {
    for (const V of TIDE.vars) { expect(V.d / V.rise).toBeLessThanOrEqual(SPACE.edgeV + 1e-9); expect(V.d / V.drain).toBeLessThanOrEqual(SPACE.edgeV + 1e-9); }
    SWALLOW.vars.forEach((V, v) => {
      let m = 0;
      for (let t = SWALLOW.tell; t < SWALLOW.tell + 2 * V.T; t++) for (let x = 0; x <= 480; x += 4) m = Math.max(m, Math.abs(throatInset(v, t + 1, x, 0, 480) - throatInset(v, t, x, 0, 480)));
      expect(m).toBeLessThanOrEqual(SPACE.edgeV);
    });
  });
  it('S3: the forced lane changes stay under .75 (grill weave, the gullet, the tide ramps)', () => {
    // a grill column burns reach x span from its wall; the ship crosses the overlap band (2 reach - 1) plus its 8 px
    // footprint between two opposite columns, minus the jets' 14 px width, at the widest span the inset biomes leave
    for (let v = 0; v < 3; v++) {
      const c = grillCols(v, GRILL.vars[v].n);
      for (let i = 1; i < c.length; i++) if (c[i][1] !== c[i - 1][1]) expect(((2 * GRILL.reach - 1) * 200 + 8) / (c[i][0] - c[i - 1][0] - 14)).toBeLessThanOrEqual(SPACE.weave);
      // the spec's own centre-to-centre weave, 80 px over the pitch
      expect(80 / GRILL.vars[v].pitch).toBeLessThanOrEqual(SPACE.weave);
    }
    expect(2 * Math.PI * GULLET.amp / GULLET.period).toBeLessThanOrEqual(SPACE.weave);
    for (const V of TIDE.vars) expect(V.d / TIDE.ramp).toBeLessThanOrEqual(SPACE.weave);
  });
  it('S6: a barrier is cut by the naked gun in <= 8 bolts', () => {
    expect(MORGUE.hp).toBeLessThanOrEqual(SPACE.cutBolts);
    expect(SWALLOW.plug.hp * SWALLOW.plug.hole).toBeLessThanOrEqual(SPACE.cutBolts);
    expect(SWALLOW.plug.hole * SWALLOW.plug.cell).toBeGreaterThan(8 + 2 * 4); // a ship-sized hole: its 8 px footprint and room
  });
  it('S1: every window floor is >= 72, and the throat at its tightest is the window floor', () => {
    for (const f of [...MORGUE.floor, ...TIDE.vars.flatMap((V) => V.floor), GRILL.floor, SWALLOW.floor]) expect(f).toBeGreaterThanOrEqual(SPACE.fitMin);
    expect(SWALLOW.vars.map((V) => 108 - 2 * V.S)).toEqual([84, 76, 72]);
    expect(108 - 2 * SWALLOW.vars[2].S).toBeGreaterThanOrEqual(SWALLOW.floor);
  });
  it('S5: blocks turn >= 120 px ahead of the ship; the spawn distances are the spec C9 values', () => {
    expect(MORGUE.stopLead).toBeGreaterThanOrEqual(120);
    expect([SPACE.noSpawn, SPACE.noSpawnKid, SPACE.regrowMin]).toEqual([48, 30, 24]);
  });
});

describe('the insets and the gullet', () => {
  it('per biome, per slot: the spec values (levels.md §5.0)', () => {
    expect(INSET).toEqual({ ice: [20, 32], acid: [24, 36], fire: [18, 30], snot: [0, 8] });
    expect(insetOf('ice', 0)).toBe(20); expect(insetOf('acid', 1)).toBe(36); expect(insetOf('nope', 1)).toBe(0);
    expect(INSET_MID.k).toBe(.5);
  });
  it('slot B narrow: 600 px, gap 108-118, never below 108', () => {
    expect(GULLET.len).toBe(600); expect(GULLET.gap[0]).toBeGreaterThanOrEqual(108); expect(GULLET.gap[1]).toBe(118);
  });
});

describe('signature shapes', () => {
  it('morgue lanes: v1 and v3 hold the ship y, v2 alternates ship y and +-50', () => {
    expect([0, 1, 2, 3].map((i) => morgueLane(0, i, 100))).toEqual([100, 100, 100, 100]);
    expect([0, 1, 2, 3, 4, 5].map((i) => morgueLane(1, i, 100))).toEqual([100, 150, 100, 50, 100, 150]);
    expect(morgueLane(2, 3, 100)).toBe(100);
  });
  it('tide: still during the tell, rises, holds at 1, drains to 0', () => {
    for (let v = 0; v < 3; v++) {
      const V = TIDE.vars[v];
      expect(tideLevel(v, TIDE.tell)).toBe(0);
      expect(tideLevel(v, TIDE.tell + V.rise / 2)).toBeCloseTo(.5);
      expect(tideLevel(v, TIDE.tell + V.rise + 1)).toBe(1);
      expect(tideLevel(v, tideLen(v))).toBe(0);
    }
    expect(TIDE.vars.map((V) => V.d)).toEqual([40, 60, 70]);
  });
  it('throat: v1-v3 clench to the spec narrows, v2 runs its halves out of phase', () => {
    expect(throatInset(0, SWALLOW.tell + 120, 240, 0, 480)).toBeCloseTo(12);
    const t = SWALLOW.tell + 100;
    expect(throatInset(1, t, 120, 0, 480)).toBeCloseTo(16); // first half at its tightest...
    expect(throatInset(1, t, 360, 0, 480)).toBeCloseTo(0, 5); // ...the second half open
    expect(throatInset(2, t, 240, 0, 480)).toBeCloseTo(18);
    expect(throatInset(0, 10, 240, 0, 480)).toBe(0); // the tell
    expect(throatInset(0, t, -5, 0, 480)).toBe(0);
  });
  it('grill: alternating, crisscross and pair combs; never both walls at one x', () => {
    expect(grillCols(0, 4).map((c) => c[1])).toEqual([true, false, true, false]);
    expect(grillCols(1, 3)).toEqual([[0, true], [60, false], [120, false], [180, true], [240, true], [300, false]]);
    expect(grillCols(2, 8).map((c) => c[1])).toEqual([true, true, false, false, true, true, false, false]);
    for (let v = 0; v < 3; v++) { const xs = grillCols(v, 8).map((c) => c[0]); expect(new Set(xs).size).toBe(xs.length); }
    expect(grillLen(0, 4)).toBe(390);
  });
  it('envelope eases to 1 inside the ramps and is 0 outside', () => {
    expect(envelope(-1, 0, 400, 100)).toBe(0); expect(envelope(200, 0, 400, 100)).toBe(1); expect(envelope(401, 0, 400, 100)).toBe(0);
  });
});

describe('planSig: three escalating variations inside the band', () => {
  it('every biome, every slot: in order, inside [a, lim], windows apart, counts escalating', () => {
    for (const b of BIOMES) for (const [s, a, lim] of BANDS) {
      const P = planSig(b, s, a, lim)!;
      expect(P.vars.length).toBe(3);
      P.vars.forEach((V, i) => {
        expect(V.s0).toBeGreaterThanOrEqual(a + 30);
        expect(V.x1).toBeGreaterThan(V.x0);
        if (i) { expect(V.s0).toBeGreaterThan(P.vars[i - 1].s0); expect(V.n).toBeGreaterThanOrEqual(P.vars[i - 1].n); }
      });
      // the windows a terrain change writes never overlap (tide, throat)
      if (b === 'acid' || b === 'snot') for (let i = 1; i < 3; i++) expect(P.vars[i].x0).toBeGreaterThan(P.vars[i - 1].x1);
      // the ship has left the last one by the limit (it sits ~150 px into the screen)
      const last = P.vars[2];
      if (b === 'fire') expect(last.x1 - 20 - 150 + GRILL.after).toBeLessThanOrEqual(lim + 1);
      if (b === 'acid' || b === 'snot') expect(last.x1 - 150).toBeLessThanOrEqual(lim + 1);
      if (b === 'ice') expect(last.s1).toBeLessThanOrEqual(lim + 1);
      if (b === 'ice' || b === 'fire') expect(P.vars[0].n).toBeLessThan(P.vars[2].n);
    }
  });
  it('ice keeps the spec counts (4/6/8, slot B 5/8/10); fire is fitted to the band', () => {
    expect(planSig('ice', 0, 9010, 10485)!.vars.map((V) => V.n)).toEqual([4, 6, 8]);
    expect(planSig('ice', 1, 15227, 16846)!.vars.map((V) => V.n)).toEqual([5, 8, 10]);
    const f = planSig('fire', 0, 9010, 10485)!;
    expect(f.fitted).toBe(true);
    expect(f.vars[0].n).toBeGreaterThanOrEqual(3);
    // a band with room keeps the spec's own counts
    expect(planSig('fire', 0, 0, 5000)!.vars.map((V) => V.n)).toEqual([4, 6, 8]);
    expect(planSig('fire', 0, 0, 5000)!.fitted).toBe(false);
  });
  it('the window floors: ice and acid lower in slot B, snot 72 both, fire 100', () => {
    expect(planSig('ice', 1, 15227, 16846)!.vars.map((V) => V.floor)).toEqual([88, 88, 88]);
    expect(planSig('acid', 1, 15227, 16846)!.vars.map((V) => V.floor)).toEqual([100, 92, 88]);
    expect(planSig('acid', 0, 9010, 10485)!.vars.map((V) => V.floor)).toEqual([110, 104, 100]);
    expect(planSig('snot', 0, 9010, 10485)!.vars.map((V) => V.floor)).toEqual([72, 72, 72]);
    expect(planSig('fire', 1, 15227, 16846)!.vars.map((V) => V.floor)).toEqual([100, 100, 100]);
  });
  it('no signature for a kind without one; pure (same inputs, same plan)', () => {
    expect(planSig('orbit', 0, 0, 1000)).toBeNull();
    expect(planSig('acid', 0, 9010, 10485)).toEqual(planSig('acid', 0, 9010, 10485));
  });
});

describe('the window registry', () => {
  it('setSigWindows replaces one owner key; sigWindows lists every key sorted by x0', () => {
    const G: { sigW?: Record<string, any[]> } = {};
    setSigWindows(G, 'b1', [{ x0: 500, x1: 600, floor: 88, id: 'b', k: 'm' }]);
    setSigWindows(G, 'b0', [{ x0: 100, x1: 200, floor: 100, id: 'a', k: 'm', cp: 40 }]);
    expect(sigWindows({ G }).map((w) => w.id)).toEqual(['a', 'b']);
    setSigWindows(G, 'b1', []);
    expect(sigWindows({ G }).map((w) => w.id)).toEqual(['a']);
    const ws = sigWindows({ G });
    expect(sigAt(150, ws)!.id).toBe('a'); expect(sigAt(300, ws)).toBeNull(); expect(sigAt(200, ws)).toBeNull(); // x1 exclusive
    expect(sigWindows({ G })).toBe(ws); // cached: no allocation per call (W0 contract)
    expect(sigWindows()).toBe(ws); // no argument: the last G's table
    expect(sigCheckpoints({ G })).toEqual([40]);
    expect(sigWindows(null)).toEqual([]); expect(sigWindows({ G: null })).toEqual([]);
  });
});

describe('hazards on rank', () => {
  it('x1.15 - .3 rho: x1.11 at rank 2, x.85 at rank 16, no change without rank.ts', () => {
    expect(hazRankMul(2 / 16)).toBeCloseTo(1.1125); expect(hazRankMul(1)).toBeCloseTo(.85); expect(hazRankMul(null)).toBe(1);
    expect(hazRankMul(5)).toBeCloseTo(.85); expect(HAZ.base).toBe(1.15);
  });
  it('icicles are shot-immune on long4; the Furnace has its own cadence', () => {
    expect(ICICLE.immune).toBe(true); expect(FURNACE.every).toBeGreaterThan(0);
  });
  it('the playfield constants match core.ts', () => { expect(PH).toBe(254); });
});

describe('midboss drop on THE KEEPSAKE stage (C24)', () => {
  it('one midboss there in Descent 1, two everywhere else', () => {
    expect(midsWanted('keepsake', 0)).toBe(1);
    expect(midsWanted('keepsake', 2)).toBe(2);
    expect(midsWanted(null, 0)).toBe(2);
    expect(MID_DROP.boss).toContain('keepsake');
  });
  it('pickBiomeMids with n = 1 picks the home one alone and notes only it as met', () => {
    const st = { mbUsed: [] as string[], mbLast: {} as Record<string, string[]> };
    let s = 7; const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const out = pickBiomeMids(st, 'ice', 0, rng, undefined, false, false, 1);
    expect(out.picks.length).toBe(1);
    expect(st.mbUsed).toEqual(out.picks);
  });
});

describe('W0 skeleton contract (kept)', () => {
  it('no G: the same frozen empty list; sigAt finds the window holding x, x1 exclusive', () => {
    const a = sigWindows(null), b = sigWindows(null);
    expect(a).toEqual([]); expect(a).toBe(b); expect(Object.isFrozen(a)).toBe(true);
    const ws = [{ x0: 0, x1: 100, floor: 88, id: 'tide' }];
    expect(sigAt(50, ws)).toMatchObject({ id: 'tide' }); expect(sigAt(0, ws)).toMatchObject({ id: 'tide' }); expect(sigAt(100, ws)).toBe(null);
  });
  it('pins the space rules and decision 5A', () => {
    expect([SPACE.fitGap, SPACE.fitMin, SPACE.fitBox, SPACE.noSpawn, SPACE.noSpawnKid, SPACE.tell, SPACE.sigLead, SPACE.cutBolts]).toEqual([100, 72, 21, 48, 30, 44, 120, 8]);
    expect([SPACE.edgeV, SPACE.weave, SPACE.deckDim, SPACE.sanctuary]).toEqual([.5, .75, .4, 600]);
    expect(SOLID_KILLS).toBe(true);
    expect(Object.keys(SIG)).toEqual(['morgue_rush', 'high_tide', 'grill', 'swallow']);
  });
});
