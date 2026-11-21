// The midbosses' area denial (D61 Pass 1): the pure rules in src/enemies/mid/_deny.ts. D59's fairness rules hold for every
// move: a tell of at least 44 f, and a gap the ship can always reach (the lane, the pools' columns, the litter's rows).
import { describe, expect, it } from 'vitest';
import { DN, LP, SHIP_R, TELL_MIN, agePools, broodLane, denyHit, denyPts, eruptStage, hookHit, laneHit, laneY, plantPool, poolHit, poolReach, poolStage, rearSlot, segD2 } from '../../src/enemies/mid/_deny';

const PH = 254, MIN_CAVE = 108; // the playfield's height, and the narrowest corridor a midboss fights in (roster.ts fit)
const pools = (t = 0) => ({ t, pn: 0, pX: Array(8).fill(0), pY: Array(8).fill(0), pS: Array(8).fill(0), pT: Array(8).fill(0), pR: Array(8).fill(0) });

describe('the tells (D59: at least 44 f)', () => {
  it('gives every new threat a tell of at least TELL_MIN frames', () => {
    expect(TELL_MIN).toBe(44);
    for (const t of [DN.lTel, DN.plArm, DN.plErTel, DN.hTel, DN.bTel]) expect(t).toBeGreaterThanOrEqual(TELL_MIN);
  });
  it('locks the hook a readable while before it is thrown, after tracking for most of the tell', () => {
    expect(DN.hLock).toBeGreaterThanOrEqual(16);
    expect(DN.hTel - DN.hLock).toBeGreaterThanOrEqual(30);
  });
  it('flies the Choir bar to the lane inside its tell, so it trembles in place before the sweep', () => {
    expect(DN.lFly).toBeLessThan(DN.lTel - 16);
  });
});

describe('segD2', () => {
  it('measures to the nearest point of the segment, ends included', () => {
    expect(segD2(0, 0, 10, 0, 5, 3)).toBeCloseTo(9);
    expect(segD2(0, 0, 10, 0, -4, 3)).toBeCloseTo(25);
    expect(segD2(0, 0, 10, 0, 13, 4)).toBeCloseTo(25);
    expect(segD2(2, 2, 2, 2, 5, 6)).toBeCloseTo(25); // a point segment
  });
});

describe('THE NAIL CHOIR lane', () => {
  it('locks on the ship but keeps the whole bar on screen', () => {
    expect(laneY(120, PH)).toBe(120);
    expect(laneY(2, PH)).toBe(DN.lHH + 4);
    expect(laneY(PH, PH)).toBe(PH - DN.lHH - 4);
  });
  it('leaves most of the narrowest cave open: the lane is under a third of it', () => {
    expect(2 * (DN.lHH + SHIP_R)).toBeLessThan(MIN_CAVE / 3);
  });
  it('hits only while the bar sweeps, and only on the bar', () => {
    const e = { lp: LP.tel, lx: 200, ly: 100 };
    expect(laneHit(e, 200, 100)).toBe(false); // the tell never hurts
    e.lp = LP.out;
    expect(laneHit(e, 200, 100 + DN.lHH)).toBe(true);
    expect(laneHit(e, 200, 100 + DN.lHH + SHIP_R + 1)).toBe(false); // just off the lane
    expect(laneHit(e, 200 + DN.lHW + SHIP_R + 1, 100)).toBe(false); // on the lane, not yet reached
    e.lp = LP.back;
    expect(laneHit(e, 198, 96)).toBe(true);
    e.lp = LP.home;
    expect(laneHit(e, 200, 100)).toBe(false);
  });
  it('sweeps the whole width: off the left edge, then back', () => {
    expect(DN.lEnd).toBeLessThan(-DN.lHW - SHIP_R);
    expect(DN.lSp).toBeGreaterThan(0);
    expect(DN.lBack).toBeGreaterThan(0);
  });
  it('spits a column of nails as tall as the bar when no bar is left', () => {
    expect((DN.lSpikes - 1) * DN.lSpikeDy).toBeGreaterThanOrEqual(2 * DN.lHH - 8);
    expect((DN.lSpikes - 1) * DN.lSpikeDy).toBeLessThanOrEqual(2 * DN.lHH);
  });
});

