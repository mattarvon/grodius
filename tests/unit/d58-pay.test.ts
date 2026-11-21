// D58 #3 (Matt, 2026-11-15): a rank drone (spawn.ts formation marks e.extra on long4) pays half kill XP and drops no
// biomass orbs; any other kill, and every kill on short, pays as before. Mocks as poddrop.test.ts, gainXP captured
import { afterEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const noop = () => {};
const H = vi.hoisted(() => ({ xp: [] as number[], orbs: [] as any[] }));
vi.mock('../../src/core', () => ({ FIRE: {}, PH: 270, R: () => .99, TAU: Math.PI * 2, W: 480, clamp: (v: number) => v, dist2: () => 1e9, lerp: (a: number) => a, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0, sstep: (v: number) => v }));
vi.mock('../../src/save', () => ({ SET: {}, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sample: () => {}, sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/world', () => ({ caps: [], ceilAt: () => 0, enemies: [], eshots: [], floorAt: () => 270, geysers: [], orbs: H.orbs }));
vi.mock('../../src/fx/spawn', () => ({ drop: noop, flash: noop, gib: noop, gore: noop, mist: noop, pop: noop, spark: noop, splat: noop }));
vi.mock('../../src/perks', () => ({ gainXP: (n: number) => { H.xp.push(n); }, pk: () => 0, spillSlick: () => {} }));
vi.mock('../../src/stages', () => ({ clearStage: () => {}, deepPay: () => 1 }));
vi.mock('../../src/enemies/spawn', () => ({ BS: () => 1, aimA: () => 0, banner: () => {}, eshoot: () => {}, every: () => false, fan: () => {}, mk: () => ({}), onScreen: () => true, ring: () => {}, wrapA: (a: number) => a }));
vi.mock('../../src/mutations', () => ({ countKill: () => {} }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3, playerHit: () => {}, slotMaxed: () => false }));
vi.mock('../../src/contraptions', () => ({ onKillContraptions: () => {} }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoKilled: () => {}, updUfo: () => {} }));
vi.mock('../../src/enemies/elite', () => ({ eliteKill: () => {}, eliteTick: () => {} }));

const { killEnemy } = await import('../../src/enemies/update');
const L = await import('../../src/layout');
const { ECON } = await import('../../src/economy');

/** kill one drone (extra = a rank drone) on layout id; returns the XP paid and the orbs dropped */
const kill = (id: 'short' | 'long4', extra: boolean) => {
  L.setLayout(id);
  $.G = { loop: 0, stage: 2, score: 0, bio: 0, combo: 0, comboT: 0, kills: 0, maxCombo: 0, st: { kills: 0, chain: 0 }, hitstop: 0 };
  $.P = { x: 90, y: 135 };
  $.meta = { bio: 0 };
  H.xp.length = 0; H.orbs.length = 0;
  killEnemy({ k: 'drone', x: 300, y: 135, score: 100, bio: 2, gsz: 1, group: { n: 9, killed: 0 }, ...(extra ? { extra: 1 } : {}) });
  return { xp: H.xp.reduce((a, v) => a + v, 0), orbs: H.orbs.length };
};

describe('D58 #3 rank drone pay', () => {
  afterEach(() => L.setLayout('short'));

  it('pays a long4 rank drone half XP and no biomass', () => {
    const base = kill('long4', false), x = kill('long4', true);
    expect(base.orbs).toBeGreaterThan(0);
    expect(x.orbs).toBe(0);
    expect(x.xp).toBeCloseTo(base.xp * ECON.long4.form.xp, 12);
  });

  it('pays every drone in full on short', () => {
    expect(kill('short', true)).toEqual(kill('short', false));
  });
});
