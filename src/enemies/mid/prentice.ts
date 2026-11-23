// @ts-nocheck
// THE BUTCHER'S APPRENTICE (fire home): a small carcass on one chain with a cleaver. Art: render/gross/mid/prentice.ts
// Its picker row (name, tag, pool) is in ./roster.ts. Moved verbatim from update.ts's switch (LS2-0).
// Its RANGE denial (D61, ./_deny.ts): every third attack a chain hook thrown the full width of the screen. It mirrors the
// Butcher's hook (enemies/update.ts 'htel'/'hook') in its own code: tracked then locked, out until it strikes, then it
// bites and holds with the chain taut (a wire across the screen), then reels in.
import { $ } from '../../state';
import { FIRE, PH, R, TAU, W, clamp, dist2, lerp, pick, ri, rr } from '../../core';
import { ceilAt, floorAt } from '../../world';
import { sfx } from '../../audio';
import { drop, spark } from '../../fx/spawn';
import { cdm } from '../../depth';
import { aimA, every, fan, ring, wrapA } from '../spawn';
import { playerHit } from '../../player';
import { bandFit, midLeave } from '../update';
import { HOST_SPARK, isCross, midPh2 } from '../midhost';
import { DN, TELL_MIN, hook2Aim, hookHit, hookSag } from './_deny';
import { defineMid } from './roster';
import { RING_V, cad, entered, ev, g3, ledger, lurch, opening, ringA, spend, spendP, variant } from './_fight';

// g3 (DIFFICULTY-SPEC §2.3): the one rank rule, cad() (no pow term, no dial); short keeps its old line (layout parity)
const cool = (ph2) => g3() ? cad(ph2 ? 50 : 75) : Math.round((ph2 ? 50 : 75) * (1 - .3 * ($.G.rank || 0)) * cdm());
/** DIFFICULTY-SPEC §2.3 (W4a), long4 only. Each with its tag and the gate that measures it */
export const APP = {
  /** the spit: ONE fan at wt spitF (was two, at 24 and 38) of 5 (phase 2: 7) [spec §2.3; B3] */
  spitF: 30, spit: [5, 7] as readonly number[],
  /** the phase-2 ring: 8 every 150 x cadence (was 10 every 120), never two inside the 120 f window [spec §2.3; B3] */
  ring: 8, ringI: 150,
  /** the cleaver's tell (50 f): the cone follows the ship (x and y) until cutLock, then its spot is LOCKED for the last
   *  50 - cutLock f and the body glides onto it (arriving on the cut's frame), so the cone the player sees is the one that
   *  swings. Before (and on short) its x chased the ship to the last frame: a cone 64 px ahead that a ship could not leave
   *  sideways, the one way out a 63 px climb in 25 f (W6: the mortal pilot's top killer, 12-13 deaths per 10 runs).
   *  25 f locked >= the 16 f lock every aimed move keeps (the hook's hLock); 28 px clears it at 2.09 px/f in 14 f */
  cutLock: 25,
} as const;
/** the cleaver's tell is locked: long4 only (short keeps the chasing cone, layout parity) */
export const cutLocked = (e) => g3() && e.st === 'tel' && e.wt >= APP.cutLock;
/** the bite's hold: DN.hBite, DN.hBite2 in phase 2 on long4 (spec: 44 -> 60) */
const biteF = (ph2) => (g3() && ph2 ? DN.hBite2 : DN.hBite);
/** the wire's sag for a hook at angle a, hd out, from (ox, oy): DN.hSag in phase 2 on long4 (hookSag keeps it clear of the floor), else 0 */
function sagOf(ph2, ox, oy, a, hd) {
  if (!(g3() && ph2) || !(hd > 0)) return 0;
  const tx = ox + Math.cos(a) * hd, ty = oy + Math.sin(a) * hd;
  return hookSag(oy, ty, floorAt((ox + tx) / 2 + $.G.scroll));
}

