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
    expect(PL.bucket('keep:planted')).toBe('hazard'); // W4c: THE KEEPSAKE's planted / hanging forks are terrain-like
    expect(PL.bucket('keep:mobile')).toBe('hazard');
    expect(PL.bucket('keep:boom')).toBe('body');
  });
  it('a signature window is x0-inclusive and x1-exclusive', () => {
    const ws = [{ x0: 100, x1: 200, floor: 72, id: 'knots' }];
    expect(PL.inSig(100, ws)).toBeTruthy(); expect(PL.inSig(199.9, ws)).toBeTruthy(); expect(PL.inSig(200, ws)).toBeNull();
  });
  it('the cap reads rank.ts bulletCap when the build has it (the flown tier), else the spec table', () => {
    const $ = { G: { tier: 2 } };
    PL.mods.S = { $ }; PL.mods.RK = { bulletCap: (_: any, c: string) => ({ scroll: 10, setp: 20, boss: 30 } as any)[c] };
    expect(PL.cap($.G, 'setp')).toBe(20);
    PL.mods.RK = null;
    expect(PL.cap($.G, 'setp')).toBe(20); // the spec table at tier 2
    expect(PL.cap({}, 'setp')).toBe(16);
  });
  it('B1 grace: shots in flight when the cap drops are carried, not counted against the lower cap', () => {
    const mini = { k: 'cyst', mid: 1 };
    PL.mods.W.eshots = Array.from({ length: 12 }, (_, i) => ({ x: 200 + i, y: 100, vx: -1, vy: 0, t: 1 }));
    PL.bulFrame(g({ mini }), '1-2'); // setp, cap 16: 12 counted
    expect(PL.bul.setp.n[12]).toBe(1);
    PL.bulFrame(g({}), '1-2'); // the midboss is gone: scroll, cap 8; the 12 are carried
    expect(PL.bul.scroll.over).toBe(0); expect(PL.bul.scroll.n[0]).toBe(1); expect(PL.bul.scroll.carried).toBe(1);
    PL.mods.W.eshots.push(...Array.from({ length: 9 }, (_, i) => ({ x: 300 + i, y: 50, vx: -1, vy: 0, t: 1 }))); // 9 new scroll shots
    PL.bulFrame(g({}), '1-2');
    expect(PL.bul.scroll.over).toBe(1); expect(PL.bul.scroll.overMax).toBe(9);
  });
  it('designated drones: e.sh 1, or e.sh 2 at rank >= 14; no e.sh field reads undesignated (null)', () => {
    expect(PL.designated({ k: 'drone', sh: 1 }, 2)).toBe(true);
    expect(PL.designated({ k: 'drone', sh: 2 }, 13)).toBe(false);
    expect(PL.designated({ k: 'drone', sh: 2 }, 14)).toBe(true);
    expect(PL.designated({ k: 'drone', sh: 0 }, 16)).toBe(false);
    expect(PL.designated({ k: 'drone' }, 16)).toBeNull();
    expect(PL.designated({ k: 'eye' }, 0)).toBe(true);
  });
  it('pinRank fits the ship to a rank.ts target without overshooting, null without rank.ts', () => {
    const $: any = { G: { stage: 0, gm: {} }, P: {} };
    expect(PL.pinRank($, 10)).toBeNull();
    // stand-in for rank.ts: base 2 + P_term (WARD 4, ARC 3, SPLIT 2, MISSILE 1 a level, WRAITH 1 an option, CAL 1)
    const rk = (s: any) => 2 + ((s.P.wardLv || 0) >= 1 ? 4 : 0) + (s.P.laser ? 3 : 0) + (s.P.double ? 2 : 0) + (s.P.missile || 0) + (s.P.pyre || 0) + (s.P.options || 0) + Math.min(3, (s.G.gm.cal || 0) + (s.G.gm.serr || 0));
    PL.mods.S = { $ }; PL.mods.RK = { rank: rk };
    expect(PL.pinRank($, 14)).toBe(14);
    expect(rk($)).toBe(14);
    expect(PL.pinRank($, 1)).toBe(2); // the base already exceeds it: naked
  });
  it('a reaching tentacle is hit between its sample points (segment distance)', () => {
    PL.mods.BU = { tentPts: () => Array.from({ length: 17 }, (_, i) => ({ x: i * 20, y: 100 })) }; // 20 px apart, hit r 5
    const G = { scroll: 0, boss: { x: 400, y: 200, tent: [{}] } };
    expect(PL.contact(g(G), 210, 102).other).toContain('tentacle'); // midway between points 10 and 11
    expect(PL.contact(g(G), 210, 120).other).not.toContain('tentacle');
  });
  it('a flying MORGUE RUSH block (W3c eng.blocks) is a haz:block contact; one in its tell is not', () => {
    (globalThis as any).__biome = () => ({ haz: [], sig: { eng: { blocks: [{ st: 'fly', x: 200, y: 100 }, { st: 'tell', x: 300, y: 100 }] } } });
    expect(PL.blockAt(211, 100)).toBe(true); // centre x 211 (left edge 200, w 22)
    expect(PL.blockAt(311, 100)).toBe(false);
    expect(PL.contact(g({}), 211, 108).other).toContain('haz:block');
    expect(PL.bucket('haz:block')).toBe('hazard');
    delete (globalThis as any).__biome;
  });
  it('the twin beam: laser.ang2 is a second arm', () => {
    const G = { scroll: 0, boss: { x: 400, y: 127, laser: { tel: 0, beam: 10, ang: Math.PI, ang2: Math.PI / 2 } } };
    expect(PL.contact(g(G), 400, 200).other).toContain('beam'); // straight down the second arm
    expect(PL.contact(g(G), 300, 127).other).toContain('beam');
  });
});

