// THE BURNING BUTCHER's second-half hook (D61): the pure geometry (enemies/butcherhook.ts) and the sim (enemies/update.ts
// 'butcher') driven with the shared modules stubbed (the keepsake-sim.test.ts pattern): the first half keeps its 230 px
// head-only hook; below half HP the tell is >= 44 f and locks, the hook flies the whole screen, plants at the left edge
// (or terrain) as a solid chain for ~90 f, and is reeled home; a ship off the chain's line is never touched.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const noop = () => {};
const W = vi.hoisted(() => ({ enemies: [] as any[], eshots: [] as any[], caps: [] as any[], orbs: [] as any[], geysers: [] as any[] }));
const S = vi.hoisted(() => ({ hits: 0 }));
vi.mock('../../src/core', () => ({
  FIRE: [], PH: 254, W: 480, TAU: Math.PI * 2, R: () => .5, rr: (a: number) => a, ri: (a: number) => a, pick: (a: any[]) => a[0],
  clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  dist2: (a: number, b: number, c: number, d: number) => (a - c) ** 2 + (b - d) ** 2, sstep: (v: number) => v,
}));
vi.mock('../../src/save', () => ({ SET: { flashes: true }, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sample: () => false, thr: () => false, bankWant: () => {}, quipAfterKill: () => null, sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/music', () => ({ duckMusic: () => {} }));
vi.mock('../../src/world', () => ({ ...W, ceilAt: () => -70, floorAt: () => 400 }));
vi.mock('../../src/fx/spawn', () => ({ drop: noop, flash: noop, gib: noop, gore: noop, mist: noop, pop: noop, spark: noop, splat: noop }));
vi.mock('../../src/perks', () => ({ gainXP: noop, pk: () => 0, spillSlick: noop }));
vi.mock('../../src/stages', () => ({ clearStage: noop, deepPay: () => 1 }));
vi.mock('../../src/mutations', () => ({ countKill: noop }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3, playerHit: () => { S.hits++; }, slotMaxed: () => false }));
vi.mock('../../src/contraptions', () => ({ onKillContraptions: noop }));
vi.mock('../../src/enemies/elite', () => ({ eliteKill: noop, eliteTick: noop }));
vi.mock('../../src/enemies/spawn', async () => ({
  BS: () => 1, aimA: (x: number, y: number) => Math.atan2($.P.y - y, $.P.x - x), wrapA: (a: number) => a, fan: noop, ring: noop,
  every: () => false, onScreen: () => true, eshoot: noop, banner: noop,
  mk: (k: string, x: number, y: number, o: any = {}) => {
    const e: any = { k, x, y, vx: 0, vy: 0, t: 0, flash: 0, rot: 0, dead: false, hp: 300, max: 300, r: 20, ...o };
    W.enemies.push(e);
    return e;
  },
}));

const { updEnemy } = await import('../../src/enemies/update');
const { KH, segDist, hookHits, hookBehind } = await import('../../src/enemies/butcherhook');

describe('butcherhook geometry', () => {
  it('segDist is the distance to the segment, clamped at its ends', () => {
    expect(segDist(0, 0, 10, 0, 5, 3)).toBeCloseTo(3, 9);
    expect(segDist(0, 0, 10, 0, 14, 3)).toBeCloseTo(5, 9);
    expect(segDist(0, 0, 0, 0, 3, 4)).toBeCloseTo(5, 9);
  });
  it('a solid chain hits a ship on its line; the first half is the head alone', () => {
    expect(hookHits(300, 100, 20, 100, 150, 102, true)).toBe(true);
    expect(hookHits(300, 100, 20, 100, 150, 102, false)).toBe(false);
    expect(hookHits(300, 100, 20, 100, 150, 120, true)).toBe(false);
    expect(hookHits(300, 100, 20, 100, 24, 100, false)).toBe(true);
  });
  it('hookBehind: only a ship ahead of the tip and near the ray lets it tear through rock', () => {
    expect(hookBehind(100, 100, -1, 0, true, 20, 110)).toBe(true);
    expect(hookBehind(100, 100, -1, 0, true, 20, 160)).toBe(false);
    expect(hookBehind(100, 100, -1, 0, true, 200, 100)).toBe(false);
    expect(hookBehind(100, 100, -1, 0, false, 20, 100)).toBe(false);
  });
  it("keeps D61's numbers: tell >= 44 f, ~90 f planted, a reel faster than the old pull", () => {
    expect(KH.tell2).toBeGreaterThanOrEqual(44);
    expect(KH.tell2 - KH.lock).toBeGreaterThanOrEqual(30);
    expect(KH.plant).toBe(90);
    expect(KH.back2).toBeGreaterThan(KH.back1);
    expect(KH.reach1).toBe(230);
    expect(KH.reach2).toBeGreaterThan(480);
  });
});

let e: any;
const mkButcher = (frac: number, shipY = 100) => {
  W.enemies.length = 0; S.hits = 0;
  $.G = { scroll: 0, shake: 0, st: { hits: 0 }, banner: null };
  $.P = { x: 40, y: shipY, alive: true };
  e = { k: 'butcher', x: 368, y: 100, vx: 0, vy: 0, t: 400, flash: 0, rot: 0, dead: false, hp: 300 * frac, max: 300, r: 20, tx: 368, st: 'idle', wt: 0, cool: 0, sw: 0, ba: -2.3, hk: null, att: 0, cut: 0 };
  W.enemies.push(e);
  $.G.mini = e;
};
/** run until the Butcher is in state st (or n frames pass); returns the frames it took */
const until = (st: string, n = 600) => { let f = 0; while (e.st !== st && f < n) { updEnemy(e); f++; } return f; };

describe('the second-half hook through updEnemy', () => {
  beforeEach(() => mkButcher(.4));

  it('tells for >= 44 f, locks its line, then flies the whole screen and plants at the left edge', () => {
    e.att = 0; // the next throw: att 1 -> odd -> htel
    until('htel');
    let tell = 0;
    while (e.st === 'htel') { updEnemy(e); tell++; }
    expect(tell).toBeGreaterThanOrEqual(44);
    expect(e.hk && e.hk.v2).toBe(1);
    expect(e.lx).toBeGreaterThan(300);
    let f = 0;
    while (e.hk && !e.hk.pl && f++ < 200) updEnemy(e);
    expect(e.hk.pl).toBe(1); // 340+ px out: past the old 230 reach
    expect(e.hk.tx).toBe(0); // the left edge (the stub terrain is far below)
    expect(e.hk.d).toBeGreaterThan(KH.reach1);
  });

  it('holds ~90 f as a solid chain, hits a ship on its line, then reels home without a hit off it', () => {
    until('htel');
    while (e.st !== 'hook') updEnemy(e);
    while (e.hk && !e.hk.pl) updEnemy(e);
    let held = 0;
    while (e.hk && e.hk.pl) { updEnemy(e); held++; }
    expect(held).toBe(KH.plant);
    expect(S.hits).toBeGreaterThan(0); // the ship sits on the aimed line (y 100 at the left edge)
    // the same throw with the ship parked off the line
    mkButcher(.4);
    until('htel');
    while (e.st !== 'hook') updEnemy(e);
    $.P.y = 220; // dodged during the tell's lock: 120 px off the line
    while (e.st === 'hook') updEnemy(e);
    expect(S.hits).toBe(0);
    expect(e.hk).toBe(null);
    expect(e.cool).toBe(45);
  });

  it('the first half keeps its 230 px head-only hook', () => {
    mkButcher(.9);
    until('htel');
    while (e.st !== 'hook') updEnemy(e);
    expect(e.hk.v2).toBe(undefined);
    let f = 0;
    while (e.hk && e.hk.out && f++ < 200) updEnemy(e);
    expect(e.hk.d).toBeGreaterThan(230);
    expect(e.hk.d).toBeLessThan(245);
    expect(S.hits).toBe(0); // the ship at x 40 is out of reach: the park the first half keeps
  });
});