/** g3 rank >= 14 (spec §2.3 variant): the SECOND hook, one frame. Its tell starts as the first is thrown and tracks the
 *  ship, held DN.h2Gap off the first's wire at the ship's range (hook2Aim); it locks DN.h2Lock into the first's bite and
 *  throws DN.hLock after, never before TELL_MIN from its own tell's start, with the first's wire still taut */
function hook2(e, ph2, ox, oy) {
  e.wt2++;
  if (e.st2 === 'htel') {
    const locked = e.st === 'bite' && e.wt >= DN.h2Lock;
    if (!locked) {
      e.ha2 += wrapA(aimA(ox, oy) - e.ha2) * DN.hTrack;
      e.ha2 = hook2Aim(e.ha2, e.ha, Math.hypot($.P.x - ox, $.P.y - oy));
    }
    if (locked && e.wt >= DN.h2Lock + DN.hLock && e.wt2 >= TELL_MIN) { e.st2 = 'hook'; e.wt2 = 0; e.hd2 = 10; sfx.lash(); }
  } else if (e.st2 === 'hook') {
    e.hd2 += DN.hSp;
    const tx = ox + Math.cos(e.ha2) * e.hd2, ty = oy + Math.sin(e.ha2) * e.hd2, wx = tx + $.G.scroll;
    if (ty >= floorAt(wx) || ty <= ceilAt(wx) || tx <= 2 || ty <= 2 || ty >= PH - 2 || e.hd2 >= DN.hMax) { e.st2 = 'bite'; e.wt2 = 0; $.G.shake += 2; sfx.chain(); }
  } else if (e.st2 === 'bite') {
    if (e.wt2 >= biteF(ph2)) { e.st2 = 'reel'; e.wt2 = 0; sfx.chain(); }
  } else if (e.st2 === 'reel') {
    e.hd2 -= DN.hIn;
    if (e.hd2 <= 12) { e.hd2 = 0; e.st2 = ''; }
  }
  e.sag2 = e.st2 === 'bite' || e.st2 === 'reel' ? sagOf(ph2, ox, oy, e.ha2, e.hd2) : 0;
}
/** the hook, one frame of its tell, throw, bite or reel. e.ha: its line, e.hd: how far out the tip is */
function hook(e, ph2, sp) {
  const ox = e.x + DN.hOx, oy = e.y + DN.hOy;
  if (e.st === 'htel') {
    if (e.wt <= DN.hTel - DN.hLock) e.ha += wrapA(aimA(ox, oy) - e.ha) * DN.hTrack; // then locked: the line is honest
    if (e.wt >= DN.hTel) {
      e.st = 'hook'; e.wt = 0; e.hd = 10; sfx.lash();
      if (g3() && variant()) { e.st2 = 'htel'; e.wt2 = 0; e.hd2 = 0; e.ha2 = hook2Aim(aimA(ox, oy), e.ha, Math.hypot($.P.x - ox, $.P.y - oy)); sfx.tele(); }
    }
  } else if (e.st === 'hook') {
    e.hd += DN.hSp;
    const tx = ox + Math.cos(e.ha) * e.hd, ty = oy + Math.sin(e.ha) * e.hd, wx = tx + $.G.scroll;
    if (ty >= floorAt(wx) || ty <= ceilAt(wx) || tx <= 2 || ty <= 2 || ty >= PH - 2 || e.hd >= DN.hMax) { // it bites
      e.st = 'bite'; e.wt = 0; $.G.shake += 3; sfx.chain();
      for (let k = 0; k < 10; k++) spark(tx, ty, rr(-2, 2), rr(-2, 2), ri(6, 12), k % 2 ? '#cfe6ff' : pick(sp));
      for (let k = 0; k < 8; k++) drop(tx, ty, rr(-1.5, 1.5), rr(-1.5, 1), 1.3, R() < .5 ? 0 : 1, 70);
    }
  } else if (e.st === 'bite') {
    if (e.wt >= biteF(ph2) && !(e.st2 === 'htel')) { e.st = 'reel'; e.wt = 0; sfx.chain(); } // the first's wire stays taut until the second is thrown
  } else if (e.st === 'reel') {
    e.hd -= DN.hIn;
    if (e.hd <= 12) { e.hd = 0; if (e.st2) e.st = 'hwait'; else { e.st = 'idle'; e.wt = 0; e.cool = cool(ph2); } }
  } else if (e.st === 'hwait' && !e.st2) { e.st = 'idle'; e.wt = 0; e.cool = cool(ph2); } // the second hook is home
  e.sag = e.st === 'bite' || e.st === 'reel' ? sagOf(ph2, ox, oy, e.ha, e.hd) : 0;
  if (e.st2) hook2(e, ph2, ox, oy);
  // two wires out: both sag by the smaller of their sags, so the band between them stays what hook2Aim kept (>= DN.h2Gap)
  if (e.st2 && e.sag > 0 && e.sag2 > 0) e.sag = e.sag2 = Math.min(e.sag, e.sag2);
  else if (e.st2 === 'bite' || e.st2 === 'reel') { if (e.st === 'bite' || e.st === 'reel') e.sag = e.sag2 = 0; }
  if ($.P.alive && hookHit(e, $.P.x, $.P.y)) playerHit();
}