describe('W6 tune-tp: owner attribution, the solids timeline, one entry per swarm', () => {
  let PL: any;
  const g = (G: any, enemies: any[] = []) => ({ G: { scroll: 0, ...G }, P: { x: 100, y: 120, speed: 0 }, enemies });
  beforeEach(() => {
    (globalThis as any).window = {};
    pageLib();
    PL = (globalThis as any).window.__PL;
    PL.mods.W = { eshots: [], floorAt: () => 200, ceilAt: () => 40 };
  });
  it('N1: a drone whose shot flag turned this frame owns the shot from its muzzle, not a nearer formation mate', () => {
    const shooter = { k: 'drone', x: 320, y: 120, r: 6, shot: 0 }, mate = { k: 'drone', x: 312, y: 121, r: 6, shot: 0 };
    PL.tagShots(g({}, [shooter, mate]), 1); // flags read: neither has fired
    shooter.shot = 1; PL.mods.W.eshots = [{ x: 313, y: 120, vx: -2, vy: 0, t: 1 }]; // fired from (x - 5, y), moved one step
    const t = PL.tagShots(g({}, [shooter, mate]), 2);
    expect(t[0].e).toBe(shooter); expect(PL.fired.has(shooter)).toBe(true); expect(PL.fired.has(mate)).toBe(false);
  });
  it('N1: with no flag turned the nearest rule still applies (other kinds, older shots)', () => {
    const eye = { k: 'eye', x: 300, y: 120, r: 7 }, d = { k: 'drone', x: 340, y: 120, r: 6, shot: 1 };
    PL.tagShots(g({}, [eye, d]), 1);
    PL.mods.W.eshots = [{ x: 298, y: 120, vx: -2, vy: 0, t: 1 }];
    expect(PL.tagShots(g({}, [eye, d]), 2)[0].by).toBe('eye');
  });
  it('fm: a piston is read at its tip t frames on, on its own cycle (rest, extend, hold, retract)', () => {
    const p = { k: 'piston', st: 'rest', cls: 1, x: 100, w: 30, side: 1, root: 200, reach: 120, rest: 60, ext: 160, hold: 90, v: .5, age: 0, phase: 0, skipN: -1, y: 200, h: 153 };
    PL.mods.SO = { SC: { HARD: 1, LODGE: 2, PLUG: 4, BODY: 8, TERRAIN: 7 }, solids: [p], solidsCol: () => [[200, 353]] };
    expect(PL.solidsAt(110, 30)[0][0]).toBe(200); // still at rest
    expect(PL.solidsAt(110, 60 + 160 + 10)[0][0]).toBe(120); // held at the reach
    const mid = PL.solidsAt(110, 60 + 80)[0][0]; expect(mid).toBeGreaterThan(120); expect(mid).toBeLessThan(200); // extending
    expect(PL.solidsAt(200, 100)).toEqual([]); // not over its column
    p.skipN = 0; expect(PL.solidsAt(110, 60 + 160 + 10)[0][0]).toBe(200); // a skipped cycle stays home
  });
  it('fm: a growing plug cell blocks only once it sets', () => {
    const c = { k: 'plug', st: 'grow', cls: 0, x: 100, w: 10, y: 90, h: 10, t: 20, tell: 44 };
    PL.mods.SO = { SC: { HARD: 1, LODGE: 2, PLUG: 4, BODY: 8, TERRAIN: 7 }, solids: [c], solidsCol: () => [] };
    expect(PL.solidsAt(105, 10)).toEqual([]);
    expect(PL.solidsAt(105, 30)).toEqual([[90, 100]]);
  });
  it('fm: the walls move with a live DYN window (dynOff), the arrays alone at t 0', () => {
    const w = { t0: 0, spec: {} };
    PL.mods.TB = { DYNS: [w], dynWinAt: () => w, dynOff: (_s: any, _x: number, t: number) => [0, t * .5] }; // the floor rises .5 px/f
    PL.mods.S = { $: { G: { t: 100 } } };
    expect(PL.wallAt(50, 0)).toEqual([40, 200]);
    expect(PL.wallAt(50, 20)).toEqual([40, 190]);
  });
  it('N4: a hatchling swarm (same frame, same edge, no group) is one entry; grouped and other kinds are not folded', () => {
    expect(PL.swarmSeen({ k: 'hatch' }, 5, 'right')).toBe(false);
    expect(PL.swarmSeen({ k: 'hatch' }, 5, 'right')).toBe(true);
    expect(PL.swarmSeen({ k: 'hatch' }, 5, 'wall')).toBe(false);
    expect(PL.swarmSeen({ k: 'hatch' }, 6, 'right')).toBe(false);
    expect(PL.swarmSeen({ k: 'hatch', group: {} }, 6, 'right')).toBe(false);
    expect(PL.swarmSeen({ k: 'drone' }, 6, 'right')).toBe(false);
  });
});

