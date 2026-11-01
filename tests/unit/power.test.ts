import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// perks.ts and contraptions.ts pull in canvas/audio/DOM modules at import time; stub them so their tables load in node
vi.mock('../../src/core', () => ({ FIRE: 0, PH: 270, R: () => 0, TAU: Math.PI * 2, W: 480, clamp: (v: number) => v, ctx: {}, dist2: () => 0, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0, swapRm: () => {} }));
vi.mock('../../src/audio', () => ({ sfx: {}, sample: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/input', () => ({ PR: {}, I: {} }));
vi.mock('../../src/world', () => ({ caps: [], ceilAt: () => 0, enemies: [], eshots: [], floorAt: () => 0, orbs: [] }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, gib: () => {}, gore: () => {}, mist: () => {}, pop: () => {}, spark: () => {} }));
vi.mock('../../src/enemies/update', () => ({ hurt: () => {} }));
vi.mock('../../src/boss/update', () => ({ bossHitByShot: () => {} }));
vi.mock('../../src/save', () => ({ SET: {} }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3 }));
vi.mock('../../src/render/util', () => ({ drawChain: () => {}, drawHookTip: () => {}, light: () => {} }));

const { POWER, powerBudget, powerRaw, rigPower } = await import('../../src/power');
const { PERKS } = await import('../../src/perks');
const { RIG } = await import('../../src/contraptions');

const SHIP0 = { speed: 0, double: 0, laser: 0, missile: 0, pyre: 0, options: 0, wardLv: 0 };
/** a run with the given ship, grafts and perks, and the given bolted contraptions ({id: level}) in `sockets` sockets */
const run = (ship = {}, gm = {}, pk = {}, rig: Record<string, number> = {}, sockets = 3) => {
  $.P = { ...SHIP0, ...ship };
  $.G = { loop: 0, gm: { ...gm }, pk: { ...pk } };
  $.meta = { rig: Object.keys(rig), cl: { ...rig }, lv: { socket: sockets - 1 } };
};

describe('POWER weight table', () => {
  beforeEach(() => run());

  it('weights every perk in PERKS, and nothing that is not a perk', () => {
    const ids = PERKS.map((p: any) => p.id).sort();
    expect(Object.keys(POWER.perk).sort()).toEqual(ids);
  });

  it('weights every contraption in RIG, and nothing that is not a contraption', () => {
    const ids = RIG.map((r: any) => r.id).sort();
    expect(Object.keys(POWER.rig).sort()).toEqual(ids);
  });

  it('gives every perk and contraption a positive weight, so each one counts toward power', () => {
    for (const w of [...Object.values(POWER.perk), ...Object.values(POWER.rig)]) expect(w).toBeGreaterThan(0);
  });

  it('keeps the weights the old table had for the perks it already counted', () => {
    // these eight set the Descent 1 pacing (docs/pacing.md 3.9); changing them moves the rank cap
    expect(POWER.perk).toMatchObject({ dmg: .6, rof: .6, crit: .4, glass: 1.2, pierce: .4, volatile: .4, teeth: .4, trail: .4 });
    expect(POWER.ship).toEqual({ speed: .5, gun: 1, missile: 1, pyre: 1, options: 1, ward: 1, graft: .7 });
  });
});

describe('powerBudget()', () => {
  beforeEach(() => run());

  it('is 0 for a bare ship with nothing bolted', () => {
    expect(powerBudget()).toBe(0);
  });

  it('keeps a real end-of-Descent-1 build at the pow the old formula gave it (seed 11: .914)', () => {
    // tools/playtest.mjs seed 11 at the Drive: 5 of its 8 perks were weightless before M2, so POWER.div absorbs them
    run({ speed: 2, missile: 2, double: 1, options: 2, wardLv: 2 }, { spore: 2, cal: 1, pierce: 1 }, { magnet: 2, pierce: 1, tiny: 1, glass: 1, snot: 1, crit: 1, gasp: 1, tape: 1 });
    expect(Math.abs(powerBudget() - .914)).toBeLessThan(.03);
  });

  it('keeps a real end-of-Descent-1 build at the pow the old formula gave it (seed 7: .786)', () => {
    run({ speed: 3, missile: 1, double: 1, options: 1, wardLv: 2 }, { spore: 1, cal: 1, pierce: 1 }, { rof: 2, crit: 2, spd: 1, gasp: 1, pierce: 1, greed: 1, frost: 1 });
    expect(Math.abs(powerBudget() - .786)).toBeLessThan(.03);
  });

  it('counts a perk the old table ignored (SNOT ROCKET II)', () => {
    run({}, {}, { snot: 2 });
    expect(powerBudget()).toBeCloseTo(2 * POWER.perk.snot / POWER.div);
  });

  it('counts bolted contraption levels from Descent 1', () => {
    run({}, {}, {}, { saw: 2, gut: 1 });
    expect($.G.loop).toBe(0);
    expect(rigPower()).toBeCloseTo(2 * POWER.rig.saw + POWER.rig.gut);
    expect(powerBudget()).toBeCloseTo((2 * POWER.rig.saw + POWER.rig.gut) / POWER.div);
  });

  it('ignores contraptions bolted beyond the sockets owned, as rigged() does', () => {
    run({}, {}, {}, { saw: 1, gut: 1, spine: 1 }, 1);
    expect(rigPower()).toBeCloseTo(POWER.rig.saw);
  });

  it('ignores unknown ids in the saved rig list', () => {
    run({}, {}, {}, { oldthing: 3, saw: 1 }, 1);
    expect(rigPower()).toBeCloseTo(POWER.rig.saw);
  });

  it('sums ship, grafts, perks and contraptions in one raw budget', () => {
    run({ speed: 2, laser: 1, options: 1 }, { cal: 2 }, { tiny: 1, glass: 1 }, { leech: 3 });
    expect(powerRaw()).toBeCloseTo(2 * .5 + 1 + 1 + 2 * .7 + POWER.perk.tiny + POWER.perk.glass + 3 * POWER.rig.leech);
  });
});
