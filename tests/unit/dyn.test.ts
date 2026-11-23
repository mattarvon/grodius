// DYN moving-terrain windows (terrainb.ts; DIFFICULTY-SPEC §2.4, levels.md §2.2): the S2 edge-speed cap on every column
// of every frame, the fit floor, the taper slope, the exact return to base, and the overlap and reset rules. The
// signature parameters are levels.md's own tables (§5.2 HIGH TIDE, §5.4 THE SWALLOW).
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/core', () => {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const hash = (n: number) => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  const vnoise = (x: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
  return { PH: 254, W: 480, TS: 4, hash, vnoise, lerp };
});
const T = await import('../../src/terrainb');
const { DYN, DYNS, armDynWin, dynLen, dynOff, normDyn, ramp, resetDynWins, stepDynWins, dynBase, dynAt } = T;

const TS = 4, N = 1000;
/** a corridor: ceiling 60, floor 200 (gap 140), with a gentle wave so the base isn't flat */
function terrain(gap = 140) {
  const C = new Float32Array(N), F = new Float32Array(N);
  for (let i = 0; i < N; i++) { const m = 127 + Math.sin(i / 23) * 10; C[i] = m - gap / 2; F[i] = m + gap / 2; }
  return { C, F };
}
const TIDES = [ // levels.md §5.2: [d, rise, hold, drain, fit]
  [40, 90, 180, 90, 110], [60, 120, 240, 120, 92], [70, 140, 240, 140, 88],
];
const SWALLOWS = [ // levels.md §5.4: [S, T, split]
  [12, 240, false], [16, 200, true], [18, 200, false],
];

/** run a window to its end on a fresh terrain, returning the worst per-frame column speed and the narrowest column gap */
function fly(spec: any, gap = 140) {
  resetDynWins();
  const { C, F } = terrain(gap), C0 = C.slice(), F0 = F.slice();
  const w = armDynWin(spec, 100, C, F, TS)!;
  expect(w).not.toBeNull();
  let pc = C.slice(), pf = F.slice(), vmax = 0, gmin = Infinity;
  const len = dynLen(w.spec);
  for (let t = 100; t <= 100 + len + 2; t++) {
    stepDynWins(t, C, F);
    for (let i = 0; i < N; i++) {
      vmax = Math.max(vmax, Math.abs(C[i] - pc[i]), Math.abs(F[i] - pf[i]));
      if (i >= w.i0 && i <= w.i1) gmin = Math.min(gmin, F[i] - C[i]);
    }
    pc = C.slice(); pf = F.slice();
  }
  return { vmax, gmin, C, F, C0, F0, w };
}

describe('ramp', () => {
  it('reaches d at T, never beats v, and eases when there is room', () => {
    for (const [d, Tt] of [[40, 90], [70, 140], [30, 200]]) {
      let prev = 0, vm = 0;
      for (let t = 1; t <= Tt; t++) { const p = ramp(d, Tt, .5, t); vm = Math.max(vm, p - prev); prev = p; }
      expect(prev).toBeCloseTo(d, 6);
      expect(vm).toBeLessThanOrEqual(.5 + 1e-9);
    }
    expect(ramp(30, 200, .5, 1)).toBeLessThan(30 / 200); // eased in: slower than linear at the start
  });
});

describe('normDyn (the space rules applied at arm)', () => {
  it('stretches a tide that would beat S2, and clamps tell and fit up', () => {
    const s = normDyn({ id: 'x', kind: 'tide', x0: 0, x1: 400, d: 80, rise: 40, hold: 10, drain: 40, tell: 10, fit: 50 });
    expect(s.rise).toBe(160); expect(s.drain).toBe(160);
    expect(s.tell).toBe(DYN.minTell); expect(s.fit).toBe(DYN.minFit);
    expect(s.edge).toBeGreaterThanOrEqual(80 * DYN.edgePerPx);
  });
  it('stretches a swallow period that would beat S2 and rounds its life to whole periods', () => {
    const s = normDyn({ id: 'x', kind: 'swallow', x0: 0, x1: 480, S: 40, T: 100, dur: 250, tell: 44, fit: 72 });
    expect(s.T).toBe(Math.ceil(40 * Math.PI / .5));
    expect(s.dur! % s.T!).toBe(0);
  });
});

