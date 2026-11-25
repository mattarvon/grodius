// MINI DOLL HEADS (enemies/doll.ts) through the real enemies/spawn.ts + enemies/update.ts on long4, DOM-side modules
// stubbed (the roster-g3.test.ts pattern):
//   - a group of 5 (fixed: GR rule 15) sharing one {n, killed} group, in from the right in a line DOLL.gap apart
//   - popcorn: 1 HP at every descent (spawn.ts POPCORN, gate R2)
//   - the tell: >= 20 f per head, staggered >= 12 f inside the group, only on screen and ahead of the ship
//   - the lunge locks the ship's y as the tell ends and keeps it
//   - contact only: never an eshot, alive or dying (no revenge, never elite)
//   - clearing the line rolls the group capsule (killEnemy grpDrops); dry: no gore
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const noop = () => {};
const W = vi.hoisted(() => ({ enemies: [] as any[], eshots: [] as any[], caps: [] as any[], orbs: [] as any[], geysers: [] as any[], gore: 0 }));
vi.mock('../../src/core', () => ({
  FIRE: [], PH: 254, W: 480, TAU: Math.PI * 2, R: () => .5, rr: (a: number) => a, ri: (a: number) => a, pick: (a: any[]) => a[0],
  clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  dist2: (a: number, b: number, c: number, d: number) => (a - c) ** 2 + (b - d) ** 2, sstep: (v: number) => v,
}));
vi.mock('../../src/save', () => ({ SET: { flashes: true }, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sample: () => false, thr: () => false, bankWant: () => {}, quipAfterKill: () => null, sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/music', () => ({ duckMusic: () => {} }));
vi.mock('../../src/world', () => ({ ...W, ceilAt: () => 0, floorAt: () => 224 }));
vi.mock('../../src/fx/spawn', () => ({ drop: noop, flash: noop, gib: noop, gore: () => { W.gore++; }, mist: noop, pop: noop, spark: noop, splat: noop }));
vi.mock('../../src/perks', () => ({ gainXP: noop, pk: () => 0, scabChance: () => .03, spillSlick: noop }));
vi.mock('../../src/stages', () => ({ clearStage: noop, deepPay: () => 1 }));
vi.mock('../../src/mutations', () => ({ countKill: noop }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3, playerHit: noop, slotMaxed: () => false, wardCap: () => 0 }));
vi.mock('../../src/contraptions', () => ({ onKillContraptions: noop }));
vi.mock('../../src/boss/update', () => ({ startBoss: noop }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoWarn: noop, ufoKilled: noop, updUfo: noop }));
vi.mock('../../src/enemies/mid', () => ({}));

const S = await import('../../src/enemies/spawn');
const U = await import('../../src/enemies/update');
const L = await import('../../src/layout');
const D = await import('../../src/enemies/doll');
const EL = await import('../../src/enemies/elite');
const { DOLL } = D;

const G0 = () => ({ t: 0, loop: 0, stage: 1, rank: 0, scroll: 0, scrollSpeed: 1, shake: 0, hitstop: 0, pow: 0, score: 0, bio: 0, combo: 0, comboT: 0, kills: 0, maxCombo: 0, st: { kills: 0, chain: 0, spawned: 0 }, warn: [], pend: [] });
beforeEach(() => {
  L.setLayout('long4');
  W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.gore = 0;
  $.T = 0;
  $.G = G0();
  $.P = { x: 60, y: 127, alive: true };
  $.meta = { bio: 0 };
});
/** step every live doll n frames (G.t and $.T counting); each(f) after every frame */
const run = (n: number, each?: (f: number) => void) => { for (let f = 0; f < n; f++) { $.T++; $.G.t++; for (const e of [...W.enemies]) if (!e.dead) U.updEnemy(e); if (each) each(f); } };
const heads = () => W.enemies.filter((e) => e.k === 'doll');

describe('MINI DOLL HEADS: the group', () => {
  it('spawns 5 heads in from the right, DOLL.gap apart, sharing one {n, killed} group', () => {
    const g = D.dolls(127);
    const h = heads();
    expect(h.length).toBe(5);
    expect(g).toEqual({ n: 5, killed: 0 });
    for (const e of h) expect(e.group).toBe(g);
    for (let i = 0; i < 5; i++) { expect(h[i].x).toBe(480 + DOLL.x0 + i * DOLL.gap); expect(h[i].i).toBe(i); }
    expect(S.ET.doll).toMatchObject({ hp: 1, r: 6, score: 120, bio: 1 });
  });

  it('is 5 on every tier and at any power (GR rule 15: no formation extras)', () => {
    for (const tier of [0, 1, 2, 3]) {
      W.enemies.length = 0;
      $.G = { ...G0(), tier, pow: 2, rank: 20 };
      D.dolls(127);
      expect(heads().length).toBe(5);
    }
  });

  it('is popcorn: 1 HP at every descent (depth never scales it), one bolt kills it', () => {
    for (const loop of [0, 1, 2]) {
      W.enemies.length = 0;
      $.G = { ...G0(), loop, stage: 3 };
      const e = S.mk('doll', 300, 100);
      expect(e.dm).toBe(1);
      expect(e.hp).toBeCloseTo(1 + .4 * loop);
    }
  });

  it('is never elite (no pustule shot on a contact-only head)', () => {
    D.dolls(127);
    EL.eliteRoll(heads(), 1, () => 0);
    for (const e of heads()) expect(e.elite).toBeFalsy();
  });
});

describe('MINI DOLL HEADS: the tell and the lunge', () => {
  it('each head tells for >= 20 f; tells start >= 12 f apart; only once on screen and ahead of the ship', () => {
    D.dolls(127);
    const h = heads(), tellAt: number[] = [], lungeAt: number[] = [];
    run(260, (f) => h.forEach((e, i) => {
      if (tellAt[i] == null && e.st === 'tell') { tellAt[i] = f; expect(e.x).toBeLessThan(480 - DOLL.inX + 1); expect(e.x).toBeGreaterThan($.P.x + DOLL.ahead); }
      if (lungeAt[i] == null && e.st === 'lunge') lungeAt[i] = f;
    }));
    expect(tellAt.filter((v) => v != null).length).toBe(5);
    for (let i = 0; i < 5; i++) expect(lungeAt[i] - tellAt[i]).toBeGreaterThanOrEqual(20);
    const s = [...tellAt].sort((a, b) => a - b);
    for (let i = 1; i < 5; i++) expect(s[i] - s[i - 1]).toBeGreaterThanOrEqual(12);
  });

  it('never tells at a ship ahead of it: it drifts off the left edge, eyes shut', () => {
    $.P.x = 470;
    D.dolls(127);
    let told = 0;
    run(420, () => { for (const e of heads()) if (e.st !== 'drift') told++; });
    expect(told).toBe(0);
    expect(heads().every((e) => e.dead)).toBe(true);
  });

  it('the lunge locks the ship\'s y as the tell ends and keeps it while the ship moves', () => {
    D.dolls(127, 1);
    const e = heads()[0];
    $.P.y = 60;
    run(200, () => { if (e.st === 'tell' && e.wt === DOLL.tell - 1) $.P.y = 180; });
    // the lock was the ship's y on the frame the tell ended (180), and moving the ship after it changes nothing
    expect(e.ly).toBe(180);
    const e2 = (W.enemies.length = 0, D.dolls(127, 1), heads()[0]);
    $.P.y = 200;
    let locked = -1, px = 0, py = 0;
    run(400, () => {
      if (e2.dead) return;
      if (locked < 0 && e2.st === 'lunge') { locked = e2.ly; $.P.y = 30; px = e2.x; py = e2.y; return; }
      if (locked >= 0) {
        expect(e2.ly).toBe(locked);
        expect(px - e2.x).toBeCloseTo(DOLL.lvx);
        expect(Math.abs(e2.y - py)).toBeLessThanOrEqual(DOLL.lvy + 1e-9);
        px = e2.x; py = e2.y;
      }
    });
    expect(locked).toBe(200);
    expect(e2.dead).toBe(true); // flew on off the screen
  });

  it('dollAt (the pilot\'s model) matches the arm frame for frame through drift, tell and lunge', () => {
    D.dolls(127, 1);
    const e = heads()[0];
    run(5);
    let pred = Array.from({ length: 20 }, (_, t) => D.dollAt(e, t + 1, $.P.y)), got: number[][] = [];
    run(20, () => got.push([e.x, e.y])); // the drift
    for (let t = 0; t < 20; t++) { expect(got[t][0]).toBeCloseTo(pred[t][0], 6); expect(got[t][1]).toBeCloseTo(pred[t][1], 6); }
    for (let f = 0; f < 200 && e.st !== 'tell'; f++) run(1);
    expect(e.st).toBe('tell'); // from the tell on: the rest of the clack, then the lunge at the ship's y
    const T = 140; pred = Array.from({ length: T }, (_, t) => D.dollAt(e, t + 1, $.P.y)); pred = Array.from({ length: T }, (_, t) => D.dollAt(e, t + 1, $.P.y));
    got = [];
    run(T, () => got.push([e.x, e.y]));
    for (let t = 0; t < T; t++) if (got[t][0] > -DOLL.cull) { expect(got[t][0]).toBeCloseTo(pred[t][0], 6); expect(got[t][1]).toBeCloseTo(pred[t][1], 6); }
  });
});

describe('MINI DOLL HEADS: contact only, dry, the group capsule', () => {
  it('never fires an eshot, alive or dying, on Normal and Very Hard, Descent 1-3', () => {
    for (const [tier, loop] of [[1, 0], [3, 1], [3, 2]]) {
      W.enemies.length = 0; W.eshots.length = 0;
      $.G = { ...G0(), tier, loop };
      D.dolls(127);
      run(80);
      for (const e of heads().slice(0, 2)) U.killEnemy(e);
      run(400);
      for (const p of $.G.pend) p.f(); // any queued revenge
      expect(W.eshots.length).toBe(0);
    }
    L.setLayout('short');
    W.enemies.length = 0; W.eshots.length = 0;
    $.G = { ...G0(), loop: 2 };
    D.dolls(127);
    for (const e of heads()) { e.x = 300; U.killEnemy(e); } // short's Descent 2+ dying fan skips the heads
    expect(W.eshots.length).toBe(0);
  });

  it('dies dry: no gore, no blood drops', () => {
    D.dolls(127);
    U.hurt(heads()[0], 5, 300, 127, 1);
    expect(heads()[0].dead).toBe(true);
    expect(W.gore).toBe(0);
  });

  it('clearing the whole line rolls the group capsule (grpDrops); a line left alive does not', () => {
    const g = D.dolls(127);
    const h = heads();
    for (const e of h.slice(0, 4)) U.killEnemy(e);
    expect(g.killed).toBe(4);
    expect(W.caps.length).toBe(0);
    (g as any).pod = 1; // the breath's release always drops: the roll is grpDrops, the same as a drone formation's
    U.killEnemy(h[4]);
    expect(g.killed).toBe(5);
    expect(W.caps.length).toBe(1);
  });
});

describe('THE WATCHER takes a stage turn (D66 watcherTurn)', () => {
  const firstStage = (kind: string) => { for (let i = 0; i < 40; i++) if (L.kindOf(i) === kind) return i; return -1; };
  it('on a Watcher stage (stage + loop even) the first doll line is THE WATCHER, then dolls again', () => {
    const s = firstStage('orbit'); expect(s).toBeGreaterThanOrEqual(0);
    $.G.stage = s; $.G.loop = s % 2; // stage + loop even
    expect(S.watcherTurn()).toBe(true);
    expect(S.dolls(127)).toBeNull();
    expect(W.enemies.filter((e) => e.k === 'watcher').length).toBe(1);
    expect(S.watcherTurn()).toBe(false); // spent for this stage
    S.dolls(127);
    expect(heads().length).toBe(5);
  });
  it('never on the off stages, in a fight, with a flayer alive, or in the Drive', () => {
    const s = firstStage('orbit');
    $.G.stage = s; $.G.loop = (s + 1) % 2; expect(S.watcherTurn()).toBe(false); // stage + loop odd
    $.G.loop = s % 2; $.G.boss = {}; expect(S.watcherTurn()).toBe(false);
    $.G.boss = null; W.enemies.push({ k: 'flayer', dead: false }); expect(S.watcherTurn()).toBe(false);
    W.enemies.length = 0;
    const d = firstStage('drive');
    if (d >= 0) { $.G.stage = d; $.G.loop = d % 2; expect(S.watcherTurn()).toBe(false); }
  });
});
