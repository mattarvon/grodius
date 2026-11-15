// THE KEEPSAKE (pass-1 greybox, ship pool, ANGLE): its pure rules from enemies/mid/_keepsake.ts, and the ?mid= test
// query that flies it (lab.ts forcedMid, midpick.ts forceSlotA). The fight itself is measured by tools/midboss-probe.mjs.
import { describe, expect, it } from 'vitest';
import { KEEP, forkCols, keepHurt, lobFrames } from '../../src/enemies/mid/_keepsake';
import { forcedMid } from '../../src/lab';
import { MIDS, forceSlotA } from '../../src/midpick';
import { midRow } from '../../src/enemies/mid/roster';

/** a seeded [0, 1) stream (mulberry32), counting its draws */
const stream = (s: number) => { const f = () => { f.n++; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; f.n = 0; return f; };
const E = { x: 300, y: 150 };

describe('keepHurt: the ANGLE rule', () => {
  it('takes full damage on the wound on top of the skull', () => {
    expect(keepHurt(E, E.x + KEEP.wx, E.y + KEEP.wy)).toBe(1);
    expect(keepHurt(E, E.x + KEEP.wx - KEEP.ww, E.y - KEEP.crown)).toBe(1); // the corner of the span, on the crown line
  });

  it('tinks at x.15 on the face, below the crown line or outside the wound span', () => {
    expect(keepHurt(E, E.x - KEEP.r, E.y)).toBe(.15); //                      a shot into the face
    expect(keepHurt(E, E.x + KEEP.wx, E.y - KEEP.crown + 1)).toBe(.15); //     just under the crown line
    expect(keepHurt(E, E.x + KEEP.wx - KEEP.ww - 1, E.y + KEEP.wy)).toBe(.15); // high, but off the wound to the front
  });

  it('treats area damage, which arrives at exactly (e.x, e.y), as a face hit', () => {
    expect(keepHurt(E, E.x, E.y)).toBe(KEEP.face);
  });

  it('counts the laser, whose hit lands at e.x - r/2, on the wound when it crosses the crown', () => {
    expect(keepHurt(E, E.x - KEEP.r * .5, E.y - KEEP.crown - 2)).toBe(1);
  });

  it('puts the whole wound hitbox (e.hb) above the crown line and inside the span, so a hit on it is never a tink', () => {
    expect(KEEP.wy + KEEP.wr).toBeLessThanOrEqual(-KEEP.crown);
    expect(KEEP.wr).toBeLessThanOrEqual(KEEP.ww);
    expect(midRow('keepsake')!.fit!.up).toBe(-(KEEP.wy - KEEP.wr)); // the roster fit is measured to its top
  });
});

describe('forkCols: the fountain always leaves a gap', () => {
  const out = new Float32Array(8), used = new Uint8Array(8);

  it('never fills every column, and keeps forks a column apart, over 2000 fountains each phase', () => {
    for (const [slots, pitch, n] of [[KEEP.slots, KEEP.pitch, 4], [KEEP.slots2, KEEP.pitch2, 5], [KEEP.slots, KEEP.pitch, 9]]) {
      const rng = stream(slots * 31 + n);
      for (let k = 0; k < 2000; k++) {
        const m = forkCols(n, slots, pitch, 100, KEEP.jit, 0, 1e4, rng, out, used);
        expect(m).toBe(Math.min(n, slots - 1));
        let gap = 0;
        for (let i = 1; i < m; i++) {
          expect(out[i] - out[i - 1]).toBeGreaterThanOrEqual(pitch - 2 * KEEP.jit);
          gap = Math.max(gap, out[i] - out[i - 1]);
        }
        // the empty column: two forks two pitches apart, or an end of the lattice left open
        const open = out[0] - 100 >= pitch - KEEP.jit || 100 + (slots - 1) * pitch - out[m - 1] >= pitch - KEEP.jit;
        expect(gap >= 2 * pitch - 2 * KEEP.jit || open).toBe(true);
      }
    }
  });

  it('draws exactly 2n values from the sim stream, whatever it picks', () => {
    const rng = stream(5);
    forkCols(4, KEEP.slots, KEEP.pitch, 0, KEEP.jit, 0, 1e4, rng, out, used);
    expect(rng.n).toBe(8);
  });

  it('clamps a column to the screen it is given', () => {
    const m = forkCols(5, 6, 46, -200, 0, 12, 472, stream(1), out, used);
    for (let i = 0; i < m; i++) { expect(out[i]).toBeGreaterThanOrEqual(12); expect(out[i]).toBeLessThanOrEqual(472); }
  });
});

describe('lobFrames', () => {
  it('matches lob(): a glob launched at rise u under .025 gravity passes dy below its start at that frame', () => {
    for (const [u, dy] of [[1.55, 10], [1.9, 10], [1.7, -20]]) {
      const t = lobFrames(u, dy);
      expect(-u * t + .0125 * t * t).toBeCloseTo(dy, 6);
    }
  });

  it('keeps the fountain apex on screen: at most u1^2 / .05 above the wound', () => {
    expect(KEEP.u1 ** 2 / .05).toBeLessThan(80);
  });
});

describe('the ?mid= test query', () => {
  it('names a wip kind, and nothing else', () => {
    expect(forcedMid('?mid=keepsake')).toBe('keepsake');
    expect(forcedMid('?stage=acid&x=10&mid=keepsake&kit=mid')).toBe('keepsake');
    expect(forcedMid('?mid=cyst')).toBe(null); //    finished: the query can't move a shipped run
    expect(forcedMid('?mid=nobody')).toBe(null);
    expect(forcedMid('?mids=wip')).toBe(null); //    the WIP flag is a different query
    expect(forcedMid('')).toBe(null);
  });

  it('puts the kind in slot A and keeps slot B when its tag differs', () => {
    expect(forceSlotA(['cyst', 'brood'], 'keepsake')).toEqual(['keepsake', 'brood']);
    expect(forceSlotA(['cyst'], 'keepsake')).toEqual(['keepsake']);
    expect(forceSlotA([], 'keepsake')).toEqual(['keepsake']);
  });

  it('drops slot B when it shares the forced kind\'s tag (spec §6.1)', () => {
    const defs = { ...MIDS, twin: { body: 'twin', tag: 'ANGLE' as const, min: 1 } };
    expect(forceSlotA(['cyst', 'twin'], 'keepsake', defs)).toEqual(['keepsake']);
  });
});