describe('HIGH TIDE windows (levels.md §5.2)', () => {
  for (const [d, rise, hold, drain, fit] of TIDES) it(`d ${d}: every edge <= .5 px/f, gap >= fit ${fit}, back to base`, () => {
    const r = fly({ id: 'high_tide', kind: 'tide', x0: 400, x1: 2400, d, rise, hold, drain, tell: 60, fit, side: 1 });
    expect(r.vmax).toBeLessThanOrEqual(DYN.vMax + 1e-4);
    expect(r.gmin).toBeGreaterThanOrEqual(fit - 1e-3);
    expect(Array.from(r.F)).toEqual(Array.from(r.F0));
    expect(Array.from(r.C)).toEqual(Array.from(r.C0));
    expect(DYNS.length).toBe(0);
  });
  it('the floor really rises by d at the hold, and nothing moves during the tell', () => {
    const s = normDyn({ id: 'h', kind: 'tide', x0: 0, x1: 2000, d: 60, rise: 120, hold: 240, drain: 120, tell: 60, fit: 72, side: 1 });
    expect(dynOff(s, 1000, 30)).toEqual([0, 0]);
    expect(dynOff(s, 1000, 60 + 120 + 10)[1]).toBeCloseTo(60, 6);
    expect(dynOff(s, 1000, 60 + 120 + 10)[0]).toBe(0);
  });
  it('the taper keeps the window end slope under S3 (.6)', () => {
    const s = normDyn({ id: 'h', kind: 'tide', x0: 0, x1: 2000, d: 70, rise: 140, hold: 240, drain: 140, tell: 60, fit: 72, side: 1 });
    let worst = 0;
    for (let x = 0; x < 2000; x += 1) worst = Math.max(worst, Math.abs(dynOff(s, x + 1, 300)[1] - dynOff(s, x, 300)[1]));
    expect(worst).toBeLessThanOrEqual(.6);
  });
  it('a tide that would close the corridor opens about the middle at the fit floor', () => {
    const r = fly({ id: 'h', kind: 'tide', x0: 400, x1: 2400, d: 70, rise: 140, hold: 100, drain: 140, tell: 60, fit: 100, side: 1 }, 120);
    expect(r.gmin).toBeGreaterThanOrEqual(100 - 1e-3);
    expect(r.vmax).toBeLessThanOrEqual(DYN.vMax + 1e-4);
  });
});

describe('THE SWALLOW windows (levels.md §5.4)', () => {
  for (const [S, Tp, split] of SWALLOWS) it(`S ${S} T ${Tp}${split ? ' split' : ''}: edges <= .5 px/f, narrows to 108 - 2S, never under 72`, () => {
    const r = fly({ id: 'swallow', kind: 'swallow', x0: 400, x1: 880, S, T: Tp, dur: 4 * Tp, tell: 44, fit: 72, split }, 108);
    expect(r.vmax).toBeLessThanOrEqual(DYN.vMax + 1e-4);
    expect(r.gmin).toBeGreaterThanOrEqual(72 - 1e-3);
    expect(r.gmin).toBeLessThanOrEqual(108 - 2 * S + 1); // it really clenches (v3: 108 -> 72)
    expect(Array.from(r.F)).toEqual(Array.from(r.F0));
  });
  it('a split swallow lives at least two periods, so its far half moves too', () => {
    const s = normDyn({ id: 'sw', kind: 'swallow', x0: 0, x1: 960, S: 16, T: 200, dur: 200, tell: 44, fit: 72, split: true });
    expect(s.dur).toBe(400);
    expect(dynOff(s, 900, 44 + 200)[0]).toBeGreaterThan(15);
  });
  it('split halves are out of phase: one clenches while the other relaxes', () => {
    const s = normDyn({ id: 'sw', kind: 'swallow', x0: 0, x1: 960, S: 16, T: 200, dur: 800, tell: 44, fit: 72, split: true });
    const u = 44 + 100; // half a period in: phase 0 fully clenched
    expect(dynOff(s, 240, u)[0]).toBeGreaterThan(15);
    expect(dynOff(s, 720, u)[0]).toBeLessThan(1);
  });
});

