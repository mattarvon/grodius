// THE WATCHER (g5, enemies/watcher.ts) through the real enemies/spawn.ts + enemies/update.ts on long4, DOM-side
// modules stubbed (the roster-g3.test.ts pattern): its spawn and band clamp, the >= 36 f blink tell before every shot,
// one atomic orb against the scroll cap (refused: a 20 f retry that replays the whole tell), coolFor('watcher'), the
// x.3 damage share with the lid shut, and the capsule it always carries
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const noop = () => {};
const W = vi.hoisted(() => ({ enemies: [] as any[], eshots: [] as any[], caps: [] as any[], orbs: [] as any[], geysers: [] as any[], draws: 0, ceil: 0, floor: 224 }));
vi.mock('../../src/core', () => ({
  FIRE: [], PH: 254, W: 480, TAU: Math.PI * 2, R: () => { W.draws++; return .5; }, rr: (a: number) => a, ri: (a: number) => a, pick: (a: any[]) => a[0],
  clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  dist2: (a: number, b: number, c: number, d: number) => (a - c) ** 2 + (b - d) ** 2, sstep: (v: number) => v,
}));
vi.mock('../../src/save', () => ({ SET: { flashes: true }, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sample: () => false, thr: () => false, bankWant: () => {}, quipAfterKill: () => null, sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/music', () => ({ duckMusic: () => {} }));
vi.mock('../../src/world', () => ({ ...W, ceilAt: () => W.ceil, floorAt: () => W.floor }));
vi.mock('../../src/fx/spawn', () => ({ drop: noop, flash: noop, gib: noop, gore: noop, mist: noop, pop: noop, spark: noop, splat: noop }));
vi.mock('../../src/perks', () => ({ gainXP: noop, pk: () => 0, scabChance: () => .03, spillSlick: noop }));
vi.mock('../../src/stages', () => ({ clearStage: noop, deepPay: () => 1 }));
vi.mock('../../src/mutations', () => ({ countKill: noop }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3, playerHit: noop, slotMaxed: () => false, wardCap: () => 0 }));
vi.mock('../../src/contraptions', () => ({ onKillContraptions: noop }));
vi.mock('../../src/enemies/elite', () => ({ eliteKill: noop, eliteTick: noop }));
vi.mock('../../src/boss/update', () => ({ startBoss: noop }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoWarn: noop, ufoKilled: noop, updUfo: noop }));
vi.mock('../../src/enemies/mid', () => ({}));

const S = await import('../../src/enemies/spawn');
const U = await import('../../src/enemies/update');
const L = await import('../../src/layout');
const WT = await import('../../src/enemies/watcher');
const { coolFor } = await import('../../src/enemies/cadence');
const { BUL } = await import('../../src/notice');
const { WATCH } = WT;

const G0 = () => ({ t: 0, loop: 0, stage: 1, rank: 0, scroll: 0, scrollSpeed: 1, shake: 0, hitstop: 0, pow: 0, score: 0, bio: 0, combo: 0, comboT: 0, kills: 0, maxCombo: 0, st: { kills: 0, chain: 0, spawned: 0 }, warn: [], pend: [] });
beforeEach(() => {
  L.setLayout('long4');
  W.ceil = 0; W.floor = 224;
  W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.orbs.length = 0; W.draws = 0;
  WT.WDIE.length = 0;
  $.T = 0;
  $.G = G0();
  $.P = { x: 60, y: 127, alive: true };
  $.meta = { bio: 0 };
});
const run = (n: number, e: any) => { for (let i = 0; i < n; i++) { $.T++; $.G.t++; if (!e.dead) U.updEnemy(e); } };

describe('THE WATCHER: spawn and flight', () => {
  it('spawns off the right edge on its lane with its stats, one at a time', () => {
    const e = S.watcher(120);
    expect(e).toBeTruthy();
    expect(e.k).toBe('watcher');
    expect(e.x).toBe(480 + WATCH.x0);
    expect(e.y).toBe(120);
    expect(e.r).toBe(15);
    expect(e.score).toBe(3000);
    expect(e.max).toBeCloseTo(40 * e.dm);
    expect(e.cool).toBe(BUL.first.watcher[0]); // ri mocked to its low end
    expect(S.watcher(60)).toBeNull(); // one is up already
  });

  it('refuses a band with no room, and clamps its lane into the band', () => {
    W.ceil = 100; W.floor = 140; // a 40 px gap: no room for a 30 px eye that bobs
    expect(S.watcher(120)).toBeNull();
    W.ceil = 40; W.floor = 224;
    const e = S.watcher(0);
    expect(e.y).toBe(40 + 15 + WATCH.pad);
  });

  it('crosses at .5 px/f, bobbing inside the band, and leaves off the left edge', () => {
    $.P.alive = false; // no shots: flight only
    const e = S.watcher(127), x0 = e.x;
    run(100, e);
    expect(e.x).toBeCloseTo(x0 - 50);
    W.ceil = 90; // the ceiling drops onto its bob: it eases down under it
    let lo = 1e9;
    for (let f = 0; f < 300; f++) { run(1, e); if (f > 60) lo = Math.min(lo, e.y); }
    expect(lo).toBeGreaterThanOrEqual(90 + 15 + WATCH.pad - .5);
    run(1200, e);
    expect(e.dead).toBe(true); // gone off the left edge (updEnemy's x < -50)
    expect((480 + WATCH.x0 + 50) / WATCH.vx / 60).toBeGreaterThan(16); // >= 16 s across (studio: 16-20)
  });
});

describe('THE WATCHER: the blink tell and its one orb', () => {
  it('never shoots without a >= 36 f tell, and only fully on screen', () => {
    const e = S.watcher(127);
    let tellAt = -1, shotAt = -1, xAtTell = 0;
    for (let f = 0; f < 600 && shotAt < 0; f++) {
      run(1, e);
      if (tellAt < 0 && e.st === 'tel') { tellAt = f; xAtTell = e.x; }
      if (W.eshots.length) shotAt = f;
    }
    expect(tellAt).toBeGreaterThan(0);
    expect(xAtTell).toBeLessThan(480 - WATCH.inX);
    expect(shotAt - tellAt).toBeGreaterThanOrEqual(36);
    expect(WATCH.tell).toBeGreaterThanOrEqual(36);
    expect(W.eshots.length).toBe(1);
    expect(W.eshots[0].vx).toBeLessThan(0); // aimed at the ship, to its left
  });

  it('closes then snaps its lid open and dilates through the tell', () => {
    const e = S.watcher(127);
    e.st = 'tel'; e.wt = 0;
    const lid = (w: number) => { e.wt = w; return WT.lidOf(e); }, dil = (w: number) => { e.wt = w; return WT.dilOf(e); };
    expect(lid(0)).toBe(0);
    expect(lid(WATCH.close)).toBe(1);
    expect(lid(WATCH.shut - 1)).toBe(1);
    expect(lid(WATCH.open)).toBe(0);
    expect(dil(WATCH.tell - 1)).toBeGreaterThan(1.5);
    expect(dil(4)).toBe(1);
  });

  it('then cools down by coolFor("watcher"), one orb per tell', () => {
    const e = S.watcher(127);
    e.x = 300; e.cool = 1;
    run(1, e);
    expect(e.st).toBe('tel');
    run(WATCH.tell, e);
    expect(W.eshots.length).toBe(1);
    expect(e.cool).toBe(coolFor('watcher', 0));
    expect(e.cool).toBeGreaterThanOrEqual(140);
    run(100, e);
    expect(W.eshots.length).toBe(1);
  });

  it('refused at the cap: no shot, a 20 f retry, and the whole tell again', () => {
    const e = S.watcher(127);
    e.x = 300; e.cool = 1;
    for (let i = 0; i < 40; i++) W.eshots.push({ x: 200, y: 20, vx: 0, vy: 0, k: 'orb', t: 0 }); // the scroll cap full
    run(1 + WATCH.tell, e);
    expect(W.eshots.length).toBe(40);
    expect(e.st).toBe('drift');
    expect(e.cool).toBe(BUL.retry);
    W.eshots.length = 0;
    run(BUL.retry, e);
    expect(e.st).toBe('tel');
    expect(e.wt).toBeLessThanOrEqual(1);
    run(WATCH.tell - 2, e);
    expect(W.eshots.length).toBe(0); // still telling
    run(2, e);
    expect(W.eshots.length).toBe(1);
  });

  it('holds fire with the ship dead, and drops its tell past x 40', () => {
    const e = S.watcher(127);
    e.x = 300; e.cool = 1; $.P.alive = false;
    run(200, e);
    expect(e.st).toBe('drift');
    expect(W.eshots.length).toBe(0);
    $.P.alive = true; e.x = WATCH.minX + 4; e.cool = 1;
    run(1, e);
    expect(e.st).toBe('tel');
    run(WATCH.tell, e);
    expect(W.eshots.length).toBe(0);
  });
});

describe('THE WATCHER: the weak point and the kill', () => {
  it('takes full damage with the lid open, x.3 while it is shut', () => {
    const e = S.watcher(127);
    e.x = 300;
    e.hp = e.max = 100;
    e.st = 'drift'; e.bph = 50; e.t = 0; // idle blink phase well away
    U.hurt(e, 10, e.x, e.y, 1);
    expect(e.hp).toBeCloseTo(90);
    e.st = 'tel'; e.wt = WATCH.close + 2; // shut
    U.hurt(e, 10, e.x, e.y, 1);
    expect(e.hp).toBeCloseTo(87);
  });

  it('always drops a capsule (no keep roll) and leaves its death for the render', () => {
    const e = S.watcher(127);
    expect(e.cap).toBe(true);
    expect(W.draws).toBe(0); // no R() at the spawn: no keep roll
    U.killEnemy(e, 1);
    expect(W.caps.length).toBe(1);
    expect(WT.WDIE.length).toBe(1);
    expect(WT.WDIE[0].ang).toBeCloseTo(Math.atan2(127 - e.y, 60 - e.x)); // the iris remembers the ship
  });
});
