// @ts-nocheck
// =====================================================================
//  The stage bosses on the Gradius III model, long4 only (DIFFICULTY-SPEC §2.3 Fights; stream W4b). The sim half of
//  boss/bossrules.ts: THE MAW's bite, THE BLOAT's nail comb and icicle curtain, THE BURNING BUTCHER's meat hooks and
//  sweeping reel, the biome bosses' 1200 f half clock, and the one spot that reads the rank API (W0 src/rank.ts).
//  enemies/update.ts's crux / butcher / maw arms call in here behind g3(); `short` keeps today's fights byte for byte.
//  Sim rules (.claude/rules/sim-determinism.md): frame counters only; R() only where today's arms already drew it;
//  no allocation per frame (lanes and columns are table refs or built once per volley).
// =====================================================================
import { $ } from '../state';
import { PH, R, TAU, W, clamp, lerp, rr } from '../core';
import { sfx } from '../audio';
import { ceilAt, eshots, floorAt, geysers } from '../world';
import { drop, gib, gore, spark } from '../fx/spawn';
import { BS, aimA, banner, eshoot, mk } from '../enemies/spawn';
import { killEnemy } from '../enemies/update';
import { clearStage } from '../stages';
import { ECON, econId } from '../economy';
import { hazLeadX } from '../notice';
import { driveMul } from '../depth';
import { bulletCap, cadI, cadMul, capRoom, leadL, rank, rho, variantOn } from '../rank';
import { kindOf } from '../layout';
import { lobV } from '../enemies/mid/_fight';
import { BLOAT, BOSS_HPK, BUTCHER, HAZ_HOOK, MAW, PHASE_F, VOLLEY, combStep, curtainXs, lungeStop, lungeX, steerLane } from './bossrules';

// ---------------- the rank API (W0 src/rank.ts, spec §5.6): the one spot the fights read it ----------------
/** the integer rank 0-31 */
export const rankOf = () => rank($);
/** rho = min(rank, 16) / 16 */
export const rhoOf = () => rho($);
/** the one cooldown rule [C2]: x(1.25 - .6 rho) */
export const cad = () => cadMul($);
/** a fight interval n under the rank rule, floored at 18 f (rank.ts cadI) */
export const iv = (n) => cadI($, n);
/** a fight's rank-variant is unlocked (rank >= 14, C3) */
export const variant = () => variantOn($);
/** the bullet cap of this fight's context (rank.ts capCtx: a stage boss or the Drive 'boss', the Orbit Maw 'setp') */
export const bossCap = () => bulletCap($);
/** the Gravity Drive's HP multiplier: depth.ts driveMul, whose long4 rank term is 0 (HardSet.driveRank, C22) */
export const driveHpMul = () => driveMul();
/** the long4 gate (spec §5.3): the fights here run only where the economy carries the hard curve */
export const g3 = () => !!ECON[econId()].hard;
/** volley-atomic: does a volley of n fit under this fight's cap? (rank.ts capRoom counts every eshot but haz) */
export const room = (n) => n <= capRoom($, eshots);
/** the lead aim [C8]: L = .2 + .6 rho of the ship's last-frame motion, t = min(60, dist / v), aim point clamped y 6-248.
 *  W1 fills spawn.ts aimLead with the same formula; switch to it when it lands (P.vx/P.vy from W0) */
export function leadA(x, y, v) {
  const P = $.P, h = P.hist, vx = P.vx ?? (h && h.length > 1 ? h[0].x - h[1].x : 0), vy = P.vy ?? (h && h.length > 1 ? h[0].y - h[1].y : 0);
  const L = leadL($), sp = Math.max(.5, v * BS()), t = Math.min(60, Math.hypot(P.x - x, P.y - y) / sp);
  return Math.atan2(clamp(P.y + L * vy * t, 6, 248) - y, P.x + L * vx * t - x);
}
const LA = [0, 0]; // lobAim's scratch: no allocation per volley
/** the launch (angle, speed in BS units) into LA of a glob from (x, y) that comes down through (tx, ty) under V_CAP and the
 *  ceiling (mid/_fight.ts lobV, near the rise v0), for a fan whose centre must land on the ship */
export function lobAim(x, y, tx, ty, v0) {
  const bs = Math.max(.1, BS()), w = lobV(x, y, tx, ty, v0) * bs, t = (w + Math.sqrt(Math.max(0, w * w + .05 * (ty - y)))) / .025, vx = (tx - x) / Math.max(1, t);
  LA[0] = Math.atan2(-w, vx); LA[1] = Math.hypot(vx, w) / bs;
  return LA;
}
/** a timer countdown under the cap: true on the frame a volley of n fires; a full field holds it min(interval, 20 f) */
export function due(e, key, n, every) {
  if ((e[key] = (e[key] ?? every) - 1) > 0) return false;
  if (!room(n)) { e[key] = Math.min(every, VOLLEY.retry); return false; }
  e[key] = every;
  return true;
}