describe('THE DISSOLVING WOMB pools', () => {
  it('fizzes harmless for its tell, burns, dries harmless, then is gone', () => {
    expect(poolStage(0)).toBe(0);
    expect(poolStage(DN.plArm - 1)).toBe(0);
    expect(poolStage(DN.plArm)).toBe(1);
    expect(poolStage(DN.plArm + DN.plLive - 1)).toBe(1);
    expect(poolStage(DN.plArm + DN.plLive)).toBe(2);
    expect(poolStage(DN.plArm + DN.plLive + DN.plDry)).toBe(-1);
  });
  it('plants up to its cap, then replaces the oldest', () => {
    const e = pools();
    for (let i = 0; i < DN.plN; i++) plantPool(e, 100 + i * 60, 230, 1, i, DN.plN, 80);
    expect(e.pn).toBe(DN.plN);
    const slot = plantPool(e, 900, 230, 1, 50, DN.plN, 80);
    expect(slot).toBe(0); // planted at t 0: the oldest
    expect(e.pn).toBe(DN.plN);
    expect(e.pX[0]).toBe(900);
  });
  it('feeds a near pool on the same side instead of stacking a second one', () => {
    const e = pools();
    plantPool(e, 100, 230, 1, 0, DN.plN, 80);
    const t = DN.plArm + 5; // burning, not yet erupting
    expect(eruptStage(t)).toBe(0);
    plantPool(e, 100 + DN.plMerge - 1, 230, 1, t, DN.plN, 80);
    expect(e.pn).toBe(1);
    expect(e.pT[0]).toBe(t - DN.plArm); // its burn starts over
    plantPool(e, 100, 20, -1, t, DN.plN, 80); // the ceiling is another pool
    expect(e.pn).toBe(2);
  });
  it('never cuts a tell short when a glob feeds a fizzing or erupting pool', () => {
    const e = pools();
    plantPool(e, 100, 230, 1, 0, DN.plN, 80);
    plantPool(e, 100, 230, 1, 10, DN.plN, 80); // fizzing
    expect(e.pT[0]).toBe(0);
    const er = DN.plArm + DN.plEr0 + 5; // boiling
    expect(eruptStage(er)).toBe(1);
    plantPool(e, 100, 230, 1, er, DN.plN, 80);
    expect(e.pT[0]).toBe(0);
  });
  it('drops dried pools and keeps the rest in order', () => {
    const e = pools();
    plantPool(e, 100, 230, 1, 0, 8, 80);
    plantPool(e, 300, 230, 1, 200, 8, 80);
    agePools(e, DN.plArm + DN.plLive + DN.plDry + 1);
    expect(e.pn).toBe(1);
    expect(e.pX[0]).toBe(300);
  });
  it('burns the ship on the skin (floor and ceiling), only while burning', () => {
    const e = pools();
    plantPool(e, 300, 230, 1, 0, DN.plN, 80);
    plantPool(e, 100, 20, -1, 0, DN.plN, 80);
    e.t = 10;
    expect(poolHit(e, 0, 300, 225)).toBe(false); // fizzing: the tell
    e.t = DN.plArm + 1;
    expect(poolHit(e, 0, 300, 225)).toBe(true);
    expect(poolHit(e, 50, 250, 225)).toBe(true); // screen x is world x less the scroll
    expect(poolHit(e, 0, 300, 230 - DN.plH - SHIP_R - 1)).toBe(false); // above the fumes, not erupting
    expect(poolHit(e, 0, 300 + DN.plHW + SHIP_R, 225)).toBe(false);
    expect(poolHit(e, 0, 100, 30)).toBe(true); // the ceiling pool hangs down
  });
  it('erupts on its own clock: a boil (the tell) then the column, then rest, while it burns', () => {
    const a0 = DN.plArm + DN.plEr0;
    expect(eruptStage(a0 - 1)).toBe(0);
    expect(eruptStage(a0)).toBe(1);
    expect(eruptStage(a0 + DN.plErTel - 1)).toBe(1);
    expect(eruptStage(a0 + DN.plErTel)).toBe(2);
    expect(eruptStage(a0 + DN.plErTel + DN.plErLive)).toBe(0);
    expect(eruptStage(a0 + DN.plEvery)).toBe(1);
    expect(eruptStage(DN.plArm + DN.plLive + 1)).toBe(0); // drying: no more
    expect(DN.plErTel + DN.plErLive).toBeLessThan(DN.plEvery);
  });
  it('hits in the column only while it stands, and never past its reach', () => {
    const e = pools();
    plantPool(e, 300, 230, 1, 0, DN.plN, 100);
    const y = 230 - 60;
    e.t = DN.plArm + DN.plEr0 + 10; // boiling
    expect(poolHit(e, 0, 300, y)).toBe(false);
    e.t = DN.plArm + DN.plEr0 + DN.plErTel + 1; // standing
    expect(poolHit(e, 0, 300, y)).toBe(true);
    expect(poolHit(e, 0, 300 + DN.plCW + SHIP_R, y)).toBe(false);
    expect(poolHit(e, 0, 300, 230 - 100 - SHIP_R - 1)).toBe(false);
  });
  it('leaves the far side of every cave open: the column reaches at most plReach of it', () => {
    for (const gap of [MIN_CAVE, 160, 220, 254]) {
      expect(gap - poolReach(gap)).toBeGreaterThanOrEqual(.4 * gap - 1e-9);
      expect(gap - poolReach(gap)).toBeGreaterThan(40);
    }
    expect(poolReach(500)).toBe(DN.plRMax);
  });
  it('leaves floor between pools: a full set covers under half the screen width', () => {
    expect(DN.plN2 * 2 * (DN.plHW + SHIP_R)).toBeLessThan(480 / 2);
  });
});