describe('W6 tune-tf requests: Butcher first-half hook, KEEPSAKE cause, K2 keys, the withdraw clock, S1 forks', () => {
  let PL: any;
  const g = (G: any, enemies: any[] = [], P: any = { x: 100, y: 120, speed: 0 }) => ({ G: { scroll: 0, ...G }, P, enemies });
  beforeEach(() => { (globalThis as any).window = {}; pageLib(); PL = (globalThis as any).window.__PL; PL.mods.W = { eshots: [], floorAt: () => 200, ceilAt: () => 40 }; });
  it('the first-half hook (no tx/ty) hits at its tip while out, not once it comes back', () => {
    const b: any = { k: 'butcher', x: 200, y: 128, r: 20, st: 'hook', ha: Math.PI, hk: { out: 1, d: 100 } }; // tip at (110, 120)
    expect(PL.contact(g({}, [b]), 110, 120).other).toContain('hook');
    b.hk.out = 0; expect(PL.contact(g({}, [b]), 110, 120).other).not.toContain('hook');
  });
  it('a KEEPSAKE boomerang one frame from the ship is its cause, padded by its step', () => {
    PL.mods.KS = { KB: { boomSp: 3.4 }, keepTouch: (_m: any, _sc: number, x: number, _y: number, pad: number) => (Math.abs(x - 106) < pad ? 'boom' : '') };
    const m = { k: 'keepsake', fh: 0 };
    expect(PL.cause(g({ mini: m }, [])).c).toBe('keep:boom');
  });
  it('K2: the Maw counts as its bite only in bs 2-4; a Choir bar as the lane only while it sweeps', () => {
    expect(PL.bodyKey({ k: 'maw', bs: 3 })).toBe('deny:bite');
    expect(PL.bodyKey({ k: 'maw', bs: 1 })).toBe('body:maw');
    const ch: any = { k: 'choir', lp: 2 }, bar = { k: 'nailbar', par: ch }; ch.lb = bar;
    expect(PL.bodyKey(bar)).toBe('deny:lane'); ch.lp = 1; expect(PL.bodyKey(bar)).toBe('body:nailbar');
  });
  it('a shot with s.dn is its denial; nothing counts once a midboss withdraws', () => {
    PL.mods.W.eshots = [{ x: 100, y: 120, r: 2, vx: 0, vy: 0, k: 'spike', dn: 'comb' }];
    const acc = PL.spotNew(), mid = { k: 'crux', mid: 0, t: 10, leave: 999 };
    PL.spotFrame(acc, g({ mini: mid }), 100, 120, 0); expect(acc.ph[0].by).toEqual({ 'deny:comb': 1 });
    const acc2 = PL.spotNew(), gone = { k: 'choir', mid: 1, t: 2000, leave: 1080 };
    PL.spotFrame(acc2, g({ mini: gone }), 100, 120, 0); expect(acc2.ph[0]).toBeUndefined();
  });
  it('S1 leaves THE KEEPSAKE falling forks (fk 1) out of the speeds', () => {
    PL.mods.W.eshots = [{ x: 200, y: 100, vx: 0, vy: 3.3, k: 'glob', fk: 1 }, { x: 210, y: 100, vx: -1.5, vy: 0, k: 'orb' }];
    PL.bulFrame(g({}, []), '1-1'); expect(PL.bul.scroll.vmax).toBeCloseTo(1.5);
  });
});