/** K3: a stage boss's HP factor (bossrules.ts BOSS_HPK[k]), once, on its fight's first frame: the body, and the parts it
 *  was spawned with (e.bars), so a bar still dies in the same share of the fight. The spawners are spawn.ts's */
export function hpOnce(e, k) {
  if (e.hpk) return;
  e.hpk = 1;
  const m = BOSS_HPK[k] ?? 1;
  if (m === 1) return;
  e.hp *= m; e.max = (e.max || e.hp / m) * m;
  for (const b of e.bars || []) if (!b.dead) { b.hp *= m; b.max = (b.max || b.hp / m) * m; }
}

// ---------------- the biome bosses' half clock ----------------
/** enemies/update.ts phaseClock on long4: PHASE_F 1500 -> 1200 per half (spec §2.3: Bloat and Butcher, 40 s max).
 *  Run out the first half and it lurches into the second (HP to 50%, the Bloat's bars shatter); run out the second and
 *  it retreats: grade C, no reward (K4). Pauses while the ship is dead */
export function clock3(e) {
  if (e.gone) {
    e.x += 1.8;
    e.y = lerp(e.y, PH / 2, .02);
    if (R() < .3) drop(e.x + rr(-10, 10), e.y + rr(0, 20), rr(-.3, .3), rr(.2, .8), 1.4, 0, 90);
    if (e.x > W + 80) {
      e.dead = true;
      clearStage(true);
      banner('IT GOT AWAY', 'NO REWARD', '#8a5a5a', 150);
    }
    return true;
  }
  if (e.t < 160 || !$.P.alive) return false;
  const half2 = e.hp < e.max * .5;
  if (half2 !== !!e.half2) { e.half2 = half2; e.pt = 0; }
  e.pl = PHASE_F;
  e.pt = (e.pt || 0) + 1;
  if (e.pt < PHASE_F) return false;
  e.pt = 0;
  if (half2) reelMeat(e); // the meat hooks go up with it, unpaid (before the bars' kill, which pays)
  for (const b of e.bars || []) if (!b.dead) killEnemy(b, -1);
  if (!half2) {
    e.hp = Math.min(e.hp, e.max * .5 - .01);
    banner('IT LURCHES ONWARD', 'OUT OF TIME', '#ff8a3a', 110);
    sfx.roar();
    $.G.shake = Math.max($.G.shake, 5);
    return false;
  }
  e.gone = 1;
  e.hk = null;
  banner('IT RETREATS', 'OUT OF TIME', '#8a5a5a', 110);
  sfx.roar();
  return true;
}

// ---------------- THE MAW: THE BITE ----------------
/** the whole long4 Maw arm (enemies/update.ts 'maw' calls it; short flies today's). The jaw cycle is its own counter
 *  (e.jc, the cycle frame; e.jn, cycles done) so the rank rule can stretch or shorten it. Every 3rd cycle (2nd below half)
 *  is a bite: e.bs 1 the 46 f tell (the lane e.ly tracks the ship's height, then locks for the last 16), 2 the lunge
 *  down it at 6 px/f to W*.35, 3 the hold (snapping), 4 home at 3 px/f. The body is the hazard; the fan waits */
