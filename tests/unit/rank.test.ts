// DIFFICULTY-SPEC §2.1 rank (src/rank.ts): the Gradius III formula, its caps, the death reset and the readers' pure
// helpers (cadence, bullet speed, lead, caps, revenge). rank.ts imports layout.ts and tier.ts only (both pure), so no mocks.
import { afterEach, describe, expect, it } from 'vitest';
import { CAD_FLOOR, RANK_CAP, RANK_CAP_D1, VARIANT_RANK, VCAP, bsMul, bulletCap, cadI, cadMul, capCtx, capRoom, countShots, counted, hazMul, leadL, litter, rank, rankP, revChance, rho, shotV, variantOn } from '../../src/rank';
import { setLayout } from '../../src/layout';

const NAKED = { speed: 0, missile: 0, pyre: 0, double: 0, laser: 0, options: 0, wardLv: 0 };
/** spec §2.2 END D1 kit (K1 with MISSILE 2, SPLIT, WRAITH 2, WARD 2) plus one CALIBER level: P_term 11 */
const END_D1 = { speed: 3, missile: 2, pyre: 0, double: 1, laser: 0, options: 2, wardLv: 2 };
const S = (G: any, P: any = NAKED) => ({ G, P });

afterEach(() => setLayout('short'));

describe('rank: the Gradius III formula (spec §2.1)', () => {
  it('matches the spec worked examples on Normal', () => {
    expect(rank(S({ tier: 1, loop: 0, stage: 0 }))).toBe(2); // Orbit, naked: 2 + 0 + 0
    expect(rank(S({ tier: 1, loop: 0, stage: 3, gm: { cal: 1 } }, END_D1))).toBe(16); // Drive, END D1 kit: 2 + 3 + 11, capped
    expect(rankP(END_D1, { gm: { cal: 1 } })).toBe(11);
    expect(rank(S({ tier: 1, loop: 0, stage: 3, gm: {} }, { ...NAKED, speed: 1 }))).toBe(5); // respawned naked in the Drive (THRUST 1 kept, CALIBER lost): 2 + 3
  });

  it('adds T_base by tier: Easy 0, Normal 2, Hard 4, Very Hard 6; a G without a tier reads Normal', () => {
    expect([0, 1, 2, 3].map((tier) => rank(S({ tier, loop: 0, stage: 1 })))).toEqual([1, 3, 5, 7]);
    expect(rank(S({ loop: 0, stage: 1 }))).toBe(3);
    expect(rank(S({ tier: 9, loop: 0, stage: 1 }))).toBe(3); // junk tier: Normal
  });

  it('weighs held power by the spec table: THRUST 0, MISSILE 1 a level, PYRE I 2 (= MISSILE II, decision 24) then 1 a level, SPLIT 2, ARC 3, WRAITH 1 an option, WARD 4 flat, grafts 1 each up to 3', () => {
    const p = (o: any, gm: any = {}) => rankP({ ...NAKED, ...o }, { gm });
    expect(p({ speed: 5 })).toBe(0);
    expect(p({ missile: 2 })).toBe(2);
    expect(p({ pyre: 1 })).toBe(p({ missile: 2 })); // decision 24: K1's two forms weigh the same
    expect(p({ pyre: 1 })).toBe(2);
    expect(p({ pyre: 2 })).toBe(3);
    expect(p({ double: 1 })).toBe(2);
    expect(p({ laser: 1 })).toBe(3);
    expect(p({ double: 1, laser: 1 })).toBe(5); // two slots, both paid
    expect(p({ options: 3 })).toBe(3);
    expect([1, 2, 3].map((wardLv) => p({ wardLv }))).toEqual([4, 4, 4]);
    expect(p({}, { cal: 1 })).toBe(1);
    expect(p({}, { cal: 2, serr: 2 })).toBe(3); // capped at 3
    expect(p({}, { rapid: 3, seek: 2 })).toBe(0); // other grafts never count
    expect(rankP(null, { gm: { cal: 3 } })).toBe(0); // no ship holds nothing
  });

  it('ignores perks, rigs, LV, XP and G.pow: they survive a death, so counting them would stop a death dropping rank', () => {
    const base = rank(S({ tier: 1, loop: 0, stage: 2 }));
    expect(rank(S({ tier: 1, loop: 0, stage: 2, pk: { dmg: 3, rof: 3, glass: 1 }, lvl: 11, xp: 40, xpTot: 9000, pow: 2, rank: 1 }))).toBe(base);
  });

  it('adds 6 a descent and caps at 16 in Descent 1, 31 after; never below 0', () => {
    expect(rank(S({ tier: 0, loop: 1, stage: 0 }))).toBe(6);
    expect(rank(S({ tier: 1, loop: 2, stage: 1 }))).toBe(15);
    const big = { speed: 5, missile: 2, pyre: 2, double: 1, laser: 1, options: 3, wardLv: 3 };
    expect(rank(S({ tier: 3, loop: 0, stage: 3, gm: { cal: 3, serr: 3 } }, big))).toBe(RANK_CAP_D1);
    expect(rank(S({ tier: 3, loop: 1, stage: 3, gm: { cal: 3, serr: 3 } }, big))).toBe(RANK_CAP);
    expect(rank(S({ tier: 3, loop: 9, stage: 3 }))).toBe(31);
    expect(rank(S({ tier: 0, loop: 0, stage: 0 }))).toBe(0);
    expect(rank(S({ tier: 0, loop: 0, stage: -5 }))).toBe(0);
    expect(rank({})).toBe(0);
    expect(rank(null)).toBe(0);
  });

  it('drops on a death: the strip takes the held power, so rank 1 f after is <= T_base + stageIdx + 3 (gate D1)', () => {
    for (const tier of [0, 1, 2, 3]) {
      const G = { tier, loop: 0, stage: 2, gm: { cal: 1 } };
      const before = rank(S(G, END_D1));
      // Normal's strip keeps THRUST min(1, speed) and the graft levels drop by one (W2): the worst case keeps both
      const after = rank(S({ ...G, gm: {} }, { ...NAKED, speed: 1 }));
      expect(after).toBeLessThan(before);
      expect(after).toBeLessThanOrEqual([0, 2, 4, 6][tier] + 2 + 3);
      expect(rank(S(G, null))).toBe([0, 2, 4, 6][tier] + 2); // between the death and the respawn: no ship
    }
    // spec worked example: the END D1 kit dies in biome B, rank 16 -> 4 (16 with K1's ARC form: 2 + 2 + 12; SPLIT gives 15)
    expect(rank(S({ tier: 1, loop: 0, stage: 2, gm: { cal: 1 } }, { ...END_D1, double: 0, laser: 1 }))).toBe(16);
    expect(rank(S({ tier: 1, loop: 0, stage: 2, gm: { cal: 1 } }, END_D1))).toBe(15);
    expect(rank(S({ tier: 1, loop: 0, stage: 2 }, { ...NAKED, speed: 1 }))).toBe(4);
  });

  it('is pure: same answer twice, the state untouched', () => {
    const st = S({ tier: 2, loop: 1, stage: 1, gm: { serr: 2 } }, END_D1), copy = JSON.stringify(st);
    expect(rank(st)).toBe(rank(st));
    expect(JSON.stringify(st)).toBe(copy);
  });
});

