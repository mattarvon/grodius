// W2 (DIFFICULTY-SPEC §2.1 "Survival" / "Death penalty" / "Tiers", §2.2 "Lives and meta", Matt's decisions §7):
// the pure death rules in src/death.ts, and gate D2 end to end (a death, then kills: no graft pod until the graft's
// full kill step is re-earned) through the real mutations.ts countKill.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const H = vi.hoisted(() => ({ caps: [] as any[] }));
vi.mock('../../src/core', () => ({ PH: 270, R: () => { throw new Error('a death rule drew the sim RNG'); }, TAU: Math.PI * 2, W: 480, clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), dist2: () => 1e9, rr: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/world', () => ({ arcs: [], caps: H.caps, enemies: [], shots: [] }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, gore: () => {}, pop: () => {}, spark: () => {} }));
vi.mock('../../src/enemies/update', () => ({ hurt: () => {} }));
vi.mock('../../src/perks', () => ({ pk: () => 0 }));

const D = await import('../../src/death');
const M = await import('../../src/mutations');
const { POWER } = await import('../../src/power');
const { setLayout } = await import('../../src/layout');
const { HULL2_REFUND } = await import('../../src/save');

const tierG = (tier: number, over: any = {}) => ({ tier, loop: 0, stage: 1, ...over });

beforeEach(() => {
  H.caps.length = 0;
  setLayout('long4');
});

describe('the long4 gate', () => {
  it('is on for long4 only: short keeps every rule off (spec §5.3)', () => {
    expect(D.hardOn()).toBe(true);
    setLayout('short');
    expect(D.hardOn()).toBe(false);
  });
  it('reads the run tier, Normal when the G carries none (W0 adapter)', () => {
    expect(D.runTier({})).toBe(D.NORMAL);
    expect(D.runTier(null)).toBe(D.NORMAL);
    expect(D.runTier({ tier: 3 })).toBe(3);
    expect(D.runTier({ tier: 7 })).toBe(D.NORMAL);
  });
});

describe('the tier death table (spec §2.1 Tiers)', () => {
  it('matches the spec row by row', () => {
    const t = D.DEATH_TIER;
    expect(t.map((x) => x.strip)).toEqual(['gradual', 'full', 'full', 'full']);
    expect(t.map((x) => x.checkpoint)).toEqual([false, true, true, true]); // Decision 1A
    expect(t.map((x) => x.lifeline)).toEqual([true, false, false, false]); // C15
    expect(t.map((x) => x.gasp)).toEqual(['stage', 'descent', 'descent', 'off']);
    expect(t.map((x) => x.blackBox)).toEqual([true, true, true, false]); // C16
    expect(t.slice(1).map((x) => x.thrustKeep)).toEqual([1, 0, 0]); // C18
  });
});

describe('the strip (C18, Easy gradual)', () => {
  const kit = { speed: 3, missile: 2, double: 0, laser: 1, pyre: 0, options: 2 };
  it('Normal keeps THRUST min(1, speed) and nothing else', () => {
    expect(D.keptLoadout(kit, D.DEATH_TIER[1])).toEqual({ speed: 1, missile: 0, double: 0, laser: 0, pyre: 0, options: 0 });
    expect(D.keptLoadout({ ...kit, speed: 0 }, D.DEATH_TIER[1]).speed).toBe(0);
  });
  it('Hard and Very Hard keep nothing', () => {
    for (const t of [2, 3]) expect(D.keptLoadout(kit, D.DEATH_TIER[t])).toEqual({ speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0 });
  });
  it('Easy loses only the top power-up: WRAITH, then the main-gun form, then MISSILE/PYRE, then THRUST', () => {
    const e = D.DEATH_TIER[0];
    let k: any = kit;
    k = D.keptLoadout(k, e);
    expect(k).toEqual({ ...kit, options: 0 });
    k = D.keptLoadout(k, e);
    expect(k).toEqual({ ...kit, options: 0, laser: 0 });
    k = D.keptLoadout(k, e);
    expect(k).toEqual({ ...kit, options: 0, laser: 0, missile: 0 });
    k = D.keptLoadout(k, e);
    expect(k).toEqual({ speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0 });
  });
});

describe('WARD hits = WARD level, perk caps by seal', () => {
  it('caps WARD at its level on long4, WARD_MAX elsewhere', () => {
    expect([0, 1, 2, 3].map((l) => D.wardCapOf({ wardLv: l }, true, 3))).toEqual([0, 1, 2, 3]);
    expect(D.wardCapOf({ wardLv: 1 }, false, 3)).toBe(3);
  });
  it('perk max is min(max, 1 + seal) on long4 (gate E7: no level 2 before the stage-2 clear, no level 3 in D1)', () => {
    expect(D.perkCapOf(3, 0, true)).toBe(1);
    expect(D.perkCapOf(3, 1, true)).toBe(2);
    expect(D.perkCapOf(3, 2, true)).toBe(3);
    expect(D.perkCapOf(1, 0, true)).toBe(1);
    expect(D.perkCapOf(3, 0, false)).toBe(3);
  });
  it('halves REGROWTH and SCAB, and stretches the i-frames (SYS lever 1 and 5, C20)', () => {
    expect(D.SURV.regrowPer).toEqual([0, 2400, 1440]);
    expect(D.SURV.scab).toBe(.03);
    expect([D.SURV.wardInv, D.SURV.respawnInv, D.SURV.cpInv]).toEqual([40, 120, 120]);
    expect(D.SURV.wardPodW).toBe(.45);
  });
});

describe('LAST GASP (once per descent on Normal)', () => {
  it('keys Normal and Hard on the descent, Easy on the stage, and Very Hard has none', () => {
    expect(D.gaspSlot(tierG(1, { loop: 2, stage: 3 }))).toEqual({ f: 'gaspD', k: 2 });
    expect(D.gaspSlot(tierG(2, { loop: 0, stage: 1 }))).toEqual({ f: 'gaspD', k: 0 });
    expect(D.gaspSlot(tierG(0, { loop: 1, stage: 2 }))).toEqual({ f: 'gasp', k: 12 });
    expect(D.gaspSlot(tierG(3))).toBeNull();
  });
});

describe('the perk scar (Decision 2A)', () => {
  it('eats the highest-weighted damage perk, ties to the most recent pick', () => {
    expect(D.perkScarPick({ dmg: 2, rof: 1, crit: 1 }, ['dmg', 'rof'], POWER.perk)).toBe('rof'); // .6 tie: rof is later
    expect(D.perkScarPick({ dmg: 2, rof: 1 }, ['rof', 'dmg'], POWER.perk)).toBe('dmg');
    expect(D.perkScarPick({ glass: 1, dmg: 3 }, ['dmg', 'glass'], POWER.perk)).toBe('glass'); // 1.2 first
    expect(D.perkScarPick({ dmg: 1, rof: 1 }, [], POWER.perk)).toBe('dmg'); // no order: table order
  });
  it('never eats a perk weighted .3 or less (survival, economy, XP)', () => {
    expect(D.perkScarPick({ scab: 2, gasp: 1, life: 1, magnet: 2, tape: 1, inv: 1 }, ['scab'], POWER.perk)).toBeNull();
    expect(D.perkScarPick({}, [], POWER.perk)).toBeNull();
  });
});

describe('contraptions in Descent 1 (Decision 4A)', () => {
  const bolted = [{ id: 'gut', lvl: 3 }, { id: 'saw', lvl: 2 }];
  it('runs nothing before the stage-2 clear, then the first rig at level 1', () => {
    expect(D.rigLiveOf(bolted, { loop: 0, cleared: 0 }, true)).toEqual([]);
    expect(D.rigLiveOf(bolted, { loop: 0, cleared: 1 }, true)).toEqual([]);
    expect(D.rigLiveOf(bolted, { loop: 0, cleared: 2 }, true)).toEqual([{ id: 'gut', lvl: 1 }]);
  });
  it('a death knocks it offline until the next clear', () => {
    const G: any = { loop: 0, cleared: 3, rigOff: 1, rigOffC: 3 };
    expect(D.rigLiveOf(bolted, G, true)).toEqual([]);
    G.cleared = 4;
    expect(D.rigLiveOf(bolted, G, true)).toEqual([{ id: 'gut', lvl: 1 }]);
  });
  it('from Descent 2 (and off long4) every bolted rig runs at its bought level', () => {
    expect(D.rigLiveOf(bolted, { loop: 1, cleared: 4, rigOff: 1, rigOffC: 4 }, true)).toBe(bolted);
    expect(D.rigLiveOf(bolted, { loop: 0, cleared: 0 }, false)).toBe(bolted);
  });
});

describe('recovery waves (C16, C17)', () => {
  it('R1 is THRUST, the main-gun form that died, MISSILE or PYRE; BLACK BOX makes the gun FULL', () => {
    expect(D.r1Pods({ laser: 1, pyre: 1 }, true)).toEqual({ ty: [0, 3, 4], full: [1] });
    expect(D.r1Pods({ double: 1, missile: 1 }, false)).toEqual({ ty: [0, 2, 1], full: [] });
    expect(D.r1Pods({}, true)).toEqual({ ty: [0, 2, 1], full: [1] }); // a naked death still gets a gun
  });
  it('R2 is two WRAITH, or two WARD once WRAITH is capped; R1 lands 3 s in, R2 12 s after', () => {
    expect(D.r2Pods(false)).toEqual([5, 5]);
    expect(D.r2Pods(true)).toEqual([6, 6]);
    expect([D.RECOVERY.r1, D.RECOVERY.r2]).toEqual([180, 720]);
    expect(D.newRecovery({}, true)).toMatchObject({ t: 180, w: 1 });
  });
});

describe('ships and HULL (Decision 3A)', () => {
  it('3 ships in Descent 1, HULL at the Descent 2 gate, a 500 refund in save v4', () => {
    expect(D.SHIPS.d1Spare).toBe(2);
    expect(D.SHIPS.hullAt).toBe(1);
    expect(HULL2_REFUND).toBe(D.SHIPS.hull2Refund);
  });
});

describe('gate D2: a death rewinds every graft, and the level is earned again from scratch', () => {
  const G0 = () => ({ gm: { rapid: 1, cal: 2, over: 1 }, kk: { drone: 40, maw: 4 }, gmk: 470, gpend: {}, seal: 2 });
  const kill = (k: string) => M.countKill({ k, x: 100, y: 100 } as any);
  const pods = () => H.caps.filter((c) => c.graft).map((c) => c.graft);

  it('drops each held graft a level and rewinds its counter to that level\'s threshold', () => {
    $.G = G0() as any;
    const rapid = M.GM.find((m) => m.id === 'rapid')!.n, cal = M.GM.find((m) => m.id === 'cal')!.n;
    expect(M.graftDeath($.G)).toBe(true);
    expect($.G.gm).toEqual({ rapid: 0, cal: 1, over: 0 });
    expect($.G.kk.drone).toBe(0); // level 0: from nothing
    expect($.G.gmk).toBe(cal[0]); // CALIBER at 1: the count that earned level 1
    expect($.G.kk.maw).toBe(0); // GLUTTONY
    expect(rapid[0]).toBeGreaterThan(1);
  });

  it('spawns no graft pod until the full kill step is re-earned (C28: the counter, not a window)', () => {
    $.G = G0() as any;
    M.graftDeath($.G);
    const need = M.GM.find((m) => m.id === 'rapid')!.n[0];
    for (let i = 0; i < need - 1; i++) kill('drone');
    expect(pods()).not.toContain('rapid');
    kill('drone');
    expect(pods()).toContain('rapid');
  });

  it('CALIBER re-earns its whole step too', () => {
    $.G = G0() as any;
    M.graftDeath($.G);
    const n = M.GM.find((m) => m.id === 'cal')!.n, step = n[1] - n[0];
    for (let i = 0; i < step - 1; i++) kill('slime');
    expect(pods()).not.toContain('cal');
    kill('slime');
    expect(pods()).toContain('cal');
  });

  it('a checkpoint restart also drops a graft pod left on screen, so it is earned again', () => {
    $.G = { gm: {}, kk: { eye: 30 }, gmk: 0, gpend: { seek: 1 } } as any;
    M.graftDeath($.G, true);
    expect($.G.gpend.seek).toBe(0);
    expect($.G.kk.eye).toBe(0);
    $.G = { gm: {}, kk: { eye: 30 }, gmk: 0, gpend: { seek: 1 } } as any;
    M.graftDeath($.G, false); // in place: the pod is still there to take
    expect($.G.gpend.seek).toBe(1);
    expect($.G.kk.eye).toBe(30);
  });

  it('draws no sim RNG (the core mock throws)', () => {
    $.G = G0() as any;
    expect(() => M.graftDeath($.G, true)).not.toThrow();
  });
});