export function maw3(e) {
  hpOnce(e, e.stageBoss && kindOf($.G.stage || 0) !== 'orbit' ? 'maw' : 'maw0'); // K3 (depth.ts isMid's split: the Open Orbit Maw counts as a midboss)
  if (e.jn == null) e.jn = MAW.biteFirst; // W6 K1: its first bite on the first jaw cycle, inside the first half
  const tx = W - 82, h2 = e.hp < e.max * .5;
  const leaving = e.t >= e.leave && !e.bs;
  if (!leaving) { if (!e.bs) e.x = lerp(e.x, tx, .025); }
  else {
    e.x += 1.6;
    if (e.x > W + 60) {
      e.dead = true;
      if (e.stageBoss) {
        clearStage(true);
        banner('IT GOT AWAY', 'NO REWARD', '#8a5a5a', 150);
      }
    }
  }
  const bob = PH / 2 + Math.sin(e.t * .017) * (PH * .28);
  if (e.bs) bite(e, tx);
  else e.bw = Math.max(0, (e.bw || 0) - 1 / MAW.blend);
  e.y = e.bw > 0 ? lerp(bob, e.ly, e.bw) : bob;
  // the jaw cycle, x the rank rule; it waits out a bite
  const J = iv(MAW.jaw);
  if (!e.bs) {
    e.jc = (e.jc ?? 0) + 1;
    if (e.jc >= J) {
      e.jc = 0;
      e.jn = (e.jn || 0) + 1;
      const at = e.x > tx - 6 && e.x < tx + 6 && !leaving && e.t < e.leave - MAW.quiet;
      if (at && e.jn % MAW.biteEvery[h2 ? 1 : 0] === 0) { e.bs = 1; e.bt = 0; e.ly = e.y; e.bw = 1; e.bv = e.stageBoss && variant() ? 1 : 0; sfx.tele(); }
    }
  }
  // the fan: at the same share of the cycle as today's cycle frame 100 of 130
  const cyc = e.bs ? -1 : Math.round(e.jc * 130 / J);
  e.jcy = cyc; // render/gross/maw.ts reads the cycle frame on 130's scale for the retch tell
  e.jaw = e.bs ? (e.bs === 3 ? .55 + .45 * Math.sin(e.bt * .9) : 1) : cyc > 80 && cyc < 120 ? Math.min(1, (cyc - 80) / 14) : Math.max(0, e.jaw - .08);
  if (!e.bs && e.jc === Math.round(MAW.fanAt * J / 130)) e.fw = 1; // the fan is due; a full field holds it (min(rest, 20 f) apart)
  if (e.bs) e.fw = 0; // a bite cancels it
  if (e.fw > 0 && --e.fw === 0 && e.x < W - 20) { if (!room(MAW.fanN)) e.fw = VOLLEY.retry; else {
    const m = (MAW.fanN - 1) / 2; lobAim(e.x - 14, e.y, $.P.x, $.P.y, 0); // W6: the centre glob comes down THROUGH the ship (aimed straight, gravity took every glob under a parked ship: K1)
    for (let k = -m; k <= m; k++) eshoot(e.x - 14, e.y, LA[0] + k * MAW.fanSpread, LA[1] + Math.abs(k) * .1, 'glob');
    for (let k = 0; k < 24; k++) drop(e.x - 14, e.y, rr(-3, -.5), rr(-1.5, 1.5), 1.6, R() < .4 ? 2 : 0, 80);
    $.G.shake += 2;
  } }
  // the half-led orb from one of its eyes, in turn (no pick() draw)
  if (e.oc == null) e.oc = MAW.orbFirst;
  if (e.x < W - 20 && !e.bs && due(e, 'oc', 1, iv(MAW.orbEvery))) { // no orb through a bite: the lane is the read
    const ep = e.eyesP[(e.on = ((e.on || 0) + 1) % e.eyesP.length)], ex = e.x + Math.cos(ep.a + Math.PI) * ep.r, ey = e.y + Math.sin(ep.a) * ep.r;
    eshoot(ex, ey, leadA(ex, ey, MAW.orbV), MAW.orbV);
  }
  for (const ep of e.eyesP) { if (ep.b > 0) ep.b--; else if (R() < .01) ep.b = 8; }
  if (R() < .3) drop(e.x + rr(-20, 20), e.y + rr(10, 22), rr(-.3, .3), rr(.2, .8), 1.2, R() < .5 ? 0 : 1, 90);
  if (e.hp < e.max * .5 && !e.wounded) {
    e.wounded = 1;
    gib(e.x + 10, e.y - 15, 1, -2, 'metal', 5);
    geysers.push({ wx: e.x + $.G.scroll, y: e.y, att: e, ox: 6, oy: -14, a: -1.3, l: 400, rate: 3 });
  }
}
/** one frame of the bite (e.bs 1-4, e.bt its frame). render/gross/maw.ts draws the lane (e.ly) and the eyes' flare */
function bite(e, tx) {
  const P = $.P, V = e.bv ? MAW.var : null;
  e.bt++;
  if (e.bs === 1) { // the tell: the eyes flare; the lane tracks the ship's height, then locks
    if (e.bt <= MAW.tell - MAW.lock && P.alive) e.ly = clamp(steerLane(e.ly, P.y), 30, PH - 30);
    if (e.bt <= MAW.tell - MAW.lock || e.lsx == null) e.lsx = lungeStop(P.x, W); // where it will stop, locked with the lane (the render draws the line to it)
    if (e.bt >= MAW.tell) { e.bs = 2; e.bt = 0; e.bx0 = e.x; sfx.lash(); $.G.shake += 3; }
  } else if (e.bs === 2) { // the lunge
    e.x = lungeX(e.bx0, W, e.bt, e.lsx);
    if (e.x <= e.lsx) { e.bs = 3; e.bt = 0; e.ly2 = e.ly; }
  } else if (e.bs === 3) { // the hold, snapping; the variant re-aims its way home and shows the second line
    if (V && e.bt <= V.hold - V.lock && P.alive) e.ly2 = clamp(steerLane(e.ly2, P.y), 30, PH - 30);
    if (e.bt % 6 === 0) $.G.shake = Math.max($.G.shake, 2);
    if (e.bt >= (V ? V.hold : MAW.hold)) { e.bs = 4; e.bt = 0; e.bx1 = e.x; e.by1 = e.ly; }
  } else { // home: straight back, or down the second lane (the variant)
    const v = V ? V.backV : MAW.backV;
    e.x = Math.min(tx, e.x + v);
    if (V) { const u = clamp((e.x - e.bx1) / Math.max(1, tx - e.bx1), 0, 1); e.ly = lerp(e.by1, e.ly2, u); }
    if (e.x >= tx) { e.bs = 0; e.bt = 0; e.jc = 0; e.lsx = null; }
  }
}

