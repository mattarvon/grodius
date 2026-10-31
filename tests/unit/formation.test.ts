import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// spawn.ts pulls in DOM/canvas/audio modules at import time; stub them so formation() runs in node
const enemies: any[] = [];
vi.mock('../../src/core', () => ({ BOSS_AT: 0, PH: 270, R: () => .99, TAU: Math.PI * 2, W: 480, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: {} }));
vi.mock('../../src/world', () => ({ ceilAt: () => 0, enemies, eshots: [], floorAt: () => 0 }));
vi.mock('../../src/boss/update', () => ({ startBoss: () => {} }));
vi.mock('../../src/enemies/ufo', () => ({ UFO_AT: 0, ufoWarn: () => {} }));

const { formation, formationExtra } = await import('../../src/enemies/spawn');

const fresh = (pow: number) => {
  $.G = { loop: 0, pow, st: { spawned: 0 } };
  enemies.length = 0;
};

describe('formation() density', () => {
  beforeEach(() => fresh(0));

  it('adds round(3 * min(2, pow)) drones to an open formation', () => {
    fresh(1);
    formation('sine', 100, 4);
    expect(enemies.length).toBe(4 + 3);
    fresh(5);
    expect(formationExtra()).toBe(6);
  });

  it('keeps a fixed set piece at exactly n drones, even at the pow cap', () => {
    fresh(2);
    formation('wall', 90, 2, { fixed: 1 });
    expect(enemies.length).toBe(2);
  });

  it('keeps the acid double wall split: two fixed walls at a third and two thirds never overlap', () => {
    // biomes.ts SET.walls: formation('wall', PH * .33, 2, FIXED) and PH * .67; drones sit 15 px apart around y
    fresh(2);
    formation('wall', 270 * .33, 2, { fixed: 1 });
    const top = Math.max(...enemies.map((e) => e.y));
    formation('wall', 270 * .67, 2, { fixed: 1 });
    const bottom = Math.min(...enemies.slice(2).map((e) => e.y));
    expect(bottom - top).toBeGreaterThan(60);
  });

  it('does not hand the fixed flag to the drones it spawns', () => {
    formation('wall', 90, 2, { fixed: 1 });
    expect(enemies[0].fixed).toBeUndefined();
  });
});
