// @ts-nocheck
// =====================================================================
//  THE KEEPSAKE, the stage boss (D55; Matt, 2026-11-15). A crew kid's vinyl baby-doll head the MERIDIAN swallowed,
//  grown to boss size, resting on the floor of the second biome stage like a dropped toy, a silver dinner fork rammed
//  into its soft spot. The kid is implied, never shown (D46, D53). It replaces the retired midboss (D53): that kit is
//  phase 1. Pure rules and every tuning value: ./_keepsake.ts (KB). Art: render/gross/boss/keepsake.ts.
//
//  ANGLE (D53, rotated): the vinyl face takes x.15, only the crown takes full damage (keepHurtRot), and no damage
//  carries past a phase cut (phaseClamp). The sleep eyes are the universal tell: open means an attack is coming.
//   1 DOZING  (100-65%): the fork fountain (48 f tell, a column on the ship, a gap always), the 60 f open window, and
//                        the aimed throw (46 f line: 30 track + 16 lock)
//     IT WOKE UP  (90 f): crown closed; a hoop mobile of 6 forks lowers from the ceiling over the head
//   2 AWAKE   (65-30%): the head rocks +-32 deg on a 220 f cycle, a clack at each extreme. Crown TOWARD the ship is the
//                        window; tilted away, the crown is only reachable from above, through the mobile. Attacks:
//                        mobile drop (50 f tell per fork, 2-3, never all), the boomerang (54 f line), the wail ring (44 f).
//                        At least KB.p2MinWin windows before it can crack (p2Floor)
//     IT CRACKED (120 f): the vinyl splits; the sleep-eye rocker (two glass eyes on a wire, a lead weight) drops out
//   3 CRACKED (30-0%):   the rocker swings as a slow pendulum (3 s, arc drawn, first swing from rest over 60 f): its weight
//                        blocks shots and kills on contact. The crier ('mama' voice box) is a breakable part: the double
//                        cry (44 + 30 f) ends when it breaks (IT STOPPED CRYING). Fork rain (50 f) and Fountain II (48 f)
//   PUT TO BED: three slow clacks shut, the head tips onto its side, then the kill
//  Each phase has an 18 s clock (HUD fuse). DOZING or AWAKE running out forces the next phase (IT WON'T LET GO); CRACKED
//  running out is the one capped enrage: the eyes stay open, cooldowns x.75, the stage grade capped at B, the recall
//  on a shorter clock (recRage) with more forks planted (plRage). It never escapes (D55, Matt's decision 2): the fight
//  ends only when it or you do. Nothing punishes shooting.
//
//  IT WON'T LET GO (D59, Matt 2026-11-20: package C of production/qa/keepsake-difficulty-proposal-2026-11-20.md, with
//  B's search beam in CRACKED only, and the shared fixes). Today's fight let a ship that never moved kill it unhurt, so:
//   - nothing it throws is lost: a fork that strikes the floor or ceiling PLANTS there, tines out (up to KB.plN), a
//     contact hazard 14 px deep. The fountain's forks fall through to the floor in their columns (they used to stop on
//     one plane under the wound, so every other height was safe)
//   - the RECALL, on its own clock from DOZING on (recEvery: it overlaps the attacks, so it is the fight's second
//     layer): a thread runs from each chosen fork to the wound (50 f, dashed, then a solid 3 px line), then they all
//     fly home along their threads. recallPick keeps a free run of >= recGap px in the ship's column. Every recPer
//     caught forks add a fork to the next fountain
//   - AWAKE's TUG: one thread from the planted fork nearest the ship (54 f), then it is yanked home at twice the pace
//   - CRACKED's cries shake the planted forks loose (floor forks up on the first ring, ceiling forks down on the second)
//     and they plant again on the far side; breaking the crier ends it and slows the pendulum (pPer2)
//   - the SEARCH BEAM (CRACKED): the rocker's glass eyes throw a hatched cone along the wire. If it touches the ship,
//     the ship's column is marked (a hatched band, bTel 50 f, a fill dropping down it), then three forks fall in it
//     from the ceiling. The beam itself never hurts. It only ever looks again bCool frames after the forks fall
//   - DOZING runs at least 3 attacks (p1Floor) and its cut is 75%, AWAKE's 35%; CRACKED's crown line stays at 26
//  Determinism: randomness only R(), audio only sample()/thr() (ar() and the wall clock, never R()), no allocation in
//  the update (every array is made at spawn).
//
//  ---- its sounds: one table (SND), each bank with the fallback it takes while absent or still decoding ----
//  The kboss_* banks are the audio lane's (branch kboss-audio: tools/gen_keepsake_boss_sfx.py's header has the levels and
//  timing points these calls are set to); keep_* are the retired midboss's (D53). Until a bank decodes, sample() is
//  false and the fallback plays. Voice: SLAB's booth slots (tools/booth/slots.ts), silent until a take is recorded.
//   bank / slot           when                                                         fallback
//   kboss_musicbox        the WARNING (with sfx.dread), prio, duckMusic(4.5)           (sfx.dread alone)
//   bark-keepsake-warn    the WARNING: BIG HEAD ON THE SCOPE / RUBBER FACE / GO FOR THE TOP (the one teaching bark)
//   kboss_wake            IT WOKE UP                                                   keep_clack, sfx.roar
//   bark-keepsake-woke    IT WOKE UP: IT'S UP
//   kboss_chime           a mobile fork's drop tell, and 3 staggered as the mobile lowers (silence)
//   kboss_snap            a mobile fork lets go                                        (silence)
//   kboss_roll            each tilt reversal, under keep_clack                         keep_clack
//   bark-keepsake-eyes    AWAKE's first attack tell: EYES OPEN / IT'S COMING
//   kboss_wail            AWAKE's wail ring, at its tell start ('maaa' lands on the ring, 44 f)  keep_wail, sfx.groan
//   kboss_mobilebox       every 540 f while the mobile has forks (AWAKE, CRACKED)      (silence)
//   kboss_crack           IT CRACKED (and the hairline at IT WOKE UP)                  sfx.roar
//   kboss_rocker          IT CRACKED: the eye rocker drops out                         keep_clack
//   bark-keepsake-crack   IT CRACKED: IT'S COMING APART / STAY ON IT
//   kboss_swing           the pendulum, every 90 f (a half swing)                      (silence)
//   kboss_mama            CRACKED's double cry, at the FIRST ring's release            keep_wail, sfx.groan
//   kboss_crierdie        IT STOPPED CRYING                                            sfx.squish
//   kboss_enrage          IT WON'T LET GO (the enrage, and a forced phase)             keep_wail, sfx.roar
//   kboss_shut            PUT TO BED: three clacks, rate 1 / .9 / .8, 40 f apart       keep_clack
//   kboss_topple          PUT TO BED: the head tips onto its side (thud at .38 s)      (silence)
//   kboss_die             PUT TO BED: the crier's last 'ma-'                           keep_wail, sfx.groan
//   kboss_musicend        the kill: the box running down, prio, duckMusic(7)           (silence)
//   boss-keepsake         the kill: SLAB's PUT TO BED readout
//   kboss_creak           a recall's and a tug's threads drawing taut (D59)                keep_whirr slowed
//   kboss_seen            the search beam finds the ship: two glass clicks and a bent tine (D59)  keep_clack
//   keep_tink / keep_throw / keep_whirr (~.9 rate) / keep_thud / keep_squelch / keep_clack: as the midboss had them;
//   keep_whirr also on a recall's release, keep_squelch (quiet) as the forks come home, kboss_chime as cries shake them
// =====================================================================
import { $ } from '../../state';
import { PH, R, W, lerp, rr } from '../../core';
import { bankWant, sample, sfx, thr } from '../../audio';
import { duckMusic } from '../../music';
import { SET } from '../../save';
import { ceilAt, eshots, floorAt } from '../../world';
import { drop, gore, spark, splat } from '../../fx/spawn';
import { cdm } from '../../depth';
import { clearStage } from '../../stages';
import { BS, aimA, banner, eshoot, mk, ring, wrapA } from '../spawn';
import { playerHit } from '../../player';
import { killEnemy, lob, miniReward } from '../update';
import { capGrade, defineBoss } from './registry';
import { KEEPSAKE_BANNERS, KEEPSAKE_LOG, KEEPSAKE_NAME, KEEPSAKE_READOUT } from '../../voice/keepsake';
import { ECON, econId } from '../../economy';
import { CAD_FLOOR, VARIANT_RANK, bulletCap, cadMul, countShots, rank } from '../../rank';
import { tempoK } from '../../tier';
import { KB, KR, beamDir, beamSees, capsuleHit, recallBounds, forkCols, fountLattice, homeTouchJ, inWindow, kbArena, keepHurtRot, lineAtX, lobFrames, mobForkTip, mobForkX, mobTouch, mobilePick, pendA, pendXY, phaseClamp, phaseFloor, plantTouch, recallPick, riseCap, rotXY, tiltAt, tiltEdge, TILT0, p3Floor } from './_keepsake';