// ---------------- THE BLOAT: NAIL COMB and ICICLE CURTAIN ----------------
/** THE BLOAT's attacks on long4 (enemies/update.ts 'crux' calls it once it is armed). Bars up: the nail comb, two
 *  unaimed horizontal streams from y +-34 every 90 f (the outer nails glow 30 f first; four lanes every other comb at
 *  rank >= 14), plus an aimed 3-fan of spikes every 150. Core bared: the icicle curtain (three icicles, the ship's column
 *  and +-60 px) every 150, one 9-ring every 160 and 5 globs every 120. The spiral is gone. Timers on e: tc comb (render
 *  reads it for the glow), ta aim, tr ring, tg globs, ti ice; cs/cst the stream in flight */
export function crux3(e) {
  const C = BLOAT.comb;
  if (e.shielded) {
    // the comb: tc counts down to the stream; the render glows the emitters for its last C.tell frames
    e.tc = (e.tc ?? iv(C.every)) - 1;
    if (e.tc <= 0 && !e.cs) {
      e.cn = (e.cn || 0) + 1;
      e.cl = e.cln || C.lanes; e.cs0 = 0;
      e.cln = variant() && e.cn % 2 === 1 ? C.lanesVar : C.lanes; // the next comb's lanes, known through its tell (render)
      e.cs = e.cl === C.lanesVar ? C.nVar : C.n; e.cst = 0;
      e.tc = iv(C.every);
    }
    if (e.cs && --e.cst <= 0) {
      if (room(e.cl.length)) {
        for (const dy of e.cl) { const n0 = eshots.length; eshoot(e.x + C.x, e.y + dy, Math.PI, C.v, 'spike'); if (eshots.length > n0) eshots[n0].dn = 'comb'; } // dn: measure-only, the probes' denial split (K2: the comb, not the aimed fan)
        e.cs--; e.cst = combStep(BS());
        if (!e.cs0) { e.cs0 = 1; sfx.tink(); $.G.shake = Math.max($.G.shake, 1); }
      } else e.cst = 1; // a full field: the next emission waits a frame (a stream counts each emission)
    }
    aim3(e);
    return;
  }
  e.cs = 0;
  if (e.hp < e.max * .5 && !e.h3) { e.h3 = 1; e.ta = Math.min(e.ta ?? 20, 20); } // past half it answers at once [FIT K1: a short second half]
  aim3(e); // both phases (ENC 4.7 phase 2: ring 9 + globs + aimed 3)
  // the core is bared: the icicle curtain, one ring, the globs
  e.ti = e.ti ?? BLOAT.ice.first;
  if (--e.ti <= 0) {
    e.ti = iv(BLOAT.ice.every);
    e.fi = e.t;
    const P = $.P;
    if (P.alive && HAZ_HOOK.drop) {
      const c = hazLeadX('icicle', P.x, P.y, $.G.scrollSpeed, ceilAt(P.x + $.G.scroll) + 16, W);
      for (const x of curtainXs(c, 16, W * .92)) HAZ_HOOK.drop('icicle', x);
      sfx.tele(); // the 50 f hang tell's cue (a tink would read as an icicle shot down)
    }
  }
  if (due(e, 'tr', BLOAT.ring.n, iv(BLOAT.ring.every))) { for (let i = 0; i < BLOAT.ring.n; i++) eshoot(e.x - 26, e.y + 28, e.t * .05 + i * TAU / BLOAT.ring.n, BLOAT.ring.v); e.fr = e.t; }
  if (due(e, 'tg', BLOAT.glob.n, iv(BLOAT.glob.every))) for (let k = 0; k < BLOAT.glob.n; k++) eshoot(e.x + rr(-10, 10), e.y - 50, -Math.PI / 2 + rr(-.9, .9), BLOAT.glob.v, 'glob');
}

