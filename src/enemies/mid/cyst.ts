// @ts-nocheck
// THE DISSOLVING WOMB (acid home): a melting sac on the lake. Art: render/gross/mid/cyst.ts
// Its picker row (name, tag, pool) is in ./roster.ts. Moved verbatim from update.ts's switch (LS2-0).
// Its SPACE denial (D61, ./_deny.ts): a spray glob that strikes the floor or ceiling plants an acid pool that lingers.
import { $ } from '../../state';
import { PH, R, rr } from '../../core';
import { sfx } from '../../audio';
import { ceilAt, eshots, floorAt, geysers } from '../../world';
import { drop, spark } from '../../fx/spawn';
import { cdm } from '../../depth';
import { playerHit } from '../../player';
import { BS, aimA, eshoot, ring } from '../spawn';
import { bandFit, lob, midLeave } from '../update';
import { HOST_SPARK, isCross, midPh2 } from '../midhost';
import { DN, agePools, eruptStage, plantPool, poolHit, poolReach } from './_deny';
import { defineMid } from './roster';
import { FT, RING_V, cad, entered, g3, ledger, lurch, opening, spend, variant } from './_fight';

/** DIFFICULTY-SPEC §2.3 (W4a), long4 only: the Womb's numbers. Each with its tag and the gate that measures it */
export const WOMB = {
  /** phase-2 spray: 7 lobs (wt 5..35), not 8, so spray + ring = 15 in a 120 f window [DER from the brief's 15 / 120 f
   *  budget; B3 midboss-probe max] (phase 1 keeps its 5, wt 5..25) */
  spray: [28, 35] as readonly number[],
  /** the ring: 8 in both phases (spec: 10 / 14 -> 8) [B3] */
  ring: 8,
  /** ...at ringV (was 1.05; _fight.ts RING_V): one spoke aimed, it reaches a parked ship across the cave inside the phase [K1] */
  ringV: RING_V,
  /** the ceiling lob: rise this much faster than the slowest throw that reaches the ceiling, so it strikes on the way
   *  up (lobUp) */
  upK: 1.15, upAdd: .3,
  /** where each lob of a spray lands, px from the ship's x, centre first: the first pool sits under the ship and the next
   *  four feed it (DN.plMerge 30), so its column stands where the ship is; phase 2's outer two plant pools of their own.
   *  Its R() draws are kept (the old jitter's), so a spray draws as many as before [K1 midboss-probe --spots] */
  comb: [0, 0, 14, -14, 28, -28, 42] as readonly number[], // [0] is the aimed glob's slot (li 1); the first surface pool lands under the ship
} as const;

/** a glob thrown up from (x, y) that strikes (tx, ty) ABOVE it on the way up (the glob falls .025/f; shots.ts). The
 *  shot's speed is divided by BS() so the real path is exact, as lob() does */
function lobUp(x, y, tx, ty) {
  const h = Math.max(4, y - ty), u = Math.sqrt(.05 * h) * WOMB.upK + WOMB.upAdd, t = (u - Math.sqrt(Math.max(0, u * u - .05 * h))) / .025;
  const vx = (tx - x) / Math.max(1, t);
  eshoot(x, y, Math.atan2(-u, vx), Math.hypot(vx, u) / BS(), 'glob');
}
/** g3: the spray's lob, alternating by attack (e.sd 1 floor, -1 ceiling: spec §2.3, so the pools take both edge lanes).
 *  Three R() draws, as the old lob, whatever the side */
function sprayLob(e) {
  const jx = rr(-36, 36), jy = rr(-20, 20), vy = rr(1.3, 1.8), tx = $.P.x + WOMB.comb[Math.min(WOMB.comb.length - 1, e.li++ || 0)], wx = tx + $.G.scroll, c = ceilAt(wx), f = floorAt(wx);
  void jx;
  if (e.li === 1) lob(e.x - 2, e.y - 20, $.P.x, $.P.y, Math.max(vy, Math.sqrt(Math.max(0, .05 * (e.y - 20 - $.P.y))) + .45)); // the first glob of a spray at the ship itself (it pools wherever it lands); the rest pool on the surfaces [K1]
  else if (e.sd < 0 && c > 2 && c < e.y - 30) lobUp(e.x - 2, e.y - 20, tx, c); // the ceiling, when there is one above it
  else if (f < PH + 2) lob(e.x - 2, e.y - 20, tx, f, vy); // the floor
  else lob(e.x - 2, e.y - 20, tx, $.P.y + jy, vy); // open space below: at the ship, as before
}

/** a spray glob's land hook (shots.ts updateEShots, sim side, no R()): where it strikes, a pool */
function cystLand(s) {
  const e = s.cy;
  if (!e || e.dead || e.gone) return;
  const wx = s.x + $.G.scroll, f = floorAt(wx), c = ceilAt(wx), side = s.y >= f ? 1 : -1, y = side > 0 ? f : c;
  if (y > PH + 2 || y < -2) return; // open space: nothing to pool on
  plantPool(e, wx, y, side, e.t, poolCap(midPh2(e)), poolReach(Math.min(PH, f) - Math.max(0, c)));
}

// g3 (DIFFICULTY-SPEC §2.3): the one rank rule, cad() (no pow term, no dial); short keeps its old line (layout parity)
const cool = (ph2) => g3() ? cad(ph2 ? 55 : 80) : Math.round((ph2 ? 55 : 80) * (1 - .3 * ($.G.rank || 0)) * cdm());
/** live pools at once: DN.plN (phase 2 plN2), one more at rank >= 14 on long4 (spec §2.3 variant: not more lobs) */
export const poolCap = (ph2) => (ph2 ? DN.plN2 : DN.plN) + (g3() && variant() ? 1 : 0);

