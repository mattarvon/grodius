// THE KEEPSAKE under the difficulty rebuild (DIFFICULTY-SPEC §2.3, the KEEPSAKE row; stream W4c): the ring trims and
// the atomic volleys under the stage-boss cap (gate B3), the one rank rule for its idles (C2), recMin at rank >= 14
// (C3), the swept hit test on the forks flying home (greenhit's tunnelling fix), and keepTouch, the view the probes'
// spot counters read (K1/K2). Driven through the real update, the shared modules stubbed as keepsake-sim.test.ts does,
// except that ring() and lob() push real eshots here so the cap can be counted.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const noop = () => {};
const W = vi.hoisted(() => ({ enemies: [] as any[], eshots: [] as any[], caps: [] as any[], orbs: [] as any[], geysers: [] as any[] }));
const S = vi.hoisted(() => ({ banners: [] as string[], cleared: 0, hits: 0 }));
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
vi.mock('../../src/stages', () => ({ clearStage: () => { S.cleared++; }, deepPay: () => 1 }));
vi.mock('../../src/mutations', () => ({ countKill: noop }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3, playerHit: () => { S.hits++; }, slotMaxed: () => false }));
vi.mock('../../src/contraptions', () => ({ onKillContraptions: noop }));
vi.mock('../../src/enemies/elite', () => ({ eliteKill: noop, eliteTick: noop }));
vi.mock('../../src/enemies/spawn', async () => {
  const { MID_ET } = await import('../../src/enemies/mid/roster');
  const eshoot = (x: number, y: number, a: number, sp: number, k = 'orb') => { W.eshots.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, k, r: 4, a }); };
  return {
    BS: () => 1, aimA: () => Math.PI, wrapA: (a: number) => a, fan: noop, every: () => false, onScreen: () => true,
    eshoot,
    ring: (x: number, y: number, n: number, a0: number, sp: number, k?: string) => { for (let i = 0; i < n; i++) eshoot(x, y, a0 + i * Math.PI * 2 / n, sp, k); },
    banner: (t: string) => { S.banners.push(t); },
    mk: (k: string, x: number, y: number, o: any = {}) => {
      const b = MID_ET[k] || { hp: 16, r: 9, gsz: 1, score: 800, bio: 4 };
      const e: any = { k, x, y, vx: 0, vy: 0, t: 0, flash: 0, rot: 0, dead: false, ...b, ...o };
      e.hp = b.hp * (o.hpm || 1); e.max = e.hp; W.enemies.push(e);
      return e;
    },
  };
});

const { hurt, updEnemy } = await import('../../src/enemies/update');
const { BOSS_SIM } = await import('../../src/enemies/boss/registry');
const { KB, KR, keepTouch, sweptTouch, homeTouchJ, mobForkX, mobForkTip } = await import('../../src/enemies/boss/_keepsake');
const RK = await import('../../src/rank');
const L = await import('../../src/layout');
const { segDist } = await import('../../src/enemies/butcherhook');

let e: any;
const boot = () => {
  L.setLayout('long4'); // THE KEEPSAKE's only layout (registry.ts bossFor: picker layouts; short has none)
  W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.orbs.length = 0;
  S.banners.length = 0; S.cleared = 0; S.hits = 0;
  $.G = { loop: 0, stage: 2, rank: 0, tier: 1, score: 0, bio: 0, combo: 0, comboT: 0, kills: 0, maxCombo: 0, scroll: 0, shake: 0, hitstop: 0, white: 0, st: { kills: 0, chain: 0 }, pend: [] };
  $.P = { x: 90, y: 100, alive: true };
  $.meta = { bio: 0, lv: {} };
  BOSS_SIM.keepsake.spawn('fire');
  e = $.G.mini;
  e.x = e.tx; e.t = KB.enter;
};
beforeEach(() => boot());
const step = (n = 1) => { for (let i = 0; i < n && !e.dead; i++) updEnemy(e); };
/** the counted eshots (rank.ts counted: everything but haz) */
const counted = () => W.eshots.filter((s) => !s.haz).length;
/** run until the attack in state st releases, or n frames */
const until = (f: () => boolean, n = 600) => { for (let k = 0; k < n && !f(); k++) step(); return f(); };
/** a kit that holds rank 14 in biome B on Normal: 2 + 2 + (WARD 4, MISSILE 2, SPLIT 2, WRAITH 2) */
const KIT14 = { missile: 2, double: 1, options: 2, wardLv: 1 };

