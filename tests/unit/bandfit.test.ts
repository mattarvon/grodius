// Story type: Logic (merge-2 review, lead-programmer). Gate: BLOCKING. bandFit (enemies/update.ts) eases a relaxing
// side of the terrain band but must clamp it to the other side's hard limit: on a rising slope blo relaxes slowly
// while bhi snaps up, and an unclamped blo above bhi would push the body into the floor
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const T = { ceil: 0, floor: 270 }; // the stub terrain, flat under the body's width
vi.mock('../../src/core', () => ({ FIRE: {}, PH: 270, R: () => .99, TAU: Math.PI * 2, W: 480, clamp: (v: number) => v, dist2: () => 1e9, lerp: (a: number, b: number, t: number) => a + (b - a) * t, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0, sstep: (v: number) => v }));
vi.mock('../../src/save', () => ({ SET: {}, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sample: () => {}, sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/world', () => ({ caps: [], ceilAt: () => T.ceil, enemies: [], eshots: [], floorAt: () => T.floor, geysers: [], orbs: [] }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, gib: () => {}, gore: () => {}, mist: () => {}, pop: () => {}, spark: () => {}, splat: () => {} }));
vi.mock('../../src/perks', () => ({ gainXP: () => {}, pk: () => 0, spillSlick: () => {} }));
vi.mock('../../src/stages', () => ({ clearStage: () => {}, deepPay: () => 1 }));
vi.mock('../../src/enemies/spawn', () => ({ BS: () => 1, aimA: () => 0, banner: () => {}, eshoot: () => {}, every: () => false, fan: () => {}, mk: () => ({}), onScreen: () => true, ring: () => {}, wrapA: (a: number) => a }));
vi.mock('../../src/mutations', () => ({ countKill: () => {} }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3, playerHit: () => {}, slotMaxed: () => false }));
vi.mock('../../src/contraptions', () => ({ onKillContraptions: () => {} }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoKilled: () => {}, updUfo: () => {} }));
vi.mock('../../src/enemies/elite', () => ({ eliteKill: () => {}, eliteTick: () => {} }));

const { bandFit } = await import('../../src/enemies/update');
const { MID_BODY } = await import('../../src/enemies/midhost');

describe('bandFit', () => {
  const k = Object.keys(MID_BODY)[0], B = MID_BODY[k as keyof typeof MID_BODY];
  beforeEach(() => { $.G = { scroll: 0 } as any; });

  it('keeps y no lower than the new hard bottom limit (bhi) when the band rises faster than its eased top relaxes', () => {
    // Arrange: settle the body low in a wide band (ceiling 100), then the terrain rises: ceiling 0 and a floor just
    // 10 px wider than the body, so bhi snaps up while blo eases from ~100 + up by BAND_EASE per frame
    const e: any = { k, x: 200, y: 400 };
    T.ceil = 100; T.floor = 260;
    bandFit(e);
    T.ceil = 0; T.floor = B.up + B.dn + 10;
    const hardHi = T.floor - B.dn;
    // Act
    bandFit(e);
    // Assert
    expect(e.bhi).toBe(hardHi);
    expect(e.blo).toBeLessThanOrEqual(e.bhi);
    expect(e.y).toBeLessThanOrEqual(hardHi);
  });
});
