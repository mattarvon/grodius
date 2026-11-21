// S2 (ls1-audit): behindWave's lane filter `fit` (biomes.ts rearY for backdraft and pincer). It must reach the telegraph
// and the spawn, and default to the identity so every other caller is unchanged.
// D61 Pass 1 ("it notices you"): the wave comes in at the ship's height (rearLane no longer flips it 60 px clear), and
// the lane is picked once, at the 100 f telegraph, so the warning is where the wave flies.
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
const LANE = 120, SCRIPTED = 60; // the ship flies at LANE; SCRIPTED is the caller's y, used only with no ship

describe('behindWave fit', () => {
  beforeEach(() => {
    $.G = { loop: 0, pow: 0, st: { spawned: 0 }, warn: [], pend: [] };
    $.P = { y: LANE };
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

  // biomes.ts REAR samples the flight from these: the lead's x0 (-16, sampled from -20) and a 3-drone wave's tail (32 px)
  it('spawns a fixed 3-drone wave left of the screen, the lead at x -16 and the last 32 px behind it', () => {
    behindWave(LANE, 3, { fixed: 1 });
    land();
    expect(enemies.map((e) => e.x)).toEqual([-16, -32, -48]);
  });

  it("comes in at the ship's height, not the scripted y (D61)", () => {
    behindWave(SCRIPTED, 3, { fixed: 1 });
    expect($.G.warn[0].y).toBe(LANE);
    expect($.G.warn[0].t).toBe(100); // the 100 f warning is kept
    land();
    expect(enemies.map((e) => e.y)).toEqual([LANE, LANE, LANE]);
  });

  it('keeps the telegraphed lane when the ship moves off it before the spawn', () => {
    behindWave(SCRIPTED, 2, { fixed: 1 });
    $.P.y = LANE + 70; // stepped off during the warning: the wave still flies where it was shown
    land();
    expect(enemies.map((e) => e.y)).toEqual([LANE, LANE]);
  });

  it('falls back to the scripted y with no ship', () => {
    $.P = null;
    behindWave(SCRIPTED, 2, { fixed: 1 });
    expect($.G.warn[0].y).toBe(SCRIPTED);
  });
});
