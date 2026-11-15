import { describe, expect, it } from 'vitest';
import { TG, titleGaze } from '../../src/render/titlegaze';

// The title eye's motion is a pure function of $.T because the title rig jumps T, so the eye must be the same at any
// frame however it got there. Sweep long enough to see many thousands of frames of epochs and membranes.
const SWEEP = 400000;
const EPS = 1e-9;

describe('titleGaze', () => {
  it('gives the same answer at any frame whatever was asked before', () => {
    const forward = [];
    for (let t = 0; t < 5000; t++) forward.push({ ...titleGaze(t) });
    for (let t = 4999; t >= 0; t -= 7) expect(titleGaze(t)).toEqual(forward[t]);
  });

  it('writes into the caller\'s object when given one, with the same values', () => {
    const out = { x: 0, y: 0, ang: 0, m: 0, bl: 0, jig: 0, phase: 0 };
    expect(titleGaze(777, out)).toBe(out);
    expect(out).toEqual(titleGaze(777));
  });

  it('never takes the lens past maxR from the centre across a long sweep', () => {
    let worst = 0;
    for (let t = 0; t < SWEEP; t++) worst = Math.max(worst, titleGaze(t).m);
    expect(worst).toBeLessThanOrEqual(TG.maxR + EPS);
    expect(worst).toBeGreaterThan(TG.maxR * .8); // the limit is reached for, not vacuous
  });

  it('keeps every hold within the wander radius of rest', () => {
    // counted, not one expect per frame: 400k expects can pass the sync timeout on a slow runner
    let holds = 0, worst = 0;
    for (let t = 0; t < SWEEP; t++) {
      const g = titleGaze(t);
      if (g.phase === 0) { holds++; worst = Math.max(worst, Math.hypot(g.x - TG.restX, g.y - TG.restY)); }
    }
    expect(holds).toBeGreaterThan(SWEEP / 2);
    expect(worst).toBeLessThanOrEqual(TG.wander + EPS);
  });

  it('holds for 240 to 900 frames between jumps', () => {
    let run = 0, seen = 0, min = Infinity, max = 0, started = false;
    for (let t = 0; t < SWEEP; t++) {
      if (titleGaze(t).phase === 0) { run++; continue; }
      if (run && started) { min = Math.min(min, run); max = Math.max(max, run); seen++; }
      started = true;
      run = 0;
    }
    expect(seen).toBeGreaterThan(300);
    expect(min).toBeGreaterThanOrEqual(240);
    expect(max).toBeLessThanOrEqual(900);
  });

  it('jumps in six frames, not a slide: each hitch lands on its hold', () => {
    let hitch = 0;
    for (let t = 1; t < 50000; t++) {
      const p = titleGaze(t).phase;
      if (p === 1) hitch++;
      else {
        if (hitch) expect(hitch).toBe(TG.hitch);
        hitch = 0;
      }
    }
  });

  it('bursts two or three saccades', () => {
    const counts = new Set<number>();
    let sacc = 0;
    for (let t = 0; t < 100000; t++) {
      const g = titleGaze(t);
      if (g.phase === 2) { if (g.jig === 1) sacc++; } // a saccade's first frame fires the jiggle at full strength
      else if (sacc) { counts.add(sacc); sacc = 0; }
    }
    expect([...counts].sort()).toEqual([2, 3]);
  });

  it('jiggles only for jigFrames after a jump', () => {
    for (let t = TG.jigFrames; t < 100000; t++) {
      if (titleGaze(t).jig === 0) continue;
      let jumped = false;
      for (let b = 0; b < TG.jigFrames && !jumped; b++) jumped = titleGaze(t - b).phase !== 0;
      expect(jumped).toBe(true);
    }
  });

  it('never covers more than 60 % with the membrane, and pulls it every 8 to 20 seconds', () => {
    let worst = 0, last = -1, gapMin = Infinity, gapMax = 0, was = false, reached = 0;
    for (let t = 0; t < SWEEP; t++) {
      const b = titleGaze(t).bl;
      worst = Math.max(worst, b);
      if (b === TG.memMax) reached++;
      const on = b > 0;
      if (on && !was) {
        if (last >= 0) { gapMin = Math.min(gapMin, t - last); gapMax = Math.max(gapMax, t - last); }
        last = t;
      }
      was = on;
    }
    expect(worst).toBeLessThanOrEqual(.6);
    expect(reached).toBeGreaterThan(0);
    expect(gapMin).toBeGreaterThanOrEqual(8 * 60);
    expect(gapMax).toBeLessThanOrEqual(20 * 60);
  });
});
