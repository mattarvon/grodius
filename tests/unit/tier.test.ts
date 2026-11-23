// DIFFICULTY-SPEC §2.1 tiers (src/tier.ts), the neutral BRUTAL shim and the run-save tier field. All pure: no mocks.
import { describe, expect, it } from 'vitest';
import { $ } from '../../src/state';
import { TIER, TIER_DEFAULT, TIER_NAME, bru, capRate, tier, tierG, tierOf } from '../../src/tier';
import { decodeRun, serializeRun } from '../../src/runsave';
import { LAYOUTS, setLayout } from '../../src/layout';

describe('tier parsing', () => {
  it('reads 0-3 from numbers and numeric strings, and null from anything else', () => {
    expect([0, 1, 2, 3, '0', '3'].map(tierOf)).toEqual([0, 1, 2, 3, 0, 3]);
    for (const v of [4, -1, 1.5, '1.5', '', ' ', 'x', null, undefined, NaN, {}, [], true, '0x1']) expect(tierOf(v), String(v)).toBe(null);
  });
  it('reads a G without a valid tier as Normal, the default', () => {
    expect(TIER_DEFAULT).toBe(1);
    expect([tierG(null), tierG({}), tierG({ tier: 7 }), tierG({ tier: '2' }), tierG({ tier: 3 })]).toEqual([1, 1, 1, 2, 3]);
    $.G = { tier: 0 };
    expect(tier()).toBe(0);
    $.G = null;
    expect(tier()).toBe(1);
  });
  it('names the tiers for the LAB row', () => {
    expect(TIER_NAME).toEqual(['EASY', 'NORMAL', 'HARD', 'VERY HARD']);
  });
});

describe('the tier table (spec §2.1)', () => {
  it('holds the spec columns', () => {
    expect(TIER.base).toEqual([0, 2, 4, 6]);
    expect(TIER.caps).toEqual([[6, 12, 18], [8, 16, 24], [10, 20, 30], [10, 20, 30]]);
    expect(TIER.vcap).toEqual([2.6, 2.6, 2.9, 2.9]);
    expect(TIER.capRate).toEqual([1.5, 1, 1, .8]);
    expect(TIER.strip).toEqual(['gradual', 'full1', 'full', 'full']);
    expect(TIER.checkpoint).toEqual([false, true, true, true]);
    expect(TIER.lifeline).toEqual([true, false, false, false]);
    expect(TIER.gasp).toEqual(['stage', 'descent', 'descent', 'off']);
    expect(TIER.blackBox).toEqual([true, true, true, false]);
  });
  it('never puts a cap above 1.5x Normal (GR rule 1, C5)', () => {
    for (const row of TIER.caps) row.forEach((c, i) => expect(c).toBeLessThanOrEqual(1.5 * TIER.caps[1][i]));
  });
  it('applies the pod faucet only to a G that carries a tier (long4), else 1 (short)', () => {
    $.G = {};
    expect(capRate()).toBe(1);
    $.G = { tier: 0 };
    expect(capRate()).toBe(1.5);
    $.G = { tier: 3 };
    expect(capRate()).toBe(.8);
    $.G = null;
    expect(capRate()).toBe(1);
  });
});

describe('the BRUTAL shim (spec §5.1)', () => {
  it('returns every retired lever at its neutral value: 1 for a multiplier, 0 for an addend', () => {
    for (const k of ['hp', 'bossHp', 'driveHp', 'cool', 'fire', 'bs', 'pod', 'ward'] as const) expect(bru(k)).toBe(1);
    for (const k of ['fan', 'aimAll', 'dens'] as const) expect(bru(k)).toBe(0);
  });
  it('ignores any dial left on G', () => {
    $.G = { brutal: 3, tier: 3 };
    expect(bru('cool')).toBe(1);
    expect(bru('fan')).toBe(0);
  });
});

describe('the run-save tier field (spec §5.4)', () => {
  /** a minimal well-formed long4 checkpoint at stage 0 CP0 */
  const blob = (g: Record<string, unknown>) => {
    setLayout('long4');
    const L = LAYOUTS.long4!, n = L.stages.filter((r: any) => r.kind === 'biome').length;
    return { v: 2, g: { loop: 0, stage: 0, cpX: 10, cpN: 0, layout: 'long4', rev: L.rev ?? 1, seed: 1, bx: Array(n + 1).fill(null), route: Array(n).fill(null), ...g }, p: {} };
  };
  it('round-trips a tier', () => {
    for (const t of [0, 1, 2, 3]) {
      const d = decodeRun(JSON.stringify(blob({ tier: t })));
      expect(d, String(t)).not.toBeNull();
      expect(d!.g.tier).toBe(t);
    }
    expect(serializeRun({ ...blob({}).g, tier: 2 }, {}).g.tier).toBe(2);
    setLayout('short');
  });
  it('refuses a tier out of range', () => {
    for (const t of [4, -1, 1.5, '1']) expect(decodeRun(JSON.stringify(blob({ tier: t }))), String(t)).toBeNull();
    setLayout('short');
  });
  it("resumes a D63 save's brutal dial as Normal, whatever its value (its levers are gone)", () => {
    for (const b of [0, 1, 2, 3]) {
      const d = decodeRun(JSON.stringify(blob({ brutal: b })))!;
      expect(d, String(b)).not.toBeNull();
      expect(d.g.tier).toBe(1);
      expect('brutal' in d.g).toBe(false);
    }
    expect(decodeRun(JSON.stringify(blob({ brutal: 3, tier: 2 })))!.g.tier).toBe(2); // a tier beside it wins
    expect(decodeRun(JSON.stringify(blob({ brutal: 9 })))).toBeNull(); // still validated
    expect(decodeRun(JSON.stringify(blob({})))!.g.tier).toBe(1); // a pre-tier long4 save (dial 0 was never written): Normal
    setLayout('short');
  });
  it('accepts the rebuild fields W1 / W2 write: redN, rigOff, gaspD, and a checkpoint list (cpN up to 31)', () => {
    expect(decodeRun(JSON.stringify(blob({ redN: 11, rigOff: 1, gaspD: 0 })))).not.toBeNull();
    expect(decodeRun(JSON.stringify(blob({ gaspD: -1, rigOff: 0, redN: 0 })))).not.toBeNull();
    expect(decodeRun(JSON.stringify(blob({ cpN: 5 })))!.g.cpN).toBe(5);
    for (const bad of [{ redN: -1 }, { redN: 1.5 }, { rigOff: 2 }, { gaspD: -2 }, { cpN: 32 }, { cpN: -1 }]) expect(decodeRun(JSON.stringify(blob(bad))), JSON.stringify(bad)).toBeNull();
    setLayout('short');
  });
});
