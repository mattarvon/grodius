// D27: the real midboss() applies midslot.ts MID_HP on picker layouts (the Apprentice at 200 base HP on long4) and
// leaves short at spawn.ts ET's values. midslot.test.ts covers the pure midHpMul; this covers the wiring in spawn.ts.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// spawn.ts pulls in DOM/canvas/audio modules at import time; stub them (the formation.test.ts pattern)
const enemies: any[] = [];
vi.mock('../../src/core', () => ({ PH: 270, R: () => .99, TAU: Math.PI * 2, W: 480, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: {} }));
vi.mock('../../src/world', () => ({ ceilAt: () => 0, enemies, eshots: [], floorAt: () => 0 }));
vi.mock('../../src/boss/update', () => ({ startBoss: () => {} }));
vi.mock('../../src/enemies/ufo', () => ({ ufoWarn: () => {} }));

const { midboss, ET } = await import('../../src/enemies/spawn');
const L = await import('../../src/layout');
const DEP = await import('../../src/depth');

/** spawn kind k as a midboss in Descent loop+1 at stage ordinal `stage` on layout id; returns the enemy. Stage 0 keeps
 *  depth at the integer loop on every layout (Descent 1: no depth HP); long4's later stages add intra-descent depth (G) */
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

  it('spawns the Apprentice at 200 HP, full, on long4', () => {
    const e = meet('long4', 'prentice');
    expect(e.hp).toBe(200);
    expect(e.max).toBe(200);
  });

  it('spawns the Apprentice at its ET 150 HP on short', () => {
    const e = meet('short', 'prentice');
    expect(ET.prentice.hp).toBe(150);
    expect(e.hp).toBe(150);
    expect(e.max).toBe(150);
  });

  it('leaves a kind outside MID_HP at its ET HP on long4', () => {
    const e = meet('long4', 'cyst');
    expect(e.hp).toBe(ET.cyst.hp);
  });

  it('keeps the 200 / 150 ratio in Descent 3, so depth HP still multiplies on top', () => {
    const short = meet('short', 'prentice', 2), long = meet('long4', 'prentice', 2);
    expect(short.hp).toBeGreaterThan(150); // depth (and loop) HP applied
    expect(long.hp / short.hp).toBeCloseTo(200 / 150, 9);
    expect(long.max).toBe(long.hp);
  });

  it('stacks long4 intra-descent depth (LS1 item G) on the 200 base at a biome stage in Descent 1', () => {
    // stage 1 of 4: dep = .35 * 1/3, so the midboss factor is 1 + DEPTH.mid * dep (depth.test.ts covers dep itself)
    const e = meet('long4', 'prentice', 0, 1);
    expect(e.hp).toBeCloseTo(200 * (1 + DEP.DEPTH.mid * .35 / 3), 9);
    expect(e.max).toBe(e.hp);
    expect(meet('short', 'prentice', 0, 1).hp).toBe(150); // short: Descent 1 stays at 1x on every stage
  });
});