describe("THE APPRENTICE's hook", () => {
  const hk = (st: string, hd: number) => ({ st, hd, ha: Math.PI, x: 400, y: 120 });
  it('does nothing on the tell', () => {
    expect(hookHit(hk('htel', 0), 400 + DN.hOx - 50, 120 + DN.hOy)).toBe(false);
  });
  it('hits with its tip in flight, not along the chain behind it', () => {
    const e = hk('hook', 200), tx = 400 + DN.hOx - 200, ty = 120 + DN.hOy;
    expect(hookHit(e, tx, ty)).toBe(true);
    expect(hookHit(e, tx + 100, ty)).toBe(false);
  });
  it('makes the taut chain a wire while it bites and reels, and the bitten tip is the wire end', () => {
    const e = hk('bite', 300), ox = 400 + DN.hOx, oy = 120 + DN.hOy;
    expect(hookHit(e, ox - 150, oy + DN.hW)).toBe(true);
    expect(hookHit(e, ox - 150, oy + DN.hW + SHIP_R + 1)).toBe(false);
    e.st = 'reel';
    expect(hookHit(e, ox - 150, oy)).toBe(true);
    expect(hookHit(e, ox - 300, oy)).toBe(true); // the reeling tip
  });
  it('is harmless once it is home (hd 0), whatever the state says', () => {
    expect(hookHit(hk('reel', 0), 400 + DN.hOx, 120 + DN.hOy)).toBe(false);
  });
  it('reaches across the whole screen', () => {
    expect(DN.hMax).toBeGreaterThan(480);
  });
});

describe('THE BROOD MOTHER litter from behind', () => {
  it('keeps the lane inside the screen', () => {
    expect(broodLane(0, PH)).toBe(DN.bEdge);
    expect(broodLane(PH, PH)).toBe(PH - DN.bEdge);
    expect(broodLane(130, PH)).toBe(130);
  });
  it('brings the litter in off the left edge in rows of three around the lane, each further back', () => {
    const o = [0, 0], ys = new Set<number>();
    let x = Infinity;
    for (let i = 0; i < 7; i++) { rearSlot(i, 120, o); expect(o[0]).toBeLessThan(0); expect(o[0]).toBeLessThan(x); x = o[0]; ys.add(o[1]); }
    expect([...ys].sort((a, b) => a - b)).toEqual([120 - DN.bDy, 120, 120 + DN.bDy]);
  });
  it('leaves room to get out of the litter: its band is under half the narrowest cave', () => {
    const band = 2 * (DN.bDy + 5 + 4); // rows bDy apart, a hatchling's r 5, the body contact's +4
    expect(band).toBeLessThan(MIN_CAVE / 2);
  });
});

describe('denyPts and denyHit (the probes and the pilot)', () => {
  it('names the move that would hit and gives the pilot circles for it', () => {
    const c = { k: 'choir', lp: LP.out, lx: 200, ly: 100 };
    expect(denyHit(c, 0, 200, 100)).toBe('lane');
    expect(denyPts(c, 0).length).toBeGreaterThan(0);
    const p = { k: 'prentice', st: 'bite', hd: 200, ha: Math.PI, x: 400, y: 120 };
    expect(denyHit(p, 0, 400 + DN.hOx - 100, 120 + DN.hOy)).toBe('hook');
    expect(denyPts(p, 0).some((q: any) => q.k === 'chain')).toBe(true);
    const w = pools(DN.plArm + 1);
    Object.assign(w, { k: 'cyst' });
    plantPool(w, 300, 230, 1, 0, DN.plN, 80);
    expect(denyHit(w, 0, 300, 225)).toBe('pool');
    expect(denyPts(w, 0).some((q: any) => q.k === 'pool')).toBe(true);
    expect(denyHit({ k: 'brood' }, 0, 0, 0)).toBe('');
    expect(denyHit(null, 0, 0, 0)).toBe('');
  });
});