const SND = {
  // the midboss's banks (D53 levels), the throws a touch slower for the bigger head
  tink: { vol: .07, wet: .12, spread: .12 }, tinkQ: { vol: .045, wet: .12, spread: .16 },
  throw: { vol: .1, rate: .9, wet: .18, spread: .06 },
  spray: { vol: .07, rate: 1.1, wet: .2, spread: .08 },
  pull: { vol: .11, rate: .75, wet: .2, spread: .08 },
  gape: { vol: .09, rate: .65, wet: .25, spread: .06 },
  out: { vol: .12, rate: .9, wet: .22, spread: .03 }, back: { vol: .1, rate: 1, wet: .22, spread: .03 },
  open: { vol: .27, rate: .95, wet: .1, spread: .05 }, shut: { vol: .24, rate: .8, wet: .1, spread: .05 },
  thud: { vol: .055, rate: .85, wet: .06, spread: .12 }, sq: { vol: .1, rate: .9, wet: .12, spread: .14 },
  wailFb: { vol: .34, rate: .75, wet: .5, spread: .02 }, // keep_wail pitched down: the stand-in crier
  clackFb: { vol: .2, rate: .6, wet: .2, spread: .06 }, //  keep_clack slowed: the stand-in knock
  // the boss's banks (kboss-audio's measured vol and suggested wet)
  musicbox: { vol: .19, wet: .4, spread: 0, prio: true },
  wake: { vol: .23, wet: .3, spread: .03, prio: true },
  chime: { vol: .04, wet: .25, spread: .06 },
  snap: { vol: .1, wet: .15, spread: .06 },
  roll: { vol: .15, wet: .12, spread: .05 },
  wail: { vol: .44, wet: .45, spread: .02, prio: true },
  mobilebox: { vol: .03, wet: .55, spread: .02 },
  crack: { vol: .6, wet: .3, spread: .02 }, hair: { vol: .3, rate: 1.2, wet: .3, spread: .02 },
  rocker: { vol: .17, wet: .25, spread: .04 },
  swing: { vol: .1, wet: .2, spread: .04 },
  mama: { vol: .38, wet: .4, spread: .02, prio: true }, mamaQ: { vol: .38 * .794, wet: .4, spread: .02, prio: true }, // -2 dB: the second and later in a phase
  crierdie: { vol: .15, wet: .3, spread: .02, prio: true },
  enrage: { vol: .25, wet: .35, spread: .02, prio: true },
  shut3: [{ vol: .22, rate: 1, wet: .1, spread: .03 }, { vol: .22, rate: .9, wet: .1, spread: .03 }, { vol: .22, rate: .8, wet: .1, spread: .03 }],
  topple: { vol: .25, wet: .25, spread: .03, prio: true },
  die: { vol: .29, wet: .45, spread: 0, prio: true },
  musicend: { vol: .15, wet: .45, spread: 0, prio: true },
  recue: { vol: .26, rate: .75, wet: .5, spread: .02, prio: true }, // a held ring's own cry: keep_wail, the stand-in crier, under the wail's level
  creak: { vol: .22, wet: .2, spread: .05 }, creakFb: { vol: .1, rate: .55, wet: .2, spread: .05 }, // D59: a recall's threads drawing taut
  seen: { vol: .19, wet: .2, spread: .03, prio: true }, // D59: the beam finds the ship (a tell: prio)
  home: { vol: .05, rate: 1.15, wet: .12, spread: .14 }, // a recalled fork back in the wound: keep_squelch, quiet
  rattle: { vol: .05, wet: .25, spread: .08 }, //            the planted forks shaken by a cry: kboss_chime
  chimes: [{ vol: .04, wet: .25, spread: .06 }, { vol: .04, wet: .25, spread: .06, at: .2 }, { vol: .04, wet: .25, spread: .06, at: .4 }],
};
/** a bank's sound, else the fallback bank's, else the synth one (any of them may be null) */
const ks = (cat, o, fbCat, fbO, fb) => { if (!sample(cat, o) && !(fbCat && sample(fbCat, fbO || o))) fb?.(); };
let tinkT = -1e9;
/** a fork strikes the floor or ceiling (the eshot `land` hook, called from the sim's updateEShots): it plants there
 *  (D59: sim state, no R()), and the midboss's throttled tink (audio only: thr() and the wall clock never reach the sim) */
function forkLand(s) {
  const m = $.G.mini;
  if (m && m.k === 'keepsake' && !m.dead && m.st !== 'dying' && m.pX && s.x > 6 && s.x < W - 6) {
    const wx = s.x + $.G.scroll, f = floorAt(wx), down = s.y >= f;
    plant(m, s.x, down ? f : ceilAt(wx), down ? 1 : -1);
  }
  if (thr('kbT', 40)) return;
  const now = performance.now(), q = now - tinkT < 200;
  tinkT = now;
  ks('keep_tink', q ? SND.tinkQ : SND.tink, null, null, sfx.tink);
}
/** e.hitSnd (roster.ts midHitSnd): the vinyl thud on the face, the squelch in the crown (the ANGLE lesson by ear) */
function hitSnd(_e, m) {
  if (m < 1) { if (!thr('kbH', 60)) ks('keep_thud', SND.thud, null, null, sfx.tink); }
  else if (!thr('kbW', 38)) ks('keep_squelch', SND.sq, null, null, sfx.hit);
  return true;
}
const eyes = (open) => ks('keep_clack', open ? SND.open : SND.shut, null, null, null);

