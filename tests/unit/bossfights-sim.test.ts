// The long4 stage-boss fights (DIFFICULTY-SPEC §2.3, stream W4b) driven through the real enemies/update.ts arms with the
// shared modules stubbed (the butcher-hook.test.ts pattern): THE MAW's bite (46 f tell, a lane that locks, the lunge to
// W*.35, the fan held while it bites), THE BLOAT's nail comb (no spiral) and icicle curtain, the Butcher's single spit
// and meat hooks in place of the ring, the 1200 f half clock, and volley atomicity under the 24 cap.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const noop = () => {};
const W = vi.hoisted(() => ({ enemies: [] as any[], eshots: [] as any[], caps: [] as any[], orbs: [] as any[], geysers: [] as any[] }));
const S = vi.hoisted(() => ({ hits: 0, rings: 0, fans: 0, cleared: 0, banners: [] as string[] }));
vi.mock('../../src/core', () => ({
  FIRE: [], PH: 254, W: 480, TAU: Math.PI * 2, R: () => .5, rr: (a: number) => a, ri: (a: number) => a, pick: (a: any[]) => a[0],
  clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  dist2: (a: number, b: number, c: number, d: number) => (a - c) ** 2 + (b - d) ** 2, sstep: (v: number) => v,
}));
vi.mock('../../src/save', () => ({ SET: { flashes: true }, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sample: () => false, thr: () => false, bankWant: () => {}, quipAfterKill: () => null, sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/music', () => ({ duckMusic: () => {} }));
vi.mock('../../src/world', () => ({ ...W, ceilAt: () => 10, floorAt: () => 244 }));
vi.mock('../../src/fx/spawn', () => ({ drop: noop, flash: noop, gib: noop, gore: noop, mist: noop, pop: noop, spark: noop, splat: noop }));
vi.mock('../../src/perks', () => ({ gainXP: noop, pk: () => 0, spillSlick: noop }));
vi.mock('../../src/stages', () => ({ clearStage: () => { S.cleared++; }, deepPay: () => 1 }));
vi.mock('../../src/mutations', () => ({ countKill: noop }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3, playerHit: () => { S.hits++; }, slotMaxed: () => false }));
vi.mock('../../src/contraptions', () => ({ onKillContraptions: noop }));
vi.mock('../../src/enemies/elite', () => ({ eliteKill: noop, eliteTick: noop }));
vi.mock('../../src/enemies/spawn', async () => ({
  BS: () => 1, aimA: (x: number, y: number) => Math.atan2($.P.y - y, $.P.x - x), wrapA: (a: number) => Math.atan2(Math.sin(a), Math.cos(a)),
  fan: (x: number, y: number, a: number, n: number, sp: number, v: number, k: string) => { S.fans++; for (let i = 0; i < n; i++) W.eshots.push({ x, y, k }); },
  ring: () => { S.rings++; }, every: () => false, onScreen: () => true,
  eshoot: (x: number, y: number, a: number, sp: number, k = 'orb') => { W.eshots.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, k }); },
  banner: (t: string) => { S.banners.push(t); },
  mk: (k: string, x: number, y: number, o: any = {}) => {
    const e: any = { k, x, y, vx: 0, vy: 0, t: 0, flash: 0, rot: 0, dead: false, hp: 7, max: 7, r: 8, ...o };
    W.enemies.push(e);
    return e;
  },
}));

const { updEnemy } = await import('../../src/enemies/update');
const { BLOAT, BUTCHER, HAZ_HOOK, MAW, PHASE_F } = await import('../../src/boss/bossrules');
const F = await import('../../src/boss/bossfights');
const L = await import('../../src/layout');

const reset = (P = { x: 60, y: 60 }) => {
  L.setLayout('long4');
  W.enemies.length = 0; W.eshots.length = 0;
  S.hits = 0; S.rings = 0; S.fans = 0; S.cleared = 0; S.banners.length = 0;
  $.G = { loop: 0, stage: 1, tier: 1, scroll: 0, scrollSpeed: 0, shake: 0, st: { hits: 0 }, banner: null, gm: {}, pend: [] };
  $.P = { x: P.x, y: P.y, alive: true, hist: [] };
};

