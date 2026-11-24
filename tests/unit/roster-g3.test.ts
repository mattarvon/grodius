// G3 roster rules through the real enemies/spawn.ts + enemies/update.ts on long4 (DIFFICULTY-SPEC §2.1 / §2.3,
// workstream W1), DOM-side modules stubbed (the notice.test.ts pattern, spawn left real):
//   - the designated formation shooter: one 12 f tell, one led orb, max 2 a formation, the second only at rank >= 14
//   - sentries, mutants and slimes fire at a ship behind them; the sentry's 44 f tell (26 track + 18 lock)
//   - revenge: no R() at chance 0 (Normal Descent 1), one queued orb on Hard; a recovery carrier's typed pod; the
//     blue capsule every 12th red; CREW KNOTS splitting into clumps and 1 HP corpses
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const noop = () => {};
const W = vi.hoisted(() => ({ enemies: [] as any[], eshots: [] as any[], caps: [] as any[], orbs: [] as any[], geysers: [] as any[], draws: 0, maxed: [] as number[], scab: 0, ceil: 0, floor: 224 }));
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
vi.mock('../../src/perks', () => ({ gainXP: noop, pk: (k: string) => (k === 'scab' ? W.scab : 0), scabChance: () => .03, spillSlick: noop })); // scabChance: perks.ts's long4 SURV.scab
vi.mock('../../src/stages', () => ({ clearStage: noop, deepPay: () => 1 }));
vi.mock('../../src/mutations', () => ({ countKill: noop }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3, playerHit: noop, slotMaxed: (i: number) => W.maxed.includes(i), wardCap: () => Math.min(3, ($.P && $.P.wardLv) || 0) })); // wardCap: player.ts's long4 rule
vi.mock('../../src/contraptions', () => ({ onKillContraptions: noop }));
vi.mock('../../src/enemies/elite', () => ({ eliteKill: noop, eliteTick: noop }));
vi.mock('../../src/boss/update', () => ({ startBoss: noop }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoWarn: noop, ufoKilled: noop, updUfo: noop }));
vi.mock('../../src/enemies/mid', () => ({}));

const S = await import('../../src/enemies/spawn');
const U = await import('../../src/enemies/update');
const L = await import('../../src/layout');
const { BUL, KNOT, ENTRY } = await import('../../src/notice');
const ENTRY_GAP = ENTRY.gap;

const G0 = () => ({ t: 0, loop: 0, stage: 1, rank: 0, scroll: 0, scrollSpeed: 1, shake: 0, hitstop: 0, pow: 0, score: 0, bio: 0, combo: 0, comboT: 0, kills: 0, maxCombo: 0, st: { kills: 0, chain: 0, spawned: 0 }, warn: [], pend: [] });
beforeEach(() => {
  L.setLayout('long4');
  W.maxed = []; W.scab = 0; W.ceil = 0; W.floor = 224;
  W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.draws = 0;
  $.T = 0;
  $.G = G0();
  $.P = { x: 60, y: 127, alive: true };
  $.meta = { bio: 0 };
});
/** step every live enemy n frames, G.t and $.T counting */
const run = (n: number, only?: any[]) => { for (let i = 0; i < n; i++) { $.T++; $.G.t++; for (const e of only || [...W.enemies]) if (!e.dead) U.updEnemy(e); } };

