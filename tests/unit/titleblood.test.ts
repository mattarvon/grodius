import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { D, DRIP, E, GONE, HEAD, RAILS, VISIT, bobY, eggAdvance, eggFrame, eggReset, epochStart, maxStep } from '../../src/render/titleblood';
import { TITLE, TITLE_DOLL_CLEAR, TITLE_EYE_CLEAR, TITLE_HERO, TITLE_NOGO, hitsTitleHero } from '../../src/titlelayout';

// The title's easter egg must never sit on the menu, logo, text or the title's hero (THE KEEPSAKE's head, or ROT while
// TITLE_HERO is 'rot'), however its visits fall. The rects come from the layout table drawTitle draws from, so moving a
// title element and leaving a rail behind fails here
const NOGO = TITLE_NOGO;
const ROT = { x: TITLE.eye.x, y: TITLE.eye.y, clear: TITLE_EYE_CLEAR };
const FRAMES = 1200000; // about 5.5 hours of title: hundreds of visits

const hitsRect = (x: number, y: number, w: number, h: number, r: typeof NOGO[0]) => x < r.x1 && x + w > r.x0 && y < r.y1 && y + h > r.y0;
function hitsRot(x: number, y: number, w: number, h: number) {
  const cx = Math.max(x, Math.min(ROT.x, x + w)), cy = Math.max(y, Math.min(ROT.y, y + h));
  return Math.hypot(cx - ROT.x, cy - ROT.y) < ROT.clear;
}
/** the hero the title draws: ROT's circle (checked here as well as by the layout), or the doll's ellipse */
const hitsHero = (x: number, y: number, w: number, h: number) => (TITLE_HERO === 'rot' ? hitsRot(x, y, w, h) : false) || hitsTitleHero(x, y, w, h);

beforeEach(() => eggReset());

describe('the head\'s visits', () => {
  it('never touches a no-go rect or the title hero across a long sweep, and is sometimes absent', () => {
    let hit = 0, away = 0, here = 0;
    const seen = new Set<number>();
    for (let t = 0; t < FRAMES; t++) {
      eggAdvance(t);
      if (E.phase === GONE) { away++; continue; }
      here++;
      seen.add(E.rail);
      const x = Math.round(E.x), y = Math.round(E.y) + bobY(t);
      for (const r of NOGO) if (hitsRect(x, y, HEAD.w, HEAD.h, r)) hit++;
      if (hitsHero(x, y, HEAD.w, HEAD.h)) hit++;
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
      if (hitsHero(x, y, HEAD.w, HEAD.h)) hit++;
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

  it('never falls onto a no-go rect or the title hero, whichever rail it left', () => {
    let hit = 0, seen = 0;
    for (let t = 0; t < FRAMES / 4; t++) {
      eggAdvance(t);
      for (let i = 0; i < D.n; i++) {
        const tail = 1 + Math.floor(D.vy[i] * DRIP.tailK), x = Math.floor(D.x[i]), y = Math.floor(D.y[i]) - tail + 1;
        seen++;
        if (NOGO.some((r) => hitsRect(x, y, D.w[i], tail, r)) || hitsHero(x, y, D.w[i], tail)) hit++;
      }
    }
    expect(seen).toBeGreaterThan(0);
    expect(hit).toBe(0);
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
    expect(src).not.toMatch(/\bR\(/);
  });
});

describe('the title hero keep-out', () => {
  it('follows the hero switch: the doll ellipse and fork rect, or the ROT circle and rope', () => {
    const names = NOGO.map((r) => r.n);
    if (TITLE_HERO === 'doll') {
      expect(names).toContain('fork');
      expect(names).not.toContain('rope');
      // the head's centre and the baked face's extremes are inside; a box clear of the ellipse is not
      expect(hitsTitleHero(TITLE.doll.x, TITLE.doll.y, 1, 1)).toBe(true);
      expect(hitsTitleHero(TITLE.doll.x - 64, TITLE.doll.y, 1, 1)).toBe(true);
      expect(hitsTitleHero(TITLE.doll.x, TITLE.doll.y + 80, 1, 1)).toBe(true);
      expect(hitsTitleHero(TITLE_DOLL_CLEAR.x + TITLE_DOLL_CLEAR.rx + 1, TITLE_DOLL_CLEAR.y, 1, 1)).toBe(false);
    } else {
      expect(names).toContain('rope');
      expect(hitsTitleHero(ROT.x, ROT.y, 1, 1)).toBe(true);
    }
  });
});
