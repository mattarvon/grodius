// D61 Pass 1, "it notices you" (src/notice.ts): passed sentries and mutants turn and fire one volley back, Descent 2+
// dive drones that missed U-turn once, flayers re-park ahead of the ship, and the aimed-hazard rules. The sim is driven
// through the real enemies/update.ts updEnemy with the shared modules stubbed (the keepsake-sim.test.ts pattern).
// Each new threat keeps D59's fairness rules: a tell of at least 44 f, and never from off the left edge.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const noop = () => {};
const W = vi.hoisted(() => ({ enemies: [] as any[], eshots: [] as any[], caps: [] as any[], orbs: [] as any[], geysers: [] as any[] }));
vi.mock('../../src/core', () => ({
  FIRE: [], PH: 254, W: 480, TAU: Math.PI * 2, R: () => .5, rr: (a: number) => a, ri: (a: number) => a, pick: (a: any[]) => a[0],
  clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  dist2: (a: number, b: number, c: number, d: number) => (a - c) ** 2 + (b - d) ** 2, sstep: (v: number) => v,
}));
vi.mock('../../src/save', () => ({ SET: { flashes: true }, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sample: () => false, thr: () => false, bankWant: () => {}, quipAfterKill: () => null, sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/music', () => ({ duckMusic: () => {} }));
vi.mock('../../src/world', () => ({ ...W, ceilAt: () => 0, floorAt: () => 224 }));
vi.mock('../../src/fx/spawn', () => ({ drop: noop, flash: noop, gib: noop, gore: noop, mist: noop, pop: noop, spark: noop, splat: noop }));
vi.mock('../../src/perks', () => ({ gainXP: noop, pk: () => 0, spillSlick: noop }));
vi.mock('../../src/stages', () => ({ clearStage: noop, deepPay: () => 1 }));
vi.mock('../../src/mutations', () => ({ countKill: noop }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3, playerHit: noop, slotMaxed: () => false }));
vi.mock('../../src/contraptions', () => ({ onKillContraptions: noop }));
vi.mock('../../src/enemies/elite', () => ({ eliteKill: noop, eliteTick: noop }));
vi.mock('../../src/enemies/spawn', () => ({
  BS: () => 1, wrapA: (a: number) => Math.atan2(Math.sin(a), Math.cos(a)), fan: noop, ring: noop, every: () => false,
  aimA: (x: number, y: number) => Math.atan2($.P.y - y, $.P.x - x), onScreen: (e: any) => e.x > -10 && e.x < 474,
  eshoot: (x: number, y: number, a: number, sp: number, k = 'orb') => { W.eshots.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, k, f: $.T }); },
  banner: noop, mk: noop,
}));

const { updEnemy } = await import('../../src/enemies/update');
const { NOTICE, HAZ_WARM, flayHunts, flayerTx, hazAimed, hazLeadX, hazReach } = await import('../../src/notice');

/** step one enemy n frames, $.T counting frames */
const run = (e: any, n: number) => { for (let i = 0; i < n; i++) { $.T++; updEnemy(e); } };

beforeEach(() => {
  W.enemies.length = 0; W.eshots.length = 0;
  $.T = 0;
  $.G = { loop: 0, stage: 0, rank: 0, scroll: 0, scrollSpeed: 1, shake: 0, hitstop: 0, pow: 0 };
  $.P = { x: 260, y: 100, alive: true };
});