describe('the rank API and the cap (W0 src/rank.ts)', () => {
  beforeEach(() => reset());
  it('is the long4 gate', () => {
    expect(F.g3()).toBe(true);
    L.setLayout('short');
    expect(F.g3()).toBe(false);
  });
  it('reads the spec rank: a naked ship on Normal in biome A is rank 3, the END D1 kit 14 there, 16 in the Drive', () => {
    expect(F.rankOf()).toBe(3);
    Object.assign($.P, { missile: 2, double: 1, options: 2, wardLv: 2 }); $.G.gm = { cal: 1 };
    expect(F.rankOf()).toBe(14);
    $.G.stage = 3;
    expect(F.rankOf()).toBe(16);
    expect(F.cad()).toBeCloseTo(.65, 9);
    expect(F.variant()).toBe(true);
  });
  it('holds a volley that does not fit under the boss cap, and retries in 20 f', () => {
    $.G.mini = { k: 'crux', mini: 1 }; // a stage boss: the 24 cap (rank.ts capCtx 'boss')
    for (let i = 0; i < 22; i++) W.eshots.push({ k: 'orb' });
    W.eshots.push({ k: 'fork', haz: 1 }); // a planted hazard never counts
    expect(F.room(2)).toBe(true);
    expect(F.room(3)).toBe(false);
    const e: any = {};
    expect(F.due(e, 'x', 3, 1)).toBe(false);
    expect(e.x).toBe(1);
    expect(F.due(e, 'y', 3, 100)).toBe(false);
    expect(F.due(e, 'y', 3, 100)).toBe(false); // 99 left
    e.y = 1;
    expect(F.due(e, 'y', 3, 100)).toBe(false);
    expect(e.y).toBe(20);
  });
});

const mkMaw = (o: any = {}) => {
  const e: any = { k: 'maw', x: 398, y: 127, t: 300, flash: 0, dead: false, hp: 120, max: 120, r: 24, jaw: 0, leave: 1700, stageBoss: false,
    eyesP: Array.from({ length: 9 }, (_, i) => ({ a: -1 + i * .25, r: 12, s: 2, b: 0 })), ...o };
  W.enemies.push(e); $.G.mini = e;
  return e;
};

describe('THE MAW: the bite', () => {
  beforeEach(() => reset());
  it('tells 46 f with its lane locked for the last 16, lunges to W*.35, holds and comes home', () => {
    const e = mkMaw();
    let f = 0;
    while (!e.bs && f++ < 2000) { updEnemy(e); W.eshots.length = 0; }
    expect(e.bs).toBe(1);
    let tell = 0, lane: number[] = [];
    while (e.bs === 1) { $.P.y = 60 + tell * 3; e.t++; updEnemy(e); W.eshots.length = 0; tell++; lane.push(e.ly); }
    expect(tell).toBe(MAW.tell);
    const last = lane.slice(-MAW.lock);
    expect(new Set(last).size).toBe(1); // locked
    expect(lane[0]).not.toBe(last[0]); // it tracked the ship before that
    let minX = 999, held = 0;
    while (e.bs && f++ < 4000) { updEnemy(e); W.eshots.length = 0; minX = Math.min(minX, e.x); if (e.bs === 3) held++; expect(Math.abs(e.y - last[0])).toBeLessThan(1e-6); }
    expect(minX).toBeCloseTo(480 * MAW.lungeX, 6);
    expect(held).toBe(MAW.hold);
    expect(e.x).toBe(480 - 82);
  });
  it('the body hits a ship in its lane (via shots.ts contact): the lunge passes through the ship\'s point', () => {
    const e = mkMaw();
    $.P = { x: 200, y: 140, alive: true, hist: [] };
    let f = 0, through = false;
    while (f++ < 3000) { updEnemy(e); W.eshots.length = 0; if (e.bs === 2 && Math.hypot(e.x - 200, e.y - 140) < 24) through = true; if (through) break; }
    expect(through).toBe(true);
  });
  it('fires a 5-glob fan, never during a bite, and one orb per 90 f x the rank rule', () => {
    const e = mkMaw();
    let fans = 0, orbs = 0, fanInBite = 0, free = 0;
    for (let f = 0; f < 1200; f++) {
      updEnemy(e);
      const g = W.eshots.filter((s) => s.k === 'glob').length, o = W.eshots.filter((s) => s.k === 'orb').length;
      if (g) { fans++; expect(g).toBe(MAW.fanN); if (e.bs) fanInBite++; }
      if (o) expect(e.bs || 0).toBe(0); // no orb through a bite
      if (!e.bs) free++;
      orbs += o;
      W.eshots.length = 0;
    }
    expect(fans).toBeGreaterThanOrEqual(3);
    expect(fanInBite).toBe(0);
    expect(orbs).toBeGreaterThanOrEqual(Math.floor(free / F.iv(MAW.orbEvery)) - 1);
    expect(orbs).toBeLessThanOrEqual(Math.ceil(1200 / F.iv(MAW.orbEvery)) + 1);
  });
  it('does not start a bite near its leave clock, and still leaves at 1700 f', () => {
    const e = mkMaw({ t: 1700 - MAW.quiet + 1 });
    for (let f = 0; f < 400 && !e.dead; f++) { updEnemy(e); W.eshots.length = 0; expect(e.bs || 0).toBe(0); }
    expect(e.x).toBeGreaterThan(398);
  });
});

