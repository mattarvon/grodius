// D58 (Matt, 2026-11-15): the Descent-1 balance pass on long4. Pure tables and the depth/cadence wiring:
//  (#1, late-stage fire, was dropped: option c), #2 stage-boss HP by stage order, #3 rank drones
//  capped, #4 the slot-B midboss HP band, #5 no free refill in late fights (flow-side: d58-refill.test.ts).
//  short must read exactly today's numbers everywhere (layout parity).
import { afterEach, describe, expect, it } from 'vitest';
import { $ } from '../../src/state';
import { ECON, bossOrdMul, formExtra, lateStage } from '../../src/economy';
import { DEPTH, depthHP, late, midLateMul } from '../../src/depth';
import { setLayout } from '../../src/layout';

const at = (stage: number, loop = 0, rank = 0) => {
  $.G = { loop, stage, pow: rank, rank };
  $.meta = { rig: [], cl: {} };
};
afterEach(() => setLayout('short'));

describe('D58 tables (economy.ts)', () => {
  it('names the late stages: biome slot B and later, and the Drive', () => {
    expect(lateStage('orbit', -1)).toBe(false);
    expect(lateStage('biome', 0)).toBe(false);
    expect(lateStage('biome', 1)).toBe(true);
    expect(lateStage('interior', -1)).toBe(false);
    expect(lateStage('drive', -1)).toBe(true);
  });

  it('leaves short and long5 on today\'s values', () => {
    for (const id of ['short', 'long5'] as const) {
      expect(ECON[id].late).toBeNull();
      expect(ECON[id].bossOrd).toBe(0);
      for (const o of [0, 1, 2, 3]) expect(bossOrdMul(id, o)).toBe(1);
      for (const p of [0, .3, .5, 1, 1.7, 2, 5]) expect(formExtra(id, p)).toBe(Math.round(Math.min(2.0, p) * 3));
    }
  });

  it('grows a long4 stage boss x(1 + bossOrd * w_k * ord / 3), w_k defaulting to 1', () => {
    const b = ECON.long4.bossOrd, W = ECON.long4.bossOrdW;
    expect(b).toBeGreaterThan(0);
    expect(bossOrdMul('long4', 0, 'nobody')).toBe(1);
    expect(bossOrdMul('long4', 1, 'nobody')).toBeCloseTo(1 + b / 3, 12);
    expect(bossOrdMul('long4', 2, 'nobody')).toBeCloseTo(1 + b * 2 / 3, 12);
    expect(bossOrdMul('long4', 2)).toBeCloseTo(1 + b * 2 / 3, 12); // a kind with no weight (a registry boss) takes 1
    for (const k of Object.keys(W)) expect(bossOrdMul('long4', 2, k)).toBeCloseTo(1 + b * W[k] * 2 / 3, 12);
  });

  it('caps long4 rank drones at +2: round(2 * min(1, pow))', () => {
    expect(formExtra('long4', 0)).toBe(0);
    expect(formExtra('long4', .2)).toBe(0);
    expect(formExtra('long4', .3)).toBe(1);
    expect(formExtra('long4', .8)).toBe(2);
    expect(formExtra('long4', 3)).toBe(2);
    expect(ECON.long4.form).toMatchObject({ xp: .5, extra: true });
  });
});

describe('D58 late stages on long4 (depth.ts late)', () => {
  it('is null on short at every stage', () => {
    setLayout('short');
    for (const s of [0, 1, 2, 3]) { at(s); expect(late()).toBeNull(); expect(midLateMul()).toBe(1); }
  });

  it('is the late set in biome slot B and the Drive only', () => {
    setLayout('long4');
    const want = [false, false, true, true]; // orbit, biome A, biome B, Drive
    for (const s of [0, 1, 2, 3]) { at(s); expect(!!late(), `stage ${s}`).toBe(want[s]); }
    at(2); expect(midLateMul('nobody')).toBe(ECON.long4.late!.midLate);
    for (const [k, v] of Object.entries(ECON.long4.late!.midLateK)) expect(midLateMul(k)).toBe(v);
    at(3); expect(midLateMul()).toBe(1); // the Drive: no midboss
    at(1); expect(midLateMul()).toBe(1); // slot A keeps D27's band
  });
});

