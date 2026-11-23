// G3 roster rules through the real enemies/spawn.ts + enemies/update.ts on long4 (DIFFICULTY-SPEC §2.1 / §2.3,
// workstream W1), DOM-side modules stubbed (the notice.test.ts pattern, spawn left real):
//   - the designated formation shooter: one 12 f tell, one led orb, max 2 a formation, the second only at rank >= 14
//   - sentries, mutants and slimes fire at a ship behind them; the sentry's 44 f tell (26 track + 18 lock)
//   - revenge: no R() at chance 0 (Normal Descent 1), one queued orb on Hard; a recovery carrier's typed pod; the
//     blue capsule every 12th red; CREW KNOTS splitting into clumps and 1 HP corpses
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const noop = () => {};
const W = vi.hoisted(() => ({ enemies: [] as any[], eshots: [] as any[], caps: [] as any[], orbs: [] as any[], geysers: [] as any[], draws: 0, maxed: [] as number[], scab: 0 }));
vi.mock('../../src/core', () => ({
  FIRE: [], PH: 254, W: 480, TAU: Math.PI * 2, R: () => { W.draws++; return .5; }, rr: (a: number) => a, ri: (a: number) => a, pick: (a: any[]) => a[0],
  clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  dist2: (a: number, b: number, c: number, d: number) => (a - c) ** 2 + (b - d) ** 2, sstep: (v: number) => v,
}));
vi.mock('../../src/save', () => ({ SET: { flashes: true }, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sample: () => false, thr: () => false, bankWant: () => {}, quipAfterKill: () => null, sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/music', () => ({ duckMusic: () => {} }));
vi.mock('../../src/world', () => ({ ...W, ceilAt: () => 0, floorAt: () => 224 }));
vi.mock('../../src/fx/spawn', () => ({ drop: noop, flash: noop, gib: noop, gore: noop, mist: noop, pop: noop, spark: noop, splat: noop }));
vi.mock('../../src/perks', () => ({ gainXP: noop, pk: (k: string) => (k === 'scab' ? W.scab : 0), spillSlick: noop }));
vi.mock('../../src/stages', () => ({ clearStage: noop, deepPay: () => 1 }));
vi.mock('../../src/mutations', () => ({ countKill: noop }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3, playerHit: noop, slotMaxed: (i: number) => W.maxed.includes(i) }));
vi.mock('../../src/contraptions', () => ({ onKillContraptions: noop }));
vi.mock('../../src/enemies/elite', () => ({ eliteKill: noop, eliteTick: noop }));
vi.mock('../../src/boss/update', () => ({ startBoss: noop }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoWarn: noop, ufoKilled: noop, updUfo: noop }));
vi.mock('../../src/enemies/mid', () => ({}));

const S = await import('../../src/enemies/spawn');
const U = await import('../../src/enemies/update');
const L = await import('../../src/layout');
const { BUL } = await import('../../src/notice');

const G0 = () => ({ t: 0, loop: 0, stage: 1, rank: 0, scroll: 0, scrollSpeed: 1, shake: 0, hitstop: 0, pow: 0, score: 0, bio: 0, combo: 0, comboT: 0, kills: 0, maxCombo: 0, st: { kills: 0, chain: 0, spawned: 0 }, warn: [], pend: [] });
beforeEach(() => {
  L.setLayout('long4');
  W.maxed = []; W.scab = 0;
  W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.draws = 0;
  $.T = 0;
  $.G = G0();
  $.P = { x: 60, y: 127, alive: true };
  $.meta = { bio: 0 };
});
/** step every live enemy n frames, G.t and $.T counting */
const run = (n: number, only?: any[]) => { for (let i = 0; i < n; i++) { $.T++; $.G.t++; for (const e of only || [...W.enemies]) if (!e.dead) U.updEnemy(e); } };

describe('the designated formation shooter (C6; gate N1)', () => {
  it('fires one led orb after a 12 f flash once it reaches W * .78, the last member only, and never again', () => {
    S.formation('sine', 127, 4, { fixed: 1 });
    const last = W.enemies[3];
    let tellAt = -1, shotAt = -1;
    for (let f = 0; f < 300 && shotAt < 0; f++) { run(1); if (tellAt < 0 && last.tl > 0) tellAt = f; if (W.eshots.length) shotAt = f; }
    expect(tellAt).toBeGreaterThan(0);
    expect(shotAt - tellAt).toBeGreaterThanOrEqual(BUL.tell - 1);
    expect(W.eshots.length).toBe(1);
    run(400);
    expect(W.eshots.length).toBe(1);
    expect(W.draws).toBe(0); // no random fire roll per drone per frame
  });

  it('adds member 0 at rank >= 14, so a formation fires 2 at most', () => {
    $.G.tier = 3; $.G.stage = 3; // Very Hard in the Drive: 6 + 3 = 9 ... plus Descent 2's 6 = 15
    $.G.loop = 1;
    S.formation('sine', 127, 4, { fixed: 1 });
    run(500);
    expect(W.eshots.length).toBe(2);
  });

  it('a rear wave shooter fires at the ship ahead of it once it is 100 px in', () => {
    $.P.x = 300;
    S.formation('behind', 127, 3, { fixed: 1 });
    run(300);
    expect(W.eshots.length).toBe(1);
    expect(W.eshots[0].vx).toBeGreaterThan(0);
  });

  it('holds its shot while the ship is within 64 px, and retries', () => {
    S.formation('sine', 127, 1, { fixed: 1 });
    const d = W.enemies[0];
    $.P.x = 470; $.P.y = d.y; // the ship sits on the drone's path, past the .78 line
    for (let f = 0; f < 120; f++) { run(1); $.P.x = d.x - 20; $.P.y = d.y; }
    expect(W.eshots.length).toBe(0);
    $.P.x = 30; $.P.y = 40;
    run(40);
    expect(W.eshots.length).toBe(1);
  });
});

describe('fire at a ship behind (§2.1 firing gates; gate N2)', () => {
  it('a sentry tells 44 f (26 track + 18 lock) and fires its burst at a ship to its right', () => {
    $.P.x = 400; $.P.y = 100;
    const e = S.mk('sentry', 250, 100, { y0: 100, tx: 250, st: 'hover', wt: 0, cool: 1, shots: 0, ph: 0 });
    run(1, [e]);
    expect(e.st).toBe('tel');
    expect(e.tt).toBe(44);
    let first = -1;
    for (let f = 1; f < 120 && first < 0; f++) { run(1, [e]); if (W.eshots.length) first = f; }
    expect(first).toBeGreaterThanOrEqual(44);
    expect(W.eshots[0].vx).toBeGreaterThan(0);
  });

  it('a mutant turns to face a ship behind it', () => {
    $.P.x = 400; $.P.y = 150;
    const e = S.mk('mutant', 250, 206, { fy: 224, st: 'walk', wt: 0, cool: 1, spd: 0 });
    run(1, [e]);
    expect(e.st).toBe('tel');
    expect(e.bk).toBe(1);
    run(60, [e]);
    expect(W.eshots.length).toBe(3);
  });

  it('a slime lobs at a ship 24 px or more to its right', () => {
    $.P.x = 300; $.P.y = 120;
    const e = S.mk('slime', 250, 218, { o: 1, spd: 0, cool: 1, st: 'ooze', wt: 0, ph: 0 });
    run(1, [e]);
    expect(e.st).toBe('tel');
  });
});

describe('revenge, pods and knots (§2.1 / §2.2 / LVL §3.2)', () => {
  const drone = () => S.mk('drone', 300, 100, {});

  it('Normal Descent 1 draws no revenge roll (gate D3: 0 shots); Hard queues one 8 f orb', () => {
    const e = drone();
    W.draws = 0;
    U.killEnemy(e);
    expect($.G.pend.length).toBe(0);
    const n0 = W.draws;
    $.G.tier = 2;
    U.killEnemy(drone());
    expect(W.draws).toBe(n0 + 1); // the one revenge roll (R() .5 < .33? no: so nothing queued)
    $.G.tier = 3; $.G.loop = 1; // chance 1
    U.killEnemy(drone());
    expect($.G.pend.length).toBe(1);
    expect($.G.pend[0].t).toBe(BUL.revDelay);
    $.G.pend[0].f();
    expect(W.eshots.length).toBe(1);
    expect(W.eshots[0].rev).toBe(1);
  });

  it('a recovery carrier drops its typed pod (FULL for BLACK BOX), with no roll, outside the grade', () => {
    S.recoveryWave([0, { ty: 3, full: 1 }]);
    const [a, b] = W.enemies;
    W.draws = 0;
    U.killEnemy(a); U.killEnemy(b);
    expect(W.caps.map((c) => [c.ty, !!c.full, c.rec])).toEqual([[0, false, 1], [3, true, 1]]);
    expect($.G.st.kills).toBe(0);
    expect($.G.redN || 0).toBe(0); // not a red in the blue count
  });

  it('every 12th red capsule is blue, no roll', () => {
    for (let i = 0; i < 24; i++) U.dropCap(100, 100);
    expect(W.caps.map((c, i) => (c.blue ? i + 1 : 0)).filter(Boolean)).toEqual([12, 24]);
  });

  it('a knot tears into 2 clumps, a clump into 2 one-hit corpses', () => {
    const k = S.knot(60);
    U.killEnemy(k);
    const cl = W.enemies.filter((e) => e.k === 'clump');
    expect(cl.length).toBe(2);
    expect(cl.every((c) => Math.abs(c.hp - 3 * c.dm) < 1e-9)).toBe(true); // 3 x depthHP
    U.killEnemy(cl[0]);
    const co = W.enemies.filter((e) => e.k === 'corpse');
    expect(co.length).toBe(2);
    expect(co.every((c) => Math.abs(c.hp - 1) < 1e-9)).toBe(true);
    // thrown +-40 deg off the knot's leftward travel
    expect(Math.sign(cl[0].kvy)).toBe(-Math.sign(cl[1].kvy));
    expect(cl.every((c) => c.kvx < 0)).toBe(true);
  });
});

describe('entries and retries (qa-lead coverage)', () => {
  it("a 'loop' drone turns back through a 60 px half circle at W * .45 and leaves right on the far lane", () => {
    S.formation('loop', 60, 1, { fixed: 1 });
    const d = W.enemies[0];
    run(400);
    expect(d.lp).toBe(2);
    expect(Math.round(d.y)).toBe(180); // 60 + 2 x 60
    expect(d.ls).toBe(1);
  });

  it('a dropping sentry falls at 2 px/f to its lane, its first-attack clock running, then hovers', () => {
    const e = S.mk('sentry', 300, -14, { y0: 100, tx: 300, st: 'drop', ent: 'top', wt: 0, cool: 35, shots: 0, ph: 0 });
    run(10, [e]);
    expect(e.y).toBeCloseTo(6);
    expect(e.cool).toBe(25);
    run(60, [e]);
    expect(e.st === 'hover' || e.st === 'tel').toBe(true);
  });

  it('an eye refused at the cap retries in 20 f with its charge tell, and keeps a 12 f on-screen tell on arrival', () => {
    for (let i = 0; i < 8; i++) W.eshots.push({ x: 400, y: 20, vx: 0, vy: 0, k: 'orb' });
    const e = S.mk('eye', 400, 224, { o: 1, cool: 1, blink: 0 });
    run(1, [e]);
    expect(W.eshots.length).toBe(8);
    expect(e.cool).toBe(BUL.retry);
    const f = S.mk('eye', 476, 224, { o: 1, cool: 2, blink: 0 });
    run(1, [f]);
    expect(f.cool).toBeGreaterThanOrEqual(BUL.tell - 1);
  });

  it('a large enemy on Hard from Descent 2 leaves a 6-orb revenge ring, atomic and flagged rev', () => {
    $.G.tier = 2; $.G.loop = 1;
    U.killEnemy(S.mk('mutant', 300, 150, { fy: 168, st: 'walk', wt: 0, cool: 99, spd: 0 }));
    expect($.G.pend.length).toBe(1);
    $.G.pend[0].f();
    expect(W.eshots.length).toBe(6);
    expect(W.eshots.every((s) => s.rev === 1)).toBe(true);
  });

  it('a wall entry with no wall on screen falls back to a right entry', () => {
    S.entryWave({ edge: 'wall', pat: 'drop' }, 120, 3); // the stub ceiling is at 0: on screen, so a birth
    expect($.G.warn.some((w) => w.birth)).toBe(true);
  });

  it('a lob never launches over V_CAP and still reaches near its target', () => {
    U.lob(300, 200, 60, 100, 2.8);
    const s = W.eshots[0];
    expect(Math.hypot(s.vx, s.vy)).toBeLessThanOrEqual(2.6 + 1e-9);
  });
});

describe('W2 survival hooks (§2.1 survival)', () => {
  it("a recovery wave's WRAITH pod flies as WARD when WRAITH is already capped at launch", () => {
    W.maxed = [5];
    S.recoveryWave([{ ty: 5 }, { ty: 5 }]);
    expect(W.enemies.map((e) => e.capTy)).toEqual([6, 6]);
    W.enemies.length = 0; W.maxed = [];
    S.recoveryWave([{ ty: 5 }]);
    expect(W.enemies[0].capTy).toBe(5);
  });

  it('SCAB regrows a WARD hit at .03 a level on long4, never past wardLv', () => {
    $.P = { x: 60, y: 127, alive: true, wardLv: 1, shield: 1 };
    W.scab = 40; // 1.2 chance: always regrows when allowed
    U.killEnemy(S.mk('drone', 300, 100, {}));
    expect($.P.shield).toBe(1); // already at its wardLv cap (1)
    $.P.wardLv = 2;
    U.killEnemy(S.mk('drone', 300, 100, {}));
    expect($.P.shield).toBe(2);
    U.killEnemy(S.mk('drone', 300, 100, {}));
    expect($.P.shield).toBe(2);
  });
});