const mkCrux = (shield = true) => {
  const e: any = { k: 'crux', x: 388, tx: 388, y: 127, t: 141, flash: 0, dead: false, hp: 145, max: 145, r: 20, bars: [] };
  for (let i = 0; i < 4; i++) e.bars.push({ k: 'nailbar', par: e, ox: -24 - i * 7, oy: 0, i, dead: !shield, x: 0, y: 0, hp: 16, max: 16 });
  W.enemies.push(e); $.G.mini = e;
  return e;
};

describe('THE BLOAT', () => {
  beforeEach(() => reset());
  it('bars up: two straight streams of 4 spikes from y +-34 and an aimed 3-fan; no spiral, no ring', () => {
    const e = mkCrux();
    const lanes = new Set<number>(); let spikes = 0, orbs = 0;
    for (let f = 0; f < 600; f++) {
      updEnemy(e);
      for (const s of W.eshots) { if (s.k === 'spike' && Math.abs(s.vy) < 1e-9) { lanes.add(Math.round(s.y - e.y)); spikes++; } if (s.k === 'orb') orbs++; }
      W.eshots.length = 0;
    }
    expect([...lanes].sort((a, b) => a - b)).toEqual([-34, 34]);
    expect(spikes % (BLOAT.comb.n * 2)).toBe(0);
    expect(spikes).toBeGreaterThanOrEqual(BLOAT.comb.n * 2 * 3);
    expect(orbs).toBe(0); // the old spiral and rings were orbs
    expect(S.rings).toBe(0);
  });
  it('core bared: three icicles 60 px apart on the ship\'s column every 150 x the rank rule, one 9-ring, 5 globs', () => {
    const drops: number[][] = []; let batch: number[] = [];
    HAZ_HOOK.drop = (k, x) => { expect(k).toBe('icicle'); batch.push(x); };
    $.P.x = 200;
    const e = mkCrux(false);
    let rings = 0, globs = 0;
    for (let f = 0; f < 900; f++) {
      updEnemy(e);
      if (batch.length) { drops.push(batch); batch = []; }
      const o = W.eshots.filter((s) => s.k === 'orb').length; if (o) { expect(o).toBe(BLOAT.ring.n); rings++; }
      globs += W.eshots.filter((s) => s.k === 'glob').length;
      W.eshots.length = 0;
    }
    HAZ_HOOK.drop = null;
    expect(drops.length).toBeGreaterThanOrEqual(4);
    for (const d of drops) expect(d).toEqual([140, 200, 260]);
    expect(rings).toBeGreaterThanOrEqual(3);
    expect(globs % BLOAT.glob.n).toBe(0);
  });
  it('runs 1200 f halves: out of time in the first half it lurches to 50% and the bars shatter', () => {
    const e = mkCrux();
    e.t = 160;
    for (let f = 0; f < PHASE_F + 2; f++) { updEnemy(e); W.eshots.length = 0; }
    expect(e.hp).toBeLessThan(e.max * .5);
    expect(S.banners).toContain('IT LURCHES ONWARD');
  });
});

const mkButcher = (frac: number) => {
  const e: any = { k: 'butcher', mini: 1, x: 368, y: 100, vx: 0, vy: 0, t: 400, flash: 0, rot: 0, dead: false, hp: 300 * frac, max: 300, r: 20, tx: 368, st: 'idle', wt: 0, cool: 9999, sw: 0, ba: -2.3, hk: null, att: 0, cut: 0 };
  W.enemies.push(e); $.G.mini = e;
  return e;
};

describe('THE BURNING BUTCHER', () => {
  beforeEach(() => reset({ x: 40, y: 200 }));
  it('spits once (was twice)', () => {
    const e = mkButcher(.9);
    e.st = 'spit'; e.wt = 0;
    for (let f = 0; f < 45; f++) updEnemy(e);
    expect(S.fans).toBe(0); // long4 lobs each glob (enemies/update.ts lob), once
    expect(W.eshots.filter((s) => s.k === 'glob')).toHaveLength(BUTCHER.spitN[0]);
  });
  it('second half: no ring; three meat hooks after a 50 f tell, swinging 360 f, then hauled up', () => {
    const e = mkButcher(.4);
    const hooks = () => W.enemies.filter((q) => q.k === 'hook' && !q.dead);
    let f = 0;
    for (; f < BUTCHER.meat.tell; f++) { updEnemy(e); expect(hooks()).toHaveLength(0); }
    updEnemy(e); f++;
    expect(hooks()).toHaveLength(3);
    expect(hooks().map((h) => h.ax)).toEqual([200, 290, 380]);
    expect(e.bars).toBe(e.mh); // killEnemy's stage-boss branch takes them down with it
    for (; f < BUTCHER.meat.tell + BUTCHER.meat.drop + 2; f++) updEnemy(e);
    for (const h of hooks()) expect(h.len).toBeCloseTo(h.ml, 6);
    for (; f < BUTCHER.meat.tell + BUTCHER.meat.drop + BUTCHER.meat.life + BUTCHER.meat.reel + 2; f++) updEnemy(e);
    expect(hooks()).toHaveLength(0);
    expect(S.rings).toBe(0);
  });
});

