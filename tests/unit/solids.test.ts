// src/solids.ts (DIFFICULTY-SPEC §2.4, levels.md §2.1). W0 STUB tests: W3 owns this file after W0 and replaces them
// with slab hit tests (edges, the probe contract solidsCol(wx) -> [y0, y1][]).
import { describe, expect, it } from 'vitest';
import { resetSolids, solidAt, solidShot, solidsCol, stepSolids } from '../../src/solids';

describe('solids.ts (W0 stub)', () => {
  it('has no solid anywhere, and returns one frozen empty column', () => {
    expect(stepSolids()).toBe(false); // no slab strikes the ship
    resetSolids();
    expect(solidAt(0, 135)).toBe(false);
    expect(solidShot(500, 100, 3)).toBe(false);
    const c = solidsCol(800);
    expect(c).toEqual([]);
    expect(c).toBe(solidsCol(900));
    expect(Object.isFrozen(c)).toBe(true);
  });
});
