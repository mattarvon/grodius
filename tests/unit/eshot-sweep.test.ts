// Matt (BRUTAL, pass2): "some of the green enemy weapons pass through me". Every green thing that flies is an enemy
// shot (shots.ts updateEShots: orb, glob, spike, THE KEEPSAKE's forks), and its hit test was a point test at the end
// of each frame: a shot whose path crossed the ship's core between two tests, the ship moving too, went through. This
// drives updateEShots with the shared modules stubbed (the butcher-hook.test.ts pattern) across two frames.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const noop = () => {};
const W = vi.hoisted(() => ({ enemies: [] as any[], eshots: [] as any[], caps: [] as any[], shots: [] as any[] }));
const S = vi.hoisted(() => ({ hits: 0 }));
vi.mock('../../src/core', () => ({
  FIRE: [], PH: 254, W: 480, TAU: Math.PI * 2, R: () => .5, rr: (a: number) => a, ri: (a: number) => a, pick: (a: any[]) => a[0],
  clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)),
  dist2: (a: number, b: number, c: number, d: number) => (a - c) ** 2 + (b - d) ** 2,
  swapRm: (a: any[], i: number) => { a[i] = a[a.length - 1]; a.pop(); },
}));
vi.mock('../../src/srnd', () => ({ sri: () => 0 }));
vi.mock('../../src/save', () => ({ SET: { flashes: true }, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/world', () => ({ ...W, ceilAt: () => -70, floorAt: () => 400 }));
vi.mock('../../src/fx/spawn', () => ({ addDecal: noop, drop: noop, flash: noop, gib: noop, gore: noop, mist: noop, pop: noop, spark: noop, splat: noop }));
vi.mock('../../src/perks', () => ({ gainXP: noop, pk: () => 0 }));
vi.mock('../../src/enemies/spawn', () => ({ banner: noop, wrapA: (a: number) => a }));
vi.mock('../../src/enemies/update', () => ({ METER_CAP: 0, hurt: noop, killEnemy: noop, podType: () => 0, updEnemy: noop }));
vi.mock('../../src/enemies/mid/roster', () => ({ midMul: () => 1 }));
vi.mock('../../src/boss/update', () => ({ bossHitByShot: () => false }));
vi.mock('../../src/mutations', () => ({ chainArc: noop, critMul: () => 1, gmL: () => 0, graftTake: noop }));
vi.mock('../../src/player', () => ({ applyPower: noop, meterAdvance: noop, slotMaxed: () => false, playerHit: () => { S.hits++; return false; } }));
vi.mock('../../src/render/util', () => ({ light: noop }));
vi.mock('../../src/fx/gunfx', () => ({ impact: noop, ring: noop, smoke: noop, stepGunFX: noop }));

const { updateEShots, eshotTouches } = await import('../../src/shots');

/** one frame: the ship moves from where it was to (px, py) (updatePlayer runs first), then the shots move and test */
function frame(px: number, py: number) {
  $.P.x = px; $.P.y = py;
  updateEShots();
}
/** an orb (r 2) whose path, in the ship's frame, passes `d` px from the core, both ends of the frame outside it */
function crossing(d: number, bvx: number, svx: number, svy: number) {
  // ship velocity (svx, svy), shot velocity (bvx, 0): relative motion v = shot - ship; the closest point sits at d
  // along v's normal, the frame's two ends symmetric about it
  const vx = bvx - svx, vy = -svy, L = Math.hypot(vx, vy), nx = -vy / L, ny = vx / L;
  const ax = d * nx - vx / 2, ay = d * ny - vy / 2; // the shot, relative to the ship, at the last test
  return { ax, ay, bx: ax + vx, by: ay + vy };
}

beforeEach(() => {
  W.eshots.length = 0;
  S.hits = 0;
  ($ as any).G = { scroll: 0 };
  ($ as any).P = { x: 100, y: 100, alive: true, inv: 0, shield: 0, aegis: 0 };
});

describe('enemy shots hit on their path, not only where a frame ends', () => {
  // BRUTAL 3 in Descent 3 at full rank: a sentry orb (sp 1.9) flies 1.9 x BS() = 1.9 x 1.24 x 1.7 x 1.45 = 5.8 px a
  // frame; the ship climbs at THRUST 5, 1.25 + 5 x .42 = 3.35 px a frame. They cross 3.5 px apart, core + orb = 4.6
  const bvx = -5.8, svy = -3.35, R = 2 + 2.6; // core (shots.ts EHIT.ship) + orb
  it('the crossing really does skip the core at both frame ends (the old point test)', () => {
    const c = crossing(3.5, bvx, 0, svy);
    expect(Math.hypot(c.ax, c.ay)).toBeGreaterThan(R);
    expect(Math.hypot(c.bx, c.by)).toBeGreaterThan(R);
  });
  it('an orb crossing the moving ship 3.5 px from its core hits it', () => {
    const c = crossing(3.5, bvx, 0, svy);
    frame(100, 100); // the last test: the ship at (100, 100), nothing in flight
    W.eshots.push({ k: 'orb', x: 100 + c.ax, y: 100 + c.ay, vx: bvx, vy: 0, r: 2, t: 0 });
    frame(100, 100 + svy);
    expect(S.hits).toBe(1);
    expect(W.eshots.length).toBe(0);
  });
  it('the fair hitbox stays small: an orb passing 5 px from the core misses', () => {
    const c = crossing(5, bvx, 0, svy);
    frame(100, 100);
    W.eshots.push({ k: 'orb', x: 100 + c.ax, y: 100 + c.ay, vx: bvx, vy: 0, r: 2, t: 0 });
    frame(100, 100 + svy);
    expect(S.hits).toBe(0);
    expect(W.eshots.length).toBe(1);
  });
  it('i-frames still let a shot through', () => {
    const c = crossing(1, bvx, 0, svy);
    frame(100, 100);
    $.P.inv = 30;
    W.eshots.push({ k: 'orb', x: 100 + c.ax, y: 100 + c.ay, vx: bvx, vy: 0, r: 2, t: 0 });
    frame(100, 100 + svy);
    expect(S.hits).toBe(0);
  });
});

describe('eshotTouches', () => {
  it('a still ship and a still shot: the plain distance test', () => {
    expect(eshotTouches(104, 100, 104, 100, 100, 100, 100, 100, 4.6)).toBe(true);
    expect(eshotTouches(105, 100, 105, 100, 100, 100, 100, 100, 4.6)).toBe(false);
  });
  it('a shot tunnelling through a still ship between frames hits', () => {
    expect(eshotTouches(106, 101, 94, 101, 100, 100, 100, 100, 4.6)).toBe(true);
  });
  it('a placed ship (respawn, stage start) sweeps from where it is now, not across the screen', () => {
    // the ship jumped from (300, 100) to (50, 127): a shot near the old spot never reaches the new one
    expect(eshotTouches(200, 110, 198, 110, 300, 100, 50, 127, 4.6)).toBe(false);
    expect(eshotTouches(53, 127, 51, 127, 300, 100, 50, 127, 4.6)).toBe(true);
  });
});