// ---------------- geometry ----------------
const V = new Float32Array(2); // scratch for rotXY / pendXY (sim-only; render has its own)
/** the wound in screen px, at the head's current tilt */
const wX = (e) => (rotXY(KB.wx, KB.wy, e.th, V), e.x + V[0]);
const wY = (e) => (rotXY(KB.wx, KB.wy, e.th, V), e.y + V[1]);
/** the head's hitboxes (e.hb: the wound and the crown cap) turned to the tilt, in place */
function turnHb(e) {
  rotXY(KB.wx, KB.wy, e.th, V); e.hb[0][0] = V[0]; e.hb[0][1] = V[1];
  rotXY(0, KB.cy, e.th, V); e.hb[1][0] = V[0]; e.hb[1][1] = V[1];
  e.wy = e.hb[0][1]; // the probe bot's aim (tools/boss-probe.mjs: e.y + e.wy), as the midboss had
}
// ---------------- the difficulty rebuild (DIFFICULTY-SPEC §2.3, the KEEPSAKE row; W0 contract §5.6), read here only ----------------
/** the rebuild's rules apply: a long entry with a HardSet (long4). THE KEEPSAKE is placed on picker layouts only
 *  (registry.ts bossFor: long4 is the only one today); a layout without a HardSet would keep D59's numbers (spec §5.3) */
const hardOn = () => !!ECON[econId()].hard;
/** the idle between attacks. long4: the one rank rule, KB's idle x rank.ts cadMul (1.25 - .6 rho) x the enrage's .75,
 *  never under CAD_FLOOR (18 f, C2). The depth term (cdm) is not applied there: rank already carries the stage and the
 *  descent. r4 pressure: x the tier's fight tempo (tier.ts TIER.tempo, 1 on Normal). Elsewhere D59's (1 - .3 G.rank) x cdm() x rage */
const cd = (e) => {
  const I = [KB.cool, KB.cool2, KB.cool3][e.ph], rg = e.rage ? KB.rage : 1;
  return hardOn() ? Math.max(CAD_FLOOR, Math.round(I * cadMul($) * rg * tempoK())) : Math.round(I * (1 - .3 * ($.G.rank || 0)) * cdm() * rg);
};
/** the forks the recall needs planted before it calls: KR.recMinHi at rank >= VARIANT_RANK on long4 (C3), else KB's */
const recMin = () => (hardOn() && rank($) >= VARIANT_RANK ? KR.recMinHi : KB.recMin);
/** the ring sizes: KR's trims on long4 (gate B3), KB's elsewhere */
const wailN = () => (hardOn() ? KR.wailN : KB.wailN);
const mamaN = () => (hardOn() ? KR.mamaN : KB.wailN);
/** does a volley of n more counted shots fit under the stage-boss cap (rank.ts bulletCap 'boss': 24 on Normal)? The
 *  counted eshots now plus e.rsv, the shots this fight has reserved and not yet released (a fountain's staggered forks,
 *  a drop's). Volleys are atomic (spec §2.1): one that doesn't fit waits (hold) and none of it spawns. Always true off
 *  long4. Reads the sim only: no R() */
const fits = (e, n) => !hardOn() || countShots(eshots) + e.rsv + n <= bulletCap($, 'boss');
/** a release that doesn't fit: the attack holds on this frame (its tell stays up) and looks again KR.retry frames later */
function hold(e) { e.wt--; e.hd = KR.retry - 1; e.hl = 1; e.hdN++; } // this frame + KR.retry - 1 = KR.retry; e.hdN: the probes' hold count
/** the planted forks on side (1 floor, -1 ceiling) a cry would shake loose now (free of threads) */
function shakeN(e, side) { let n = 0; for (let i = 0; i < e.pn; i++) if (e.pS[i] === side && !e.pQ[i]) n++; return n; }
/** the floor the next hit may not pass (no carry, D55) */
const floorOf = (e) => (e.ph === 2 && hardOn() ? e.max * p3Floor(e.d3) : phaseFloor(e.max, e.ph, e.wins, e.d0));
/** CRACKED may be put to bed: its floor reached and, on long4, KR.p3MinAtt attacks finished (or the enrage) */
const p3Done = (e) => !hardOn() || e.d3 >= KR.p3MinAtt || e.rage;

/** e.armor (roster.ts midMul, every damage path): the rotated ANGLE share, x.15 through a transition (the crown is
 *  closed for that beat), clamped so no damage carries past a phase cut. Writes nothing */
function armor(e, d, hx, hy) {
  if (e.st === 'dying') return 0;
  const m = e.tr > 0 ? KB.face : keepHurtRot(e.x, e.y, e.th, hx, hy, e.ph === 2 ? KB.crown3 : KB.crown);
  return phaseClamp(e.hp, d, m, floorOf(e));
}
/** a part's armour: the rocker's weight tinks (it blocks the shot), the crier takes everything */
const rockArmor = () => 0;

// ---------------- the attacks ----------------
function rest(e) { e.st = 'idle'; e.wt = 0; e.cool = cd(e); e.rsv = 0; e.hd = 0; e.hl = 0; if (!e.rage) eyes(false); }

/** plan a fountain (phase 0: 4-5 of 6 columns; phase 2: 5 of 7), drawn at the tell's first frame */
function planFount(e) {
  const p3 = e.ph === 2, sl = p3 ? KB.slots3 : KB.slots, base = p3 ? 5 : 4 + (R() < .5 ? 1 : 0);
  const more = Math.max(0, Math.min(sl - 1 - base, Math.floor(e.rl / KB.recPer))); // the forks it caught come back out (D59)
  e.rl -= more * KB.recPer;
  fountLattice($.P.x, e.x, sl, p3 ? KB.pitch3 : KB.pitch, KB.x0, e.lat);
  e.fn = forkCols(base + more, sl, e.lat[1], e.lat[0], KB.jit, 12, W - 8, R, e.fx, e.fu, e.lat[2]);
  // D59: every fork falls through to the floor in its column; the ship's column's fork is aimed through where the ship
  // is at the tell's first frame (its mark sits there), then falls on to the floor
  let must = -1;
  if (e.lat[2] >= 0) { must = 0; for (let s = 0; s < e.lat[2]; s++) must += e.fu[s]; }
  for (let i = 0; i < e.fn; i++) {
    e.fl[i] = 1e9; e.fq[i] = rr(KB.u0, KB.u1);
    const fl = Math.min(PH - 2, floorAt(e.fx[i] + $.G.scroll)) - 1;
    e.fz[i] = i === must ? Math.min(fl, Math.max($.P.y, KB.top + 40)) : fl;
  }
}
// S1 (W6 tune-tf, DIFFICULTY-SPEC §2.1 V_CAP): the forks that FALL (fk 1: the fountain's lobs here, the mobile's drops below)
// are exempt from the long4 falling-glob clamp (shots.ts skips s.fk) and so from S1's max: they fall up to ~3.3 px/f. They are
// not aimed bullets a ship must outrun: each falls down a column marked >= 48 f ahead (the fountain's marks, a mobile fork's
// 50 f chime and shiver), the same class as the Bloat's curtain icicles (biome hazards, never in S1). Clamping them would
// put every fork behind the lattice the marks and the fount's clock (e.fl, lobFrames) promise. The thrown forks (fk 2, the
// aim fan) and the cry's shaken forks are eshoot shots and keep the cap. The probe's S1 is asked to leave fk 1 out (request)
function launch(e, i) {
  if (e.rsv > 0) e.rsv--;
  const x = wX(e), y = wY(e) - 4, n0 = eshots.length;
  const u = riseCap(e.fq[i], y), T = lobFrames(u, e.fz[i] - y);
  lob(x, y, e.fx[i], e.fz[i], u / BS());
  if (eshots.length > n0) { eshots[n0].fk = 1; eshots[n0].land = forkLand; }
  e.fl[i] = e.wt + Math.ceil(T);
  e.fv[i] = (e.fx[i] - x) / T; e.fw[i] = -u + .025 * T;
  for (let k = 0; k < 3; k++) drop(x + rr(-3, 3), y, rr(-.8, .8), -rr(.5, 1.6), 1.2, 0, 50);
}
/** a hanging mobile fork i: its tip, screen px (the hoop drifts with the head) */
const mobX = mobForkX;
const mobTip = mobForkTip;
/** fork i of the mobile lets go: a straight drop (u 0), drawn as a fork, tinks where it lands */
function dropFork(e, i) {
  const x = mobX(e, i), y = mobTip(e, i), n0 = eshots.length;
  lob(x, y, x, floorAt(x + $.G.scroll), 0);
  if (eshots.length > n0) { const f = eshots[n0]; f.fk = 1; f.fs = KB.mobFs; f.r = KB.mobHit; f.land = forkLand; } // drawn at the mobile's scale (render/hud.ts), its hitbox the hanging fork's
  e.ma[i] = 0;
  if (e.rsv > 0) e.rsv--;
}
/** the mobile's forks touch the ship (a contact hazard at the fork's middle and tip) */
function mobileHit(e) {
  if ($.P.alive && mobTouch(e, $.P.x, $.P.y)) playerHit(); // _keepsake.ts: the probes read the same geometry (keepTouch)
}

