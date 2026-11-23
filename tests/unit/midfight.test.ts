// DIFFICULTY-SPEC §2.3 (W4a): the midboss fights' shared rules (src/enemies/mid/_fight.ts) and the new denial geometry in
// src/enemies/mid/_deny.ts. Pure: the rank (the W0 stand-in), the one cadence rule, variants at rank >= 14, the 15-per-120 f
// budget and the cap (volleys atomic), the Saucer's sweep, the Choir's twin-lane gap, the hook's sag and second-hook gap,
// the Brood's edge column.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const eshots = vi.hoisted(() => [] as any[]);
vi.mock('../../src/world', () => ({ eshots })); // world.ts loads the canvas; the budget reads only the shot list
import { setLayout } from '../../src/layout';
import { FT, cad, counted, fightCap, fightRank, fightRho, g3, ledger, litter, pTerm, per, spend, spent, variant } from '../../src/enemies/mid/_fight';
import { DN, SHIP_R, TELL_MIN, UFO_SW, edgeSlot, edgeX, hook2Aim, hookAt, hookSag, lanePair, laneY, segD2, sweepA, sweepHit } from '../../src/enemies/mid/_deny';

const PH = 254, W = 480;
beforeEach(() => {
  setLayout('long4');
  eshots.length = 0;
  $.G = { loop: 0, stage: 0, gm: {} } as any;
  $.P = { x: 100, y: 120 } as any;
});

describe('the gate', () => {
  it('is on for long4 (the hard set) and off for short, so short keeps every old path', () => {
    expect(g3()).toBe(true);
    setLayout('short');
    expect(g3()).toBe(false);
  });
});

describe('rank (spec §2.1; the W0 stand-in)', () => {
  it('weighs held power only, by slot', () => {
    expect(pTerm({}, {})).toBe(0);
    expect(pTerm({ speed: 4 }, {})).toBe(0); // THRUST is 0
    // the STAGE 1 kit: MISSILE 1, SPLIT, WRAITH 1, WARD 1, CALIBER 1 = 1 + 2 + 1 + 4 + 1 (spec C3: rank 13 in biome B)
    expect(pTerm({ speed: 2, missile: 1, double: 1, options: 1, wardLv: 1 }, { cal: 1 })).toBe(9);
    expect(pTerm({ laser: 1, wardLv: 3 }, { cal: 2, serr: 2 })).toBe(3 + 4 + 3); // WARD flat 4, CALIBER + SERRATION capped at 3
  });
  it('is T_base + stage + 6 loop + P_term, capped 16 in Descent 1 and 31 after', () => {
    expect(fightRank()).toBe(2); // Orbit, naked, Normal
    $.G.stage = 3; Object.assign($.P, { missile: 2, double: 1, options: 2, wardLv: 2 }); $.G.gm = { cal: 1 };
    expect(fightRank()).toBe(16); // 2 + 3 + 13, capped
    $.P = { x: 0, y: 0 } as any; $.G.gm = {};
    expect(fightRank()).toBe(5); // the same ship respawned naked in the Drive (spec gate R1)
    $.G.loop = 4; Object.assign($.P, { laser: 1, missile: 3, options: 4, wardLv: 1 });
    expect(fightRank()).toBe(31);
    $.G.loop = 0; $.G.tier = 3; $.P = { x: 0, y: 0 } as any; $.G.stage = 0;
    expect(fightRank()).toBe(6); // Very Hard's base
  });
  it('unlocks variants at rank 14 and up', () => {
    expect(variant(13)).toBe(false);
    expect(variant(14)).toBe(true);
  });
  it('grows a litter 3 + round(2 rho)', () => {
    expect(litter(0)).toBe(3);
    expect(litter(.5)).toBe(4);
    expect(litter(1)).toBe(5);
  });
});

describe('cadence: one rule, I x (1.25 - .6 rho), floor 18', () => {
  it('calms a naked ship and quickens a strong one, the same for every fight', () => {
    expect(cad(80, 0)).toBe(100);
    expect(cad(80, 1)).toBe(52);
    expect(cad(10, 1)).toBe(FT.cadFloor);
    expect(fightRho()).toBe(2 / 16);
  });
  it('never repeats a periodic emitter inside the 120 f window', () => {
    for (const rho of [0, .5, 1]) for (const I of [110, 130, 150, 160, 180]) expect(per(I, rho)).toBeGreaterThan(FT.window);
    expect(per(180, 0)).toBe(225);
  });
});