describe('the ring trims (gate B3: peak <= 24)', () => {
  it('AWAKE wails a ring of KR.wailN (10) on long4', () => {
    e.ph = 1; e.tr = 0; e.att = 4; e.st = 'idle'; e.wt = 0; e.cool = 0;
    step();
    expect(e.st).toBe('wail');
    W.eshots.length = 0;
    expect(until(() => W.eshots.length > 0)).toBe(true);
    expect(W.eshots.length).toBe(KR.wailN);
    expect(KR.wailN).toBe(10);
  });

  it('CRACKED cries two rings of KR.mamaN (8), the second turned half a gap', () => {
    e.ph = 2; e.tr = 0; e.hp = e.max * .2;
    step(2);
    e.att = 1; e.st = 'idle'; e.wt = 0; e.cool = 0;
    step();
    expect(e.st).toBe('mama');
    W.eshots.length = 0;
    until(() => W.eshots.length > 0);
    expect(W.eshots.length).toBe(KR.mamaN);
    const a0 = W.eshots[0].a;
    until(() => W.eshots.length > KR.mamaN);
    expect(W.eshots.length).toBe(2 * KR.mamaN);
    expect(W.eshots[KR.mamaN].a - a0).toBeCloseTo(Math.PI / KR.mamaN, 9);
  });

});