describe('what rank changes (spec §2.1 table)', () => {
  const at = (r: number) => S({ tier: 0, loop: 0, stage: 0 }, { ...NAKED, options: Math.min(3, r), missile: Math.min(2, Math.max(0, r - 3)), pyre: Math.min(2, Math.max(0, r - 5)) });
  it('rho is min(rank, 16) / 16', () => {
    expect(rho(at(0))).toBe(0);
    expect(rho(at(4))).toBe(.25);
    expect(rho(S({ tier: 3, loop: 2, stage: 3 }))).toBe(1); // rank 21: rho caps at 1
  });
  it('cadence x(1.25 - .6 rho): x1.175 at rank 2, x.65 at 16; the interval floors at 18 f', () => {
    expect(cadMul(S({ tier: 1, loop: 0, stage: 0 }))).toBeCloseTo(1.175, 12);
    expect(cadMul(S({ tier: 3, loop: 2, stage: 0 }))).toBeCloseTo(.65, 12);
    expect(cadI(S({ tier: 3, loop: 2, stage: 0 }), 100)).toBe(65);
    expect(cadI(S({ tier: 3, loop: 2, stage: 0 }), 20)).toBe(CAD_FLOOR);
    expect(cadI(S({ tier: 0, loop: 0, stage: 0 }), 80)).toBe(100); // a naked Easy ship: x1.25, calmer than today
  });
  it('bullet speed x(1 + .02 rank) x min(1.3, 1 + .12 loop), under V_CAP by tier', () => {
    expect(bsMul(S({ tier: 1, loop: 0, stage: 0 }))).toBeCloseTo(1.04, 12);
    expect(bsMul(S({ tier: 3, loop: 0, stage: 3, gm: { cal: 3 } }, END_D1))).toBeCloseTo(1.32, 12);
    expect(bsMul(S({ tier: 3, loop: 5, stage: 0 }))).toBeCloseTo((1 + .02 * 31) * 1.3, 12);
    expect([0, 1, 2, 3].map((t) => VCAP(t as 0 | 1 | 2 | 3))).toEqual([2.6, 2.6, 2.9, 2.9]);
    expect(shotV(S({ tier: 1, loop: 0, stage: 0 }), 1.5)).toBeCloseTo(1.56, 12);
    expect(shotV(S({ tier: 1, loop: 2, stage: 3 }), 4)).toBe(2.6);
    expect(shotV(S({ tier: 2, loop: 2, stage: 3 }), 4)).toBe(2.9);
  });
  it('lead .2 + .6 rho (.275 at rank 2, .8 at 16), hazards x(1.15 - .3 rho), litters 3 + round(2 rho)', () => {
    expect(leadL(S({ tier: 1, loop: 0, stage: 0 }))).toBeCloseTo(.275, 12);
    expect(leadL(S({ tier: 3, loop: 2, stage: 0 }))).toBeCloseTo(.8, 12);
    expect(hazMul(S({ tier: 1, loop: 0, stage: 0 }))).toBeCloseTo(1.1125, 12);
    expect(hazMul(S({ tier: 3, loop: 2, stage: 0 }))).toBeCloseTo(.85, 12);
    expect([litter(at(0)), litter(at(4)), litter(S({ tier: 3, loop: 2, stage: 0 }))]).toEqual([3, 4, 5]);
  });
  it('unlocks fight variants at rank 14 (C3)', () => {
    expect(VARIANT_RANK).toBe(14);
    expect(variantOn(S({ tier: 1, loop: 0, stage: 2 }, { ...NAKED, wardLv: 1, options: 3, double: 1 }))).toBe(false); // 2 + 2 + 9 = 13
    expect(variantOn(S({ tier: 1, loop: 0, stage: 2 }, { ...NAKED, wardLv: 1, options: 3, double: 1, missile: 1 }))).toBe(true); // 14
    expect(variantOn(S({ tier: 2, loop: 0, stage: 1 }, { ...NAKED, wardLv: 1, options: 1, double: 1, missile: 1, speed: 2 }))).toBe(false); // Hard, 4 + 1 + 8 = 13
  });
});

