import { describe, it, expect, beforeEach } from 'vitest';
// @ts-ignore: plain .mjs tool module, no types
import { hq, hmax, hshare, kitHas, K0, K1, spotSummary, SPOTS, CAPS, VCAP, pageLib } from '../../tools/probe-lib.mjs';

// tools/probe-lib.mjs: the W5 measurement kit (DIFFICULTY-SPEC §3.1). The Node helpers are pure; the page kit is run
// here against a stub window so its graceful paths (no rank.ts, no solids.ts, no sigs.ts) are pinned too.

describe('histogram helpers', () => {
  const h = { 0: 5, 1: 3, 2: 1, 9: 1 }; // 10 samples
  it('quantiles walk the cumulative count', () => {
    expect(hq(h, .5)).toBe(0);
    expect(hq(h, .8)).toBe(1);
    expect(hq(h, .9)).toBe(2);
    expect(hq(h, 1)).toBe(9);
    expect(hq({}, .5)).toBeNull();
  });
  it('max and the share above a value', () => {
    expect(hmax(h)).toBe(9);
    expect(hshare(h, 1)).toBeCloseTo(.2);
    expect(hshare({}, 1)).toBeNull();
  });
});

describe('kits', () => {
  // [speed, missile, double, laser, pyre, options, wardLv]
  it('K0 and K1 accept either main gun and either missile slot', () => {
    expect(K0([2, 1, 1, 0, 0, 1, 1])).toBe(true);
    expect(K0([2, 0, 0, 1, 1, 1, 1])).toBe(true);
    expect(K0([2, 1, 1, 0, 0, 1, 0])).toBe(false);
    expect(K1([3, 2, 1, 0, 0, 2, 2])).toBe(true);
    expect(K1([3, 1, 1, 0, 0, 2, 2])).toBe(false);
  });
  it('kitHas compares slot by slot', () => {
    expect(kitHas([3, 2, 1, 0, 0, 2, 2], [2, 1, 1, 0, 0, 1, 1])).toBe(true);
    expect(kitHas([3, 2, 0, 1, 0, 2, 2], [2, 1, 1, 0, 0, 1, 1])).toBe(false);
  });
});

describe('spec tables', () => {
  it('caps and V_CAP follow spec §2.1 by tier', () => {
    expect(CAPS.scroll).toEqual([6, 8, 10, 10]);
    expect(CAPS.setp).toEqual([12, 16, 20, 20]);
    expect(CAPS.boss).toEqual([18, 24, 30, 30]);
    expect(VCAP).toEqual([2.6, 2.6, 2.9, 2.9]);
  });
  it('the park grid has 8 spots inside the playfield', () => {
    expect(SPOTS).toHaveLength(8);
    for (const [x, y] of SPOTS) { expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(480); expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(254); }
  });
  it('spotSummary passes only when every reached phase on every spot has 2 hits', () => {
    const ok = spotSummary([{ ph: { 0: { hits: 2, by: { lash: 2 } }, 1: { hits: 3, by: { 'shot:orb': 3 } } } }]);
    expect(ok.pass).toBe(true); expect(ok.min).toBe(2); expect(ok.share).toEqual({ 'shot:orb': .6, lash: .4 });
    expect(spotSummary([{ ph: { 0: { hits: 1, by: {} } } }]).pass).toBe(false);
    expect(spotSummary([]).pass).toBe(false);
  });
});

