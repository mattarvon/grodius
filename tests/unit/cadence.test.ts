import { beforeEach, describe, expect, it } from 'vitest';
import { $ } from '../../src/state';
import { DEPTH } from '../../src/depth';
import { COOL, coolFor, revengeN, wombCool } from '../../src/enemies/cadence';

// D2: src/depth.ts is the single home for depth fire scaling, so each cooldown scales by cdm() exactly once
const KINDS = Object.keys(COOL);
const base = (k: string) => COOL[k];
const once = (b: number, loop: number) => Math.round(b / (1 + DEPTH.fire * loop));

describe('coolFor', () => {
  beforeEach(() => { $.G = { loop: 0 }; });

  it('is the Descent 1 base plus the roll in Descent 1, for every kind', () => {
    for (const k of KINDS) expect(coolFor(k, 0)).toBe(base(k));
    expect(coolFor('eye', 40)).toBe(base('eye') + 40);
  });

  it('scales the Descent 1 cooldown by cdm() once in Descent 2, for every kind', () => {
    // Arrange
    $.G.loop = 1;
    // Act + Assert
    for (const k of KINDS) expect(coolFor(k, 0)).toBe(once(base(k), 1));
  });

  it('scales the Descent 1 cooldown by cdm() once in Descent 3, roll included', () => {
    // Arrange
    $.G.loop = 2;
    // Act + Assert
    for (const k of KINDS) expect(coolFor(k, 20)).toBe(once(base(k) + 20, 2));
  });
});

describe('wombCool', () => {
  beforeEach(() => { $.G = { loop: 0 }; });

  it('is 120 frames in Descent 1', () => {
    expect(wombCool()).toBe(120);
  });

  it('goes through cdm() so a deeper descent shortens it by the depth knob', () => {
    // Arrange: a different fire knob must move it if (and only if) it reads depth.ts
    $.G.loop = 1;
    const k0 = DEPTH.fire;
    let a, b;
    try {
      // Act
      a = wombCool();
      DEPTH.fire = k0 * 2;
      b = wombCool();
    } finally { DEPTH.fire = k0; }
    // Assert
    expect(b).toBeLessThan(a);
  });

  it('stays within 5% of the old 105-frame litter gap in Descent 2', () => {
    $.G.loop = 1;
    expect(Math.abs(wombCool() - 105) / 105).toBeLessThan(.05);
  });

  it('never drops below the 70-frame floor', () => {
    $.G.loop = 9;
    expect(wombCool()).toBe(70);
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
