// D27: the real midboss() applies midslot.ts MID_HP on picker layouts (the Apprentice at 172 base HP (D61 180, r4 172; 200 before) on long4) and
// leaves short at spawn.ts ET's values. midslot.test.ts covers the pure midHpMul; this covers the wiring in spawn.ts.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// spawn.ts pulls in DOM/canvas/audio modules at import time; stub them (the formation.test.ts pattern)
const enemies: any[] = [];
vi.mock('../../src/core', () => ({ PH: 270, R: () => .99, TAU: Math.PI * 2, W: 480, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: {} }));
vi.mock('../../src/world', () => ({ ceilAt: () => 0, enemies, eshots: [], floorAt: () => 0 }));
vi.mock('../../src/boss/update', () => ({ startBoss: () => {} }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoWarn: () => {} }));
// the real kinds load (their ET rows and spawn hooks are under test); these are only what their updates call
vi.mock('../../src/enemies/update', () => ({ bandFit: () => {}, lob: () => {}, midLeave: () => false }));
vi.mock('../../src/player', () => ({ playerHit: () => {} }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, spark: () => {} }));

const { midboss, ET } = await import('../../src/enemies/spawn');
const L = await import('../../src/layout');
const { MID_HP_G3 } = await import('../../src/midslot');

/** spawn kind k as a midboss in Descent loop+1 at stage ordinal `stage` on layout id; returns the enemy. Stage 0 keeps
 *  depth at the integer loop on every layout (Descent 1: no depth HP); midboss HP ignores long4's intra-descent depth
 *  at every stage (D29) */
function meet(id: 'short' | 'long4', k: string, loop = 0, stage = 0) {
  L.setLayout(id);
  $.G = { loop, stage, st: { spawned: 0 }, mini: null };
  $.meta = {};
  enemies.length = 0;
  midboss(k, 'TEST');
  return $.G.mini;
}

describe('midboss() base HP per layout (D27)', () => {
  afterEach(() => L.setLayout('short'));

  it('spawns the Apprentice at 172 HP (D61), full, on long4', () => {
    const e = meet('long4', 'prentice');
    expect(e.hp).toBe(172);
    expect(e.max).toBe(172);
  });

  it('spawns the Apprentice at its ET 150 HP on short', () => {
    const e = meet('short', 'prentice');
    expect(ET.prentice.hp).toBe(150);
    expect(e.hp).toBe(150);
    expect(e.max).toBe(150);
  });

  it('spawns a kind of the hard set table (MID_HP_G3, DIFFICULTY-SPEC §2.3) at that HP on long4, and at its ET HP on short', () => {
    expect(meet('long4', 'cyst').hp).toBeCloseTo(MID_HP_G3.cyst);
    expect(meet('short', 'cyst').hp).toBe(ET.cyst.hp);
  });

  it('keeps the 172 / 150 ratio in Descent 3, so depth HP still multiplies on top', () => {
    const short = meet('short', 'prentice', 2), long = meet('long4', 'prentice', 2);
    expect(short.hp).toBeGreaterThan(150); // depth (and loop) HP applied
    expect(long.hp / short.hp).toBeCloseTo(172 / 150, 9);
    expect(long.max).toBe(long.hp);
  });

  it('spawns the Apprentice at exactly 172 (D61) on long4 and 150 on short at biome slot A in Descent 1 (D29)', () => {
    const e = meet('long4', 'prentice', 0, 1);
    expect(e.hp).toBe(172);
    expect(e.max).toBe(172);
    expect(meet('short', 'prentice', 0, 1).hp).toBe(150);
  });

  it('re-bands biome slot B on long4 only: x its midLate (D58 #4, revising D29), body and parts', async () => {
    const { ECON } = await import('../../src/economy');
    const L = ECON.long4.late!, m = L.midLateK.prentice ?? L.midLate;
    const e = meet('long4', 'prentice', 0, 2);
    expect(e.hp).toBeCloseTo(172 * m, 9);
    expect(e.max).toBe(e.hp);
    expect(e.dm).toBeCloseTo(m, 12); // what its parts read (depthHP par.dm)
    expect(meet('short', 'prentice', 0, 2).hp).toBe(150);
    expect(meet('long4', 'prentice', 0, 3).hp).toBe(172); // the Drive stage is not a biome slot
  });
});

describe('midboss() on a kind with no registry entry', () => {
  it('throws, naming the kind and the file it needs', () => {
    expect(() => midboss('nobody', 'NOBODY', 'ice')).toThrow(/midboss 'nobody' is not registered \(enemies\/mid\/nobody\.ts/);
  });
});
