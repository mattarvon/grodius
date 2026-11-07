// LS1 item G (spec §6.4): the real killEnemy() on a midboss pays the first-kill biomass once per kind on long4,
// recorded in meta.mbK, and pays nothing on short. economy.test.ts covers the pure firstKillPay; this covers the wiring.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// enemies/update.ts pulls in canvas/audio/DOM modules at import time; stub them (the damage.test.ts pattern)
const noop = () => {};
const pops: string[] = [];
vi.mock('../../src/core', () => ({ FIRE: {}, PH: 270, R: () => .99, TAU: Math.PI * 2, W: 480, clamp: (v: number) => v, dist2: () => 1e9, lerp: (a: number) => a, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0, sstep: (v: number) => v }));
vi.mock('../../src/save', () => ({ SET: {}, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sample: () => {}, sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/world', () => ({ caps: [], ceilAt: () => 0, enemies: [], eshots: [], floorAt: () => 270, geysers: [], orbs: [] }));
vi.mock('../../src/fx/spawn', () => ({ drop: noop, flash: noop, gib: noop, gore: noop, mist: noop, pop: (_x: number, _y: number, t: string) => pops.push(t), spark: noop, splat: noop }));
vi.mock('../../src/perks', () => ({ gainXP: () => {}, pk: () => 0, spillSlick: () => {} }));
vi.mock('../../src/stages', () => ({ clearStage: () => {}, deepPay: () => 1 }));
vi.mock('../../src/enemies/spawn', () => ({ BS: () => 1, aimA: () => 0, banner: () => {}, eshoot: () => {}, every: () => false, fan: () => {}, mk: () => ({}), onScreen: () => true, ring: () => {}, wrapA: (a: number) => a }));
vi.mock('../../src/mutations', () => ({ countKill: () => {} }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3, playerHit: () => {}, slotMaxed: () => false }));
vi.mock('../../src/contraptions', () => ({ onKillContraptions: () => {} }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoKilled: () => {}, updUfo: () => {} }));
vi.mock('../../src/enemies/elite', () => ({ eliteKill: () => {}, eliteTick: () => {} }));

const { killEnemy } = await import('../../src/enemies/update');
const L = await import('../../src/layout');

/** a fresh Descent 1 run at biome stage 1 on layout id, with a profile that has killed `rec` */
const run = (id: 'short' | 'long4', rec?: Record<string, number>) => {
  L.setLayout(id);
  $.G = { loop: 0, stage: 1, score: 0, bio: 0, combo: 0, comboT: 0, kills: 0, maxCombo: 0, st: { kills: 0, chain: 0 }, hitstop: 0 };
  $.P = { x: 90, y: 135 };
  $.meta = { bio: 0, ...(rec ? { mbK: rec } : {}) };
  pops.length = 0;
};
/** a live midboss of kind k, as midboss() leaves it after mk() */
const mid = (k: string) => ({ k, x: 300, y: 135, mid: 1, mini: 1, score: 0, bio: 0, gsz: 3 });

describe('killEnemy() first-kill pay (spec §6.4, LS1 item G)', () => {
  afterEach(() => L.setLayout('short'));

  it('pays 100 to the run and the profile and records the kind on the first kill on long4', () => {
    run('long4');
    killEnemy(mid('cyst'));
    expect($.G.bio).toBe(100);
    expect($.meta.bio).toBe(100);
    expect($.meta.mbK).toEqual({ cyst: 1 });
    expect(pops).toContain('FIRST KILL +100');
  });

  it('pays nothing for a second kill of the same kind, and pays a new kind', () => {
    run('long4');
    killEnemy(mid('cyst'));
    killEnemy(mid('cyst'));
    expect($.G.bio).toBe(100);
    expect($.meta.bio).toBe(100);
    killEnemy(mid('brood'));
    expect($.G.bio).toBe(200);
    expect($.meta.mbK).toEqual({ cyst: 1, brood: 1 });
  });

  it('pays nothing for a kind a saved profile already recorded', () => {
    run('long4', { prentice: 1 });
    killEnemy(mid('prentice'));
    expect($.G.bio).toBe(0);
    expect($.meta.bio).toBe(0);
  });

  it('pays nothing and writes no record on short', () => {
    run('short');
    killEnemy(mid('cyst'));
    expect($.G.bio).toBe(0);
    expect($.meta.bio).toBe(0);
    expect($.meta.mbK).toBeUndefined();
    expect(pops.some((t) => t.startsWith('FIRST KILL'))).toBe(false);
  });
});
