import { beforeEach, describe, expect, it } from 'vitest';
import { $ } from '../../src/state';
import { DEPTH, cdm, depthHP, driveHP, firem, over, xtra } from '../../src/depth';

const fresh = (loop: number, pow = 0) => {
  $.G = { loop, pow };
  $.meta = { rig: [], cl: {} };
};

describe('depth scaling', () => {
  beforeEach(() => fresh(0));

  it('is exactly 1 everywhere in Descent 1, even at max power', () => {
    fresh(0, 3);
    expect(depthHP('drone', { hp: 1 }, {})).toBe(1);
    expect(depthHP('maw', { mini: 1 }, { stageBoss: true })).toBe(1);
    expect(driveHP()).toBe(1);
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

  it('counts bolted contraption levels toward over()', () => {
    fresh(1, 1);
    $.meta = { rig: ['a', 'b'], cl: { a: 3, b: 2 } };
    expect(over()).toBeCloseTo(DEPTH.rig * 5);
  });

  it('scales fodder HP by loop and power past the cap from Descent 2', () => {
    fresh(1, 1);
    expect(depthHP('drone', { hp: 1 }, {})).toBeCloseTo(1 + DEPTH.fod);
    fresh(2, 2);
    expect(depthHP('drone', { hp: 1 }, {})).toBeCloseTo(1 + DEPTH.fod * 2 + DEPTH.fodO * 1);
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
