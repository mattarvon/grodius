import { describe, it, expect, beforeEach } from 'vitest';
// @ts-ignore: plain .mjs tool module, no types
import { PILOT } from '../../tools/pilot.mjs';
import * as BRL from '../../src/boss/bossrules';
import { segDist } from '../../src/enemies/butcherhook';

// r4 pressure: THE REACH at 330 px (bossrules DRIVE.reach.len). Closed loop, as pilot.test.ts: the limb follows boss/update.ts
// reachAt / stepReach / tentPts and its contact test, the pilot steers every frame, and the ship must never be touched.
// Before the retract rule (bossrules reachPose st 3) the long limb's return swing hit 2-3 times here: an untold sweep
const W = 480, PH = 254;
let win: any;
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
function tentPts(b: any, t: any) { // boss/update.ts tentPts, restated
  const side = t.side, bx = b.x - 12, by = b.y + side * 30;
  let ang = Math.PI + side * (.42 + .55 * Math.sin(b.t * .021 * (1 + b.phase * .45) + t.ph)), len = 100 + 38 * Math.sin(b.t * .013 + t.ph), wk = 1;
  const pts = [];
  if (t.rs) { const p = BRL.reachPose(t.rs, t.rf, len, t.rl); len = p.len; ang += wrapA(t.ra - ang) * p.k; wk = 1 - p.k; }
  for (let i = 0; i <= 16; i++) { const f = i / 16, w = Math.sin(f * 5 - b.t * .12 + t.ph) * 7 * f * wk; pts.push({ x: bx + Math.cos(ang) * len * f - Math.sin(ang) * w, y: by + Math.sin(ang) * len * f + Math.cos(ang) * w }); }
  return pts;
}
beforeEach(() => {
  win = (globalThis as any).window = {};
  win.__W = { eshots: [], floorAt: () => 250, ceilAt: () => 4 };
  win.__BRL = BRL; win.__BU = { tentPts };
  win.__pilotLoad = undefined;
  (0, eval)(PILOT);
  win.__pilotLoad = () => Promise.resolve();
});
describe('pilot r4: THE REACH at its long4 length', () => {
  for (const k of [1, 1.25]) for (const [sx, sy, sp] of [[90, 127, 1], [60, 60, 1], [150, 200, 2], [200, 100, 0]] as const) it(`reach x${k} (tier.ts TIER.reach): a ship at ${sx},${sy} (THRUST ${sp}) is never touched by 6 reaches`, () => {
    const R = BRL.DRIVE.reach, P: any = { x: sx, y: sy, speed: sp, alive: true, inv: 0 };
    const b: any = { x: W - 110, y: PH / 2, t: 0, phase: 0, tent: [{ side: -1, ph: 0 }, { side: 1, ph: 2 }], dying: false };
    let hits = 0;
    for (let f = 0; f < 6 * 140; f++) {
      b.t++;
      const t = b.tent[Math.floor(f / 140) % 2];
      if (f % 140 === 0) { const B = BRL.tentBase(b.x, b.y, t.side); t.rs = 1; t.rf = 0; t.rl = Math.round(R.len * k); t.ra = Math.atan2(P.y - B.y, P.x - B.x); }
      for (const q of b.tent) { if (!q.rs) continue; q.rf++;
        if (q.rs === 1) { if (q.rf <= R.tell - R.lock) { const B = BRL.tentBase(b.x, b.y, q.side); q.ra = Math.atan2(P.y - B.y, P.x - B.x); } if (q.rf >= R.tell) { q.rs = 2; q.rf = 0; } }
        else if (q.rs === 2) { if (q.rf >= R.ext + R.hold) { q.rs = 3; q.rf = 0; } } else if (q.rf >= R.back) { q.rs = 0; q.rf = 0; } }
      win.__pilotStep({ P, G: { scroll: 0, scrollSpeed: 0, loop: 0, stage: 3, t: f, boss: b }, enemies: [] }, 90, 127);
      for (const q of b.tent) { const pts = tentPts(b, q); for (let i = q.rs ? 8 : 10; i < pts.length; i++) if ((P.x - pts[i].x) ** 2 + (P.y - pts[i].y) ** 2 < (i === 16 ? 8 : 5) ** 2 || (q.rs && i > 8 && segDist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, P.x, P.y) < 5)) { hits++; break; } }
    }
    expect(hits).toBe(0);
  });
});