// ---------------- IT WON'T LET GO (D59): the planted forks, the threads, the flights home ----------------
/** a fork planted at screen (x, y) on the floor (side 1, tines up) or the ceiling (-1, tines down). Full: the oldest one
 *  not on a thread falls away (all of them on threads: this one bounces off) */
function plant(e, x, y, side) {
  const cap = e.rage ? KB.plRage : KB.plN;
  if (e.pn >= cap) {
    let o = -1;
    for (let i = 0; i < e.pn; i++) if (!e.pQ[i] && (o < 0 || e.pB[i] < e.pB[o])) o = i;
    if (o < 0) return;
    drop(e.pX[o] - $.G.scroll, e.pY[o] - e.pS[o] * 6, rr(-.5, .5), -e.pS[o] * rr(.2, .8), 1.4, 0, 70);
    unplant(e, o);
  }
  const i = e.pn++;
  e.pX[i] = x + $.G.scroll; e.pY[i] = y; e.pS[i] = side; e.pB[i] = e.t; e.pQ[i] = 0;
}
/** remove planted fork i (the last one takes its place: order doesn't matter, pB keeps the age) */
function unplant(e, i) {
  const j = --e.pn;
  e.pX[i] = e.pX[j]; e.pY[i] = e.pY[j]; e.pS[i] = e.pS[j]; e.pB[i] = e.pB[j]; e.pQ[i] = e.pQ[j];
}
/** planted fork i's tip (where its thread starts and where a cry shakes it loose from), screen px, into V */
function tipOf(e, i) { V[0] = e.pX[i] - $.G.scroll; V[1] = e.pY[i] - e.pS[i] * 9; return V; }
/** the planted forks touch the ship: a contact at 4 and 10 px out from the surface */
function plantHit(e) {
  if ($.P.alive && plantTouch(e, $.G.scroll, $.P.x, $.P.y)) playerHit();
}
/** a planted fork's thread: 0 none, TUG, RECALL (pQ) */
const TUG = 1, RECALL = 2;
/** clear every thread of kind q */
const cut = (e, q) => { for (let i = 0; i < e.pn; i++) if (e.pQ[i] === q) e.pQ[i] = 0; };
/** choose the threads and lock their end on the wound (tug: tux/tuy, recall: rtx/rty). The recall: recallPick keeps a
 *  free run of >= recGap in the ship's column (a tug's thread already drawn counts against it). The tug: the free
 *  planted fork nearest the ship's x, out in front of the head. Returns the count chosen (the recall needs >= 2) */
function pickThreads(e, one) {
  if (one) {
    if (e.rcW > 0) return 0; // a recall's threads are live: its gap was checked without this one, so no tug now
    e.tux = wX(e); e.tuy = wY(e);
    let b = -1, bd = 1e9;
    for (let i = 0; i < e.pn; i++) {
      if (e.pQ[i]) continue;
      tipOf(e, i);
      const d = Math.abs(V[0] - $.P.x);
      if (V[0] < e.x - 50 && V[0] > 6 && d < bd) { b = i; bd = d; }
    }
    if (b >= 0) e.pQ[b] = TUG;
    return b >= 0 ? 1 : 0;
  }
  e.rtx = wX(e); e.rty = wY(e);
  // the gap is checked where the ship can fly (its clamp, review 2026-11-20), less a planted fork standing in its column;
  // a live tug's thread counts against it first (it flies whatever the recall picks)
  const wx = $.P.x + $.G.scroll, sc = $.G.scroll;
  let cf = 0, ff = 0, nf = 0;
  for (let i = 0; i < e.pn; i++) {
    if (Math.abs(e.pX[i] - sc - $.P.x) <= 8 && e.pQ[i] !== RECALL) { if (e.pS[i] > 0) ff = 1; else cf = 1; }
    tipOf(e, i);
    if (e.pQ[i] === TUG) { e.fx2[nf++] = lineAtX(V[0], V[1], e.tux, e.tuy, $.P.x); e.ys[i] = NaN; }
    else e.ys[i] = lineAtX(V[0], V[1], e.rtx, e.rty, $.P.x);
  }
  recallBounds(ceilAt(wx), floorAt(wx), 6, PH - 6, cf, ff, V);
  recallPick(e.ys, e.pn, V[0], V[1], KB.recW, KB.recGap, e.kp, e.cu, e.tm, e.fx2, nf);
  let k = 0;
  for (let i = 0; i < e.pn; i++) if (e.kp[i] && !e.pQ[i]) { e.pQ[i] = RECALL; k++; }
  if (k < 2) cut(e, RECALL);
  return k;
}
/** the forks on threads of kind q let go of the floor and ceiling and fly home along them at sp px/f (x BS) */
function release(e, q, sp) {
  const tx = q === TUG ? e.tux : e.rtx, ty = q === TUG ? e.tuy : e.rty;
  for (let i = e.pn - 1; i >= 0; i--) {
    if (e.pQ[i] !== q) continue;
    if (e.fh >= e.hX.length) { e.pQ[i] = 0; continue; } // no room in flight (never at 2 x plRage): it stays, its thread cut
    tipOf(e, i);
    const dx = tx - V[0], dy = ty - V[1], d = Math.hypot(dx, dy) || 1, v = sp * BS(), j = e.fh++;
    e.hX[j] = V[0]; e.hY[j] = V[1]; e.hVX[j] = dx / d * v; e.hVY[j] = dy / d * v; e.hF[j] = Math.ceil(d / v);
    unplant(e, i);
  }
  ks('keep_whirr', SND.out, null, null, sfx.lash);
}
/** the forks in flight home: move, touch the ship, and go back into the wound when they arrive (one more fork in the
 *  next fountain every recPer of them). The touch is swept (greenhit's tunnelling fix, shots.ts eshotTouches): the
 *  fork's step against the ship's move since the last enemy-shot test (P.ex/P.ey, the end of the last updateEShots).
 *  It was a point test at the end of the frame only, so a tug's fork (6 px/f x BS) could cross a moving ship's 7.1 px
 *  reach between two tests untouched */