describe('windows: overlap, reset, base, at', () => {
  it('refuses an overlapping window and accepts a disjoint one', () => {
    resetDynWins();
    const { C, F } = terrain();
    expect(armDynWin({ id: 'a', kind: 'tide', x0: 400, x1: 900, d: 30, rise: 60, hold: 0, drain: 60, tell: 44, fit: 72 }, 0, C, F, TS)).not.toBeNull();
    expect(armDynWin({ id: 'b', kind: 'tide', x0: 800, x1: 1200, d: 30, rise: 60, hold: 0, drain: 60, tell: 44, fit: 72 }, 0, C, F, TS)).toBeNull();
    expect(armDynWin({ id: 'c', kind: 'tide', x0: 1300, x1: 1800, d: 30, rise: 60, hold: 0, drain: 60, tell: 44, fit: 72 }, 0, C, F, TS)).not.toBeNull();
    expect(DYNS.length).toBe(2);
    resetDynWins();
  });
  it('a reset mid-window writes the base back exactly', () => {
    resetDynWins();
    const { C, F } = terrain(), F0 = F.slice();
    armDynWin({ id: 'a', kind: 'tide', x0: 400, x1: 1400, d: 50, rise: 100, hold: 100, drain: 100, tell: 44, fit: 72 }, 0, C, F, TS);
    for (let t = 0; t < 180; t++) stepDynWins(t, C, F);
    expect(Array.from(F)).not.toEqual(Array.from(F0));
    expect(dynBase(900)![1]).toBeCloseTo(F0[225], 4);
    expect(dynAt(900, 180)!.k).toBeGreaterThan(.5);
    expect(dynAt(900, 10)!.tell).toBeGreaterThan(0);
    resetDynWins(C, F);
    expect(Array.from(F)).toEqual(Array.from(F0));
    expect(dynAt(900, 180)).toBeNull();
  });
  it('a window armed on replaced arrays is dropped without writing', () => {
    resetDynWins();
    const a = terrain(), b = terrain(), F0 = b.F.slice();
    armDynWin({ id: 'a', kind: 'tide', x0: 400, x1: 1400, d: 50, rise: 100, hold: 100, drain: 100, tell: 44, fit: 72 }, 0, a.C, a.F, TS);
    stepDynWins(150, b.C, b.F);
    expect(DYNS.length).toBe(0);
    expect(Array.from(b.F)).toEqual(Array.from(F0));
  });
  it('is a pure function of the frame: stepping to t from any history gives the same arrays', () => {
    resetDynWins();
    const a = terrain(), b = terrain(), spec = { id: 's', kind: 'swallow' as const, x0: 400, x1: 880, S: 18, T: 200, dur: 800, tell: 44, fit: 72 };
    armDynWin(spec, 0, a.C, a.F, TS);
    for (let t = 0; t <= 333; t++) stepDynWins(t, a.C, a.F);
    const A = a.F.slice();
    resetDynWins();
    armDynWin(spec, 0, b.C, b.F, TS);
    stepDynWins(333, b.C, b.F); // straight to the frame
    expect(Array.from(b.F)).toEqual(Array.from(A));
    resetDynWins();
  });
});

describe('a tide holds the swept fit against a needle beside the column (W6, route-probe L5)', () => {
  it('a ceiling needle 3 columns over keeps the floor fit px under it, not just under its own column', () => {
    resetDynWins();
    const C = new Float32Array(N).fill(60), F = new Float32Array(N).fill(200);
    C[230] = 90; // a needle hanging 30 px lower than its neighbours
    const w = armDynWin({ id: 'n', kind: 'tide', x0: 400, x1: 1200, d: 70, rise: 140, hold: 240, drain: 140, tell: 44, fit: 100 }, 0, C, F, TS)!;
    for (let t = 0; t < 44 + 140 + 100; t++) stepDynWins(t, C, F);
    for (let i = 227; i <= 233; i++) expect(F[i], `col ${i}`).toBeGreaterThanOrEqual(90 + 100 - 1e-3); // within 6 columns of it
    expect(F[170]).toBeLessThan(170); // far from it the tide still rises to its own fit (60 + 100)
  });
});