describe('atomic volleys under the stage-boss cap (spec §2.1)', () => {
  it('holds the wail while it would not fit, none of it spawns, and lets go within KR.retry frames of room', () => {
    const cap = RK.bulletCap($, 'boss');
    expect(cap).toBe(24);
    e.ph = 1; e.tr = 0; e.att = 4; e.st = 'idle'; e.wt = 0; e.cool = 0;
    step();
    for (let i = 0; i < cap - KR.wailN + 1; i++) W.eshots.push({ x: 10, y: 10, vx: 0, vy: 0, k: 'orb', r: 2 }); // one too many
    W.eshots.push({ x: 20, y: 20, vx: 0, vy: 0, k: 'spike', r: 4, haz: 1 }); // a hazard never counts
    const n0 = W.eshots.length;
    step(KB.wail + 60);
    expect(W.eshots.length).toBe(n0); // held: nothing spawned
    expect(e.st).toBe('wail');
    W.eshots.shift(); // room for exactly the ring
    let f = 0;
    for (; f <= KR.retry + 1 && W.eshots.length === n0 - 1; f++) step();
    expect(W.eshots.length).toBe(n0 - 1 + KR.wailN);
    expect(f).toBeLessThanOrEqual(KR.retry + 1);
    expect(counted()).toBe(cap);
  });

  it('never puts more than the cap on screen through a long enraged CRACKED with a full hoard', () => {
    e.ph = 2; e.tr = 0; e.hp = e.max * .2; e.rage = 1;
    step(2);
    // a full hoard on both surfaces, so the cries shake forks loose on every ring
    for (let i = 0; i < KB.plRage; i++) { e.pX[e.pn] = 30 + i * 20; e.pY[e.pn] = i % 2 ? 0 : 224; e.pS[e.pn] = i % 2 ? -1 : 1; e.pB[e.pn] = 0; e.pQ[e.pn] = 0; e.pn++; }
    let peak = 0, spawned = 0, last = W.eshots.length;
    for (let f = 0; f < 4000; f++) {
      $.P.x = e.rocker ? e.rocker.x + e.bdx * 120 : 90; $.P.y = e.rocker ? e.rocker.y + e.bdy * 120 : 100; // on the beam
      step();
      spawned += Math.max(0, W.eshots.length - last);
      peak = Math.max(peak, counted());
      if (f % 16 === 0 && W.eshots.length) W.eshots.shift(); // the oldest leaves the screen (slower than it fires: the cap is met)
      last = W.eshots.length;
    }
    expect(spawned).toBeGreaterThan(100); // it kept attacking
    expect(peak).toBeLessThanOrEqual(RK.bulletCap($, 'boss'));
    expect(e.hdN).toBeGreaterThan(0); // the cap was met: volleys held
  });

  it('holds a fountain at its tell\'s end until all its forks fit, then reserves them as they leave', () => {
    e.att = 0; e.st = 'idle'; e.wt = 0; e.cool = 0;
    step();
    expect(e.st).toBe('tell');
    const cap = RK.bulletCap($, 'boss');
    for (let i = 0; i < cap - e.fn + 1; i++) W.eshots.push({ x: 10, y: 10, vx: 0, vy: 0, k: 'orb', r: 2 });
    step(KB.tell + 40);
    expect(e.st).toBe('tell'); // held, its marks up
    expect(e.hdN).toBeGreaterThan(0);
    W.eshots.shift();
    until(() => e.st === 'fount', KR.retry + 2);
    expect(e.st).toBe('fount');
    expect(e.rsv).toBe(e.fn);
    until(() => e.st === 'open', 400);
    expect(e.rsv).toBe(0);
    expect(counted()).toBeLessThanOrEqual(cap);
  });

  it('holds the whole cry, ring and shake-loose together: no ring without its forks', () => {
    e.ph = 2; e.tr = 0; e.hp = e.max * .2;
    step(2);
    for (let i = 0; i < 4; i++) { e.pX[e.pn] = 40 + i * 30; e.pY[e.pn] = 224; e.pS[e.pn] = 1; e.pB[e.pn] = 0; e.pQ[e.pn] = 0; e.pn++; }
    e.att = 1; e.st = 'idle'; e.wt = 0; e.cool = 0;
    step();
    expect(e.st).toBe('mama');
    const cap = RK.bulletCap($, 'boss');
    for (let i = 0; i < cap - KR.mamaN - 2; i++) W.eshots.push({ x: 10, y: 10, vx: 0, vy: 0, k: 'orb', r: 2 }); // room for the ring, not its 4 forks
    const n0 = W.eshots.length;
    step(KB.mama + 30);
    expect(W.eshots.length).toBe(n0); // nothing: the ring waits for its forks
    expect(e.pn).toBe(4);
    W.eshots.splice(0, 2);
    until(() => e.pn === 0, KR.retry + 2);
    expect(e.pn).toBe(0); //                          the forks went with...
    expect(W.eshots.length).toBe(n0 - 2 + KR.mamaN + 4); // ...the ring
  });

  it('a phase cut or the crier breaking mid-hold clears the hold and the reservation', () => {
    e.ph = 2; e.tr = 0; e.hp = e.max * .2;
    step(2);
    e.att = 1; e.st = 'idle'; e.wt = 0; e.cool = 0;
    step();
    for (let i = 0; i < 30; i++) W.eshots.push({ x: 10, y: 10, vx: 0, vy: 0, k: 'orb', r: 2 });
    step(KB.mama + 5);
    expect(e.hd).toBeGreaterThan(0);
    e.crier.dead = true;
    step();
    expect(e.st).toBe('idle');
    expect(e.hd).toBe(0);
    expect(e.rsv).toBe(0);
    expect(e.d3).toBe(0); // a cry cut short is not a finished attack

  });
});

describe('the one rank rule for its idles (C2)', () => {
  const idle = () => { e.st = 'tell'; e.wt = 0; e.fn = 0; e.fl.fill(0); e.st = 'open'; e.wt = KB.open; step(); return e.cool; };
  it('is KB\'s idle x cadMul, floor 18, on long4', () => {
    e.ph = 0; e.tr = 0;
    expect(RK.rank($)).toBe(4); // Normal 2 + biome B 2 + a naked ship
    expect(idle()).toBe(Math.max(RK.CAD_FLOOR, Math.round(KB.cool * RK.cadMul($))));
    Object.assign($.P, KIT14, { laser: 1, pyre: 3 }); // rank 16 (capped): cadMul .65
    expect(RK.rank($)).toBe(16);
    e.ph = 2;
    expect(idle()).toBe(Math.max(18, Math.round(KB.cool3 * .65)));
    e.rage = 1;
    expect(idle()).toBe(RK.CAD_FLOOR); // 26 x .65 x .75 = 12.7: floored
  });
});