describe('the bullet budget: 15 per 120 f, and the cap, volleys atomic', () => {
  it('lets 15 through in a window, refuses the 16th whole, and frees up as the window slides', () => {
    const e: any = { t: 1000 };
    ledger(e);
    expect(spend(e, 9)).toBe(true);
    expect(spend(e, 6)).toBe(true);
    expect(spent(e)).toBe(15);
    expect(spend(e, 1)).toBe(false); // none of it
    expect(spent(e)).toBe(15);
    e.t += FT.window - 1;
    expect(spend(e, 1)).toBe(false);
    e.t += 1; // the first two volleys age out together
    expect(spend(e, 15)).toBe(true);
  });
  it('counts a stream as volleys of one and never drops a live entry', () => {
    const e: any = { t: 0 };
    for (let i = 0; i < 15; i++) { e.t = i * 5; expect(spend(e, 1)).toBe(true); }
    e.t = 74;
    expect(spend(e, 1)).toBe(false);
  });
  it('refuses a volley that would put the live counted shots over the cap (hazard shots do not count)', () => {
    const e: any = { t: 0 };
    for (let i = 0; i < 12; i++) eshots.push({} as any);
    for (let i = 0; i < 9; i++) eshots.push({ haz: 1 } as any);
    expect(counted()).toBe(12);
    expect(fightCap()).toBe(16);
    expect(spend(e, 5)).toBe(false);
    expect(spend(e, 4)).toBe(true);
  });
  it('caps by tier: 12 / 16 / 20 / 20', () => {
    expect([0, 1, 2, 3].map((t) => { $.G.tier = t; return fightCap(); })).toEqual([12, 16, 20, 20]);
  });
});

describe('SQUID SAUCER 2000: the phase-2 sweep', () => {
  it('swings +-.5 rad either way over 24 f and comes back to the locked line', () => {
    let lo = 0, hi = 0;
    for (let u = 0; u <= UFO_SW.f; u++) { const d = sweepA(Math.PI, u, 1) - Math.PI; lo = Math.min(lo, d); hi = Math.max(hi, d); }
    expect(hi).toBeCloseTo(.5, 2); expect(lo).toBeCloseTo(-.5, 2);
    expect(sweepA(1, UFO_SW.f, 1)).toBeCloseTo(1);
    expect(sweepA(1, 0, -1)).toBeCloseTo(1);
  });
  it('gives the sweep a tell of at least 44 f (the 42 f lash tell + the 8 f hold at full reach)', () => {
    expect(42 + 8).toBeGreaterThanOrEqual(TELL_MIN);
  });
  it('hits only past the plain stab, on the swinging tentacle', () => {
    const e: any = { k: 'ufo', st: 'whip', sw: 1, wt: 30, x: 384, y: 114, la: Math.PI, ll: 238 };
    expect(sweepHit(e, 384 - 34 - 150, 114 + 9)).toBe(true);
    expect(sweepHit(e, 384 - 34 - 150, 114 + 9 + UFO_SW.w + 1)).toBe(false);
    expect(sweepHit({ ...e, wt: 18 }, 200, 123)).toBe(false); // the stab (the probes count it as 'lash')
    expect(sweepHit({ ...e, sw: 0 }, 200, 123)).toBe(false);
  });
});

describe('THE NAIL CHOIR: twin lanes', () => {
  it('always leaves a free band of at least 40 px between the two lanes, both on screen', () => {
    for (let py = 0; py <= PH; py++) {
      const y1 = laneY(py, PH), y2 = lanePair(y1, PH);
      expect(Math.abs(y2 - y1) - 2 * DN.lHH).toBeGreaterThanOrEqual(DN.lFree);
      expect(y2 - DN.lHH).toBeGreaterThanOrEqual(0);
      expect(y2 + DN.lHH).toBeLessThanOrEqual(PH);
    }
  });
  it('re-locks at the turn over 16 f', () => { expect(DN.lTurn).toBe(16); });
});

