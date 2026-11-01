import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { $ } from '../../src/state';
import { cdm } from '../../src/depth';
import { COOL, coolFor, revengeN, wombCool } from '../../src/enemies/cadence';

// The pre-M2 cooldowns, verbatim from src/enemies/update.ts at cb67b3e (Matt's cb50d04 curves under cdm()).
// cadence.ts must reproduce them exactly until Matt picks otherwise ("deep fire" in the art-direction picker).
const LEGACY = {
  eye: (L: number, r: number) => Math.round((Math.max(55, 120 - L * 18) + r) * cdm()),
  cross: (L: number, r: number) => Math.round((Math.max(70, 130 - L * 18) + r) * cdm()),
  flayer: (L: number, r: number) => Math.round((Math.max(60, 110 - L * 15) + r) * cdm()),
  slime: (L: number, r: number) => Math.round((Math.max(100, 170 - L * 20) + r) * cdm()),
  mutant: (L: number, r: number) => Math.round((Math.max(120, 190 - L * 25) + r) * cdm()),
  sentry: (L: number, r: number) => Math.round((Math.max(80, 130 - L * 20) + r) * cdm()),
};

describe('coolFor', () => {
  beforeEach(() => { $.G = { loop: 0 }; });

  it('matches the pre-M2 cooldown for every kind, descent and roll', () => {
    for (const L of [0, 1, 2, 3, 6]) {
      $.G.loop = L;
      for (const k of Object.keys(LEGACY)) for (const r of [0, 17, 40, 50]) expect(coolFor(k, r)).toBe(LEGACY[k](L, r));
    }
  });

  it('covers exactly the kinds that had authored curves', () => {
    expect(Object.keys(COOL).sort()).toEqual(Object.keys(LEGACY).sort());
  });
});

describe('wombCool', () => {
  beforeEach(() => { $.G = { loop: 0 }; });

  it('matches the pre-M2 litter gap and its 70-frame floor', () => {
    for (const L of [0, 1, 2, 3, 9]) {
      $.G.loop = L;
      expect(wombCool()).toBe(Math.max(70, 120 - L * 15));
    }
  });
});

describe('revengeN', () => {
  beforeEach(() => { $.G = { loop: 0 }; });

  it('is a bracketing pair in Descent 2', () => {
    $.G.loop = 1;
    expect(revengeN()).toBe(2);
  });

  it('is a 3-fan from Descent 3 on and never grows past it', () => {
    $.G.loop = 2;
    expect(revengeN()).toBe(3);
    $.G.loop = 6;
    expect(revengeN()).toBe(3);
  });
});

// Wiring guard: the helpers are only correct if the enemies use them. Reads the source, so a reverted or
// hand-edited cooldown line fails here even when every other gate is green.
describe('enemy cooldown wiring', () => {
  const src = readFileSync(new URL('../../src/enemies/update.ts', import.meta.url), 'utf8');
  const coolLines = src.split('\n').filter((l) => /\be\.cool\s*=/.test(l) && !/e\.cool\s*=\s*0\b/.test(l));

  it('routes every authored-curve kind through coolFor', () => {
    for (const k of Object.keys(COOL)) expect(src).toContain(`coolFor('${k}'`);
    expect(src).toContain('wombCool()');
  });

  it('keeps raw descent terms off the cooldown lines that cadence.ts owns', () => {
    const owned = coolLines.filter((l) => /coolFor\(|wombCool\(/.test(l));
    expect(owned.length).toBeGreaterThanOrEqual(Object.keys(COOL).length + 1);
    for (const l of owned) expect(l).not.toMatch(/\$\.G\.loop/);
  });
});