describe('a passed sentry fires one burst back (D61)', () => {
  const sentry = (x = 200) => ({ k: 'sentry', x, tx: x, y: 100, y0: 100, st: 'hover', wt: 0, cool: 9999, shots: 0, t: 100, ph: 0, flash: 0 });

  it('turns once the ship is 20 px past it, tells >= 44 f down its aim line, then fires back at the ship', () => {
    const e = sentry();
    run(e, 1);
    expect(e.st).toBe('tel');
    expect(e.bk).toBe(1);
    run(e, 120);
    const back = W.eshots.filter((s) => s.vx > 0);
    expect(back.length).toBe(3); // the Descent 1 burst
    expect(back[0].f - 1).toBeGreaterThanOrEqual(44); // the tell: the first round flies on frame 54
    expect(e.st).toBe('hover');
    expect(e.shots).toBe(0); // its two forward bursts are not spent
  });

  it('turns only once', () => {
    const e = sentry();
    run(e, 600);
    expect(W.eshots.filter((s) => s.vx > 0).length).toBe(3);
  });

  it('never turns near the left edge, nor while the ship is still ahead of it', () => {
    const a = sentry(30);
    run(a, 120);
    expect(a.back).toBeUndefined();
    $.P.x = 190; // within the 20 px gap
    const b = sentry(200);
    run(b, 120);
    expect(b.back).toBeUndefined();
  });

  it('a leaving sentry turned round holds its x while it aims, and leaves again after', () => {
    const e = { ...sentry(), st: 'leave', tx: 400 };
    run(e, 1);
    expect(e.st).toBe('tel');
    const x0 = e.x;
    run(e, 40);
    expect(e.x).toBe(x0); // no lerp back to tx
    run(e, 60);
    expect(e.st).toBe('leave');
  });
});

describe('a passed mutant hurls back once (D61)', () => {
  const mutant = () => ({ k: 'mutant', x: 200, y: 188, fy: 206, st: 'walk', wt: 0, cool: 9999, spd: 0, t: 100, flash: 0 });

  it('turns round, rears up 44 f, and lobs 3 chunks back toward the ship', () => {
    const e = mutant();
    run(e, 1);
    expect(e.st).toBe('tel');
    expect(e.bk).toBe(1);
    run(e, 60);
    const lobs = W.eshots.filter((s) => s.k === 'glob');
    expect(lobs.length).toBe(3);
    expect(lobs.every((s) => s.vx > 0)).toBe(true);
    expect(lobs[0].f - 1).toBeGreaterThanOrEqual(44);
    expect(lobs[0].x).toBeGreaterThan(e.x - 5); // thrown from behind it, not its front hand
    run(e, 400);
    expect(W.eshots.filter((s) => s.k === 'glob').length).toBe(3); // once
    expect(e.bk).toBe(0);
  });
});

describe('a Descent 2+ dive drone that missed U-turns once (D61)', () => {
  const drone = () => ({ k: 'drone', pat: 'dive', x: 120, y: 60, vy: 0, t: 50, turn: 1, i: 0, flash: 0 });

  it('Descent 1 keeps the pass-through dive', () => {
    const e = drone();
    $.P.x = 200;
    run(e, 30);
    expect(e.ut).toBeUndefined();
    expect(e.x).toBeLessThan(120);
  });

  it('brakes through a >= 44 f tell with its lane locked for the last part, then flies straight back right', () => {
    $.G.loop = 1;
    $.P.x = 200;
    const e = drone();
    run(e, 1);
    expect(e.ut).toBe(1);
    const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < NOTICE.uTel + 30; i++) { run(e, 1); xs.push(e.x); ys.push(e.y); }
    expect(NOTICE.uTel).toBeGreaterThanOrEqual(44);
    // during the tell it never moves right; it drifts at most ~18 px left
    for (let i = 1; i < NOTICE.uTel - 1; i++) expect(xs[i]).toBeLessThanOrEqual(xs[i - 1] + 1e-9);
    expect(xs[0] - xs[NOTICE.uTel - 2]).toBeLessThan(20);
    // the lane locks: y holds from the lock to the end of the run
    const lk = NOTICE.uTel - NOTICE.uLock;
    for (let i = lk + 1; i < ys.length; i++) expect(ys[i]).toBe(ys[lk]);
    expect(e.ut).toBe(2);
    expect(xs[xs.length - 1] - xs[xs.length - 2]).toBeCloseTo(NOTICE.uVx);
  });

  it('never starts a U-turn near the left edge', () => {
    $.G.loop = 2;
    $.P.x = 200;
    const e = { ...drone(), x: 30 };
    run(e, 5);
    expect(e.ut).toBeUndefined();
  });
});

