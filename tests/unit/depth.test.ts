import { beforeEach, describe, expect, it } from 'vitest';
import { $ } from '../../src/state';
import { DEPTH, cdm, depthHP, driveMul, firem, over, xtra } from '../../src/depth';

const fresh = (loop: number, pow = 0) => {
  $.G = { loop, pow, rank: Math.max(0, Math.min(1, pow)) };
  $.meta = { rig: [], cl: {} };
};

describe('depth scaling', () => {
  beforeEach(() => fresh(0));

  it('is exactly 1 everywhere in Descent 1, even at max power', () => {
    fresh(0, 3);
    expect(depthHP('drone', { hp: 1 }, {})).toBe(1);
    expect(depthHP('maw', { mini: 1 }, { stageBoss: true })).toBe(1);
    expect(cdm()).toBe(1);
    expect(firem()).toBe(1);
    expect(xtra()).toBe(0);
  });

  it('clamps over() to 0..2', () => {
    fresh(1, 0);
    expect(over()).toBe(0);
    fresh(1, 10);
    expect(over()).toBe(2);
  });

  it('scales fodder HP by loop alone from Descent 2', () => {
    fresh(1, 1);
    expect(depthHP('drone', { hp: 1 }, {})).toBeCloseTo(1 + DEPTH.fod);
    fresh(2, 1);
    expect(depthHP('drone', { hp: 1 }, {})).toBeCloseTo(1 + DEPTH.fod * 2);
  });

  it('gives no enemy more HP for more player power (D1): fodder, midbosses and stage bosses', () => {
    for (const [k, b, o] of [['drone', { hp: 1 }, {}], ['choir', { mini: 1, mid: 1 }, {}], ['crux', { mini: 1 }, { stageBoss: true }]] as const) {
      fresh(2, 1);
      const weak = depthHP(k, b, o);
      fresh(2, 3);
      $.meta = { rig: ['saw', 'gut', 'spine'], cl: { saw: 3, gut: 3, spine: 3 } };
      expect(depthHP(k, b, o)).toBe(weak);
    }
  });

  it('gives a boss part its parent boss multiplier', () => {
    fresh(2, 2);
    expect(depthHP('nailbar', { hp: 1 }, { par: { dm: 3.7 } })).toBe(3.7);
  });

  it('shortens cooldowns and adds a burst bullet with depth', () => {
    fresh(2);
    expect(cdm()).toBeCloseTo(1 / (1 + DEPTH.fire * 2));
    expect(firem()).toBeCloseTo(1 + DEPTH.fire * 2);
    expect(xtra()).toBe(1);
  });
});

describe('driveMul(): the Gravity Drive, the one HP exception to the power rule', () => {
  it('is 1 for a bare ship in Descent 1', () => {
    fresh(0, 0);
    expect(driveMul()).toBe(1);
  });

  it('scales with rank in Descent 1 but ignores power past the cap there', () => {
    fresh(0, .5);
    expect(driveMul()).toBeCloseTo(1 + DEPTH.driveRank * .5);
    fresh(0, 2);
    expect(driveMul()).toBeCloseTo(1 + DEPTH.driveRank);
  });

  it('multiplies loop, rank and power past the cap from Descent 2', () => {
    fresh(2, 1.5);
    expect(driveMul()).toBeCloseTo((1 + DEPTH.driveL * 2) * (1 + DEPTH.driveRank) * (1 + DEPTH.driveO * .5));
  });

  it('keeps the pinned tuning: 560 HP x 3.17 for a capped Descent 3 build at pow 1.5', () => {
    // the exception exists because boss-probe/depth-probe showed the fight collapsing without it (design/progression.md)
    expect([DEPTH.driveL, DEPTH.driveRank, DEPTH.driveO]).toEqual([.4, .6, .2]);
    fresh(2, 1.5);
    expect(driveMul()).toBeCloseTo(1.8 * 1.6 * 1.1);
  });
});