describe('recMin at rank >= 14 (C3)', () => {
  const plant2 = () => { for (const x of [40, 150]) { e.pX[e.pn] = x; e.pY[e.pn] = 224; e.pS[e.pn] = 1; e.pB[e.pn] = 0; e.pQ[e.pn] = 0; e.pn++; } };
  it('needs three planted forks under rank 14', () => {
    plant2(); e.st = 'idle'; e.wt = 0; e.cool = 999; e.rcT = 1;
    step(3);
    expect(e.rcW).toBe(0);
  });
  it('calls with two at rank 14', () => {
    Object.assign($.P, KIT14);
    expect(RK.rank($)).toBe(RK.VARIANT_RANK);
    plant2(); e.st = 'idle'; e.wt = 0; e.cool = 999; e.rcT = 1;
    step(3);
    expect(e.rcW).toBeGreaterThan(0);
  });
});

describe('the forks flying home hit swept (greenhit)', () => {
  it('sweptTouch is shots.ts eshotTouches\' closest approach in the ship\'s frame', () => {
    for (const [ox, oy, x, y, lx, ly, px, py] of [[0, 0, 10, 0, 5, 3, 5, -3], [0, 0, 6, 6, 3, 0, 3, 0], [-20, 4, -12, 4, 0, 0, 1, 0], [0, 0, 8, 1, 40, 40, 4, 0]]) {
      const jump = Math.abs(px - lx) > KR.jump || Math.abs(py - ly) > KR.jump, l0x = jump ? px : lx, l0y = jump ? py : ly;
      const d = segDist(ox - l0x, oy - l0y, x - px, y - py, 0, 0);
      expect(sweptTouch(ox, oy, x, y, lx, ly, px, py, 7.1)).toBe(d < 7.1);
    }
  });
  it('a fork crossing a ship that moves the other way between two tests hits it (the end-of-frame test missed it)', () => {
    // the fork steps 12 px down (80 -> 92) while the ship steps 5 px up (89 -> 84): 9 px apart before, 8 after,
    // both outside the 7.1 px reach, and the paths cross in between
    e.fh = 1; e.hX[0] = 100; e.hY[0] = 80; e.hVX[0] = 0; e.hVY[0] = 12; e.hF[0] = 50;
    $.P.ex = 100; $.P.ey = 89; $.P.x = 100; $.P.y = 84;
    expect(Math.abs(e.hY[0] - $.P.ey)).toBeGreaterThan(KR.homeR + 2.6);
    expect(Math.abs(e.hY[0] + e.hVY[0] - $.P.y)).toBeGreaterThan(KR.homeR + 2.6);
    e.st = 'idle'; e.wt = 0; e.cool = 999;
    step();
    expect(S.hits).toBe(1);
  });
  it('a ship placed (a respawn: > KR.jump on an axis) is tested from where it is, not swept', () => {
    e.fh = 1; e.hX[0] = 100; e.hY[0] = 80; e.hVX[0] = 0; e.hVY[0] = 12; e.hF[0] = 50;
    $.P.ex = 100; $.P.ey = 140; $.P.x = 100; $.P.y = 60; // jumped 80 px: the old path through the fork is not flown
    e.st = 'idle'; e.wt = 0; e.cool = 999;
    step();
    expect(S.hits).toBe(0);
  });
});