function updCyst(e) {
  // THE DISSOLVING WOMB: a melting sac on the lake. Bubbles 45f, then geysers a rain of globs lobbed onto you; or bloats 30f and bursts a ring
  const go = midLeave(e), ph2 = midPh2(e), cx = isCross(e), G3 = g3();
  e.y = PH * .6 + Math.sin(e.t * .016) * (PH * .13); // tuned to sit on the acid lake; a crossover fits the host's cave
  if (cx) bandFit(e);
  if (!go && entered(e) && $.P.alive) {
    e.wt++;
    if (lurch(e, ph2)) e.att = 2; // g3: phase 2 opens on the swell (its aimed ring)
    if (e.st === 'idle') {
      e.sw = Math.max(0, (e.sw || 0) - 1.5);
      if (e.wt >= e.cool) { e.att++; e.st = e.att % 3 ? 'tel' : 'swell'; e.wt = 0; e.st === 'tel' ? sfx.tele() : sfx.squish(); if (e.st === 'tel') e.sd = -(e.sd || -1); } // g3: floor, ceiling, floor...
    } else if (e.st === 'tel') {
      if (R() < .6) spark(e.x + rr(-6, 6), e.y - 18, rr(-.3, .3), -rr(.8, 2), 14, '#7ff0d8');
      if (e.wt >= 45) { e.st = 'spray'; e.wt = 0; e.li = 0; geysers.push({ wx: 0, y: 0, att: e, ox: -2, oy: -19, a: -Math.PI / 2, l: ph2 ? 44 : 32, rate: 4, c: 2 }); }
    } else if (e.st === 'spray') {
      if (e.wt % 5 === 0 && (!G3 || spend(e, 1))) { // g3: a stream, each lob a volley of one; no room, no lob
        const n = eshots.length;
        if (G3) sprayLob(e);
        else lob(e.x - 2, e.y - 20, $.P.x + rr(-36, 36), $.P.y + rr(-20, 20), rr(1.3, 1.8));
        if (eshots.length > n) { eshots[n].cy = e; eshots[n].land = cystLand; } // it pools where it strikes
      }
      if (e.wt >= (G3 ? WOMB.spray[ph2 ? 1 : 0] : ph2 ? 40 : 28)) { e.st = 'idle'; e.wt = 0; e.cool = cool(ph2); }
    } else if (e.st === 'swell') {
      e.sw = e.wt;
      if (e.wt >= 30 && G3 && !spend(e, WOMB.ring)) e.wt = 29; // g3: the ring waits for room (all 8 or none)
      else if (e.wt >= 30) {
        ring(e.x, e.y, G3 ? WOMB.ring : ph2 ? 14 : 10, G3 ? aimA(e.x, e.y) : e.t * .07, G3 ? WOMB.ringV : 1.05); // g3: one spoke on the ship (E8: a parked ship in the middle meets it)
        for (let k = 0; k < 20; k++) drop(e.x, e.y, rr(-2, 2), rr(-2, 2), 1.5, 2, 70);
        sfx.glob();
        e.st = 'idle'; e.wt = 0; e.cool = G3 && !e.op ? FT.open : cool(ph2); e.op = 1; // g3: the opening ring, then the first spray at once (its slow moves need the time: K1)
      }
    }
  }
  // the pools: they dry on their own clocks, and burn whoever sits in one (they outlive a withdraw until it is gone)
  agePools(e, e.t);
  for (let i = 0; i < e.pn; i++) { // an eruption: the boil's first frame hisses, the column's first frame gushes
    const a = e.t - e.pT[i], er = eruptStage(a), was = eruptStage(a - 1);
    if (er !== was && er === 1) sfx.squish();
    if (er !== was && er === 2) { sfx.glob(); for (let k = 0; k < 8; k++) drop(e.pX[i] - $.G.scroll + rr(-5, 5), e.pY[i] - e.pS[i] * e.pR[i], rr(-1.2, 1.2), -e.pS[i] * rr(0, 1.5), 1.3, 2, 50); }
  }
  if ($.P.alive && e.pn && poolHit(e, $.G.scroll, $.P.x, $.P.y)) playerHit();
  if (R() < .35) drop(e.x + rr(-14, 14), e.y + rr(8, 20), rr(-.2, .2), rr(.3, .9), 1.3, R() < .6 ? 2 : 4, 80);
  if (R() < .08) spark(e.x + rr(-16, 16), e.y - rr(0, 14), 0, -rr(.3, .8), 20, cx ? HOST_SPARK[e.host][e.t % HOST_SPARK[e.host].length] : '#a6ff2a'); // no extra R() for the colour
}

defineMid('cyst', {
  et: { hp: 135, r: 21, gsz: 4, score: 6000, bio: 70, half: 1, amnio: 1, eyes: 2, teeth: 6, big: 1, mini: 1, mid: 1 },
  word: 'BURST',
  onSpawn: (e) => { e.pn = 0; e.pX = [0, 0, 0, 0, 0, 0, 0, 0]; e.pY = [0, 0, 0, 0, 0, 0, 0, 0]; e.pS = [0, 0, 0, 0, 0, 0, 0, 0]; e.pT = [0, 0, 0, 0, 0, 0, 0, 0]; e.pR = [0, 0, 0, 0, 0, 0, 0, 0]; e.sd = -1; if (g3()) { ledger(e); opening(e); e.att = 2; } }, // room for DN.plN2 + 1. g3: the swell (its ring) comes first
  update: updCyst,
});
