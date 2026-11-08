// S2 (ls1-audit): behindWave's lane filter `fit` (biomes.ts rearY for backdraft and pincer). It must reach the telegraph
// and the spawn, the spawn after rearLane's re-pick, and default to the identity so every other caller is unchanged.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// spawn.ts pulls in DOM/canvas/audio modules at import time; stubbed as in formation.test.ts
const enemies: any[] = [];
vi.mock('../../src/core', () => ({ PH: 254, R: () => .99, TAU: Math.PI * 2, W: 480, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: { tele: () => {} } }));
vi.mock('../../src/world', () => ({ ceilAt: () => 0, enemies, eshots: [], floorAt: () => 254 }));
vi.mock('../../src/boss/update', () => ({ startBoss: () => {} }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoWarn: () => {} }));
vi.mock('../../src/enemies/mid', () => ({}));

const { behindWave } = await import('../../src/enemies/spawn');

/** fire the wave's pending spawn (rearWarn's 100 f telegraph, run out) */
const land = () => { const p = $.G.pend.shift(); p.f(); };
const LANE = 120, PLAYER_FAR = 240; // rearLane keeps y when the player is >= 60 px away; PH - 55 = 199 / 55 when not

describe('behindWave fit', () => {
  beforeEach(() => {
    $.G = { loop: 0, pow: 0, st: { spawned: 0 }, warn: [], pend: [] };
    $.P = { y: PLAYER_FAR };
    enemies.length = 0;
  });

  it('is the identity by default: the telegraph and every drone sit on the lane', () => {
    behindWave(LANE, 3, { fixed: 1 });
    expect($.G.warn[0].y).toBe(LANE);
    land();
    expect(enemies.map((e) => e.y)).toEqual([LANE, LANE, LANE]);
  });

  it('applies fit to the telegraph and again to the spawn', () => {
    const fit = vi.fn((v: number) => v - 30);
    behindWave(LANE, 3, { fixed: 1 }, fit);
    expect($.G.warn[0].y).toBe(LANE - 30);
    land();
    expect(fit).toHaveBeenCalledTimes(2);
    expect(enemies.map((e) => e.y)).toEqual([LANE - 60, LANE - 60, LANE - 60]); // fit(rearLane(fit(lane)))
  });

  it('fits the lane rearLane re-picks at spawn time when the player has moved onto it', () => {
    const fit = (v: number) => Math.min(v, 180);
    behindWave(LANE, 2, { fixed: 1 }, fit);
    $.P.y = LANE; // within 60 px: rearLane moves the wave to PH - 55 = 199, which fit then holds at 180
    land();
    expect(enemies.map((e) => e.y)).toEqual([180, 180]);
  });
});