function homeFly(e) {
  const P = $.P, lx = P.ex ?? P.x, ly = P.ey ?? P.y;
  for (let j = e.fh - 1; j >= 0; j--) {
    e.hX[j] += e.hVX[j]; e.hY[j] += e.hVY[j];
    if (P.alive && homeTouchJ(e, j, lx, ly, P.x, P.y)) playerHit();
    if (--e.hF[j] <= 0) {
      e.rl++;
      if (!thr('kbHome', 50)) ks('keep_squelch', SND.home, null, null, null);
      const k = --e.fh;
      e.hX[j] = e.hX[k]; e.hY[j] = e.hY[k]; e.hVX[j] = e.hVX[k]; e.hVY[j] = e.hVY[k]; e.hF[j] = e.hF[k];
    }
  }
}
/** a cry shakes the planted forks on one side loose (1 floor: up, -1 ceiling: down); they plant again where they strike */
function shake(e, side) {
  if (!fits(e, shakeN(e, side))) return; // safety only: the cry reserved ring + shake together (attack 'mama')
  for (let i = e.pn - 1; i >= 0; i--) {
    if (e.pS[i] !== side || e.pQ[i]) continue;
    tipOf(e, i);
    const n0 = eshots.length;
    eshoot(V[0], V[1], side > 0 ? -Math.PI / 2 : Math.PI / 2, KB.shakeSp, 'spike');
    if (eshots.length > n0) { eshots[n0].fk = 1; eshots[n0].land = forkLand; }
    unplant(e, i);
  }
}
/** CRACKED's search beam (D59): from the rocker's weight along its wire. When it sees the ship, the ship's column is
 *  marked, and bTel frames later three forks fall in it from the ceiling. It looks again bCool frames after they fall */
function beam(e) {
  beamDir(e.pa, e.th, V);
  e.bdx = V[0]; e.bdy = V[1]; e.box = e.rocker.x; e.boy = e.rocker.y;
  if (e.mkT > 0) {
    if (e.mkT === 1 && e.hdB > 0) { e.hdB--; return; } // the band stays marked, full, while its forks wait for room
    if (e.mkT === 1 && !fits(e, KB.bRainN)) { e.hdB = KR.retry; return; }
    if (--e.mkT === 0) {
      for (let k = 0; k < KB.bRainN; k++) {
        const x = e.mkX + (k - (KB.bRainN - 1) / 2) * KB.bRainDx, n0 = eshots.length;
        eshoot(x, Math.max(2, ceilAt(x + $.G.scroll)) + 3, Math.PI / 2, KB.bRainSp, 'spike');
        if (eshots.length > n0) { eshots[n0].fk = 1; eshots[n0].land = forkLand; }
      }
      ks('keep_throw', SND.spray, null, null, sfx.lash);
      e.bCd = KB.bCool;
    }
    return;
  }
  if (e.bCd > 0) { e.bCd--; return; }
  if (e.p3t < KB.pRamp + KB.bArm || !$.P.alive) return;
  if (beamSees(e.box, e.boy, e.bdx, e.bdy, $.P.x, $.P.y)) {
    e.mkT = KB.bTel; e.mkX = Math.max(KB.bRainDx + 8, Math.min(W - KB.bRainDx - 8, $.P.x)); e.spots++;
    ks('kboss_seen', SND.seen, 'keep_clack', SND.open, sfx.tele);
  }
}

/** the next attack of phase ph, by turn (D59): DOZING fountain / throw; AWAKE drop / boomerang / tug / drop / wail;
 *  CRACKED Fountain II / double cry / rain / double cry (a throw once the crier is broken, rain falls back to a fountain
 *  when the mobile has one fork left; a tug with no fork in front of the head is a throw: startAttack). The recall is
 *  not a turn: it runs on its own clock (recallTick) */
function nextAttack(e) {
  const k = e.att++ % (e.ph === 1 ? 5 : 4);
  if (e.ph === 0) return k % 2 === 0 ? 'tell' : 'aim';
  if (e.ph === 1) return k === 0 || k === 3 ? (live(e) > 1 ? 'drop' : 'aim') : k === 1 ? 'boom' : k === 2 ? 'tug' : 'wail';
  if (k === 0) return 'tell';
  if (k === 2) return live(e) > 1 ? 'rain' : 'tell';
  return e.crier && !e.crier.dead ? 'mama' : 'aim';
}
/** the recall's own clock (D59): every recEvery frames (the phase's; recRage once it rages), with at least recMin forks
 *  planted, its 50 f of threads, then the forks fly home. It overlaps whatever attack is running: the second layer */
function recallTick(e) {
  if (e.rcW > 0) {
    if (++e.rcW >= KB.recall) { release(e, RECALL, KB.recSp); e.rcW = 0; e.rcT = e.rage ? KB.recRage : KB.recEvery[e.ph]; e.recalls++; }
    return;
  }
  if (--e.rcT > 0) return;
  if (e.pn >= recMin() && pickThreads(e, false) >= 2) { e.rcW = 1; ks('kboss_creak', SND.creak, 'keep_whirr', SND.creakFb, sfx.tele); }
  else e.rcT = 30; // not enough to call: look again shortly
}
const live = (e) => { let n = 0; for (let i = 0; i < KB.mobN; i++) n += e.ma[i]; return n; };

function startAttack(e) {
  e.st = nextAttack(e); e.wt = 0;
  if (e.st === 'tug' && !pickThreads(e, true)) e.st = 'aim';
  eyes(true);
  if (e.ph === 1 && !e.barked) { e.barked = 1; sample('bark-keepsake-eyes', { vol: 1.15, spread: .02, wet: .16 }); } // AWAKE's first tell: EYES OPEN / IT'S COMING
  if (e.st === 'tell') { planFount(e); sfx.squish(); }
  else if (e.st === 'wail') ks('kboss_wail', SND.wail, 'keep_wail', SND.wailFb, sfx.groan);
  else if (e.st === 'mama') sfx.tele(); // its cry lands on the first ring (kboss_mama is timed from that release)
  else if (e.st === 'tug') ks('kboss_creak', SND.creak, 'keep_whirr', SND.creakFb, sfx.tele); // the threads drawing taut
  else if (e.st === 'drop' || e.st === 'rain') {
    e.dn = mobilePick(e.ma, KB.mobN, e.st === 'rain' ? KB.mobN : 2 + (R() < .5 ? 1 : 0), R, e.dq);
    sfx.tele();
  } else { e.la = aimA(wX(e), wY(e)); sfx.tele(); }
}