/** the Bloat's aimed 3-fan of spikes, for the ship parked outside the comb's sweep or the curtain */
function aim3(e) {
  if (!due(e, 'ta', BLOAT.aim.n, iv(e.shielded ? BLOAT.aim.every : BLOAT.aim.every2))) return;
  const x = e.x - 28, y = e.y - 4, a = aimA(x, y), m = (BLOAT.aim.n - 1) / 2;
  for (let k = -m; k <= m; k++) eshoot(x, y, a + k * BLOAT.aim.spread, BLOAT.aim.v, 'spike');
  e.fa = e.t; // the render's recoil frame
}

// ---------------- THE BURNING BUTCHER: MEAT HOOKS ----------------
/** the second half's meat hooks (enemies/update.ts 'butcher' calls it every frame once the chain has snapped): e.mc the
 *  cycle frame. 0..tell the chains rattle at the ceiling (render/gross/butcher.ts draws it at BUTCHER.meat.xs); then three
 *  'hook' enemies (the existing kind, HP 7, shootable) pay out over `drop` frames, swing `life` frames as pendulums
 *  across the lanes, and are hauled up over `reel`. A new set every 600 f x the rank rule from the tell */
export function meat3(e) {
  const M = BUTCHER.meat, end = M.tell + M.drop + M.life + M.reel;
  e.mc = (e.mc ?? -1) + 1;
  if (e.mc === 0) sfx.chain();
  if (e.mc === M.tell) {
    e.mh = M.xs.map((x, i) => {
      const wx = x + $.G.scroll, c = Math.max(-10, ceilAt(wx)), len = Math.min(M.lenMax, Math.max(30, (floorAt(wx) - c) * M.lenK[i]));
      return mk('hook', x, c, { ax: x, ay: c, len: 0, ml: len, sw: M.sw, ph: M.ph[i], noLeg: i !== 1, noArm: i === 1, cap: false, twitch: 0, cut: i === 2, kid: 1, meat: 1 });
    });
    e.bars = e.mh; // as the Bloat's nails: killEnemy's stage-boss branch takes them down with it
    sfx.chain();
  }
  if (e.mh) {
    const f = e.mc - M.tell;
    for (const h of e.mh) {
      if (h.dead) continue;
      if (f <= M.drop) h.len = h.ml * Math.min(1, f / M.drop);
      else if (f > M.drop + M.life) h.len = h.ml * Math.max(0, 1 - (f - M.drop - M.life) / M.reel);
      if (f >= M.drop + M.life + M.reel) h.dead = true; // hauled up out of sight: no kill, no pay
    }
    if (f >= M.drop + M.life + M.reel) e.mh = null;
  }
  if (e.mc >= Math.max(end + 60, iv(M.every))) e.mc = -1;
}
/** haul any meat hooks up at once (the Butcher retreats or dies) */
export function reelMeat(e) {
  if (e.mh) for (const h of e.mh) if (!h.dead) { h.dead = true; spark(h.x, h.y, 0, -1, 8, '#cfe6ff'); }
  e.mh = null;
}
/** rank >= 14: the planted chain's reel sweeps its arc toward the boss over 30 f instead of running straight home.
 *  h.sw0 the frame it began; returns true while it sweeps (the caller skips the straight reel). Pure in the frame count */
export function reelSweep(h, ax, ay) {
  const V = BUTCHER.reelVar;
  if (h.sf == null) {
    h.sf = 0;
    h.sa = Math.atan2(h.ty - ay, h.tx - ax);
    h.sl = Math.hypot(h.tx - ax, h.ty - ay);
    // sweep toward the middle of the playfield: the side whose far end sits nearer PH/2
    const yA = ay + Math.sin(h.sa + V.arc) * h.sl, yB = ay + Math.sin(h.sa - V.arc) * h.sl;
    h.sd = Math.abs(yA - PH / 2) < Math.abs(yB - PH / 2) ? 1 : -1;
  }
  const u = Math.min(1, ++h.sf / V.sweep), a = h.sa + h.sd * V.arc * u, l = h.sl * (1 - u);
  h.tx = ax + Math.cos(a) * l;
  h.ty = ay + Math.sin(a) * l;
  return u < 1;
}
