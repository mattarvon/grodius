// @ts-nocheck
// THE NAIL CHOIR (ice home): a frozen eye in two orbiting nailbars. Art: render/gross/mid/choir.ts
// Its picker row (name, tag, pool) is in ./roster.ts. Moved verbatim from update.ts's switch (LS2-0).
// Its LINE denial (D61, ./_deny.ts): every DN.lEvery-th attack a nailbar comes loose and sweeps a lane at the ship's height.
import { $ } from '../../state';
import { PH, R, lerp, pick, rr } from '../../core';
import { sfx, thr } from '../../audio';
import { drop, flash, spark } from '../../fx/spawn';
import { cdm } from '../../depth';
import { playerHit } from '../../player';
import { aimA, endVolley, eshoot, every, fan, mk, ring, volley, wrapA } from '../spawn';
import { bandFit, midLeave } from '../update';
import { HOST_SPARK, isCross, midPh2 } from '../midhost';
import { DN, LP, laneHit, lanePair, laneY } from './_deny';
import { defineMid } from './roster';
import { RING_V, aimLed, cad, entered, ev, g3, halfClock, ledger, lurch, opening, phaseAtt, phaseShare, ringA, spend, spendP, variant } from './_fight';

// g3 (DIFFICULTY-SPEC §2.3): the one rank rule, cad() (no pow term, no dial); short keeps its old line (layout parity)
const cool = (ph2) => g3() ? cad(ph2 ? 60 : 85) : Math.round((ph2 ? 60 : 85) * (1 - .3 * ($.G.rank || 0)) * cdm());
/** the glare before the spike fan: 40 f, 44 on long4 (spec §2.3, the E5 floor) */
export const glareF = () => (g3() ? 44 : 40);
/** g3 weak point (spec §2.3): the eye takes .4 while either bar lives ("core and wall", the Bloat's grammar) */
export const CHOIR_EYE = .7; // W6 tune-tf: .4 (the spec) made the first half 2.7x the second at the STAGE 1 kit (380 f to 140: K1 1 hit in phase 2); HP up to match (midslot.ts)
/** g3 (W6 tune-tf, K2): the loose bar is armoured while it is the lane (its tell, the sweep out, the turn and back): it
 *  takes CHOIR_LANE of a hit, a tink. The lane flies AT the ship's height, straight into its forward fire, so a bar at
 *  full HP died in its 56 f tell every time: the probes saw the lane hit a parked ship 0 times. Flying home it is a bar again */
export const CHOIR_LANE = .15;
/** r3 K1, the half floor's reach per attack (_fight.ts phaseAtt): the fan's 44 f glare plus ~110 f of flight across the
 *  screen; the lane's 56 f tell plus its sweep to the ship (~40 f at 6 px/f) */
export const CHOIR_LAND = { fan: 154, lane: 96 } as const;
/** g3: a singing bar's led spike flies at SING_V (x BS; was 1.35): from the right edge it took ~150 f to cross, longer than a
 *  first half the ship's fire cuts short at the STAGE 1 kit (W6 K1: 225 f at spot 150,160) */
export const SING_V = 1.8;
/** the armoured lane bar's hit sound (audio only, roster.ts midHitSnd): the shared tink at most every 240 ms on its own
 *  clock, so steady fire on the lane doesn't hold the tink throttle (audio.ts 't', 60 ms) and eat the sing's and the
 *  lane end's tinks (audio-director, W6). Full-share hits keep the shared hit */
function barSnd(b, m) {
  if (!(m < 1)) return false;
  if (!thr('choirBar', 240)) sfx.tink();
  return true;
}
function barArmor(b) {
  const e = b.par;
  if (!g3() || !e || !e.lp || e.lp === LP.home || (b !== e.lb && b !== e.lb2)) return 1;
  return e.lp === LP.tel ? 0 : CHOIR_LANE; // r3 K1: its tell can't be shot off (it sits in the ship's line of fire at the lane's mouth for 56 f: a near ship broke it there every time); the counterplay is to leave the lane
}
/** the lane is over (or cut short): the bar(s) fly home from wherever they are */
const laneOff = (e) => {
  e.st = 'idle'; e.wt = 0;
  if (e.lb2 && (e.lb2.dead || !e.lp)) { e.lb2 = null; e.tw = 0; }
  if (e.lb && !e.lb.dead && e.lp) { e.lp = LP.home; e.lh = 0; } else { e.lp = 0; e.lb = null; e.lb2 = null; e.tw = 0; }
};