function attack(e) {
  const st = e.st;
  if (st === 'tell') {
    if (R() < .4) spark(wX(e) + rr(-7, 7), wY(e) - rr(0, 6), rr(-.3, .3), -rr(.4, 1.2), 12, '#e8e2d8');
    if (e.wt >= KB.tell && !fits(e, e.fn)) hold(e);
    else if (e.wt >= KB.tell) { e.st = 'fount'; e.wt = 0; e.rsv = e.fn; ks('keep_throw', SND.spray, null, null, sfx.lash); ks('keep_squelch', SND.pull, null, null, null); }
  } else if (st === 'fount') {
    const i = (e.wt - 1) / KB.stagger;
    if (i === (i | 0) && i < e.fn) { launch(e, i); if (i === e.fn - 1) { if (e.ph === 0) e.d0++; else if (e.ph === 2) e.d3++; } } // DOZING's (D59) and CRACKED's (KR.p3MinAtt) floors count an attack once its forks are out
    let left = 0;
    for (let j = 0; j < e.fn; j++) if (e.wt < e.fl[j]) left++;
    if (!left) { e.st = 'open'; e.wt = 0; ks('keep_squelch', SND.gape, null, null, sfx.squish); }
  } else if (st === 'open') {
    if (R() < .25) drop(wX(e) + rr(-6, 6), wY(e) + 2, rr(-.4, .4), rr(-.6, .2), 1.2, 0, 60);
    if (e.wt >= KB.open) rest(e);
  } else if (st === 'aim') {
    if (e.wt < KB.aim - KB.lock) { e.la += wrapA(aimA(wX(e), wY(e)) - e.la) * .12; e.lx = wX(e); e.ly = wY(e); }
    if (e.wt >= KB.aim && !fits(e, e.ph ? 3 : 1)) hold(e);
    else if (e.wt >= KB.aim) {
      for (let k = e.ph ? -1 : 0; k <= (e.ph ? 1 : 0); k++) { // DOZING one fork; from AWAKE on a fan of three (D59)
        const n0 = eshots.length;
        eshoot(e.lx, e.ly, e.la + k * KB.fan, KB.throwSp, 'spike');
        if (eshots.length > n0) { eshots[n0].fk = 2; eshots[n0].land = forkLand; }
      }
      ks('keep_throw', SND.throw, null, null, sfx.lash);
      if (e.ph === 0) e.d0++; else if (e.ph === 2) e.d3++;
      rest(e);
    }
  } else if (st === 'boom') { // the big fork's line tracks, then locks from where the wound is at the lock (the head rocks on)
    if (e.wt < KB.boomTel - KB.boomLock) { e.la += wrapA(aimA(wX(e), wY(e)) - e.la) * .1; e.lx = wX(e); e.ly = wY(e); }
    if (e.wt >= KB.boomTel) {
      const dx = Math.cos(e.la), dy = Math.sin(e.la), x0 = e.lx, y0 = e.ly;
      let L = dx < -.05 ? (x0 - KB.boomEnd) / -dx : 400;
      if (dy < -.05) L = Math.min(L, (y0 - 6) / -dy);
      if (dy > .05) L = Math.min(L, (PH - 6 - y0) / dy);
      e.bl = Math.max(40, L); e.bs = 0; e.bd = 1; e.bsa = e.la; e.bx = x0; e.by = y0;
      e.st = 'fly'; e.wt = 0; ks('keep_whirr', SND.out, null, null, sfx.lash); $.G.shake += 2;
    }
  } else if (st === 'fly') {
    e.bs += e.bd * KB.boomSp;
    if (e.bs >= e.bl) { e.bs = e.bl; e.bd = -1; ks('keep_whirr', SND.back, null, null, sfx.chain); }
    e.bx = e.lx + Math.cos(e.la) * e.bs; e.by = e.ly + Math.sin(e.la) * e.bs;
    e.bsa += KB.boomSpin; // the spin the render draws
    if ($.P.alive && capsuleHit(e.bx, e.by, e.bsa, KB.boomHalf, KB.boomR + 2.6, $.P.x, $.P.y)) playerHit();
    if (e.bd < 0 && e.bs <= 0) { e.bs = 0; rest(e); }
  } else if (st === 'wail') {
    if (e.wt >= KB.wail && !fits(e, wailN())) hold(e);
    else if (e.wt >= KB.wail) {
      ring(e.x, e.y - 10, wailN(), e.t * .05, KB.wailSp);
      if (e.hl) ks('keep_wail', SND.recue, null, null, sfx.groan); // held: kboss_wail's 'maaa' landed at 44 f on no ring, so the ring gets its own cry
      rest(e);
    }
  } else if (st === 'mama') { // the first cry is the second's tell; the second is turned half a gap
    const mn = mamaN();
    // each cry is one volley: its ring and the planted forks it shakes loose (floor forks on the first, ceiling on the second)
    if ((e.wt === KB.mama && !fits(e, mn + shakeN(e, 1))) || (e.wt === KB.mama + KB.mamaGap && !fits(e, mn + shakeN(e, -1)))) hold(e);
    else if (e.wt === KB.mama) { e.hl = 0; e.ra = e.t * .05; ring(e.x + KB.crx, e.y + KB.cry, mn, e.ra, KB.wailSp); shake(e, 1); ks('kboss_mama', e.mamaN++ ? SND.mamaQ : SND.mama, 'keep_wail', SND.wailFb, sfx.groan); } // -2 dB after a phase's first
    if (e.wt === 1 && e.pn && !thr('kbRat', 30)) sample('kboss_chime', SND.rattle); // the planted forks rattle: they go on the rings
    if (e.wt >= KB.mama + KB.mamaGap) {
      ring(e.x + KB.crx, e.y + KB.cry, mn, e.ra + Math.PI / mn, KB.wailSp); shake(e, -1);
      if (e.hl) ks('keep_wail', SND.recue, null, null, sfx.groan); // held: kboss_mama's baked second 'MA' (30 f) landed on no ring
      e.d3++; rest(e);
    }
  } else if (st === 'tug') { // one thread drawn from the wound (locked at the tell's start), then the fork is yanked home
    if (e.wt >= KB.tug) { release(e, TUG, KB.tugSp); rest(e); }
  } else if (st === 'drop' || st === 'rain') { // each fork shudders for its tell (staggered), then lets go
    const gap = st === 'rain' ? 6 : KB.dropGap, tel = st === 'rain' ? KB.rain : KB.drop;
    if (e.wt === tel && !fits(e, e.dn)) { hold(e); return; } // the drop is one volley, reserved at its first fork
    if (e.wt === tel) e.rsv = e.dn;
    for (let k = 0; k < e.dn; k++) {
      if (e.wt === 1 + k * gap) sample('kboss_chime', SND.chime); // its tell starts: the fork rattles on the hoop
      if (e.wt === tel + k * gap) {
        if (e.ma[e.dq[k]]) { dropFork(e, e.dq[k]); sample('kboss_snap', SND.snap); } else if (e.rsv > 0) e.rsv--;
        if (k === e.dn - 1 && e.ph === 2) e.d3++; // CRACKED's floor: the rain is out
      }
    }
    if (e.wt >= tel + (e.dn - 1) * gap + 20) rest(e);
  }
}

// ---------------- the phases ----------------
function phaseTo(e, ph, late) {
  e.ph = ph; e.pt = 0; e.tr = ph === 1 ? KB.tr1 : KB.tr2; e.st = 'idle'; e.wt = 0; e.cool = 30; e.att = 0; e.wins = 0; e.mamaN = 0; e.rsv = 0; e.hd = 0; e.hl = 0;
  for (let i = 0; i < e.pn; i++) e.pQ[i] = 0; // the threads are cut with the attack (the forks stay planted)
  e.rcW = 0; e.rcT = KB.recEvery[ph];
  if (late) { banner(KEEPSAKE_BANNERS.hold, KEEPSAKE_BANNERS.late, '#ff8a3a', 110); ks('kboss_enrage', SND.enrage, null, null, null); }
  else banner(ph === 1 ? KEEPSAKE_BANNERS.woke : KEEPSAKE_BANNERS.cracked, '', undefined, 100);
  eyes(true);
  if (ph === 1) sample('bark-keepsake-woke', { vol: 1.15, spread: .02, wet: .16 }); // IT'S UP
  else sample('bark-keepsake-crack', { vol: 1.15, spread: .02, wet: .16 }); // IT'S COMING APART / STAY ON IT
  $.G.shake = Math.max($.G.shake, ph === 2 ? 6 : 3);
  if (ph === 1) {
    ks('kboss_wake', SND.wake, 'keep_clack', SND.open, sfx.roar); ks('kboss_crack', SND.hair, null, null, null);
    for (const o of SND.chimes) sample('kboss_chime', o); // the mobile coming down, three forks rattling
    e.tc = TILT0;
  } // the rocking starts mid-roll, upright, rolling toward a window
  else {
    ks('kboss_crack', SND.crack, null, null, sfx.roar); ks('kboss_rocker', SND.rocker, 'keep_clack', SND.clackFb, null); // the rocker drops out
    gore(e.x - 10, e.y - 20, 2, { chain: 0 });
    for (let k = 0; k < 20; k++) drop(e.x + rr(-20, 10), e.y + rr(-30, 10), rr(-2, 1), rr(-2, .5), 1.4, R() < .4 ? 2 : 0, 80);
  }
}
/** CRACKED's parts, spawned when the transition ends: the rocker's weight (a shot blocker) and the crier */
function crack3(e) {
  const o = { par: e, hpm: KB.crHp / 16 }; // nailbar's 16 HP x 2.5 = 40, x depth (depthHP: a part takes its boss's factor)
  e.rocker = mk('nailbar', e.x + KB.pvx, e.y + KB.pvy + KB.pLen, { ...o, ox: KB.pvx, oy: KB.pvy + KB.pLen, r: KB.pR, kp: 'rocker', armor: rockArmor, score: 0, bio: 0 });
  e.crier = mk('nailbar', e.x + KB.crx, e.y + KB.cry, { ...o, ox: KB.crx, oy: KB.cry, r: KB.crR, kp: 'crier', score: 1200, bio: 6 });
  e.parts = [e.rocker, e.crier]; // shots.ts: a shot meeting a part and the head takes the part (the crier sits over the face)
  e.p3t = 0;
}

