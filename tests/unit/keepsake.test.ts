// THE KEEPSAKE (pass-1 greybox, ship pool, ANGLE): its pure rules from enemies/mid/_keepsake.ts, and the ?mid= test
// query that flies it (lab.ts forcedMid, midpick.ts forceSlotA). The fight itself is measured by tools/midboss-probe.mjs.
import { describe, expect, it } from 'vitest';
import { KEEP, forkCols, fountLattice, keepHurt, lobFrames, riseCap } from '../../src/enemies/mid/_keepsake';
import { forcedMid } from '../../src/lab';
import { MIDS, forceSlotA } from '../../src/midpick';
import { midRow } from '../../src/enemies/mid/roster';

/** a seeded [0, 1) stream (mulberry32), counting its draws */
const stream = (s: number) => { const f = () => { f.n++; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; f.n = 0; return f; };
const E = { x: 300, y: 150 };

describe('keepHurt: the ANGLE rule', () => {
  it('takes full damage on the wound on top of the skull, anywhere across the crown cap', () => {
    expect(keepHurt(E, E.x + KEEP.wx, E.y + KEEP.wy)).toBe(1);
    expect(keepHurt(E, E.x - 18, E.y - KEEP.crown)).toBe(1); // where a bolt meets the circle on the crown line
  });

  it('takes x.15 on the vinyl face, below the crown line', () => {
    expect(keepHurt(E, E.x - KEEP.r, E.y)).toBe(.15); //                  a shot into the face
    expect(keepHurt(E, E.x + KEEP.wx, E.y - KEEP.crown + 1)).toBe(.15); // just under the crown line
  });

  it('treats area damage, which arrives at exactly (e.x, e.y), as a face hit', () => {
    expect(keepHurt(E, E.x, E.y)).toBe(KEEP.face);
  });

  it('puts the whole wound hitbox (e.hb) above the crown line, so a hit on it is never a face hit', () => {
    expect(KEEP.wy + KEEP.wr).toBeLessThanOrEqual(-KEEP.crown);
    expect(midRow('keepsake')!.fit!.up).toBe(-(KEEP.wy - KEEP.wr)); // the roster fit is measured to its top
  });

  // shots.ts: a shot meets the body circle (e.r) first, then e.hb, at dist < r + s.r (hitShot); a bolt reports its own
  // (s.x, s.y), the laser (e.x - e.r / 2, s.y). Fly bolts in from the left at every height and check what each meets
  it('gives the same answer for a bolt and the laser at every height, through the real hit order (no dead band)', () => {
    const hb = [KEEP.wx, KEEP.wy, KEEP.wr], hit = (x: number, y: number, cx: number, cy: number, r: number, sr: number) => (x - cx) ** 2 + (y - cy) ** 2 < (r + sr) ** 2;
    let full = 0;
    for (const [vx, sr] of [[6, 2], [9, 2.8], [7, 4]]) for (let dy = -45; dy <= 30; dy += .5) {
      const y = E.y + dy;
      let m: number | null = null;
      for (let x = E.x - 200; x < E.x + 40 && m == null; x += vx) {
        if (hit(x, y, E.x, E.y, KEEP.r, sr) || hit(x, y, E.x + hb[0], E.y + hb[1], hb[2], sr)) m = keepHurt(E, x, y);
      }
      if (m == null) continue; // over or under the head
      const want = dy <= -KEEP.crown ? 1 : KEEP.face;
      expect(m, `bolt vx ${vx} at dy ${dy}`).toBe(want);
      expect(keepHurt(E, E.x - KEEP.r * .5, y), `laser at dy ${dy}`).toBe(want);
      if (m === 1) full++;
    }
    expect(full).toBeGreaterThan(30); // the full-damage band is real: ~14-20 px of heights per bolt size
  });
});

describe('fountLattice: one column on the ship', () => {
  const lat = new Float32Array(3);
  it('stretches the lattice left to a ship in the firing lane, its first column on the ship', () => {
    fountLattice(90, 388, 6, 46, -150, lat);
    expect(lat[0]).toBe(90);
    expect(lat[2]).toBe(0);
    expect(lat[0] + 5 * lat[1]).toBeCloseTo(388 - 150 + 5 * 46); // the right end stays where it was
    expect(lat[1]).toBeGreaterThanOrEqual(46);
  });

  it('slides the lattice left by under a pitch so a column lands on a ship inside it', () => {
    for (let px = 239; px <= 388 - 150 + 5 * 46; px += 7) { // (a ship behind the head slides it right instead)
      fountLattice(px, 388, 6, 46, -150, lat);
      expect(lat[1]).toBe(46);
      expect(lat[0] + lat[2] * lat[1]).toBeCloseTo(px);
      expect(lat[0]).toBeLessThanOrEqual(388 - 150);
    }
  });
});

describe('forkCols: the fountain always leaves a gap', () => {
  const out = new Float32Array(8), used = new Uint8Array(8);

  it('never fills every column, keeps forks a column apart and always takes the ship\'s column, over 2000 fountains each', () => {
    for (const [slots, pitch, n, must] of [[KEEP.slots, KEEP.pitch, 4, 0], [KEEP.slots2, KEEP.pitch2, 5, 3], [KEEP.slots, KEEP.pitch, 9, -1], [KEEP.slots, 82, 3, 0]]) {
      const rng = stream(slots * 31 + n);
      for (let k = 0; k < 2000; k++) {
        const m = forkCols(n, slots, pitch, 100, KEEP.jit, 0, 1e4, rng, out, used, must);
        expect(m).toBe(Math.min(n, slots - 1));
        if (must >= 0) expect(used[must]).toBe(1);
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

  it('draws exactly 2n values from the sim stream, 2n - 1 with a forced column, whatever it picks', () => {
    for (const [must, want] of [[-1, 8], [2, 7]]) {
      const rng = stream(5);
      forkCols(4, KEEP.slots, KEEP.pitch, 0, KEEP.jit, 0, 1e4, rng, out, used, must);
      expect(rng.n).toBe(want);
    }
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

  it('caps the rise so the apex never goes above KEEP.top, from any launch height', () => {
    for (let y = 20; y <= 250; y += 10) expect(y - riseCap(KEEP.u1, y) ** 2 / .05).toBeGreaterThanOrEqual(KEEP.top - 1e-9);
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