describe('page kit on a stub window', () => {
  let PL: any;
  const g = (G: any, enemies: any[] = []) => ({ G: { scroll: 0, ...G }, P: { x: 100, y: 120, speed: 0 }, enemies });
  beforeEach(() => {
    (globalThis as any).window = {};
    pageLib();
    PL = (globalThis as any).window.__PL;
    PL.mods.W = { eshots: [], floorAt: () => 200, ceilAt: () => 40 };
  });
  it('reads n/a, not a crash, without rank.ts, tier, solids or sigs', () => {
    expect(PL.rank()).toBeNull();
    expect(PL.tier({})).toBeNull();
    expect(PL.solids(100)).toEqual([]);
    expect(PL.sigs()).toBeNull();
    expect(PL.cap({}, 'scroll')).toBe(8); // Normal's column when the build has no tier
    expect(PL.cap({ tier: 3 }, 'boss')).toBe(30);
  });
  it('cap context: Drive and stage bosses, then midbosses, the Orbit Maw and set pieces, else scroll', () => {
    expect(PL.ctx({ boss: {} })).toBe('boss');
    expect(PL.ctx({ mini: { k: 'crux' } })).toBe('boss');
    expect(PL.ctx({ mini: { k: 'maw', stageBoss: true } })).toBe('boss'); // a biome's Maw stage boss
    (globalThis as any).window.__LY = { row: (i: number) => ({ kind: i === 0 ? 'orbit' : 'biome' }) };
    expect(PL.ctx({ stage: 0, mini: { k: 'maw', stageBoss: true } })).toBe('setp'); // Orbit spawns maw(true): still a midboss (depth.ts isMid)
    expect(PL.ctx({ stage: 1, mini: { k: 'maw', stageBoss: true } })).toBe('boss');
    expect(PL.ctx({ mini: { k: 'maw', stageBoss: false } })).toBe('setp');
    expect(PL.ctx({ mini: { k: 'cyst', mid: 1 } })).toBe('setp');
    expect(PL.ctx({ setp: 1 })).toBe('setp');
    expect(PL.ctx({ mini: { k: 'cyst', mid: 1, dead: true } })).toBe('scroll');
  });
  it('free height and the swept fit subtract solids', () => {
    expect(PL.openAt(0).h).toBe(160);
    PL.mods.SO = { solidsCol: (wx: number) => (wx >= 50 && wx <= 60 ? [[100, 150]] : []) };
    expect(PL.openAt(55)).toMatchObject({ lo: 40, hi: 100, h: 60 });
    expect(PL.fitAt(0)).toBe(160);
    expect(PL.fitAt(55)).toBe(60);
    PL.mods.SO = { solidsCol: () => [[60, 70], [120, 130]] }; // a column split twice: the largest gap is 130..200
    expect(PL.openAt(0)).toMatchObject({ lo: 130, hi: 200, h: 70 });
    PL.mods.SO = { solidsCol: () => [{ y0: 1, y1: 2 }] }; // a shape off the contract is flagged, not read as "no solids"
    expect(PL.solids(0)).toEqual([]); expect(PL.contractErr.solidsCol).toBeTruthy();
  });
  it('counted shots skip haz forks; the frame sample counts over-cap frames', () => {
    PL.mods.W.eshots = Array.from({ length: 9 }, (_, i) => ({ x: 200 + i, y: 100, vx: -1, vy: 0, t: 1 })).concat([{ x: 50, y: 50, vx: 0, vy: 0, haz: 1 }]);
    PL.bulFrame(g({}), '1-1');
    expect(PL.bul.scroll.over).toBe(1);
    expect(PL.bul.scroll.n[9]).toBe(1);
    expect(PL.bul['1-1|scroll'].frames).toBe(1);
  });
  it('tags a shot once, with its spawn distance and shooter', () => {
    const e = { k: 'eye', x: 300, y: 120, r: 7 };
    PL.mods.W.eshots = [{ x: 298, y: 120, vx: -2, vy: 0, t: 1 }];
    const t = PL.tagShots(g({}, [e]), 10);
    expect(t).toHaveLength(1); expect(t[0].by).toBe('eye'); expect(t[0].sd).toBe(200);
    expect(PL.fired.has(e)).toBe(true);
    expect(PL.tagShots(g({}, [e]), 11)).toHaveLength(0);
  });
  it('a spot counts each shot once and each other contact once per touch', () => {
    const s = { x: 100, y: 120, r: 2, vx: 0, vy: 0 }, acc = PL.spotNew(), body = { k: 'hatch', x: 102, y: 120, r: 4 };
    PL.mods.W.eshots = [s];
    PL.spotFrame(acc, g({}, [body]), 100, 120, 0);
    PL.spotFrame(acc, g({}, [body]), 100, 120, 0);
    expect(acc.ph[0].hits).toBe(2); // the shot once, the body once
    PL.mods.W.eshots = [];
    PL.spotFrame(acc, g({}, []), 100, 120, 0);
    PL.spotFrame(acc, g({}, [body]), 100, 120, 0);
    expect(acc.ph[0].hits).toBe(3); // the body touched again
  });
  it('cause: a shot in reach beats a nearer body; terrain on the hull; nothing in reach is empty', () => {
    PL.mods.W.eshots = [{ x: 104, y: 120, r: 2, vx: -1, vy: 0, k: 'orb' }];
    expect(PL.cause(g({}, [{ k: 'drone', x: 101, y: 120, r: 6 }])).c).toBe('shot:orb');
    PL.mods.W.eshots = [];
    expect(PL.cause(g({}, [{ k: 'drone', x: 108, y: 120, r: 6 }])).c).toBe('body:drone');
    PL.mods.W.floorAt = () => 125;
    expect(PL.cause(g({}, [])).c).toBe('terrain');
    PL.mods.W.floorAt = () => 200;
    expect(PL.cause(g({}, [])).c).toBe('');
  });
  it('entry edges: the pattern decides first, then the screen edge', () => {
    expect(PL.entryEdge({ pat: 'behind', x: 300, y: 100 }, { scroll: 0 })).toBe('left');
    expect(PL.entryEdge({ pat: 'drop', x: 300, y: 100 }, { scroll: 0 })).toBe('top');
    expect(PL.entryEdge({ x: 490, y: 100 }, { scroll: 0 })).toBe('right');
    expect(PL.entryEdge({ x: 300, y: 196, r: 6 }, { scroll: 0 })).toBe('wall');
    expect(PL.entryEdge({ x: 300, y: 120, r: 6 }, { scroll: 0 })).toBe('inside');
  });
  it('phase: the Drive reads b.phase, THE KEEPSAKE m.ph, the rest the half rule', () => {
    expect(PL.phase({ phase: 2 }, true)).toBe(2);
    expect(PL.phase({ k: 'keepsake', ph: 1, hp: 90, max: 100 })).toBe(1);
    expect(PL.phase({ k: 'cyst', hp: 40, max: 100 })).toBe(1);
    expect(PL.phase({ k: 'cyst', hp: 60, max: 100 })).toBe(0);
  });
  it('buckets death causes into the five sources', () => {
    expect(PL.bucket('shot:orb')).toBe('bullet');
    expect(PL.bucket('terrain')).toBe('terrain');
    expect(PL.bucket('solid')).toBe('solid');
    expect(PL.bucket('haz:icicle')).toBe('hazard');
    expect(PL.bucket('body:drone')).toBe('body');
    expect(PL.bucket('other')).toBe('other');
    expect(PL.bucket('~shot:orb')).toBe('bullet');
    expect(PL.bucket('lash')).toBe('body');
  });
});