/** the lane attack, one frame. e.lb: the loose bar (null: no bar left, the eye spits nails); e.lx, e.ly: the bar's place */
function lane(e, ph2) {
  if (e.lb2 && e.lb2.dead) { e.lb2 = null; e.tw = 0; } // the twin shot off its lane: the first sweeps on alone
  if (e.lb && e.lb.dead && e.lb2) { e.lb = e.lb2; e.ly = e.ly2; e.ly0 = e.ly20; e.lb2 = null; e.tw = 0; } // the first shot off: the twin carries on alone
  const b = e.lb, b2 = e.lb2, x0 = e.x - DN.lFront;
  if (b && b.dead) { e.lb = null; e.lp = 0; e.st = 'idle'; e.wt = 0; e.cool = cool(ph2); return; } // shot off the lane: it ends
  if (e.lp === LP.tel) {
    const k = Math.min(1, e.wt / DN.lFly), s = k * k * (3 - 2 * k);
    if (b) { e.lx = lerp(e.x + b.ox, x0, s); e.ly = lerp(e.y + b.oy, e.ly0, s); }
    else { e.lx = x0; e.ly = e.ly0; }
    if (b2) e.ly2 = lerp(e.y + b2.oy, e.ly20, s); // the twin flies to its own lane's mouth alongside (same x: they sweep together)
    if (e.wt >= DN.lTel) {
      if (!b && g3() && !spend(e, DN.lSpikes)) e.wt = DN.lTel - 1; // g3: the column waits for room (all 5 or none)
      else {
        e.wt = 0; sfx.lash(); flash(x0, e.ly, 14, 5, '200,235,255');
        if (b) e.lp = LP.out;
        else { // no bar left: the eye spits its nails down the lane, a column the bar's height
          if (volley(DN.lSpikes, x0, e.ly)) { for (let i = 0; i < DN.lSpikes; i++) eshoot(x0, e.ly + (i - (DN.lSpikes - 1) / 2) * DN.lSpikeDy, Math.PI, DN.lSpikeSp, 'spike'); endVolley(); } // atomic on long4 (spawn.ts volley: all or none; short: always true)
          e.lp = 0; e.st = 'idle'; e.cool = cool(ph2);
        }
      }
    }
  } else if (e.lp === LP.out) {
    e.lx -= DN.lSp;
    if (e.lx <= DN.lEnd) {
      e.lx = DN.lEnd; sfx.tink();
      // g3 rank >= 14 (spec §2.3 variant): the return re-locks on the ship's height now, ruled solid for DN.lTurn off screen
      if (g3() && variant()) { e.lp = LP.turn; e.lt = 0; e.lyA = e.ly; e.ly2A = e.ly2; e.lyB = laneY($.P.y, PH); sfx.tele(); }
      else e.lp = LP.back;
    }
  } else if (e.lp === LP.turn) {
    const k = Math.min(1, ++e.lt / DN.lTurn), s = k * k * (3 - 2 * k);
    e.ly = lerp(e.lyA, e.lyB, s);
    if (e.tw) e.ly2 = lerp(e.ly2A ?? e.ly2, lanePair(e.lyB, PH), s); // the twin eases to the pair of the NEW lane (it never hops sides mid-turn)
    if (e.lt >= DN.lTurn) e.lp = LP.back;
  } else if (e.lp === LP.back) {
    e.lx += DN.lBack;
    if (e.lx >= x0) { e.lx = x0; laneOff(e); e.cool = cool(ph2); }
  }
  if ($.P.alive && laneHit(e, $.P.x, $.P.y)) playerHit();
}

