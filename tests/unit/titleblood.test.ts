import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { D, DRIP, E, GONE, HEAD, RAILS, VISIT, bobY, eggAdvance, eggFrame, eggReset, epochStart, maxStep } from '../../src/render/titleblood';
import { SUB_BACK } from '../../src/backstep';

// The title's easter egg must never sit on the menu, logo, text or ROT, however its visits fall. These are the no-go rects
// on the 480x270 canvas, as read from drawTitle; x1,y1 exclusive
const NOGO = [
  { n: 'logo', x0: 26, y0: 30, x1: 296, y1: 92 },
  { n: 'subtitle', x0: 28, y0: 96, x1: 205, y1: 105 },
  { n: 'menu', x0: 28, y0: 105, x1: 202, y1: 206 },
  { n: 'help', x0: 28, y0: 208, x1: 255, y1: 226 },
  { n: 'hi', x0: 28, y0: 240, x1: 90, y1: 247 },
  { n: 'credits', x0: 190, y0: 231, x1: 472, y1: 249 },
  { n: 'age', x0: 322, y0: 258, x1: 472, y1: 266 },
  { n: 'subBack', x0: SUB_BACK.x, y0: SUB_BACK.y, x1: SUB_BACK.x + SUB_BACK.w, y1: SUB_BACK.y + SUB_BACK.h },
  { n: 'rope', x0: 420, y0: 0, x1: 446, y1: 40 },
];
const ROT = { x: 396, y: 124, r: 92, wobble: 8 };
const FRAMES = 1200000; // about 5.5 hours of title: hundreds of visits

const hitsRect = (x: number, y: number, w: number, h: number, r: typeof NOGO[0]) => x < r.x1 && x + w > r.x0 && y < r.y1 && y + h > r.y0;
function hitsRot(x: number, y: number, w: number, h: number) {
  const cx = Math.max(x, Math.min(ROT.x, x + w)), cy = Math.max(y, Math.min(ROT.y, y + h));
  return Math.hypot(cx - ROT.x, cy - ROT.y) < ROT.r + ROT.wobble;
}

beforeEach(() => eggReset());

describe('the head\'s visits', () => {
  it('never touches a no-go rect or ROT across a long sweep, and is sometimes absent', () => {
    let hit = 0, away = 0, here = 0;
    const seen = new Set<number>();
    for (let t = 0; t < FRAMES; t++) {
      eggAdvance(t);
      if (E.phase === GONE) { away++; continue; }
      here++;
      seen.add(E.rail);
      const x = Math.round(E.x), y = Math.round(E.y) + bobY(t);
      for (const r of NOGO) if (hitsRect(x, y, HEAD.w, HEAD.h, r)) hit++;
      if (hitsRot(x, y, HEAD.w, HEAD.h)) hit++;
    }
    expect(hit).toBe(0);
    expect(away).toBeGreaterThan(0);
    expect(here).toBeGreaterThan(0);
    expect(E.visits).toBeGreaterThan(100);
    expect(seen.size).toBe(RAILS.length);
  });

  it('holds every rail clear end to end at both bob extremes, whatever srnd picks', () => {
    let hit = 0;
    for (const r of RAILS) for (let u = 0; u <= 1; u += .002) for (const b of [-1, 1]) {
      const x = Math.round(r.x0 + (r.x1 - r.x0) * u), y = Math.round(r.y0 + (r.y1 - r.y0) * u) + b;
      for (const n of NOGO) if (hitsRect(x, y, HEAD.w, HEAD.h, n)) hit++;
      if (hitsRot(x, y, HEAD.w, HEAD.h)) hit++;
    }
    expect(hit).toBe(0);
  });

  it('stays gone for 6-20 s between visits', () => {
    let lo = Infinity, hi = 0, gap = 0, was = E.phase, first = true;
    for (let t = 0; t < FRAMES / 4; t++) {
      eggAdvance(t);
      if (E.phase === GONE) gap++;
      else if (was === GONE) { if (!first) { lo = Math.min(lo, gap); hi = Math.max(hi, gap); } first = false; gap = 0; }
      was = E.phase;
    }
    expect(lo).toBeGreaterThanOrEqual(VISIT.gap[0]);
    expect(hi).toBeLessThanOrEqual(VISIT.gap[1] + 1);
  });

  it('gives the same bob and frame at any frame however it was reached', () => {
    const forward = [];
    for (let t = 0; t < 4000; t++) forward.push([bobY(t), eggFrame(t)]);
    let diff = 0;
    for (let t = 3999; t >= 0; t -= 7) if (bobY(t) !== forward[t][0] || eggFrame(t) !== forward[t][1]) diff++;
    expect(diff).toBe(0);
  });

  it('stays still most of the time and uses all three frames', () => {
    const count = [0, 0, 0];
    let badBob = 0;
    for (let t = 0; t < 100000; t++) { count[eggFrame(t)]++; if (Math.abs(bobY(t)) > 1) badBob++; }
    expect(badBob).toBe(0);
    expect(count[1]).toBeGreaterThan(0);
    expect(count[2]).toBeGreaterThan(0);
    expect(count[0]).toBeGreaterThan(count[1] + count[2]);
  });

  it('finds the epoch that owns any frame', () => {
    let ahead = 0;
    for (let t = 0; t < 50000; t++) if (epochStart(t, 110, 70, 7) > t) ahead++;
    expect(ahead).toBe(0);
  });
});

describe('the drips', () => {
  it('holds the cap and stays above each rail\'s floor', () => {
    let over = 0, past = 0, peak = 0;
    for (let t = 0; t < FRAMES / 4; t++) {
      eggAdvance(t);
      if (D.n > DRIP.cap) over++;
      peak = Math.max(peak, D.n);
      for (let i = 0; i < D.n; i++) if (D.y[i] >= RAILS[E.rail].floor) past++;
    }
    expect(over).toBe(0);
    expect(past).toBe(0);
    expect(peak).toBeGreaterThan(0);
  });

  it('dies out while the head is gone, so nothing piles up', () => {
    let leftover = 0;
    for (let t = 0; t < FRAMES / 4; t++) {
      eggAdvance(t);
      if (E.phase === GONE && E.timer === 1 && E.done > 0 && D.n > 0) leftover++;
    }
    expect(leftover).toBe(0);
  });
});

describe('the frame clock', () => {
  it('does not step on a repeated frame, so a 120 Hz render runs at the same speed', () => {
    eggAdvance(1000);
    expect(eggAdvance(1000)).toBe(0);
    expect(eggAdvance(1001)).toBe(1);
    expect(eggAdvance(1001)).toBe(0);
  });

  it('clamps a jump of the counter', () => {
    eggAdvance(1000);
    expect(eggAdvance(900000)).toBe(maxStep);
  });

  it('survives the counter running backwards', () => {
    eggAdvance(5000);
    expect(eggAdvance(10)).toBe(0);
    expect(eggAdvance(11)).toBe(1);
  });
});

describe('isolation', () => {
  it('has its own pool and never reaches for the sim RNG', () => {
    const src = readFileSync(new URL('../../src/render/titleblood.ts', import.meta.url), 'utf8') + readFileSync(new URL('../../src/render/titlehead.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from '\.\.\/world'/);
    expect(src).not.toMatch(/Math\.random/);
  });
});
