import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// player.ts and mutations.ts pull in canvas/audio/DOM modules at import time; stub them so the damage helpers load in node
const shots: any[] = [];
vi.mock('../../src/core', () => ({ PH: 270, R: () => 0, TAU: Math.PI * 2, W: 480, clamp: (v: number) => v, dist2: () => 0, lerp: (a: number) => a, ri: () => 0, rr: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/input', () => ({ I: {}, PR: {}, touch: {} }));
vi.mock('../../src/save', () => ({ SET: {}, lv: () => 0 }));
vi.mock('../../src/world', () => ({ arcs: [], caps: [], ceilAt: () => 0, enemies: [], floorAt: () => 0, shots }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, gore: () => {}, pop: () => {}, spark: () => {} }));
vi.mock('../../src/fx/gunfx', () => ({ gunTier: () => 0, smoke: () => {} }));
vi.mock('../../src/flow', () => ({ killPlayer: () => {}, respawn: () => {} }));
vi.mock('../../src/enemies/update', () => ({ POD: {}, hurt: () => {} }));

const { gunDm, sporeBurst } = await import('../../src/mutations');
const P = await import('../../src/player');

/** a run carrying the given grafts and perks */
const run = (gm = {}, pk = {}) => {
  $.G = { loop: 0, t: 0, gm: { ...gm }, pk: { ...pk } };
  $.P = { x: 100, y: 100 };
  shots.length = 0;
};
// a strong Descent 3 gun: CALIBER III, SERRATION II, SERRATED MARROW III, GLASS JAW
const STRONG = [{ cal: 3, serr: 2 }, { dmg: 3, glass: 1 }] as const;
const STRONG_DM = 1.22 ** 3 * 1.25 ** 2 * 1.3 * 1.35;

describe('gunDm() main-gun damage multiplier', () => {
  beforeEach(() => run());

  it('is 1 with no damage grafts or perks', () => {
    expect(gunDm()).toBe(1);
  });

  it('multiplies CALIBER, SERRATION, SERRATED MARROW and GLASS JAW', () => {
    run(...STRONG);
    expect(gunDm()).toBeCloseTo(STRONG_DM);
  });
});

describe('flat-damage sources scale like the main gun', () => {
  beforeEach(() => run());

  it('SPORE COAT spores deal the 1.2 base with a bare gun', () => {
    run({ spore: 1 });
    sporeBurst();
    expect(shots.length).toBe(6);
    expect(shots[0].dmg).toBeCloseTo(1.2);
  });

  it('SPORE COAT spores scale with the gun multiplier', () => {
    run({ spore: 2, ...STRONG[0] }, STRONG[1]);
    sporeBurst();
    expect(shots.length).toBe(10);
    for (const s of shots) expect(s.dmg).toBeCloseTo(1.2 * STRONG_DM);
  });

  it('a SNOT ROCKET glob deals the 4 base with a bare gun', () => {
    run({}, { snot: 1 });
    expect(P.snotGlob(100, 100).dmg).toBeCloseTo(4);
  });

  it('a SNOT ROCKET glob scales with the gun multiplier and keeps its pierce', () => {
    run(...STRONG);
    const g = P.snotGlob(100, 100);
    expect(g.dmg).toBeCloseTo(4 * STRONG_DM);
    expect(g.pierce).toBe(8);
  });
});
