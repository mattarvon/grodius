// A DRIFT kind withdraws on its own (ufo.ts updUfo), never through midLeave, so the MidSim.leave hook is fired by that
// block itself. This runs the real Saucer update with a stub leave hook and checks it fires once, on the first withdraw frame.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// ufo.ts pulls in DOM/canvas/audio modules at import time; stub them (the midboss-hp.test.ts pattern)
vi.mock('../../src/core', () => ({ PH: 270, R: () => .99, TAU: Math.PI * 2, W: 480, clamp: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)), dist2: () => 1e9, lerp: (a: number, b: number, t: number) => a + (b - a) * t, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/world', () => ({ ceilAt: () => 0, enemies: [], eshots: [], floorAt: () => 0 }));
vi.mock('../../src/boss/update', () => ({ startBoss: () => {} }));
vi.mock('../../src/enemies/update', () => ({ bandFit: () => {}, dropCap: () => {}, lob: () => {}, midLeave: () => false }));
vi.mock('../../src/enemies/spawn', () => ({ aimA: () => 0, banner: () => {}, every: () => false, fan: () => {}, miniWarn: () => {}, mk: () => ({}), ring: () => {}, wrapA: (a: number) => a }));
vi.mock('../../src/player', () => ({ playerHit: () => {} }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, spark: () => {} }));

const { MID_SIM } = await import('../../src/enemies/mid/roster');
await import('../../src/enemies/mid/ufo');

describe('the Saucer (DRIFT) withdraw', () => {
  beforeEach(() => {
    $.G = { loop: 0, stage: 0, scroll: 0, rank: 0, shake: 0, eat: 1 };
    $.P = { x: 90, y: 135, alive: false };
  });

  it('fires the leave hook exactly once, on the first withdraw frame, then slides off', () => {
    // Arrange: a stub hook on the real registered kind (restored after)
    const sim = MID_SIM.ufo, prev = sim.leave;
    let left = 0;
    sim.leave = () => { left++; };
    const e: any = { k: 'ufo', x: 300, y: 135, tx: 380, hp: 80, max: 80, t: 0, leave: 50, exitX: 1e9, st: 'idle', ll: 0, wt: 0, cool: 99, att: 0 };
    try {
      // Act: step past the leave timer
      for (let i = 0; i < 60; i++) { e.t++; sim.update(e); if (i === 48) expect(left).toBe(0); }
      // Assert
      expect(left).toBe(1);
      expect(e.gone).toBe(1);
      expect(e.x).toBeGreaterThan(300);
    } finally { sim.leave = prev; }
  });

  it('fires it when the scroll reaches the forced exit before the timer', () => {
    const sim = MID_SIM.ufo, prev = sim.leave;
    let left = 0;
    sim.leave = () => { left++; };
    const e: any = { k: 'ufo', x: 300, y: 135, tx: 380, hp: 80, max: 80, t: 0, leave: 1000, exitX: 100, st: 'idle', ll: 0, wt: 0, cool: 99, att: 0 };
    try {
      $.G.scroll = 200;
      for (let i = 0; i < 5; i++) { e.t++; sim.update(e); }
      expect(left).toBe(1);
    } finally { sim.leave = prev; }
  });
});
