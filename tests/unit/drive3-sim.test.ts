// The Gravity Drive on long4 (DIFFICULTY-SPEC §2.3, encounters.md §4.10, C22, C23; stream W4b), driven through the real
// src/boss/update.ts with the shared modules stubbed: base HP with no rank term, THE REACH (46 f coil tell, the aim
// locked for the last 16, 190 px out), no spiral, the twin beam's second line and the pincer after it, and the clock:
// THE WELL COLLAPSES at 45 s, the self-destruct at 60 s with no bounty and the grade capped at C.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const noop = () => {};
const W = vi.hoisted(() => ({ enemies: [] as any[], eshots: [] as any[] }));
const S = vi.hoisted(() => ({ hits: 0, banners: [] as string[] }));
vi.mock('../../src/core', () => ({
  FIRE: [], PH: 254, W: 480, TAU: Math.PI * 2, R: () => .5, rr: (a: number) => a, ri: (a: number) => a, pick: (a: any[]) => a[0],
  clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  dist2: (a: number, b: number, c: number, d: number) => (a - c) ** 2 + (b - d) ** 2,
}));
vi.mock('../../src/save', () => ({ SET: { flashes: true } }));
vi.mock('../../src/audio', () => ({ sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/world', () => ({ ...W, ceilAt: () => 10, floorAt: () => 244, geysers: [] }));
vi.mock('../../src/fx/spawn', () => ({ drop: noop, gib: noop, gore: noop, pop: noop, spark: noop, splat: noop }));
vi.mock('../../src/fx/update', () => ({ hellFlash: noop }));
vi.mock('../../src/stages', () => ({ clearStage: noop }));
vi.mock('../../src/perks', () => ({ perkFX: {}, pk: () => 0 }));
vi.mock('../../src/mutations', () => ({ critMul: () => 1 }));
vi.mock('../../src/shots', () => ({ hitShot: () => false }));
vi.mock('../../src/player', () => ({ playerHit: () => { S.hits++; } }));
vi.mock('../../src/enemies/update', () => ({ killEnemy: noop }));
vi.mock('../../src/depth', () => ({ DEPTH: { driveRank: .6 }, driveMul: () => 1 }));
vi.mock('../../src/enemies/spawn', async () => ({
  BS: () => 1, aimA: (x: number, y: number) => Math.atan2($.P.y - y, $.P.x - x), wrapA: (a: number) => Math.atan2(Math.sin(a), Math.cos(a)),
  eshoot: (x: number, y: number, a: number, sp: number, k = 'orb') => { W.eshots.push({ x, y, k }); },
  banner: (t: string) => { S.banners.push(t); },
  mk: (k: string, x: number, y: number, o: any = {}) => { const e: any = { k, x, y, ...o }; W.enemies.push(e); return e; },
}));

const BU = await import('../../src/boss/update');
const { DRIVE, tentBase } = await import('../../src/boss/bossrules');
const L = await import('../../src/layout');

let b: any;
beforeEach(() => {
  L.setLayout('long4');
  W.enemies.length = 0; W.eshots.length = 0; S.hits = 0; S.banners.length = 0;
  $.G = { loop: 0, stage: 3, tier: 1, rank: 0, scroll: 0, shake: 0, glitch: 0, score: 0, st: { hits: 0 }, pend: [], gm: {} };
  $.P = { x: 120, y: 127, alive: true, inv: 0, hist: [] };
  BU.startBoss();
  b = $.G.boss;
  b.x = b.tx; b.enter = 0;
});
const step = (n: number, each?: () => void) => { for (let i = 0; i < n; i++) { BU.updateBoss(); each && each(); } };

describe('the Gravity Drive on long4', () => {
  it('base HP DRIVE.hp, plates DRIVE.plateHp, no rank term (C22)', () => {
    expect(b.max).toBe(DRIVE.hp);
    expect(b.plates.every((p: any) => p.max === DRIVE.plateHp)).toBe(true);
    expect(b.g3).toBe(1);
  });
  it('THE REACH: a 46 f coil whose aim locks for its last 16, then 190 px out at the ship', () => {
    const t = b.tent[0];
    let f = 0;
    while (!t.rs && f++ < 400) { step(1); W.eshots.length = 0; }
    expect(t.rs).toBe(1);
    const ra: number[] = [];
    let tell = 0;
    while (t.rs === 1) { $.P.y = 127 + tell * 2; step(1); W.eshots.length = 0; ra.push(t.ra); tell++; }
    expect(tell).toBe(DRIVE.reach.tell);
    expect(new Set(ra.slice(-DRIVE.reach.lock)).size).toBe(1);
    step(DRIVE.reach.ext);
    const pts = BU.tentPts(b, t), B = tentBase(b.x, b.y, t.side);
    expect(Math.hypot(pts[16].x - B.x, pts[16].y - B.y)).toBeCloseTo(DRIVE.reach.len, 0);
  });
  it('phase 0 fires <= 13 bullets in any 120 f (was ~16 plus)', () => {
    const per: number[] = [];
    step(1200, () => { per.push(W.eshots.length); W.eshots.length = 0; });
    let mx = 0;
    for (let i = 0; i + 120 <= per.length; i++) mx = Math.max(mx, per.slice(i, i + 120).reduce((s, n) => s + n, 0));
    expect(mx).toBeLessThanOrEqual(13);
  });
  it('phase 2: no spiral, the twin beam, then both limbs close as a pincer', () => {
    for (const p of b.plates) p.hp = 0;
    b.hp = b.max * .3;
    let twin = false, pincer = false;
    const per: number[] = [];
    step(900, () => {
      per.push(W.eshots.length); W.eshots.length = 0;
      if (b.laser && b.laser.ang2 != null) twin = true;
      if (b.tent.every((t: any) => t.rs && t.tx != null)) pincer = true;
    });
    expect(b.phase).toBe(2);
    expect(twin).toBe(true);
    expect(pincer).toBe(true);
    let mx = 0;
    for (let i = 0; i + 120 <= per.length; i++) mx = Math.max(mx, per.slice(i, i + 120).reduce((s, n) => s + n, 0));
    expect(mx).toBeLessThanOrEqual(8); // was 40+: the double spiral every 6 f
  });
  it('collapses at 45 s and self-destructs at 60 s: no bounty, grade capped at C (C23)', () => {
    $.P.x = 20; $.P.y = 20;
    step(DRIVE.collapse - 1, () => { W.eshots.length = 0; $.P.inv = 9999; });
    expect(b.plates.some((p: any) => p.hp > 0)).toBe(true);
    step(1);
    expect(b.plates.every((p: any) => p.hp <= 0)).toBe(true);
    expect(S.banners).toContain('THE WELL COLLAPSES');
    step(DRIVE.destruct - DRIVE.collapse - 1, () => { W.eshots.length = 0; });
    expect(b.dying).toBeFalsy();
    step(1);
    expect(b.dying).toBeGreaterThan(0);
    expect(b.timed).toBe(1);
    expect($.G.st.gcap).toBe('C');
    expect($.G.score).toBe(0);
  });
  it('the clock stops while the ship is dead', () => {
    $.P.alive = false;
    step(600);
    expect(b.ft).toBe(0);
  });
});
