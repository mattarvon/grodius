// G3 bullets, roster and entries (DIFFICULTY-SPEC §2.1 / §2.3, workstream W1), through the real enemies/spawn.ts with
// the DOM-side modules stubbed (the formation.test.ts pattern). long4 is the G3 layout; short must stay today's game.
//   - hard on-screen caps 8 / 16 / 24 by context and tier, haz shots uncounted, volleys atomic (a 9-ring with 3 slots
//     left spawns 0 and is refused), the 64 px no-spawn rule, V_CAP, the rev flag (gates B1, S1, F1, D3)
//   - the designated formation shooter (C6), recovery waves (C17), authored opening carriers, popcorn 1 HP (R2)
//   - drop / rise edge waves, the entry mix and the CREW KNOTS lane rules (N4, L7)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const W = vi.hoisted(() => ({ enemies: [] as any[], eshots: [] as any[], draws: 0 }));
vi.mock('../../src/core', () => ({
  PH: 254, TAU: Math.PI * 2, W: 480, R: () => { W.draws++; return .99; }, pick: (a: any[]) => a[0], ri: (a: number) => a, rr: (a: number) => a,
  clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)),
}));
vi.mock('../../src/audio', () => ({ sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/world', () => ({ ceilAt: () => 0, enemies: W.enemies, eshots: W.eshots, floorAt: () => 254 }));
vi.mock('../../src/boss/update', () => ({ startBoss: () => {} }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoWarn: () => {} }));
vi.mock('../../src/enemies/mid', () => ({}));

const S = await import('../../src/enemies/spawn');
const N = await import('../../src/notice');
const C = await import('../../src/cellpick');
const L = await import('../../src/layout');

const fresh = (id: 'short' | 'long4' = 'long4', g: any = {}) => {
  L.setLayout(id);
  $.G = { t: 100, loop: 0, stage: 1, pow: 0, st: { spawned: 0 }, warn: [], pend: [], ...g };
  $.P = { x: 60, y: 127, alive: true };
  W.enemies.length = 0;
  W.eshots.length = 0;
  W.draws = 0;
};
const fill = (n: number, o: any = {}) => { for (let i = 0; i < n; i++) W.eshots.push({ x: 400, y: 20, vx: 0, vy: 0, k: 'orb', ...o }); };
const FAR = [400, 127] as const; // a shooter well clear of the ship's 64 px

describe('bullet caps (§2.1, C4/C5; gate B1)', () => {
  beforeEach(() => fresh());

  it('caps a scroll at 8 counted shots on Normal: the 9th is refused', () => {
    for (let i = 0; i < 8; i++) expect(S.eshoot(...FAR, Math.PI, 1.4)).toBeTruthy();
    expect(S.eshoot(...FAR, Math.PI, 1.4)).toBeNull();
    expect(S.refused()).toBe(true);
    expect(W.eshots.length).toBe(8);
  });

  it('a 9-ring with 3 slots left spawns 0 and is refused (atomic volley)', () => {
    fill(5);
    expect(S.ring(...FAR, 9, 0, 1.2, 'orb')).toBe(false);
    expect(W.eshots.length).toBe(5);
    expect(S.refused()).toBe(true);
    expect(S.fan(...FAR, Math.PI, 3, .2, 1.2, 'orb')).toBe(true);
    expect(W.eshots.length).toBe(8);
  });

  it('a hazard shot (haz: KEEPSAKE planted forks) is not counted', () => {
    fill(20, { haz: 1 });
    expect(S.countedShots()).toBe(0);
    expect(S.fan(...FAR, Math.PI, 8, .1, 1.2, 'orb')).toBe(true);
  });

  it('reads the context: a midboss 16, a stage boss or the Drive 24, the Orbit Maw a midboss', () => {
    fill(8);
    expect(S.eshoot(...FAR, 0, 1)).toBeNull();
    $.G.mini = { k: 'ufo', mid: 1 };
    expect(S.capOf()).toBe(16);
    expect(S.eshoot(...FAR, 0, 1)).toBeTruthy();
    $.G.mini = { k: 'crux' };
    expect(S.capOf()).toBe(24);
    $.G.mini = null;
    $.G.boss = {};
    expect(S.capOf()).toBe(24);
    $.G.boss = null;
    $.G.stage = 0; // Open Orbit's Maw is its midboss
    $.G.mini = { k: 'maw', stageBoss: true };
    expect(S.capOf()).toBe(16);
  });

  it('a regular shooter counts against the scroll cap even during a fight', () => {
    fill(8);
    $.G.mini = { k: 'ufo', mid: 1 };
    expect(S.eshoot(...FAR, 0, 1, 'orb', 'scroll')).toBeNull();
    expect(S.eshoot(...FAR, 0, 1)).toBeTruthy();
  });

  it('scales by tier: Easy 6/12/18, Hard and Very Hard 10/20/30, never above 1.5x', () => {
    for (const [t, c] of [[0, [6, 12, 18]], [1, [8, 16, 24]], [2, [10, 20, 30]], [3, [10, 20, 30]]] as const) {
      $.G.tier = t;
      expect([S.capOf('scroll'), S.capOf('setp'), S.capOf('boss')]).toEqual(c);
    }
  });

  it('refuses a shot spawned within 64 px of the ship (gate F1), not one at 64', () => {
    expect(S.eshoot(60 + 63, 127, Math.PI, 1)).toBeNull();
    expect(S.eshoot(60 + 64, 127, Math.PI, 1)).toBeTruthy();
    expect(S.volley(3, 60, 100)).toBe(false);
  });

  it('caps the speed at V_CAP and flags every shot rev 0, a revenge shot rev 1 (gate D3 signal)', () => {
    const s = S.eshoot(...FAR, 0, 9);
    expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(2.6);
    expect(s.rev).toBe(0);
    const r = S.revShot(...FAR, N.BUL.v.drone);
    expect(r.rev).toBe(1);
    expect(Math.hypot(r.vx, r.vy)).toBeCloseTo(.8 * 1.4 * S.BS());
  });

  it('short is untouched: no cap, no 64 px rule, no rev field', () => {
    fresh('short');
    fill(30);
    const s = S.eshoot(61, 127, 0, 1);
    expect(s).toBeTruthy();
    expect('rev' in s).toBe(false);
    expect(S.volley(50, 60, 127)).toBe(true);
  });

  it('a fan or ring closes its volley: an unspent reservation never lets the next shot skip the cap', () => {
    fill(5);
    expect(S.volley(3, ...FAR)).toBe(true); // a caller that reserves 3 and spends none...
    S.endVolley();
    fill(3);
    expect(S.eshoot(...FAR, 0, 1)).toBeNull(); // ...leaves nothing behind
    W.eshots.length = 0;
    expect(S.ring(...FAR, 4, 0, 1, 'orb')).toBe(true);
    fill(4);
    expect(S.eshoot(...FAR, 0, 1)).toBeNull();
  });

  it('the retry is min(remaining, 20 f)', () => {
    expect(N.retryIn(90)).toBe(20);
    expect(N.retryIn(7)).toBe(7);
    expect(N.retryIn(0)).toBe(1);
  });
});

describe('revenge table (§2.1; gate D3)', () => {
  it('is the Gradius V table, and 0 on Normal Descent 1', () => {
    expect(N.revChanceOf(1, 0)).toBe(0);
    expect([N.revChanceOf(1, 1), N.revChanceOf(1, 2), N.revChanceOf(1, 7)]).toEqual([.33, .5, .5]);
    expect([N.revChanceOf(2, 0), N.revChanceOf(2, 1), N.revChanceOf(2, 2)]).toEqual([.33, .5, 1]);
    expect([N.revChanceOf(3, 0), N.revChanceOf(3, 1)]).toEqual([.5, 1]);
    for (let l = 0; l < 4; l++) expect(N.revChanceOf(0, l)).toBe(0);
  });

  it('reads 0 on short whatever the tier', () => {
    fresh('short', { tier: 3, loop: 2 });
    expect(S.revChance()).toBe(0);
  });
});

describe('formations (C6, §2.2)', () => {
  beforeEach(() => fresh());

  it('marks the last scripted drone the shooter and member 0 the rank-14 second, with no R() draw', () => {
    S.formation('sine', 100, 5, { fixed: 1 });
    expect(W.enemies.map((e) => e.sh || 0)).toEqual([2, 0, 0, 0, 1]);
    expect(W.draws).toBe(0);
  });

  it('never makes a dive drone a shooter; short marks no shooter at all', () => {
    S.formation('dive', 100, 3, { fixed: 1 });
    expect(W.enemies.every((e) => !e.sh)).toBe(true);
    fresh('short');
    S.formation('sine', 100, 3, { fixed: 1 });
    expect(W.enemies.every((e) => !e.sh && !e.ent)).toBe(true);
  });

  it('records the entry edge each member came by', () => {
    S.formation('behind', 100, 2, { fixed: 1 });
    S.formation('drop', 300, 2, { fixed: 1 });
    S.formation('rise', 300, 2, { fixed: 1 });
    S.formation('loop', 100, 2, { fixed: 1 });
    expect(W.enemies.map((e) => e.ent)).toEqual(['left', 'left', 'top', 'top', 'bottom', 'bottom', 'right', 'right']);
  });

  it('an authored opening carrier (open) always drops (group.pod), takes no rank extras and is tagged group.open', () => {
    fresh('long4', { pow: 2 });
    const g = S.formation('sine', 100, 4, { open: 1 });
    expect(W.enemies.length).toBe(4);
    expect(g.open).toBe(1);
    expect(g.pod).toBe(1);
  });

  it('popcorn dies in one hit on long4 at any power (gate R2); short keeps its curve', () => {
    fresh('long4', { pow: 2 });
    const d = S.mk('drone', 300, 100), h = S.mk('hatch', 300, 100);
    expect([d.hp, h.hp]).toEqual([1, 1]);
    fresh('long4', { pow: 2, loop: 1 });
    expect(S.mk('drone', 300, 100).hp).toBeCloseTo(1.4);
  });
});

describe('recovery waves (§2.1, C17; gate E1)', () => {
  beforeEach(() => fresh());

  it('flies one carrier per type at the ship height +- 40, typed, rec, unarmed, outside the grade', () => {
    const g = S.recoveryWave([0, 2, { ty: 1, full: 1 }]);
    expect(g.rec).toBe(1);
    expect(W.enemies.map((e) => Math.round(e.y))).toEqual([87, 127, 167]);
    expect(W.enemies.map((e) => [e.capTy, e.capFull])).toEqual([[0, 0], [2, 0], [1, 1]]);
    expect(W.enemies.every((e) => e.rec && e.cap && !e.sh && e.hp === 1)).toBe(true);
    expect($.G.st.spawned).toBe(0);
    expect(W.draws).toBe(0); // typed: no keep roll, no type roll
  });

  it('keeps the lanes on the playfield near an edge', () => {
    $.P.y = 10;
    S.recoveryWave([0, 1]);
    expect(Math.min(...W.enemies.map((e) => e.y))).toBeGreaterThanOrEqual(24);
  });
});

describe('edge entries (§2.3, LVL §2.4; gate N4)', () => {
  beforeEach(() => fresh());

  it('a drop wave: a 60 f chevron at laneX = clamp(P.x + 110, 200, W - 40), then drones down that lane', () => {
    S.edgeWave('drop', 3);
    expect($.G.warn[0]).toMatchObject({ x: 200, edge: 'top', t: 60 });
    expect($.G.pend[0].t).toBe(60);
    $.P.x = 300; // the ship moves during the tell: the lane does not
    $.G.pend[0].f();
    expect(W.enemies.map((e) => e.x)).toEqual([200, 218, 236]);
    expect(W.enemies.every((e) => e.y < 0 && e.dv === 1.6 && e.pat === 'drop')).toBe(true);
  });

  it('laneX clamps', () => {
    expect(N.laneX(0, 480)).toBe(200);
    expect(N.laneX(400, 480)).toBe(440);
    expect(N.laneX(150, 480)).toBe(260);
  });

  it('a rise wave levels off on the ship half; the teaching beat flies 1.2', () => {
    $.P.y = 200;
    S.formation('rise', 300, 2, { fixed: 1, v: 1.2 });
    expect(W.enemies.every((e) => e.y > 254 && e.dv === -1.2 && e.yt === 254 * .7)).toBe(true);
  });

  it('the entry mix matches the §2.3 table within 1 point over a uniform sweep', () => {
    for (const [k, slot, row] of [['orbit', 0, 'orbit'], ['biome', 0, 'biome0'], ['biome', 1, 'biome1'], ['drive', 0, 'drive']] as const) {
      const n = 10000, cnt: Record<string, number> = {};
      for (let i = 0; i < n; i++) { const e = N.entryPick(k, slot, (i + .5) / n); cnt[e] = (cnt[e] || 0) + 1; }
      for (const [e, w] of Object.entries(N.ENTRY.mix[row])) expect(Math.abs((cnt[e] || 0) / n - w)).toBeLessThan(.01);
    }
  });

  it('droneEntry maps edges to patterns, loops only in Orbit and the Drive', () => {
    const pats = new Set<string>();
    for (let i = 0; i < 2000; i++) { const e = C.droneEntry('biome', 0, (i + .5) / 2000); pats.add(e.pat); }
    expect(pats.has('loop')).toBe(false);
    const op = new Set<string>();
    for (let i = 0; i < 2000; i++) op.add(C.droneEntry('orbit', 0, (i + .5) / 2000).pat);
    for (const p of ['sine', 'zig', 'dive', 'wall', 'loop', 'drop', 'rise', 'behind']) expect(op.has(p)).toBe(true);
  });
});

describe('firing gates (§2.1; gates N1, N2, F1)', () => {
  it('fires at a ship behind it, but never within 64 px or from within 40 px of the edge it came by', () => {
    expect(N.mayFire(300, 127, 'right', 400, 127, 480, 254)).toBe(true); // behind the shooter
    expect(N.mayFire(300, 127, 'right', 250, 127, 480, 254)).toBe(false); // 50 px
    expect(N.mayFire(450, 127, 'right', 100, 127, 480, 254)).toBe(false); // 30 px inside the right edge
    expect(N.mayFire(30, 127, 'left', 300, 127, 480, 254)).toBe(false);
    expect(N.mayFire(60, 127, 'left', 300, 127, 480, 254)).toBe(true);
    expect(N.mayFire(300, 30, 'top', 60, 127, 480, 254)).toBe(false);
    expect(N.mayFire(300, 230, 'bottom', 60, 127, 480, 254)).toBe(false);
  });
});

describe('blue capsule (§2.2)', () => {
  it('every 12th red is blue', () => {
    const b = Array.from({ length: 36 }, (_, i) => N.blueAt(i + 1));
    expect(b.filter(Boolean).length).toBe(3);
    expect(b[11] && b[23] && b[35]).toBe(true);
    expect(N.blueAt(0)).toBe(false);
  });
});

describe('CREW KNOTS (LVL §3.2; gate L7)', () => {
  it('moves a knot lane 48 px off the ship toward the larger side', () => {
    expect(N.knotLane(60, 200, 254)).toBe(60);
    expect(N.knotLane(127, 140, 254)).toBe(92); // 140 px above the ship, 114 below: up
    expect(N.knotLane(100, 90, 254)).toBe(138);
  });

  it('flips a child launched within 30 px of the ship, deterministically', () => {
    expect(N.kidAngle(Math.PI, 1, .5, 300, 100, 60, 127)).toBeCloseTo(Math.PI + .5);
    expect(N.kidAngle(Math.PI, 1, .5, 70, 127, 60, 127)).toBeCloseTo(2 * Math.PI + .5);
  });

  it('spawns a knot at W + 30 with 5-7 bodies by a counter, no R() of its own beyond mk', () => {
    fresh();
    const k = S.knot(127);
    expect(k.x).toBe(510);
    expect(k.y).toBe(127 + 48); // the ship sits on its lane: moved toward the larger side (a tie goes down)
    expect([5, 6, 7]).toContain(k.nb);
    expect(W.draws).toBe(0);
  });
});