describe('g5 qa: whip, doll and watcher death classes; N3 strike', () => {
  let PL: any;
  const g = (G: any, enemies: any[] = [], P: any = { x: 100, y: 120, speed: 0 }) => ({ G: { scroll: 0, ...G }, P, enemies });
  // a stand-in for enemies/update.ts whipPts: 15 points from the hand (x - 7, y + 1) straight out along e.ang, full reach
  // 122 px while wt / 26 is in .3-.55 (the sim's ext plateau), 14 px otherwise; e.t is recorded so the step-ahead copy is visible
  const seen: any[] = [];
  const whipPts = (e: any) => { seen.push({ wt: e.wt, t: e.t }); const p = e.wt / 26, len = p >= .3 && p <= .55 ? 122 : 14, out = [];
    for (let i = 0; i <= 14; i++) out.push({ x: e.x - 7 + Math.cos(e.ang) * len * i / 14, y: e.y + 1 + Math.sin(e.ang) * len * i / 14 }); return out; };
  // the flayer at x 207, its hand at (200, 121), lashing straight left: the line passes the ship at (100, 120) about 1 px off
  const fl = (o: any = {}) => ({ k: 'flayer', x: 207, y: 120, r: 7, ws: 'strike', wt: 10, t: 50, ang: Math.PI, ...o });
  beforeEach(() => { (globalThis as any).window = {}; pageLib(); PL = (globalThis as any).window.__PL; PL.mods.W = { eshots: [], floorAt: () => 200, ceilAt: () => 40 }; PL.mods.EU = { whipPts }; seen.length = 0; });

  it('whipHit is the sim test: strike, 4 < wt < 16, points 4.. within 4.5 px; null without EU', () => {
    expect(PL.whipHit(fl(), 100, 120)).toBe(true);
    expect(PL.whipHit(fl({ wt: 4 }), 100, 120)).toBe(false);
    expect(PL.whipHit(fl({ wt: 16 }), 100, 120)).toBe(false);
    expect(PL.whipHit(fl({ ws: 'tel' }), 100, 120)).toBe(false);
    expect(PL.whipHit(fl(), 100, 130)).toBe(false); // 9 px off the line
    expect(PL.whipHit(fl(), 100, 130, 6)).toBe(true); // padded
    expect(PL.whipHit(fl(), 195, 121)).toBe(false); // the first 4 points (the hand end) never hit
    PL.mods.EU = null; expect(PL.whipHit(fl(), 100, 120)).toBeNull();
  });
  it('whipNext reads the lash one step on, on a copy (e.wt and e.t + 1), and leaves the flayer alone', () => {
    const e = fl({ wt: 7 }); // wt / 26 = .27: short now, full reach at wt 8
    expect(PL.whipHit(e, 100, 120)).toBe(false);
    expect(PL.whipNext(e, 100, 120)).toBe(true);
    expect(seen.pop()).toEqual({ wt: 8, t: 51 }); expect(e.wt).toBe(7); expect(e.t).toBe(50);
    expect(PL.whipNext(fl({ ws: 'tel', wt: 33 }), 100, 120)).toBe(false); // the tell's last frame turns into strike wt 0
  });
  it('cause: a lash about to land is whip (it read other before g5); a shot in reach still comes first', () => {
    expect(PL.cause(g({}, [fl({ wt: 7 })])).c).toBe('whip');
    PL.mods.W.eshots = [{ x: 103, y: 120, r: 2, vx: 0, vy: 0, k: 'orb' }];
    expect(PL.cause(g({}, [fl({ wt: 7 })])).c).toBe('shot:orb');
  });
  it('the statue contact reads the lash on whipPts when EU loads, the old seg stand-in without it', () => {
    expect(PL.contact(g({}, [fl()]), 100, 120).other).toContain('whip');
    expect(PL.contact(g({}, [fl()]), 100, 130).other).not.toContain('whip');
    PL.mods.EU = null; expect(PL.contact(g({}, [fl()]), 100, 120).other).toContain('whip');
  });
  it('a body is padded by its own last step: a lunging doll one step out is its cause', () => {
    const d: any = { k: 'doll', x: 140, y: 120, r: 5 };
    expect(PL.cause(g({}, [d])).c).toBe(''); // first read: no step known
    d.x = 120; expect(PL.cause(g({}, [d])).c).toBe('body:doll'); // stepped 20 (capped 12): 20 < 5 + 4.6 + 12
    d.x = 119; expect(PL.cause(g({}, [d])).c).toBe(''); // it slowed: a 1 px step pads 1 px
    d.x = 109; expect(PL.cause(g({}, [d])).c).toBe('body:doll'); // 9 < 5 + 4.6 + 10
    PL.causeN += 5; d.x = 121; expect(PL.cause(g({}, [d])).c).toBe(''); // a gap in the reads: no step carried
  });
  it('hitBy replays the after-step tests: the lash, then a body at r + 4; harmless carriers and ghosts are not hits', () => {
    expect(PL.hitBy(g({}, [fl()]))).toBe('whip');
    expect(PL.hitBy(g({}, [{ k: 'doll', x: 108, y: 120, r: 5 }]))).toBe('body:doll');
    expect(PL.hitBy(g({}, [{ k: 'doll', x: 110, y: 120, r: 5 }]))).toBe('');
    expect(PL.hitBy(g({}, [{ k: 'drone', x: 104, y: 120, r: 6, rec: 1 }]))).toBe('');
    expect(PL.hitBy(g({}, [{ k: 'drone', x: 104, y: 120, r: 6, ghost: 3 }]))).toBe('');
    expect(PL.hitBy({ enemies: [] })).toBe('');
  });
  it('settle: a lash beats all but a shot; a body fills an empty or guessed cause only', () => {
    expect(PL.settle('', 'whip')).toBe('whip');
    expect(PL.settle('body:flayer', 'whip')).toBe('whip');
    expect(PL.settle('shot:orb', 'whip')).toBe('shot:orb');
    expect(PL.settle('~shot:orb', 'whip')).toBe('~shot:orb');
    expect(PL.settle('other', 'body:doll')).toBe('body:doll');
    expect(PL.settle('~terrain', 'body:doll')).toBe('body:doll');
    expect(PL.settle('terrain', 'body:doll')).toBe('terrain');
    expect(PL.settle('', '')).toBe('other');
    expect(PL.settle('terrain', '')).toBe('terrain');
  });
  it('cls: whip, doll, watcher:orb (by the shot tag), watcher:body, else the five-way bucket', () => {
    expect(PL.cls('whip')).toBe('whip');
    expect(PL.bucket('whip')).toBe('body'); // M3 still counts a lash as a body (non-bullet)
    expect(PL.cls('body:doll')).toBe('doll');
    expect(PL.cls('~body:doll')).toBe('doll');
    expect(PL.cls('body:watcher')).toBe('watcher:body');
    expect(PL.cls('shot:orb', 'watcher')).toBe('watcher:orb');
    expect(PL.cls('shot:orb', 'eye')).toBe('bullet');
    expect(PL.cls('terrain')).toBe('terrain');
    expect(PL.cls('')).toBe('other');
    PL.K5.doll = 'babydoll'; expect(PL.cls('body:babydoll')).toBe('doll'); // one table if the sim names it differently
  });
  it('hit trap: G.st.hits / deaths keep their value and log the caller; re-arms on a new st; atCause maps it', () => {
    const G: any = { st: { kills: 2, hits: 1, deaths: 0 } };
    PL.trapHits(G);
    function playerHit() { G.st.hits++; }
    function updateEShots() { playerHit(); }
    updateEShots();
    expect(G.st.hits).toBe(2); expect(JSON.stringify(G.st)).toBe('{"kills":2,"hits":2,"deaths":0}'); // same data, same order
    const [h] = PL.takeHits(); expect(h.k).toBe('hits'); expect(h.at[0]).toMatch(/^playerHit@probe-lib\.test\.ts:\d+$/); expect(h.at[1]).toMatch(/^updateEShots@/);
    expect(PL.atCause(h)).toBe('shot:?');
    G.st.hits = 0; expect(PL.takeHits()).toEqual([]); // a reset (flow.ts) is not a hit
    G.st = { ...G.st }; PL.trapHits(G); G.st.deaths++; expect(PL.takeHits()[0].k).toBe('deaths');
    const crush = { k: 'deaths', at: ['killPlayer@flow.ts:313', 'updatePlayer@player.ts:528'] };
    expect(PL.atCause(crush, g({}, [], { x: 100, y: 120 }))).toBe('solid'); // open air: a solid the read missed
    expect(PL.atCause(crush, g({}, [], { x: 100, y: 199 }))).toBe('terrain'); // the hull's +4 points reach the floor at 200
    expect(PL.atCause({ k: 'hits', at: ['playerHit@player.ts:271', 'updatePlayer@player.ts:600'] })).toBe('at:updatePlayer@player.ts');
    expect(PL.atCause({ at: ['playerHit@player.ts:271', 'updateEnemies@shots.ts:361'] })).toBe('body:?');
    expect(PL.atCause(null)).toBe('');
    expect(PL.frameOf('    at stepSim (http://127.0.0.1:5400/src/step.ts?t=1712:53:28)')).toBe('stepSim@step.ts:53');
    expect(PL.frameOf('    at http://127.0.0.1:5400/src/step.ts:70:3')).toBe('anon@step.ts:70');
  });
  it('N3 strike: the flayer lash (ws strike) and a doll lunge state count; a tell or idle does not', () => {
    expect(PL.strike(fl())).toBe(true);
    expect(PL.strike(fl({ ws: 'tel' }))).toBe(false);
    expect(PL.strike({ k: 'doll', st: 'lunge' })).toBe(true);
    expect(PL.strike({ k: 'doll', ws: 'dash' })).toBe(true);
    expect(PL.strike({ k: 'doll', st: 'drift' })).toBe(false);
    expect(PL.strike({ k: 'watcher', st: 'blink' })).toBe(false); // its orb is a shot: tagShots times it
    expect(PL.strike(null)).toBe(false);
  });
});
