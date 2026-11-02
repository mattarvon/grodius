import { describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// spawn.ts pulls in DOM/canvas/audio modules at import time; stub them so the pure pattern helpers load in node
vi.mock('../../src/core', () => ({ PH: 270, R: () => 0, TAU: Math.PI * 2, W: 480, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: {} }));
vi.mock('../../src/world', () => ({ ceilAt: () => 0, enemies: [], eshots: [], floorAt: () => 0 }));
vi.mock('../../src/boss/update', () => ({ startBoss: () => {} }));
vi.mock('../../src/enemies/ufo', () => ({ ufoWarn: () => {} }));

const { every, BS } = await import('../../src/enemies/spawn');

/** frames in [1, span] on which every(e, n) fires */
const fires = (n: number, span: number) => {
  const out: number[] = [];
  for (let t = 1; t <= span; t++) if (every({ t }, n)) out.push(t);
  return out;
};

describe('every() attack cadence', () => {
  it('fires on the base period at zero power', () => {
    $.G = { loop: 0, pow: 0 };
    expect(fires(150, 450)).toEqual([150, 300, 450]);
  });

  it('compresses the period with power: n * (1 - .4 * pow)', () => {
    $.G = { loop: 0, pow: 1 };
    expect(fires(150, 270)).toEqual([90, 180, 270]);
  });

  it('caps power at 2 and never fires more often than every 18 frames', () => {
    $.G = { loop: 0, pow: 5 };
    expect(fires(150, 90)).toEqual([30, 60, 90]); // 150 * (1 - .8) = 30
    expect(fires(40, 36)).toEqual([18, 36]); // 40 * .2 = 8 -> floor of 18
  });
});

describe('BS() enemy bullet speed', () => {
  it('is 1 for a fresh Descent 1 ship and caps loop and power terms', () => {
    $.G = { loop: 0, pow: 0 };
    expect(BS()).toBe(1);
    $.G = { loop: 10, pow: 10 };
    expect(BS()).toBeCloseTo(1.45 * 1.7);
  });
});