function update(e) {
  // the roll-in: along the floor from the right edge, then it rests
  const fl = Math.min(PH - 2, floorAt(e.x + $.G.scroll), floorAt(e.x - 30 + $.G.scroll), floorAt(e.x + 30 + $.G.scroll));
  e.x = lerp(e.x, e.tx, .03);
  e.y = lerp(e.y, fl - KB.rest, .2);
  if (e.st === 'dying') return dying(e);
  // the tilt: AWAKE rocks on its cycle (it keeps rocking through every attack: its lines lock where the wound was);
  // the other phases ease back upright
  let th = 0;
  if (e.ph === 1 && e.tr <= 0) {
    th = tiltAt(e.tc);
    const edge = tiltEdge(e.tc);
    if (edge) { sample('kboss_roll', SND.roll); eyes(true); } // the knock and the eyes' clack at each extreme
    if (e.tc > 0 && inWindow(e.tc - 1) && !inWindow(e.tc)) e.wins++; // a window just closed (p2Floor's count)
    e.tc++;
  }
  e.th = lerp(e.th, th, e.ph === 1 && e.tr <= 0 ? 1 : .08);
  turnHb(e);
  // the mobile: lowers through IT WOKE UP, stays for good; its forks are contact hazards
  if (e.ph >= 1) {
    e.my = lerp(e.my, KB.mobY, e.tr > 0 ? .04 : .2); mobileHit(e);
    if (e.mbT++ % 540 === 0 && live(e)) sample('kboss_mobilebox', SND.mobilebox); // the box, faint, in the world
  }
  // CRACKED: the pendulum and its parts
  if (e.ph === 2 && e.tr <= 0) {
    if (!e.rocker) crack3(e);
    // the swing's phase is carried, so breaking the crier slows it (pPer2) without a jump (D59)
    const c0 = Math.cos(e.pph);
    e.pph += (Math.PI * 2) / (e.crier && e.crier.dead ? KB.pPer2 : KB.pPer);
    e.pa = pendA(e.p3t++, e.pph);
    pendXY(e.pa, V); rotXY(V[0], V[1], e.th, V);
    e.rocker.ox = V[0]; e.rocker.oy = V[1]; e.rocker.x = e.x + V[0]; e.rocker.y = e.y + V[1]; e.rocker.hp = e.rocker.max;
    if ((c0 > 0) !== (Math.cos(e.pph) > 0)) sample('kboss_swing', SND.swing); // an end of the swing (the turn), every half period
    beam(e);
    if (e.crier) {
      e.crier.x = e.x + KB.crx; e.crier.y = e.y + KB.cry;
      if (e.crier.dead && !e.crierGone) {
        e.crierGone = 1;
        banner(KEEPSAKE_BANNERS.quiet, '', '#cfd9e3', 90);
        ks('kboss_crierdie', SND.crierdie, null, null, sfx.squish);
        if (e.st === 'mama') rest(e);
      }
    }
  }
  // the hoard (D59): the planted forks are hazards, and the forks flying home keep flying whatever the head does
  plantHit(e); homeFly(e);
  if (!$.P.alive) return;
  // the clock: waits out the roll-in and the transitions, pauses while you're dead
  if (e.t >= KB.enter && e.tr <= 0 && !e.rage) {
    e.pl = KB.clock; e.pt++;
    if (e.pt >= KB.clock) {
      if (e.ph < 2) { if (e.ph === 1) e.wins = KB.p2MinWin; else e.d0 = KB.p1MinAtt; e.hp = Math.min(e.hp, floorOf(e)); e.late = 1; } // IT WON'T LET GO: forced on
      else { // the one capped enrage: never escapes, the grade capped at B
        e.rage = 1; e.pl = 0; e.rcT = Math.min(e.rcT, KB.recRage);
        banner(KEEPSAKE_BANNERS.hold, KEEPSAKE_BANNERS.rage, '#ff3a2a', 140);
        ks('kboss_enrage', SND.enrage, 'keep_wail', SND.wailFb, sfx.roar);
        if ($.G.st) $.G.st.gcap = capGrade($.G.st.gcap || 'S', KB.rageGrade);
      }
    }
  }
  // a phase cut reached: the transition (an attack in flight is dropped with it, and so is the boomerang)
  if (e.tr <= 0 && e.ph < 2 && !(e.ph === 0 && e.st === 'fount' && !e.late) && e.hp <= floorOf(e) + 1e-6 && ((e.ph === 0 ? e.d0 >= KB.p1MinAtt : e.wins >= KB.p2MinWin) || e.late)) { phaseTo(e, e.ph + 1, e.late); e.late = 0; return; } // W6 K1: DOZING's last fountain lands inside DOZING (its forks are out, so it counted, but they fell in AWAKE). Ungated: THE KEEPSAKE is placed on picker layouts only (bossFor); gate it on g3() if a picker layout without the hard set ever places it
  if (e.ph === 2 && e.hp <= e.max * KB.end + 1e-6 && p3Done(e)) { e.st = 'dying'; e.wt = 0; e.r = 0; e.hb = null; e.pl = 0; letGo(e); return; }
  if (e.tr > 0) { e.tr--; if (e.tr === 0) eyes(false); return; }
  if (e.t < KB.enter) return;
  recallTick(e);
  if (e.hd > 0) e.hd--; // a held volley (fits): the attack waits on its release frame; the recall and the beam run on
  else {
    e.wt++;
    if (e.st === 'idle') { if (e.wt >= e.cool) startAttack(e); }
    else attack(e);
  }
  if (R() < .06) spark(e.x + rr(-30, 30), e.y + rr(-30, 30), 0, -rr(.2, .6), 18, '#d8d0c0');
}

/** PUT TO BED: it lets go at last. The planted forks drop out of the floor and ceiling, the ones in flight fall, the
 *  beam's mark goes */