function updChoir(e) {
  // THE NAIL CHOIR: a frozen eye in two orbiting nailbars. Glares 40f down a fan line, then a spike fan; the nails "sing" (glint 36f) and spit spikes at you
  // nLive: a counted loop rather than filtering e.bars into a new array, so the update allocates nothing per frame (build plan LS1 P0)
  halfClock(e); // g3 (r3 K1): a first half still up at half the slot clock lurches on (_fight.ts FT.halfK)
  const go = midLeave(e), ph2 = midPh2(e), cx = isCross(e), G3 = g3();
  let nLive = 0;
  for (const b of e.bars) if (!b.dead) nLive++;
  e.y = PH / 2 + Math.sin(e.t * .014) * (PH * .16);
  if (cx) bandFit(e);
  e.spin = (e.spin || 0) + (nLive < 2 ? .034 : .022);
  for (const b of e.bars) { const a = e.spin + b.i * Math.PI; b.ox = Math.cos(a) * 31; b.oy = Math.sin(a) * 31; }
  if (go && e.lp && e.lp !== LP.home) laneOff(e); // it withdraws mid-lane (midLeave has set it idle): the bar comes home
  if (!go && entered(e) && $.P.alive) {
    e.wt++;
    if (G3 && !e.sung) { e.sung = 1; for (const b of e.bars) if (!b.dead) b.sing = 36; } // g3 (W6 K1): both bars sing as it opens, so a first half the ship's fire cuts short still meets two aimed attacks
    if (lurch(e, ph2)) { e.att = 0; e.rq = 2; for (const b of e.bars) if (!b.dead && !(b.sing > 0) && b !== e.lb && b !== e.lb2) b.sing = 36; } // g3: phase 2 opens on the fan, the ring and both bars singing (aimed: they reach every spot)
    if (e.st === 'idle' && e.wt >= e.cool) {
      e.att++; phaseAtt(e, e.att % DN.lEvery === 0 ? CHOIR_LAND.lane : CHOIR_LAND.fan); // the half floor (r3 K1)
      if (e.att % DN.lEvery === 0) { // the lane: locked on the ship's height now, its tell DN.lTel
        e.st = 'lane'; e.lp = LP.tel; e.wt = 0; e.ly0 = laneY($.P.y, PH); e.ly = e.ly0; e.lx = e.x - DN.lFront;
        e.lb = null; e.lb2 = null; e.tw = 0;
        for (const b of e.bars) if (!b.dead) { if (!e.lb) e.lb = b; else if (!e.lb2) e.lb2 = b; }
        // g3 phase 2 with both bars: TWIN lanes, the second DN.lGap2 off the first (lanePair: a free band >= 40 px between)
        if (e.lb2 && !(g3() && ph2)) e.lb2 = null;
        if (e.lb2) { e.tw = 1; e.ly20 = lanePair(e.ly0, PH); e.ly2 = e.ly20; e.lb2.sing = 0; }
        if (e.lb) e.lb.sing = 0;
        sfx.tele(); sfx.chain();
      } else { e.st = 'tel'; e.wt = 0; e.ha = aimA(e.x - 10, e.y); sfx.tele(); }
    }
    else if (e.st === 'tel') {
      if (!G3) e.ha += wrapA(aimA(e.x - 10, e.y) - e.ha) * .04;
      else if (e.wt < glareF() - 16) { e.ha = aimA(e.x - 10, e.y); e.hx = $.P.x; e.hy = $.P.y; } // g3 (W6 K1): the glare line follows the ship, then locks its last 16 f (it lagged .04 a frame behind an eye still flying in: the opening fan missed every spot)
      else if (e.hx != null) e.ha = Math.atan2(e.hy - e.y, e.hx - (e.x - 10)); // g3 (r3 K1): it locks on the POINT, not the angle: the eye bobs ~9 px over the lock, and a locked angle fired from where it had moved to passed a parked ship by that much
      const n = nLive || G3 ? 5 : 7; // g3: 5 always (7 with no bars held the Normal screen at p90 10: B3)
      if (e.wt >= glareF() && !(G3 && !spend(e, n))) { // g3: the fan waits for room in the budget (all n or none)
        fan(e.x - 10, e.y, e.ha, n, .16, 1.8, 'spike');
        flash(e.x - 10, e.y, 16, 6, '200,235,255');
        e.st = 'idle'; e.wt = 0; e.cool = cool(ph2);
      }
    } else if (e.st === 'lane') lane(e, ph2);
    if (!G3) {
      if (every(e, ph2 ? 110 : 150)) for (const b of e.bars) if (!b.dead && !(b.sing > 0) && b !== e.lb) b.sing = 36;
      for (const b of e.bars) if (!b.dead && b.sing > 0 && --b.sing === 0) { fan(b.x, b.y, aimA(b.x, b.y), 3, .22, 1.35, 'spike'); sfx.tink(); }
      if (ph2 && every(e, 130)) ring(e.x, e.y, 10, e.t * .05, 1.05);
    } else { // spec §2.3: each bar sings ONE led spike (not a 3-fan); the ring is 8 every 160, never two in a 120 f window
      if (ev(e, ph2 ? 110 : 150)) for (const b of e.bars) if (!b.dead && !(b.sing > 0) && b !== e.lb && b !== e.lb2) b.sing = 36;
      for (const b of e.bars) if (!b.dead && b.sing > 0 && (b.sing > 1 || spendP(e, 1)) && --b.sing === 0) { eshoot(b.x, b.y, aimLed(b.x, b.y, SING_V), SING_V, 'spike'); sfx.tink(); } // its last glint frame holds until there is room
      if (ph2 && ev(e, 160)) e.rq = 1;
      if (e.rq && (e.rq === 2 ? spend(e, 8) : spendP(e, 8))) { e.rq = 0; ring(e.x, e.y, 8, ringA(e.x, e.y), RING_V); }
    }
  }
  // the loose bar: on the lane, or flying home to its orbit (then it is an orbiting bar again)
  const lb = e.lb;
  if (e.lb2 && e.lb2.dead) { e.lb2 = null; e.tw = 0; }
  if (lb && lb.dead) { e.lb = null; e.lb2 = null; e.tw = 0; e.lp = 0; if (e.st === 'lane') { e.st = 'idle'; e.wt = 0; } } // never left stuck in 'lane' (a bar shot while the ship is down)
  else if (lb && e.lp === LP.home) {
    e.lh++;
    const k = Math.min(1, e.lh / DN.lHome);
    e.lx = lerp(e.lx, e.x + lb.ox, .25 + .75 * k); e.ly = lerp(e.ly, e.y + lb.oy, .25 + .75 * k);
    if (e.lb2) e.ly2 = lerp(e.ly2, e.y + e.lb2.oy, .25 + .75 * k);
    if (k >= 1) { e.lb = null; e.lb2 = null; e.tw = 0; e.lp = 0; }
  }
  if (e.lb && e.lp) { e.lb.ox = e.lx - e.x; e.lb.oy = e.ly - e.y; }
  if (e.lb2 && e.lp) { e.lb2.ox = e.lx - e.x; e.lb2.oy = e.ly2 - e.y; }
  if (R() < .25) spark(e.x + rr(-12, 12), e.y + rr(-10, 12), rr(-.3, .3), rr(.2, .6), 14, cx ? pick(HOST_SPARK[e.host]) : R() < .5 ? '#d8efff' : '#8cc4ee');
  if (R() < .15) drop(e.x + rr(-6, 6), e.y + 10, 0, .4, 1.2, 0, 80);
}

defineMid('choir', {
  et: { hp: 80, r: 13, gsz: 4, score: 6000, bio: 60, skull: 1, eyes: 5, teeth: 4, big: 1, mini: 1, mid: 1 },
  word: 'SILENCED',
  onSpawn: (e) => { e.bars = [0, 1].map(i => mk('nailbar', e.x, e.y, { par: e, ox: 0, oy: 0, i, hpm: 1.6, armor: barArmor, hitSnd: barSnd })); e.lp = 0; e.lb = null; e.lb2 = null; e.tw = 0; if (g3()) { ledger(e); opening(e); } },
  update: updChoir,
  hurt: (e, d) => { if (!g3()) return 1; let m = 1; for (const b of e.bars) if (!b.dead) { m = CHOIR_EYE; break; } return m * phaseShare(e, d * m); }, // a loop, no closure per hit; phaseShare: the half floor (r3 K1)
});
