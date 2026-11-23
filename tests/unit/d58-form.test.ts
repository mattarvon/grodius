// D58 #3 (Matt, 2026-11-15) gave long4 round(2 * min(1, pow)) rank drones; DIFFICULTY-SPEC §2.1 sets long4's k to 0
// (rank never changes formation size). Short still adds round(3 * min(2, pow)) and marks none. Mocks as formation.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const enemies: any[] = [];
vi.mock('../../src/core', () => ({ PH: 270, R: () => .99, TAU: Math.PI * 2, W: 480, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: {} }));
vi.mock('../../src/world', () => ({ ceilAt: () => 0, enemies, eshots: [], floorAt: () => 0 }));
vi.mock('../../src/boss/update', () => ({ startBoss: () => {} }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoWarn: () => {} }));
vi.mock('../../src/enemies/mid', () => ({}));

const { formation } = await import('../../src/enemies/spawn');
const L = await import('../../src/layout');
const fly = (id: 'short' | 'long4', pow: number, o: any = {}) => {
  L.setLayout(id);
  $.G = { loop: 0, stage: 2, pow, st: { spawned: 0 } };
  enemies.length = 0;
  formation('sine', 100, 4, o);
  return enemies;
};

describe('D58 #3 rank drones', () => {
  afterEach(() => L.setLayout('short'));

  it('adds none on long4 at any power (DIFFICULTY-SPEC §2.1: rank never changes formation size)', () => {
    const e = fly('long4', 3);
    expect(e.length).toBe(4);
    expect(e.some((d) => d.extra)).toBe(false);
  });

  it('keeps every carrier flag on long4 (no rank drone to strip)', () => {
    const e = fly('long4', 1, { cap: 1 }); // R() .99 keeps every pod at the keep roll
    expect(e.length).toBe(4);
    expect(e.every((d) => d.cap)).toBe(true);
  });

  it('records the W0 contract options on the group and keeps them out of each drone (DIFFICULTY-SPEC §5.6)', () => {
    const e = fly('long4', 0, { open: 1, rec: 1, shooter: 2, hpm: 2 });
    expect(e[0].group).toMatchObject({ n: 4, killed: 0, open: 1, rec: 1, shooter: 2 });
    expect(e.every((d) => d.group === e[0].group && !('open' in d) && !('rec' in d) && !('shooter' in d))).toBe(true);
    expect(e[0].hpm).toBe(2); // any other option still reaches mk()
    const plain = fly('long4', 0);
    expect(['open', 'rec', 'shooter', 'pod'].some((k) => k in plain[0].group)).toBe(false);
  });

  it('adds up to 6 on short and marks none', () => {
    const e = fly('short', 3);
    expect(e.length).toBe(10);
    expect(e.some((d) => 'extra' in d)).toBe(false);
  });

  it('keeps a fixed set piece at n on long4', () => {
    expect(fly('long4', 3, { fixed: 1 }).length).toBe(4);
  });
});