function letGo(e) {
  const sc = $.G.scroll;
  for (let i = 0; i < e.pn; i++) drop(e.pX[i] - sc, e.pY[i] - e.pS[i] * 6, rr(-.6, .6), -e.pS[i] * rr(.2, 1), 1.4, 0, 80);
  for (let j = 0; j < e.fh; j++) drop(e.hX[j], e.hY[j], e.hVX[j] * .2, e.hVY[j] * .2, 1.4, 0, 80);
  e.pn = 0; e.fh = 0; e.mkT = 0;
}
/** PUT TO BED: three slow clacks shut (the last one final), the head tips onto its side, the crier's last 'ma-' */
function dying(e) {
  e.wt++;
  if (e.wt === 1) eshots.length = 0;
  const b = (e.wt - 1) / KB.dieBeat; // the three clacks: frames 1, 41, 81
  if (b === (b | 0) && b < 3) ks('kboss_shut', SND.shut3[b], 'keep_clack', SND.shut, null);
  if (e.wt === 2 * KB.dieBeat + 2) { sample('kboss_topple', SND.topple); ks('kboss_die', SND.die, 'keep_wail', SND.wailFb, sfx.groan); }
  e.th = lerp(e.th, e.wt > 2 * KB.dieBeat + 1 ? Math.PI / 2 : e.th, .12); // after the last clack it tips onto its side
  if (e.wt >= KB.dieF) { e.hp = 0; e.r = KB.r; killParts(e); killEnemy(e, -1); }
}
/** the parts go quietly with it (no score, no burst: they were the head) */
function killParts(e) { for (const p of [e.rocker, e.crier]) if (p && !p.dead) p.dead = true; }


/** BossSim.kill (killEnemy, after the generic burst): the readout, the reward choice, the stage clear */
function kill(e) {
  killParts(e);
  miniReward(e);
  clearStage();
  for (let i = 0; i < 4; i++) splat(rr(80, 400), rr(30, 210), rr(3, 4.5));
  gore(e.x + KB.wx, e.y + KB.wy, 4, { rope: 4 }); // the crown opens: wet rope; no eyeballs, no bone, no teeth (imply-only, D55 art rule: its glass eyes are on the rocker)
  banner(KEEPSAKE_READOUT, '', undefined, 130);
  sample('boss-keepsake', { vol: 1.15, spread: .02, wet: .16, at: .45 }); // SLAB's PUT TO BED after the roar (KILL_WORD_AT), the booth's boss-keepsake slot
  if (sample('kboss_musicend', SND.musicend)) duckMusic(7); // the box running down under the readout
  $.G.hitstop = Math.max($.G.hitstop, 18);
  $.G.white = SET.flashes ? .6 : .25;
  sfx.roar();
  for (const s of eshots) for (let k = 0; k < 2; k++) drop(s.x, s.y, rr(-1, 1), rr(-1, 1), 1.4, 0, 90);
  eshots.length = 0;
}

/** spawn it into $.G.mini, rolling in along the floor from the right edge, in biome b (its host tint) */
function spawn(b) {
  const x = W + 70, f = Math.min(PH - 2, floorAt(x + $.G.scroll));
  const e = mk('keepsake', x, f - KB.rest, {
    tx: W - KB.tx, st: 'idle', wt: 0, cool: 60, att: 0, ph: 0, tr: 0, th: 0, tc: 0, wins: 0, pt: 0, pl: KB.clock,
    rage: 0, late: 0, my: -80, pa: 0, p3t: 0, pph: 0, d0: 0, d3: 0, rl: 0, pn: 0, fh: 0, rtx: 0, rty: 0, bsa: 0,
    mkT: 0, mkX: 0, bCd: 0, rsv: 0, hd: 0, hdB: 0, hl: 0, hdN: 0, spots: 0, rcW: 0, rcT: KB.recEvery[0], recalls: 0, tux: 0, tuy: 0, bdx: 0, bdy: 1, box: 0, boy: 0, la: Math.PI, lx: 0, ly: 0, bx: 0, by: 0, bs: 0, bl: 0, bd: 1, ra: 0, dn: 0,
    biome: b, title: KEEPSAKE_NAME, armor, hitSnd,
  });
  e.hb = [[KB.wx, KB.wy, KB.wr], [0, KB.cy, KB.cr]];
  e.wy = KB.wy;
  e.fx = new Float32Array(8); e.fl = new Float32Array(8); e.fu = new Uint8Array(8); e.fn = 0; e.fy = 0;
  e.fq = new Float32Array(8); e.fv = new Float32Array(8); e.fw = new Float32Array(8); e.lat = new Float32Array(3); e.fz = new Float32Array(8);
  // the hoard (D59), all made here (nothing allocated in the update): planted world x, surface y, side (1 floor, -1
  // ceiling), birth frame, on a thread; the flights home; the recall's scratch
  const P = KB.plRage;
  e.pX = new Float32Array(P); e.pY = new Float32Array(P); e.pS = new Int8Array(P); e.pB = new Float32Array(P); e.pQ = new Uint8Array(P);
  const H2 = 2 * P; // room for a whole hoard in flight while the last one is still coming home
  e.hX = new Float32Array(H2); e.hY = new Float32Array(H2); e.hVX = new Float32Array(H2); e.hVY = new Float32Array(H2); e.hF = new Int16Array(H2);
  e.ys = new Float32Array(P); e.cu = new Float32Array(H2); e.tm = new Float32Array(H2); e.kp = new Uint8Array(P); e.fx2 = new Float32Array(P);
  e.ma = new Uint8Array(KB.mobN).fill(1); e.ml = new Float32Array(KB.mobN); e.dq = new Uint8Array(KB.mobN);
  for (let i = 0; i < KB.mobN; i++) e.ml[i] = ((i * 7 + 3) % 5) * KB.mobVar; // thread lengths: fixed per fork, no draw
  e.rocker = null; e.crier = null; e.crierGone = 0; e.barked = 0; e.mbT = 0; e.mamaN = 0;
  e.ticks = [KB.cut1, KB.cut2]; // the HP bar's phase marks (render/hud.ts)
  $.G.mini = e;
}
/** BossSim.warn: on the WARNING, the music box winds up (audio only) */
const warn = () => {
  if (sample('kboss_musicbox', SND.musicbox)) duckMusic(4.5); // the wound-up box over sfx.dread (miniWarn plays it)
  sample('bark-keepsake-warn', { vol: 1.15, spread: .02, wet: .16 }); // BIG HEAD ON THE SCOPE / RUBBER FACE / GO FOR THE TOP
};

defineBoss('keepsake', {
  // literals only at the top level (load order, src/CLAUDE.md). r is KB.r. HP 440 x depth (DEPTH.w.keepsake .6, the
  // Crux's: its guarded windows make extra HP count). D59: tuned with tools/keepsake-probe.mjs to ~38-40 s at kit=mid
  // (band 38-46; it was 320 and 26 s), boss-probe STRONG D1 >= 18 s. Base HP with NO stage-order multiplier:
  // D58 (branch balance-d1, held) would multiply stage-boss HP x1.4 in depthHP for this slot. IF D58 SHIPS, DIVIDE
  // THIS BY 1.4 (to ~314) IN THE SAME CHANGE, or the fight runs ~52 s. No skull, no teeth (the art rule): it is vinyl,
  // the meat is the ship's
  et: { hp: 440, r: 44, gsz: 5, score: 16000, bio: 100, eyes: 0, teeth: 0, skull: 0, big: 1, mini: 1 },
  // the words are src/voice/keepsake.ts's: a leaf with no imports, so it is loaded before this file's top level runs
  name: KEEPSAKE_NAME,
  word: KEEPSAKE_READOUT,
  runup: KEEPSAKE_LOG.tract,
  spawn, update, kill, warn,
  prep: () => bankWant('kboss_'), // its banks are lazy (audio.ts LAZY): they decode from the stage's gate on
  arena: kbArena,
});
