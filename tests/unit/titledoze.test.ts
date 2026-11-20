import { describe, expect, it } from 'vitest';
import { HALF, OPEN, SHUT, TD, TOUT, titleDoze, titleOutPose } from '../../src/render/titledoze';

// THE KEEPSAKE on the title: the doze is a pure function of $.T (a title rig or a resume lands on any frame and must see
// the same head), it never opens its eyes at rest (open is the tell), and it moves by holds and hitches (D39)
const FRAMES = 600000; // about 2.8 hours of title

describe('the title doll\'s doze', () => {
  it('gives the same pose at any frame however it was reached', () => {
    const a = { eye: 0, jy: 0 }, b = { eye: 0, jy: 0 };
    for (let t = 0; t < 20000; t += 7) {
      titleDoze(t, a);
      titleDoze(t + 1000, b); titleDoze(t, b); // another frame first: nothing carries over
      expect(b).toEqual(a);
    }
  });

  it('never opens its eyes at rest, and is mostly half-lidded with the odd droop shut', () => {
    const p = { eye: 0, jy: 0 };
    let shut = 0, open = 0, droops = 0, prev = HALF;
    for (let t = 0; t < FRAMES; t++) {
      titleDoze(t, p);
      if (p.eye === OPEN) open++;
      if (p.eye === SHUT) shut++;
      if (p.eye === SHUT && prev !== SHUT) droops++;
      prev = p.eye;
    }
    expect(open).toBe(0);
    expect(shut / FRAMES).toBeGreaterThan(.03);
    expect(shut / FRAMES).toBeLessThan(.2);
    // one droop or flutter (two shuts) per epoch
    const epochs = FRAMES / TD.period;
    expect(droops).toBeGreaterThan(epochs * .9);
    expect(droops).toBeLessThan(epochs * 1.4);
  });

  it('holds still between hitches: long half-lidded holds, and a dip of at most 1 px only at a change', () => {
    const p = { eye: 0, jy: 0 };
    let run = 0, minHold = Infinity, prev = HALF, maxDip = 0;
    for (let t = 0; t < FRAMES; t++) {
      titleDoze(t, p);
      maxDip = Math.max(maxDip, Math.abs(p.jy)); // asserted once below: an expect() per frame timed out on CI
      if (p.eye !== prev) {
        // a flutter's 8-frame beat between its two shuts is the hitch itself; every other half-lidded hold is a rest
        if (prev === HALF && run > 0 && t > 2000) { if (run < 10) expect(run).toBe(7); else minHold = Math.min(minHold, run); }
        run = 0;
      } else run++;
      prev = p.eye;
    }
    expect(maxDip).toBeLessThanOrEqual(1);
    expect(minHold).toBeGreaterThan(200); // the shortest rest between droops is seconds, not frames
  });
});

describe('the snap open on DESCEND', () => {
  it('raises the fork in three steps, holds, then fades off by the end', () => {
    const o = { rise: 0, a: 0 };
    let r = 0;
    for (let f = 0; f < TOUT.end; f++) {
      titleOutPose(f, o);
      expect(o.rise).toBeGreaterThanOrEqual(r);
      r = o.rise;
      if (f < TOUT.hold) expect(o.a).toBe(1);
    }
    expect(r).toBe(TOUT.riseAt.length);
    expect(titleOutPose(TOUT.end, o).a).toBe(0);
    expect(titleOutPose(0, o).rise).toBe(0);
  });

  it('is over in half a second (the run never waits: this only draws over its first frames)', () => {
    expect(TOUT.end).toBeLessThanOrEqual(30);
  });
});