describe('the revenge table (spec §2.1, GR rule 9)', () => {
  it('is 0 on Normal Descent 1 and Easy everywhere, and climbs by tier and descent', () => {
    expect([0, 1, 2].map((L) => revChance(0, L))).toEqual([0, 0, 0]);
    expect([0, 1, 2].map((L) => revChance(1, L))).toEqual([0, .33, .5]);
    expect([0, 1, 2].map((L) => revChance(2, L))).toEqual([.33, .5, 1]);
    expect([0, 1, 2].map((L) => revChance(3, L))).toEqual([.5, 1, 1]);
    expect(revChance(1, 7)).toBe(.5); // later descents read the D3 column
    expect(revChance(2, -1)).toBe(.33);
  });
});

describe('bullet caps (spec §2.1, C4 / C5)', () => {
  const ctx = (G: any) => capCtx({ G, P: NAKED });
  it('reads the context: boss (Drive, stage boss), setp (midboss, Orbit Maw, signature), else scroll', () => {
    setLayout('long4');
    expect(ctx({ stage: 1 })).toBe('scroll');
    expect(ctx({ stage: 1, setp: 1 })).toBe('setp');
    expect(ctx({ stage: 1, mini: { k: 'choir', mid: 1 } })).toBe('setp');
    expect(ctx({ stage: 1, mini: { k: 'crux' } })).toBe('boss');
    expect(ctx({ stage: 1, mini: { k: 'crux', dead: true } })).toBe('scroll');
    expect(ctx({ stage: 3, boss: { hp: 1 } })).toBe('boss');
    expect(ctx({ stage: 0, mini: { k: 'maw', stageBoss: true } })).toBe('setp'); // the Open Orbit Maw is a midboss
    expect(ctx({ stage: 1, mini: { k: 'maw', stageBoss: true } })).toBe('boss'); // a biome's Maw stage boss
    expect(ctx({ stage: 1, mini: { k: 'maw' } })).toBe('setp'); // a mid-stage Maw
    expect(capCtx({})).toBe('scroll');
  });
  it('caps by tier: Easy 6/12/18, Normal 8/16/24, Hard and Very Hard 10/20/30; regular shooters pass scroll', () => {
    const cap = (tier: number, G: any = {}) => ['scroll', 'setp', 'boss'].map((c) => bulletCap({ G: { tier, ...G } }, c as any));
    expect([0, 1, 2, 3].map((t) => cap(t))).toEqual([[6, 12, 18], [8, 16, 24], [10, 20, 30], [10, 20, 30]]);
    expect(bulletCap({ G: { tier: 1, boss: {} } })).toBe(24); // default: the run's context
    expect(bulletCap({ G: { tier: 1, boss: {} } }, 'scroll')).toBe(8); // a regular shooter during the Drive
    expect(bulletCap({ G: {} })).toBe(8); // no tier: Normal
  });
  it('counts every shot but hazards, and gives the free room a volley must fit in whole', () => {
    const shots = [{}, { haz: 1 }, { rev: 1 }, { rev: 0 }, { haz: 1 }];
    expect(countShots(shots)).toBe(3);
    expect(shots.filter(counted).length).toBe(3);
    expect(capRoom({ G: { tier: 1 } }, shots)).toBe(5);
    const full = Array.from({ length: 13 }, () => ({}));
    expect(capRoom({ G: { tier: 1, mini: { k: 'choir', mid: 1 } } }, full)).toBe(3); // a 9-ring does not fit: W1 spawns 0
    expect(capRoom({ G: { tier: 1 } }, full)).toBe(0); // never negative
  });
});
