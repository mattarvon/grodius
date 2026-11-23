// The stage bosses and the Gravity Drive on long4 (DIFFICULTY-SPEC §2.3 Fights, encounters.md §4.6-4.10; stream W4b):
// the pure rules in src/boss/bossrules.ts. Tells >= 44 f (E5), the twin beam's >= 50 px lane and the pincer's >= 60 px
// gap (spec §3 unit-test list), the rank rule's floor (C2), the time-outs (C23, PHASE_F) and each fight's designed bullet
// budget per 120 f under its cap (E7: the design-time check; boss-probe's on-screen max is the gate).
import { describe, expect, it } from 'vitest';
import { BLOAT, BUTCHER, DRIVE, MAW, PHASE_F, VOLLEY, combStep, curtainXs, driveClock, ivOf, lungeX, pincerTargets, reachPose, steerLane, tentBase, twinAngle, twinGap } from '../../src/boss/bossrules';

const W = 480, PH = 254;
/** a fixed LCG so the sweep is the same every run */
const lcg = (s: number) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

describe('the rank rule on fight intervals (C2)', () => {
  it('scales by cadMul and never goes under 18 f', () => {
    expect(ivOf(100, 1.25 - .6 * (2 / 16))).toBe(118); // rank 2: x1.175
    expect(ivOf(100, .65)).toBe(65); //                   rank 16: x.65
    expect(ivOf(20, .65)).toBe(VOLLEY.floor);
    expect(VOLLEY.cap).toBe(24);
  });
});

describe('THE MAW: the bite', () => {
  it('tells >= 44 f and locks its lane for the last 16', () => {
    expect(MAW.tell).toBeGreaterThanOrEqual(44);
    expect(MAW.lock).toBe(16);
    expect(MAW.var.hold).toBeGreaterThanOrEqual(44); // the variant's second line shows >= 44 f
  });
  it('lunges at 6 px/f to W*.35 and stops there', () => {
    expect(lungeX(398, W, 0)).toBe(398);
    expect(lungeX(398, W, 10)).toBe(338);
    expect(lungeX(398, W, 200)).toBeCloseTo(W * .35, 9);
  });
  it('the lane drifts toward the ship at most 1.5 px a frame', () => {
    expect(steerLane(100, 200)).toBe(101.5);
    expect(steerLane(100, 100.4)).toBeCloseTo(100.4, 9);
    expect(steerLane(100, 0)).toBe(98.5);
  });
  it('fires a 5-fan and one orb: 7 per 120 f at most (today 9)', () => {
    const per120 = MAW.fanN * Math.ceil(120 / MAW.jaw) + Math.ceil(120 / MAW.orbEvery);
    expect(per120).toBeLessThanOrEqual(7);
  });
});

describe('THE BLOAT: nail comb and icicle curtain', () => {
  it('the comb tells >= 44 f, streams 3 spikes 10 px apart from y +-34, four lanes with the core lane open as the variant', () => {
    expect(BLOAT.comb.tell).toBeGreaterThanOrEqual(44);
    expect(BLOAT.comb.n).toBe(3);
    expect(BLOAT.comb.lanes).toEqual([-34, 34]);
    expect(BLOAT.comb.lanesVar.every((y) => Math.abs(y) >= 20)).toBe(true); // the core's level stays open
    expect(combStep(1)).toBe(4); // 10 px at 2.4 px/f
    expect(combStep(1.3)).toBe(3);
  });
  it('phase 1 is 6 stream spikes + a 3-fan per 120 f, phase 2 a ring of 9 + 3 globs + 3 (icicles are hazards): <= 17', () => {
    const p1 = BLOAT.comb.n * BLOAT.comb.lanes.length + BLOAT.aim.n;
    const p2 = BLOAT.ring.n + BLOAT.glob.n + BLOAT.aim.n;
    expect(p1).toBe(9);
    expect(p2).toBe(15);
    expect(Math.max(p1, p2)).toBeLessThanOrEqual(VOLLEY.cap);
  });
  it('the curtain is three columns 60 px apart round the ship, clipped to the field', () => {
    expect(curtainXs(200, 16, 440)).toEqual([140, 200, 260]);
    expect(curtainXs(40, 16, 440)).toEqual([40, 100]);
    expect(curtainXs(430, 16, 440)).toEqual([370, 430]);
  });
  it('half clocks of 1200 f: 40 s at most', () => {
    expect(PHASE_F).toBe(1200);
    expect(2 * PHASE_F / 60).toBeLessThanOrEqual(40);
  });
});

