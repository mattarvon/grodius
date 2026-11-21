// D58 #3 (Matt, 2026-11-15): long4 formations add round(2 * min(1, pow)) rank drones, marked e.extra and never carrying
// a pod; short adds round(3 * min(2, pow)) and marks none. Mocks as formation.test.ts
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

  it('adds at most 2 on long4, marked, the base 4 unmarked', () => {
    const e = fly('long4', 3);
    expect(e.length).toBe(6);
    expect(e.filter((d) => d.extra).map((d) => d.i)).toEqual([4, 5]);
  });

  it('strips a carrier flag from a rank drone only', () => {
    const e = fly('long4', 1, { cap: 1 }); // R() .99 keeps every pod at the keep roll
    expect(e.slice(0, 4).every((d) => d.cap)).toBe(true);
    expect(e.slice(4).every((d) => d.cap === false)).toBe(true);
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