describe('keepTouch: the probes\' view of what is not an eshot', () => {
  it('sees the boomerang, a hanging fork, a planted fork and a fork flying home, and nothing in the open', () => {
    expect(keepTouch(e, 0, 200, 120)).toBe('');
    e.st = 'fly'; e.bx = 200; e.by = 120; e.bsa = 0;
    expect(keepTouch(e, 0, 220, 121)).toBe('boom');
    e.st = 'idle';
    e.ph = 1; e.my = KB.mobY;
    expect(keepTouch(e, 0, mobForkX(e, 2), mobForkTip(e, 2) - 11)).toBe('mobile');
    e.pX[0] = 140; e.pY[0] = 224; e.pS[0] = 1; e.pn = 1;
    expect(keepTouch(e, 0, 140, 220)).toBe('planted');
    expect(keepTouch(e, 20, 120, 220)).toBe('planted'); // world x: the scroll moves it
    e.fh = 1; e.hX[0] = 60; e.hY[0] = 60; e.hVX[0] = 3; e.hVY[0] = 0;
    expect(keepTouch(e, 0, 58, 61)).toBe('home');
    expect(homeTouchJ(e, 0, 58, 61, 58, 61)).toBe(true);
    e.st = 'dying';
    expect(keepTouch(e, 0, 58, 61)).toBe('');
  });
  it('matches the sim: a ship keepTouch calls touched is hit by the mobile and the planted forks', () => {
    e.ph = 1; e.tr = 0; e.my = KB.mobY; e.st = 'idle'; e.wt = 0; e.cool = 999;
    e.y = 300; // the head out of the way
    $.P.x = mobForkX(e, 0); $.P.y = mobForkTip(e, 0);
    expect(keepTouch(e, $.G.scroll, $.P.x, $.P.y)).toBe('mobile');
    S.hits = 0; step(); expect(S.hits).toBeGreaterThan(0);
    e.ph = 0; e.my = -80; // the mobile gone: a planted fork
    e.pX[0] = 140 + $.G.scroll; e.pY[0] = 224; e.pS[0] = 1; e.pQ[0] = 0; e.pn = 1;
    $.P.x = 140; $.P.y = 216;
    expect(keepTouch(e, $.G.scroll, $.P.x, $.P.y)).toBe('planted');
    S.hits = 0; step(); expect(S.hits).toBeGreaterThan(0);
    $.P.y = 190;
    expect(keepTouch(e, $.G.scroll, $.P.x, $.P.y)).toBe('');
    S.hits = 0; step(); expect(S.hits).toBe(0);
  });
  it('KR.jump and the fork\'s reach are shots.ts EHIT\'s', async () => {
    // shots.ts needs the DOM to import (render): read its EHIT table from the source instead
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../../src/shots.ts', import.meta.url), 'utf8'), t = src.slice(src.indexOf('export const EHIT'));
    expect(KR.jump).toBe(+/jump: ([\d.]+)/.exec(t)![1]);
    expect(KR.homeR + 2.6).toBeCloseTo(4.5 + +/ship: ([\d.]+)/.exec(t)![1], 9);
  });
});

describe('HP stays 440 (no tier or dial changes it)', () => {
  it('depthHP gives THE KEEPSAKE x1 in Descent 1 on every tier', async () => {
    const { depthHP } = await import('../../src/depth');
    const { MID_ET } = await import('../../src/enemies/mid/roster');
    const row = MID_ET.keepsake;
    expect(row.hp).toBe(440);
    for (const t of [0, 1, 2, 3]) { $.G.tier = t; expect(depthHP('keepsake', row, {})).toBeCloseTo(1, 9); }
  });
});

describe('CRACKED is staged (KR.p3MinAtt, gate K1 at a strong kit)', () => {
  it('holds above the dying sliver until its attacks are out, then puts to bed', () => {
    e.ph = 2; e.tr = 0; e.hp = e.max * .3; e.st = 'idle'; e.wt = 0; e.cool = 999;
    step(2);
    hurt(e, 9999, e.x, e.y - 40, 1);
    expect(e.hp).toBeGreaterThan(e.max * KB.end + 1);
    step();
    expect(e.st).not.toBe('dying');
    e.d3 = KR.p3MinAtt - 1; hurt(e, 9999, e.x, e.y - 40, 1);
    expect(e.hp).toBeCloseTo(e.max * KB.end, 6); // the floor is down...
    step(); expect(e.st).not.toBe('dying'); //      ...but the last attack isn't out
    e.d3 = KR.p3MinAtt; step();
    expect(e.st).toBe('dying');
  });
  it('counts an attack when CRACKED rests after it', () => {
    e.ph = 2; e.tr = 0; e.hp = e.max * .3;
    step(2);
    e.att = 0; e.st = 'idle'; e.wt = 0; e.cool = 0;
    const d = e.d3;
    until(() => e.st === 'idle' && e.d3 > d, 900);
    expect(e.d3).toBe(d + 1);
  });
});
