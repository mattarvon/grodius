// G3 aim lead and bullet speed (DIFFICULTY-SPEC §2.1 "Speed, aim and who may shoot", C7/C8): L = .2 + .6 rho, the
// aim point t = min(60, dist / v) frames ahead with its y clamped to 6-248, and v = min(V_CAP, v_kind (1 + .02 rank)
// min(1.3, 1 + .12 loop)). Pure: src/notice.ts
import { describe, expect, it } from 'vitest';
import { BUL, aimLeadA, bulletV, leadOf } from '../../src/notice';

describe('aim lead (C8)', () => {
  it('L is .2 for a naked ship at rank 0 and .8 at the Descent 1 cap, .28 at rank 2', () => {
    expect(leadOf(0)).toBeCloseTo(.2);
    expect(leadOf(1)).toBeCloseTo(.8);
    expect(leadOf(2 / 16)).toBeCloseTo(.275);
    expect(leadOf(5)).toBeCloseTo(.8); // rho is clamped
  });

  it('a still ship gets exact aim', () => {
    const a = aimLeadA(300, 100, 60, 140, 0, 0, 1.5, .8);
    expect(a).toBeCloseTo(Math.atan2(40, -240));
  });

  it('L 0 is exact aim whatever the ship does', () => {
    expect(aimLeadA(300, 100, 60, 140, 2, -2, 1.5, 0)).toBeCloseTo(Math.atan2(40, -240));
  });

  it('leads a moving ship by L * v_ship * t, t = dist / v', () => {
    const x = 300, y = 127, px = 100, py = 127, v = 2, L = .5, d = 200, t = Math.min(60, d / v);
    const a = aimLeadA(x, y, px, py, 0, 1, v, L);
    expect(a).toBeCloseTo(Math.atan2(L * 1 * t, px - x));
  });

  it('caps the lead time at 60 f', () => {
    const a = aimLeadA(470, 127, 10, 127, 0, 1, .1, 1); // dist 460 / .1 = 4600 f, clamped to 60
    expect(a).toBeCloseTo(Math.atan2(60, -460));
  });

  it('keeps the aim point inside the playfield (y 6-248) for a touch drag of 9 px/f', () => {
    const down = aimLeadA(300, 127, 100, 240, 0, 9, 1.4, .8), up = aimLeadA(300, 127, 100, 10, 0, -9, 1.4, .8);
    expect(down).toBeCloseTo(Math.atan2(BUL.aimY1 - 127, -200));
    expect(up).toBeCloseTo(Math.atan2(BUL.aimY0 - 127, -200));
  });
});

describe('bullet speed (C7)', () => {
  it('bases are slower than the ship at THRUST 1 (1.67 px/f): drone 1.4, eye 1.5, sentry 1.7', () => {
    expect(BUL.v).toEqual({ drone: 1.4, eye: 1.5, sentry: 1.7 });
  });

  it('rank 2 is x1.04, rank 16 x1.32, under V_CAP', () => {
    expect(bulletV(1.4, 2, 0, 1)).toBeCloseTo(1.4 * 1.04);
    expect(bulletV(1.4, 16, 0, 1)).toBeCloseTo(1.4 * 1.32);
  });

  it('never exceeds V_CAP: 2.6 on Easy / Normal, 2.9 on Hard / Very Hard', () => {
    for (const t of [0, 1]) expect(bulletV(1.9, 31, 3, t)).toBe(2.6);
    for (const t of [2, 3]) expect(bulletV(1.9, 31, 3, t)).toBe(2.9);
    expect(bulletV(1.7, 16, 0, 1)).toBeCloseTo(Math.min(2.6, 1.7 * 1.32));
  });

  it('the loop factor tops out at x1.3', () => {
    expect(bulletV(1, 0, 10, 3)).toBeCloseTo(1.3);
    expect(bulletV(1, 0, 1, 3)).toBeCloseTo(1.12);
  });
});