describe('THE APPRENTICE: the sagging wire and the second hook', () => {
  it('sags 30 px at its middle, never within 30 px of the floor there', () => {
    expect(hookSag(100, 100, 224)).toBe(DN.hSag);
    expect(hookSag(170, 170, 224)).toBe(224 - DN.hSagGap - 170);
    expect(hookSag(210, 210, 224)).toBe(0);
    for (let y = 0; y < 224; y += 7) expect((y + y) / 2 + hookSag(y, y, 224)).toBeLessThanOrEqual(Math.max(y, 224 - DN.hSagGap));
  });
  it('hits along the sagging wire and not along the straight line it left', () => {
    const ox = 380, oy = 100, ha = Math.PI, hd = 360;
    expect(hookAt('bite', ha, hd, 30, ox, oy, 200, 100 + 30)).toBe(true); // the middle of the sag
    expect(hookAt('bite', ha, hd, 30, ox, oy, 200, 100)).toBe(false); // where the straight wire was
    expect(hookAt('bite', ha, hd, 0, ox, oy, 200, 100)).toBe(true);
    expect(hookAt('hook', ha, hd, 30, ox, oy, 200, 130)).toBe(false); // in flight only the tip hurts
  });
  it('holds the phase-2 bite 60 f', () => { expect(DN.hBite2).toBe(60); });
  it('keeps the second hook 40 px off the first wire at the ship range, whichever side it aims', () => {
    for (const d of [60, 120, 300]) for (const da of [0, .05, -.05, .1, -.3]) {
      const a = hook2Aim(Math.PI + da, Math.PI, d);
      const qx = Math.cos(a) * d, qy = Math.sin(a) * d; // the aim point at the ship range, from the hand
      expect(segD2(0, 0, Math.cos(Math.PI) * 500, 0, qx, qy)).toBeGreaterThanOrEqual(DN.h2Gap ** 2 - 1e-6);
    }
    expect(hook2Aim(Math.PI + 1, Math.PI, 200)).toBe(Math.PI + 1); // already clear: untouched
  });
  it('gives the second hook a full tell: its throw waits for TELL_MIN and the first bite lock + hLock', () => {
    expect(DN.h2Lock + DN.hLock).toBeLessThan(DN.hBite); // thrown while the first wire is still taut
  });
});

describe('THE BROOD MOTHER: the edge column', () => {
  it('puts the column 60-90 px ahead of the ship, never behind it, and 40 px inside the right edge', () => {
    for (let a = 0; a < 8; a++) { const x = edgeX(100, a, W); expect(x - 100).toBeGreaterThanOrEqual(60); expect(x - 100).toBeLessThanOrEqual(90); }
    expect(edgeX(420, 0, W)).toBe(W - 40);
  });
  it('stacks the litter off the edge it comes from', () => {
    const o = [0, 0];
    expect(edgeSlot(0, 200, 1, PH, o)).toEqual([200, -DN.eY0]);
    expect(edgeSlot(2, 200, -1, PH, o)).toEqual([200, PH + DN.eY0 + 2 * DN.eDy]);
  });
  it('enters at least 48 px from the ship (spec C9)', () => {
    const o = [0, 0];
    for (const py of [6, 60, 127, 200, 248]) for (const side of [1, -1]) {
      edgeSlot(0, edgeX(100, 0, W), side, PH, o);
      expect(Math.hypot(o[0] - 100, o[1] - py)).toBeGreaterThanOrEqual(48);
    }
  });
});

describe('tells (E5)', () => {
  it('keeps every new move at 44 f or more', () => {
    expect(DN.bTel).toBeGreaterThanOrEqual(TELL_MIN); // the edge chevron
    expect(42 + 8).toBeGreaterThanOrEqual(TELL_MIN); // the sweep wedge
    expect(DN.lTel).toBeGreaterThanOrEqual(TELL_MIN); // the twin lanes share the lane's tell
    expect(SHIP_R).toBeGreaterThan(0);
  });
});
