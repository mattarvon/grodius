// The G3 spawn-side body rule (DIFFICULTY-SPEC §2.1 "Fairness", levels.md S5; gates N4 and L5 hazBad): src/notice.ts
// clearOfShip pushes an off-screen entrant out along the edge it enters by until it starts >= r px from the ship.
import { describe, expect, it } from 'vitest';
import { clearOfShip } from '../../src/notice';

const W = 480, PH = 254, r = 58;
const d = ([x, y]: [number, number], px: number, py: number) => Math.hypot(x - px, y - py);

describe('clearOfShip', () => {
  it('leaves a spawn already clear of the ship alone', () => {
    expect(clearOfShip(496, 100, 200, 100, W, PH, r)).toEqual([496, 100]);
  });
  it('pushes a right entrant further right, its y unchanged', () => {
    const p = clearOfShip(496, 100, 470, 110, W, PH, r);
    expect(p[1]).toBe(100);
    expect(p[0]).toBeGreaterThan(496);
    expect(d(p, 470, 110)).toBeCloseTo(r, 6);
  });
  it('pushes a rear entrant further left, a drop further up, a rise further down', () => {
    expect(d(clearOfShip(-16, 127, 20, 127, W, PH, r), 20, 127)).toBeGreaterThanOrEqual(r - 1e-9);
    expect(clearOfShip(-16, 127, 20, 127, W, PH, r)[0]).toBeLessThan(-16);
    const t = clearOfShip(200, -16, 210, 20, W, PH, r);
    expect(t[0]).toBe(200);
    expect(t[1]).toBeLessThan(-16);
    expect(d(t, 210, 20)).toBeCloseTo(r, 6);
    const b = clearOfShip(200, PH + 16, 200, PH - 10, W, PH, r);
    expect(b[1]).toBeGreaterThan(PH + 16);
    expect(d(b, 200, PH - 10)).toBeCloseTo(r, 6);
  });
  it('leaves an on-screen spawn to its caller (a split child is refused there, not moved)', () => {
    expect(clearOfShip(200, 120, 210, 125, W, PH, r)).toEqual([200, 120]);
  });
  it('a corner spawn moves in x only; |dy| >= r is clear; a ship off-screen still pushes a rear entrant left', () => {
    const c = clearOfShip(W + 10, -10, W - 20, 10, W, PH, r);
    expect(c[1]).toBe(-10);
    expect(c[0]).toBeGreaterThan(W + 10);
    expect(clearOfShip(496, 100, 490, 100 + r, W, PH, r)).toEqual([496, 100]);
    expect(clearOfShip(-16, 100, -5, 100, W, PH, r)[0]).toBeLessThan(-16);
  });
});