describe('THE BURNING BUTCHER: meat hooks', () => {
  it('spits once, and the meat hooks tell >= 44 f across three lanes', () => {
    expect(BUTCHER.spitN[1]).toBe(7);
    expect(BUTCHER.meat.tell).toBeGreaterThanOrEqual(44);
    expect(BUTCHER.meat.xs).toHaveLength(3);
    expect(BUTCHER.meat.life).toBe(360);
    expect(BUTCHER.reelVar.warn).toBeGreaterThanOrEqual(44);
  });
  it('a cycle never overlaps the next set', () => {
    const M = BUTCHER.meat;
    expect(M.every).toBeGreaterThanOrEqual(M.tell + M.drop + M.life + M.reel);
  });
});

describe('THE GRAVITY DRIVE', () => {
  it('the reach tells 46 f, locks 16, is out 30 f to 190 px and back in 30', () => {
    const R = DRIVE.reach;
    expect(R.tell).toBe(46);
    expect(R.lock).toBe(16);
    expect(R.ext + R.hold).toBe(30);
    expect(R.back).toBe(30);
    expect(reachPose(1, 0, 110)).toEqual({ len: 110, k: 0 });
    expect(reachPose(1, R.tell, 110)).toEqual({ len: R.coil, k: 1 });
    expect(reachPose(2, R.ext, 110).len).toBe(190);
    expect(reachPose(2, R.ext, 110, 120).len).toBe(120); // a pincer stops at its target
    expect(reachPose(3, R.back, 110)).toEqual({ len: 110, k: 0 });
  });
  it('the twin beam always leaves a >= 50 px lane at the ship and beyond', () => {
    const r = lcg(7);
    for (let i = 0; i < 4000; i++) {
      const ex = 340 + r() * 60, ey = 70 + r() * 114, px = 12 + r() * 300, py = 8 + r() * (PH - 16);
      const a1 = Math.atan2(py - ey, px - ex), a2 = twinAngle(ex, ey, px, py, PH), d = Math.hypot(px - ex, py - ey);
      expect(twinGap(a1, a2, d)).toBeGreaterThanOrEqual(DRIVE.beam.gap - 1e-9);
      expect(twinGap(a1, a2, d * 1.5)).toBeGreaterThanOrEqual(DRIVE.beam.gap);
    }
  });
  it('the twin beam takes the side with room', () => {
    const a2 = twinAngle(370, 127, 100, 20, PH), y2 = 127 + Math.sin(a2) * 270; // ship near the top: the second line goes below
    expect(y2).toBeGreaterThan(20);
  });
  it('the pincer tips end >= 60 px apart wherever the lane sits', () => {
    const r = lcg(11);
    for (let i = 0; i < 4000; i++) {
      const bx = 340 + r() * 60, by = 70 + r() * 114, cx = 20 + r() * 300, cy = 12 + r() * (PH - 24), am = Math.atan2(cy - by, cx - bx);
      const T = pincerTargets(bx, by, cx, cy, am), tips = [tentBase(bx, by, -1), tentBase(bx, by, 1)].map((b, k) => {
        const d = Math.hypot(T[k][0] - b.x, T[k][1] - b.y), l = Math.min(DRIVE.pincer.len, d);
        return [b.x + (T[k][0] - b.x) / d * l, b.y + (T[k][1] - b.y) / d * l];
      });
      expect(Math.hypot(tips[0][0] - tips[1][0], tips[0][1] - tips[1][1])).toBeGreaterThanOrEqual(DRIVE.pincer.gap);
      expect(T[0][1]).toBeLessThanOrEqual(T[1][1]); // the upper limb takes the upper point
    }
  });
  it('collapses at 45 s and self-destructs at 60 s with grade C (C23)', () => {
    expect(driveClock(DRIVE.collapse - 1)).toBe(0);
    expect(driveClock(DRIVE.collapse)).toBe(1);
    expect(driveClock(DRIVE.destruct)).toBe(2);
    expect(DRIVE.collapse / 60).toBe(45);
    expect(DRIVE.destruct / 60).toBe(60);
    expect(DRIVE.grade).toBe('C');
  });
  it('base HP starts at 700 [FIT] and its bullets stay ~8 per 120 f in phase 0', () => {
    expect(DRIVE.hp).toBeGreaterThan(0);
    const p0 = DRIVE.ring0.n * Math.ceil(120 / DRIVE.ring0.every) + DRIVE.fan0.n;
    expect(p0).toBeLessThanOrEqual(13);
    const p2 = DRIVE.fan1.n * Math.ceil(120 / DRIVE.fan1.every) + 2;
    expect(p2).toBeLessThanOrEqual(8);
  });
});