describe('D58 #2 stage-boss HP by stage order (depthHP)', () => {
  const crux = (stage: number, loop = 0) => { at(stage, loop); return depthHP('crux', { mini: 1 }, { stageBoss: true }); };

  it('multiplies biome stage bosses on long4, on top of the loop term', () => {
    setLayout('long4');
    expect(crux(1)).toBeCloseTo(bossOrdMul('long4', 1, 'crux'), 12);
    expect(crux(2)).toBeCloseTo(bossOrdMul('long4', 2, 'crux'), 12);
    expect(crux(2)).toBeGreaterThan(1);
    expect(crux(2, 1)).toBeCloseTo((1 + DEPTH.w.crux * DEPTH.boss) * bossOrdMul('long4', 2, 'crux'), 12);
    at(2); expect(depthHP('butcher', { mini: 1 }, {})).toBeCloseTo(bossOrdMul('long4', 2, 'butcher'), 12);
    at(2); expect(depthHP('maw', { mini: 1 }, { stageBoss: true })).toBeCloseTo(bossOrdMul('long4', 2, 'maw'), 12); // a biome Maw stage boss
  });

  it('passes it to a boss part through par.dm', () => {
    setLayout('long4');
    const dm = crux(2);
    expect(depthHP('nailbar', { hp: 16 }, { par: { dm } })).toBe(dm);
  });

  it('leaves midbosses, the Orbit Maw and fodder alone', () => {
    setLayout('long4');
    at(2);
    expect(depthHP('choir', { mini: 1, mid: 1 }, {})).toBe(1);
    expect(depthHP('maw', { mini: 1 }, {})).toBe(1); // a mid-stage Maw
    at(0);
    expect(depthHP('maw', { mini: 1 }, { stageBoss: true })).toBe(1); // the Open Orbit Maw counts as a midboss
  });

  it('is today\'s value on short', () => {
    setLayout('short');
    expect(crux(2)).toBe(1);
    expect(crux(2, 1)).toBeCloseTo(1 + DEPTH.w.crux * DEPTH.boss, 12);
  });
});

describe('D62 Drive-only fire bump (cadence.ts coolFor)', () => {
  it('shortens regular-enemy cooldowns in the Drive stage on long4 only', async () => {
    const { coolFor } = await import('../../src/enemies/cadence');
    const m = ECON.long4.late!.driveCool;
    expect(m).toBeLessThan(1);
    setLayout('long4');
    at(2); const slotB = coolFor('eye', 20);
    at(3); const drive = coolFor('eye', 20);
    const cdm3 = 1 / (1 + DEPTH.fire * .35), cdm2 = 1 / (1 + DEPTH.fire * .35 * 2 / 3);
    expect(slotB).toBe(Math.round(140 * cdm2));
    expect(drive).toBe(Math.round(140 * cdm3 * m));
    setLayout('short');
    at(3); expect(coolFor('eye', 20)).toBe(140);
  });
});

describe('D62 Drive-only first shot (cadence.ts firstShot)', () => {
  it('uses LateSet.driveFirst in the Drive stage on long4 and each spawner\'s own range elsewhere', async () => {
    const { firstShot } = await import('../../src/enemies/cadence');
    setLayout('long4');
    at(3); expect(firstShot(110, 150)).toEqual(ECON.long4.late!.driveFirst);
    at(2); expect(firstShot(110, 150)).toEqual([110, 150]);
    setLayout('short');
    at(3); expect(firstShot(40, 90)).toEqual([40, 90]);
  });
});
