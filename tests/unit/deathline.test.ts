// SLAB's GRODIUS BITCH over a death in a late boss fight (Matt, 2026-11-24; src/voice/deathline.ts): the rule is
// rank.ts capCtx's 'boss' (the Drive, or a stage boss that is not a midboss) in a late stage (BITCH_LATE)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BITCH_AT, BITCH_LATE, lateBossDeath } from '../../src/voice/deathline';
import { setLayout } from '../../src/layout';

setLayout('long4');
const drive = { k: 'drive' }, stageBoss = { k: 'keepsake', stageBoss: true }, mid = { k: 'ufo', mid: true };
const run = (stage: number, loop: number, o: { boss?: any; mini?: any } = {}) => ({ G: { stage, loop, boss: o.boss ?? null, mini: o.mini ?? null } });

describe('lateBossDeath', () => {
  it('is late from the second biome stage (index 2) of a descent, or anywhere from Descent 2', () => {
    expect(BITCH_LATE).toEqual({ stage: 2, loop: 1 });
    expect(BITCH_AT).toBeGreaterThan(0);
    expect(BITCH_AT).toBeLessThan(150 / 60); // before the respawn
  });
  it('fires on a stage boss in the second biome stage and on the Gravity Drive', () => {
    expect(lateBossDeath(run(2, 0, { mini: stageBoss }))).toBe(true);
    expect(lateBossDeath(run(3, 0, { boss: drive }))).toBe(true);
  });
  it('fires on a stage boss in stage 0 or 1 of a later descent (DESCEND DEEPER)', () => {
    expect(lateBossDeath(run(0, 1, { mini: { k: 'maw', stageBoss: true } }))).toBe(false); // the Orbit Maw is a midboss by capMid
    expect(lateBossDeath(run(1, 1, { mini: stageBoss }))).toBe(true);
    expect(lateBossDeath(run(0, 2, { mini: stageBoss }))).toBe(true);
  });
  it('stays quiet on an early stage boss, a midboss, a dead boss and a scroll death', () => {
    expect(lateBossDeath(run(1, 0, { mini: stageBoss }))).toBe(false); // the first biome's stage boss
    expect(lateBossDeath(run(2, 0, { mini: mid }))).toBe(false);
    expect(lateBossDeath(run(3, 1, { mini: mid }))).toBe(false);
    expect(lateBossDeath(run(2, 0, { mini: { ...stageBoss, dead: true } }))).toBe(false);
    expect(lateBossDeath(run(3, 0))).toBe(false);
    expect(lateBossDeath(run(0, 3))).toBe(false);
    expect(lateBossDeath({})).toBe(false);
  });
  it('is a pure read: no R(), no writes', () => {
    const code = readFileSync(new URL('../../src/voice/deathline.ts', import.meta.url), 'utf8').replace(/^\s*(\/\/|\/?\*).*$/gm, '');
    expect(code).not.toMatch(/\bR\(|Math\.random|sample\(/);
    const $ = run(2, 0, { mini: stageBoss }), before = JSON.stringify($);
    lateBossDeath($);
    expect(JSON.stringify($)).toBe(before);
  });
});