describe('the designated formation shooter (C6; gate N1)', () => {
  it('fires one led orb after a 12 f flash once it reaches W * .94, the leader only, and never again', () => {
    S.formation('sine', 127, 4, { fixed: 1 });
    const lead = W.enemies[0];
    let tellAt = -1, shotAt = -1;
    for (let f = 0; f < 300 && shotAt < 0; f++) { run(1); if (tellAt < 0 && lead.tl > 0) tellAt = f; if (W.eshots.length) shotAt = f; }
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

  it('a shooter killed before it fires hands its one shot to the next member; the formation still fires once', () => {
    S.formation('sine', 127, 4, { fixed: 1 });
    const [lead, m1] = W.enemies;
    for (let f = 0; f < 300 && !(lead.tl > 0); f++) run(1);
    expect(lead.tl).toBeGreaterThan(0);
    U.killEnemy(lead); // shot inside its tell
    expect(lead.sh).toBe(0);
    expect(m1.sh).toBe(1);
    expect(W.enemies.filter((e) => !e.dead && e.sh === 1).length).toBe(1);
    run(400);
    expect(W.eshots.length).toBe(1);
    // one that already fired gives nothing away
    W.eshots.length = 0; W.enemies.length = 0;
    S.formation('sine', 127, 3, { fixed: 1 });
    const [a, b] = W.enemies;
    for (let f = 0; f < 300 && !a.shot; f++) run(1);
    U.killEnemy(a);
    expect(b.sh).toBeFalsy();
  });

  it('a wiped formation keeps its unfired shooter (the probe still counts it); a rank extra never takes the shot', () => {
    S.formation('sine', 127, 2, { fixed: 1 });
    const [a, b] = W.enemies;
    U.killEnemy(b); // the tail (sh 2) first: the leader holds sh 1, nobody to take sh 2
    expect(b.sh).toBe(2);
    U.killEnemy(a); // the last one: no successor
    expect(a.sh).toBe(1);
    W.enemies.length = 0;
    S.formation('sine', 127, 3, { fixed: 1 });
    const [l, m, t] = W.enemies;
    m.extra = 1;
    U.killEnemy(l);
    expect(m.sh).toBeFalsy(); // the extra is skipped ...
    expect(t.sh).toBe(1); //     ... and the tail is promoted from sh 2: the formation fires once
    expect(W.enemies.filter((e) => !e.dead && e.sh).length).toBe(1);
  });

  it('at rank >= 14 a dead leader passes to a middle member, so the formation still fires at most twice', () => {
    $.G.tier = 3; $.G.stage = 3; $.G.loop = 1;
    S.formation('sine', 127, 4, { fixed: 1 });
    const [lead] = W.enemies;
    for (let f = 0; f < 300 && !(lead.tl > 0); f++) run(1);
    U.killEnemy(lead);
    expect(W.enemies.filter((e) => !e.dead).map((e) => e.sh || 0)).toEqual([1, 0, 2]);
    run(500);
    expect(W.eshots.length).toBe(2);
  });

  it('a wall entry with no wall at the lane: the other wall, then the same edge drop / rise (never a right entry)', () => {
    W.floor = 400; // no floor on screen, the ceiling at 0
    S.entryWave({ edge: 'wall', pat: 'rise' }, 120, 3);
    expect($.G.warn.at(-1)).toMatchObject({ edge: 'top', birth: 1 }); // the ceiling instead
    W.ceil = -200; $.G.warn.length = 0; $.G.pend.length = 0;
    S.entryWave({ edge: 'wall', pat: 'rise' }, 120, 3);
    expect($.G.warn.at(-1).birth).toBeFalsy();
    expect($.G.warn.at(-1).edge).toBe('bottom'); // a rise wave's chevron
    $.G.pend[0].f();
    expect(W.enemies.length).toBe(3);
    expect(W.enemies.every((e) => e.pat === 'rise')).toBe(true);
  });

  it('a drop / rise shooter neither tells nor fires while it is still inside the rock (round 4: its shot died in the floor)', () => {
    const fl = 224; // the stub floor (world floorAt)
    S.formation('rise', 230, 3, { fixed: 1 });
    const lead = W.enemies[0];
    for (let f = 0; f < 200 && !lead.shot; f++) { run(1); if (lead.tl > 0) expect(lead.y).toBeLessThan(fl); }
    expect(lead.shot).toBe(1);
    expect(W.eshots.length).toBe(1);
    expect(W.eshots[0].y).toBeLessThan(fl - 6);
  });

  it('a rear wave shooter fires at the ship ahead of it from behind, through its phase-in ghost', () => {
    $.P.x = 300;
    S.formation('behind', 127, 3, { fixed: 1 });
    const lead = W.enemies[0];
    for (let f = 0; f < 300 && !W.eshots.length; f++) run(1);
    expect(lead.x).toBeLessThan(300 - 64); // it fired from behind the ship
    expect(lead.ghost).toBe(0); // solid from its tell on
    run(300);
    expect(W.eshots.length).toBe(1);
    expect(W.eshots[0].vx).toBeGreaterThan(0);
  });

  it('two shots of one formation leave at least 16 f apart (rank >= 14, a 2-drone rear wave: its tail is 16 px back)', () => {
    $.G.tier = 3; $.G.stage = 3; $.G.loop = 1; // rank >= 14 (the test above)
    $.P.x = 300;
    S.formation('behind', 127, 2, { fixed: 1 });
    const at: number[] = [];
    for (let f = 0; f < 400; f++) { const n = W.eshots.length; run(1); if (W.eshots.length > n) at.push(f); }
    expect(at.length).toBe(2);
    expect(at[1] - at[0]).toBeGreaterThanOrEqual(16);
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

  it('with the scroll held, a slime that rears up near the right edge never spits from within 40 px of it', () => {
    $.G.scrollSpeed = 0; $.P.x = 200; $.P.y = 120;
    const e = S.mk('slime', 470, 218, { o: 1, spd: 0, cool: 1, st: 'ooze', wt: 0, ph: 0 });
    run(80, [e]);
    expect(W.eshots.length).toBe(0);
  });

  it('a long4 sentry fires one burst, then moves on (B2)', () => {
    $.P.x = 100; $.P.y = 100;
    const e = S.mk('sentry', 300, 100, { y0: 100, tx: 300, st: 'hover', wt: 0, cool: 1, shots: 0, ph: 0 });
    run(200, [e]);
    expect(e.shots).toBe(BUL.sentryBursts);
    expect(e.st).toBe('leave');
  });

  it('a sentry holds still through its 18 f lock, so the locked line does not move', () => {
    $.P.x = 100; $.P.y = 100;
    const e = S.mk('sentry', 470, 60, { y0: 100, tx: 300, st: 'hover', wt: 0, cool: 1, shots: 0, ph: 0 });
    run(1, [e]);
    expect(e.st).toBe('tel');
    run(44 - 18, [e]);
    const x = e.x, y = e.y;
    run(17, [e]);
    expect(e.st).toBe('tel');
    expect(e.x).toBe(x);
    expect(e.y).toBe(y);
  });

  it('a drop-in sentry takes a lane 70 px behind the ship when there is room, else its scripted x', () => {
    $.G.stage = 0; // Open Orbit
    $.P.x = 300; $.G.sentN = 1; // every 2nd drops
    S.sentry(60, 380);
    expect($.G.warn[$.G.warn.length - 1].x).toBe(230);
    $.P.x = 100; $.G.sentN = 1;
    S.sentry(60, 380);
    expect($.G.warn[$.G.warn.length - 1].x).toBe(380);
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

  it('an authored opener pod is never blue: the blue moves to the next red that is not an opener', () => {
    for (let i = 0; i < 11; i++) U.dropCap(100, 100);
    U.dropCap(100, 100, null, 1); // the 12th red is an opener's pod: it pays power
    U.dropCap(100, 100, null, 1); // a second opener in a row still pays
    U.dropCap(100, 100); //           the owed blue
    U.dropCap(100, 100);
    expect(W.caps.map((c) => (c.blue ? 'b' : c.ty >= 0 ? 'r' : '?')).join('')).toBe('r'.repeat(13) + 'br');
    expect($.G.blueOwe).toBe(0);
    // the carrier's own kill passes the flag: wiping an opener out on the 12th red drops a power pod, and owes the blue
    W.caps.length = 0; $.G.redN = 11;
    const g = S.formation('sine', 127, 3, { fixed: 1, pod: 1, open: 1 });
    for (const e of W.enemies.filter((x) => x.group === g)) { e.cap = false; U.killEnemy(e); }
    expect(W.caps.length).toBe(1);
    expect(W.caps[0].blue).toBe(false);
    expect(W.caps[0].ty).toBeGreaterThanOrEqual(0);
    expect($.G.blueOwe).toBe(1);
  });

  it('a knot tears into 2 clumps, a clump into 2 one-hit corpses', () => {
    const k = S.knot(60);
    U.killEnemy(k);
    const cl = W.enemies.filter((e) => e.k === 'clump');
    expect(cl.length).toBe(2);
    expect(cl.every((c) => Math.abs(c.hp - KNOT.clumpHp * c.dm) < 1e-9)).toBe(true); // clumpHp x depthHP
    U.killEnemy(cl[0]);
    const co = W.enemies.filter((e) => e.k === 'corpse');
    expect(co.length).toBe(2);
    expect(co.every((c) => Math.abs(c.hp - 1) < 1e-9)).toBe(true);
    // thrown +-40 deg off the knot's leftward travel
    expect(Math.sign(cl[0].kvy)).toBe(-Math.sign(cl[1].kvy));
    expect(cl.every((c) => c.kvx < 0)).toBe(true);
  });

  it('a formation spawning on the ship moves out along its entry edge as a whole (S5), keeping its spacing, with no R()', () => {
    const cases: [string, number, number, number][] = [['sine', 470, 127, 127], ['zig', 470, 127, 127], ['loop', 470, 127, 127], ['wall', 470, 127, 127], ['behind', 10, 127, 127], ['sine', 470, 127, 1]];
    for (const [pat, px, py, n0] of cases) {
      W.enemies.length = 0; W.draws = 0; $.P = { x: px, y: py, alive: true };
      S.formation(pat, 127, pat === 'sine' && n0 === 1 ? 1 : 4, { fixed: 1 });
      for (const e of W.enemies) expect(Math.hypot(e.x - px, e.y - py)).toBeGreaterThanOrEqual(BUL.noBody + BUL.bodyPad - 1e-6);
      if (pat !== 'wall' && W.enemies.length > 1) expect(Math.abs(W.enemies[1].x - W.enemies[0].x)).toBe(16);
      expect(W.draws).toBe(0);
    }
    W.enemies.length = 0; $.P = { x: 300, y: 10, alive: true };
    S.formation('drop', 300, 3, { fixed: 1 });
    expect(W.enemies.every((e) => Math.hypot(e.x - 300, e.y - 10) >= BUL.noBody + BUL.bodyPad - 1e-6)).toBe(true);
    expect(W.enemies[1].y - W.enemies[0].y).toBe(-ENTRY_GAP);
  });

  it('a long4 flayer in reach starts its tell within 4 f of its clock running out', () => {
    $.P.x = 200; $.P.y = 127;
    const e = S.mk('flayer', 300, 127, { y0: 127, tx: 300, ws: 'idle', wt: 0, ang: Math.PI, cool: 1, hunt: 0 });
    $.P.x = 10; // out of its 155 px reach
    run(3, [e]);
    expect(e.ws).toBe('idle');
    $.P.x = 200;
    run(BUL.flayRetry, [e]);
    expect(e.ws).toBe('tel');
  });

  // (the tell waits for the 64 px; qa-lead. Since round 4 the phase-in ghost waits for it too: next test)
  it('a rear-wave shooter holds its tell while the ship is within 64 px and never fires from inside it', () => {
    $.P.x = 60; $.P.y = 127;
    S.formation('behind', 127, 3, { fixed: 1 });
    const lead = W.enemies[0];
    for (let f = 0; f < 200 && lead.x < $.P.x; f++) {
      run(1);
      if (Math.hypot($.P.x - lead.x, $.P.y - lead.y) < BUL.noShot) expect(lead.tl || 0).toBe(0);
    }
    expect(W.eshots.length).toBe(0); // never a shot from inside 64 px
  });

  it('a rear entrant stays a ghost while the ship is within 64 px, and turns solid once it is that far off', () => {
    $.P.x = 92; $.P.y = 127; // where a rear wave's ghost used to run out (x ~92), on the ship's lane
    S.formation('behind', 127, 3, { fixed: 1 });
    S.hatch(2, true, 1);
    const rear = [...W.enemies];
    for (let f = 0; f < 260; f++) {
      run(1);
      for (const e of rear) if (!(e.ghost > 0)) expect(Math.hypot($.P.x - e.x, $.P.y - e.y) >= BUL.noShot || !!e.wasSolid, `${e.k} ${e.i ?? ''} solid at ${e.x.toFixed(0)},${e.y.toFixed(0)} tl ${e.tl} t ${e.t} f ${f}`).toBe(true);
      for (const e of rear) if (!(e.ghost > 0)) e.wasSolid = 1;
    }
    expect(rear.every((e) => !(e.ghost > 0))).toBe(true); // all solid once they are past
  });

  it('a child that would be born within 48 px of the ship is not (S5)', () => {
    const k = S.knot(60);
    $.P.x = k.x - 30; $.P.y = k.y;
    U.killEnemy(k);
    expect(W.enemies.filter((e) => e.k === 'clump').length).toBe(0);
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
