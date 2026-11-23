// src/sigs.ts (DIFFICULTY-SPEC §2.4). W0 SKELETON tests: W3 owns this file after W0 and replaces the "no window" cases
// with its signature tables (tells, distances, S3, S6). The space-rule pins stay.
import { describe, expect, it } from 'vitest';
import { $ } from '../../src/state';
import { SOLID_KILLS, SPACE, sigAt, sigWindows } from '../../src/sigs';

describe('sigs.ts (W0 skeleton)', () => {
  it('has no signature window, returns the same frozen list every call, and finds none', () => {
    const a = sigWindows($), b = sigWindows();
    expect(a).toEqual([]);
    expect(a).toBe(b);
    expect(Object.isFrozen(a)).toBe(true);
    expect(sigAt(1234)).toBe(null);
  });
  it('finds the window holding a world x, x1 exclusive', () => {
    const ws = [{ x0: 0, x1: 100, floor: 88, id: 'tide' }];
    expect(sigAt(50, ws)).toMatchObject({ id: 'tide' });
    expect(sigAt(0, ws)).toMatchObject({ id: 'tide' });
    expect(sigAt(100, ws)).toBe(null);
  });
  it('pins the space rules and decision 5A', () => {
    expect([SPACE.fitGap, SPACE.fitMin, SPACE.fitBox, SPACE.noSpawn, SPACE.noSpawnKid, SPACE.tell, SPACE.sigLead, SPACE.cutBolts]).toEqual([100, 72, 21, 48, 30, 44, 120, 8]);
    expect([SPACE.edgeV, SPACE.weave, SPACE.deckDim, SPACE.sanctuary]).toEqual([.5, .75, .4, 600]);
    expect(SOLID_KILLS).toBe(true);
  });
});
