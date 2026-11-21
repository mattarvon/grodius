// The midbosses' area denial (D61 Pass 1) through each kind's real update (enemies/update.ts updEnemy), the shared modules
// stubbed (the keepsake-sim.test.ts pattern): the Choir's lane and its nail column, the Womb's pools planted by its spray
// globs, the Apprentice's hook (tell, throw, bite, reel), the Brood Mother's phase-2 litter from behind.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const noop = () => {};
const W = vi.hoisted(() => ({ enemies: [] as any[], eshots: [] as any[], caps: [] as any[], orbs: [] as any[], geysers: [] as any[] }));
const S = vi.hoisted(() => ({ hits: 0 }));
vi.mock('../../src/core', () => ({
  FIRE: ['#f80'], PH: 254, W: 480, TAU: Math.PI * 2, R: () => .5, rr: (a: number) => a, ri: (a: number) => a, pick: (a: any[]) => a[0],
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
vi.mock('../../src/player', () => ({ WARD_MAX: 3, playerHit: () => { S.hits++; return true; }, slotMaxed: () => false }));
vi.mock('../../src/contraptions', () => ({ onKillContraptions: noop }));
vi.mock('../../src/enemies/elite', () => ({ eliteKill: noop, eliteTick: noop }));
vi.mock('../../src/enemies/spawn', async () => {
  const { MID_ET } = await import('../../src/enemies/mid/roster');
  return {
    BS: () => 1, aimA: () => Math.PI, wrapA: (a: number) => a, fan: noop, ring: noop, every: () => false, onScreen: () => true,
    eshoot: (x: number, y: number, a: number, sp: number, k: string) => { W.eshots.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a, k, r: 4 }); },
    banner: noop, miniWarn: noop,
    mk: (k: string, x: number, y: number, o: any = {}) => {
      const b = MID_ET[k] || { hp: k === 'hatch' ? 1 : 16, r: k === 'hatch' ? 5 : 9 };
      const e: any = { k, x, y, vx: 0, vy: 0, t: 0, flash: 0, rot: 0, dead: false, ...b, ...o };
      e.hp = b.hp * (o.hpm || 1); e.max = e.hp; W.enemies.push(e);
      return e;
    },
  };
});

const { updEnemy } = await import('../../src/enemies/update');
const { MID_SIM } = await import('../../src/enemies/mid/roster');
const { DN, LP, poolStage } = await import('../../src/enemies/mid/_deny');
const SP = await import('../../src/enemies/spawn');
const L = await import('../../src/layout');

/** a midboss as enemies/spawn.ts midboss() makes it, settled at its spot and past its entrance */
function spawn(k: string) {
  const e: any = (SP as any).mk(k, 388, 127, { title: k, tx: 388, st: 'idle', wt: 0, cool: 0, att: 0, ba: -2.3, leave: 1e9 });
  MID_SIM[k].onSpawn?.(e);
  e.t = 200;
  $.G.mini = e;
  return e;
}
const step = (e: any, n = 1) => { for (let i = 0; i < n && !e.dead; i++) updEnemy(e); };

beforeEach(() => {
  L.setLayout('long4');
  W.enemies.length = 0; W.eshots.length = 0;
  S.hits = 0;
  $.G = { loop: 0, stage: 1, rank: 0, score: 0, bio: 0, combo: 0, comboT: 0, kills: 0, maxCombo: 0, scroll: 0, shake: 0, hitstop: 0, white: 0, st: { kills: 0, chain: 0 }, pend: [], warn: [] };
  $.P = { x: 200, y: 100, alive: true };
  $.meta = { bio: 0, lv: {} };
});

describe('THE NAIL CHOIR: the lane', () => {
  it('takes every DN.lEvery-th attack, locked on the ship, and its tell never hurts', () => {
    const e = spawn('choir');
    e.att = DN.lEvery - 1;
    step(e);
    expect(e.st).toBe('lane');
    expect(e.lp).toBe(LP.tel);
    expect(e.ly0).toBe(100); // the bar flies there over DN.lFly
    expect(e.lb).toBe(e.bars[0]);
    $.P.y = 300; step(e, 3); $.P.y = 100; // the lane stays where it locked
    expect(e.ly0).toBe(100);
    step(e, DN.lTel - 4); // wt DN.lTel - 1
    expect(e.lp).toBe(LP.tel);
    expect(S.hits).toBe(0);
    step(e);
    expect(e.lp).toBe(LP.out);
  });
  it('sweeps the bar the width of the screen and back, hitting a ship on the lane both ways', () => {
    const e = spawn('choir');
    e.att = DN.lEvery - 1;
    step(e, DN.lTel + 1);
    const x0 = e.lx;
    let n = 0;
    while (e.lp === LP.out && n++ < 200) step(e);
    expect(e.lp).toBe(LP.back);
    expect(e.lx).toBeLessThan(0);
    expect(S.hits).toBeGreaterThan(0);
    const h = S.hits;
    $.P.y = 100 + DN.lHH + 10; // step off the lane: the back sweep misses
    while (e.lp === LP.back && n++ < 400) step(e);
    expect(S.hits).toBe(h);
    expect(e.st).toBe('idle');
    expect(e.lp).toBe(LP.home);
    expect(e.lx).toBeGreaterThan(x0 - 2 * DN.lBack); // back at the mouth (this frame's flight home has begun)
    step(e, DN.lHome + 1);
    expect(e.lp).toBe(0);
    expect(e.lb).toBe(null);
  });
  it('drives the loose bar along the lane (its ox, oy follow the lane)', () => {
    const e = spawn('choir');
    e.att = DN.lEvery - 1;
    step(e, DN.lTel + 10);
    const b = e.bars[0];
    expect(e.x + b.ox).toBeCloseTo(e.lx, 6);
    expect(e.y + b.oy).toBeCloseTo(e.ly, 6);
  });
  it('ends the lane when the loose bar is shot off it', () => {
    const e = spawn('choir');
    e.att = DN.lEvery - 1;
    step(e, DN.lTel + 4);
    e.bars[0].dead = true;
    step(e);
    expect(e.st).toBe('idle');
    expect(e.lp).toBe(0);
  });
  it('spits a column of nails down the lane when no bar is left', () => {
    const e = spawn('choir');
    for (const b of e.bars) b.dead = true;
    e.att = DN.lEvery - 1;
    step(e, DN.lTel + 1);
    const sp = W.eshots.filter((s) => s.k === 'spike');
    expect(sp.length).toBe(DN.lSpikes);
    for (const s of sp) { expect(s.a).toBe(Math.PI); expect(Math.abs(s.y - 100)).toBeLessThanOrEqual(DN.lHH); }
    expect(e.st).toBe('idle');
  });
  it('sends the bar home when it withdraws mid-lane', () => {
    const e = spawn('choir');
    e.att = DN.lEvery - 1;
    step(e, DN.lTel + 6);
    e.leave = e.t; // its clock runs out
    step(e);
    expect(e.lp).toBe(LP.home);
    step(e, DN.lHome + 1);
    expect(e.lp).toBe(0);
  });
});

describe('THE DISSOLVING WOMB: acid pools', () => {
  it('marks every spray glob to pool where it strikes, and the pool burns only after its tell', () => {
    const e = spawn('cyst');
    e.st = 'spray'; e.wt = 4; // the next frame lobs
    step(e);
    const g = W.eshots.find((s) => s.k === 'glob');
    expect(g && typeof g.land).toBe('function');
    g.x = 150; g.y = 226; // it strikes the floor (224) at screen x 150
    g.land(g);
    expect(e.pn).toBe(1);
    expect(e.pX[0]).toBe(150);
    expect(e.pY[0]).toBe(224);
    expect(e.pS[0]).toBe(1);
    expect(e.pR[0]).toBeGreaterThan(0);
    $.P = { x: 150, y: 214, alive: true };
    e.st = 'idle'; e.cool = 1e9;
    step(e, DN.plArm - 2);
    expect(S.hits).toBe(0);
    step(e, 3);
    expect(poolStage(e.t - e.pT[0])).toBe(1);
    expect(S.hits).toBeGreaterThan(0);
  });
  it('plants on the ceiling when the glob strikes it, and not at all in open space or after it is gone', () => {
    const e = spawn('cyst');
    e.st = 'spray'; e.wt = 4;
    step(e);
    const g = W.eshots.find((s) => s.k === 'glob');
    g.x = 200; g.y = -1; g.land(g);
    expect(e.pS[0]).toBe(-1);
    e.gone = 1; g.x = 300; g.y = 230; g.land(g);
    expect(e.pn).toBe(1);
  });
});

describe("THE APPRENTICE: the hook", () => {
  it('tells, throws to the screen edge, bites, holds, reels in, and is done', () => {
    const e = spawn('prentice');
    $.P = { x: 90, y: 40, alive: true }; // off the line (the aim is mocked to straight left)
    e.att = 1;
    step(e);
    expect(e.st).toBe('htel');
    const y0 = e.y;
    step(e, DN.hTel);
    expect(e.st).toBe('hook');
    expect(e.y).toBe(y0); // it holds still on its line
    let n = 0;
    while (e.st === 'hook' && n++ < 200) step(e);
    expect(e.st).toBe('bite');
    expect(e.x + DN.hOx - e.hd).toBeLessThanOrEqual(2); // the far edge
    expect(S.hits).toBe(0);
    $.P = { x: 200, y: e.y + DN.hOy, alive: true }; // on the taut chain
    step(e);
    expect(S.hits).toBe(1);
    $.P = { x: 200, y: 40, alive: true };
    step(e, DN.hBite);
    expect(e.st).toBe('reel');
    while (e.st === 'reel' && n++ < 400) step(e);
    expect(e.st).toBe('idle');
    expect(e.hd).toBe(0);
  });
  it('catches a ship on its line with the thrown tip', () => {
    const e = spawn('prentice');
    e.att = 1;
    step(e);
    $.P = { x: 200, y: e.y + DN.hOy, alive: true };
    let n = 0;
    while ((e.st === 'htel' || e.st === 'hook') && n++ < 300 && !S.hits) step(e);
    expect(S.hits).toBe(1);
    expect(e.st).toBe('hook');
  });
  it('keeps the cleaver lunge and the spit in its turn order (lunge, hook, spit)', () => {
    const e = spawn('prentice');
    $.P = { x: 90, y: 40, alive: true };
    step(e);
    expect(e.st).toBe('tel'); // att 1
    e.st = 'idle'; e.wt = 0; e.cool = 0; e.att = 2;
    step(e);
    expect(e.st).toBe('spit'); // att 3
  });
});

describe('THE BROOD MOTHER: the litter from behind', () => {
  it('births from her mouth in phase 1', () => {
    const e = spawn('brood');
    step(e);
    expect(e.st).toBe('birth');
    expect(e.rear).toBe(0);
    step(e, 44);
    const kids = W.enemies.filter((q) => q.k === 'hatch');
    expect(kids.length).toBeGreaterThan(0);
    for (const k of kids) { expect(k.fromLeft).toBeFalsy(); expect(k.x).toBeGreaterThan(300); }
  });
  it('in phase 2 warns BEHIND at the ship height for its tell, then the litter comes in off the left edge', () => {
    const e = spawn('brood');
    e.hp = e.max * .4;
    $.P.y = 150;
    step(e);
    expect(e.st).toBe('birth');
    expect(e.rear).toBe(1);
    expect($.G.warn.length).toBe(1);
    expect($.G.warn[0].y).toBe(150);
    expect($.G.warn[0].t).toBe(DN.bTel);
    step(e, DN.bTel - 2);
    expect(W.enemies.filter((q) => q.k === 'hatch').length).toBe(0);
    step(e, 2);
    const kids = W.enemies.filter((q) => q.k === 'hatch');
    expect(kids.length).toBeGreaterThan(0);
    for (const k of kids) { expect(k.fromLeft).toBe(1); expect(k.kid).toBe(1); expect(k.x).toBeLessThan(0); expect(Math.abs(k.y - 150)).toBeLessThanOrEqual(DN.bDy); }
  });
});