describe('the long4 half clock and the variants (qa-lead)', () => {
  beforeEach(() => reset({ x: 40, y: 200 }));
  it('pauses while the ship is dead', () => {
    const e = mkCrux();
    e.t = 160; $.P.alive = false;
    for (let f = 0; f < PHASE_F + 10; f++) { updEnemy(e); W.eshots.length = 0; }
    expect(e.hp).toBe(e.max);
    expect(e.pt || 0).toBe(0);
  });
  it('the second half runs out: it retreats, the meat hooks go up unpaid, the stage clears as escaped', () => {
    const e = mkButcher(.4);
    for (let f = 0; f < BUTCHER.meat.tell + 5; f++) updEnemy(e);
    const hooks = W.enemies.filter((q) => q.k === 'hook');
    expect(hooks.filter((h) => !h.dead)).toHaveLength(3);
    $.G.score = 0;
    e.pt = PHASE_F - 1; e.half2 = true;
    updEnemy(e);
    expect([e.pt, e.half2]).toEqual([0, true]);
    expect(e.gone).toBe(1);
    expect(hooks.every((h) => h.dead)).toBe(true);
    expect($.G.score).toBe(0); // reelMeat, not killEnemy: no pay
    for (let f = 0; f < 400 && !e.dead; f++) updEnemy(e);
    expect(e.dead).toBe(true);
    expect(S.cleared).toBe(1);
    expect(S.banners).toContain('IT GOT AWAY');
  });
  it('rank >= 14: the Bloat combs four lanes every other comb, 2 spikes a lane, the core lane open', () => {
    Object.assign($.P, { missile: 2, double: 1, options: 2, wardLv: 2 }); $.G.gm = { cal: 1 };
    expect(F.variant()).toBe(true);
    const e = mkCrux();
    const lanes = new Set<number>();
    for (let f = 0; f < 900; f++) { updEnemy(e); for (const s of W.eshots) if (s.k === 'spike' && Math.abs(s.vy) < 1e-9) lanes.add(Math.round(s.y - e.y)); W.eshots.length = 0; }
    expect([...lanes].sort((a, b) => a - b)).toEqual([-46, -34, -20, 20, 34, 46]);
  });
  it('rank >= 14: the planted chain sweeps its arc home over 30 f, its shudder at 44 f', () => {
    Object.assign($.P, { missile: 2, double: 1, options: 2, wardLv: 2 }); $.G.gm = { cal: 1 };
    const h: any = { tx: 0, ty: 100, pl: 0 };
    const ax = 378, ay = 92;
    let n = 0, y0 = h.ty;
    while (F.reelSweep(h, ax, ay)) n++;
    expect(n + 1).toBe(BUTCHER.reelVar.sweep);
    expect(Math.hypot(h.tx - ax, h.ty - ay)).toBeLessThan(1e-6);
    expect(h.sd).toBe(-1); // the far end of the -arc swing sits nearer the middle (PH/2): it sweeps down across the lanes
    expect(y0).toBe(100);
    expect(BUTCHER.reelVar.warn).toBe(44);
  });
  it('the Maw fan waits for room (volley-atomic retry), it is not dropped', () => {
    const e = mkMaw();
    const J = F.iv(MAW.jaw), at = Math.round(MAW.fanAt * J / 130);
    for (let i = 0; i < 24; i++) W.eshots.push({ k: 'orb', keep: 1 });
    let f = 0;
    while (!(e.jc === at) && f++ < 400) updEnemy(e);
    expect(W.eshots.filter((s) => s.k === 'glob')).toHaveLength(0);
    expect(e.fw).toBe(20);
    W.eshots.length = 0;
    for (let i = 0; i < 20 && !W.eshots.some((s) => s.k === 'glob'); i++) updEnemy(e);
    expect(W.eshots.filter((s) => s.k === 'glob')).toHaveLength(MAW.fanN);
  });
});