function updPrentice(e) {
  // THE BUTCHER'S APPRENTICE: a small carcass on one chain with a cleaver. Lunges in behind a red sweep cone (50f to get out), or spits ember fans
  e.clk = cutLocked(e) ? 1 : 0; // the render draws a locked cone where it will swing
  const go = midLeave(e, cutLocked(e) ? 1 / Math.max(1, 50 - e.wt) : e.st === 'tel' ? .06 : .03), ph2 = midPh2(e), cx = isCross(e), G3 = g3(), sp = cx ? HOST_SPARK[e.host] : FIRE; // its embers burn in the host's colours
  e.sw = (e.sw || 0) + (ph2 ? .028 : .018);
  if (e.st === 'tel' && e.wt < 25) e.y = lerp(e.y, clamp($.P.y + 6, 50, PH - 40), .06);
  else if (e.st !== 'tel' && e.st !== 'cut' && !(e.hd > 0) && e.st !== 'htel' && !e.st2) e.y = lerp(e.y, PH * .42 + Math.sin(e.sw) * 34, .05); // holds still on the hook's line
  if (cx) bandFit(e);
  const sx = e.x - 8, sy = e.y - 6;
  if (!go && entered(e) && $.P.alive) {
    e.wt++;
    if (lurch(e, ph2)) e.rq = 2; // g3: phase 2 opens with its first ring
    if (e.st === 'idle') {
      e.ba = lerp(e.ba, -2.3, .1);
      e.tx = W - 92;
      if (e.wt >= e.cool) {
        e.att++;
        const k = e.att % 3; // lunge, hook, spit (the lunge only when you are in front of it)
        e.st = k === 1 && $.P.x < W - 160 ? 'tel' : k === 2 ? 'htel' : 'spit'; e.wt = 0;
        if (e.st === 'htel') { e.ha = aimA(e.x + DN.hOx, e.y + DN.hOy); e.hd = 0; sfx.tele(); sfx.chain(); }
        else e.st === 'tel' ? sfx.tele() : sfx.chain();
      }
    } else if (e.st === 'tel') {
      if (!cutLocked(e)) e.tx = clamp($.P.x + 64, 130, W - 70); // g3: locked for the last 50 - APP.cutLock f (the body arrives on the cut)
      e.ba = lerp(e.ba, -2.4, .2);
      if (e.wt >= 50) { e.st = 'cut'; e.wt = 0; sfx.lash(); }
    } else if (e.st === 'cut') {
      const p = Math.min(1, e.wt / 12);
      e.ba = -2.3 - p * (TAU - 4.6);
      if (e.wt === 6) {
        $.G.shake += 3;
        for (let k = 0; k < 24; k++) spark(sx - 50, sy + rr(-30, 30), rr(-3, 0), rr(-2, 2), ri(8, 16), pick(sp));
        if (!G3 || spend(e, 3)) fan(sx, sy, aimA(sx, sy), 3, .3, 1.5); // g3: no room, no fan (the cleaver is the threat)
      }
      if ($.P.alive && e.wt <= 12) {
        const d = Math.sqrt(dist2($.P.x, $.P.y, sx, sy));
        let pa = Math.atan2($.P.y - sy, $.P.x - sx), cur = e.ba;
        if (pa < 0) pa += TAU;
        if (cur < 0) cur += TAU;
        if (d > 14 && d < 84 && pa <= 3.99 && pa >= cur) playerHit();
      }
      if (e.wt >= 30) { e.st = 'idle'; e.wt = 0; e.cool = cool(ph2); }
    } else if (e.st === 'htel' || e.st === 'hook' || e.st === 'bite' || e.st === 'reel' || e.st === 'hwait') hook(e, ph2, sp);
    else if (e.st === 'spit') {
      if (!G3) { if (e.wt === 24 || e.wt === 38) fan(e.x - 4, e.y - 24, aimA(e.x - 4, e.y - 24), ph2 ? 7 : 5, .19, 1.7); }
      else if (e.wt === APP.spitF) { // g3: ONE spit (spec §2.3); it waits for room in the budget (all or none)
        const n = APP.spit[ph2 ? 1 : 0];
        if (spend(e, n)) fan(e.x - 4, e.y - 24, aimA(e.x - 4, e.y - 24), n, .19, 1.7); else e.wt = APP.spitF - 1;
      }
      if (e.wt >= 50) { e.st = 'idle'; e.wt = 0; e.cool = cool(ph2); }
    }
    if (!G3) { if (ph2 && every(e, 120)) ring(e.x, e.y, 10, e.t * .06, 1.05); }
    else {
      if (ph2 && ev(e, APP.ringI)) e.rq = 1;
      if (e.rq && (e.rq === 2 ? spend(e, APP.ring) : spendP(e, APP.ring))) { e.rq = 0; ring(e.x, e.y, APP.ring, ringA(e.x, e.y), RING_V); }
    }
  }
  if (go && e.hd > 0) { e.hd = Math.max(0, e.hd - DN.hIn * 2); if (!e.hd) e.st = 'idle'; } // it withdraws: the chain comes home, harmless (midLeave set it idle)
  if (go && e.st2) { e.sag = e.sag2 = 0; e.hd2 = Math.max(0, (e.hd2 || 0) - DN.hIn * 2); e.st2 = e.hd2 > 0 ? 'gone' : ''; } // the second too ('gone' never hits)
  if (R() < .5) spark(e.x + rr(-12, 12), e.y + rr(-10, 24), rr(-.4, .3), -rr(.4, 1.4), ri(8, 16), pick(sp));
  if (R() < .25) drop(e.x + rr(-10, 10), e.y + rr(0, 20), rr(-.3, .3), rr(.2, .8), 1.3, R() < .5 ? 0 : 1, 90);
}

defineMid('prentice', {
  et: { hp: 150, r: 15, gsz: 4, score: 6000, bio: 70, skull: 1, limbs: 3, eyes: 3, teeth: 6, big: 1, mini: 1, mid: 1 },
  word: 'CLEAVED',
  spawnY: .42,
  onSpawn: (e) => { e.st2 = ''; e.hd2 = 0; e.ha2 = Math.PI; e.wt2 = 0; e.sag = e.sag2 = 0; if (g3()) { ledger(e); opening(e); e.att = 2; } }, // g3: the spit opens (W6 K1: its fan is the quick reach; cleaver first, a near ship's short first half held one attack)
  update: updPrentice,
});