describe('flayers hunt (D61)', () => {
  const flayer = () => ({ k: 'flayer', x: 400, tx: 400, y: 100, y0: 100, ws: 'idle', wt: 0, cool: 9999, t: 10, ang: Math.PI, flash: 0, hunt: 1 }); // a hunter (D62: spawn.ts marks every NOTICE.flayEvery-th)

  it('re-parks 90 px ahead of the ship while idle', () => {
    $.P.x = 100;
    const e = flayer();
    run(e, 1);
    expect(e.tx).toBe(190);
    $.P.x = 150;
    run(e, 1);
    expect(e.tx).toBe(240);
  });

  it('leaves a non-hunter at its spawn x (D62)', () => {
    $.P.x = 100;
    const e = { ...flayer(), hunt: 0 };
    run(e, 1);
    expect(e.tx).toBe(400);
  });

  it('holds its spot through the 34 f tell', () => {
    $.P.x = 100;
    const e = { ...flayer(), ws: 'tel' };
    run(e, 1);
    expect(e.tx).toBe(400);
  });
});

describe('the aimed-hazard rules (D61)', () => {
  it('aims every NOTICE.hazEvery-th column hazard (hazEveryD3 from Descent 3), never a strand (D62: 6 and 4)', () => {
    const N = 12, d1 = Array.from({ length: N }, (_, i) => hazAimed(i + 1, 0, 'icicle'));
    expect(d1).toEqual(Array.from({ length: N }, (_, i) => (i + 1) % NOTICE.hazEvery === 0));
    expect(Array.from({ length: N }, (_, i) => hazAimed(i + 1, 2, 'jet'))).toEqual(Array.from({ length: N }, (_, i) => (i + 1) % NOTICE.hazEveryD3 === 0));
    expect(hazAimed(NOTICE.hazEvery, 0, 'strand')).toBe(false);
  });

  it('hunts with every NOTICE.flayEvery-th flayer (D62)', () => {
    expect(Array.from({ length: 6 }, (_, i) => flayHunts(i + 1))).toEqual(Array.from({ length: 6 }, (_, i) => (i + 1) % NOTICE.flayEvery === 0));
  });

  it('every hazard it aims has a warm-up tell of at least 44 f (D59)', () => {
    for (const k of Object.keys(HAZ_WARM)) expect(HAZ_WARM[k]).toBeGreaterThanOrEqual(44);
  });

  it('leads the ship by the scroll over the time to reach it, so a parked ship is under it then', () => {
    const t = hazReach('icicle', 16, 100);
    expect(t).toBeGreaterThan(HAZ_WARM.icicle);
    expect(hazLeadX('icicle', 100, 100, 1, 16, 480)).toBeCloseTo(100 + t);
    expect(hazLeadX('geyser', 100, 100, 1, 0, 480)).toBe(100 + HAZ_WARM.geyser + NOTICE.hazPad);
    expect(hazLeadX('jet', 470, 100, 1, 0, 480)).toBeLessThanOrEqual(480 * .92); // never off the right edge
    expect(hazLeadX('jet', 0, 100, 0, 0, 480)).toBeGreaterThanOrEqual(16);
  });

  it('the flayer parking x is clamped on screen', () => {
    expect(flayerTx(-60, 480)).toBe(NOTICE.flayLo);
    expect(flayerTx(470, 480)).toBe(480 * NOTICE.flayHi);
  });
});

describe('the hunting flayer tells honestly (D61)', () => {
  it('locks its aim for the last flayLock f of the 34 f tell and stops drifting to the ship\'s height', () => {
    $.P.x = 100; $.P.y = 100;
    const e: any = { k: 'flayer', x: 190, tx: 190, y: 100, y0: 100, ws: 'tel', wt: 0, cool: 0, t: 10, ang: Math.PI, flash: 0 };
    run(e, 34 - NOTICE.flayLock);
    const a = e.ang, y0 = e.y0;
    $.P.y = 160; // the ship steps off the line during the lock
    run(e, NOTICE.flayLock - 1);
    expect(e.ws).toBe('tel');
    expect(e.ang).toBe(a);
    expect(e.y0).toBe(y0);
  });
});
