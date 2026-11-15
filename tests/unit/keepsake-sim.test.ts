// THE KEEPSAKE stage boss (D55) driven through the real enemies/update.ts hurt() / killEnemy() and its own update, the
// shared modules stubbed (the midhooks.test.ts pattern): the face and crown shares through midMul, the transition's
// closed crown, the no-carry cut, the crier breaking, the enrage capping the grade, and dying -> kill -> clearStage.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const noop = () => {};
const W = vi.hoisted(() => ({ enemies: [] as any[], eshots: [] as any[], caps: [] as any[], orbs: [] as any[], geysers: [] as any[] }));
const S = vi.hoisted(() => ({ banners: [] as string[], cleared: 0 }));
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
vi.mock('../../src/player', () => ({ WARD_MAX: 3, playerHit: noop, slotMaxed: () => false }));
vi.mock('../../src/contraptions', () => ({ onKillContraptions: noop }));
vi.mock('../../src/enemies/elite', () => ({ eliteKill: noop, eliteTick: noop }));
vi.mock('../../src/enemies/spawn', async () => {
  const { MID_ET } = await import('../../src/enemies/mid/roster');
  return {
    BS: () => 1, aimA: () => Math.PI, wrapA: (a: number) => a, eshoot: noop, fan: noop, ring: noop, every: () => false, onScreen: () => true,
    banner: (t: string) => { S.banners.push(t); },
    // mk: the real row (MID_ET is spawn.ts ET's own object) or a part's nailbar 16 HP, x hpm; no depth (Descent 1)
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
const { KB } = await import('../../src/enemies/boss/_keepsake');
const L = await import('../../src/layout');

let e: any;
beforeEach(() => {
  L.setLayout('long4');
  W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.orbs.length = 0;
  S.banners.length = 0; S.cleared = 0;
  $.G = { loop: 0, stage: 2, rank: 0, score: 0, bio: 0, combo: 0, comboT: 0, kills: 0, maxCombo: 0, scroll: 0, shake: 0, hitstop: 0, white: 0, st: { kills: 0, chain: 0 }, pend: [] };
  $.P = { x: 90, y: 100, alive: true };
  $.meta = { bio: 0, lv: {} };
  BOSS_SIM.keepsake.spawn('fire');
  e = $.G.mini;
  e.x = e.tx; e.t = KB.enter; // settled, past the roll-in
});
/** n frames of its own update (the kill path included) */
const step = (n = 1) => { for (let i = 0; i < n && !e.dead; i++) updEnemy(e); };

describe('THE KEEPSAKE through hurt() and midMul', () => {
  it('spawns with no mid flag (killEnemy would read it as a midboss) and its own armour on the entity', () => {
    expect(e.mid).toBe(undefined);
    expect(e.mini).toBe(1);
    expect(typeof e.armor).toBe('function');
    expect(e.max).toBe(320);
  });

  it('takes x.15 on the face and full damage on the crown, at tilt 0', () => {
    const h = e.hp;
    hurt(e, 10, e.x - 40, e.y, 1);
    expect(h - e.hp).toBeCloseTo(1.5, 9);
    const h2 = e.hp;
    hurt(e, 10, e.x, e.y - 40, 1);
    expect(h2 - e.hp).toBeCloseTo(10, 9);
  });

  it('stops a hit at the phase cut, then closes the crown (x.15) through IT WOKE UP', () => {
    e.hp = e.max * .66;
    hurt(e, 999, e.x, e.y - 40, 1); // a nuke-sized crown hit
    expect(e.hp).toBeCloseTo(e.max * KB.cut1, 6);
    step();
    expect(e.ph).toBe(1);
    expect(e.tr).toBeGreaterThan(0);
    expect(S.banners).toContain('IT WOKE UP');
    const h = e.hp;
    hurt(e, 10, e.x, e.y - 40, 1);
    expect(h - e.hp).toBeCloseTo(1.5, 9); // a crown hit during the transition: the crown is closed
  });

  it('breaks the crier in CRACKED (IT STOPPED CRYING) and stops the cries', () => {
    e.ph = 2; e.tr = 0; e.hp = e.max * .2;
    step(2);
    expect(e.crier).toBeTruthy();
    expect(e.parts).toContain(e.crier);
    hurt(e.crier, 999, e.crier.x, e.crier.y, -1);
    expect(e.crier.dead).toBe(true);
    step();
    expect(S.banners).toContain('IT STOPPED CRYING');
    e.att = 3; // the double cry's turn
    e.st = 'idle'; e.wt = 0; e.cool = 0;
    step();
    expect(e.st).toBe('aim'); // a throw in its place once the crier is gone
  });

  it('enrages once when CRACKED\'s clock runs out: never escapes, caps the stage grade at B', () => {
    e.ph = 2; e.tr = 0; e.hp = e.max * .2; e.pt = KB.clock - 1;
    step();
    expect(e.rage).toBe(1);
    expect($.G.st.gcap).toBe('B');
    expect(S.banners).toContain("IT WON'T LET GO");
    step(KB.clock * 2);
    expect(e.dead).toBe(false); // still there: it won't let go
    expect(e.x).toBeLessThan(480);
  });

  it('dies through PUT TO BED: the dying beat, then the kill, the stage clear and the readout', () => {
    e.ph = 2; e.tr = 0; e.hp = e.max * .2;
    hurt(e, 999, e.x, e.y - 40, 1);
    expect(e.hp).toBeCloseTo(e.max * KB.end, 6); // the last hit leaves the dying beat's sliver
    expect(e.dead).toBe(false);
    step();
    expect(e.st).toBe('dying');
    step(KB.dieF + 2);
    expect(e.dead).toBe(true);
    expect(S.cleared).toBe(1);
    expect(S.banners).toContain('PUT TO BED');
  });
});
