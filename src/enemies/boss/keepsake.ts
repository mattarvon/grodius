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
//  Each phase has a 25 s clock (HUD fuse). DOZING or AWAKE running out forces the next phase (IT WON'T LET GO); CRACKED
//  running out is the one capped enrage: the eyes stay open, cooldowns x.75, the stage grade capped at B. It never
//  escapes (D55, Matt's decision 2): the fight ends only when it or you do. Nothing punishes shooting.
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
//   keep_tink / keep_throw / keep_whirr (~.9 rate) / keep_thud / keep_squelch / keep_clack: as the midboss had them
// =====================================================================
import { $ } from '../../state';
import { PH, R, W, dist2, lerp, rr } from '../../core';
import { bankWant, sample, sfx, thr } from '../../audio';
import { duckMusic } from '../../music';
import { SET } from '../../save';
import { eshots, floorAt } from '../../world';
import { drop, gore, spark, splat } from '../../fx/spawn';
import { cdm } from '../../depth';
import { clearStage } from '../../stages';
import { BS, aimA, banner, eshoot, mk, ring, wrapA } from '../spawn';
import { playerHit } from '../../player';
import { killEnemy, lob, miniReward } from '../update';
import { capGrade, defineBoss } from './registry';
import { KEEPSAKE_BANNERS, KEEPSAKE_LOG, KEEPSAKE_NAME, KEEPSAKE_READOUT } from '../../voice/keepsake';
import { KB, forkCols, fountLattice, inWindow, kbArena, keepHurtRot, lobFrames, mobilePick, pendAt, pendXY, phaseClamp, phaseFloor, riseCap, rotXY, tiltAt, tiltEdge, TILT0 } from './_keepsake';

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
  chimes: [{ vol: .04, wet: .25, spread: .06 }, { vol: .04, wet: .25, spread: .06, at: .2 }, { vol: .04, wet: .25, spread: .06, at: .4 }],
};
/** a bank's sound, else the fallback bank's, else the synth one (any of them may be null) */
const ks = (cat, o, fbCat, fbO, fb) => { if (!sample(cat, o) && !(fbCat && sample(fbCat, fbO || o))) fb?.(); };
let tinkT = -1e9;
/** a fork strikes the floor or ceiling (the eshot `land` hook): the midboss's throttled tink */
function forkLand() {
  if (thr('kbT', 40)) return;
  const now = performance.now(), q = now - tinkT < 200; // audio only: the wall clock never reaches the sim
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
const cd = (e) => Math.round([KB.cool, KB.cool2, KB.cool3][e.ph] * (1 - .3 * ($.G.rank || 0)) * cdm() * (e.rage ? KB.rage : 1));
/** the floor the next hit may not pass (no carry, D55) */
const floorOf = (e) => phaseFloor(e.max, e.ph, e.wins);

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
function rest(e) { e.st = 'idle'; e.wt = 0; e.cool = cd(e); if (!e.rage) eyes(false); }

/** plan a fountain (phase 0: 4-5 of 6 columns; phase 2: 5 of 7), drawn at the tell's first frame */
function planFount(e) {
  const p3 = e.ph === 2, n = p3 ? 5 : 4 + (R() < .5 ? 1 : 0), sl = p3 ? KB.slots3 : KB.slots;
  fountLattice($.P.x, e.x, sl, p3 ? KB.pitch3 : KB.pitch, KB.x0, e.lat);
  e.fn = forkCols(n, sl, e.lat[1], e.lat[0], KB.jit, 12, W - 8, R, e.fx, e.fu, e.lat[2]);
  e.fy = wY(e) + KB.land;
  for (let i = 0; i < e.fn; i++) { e.fl[i] = 1e9; e.fq[i] = rr(KB.u0, KB.u1); }
}
function launch(e, i) {
  const x = wX(e), y = wY(e) - 4, n0 = eshots.length;
  const u = riseCap(e.fq[i], y), T = lobFrames(u, e.fy - y);
  lob(x, y, e.fx[i], e.fy, u / BS());
  if (eshots.length > n0) { eshots[n0].fk = 1; eshots[n0].land = forkLand; }
  e.fl[i] = e.wt + Math.ceil(T);
  e.fv[i] = (e.fx[i] - x) / T; e.fw[i] = -u + .025 * T;
  for (let k = 0; k < 3; k++) drop(x + rr(-3, 3), y, rr(-.8, .8), -rr(.5, 1.6), 1.2, 0, 50);
}
/** a hanging mobile fork i: its tip, screen px (the hoop drifts with the head) */
const mobX = (e, i) => e.x + KB.mobX + (i - (KB.mobN - 1) / 2) * KB.mobDx;
const mobTip = (e, i) => e.my + KB.mobLen + e.ml[i];
/** fork i of the mobile lets go: a straight drop (u 0), drawn as a fork, tinks where it lands */
function dropFork(e, i) {
  const x = mobX(e, i), y = mobTip(e, i), n0 = eshots.length;
  lob(x, y, x, floorAt(x + $.G.scroll), 0);
  if (eshots.length > n0) { const f = eshots[n0]; f.fk = 1; f.fs = KB.mobFs; f.r = KB.mobHit; f.land = forkLand; } // drawn at the mobile's scale (render/hud.ts), its hitbox the hanging fork's
  e.ma[i] = 0;
}
/** the mobile's forks touch the ship (a contact hazard at the fork's middle and tip) */
function mobileHit(e) {
  if (!$.P.alive || e.my < -40) return;
  const r2 = (KB.mobHit + 2.6) ** 2;
  for (let i = 0; i < KB.mobN; i++) {
    if (!e.ma[i]) continue;
    const x = mobX(e, i), t = mobTip(e, i);
    if (dist2($.P.x, $.P.y, x, t) < r2 || dist2($.P.x, $.P.y, x, t - 11) < r2 || dist2($.P.x, $.P.y, x, t - 22) < r2) { playerHit(); return; }
  }
}

/** the next attack of phase ph, by turn: DOZING fountain / throw; AWAKE drop / boomerang / drop / wail; CRACKED
 *  Fountain II / double cry / rain / double cry (a throw once the crier is broken, rain falls back to a fountain when
 *  the mobile has one fork left) */
function nextAttack(e) {
  const k = e.att++ % 4;
  if (e.ph === 0) return k % 2 === 0 ? 'tell' : 'aim';
  if (e.ph === 1) return k % 2 === 0 ? (live(e) > 1 ? 'drop' : 'aim') : k === 1 ? 'boom' : 'wail';
  if (k === 0) return 'tell';
  if (k === 2) return live(e) > 1 ? 'rain' : 'tell';
  return e.crier && !e.crier.dead ? 'mama' : 'aim';
}
const live = (e) => { let n = 0; for (let i = 0; i < KB.mobN; i++) n += e.ma[i]; return n; };

function startAttack(e) {
  e.st = nextAttack(e); e.wt = 0;
  eyes(true);
  if (e.ph === 1 && !e.barked) { e.barked = 1; sample('bark-keepsake-eyes', { vol: 1.15, spread: .02, wet: .16 }); } // AWAKE's first tell: EYES OPEN / IT'S COMING
  if (e.st === 'tell') { planFount(e); sfx.squish(); }
  else if (e.st === 'wail') ks('kboss_wail', SND.wail, 'keep_wail', SND.wailFb, sfx.groan);
  else if (e.st === 'mama') sfx.tele(); // its cry lands on the first ring (kboss_mama is timed from that release)
  else if (e.st === 'drop' || e.st === 'rain') {
    e.dn = mobilePick(e.ma, KB.mobN, e.st === 'rain' ? KB.mobN : 2 + (R() < .5 ? 1 : 0), R, e.dq);
    sfx.tele();
  } else { e.la = aimA(wX(e), wY(e)); sfx.tele(); }
}

function attack(e) {
  const st = e.st;
  if (st === 'tell') {
    if (R() < .4) spark(wX(e) + rr(-7, 7), wY(e) - rr(0, 6), rr(-.3, .3), -rr(.4, 1.2), 12, '#e8e2d8');
    if (e.wt >= KB.tell) { e.st = 'fount'; e.wt = 0; ks('keep_throw', SND.spray, null, null, sfx.lash); ks('keep_squelch', SND.pull, null, null, null); }
  } else if (st === 'fount') {
    const i = (e.wt - 1) / KB.stagger;
    if (i === (i | 0) && i < e.fn) launch(e, i);
    let left = 0;
    for (let j = 0; j < e.fn; j++) if (e.wt < e.fl[j]) left++;
    if (!left) { e.st = 'open'; e.wt = 0; ks('keep_squelch', SND.gape, null, null, sfx.squish); }
  } else if (st === 'open') {
    if (R() < .25) drop(wX(e) + rr(-6, 6), wY(e) + 2, rr(-.4, .4), rr(-.6, .2), 1.2, 0, 60);
    if (e.wt >= KB.open) rest(e);
  } else if (st === 'aim') {
    if (e.wt < KB.aim - KB.lock) { e.la += wrapA(aimA(wX(e), wY(e)) - e.la) * .12; e.lx = wX(e); e.ly = wY(e); }
    if (e.wt >= KB.aim) {
      const n0 = eshots.length;
      eshoot(e.lx, e.ly, e.la, KB.throwSp, 'spike');
      if (eshots.length > n0) { eshots[n0].fk = 2; eshots[n0].land = forkLand; }
      ks('keep_throw', SND.throw, null, null, sfx.lash);
      rest(e);
    }
  } else if (st === 'boom') { // the big fork's line tracks, then locks from where the wound is at the lock (the head rocks on)
    if (e.wt < KB.boomTel - KB.boomLock) { e.la += wrapA(aimA(wX(e), wY(e)) - e.la) * .1; e.lx = wX(e); e.ly = wY(e); }
    if (e.wt >= KB.boomTel) {
      const dx = Math.cos(e.la), dy = Math.sin(e.la), x0 = e.lx, y0 = e.ly;
      let L = dx < -.05 ? (x0 - KB.boomEnd) / -dx : 400;
      if (dy < -.05) L = Math.min(L, (y0 - 6) / -dy);
      if (dy > .05) L = Math.min(L, (PH - 6 - y0) / dy);
      e.bl = Math.max(40, L); e.bs = 0; e.bd = 1; e.bx = x0; e.by = y0;
      e.st = 'fly'; e.wt = 0; ks('keep_whirr', SND.out, null, null, sfx.lash); $.G.shake += 2;
    }
  } else if (st === 'fly') {
    e.bs += e.bd * KB.boomSp;
    if (e.bs >= e.bl) { e.bs = e.bl; e.bd = -1; ks('keep_whirr', SND.back, null, null, sfx.chain); }
    e.bx = e.lx + Math.cos(e.la) * e.bs; e.by = e.ly + Math.sin(e.la) * e.bs;
    if ($.P.alive && dist2($.P.x, $.P.y, e.bx, e.by) < (KB.boomR + 2.6) ** 2) playerHit();
    if (e.bd < 0 && e.bs <= 0) { e.bs = 0; rest(e); }
  } else if (st === 'wail') {
    if (e.wt >= KB.wail) { ring(e.x, e.y - 10, KB.wailN, e.t * .05, KB.wailSp); rest(e); }
  } else if (st === 'mama') { // the first cry is the second's tell; the second is turned half a gap
    if (e.wt === KB.mama) { e.ra = e.t * .05; ring(e.x + KB.crx, e.y + KB.cry, KB.wailN, e.ra, KB.wailSp); ks('kboss_mama', e.mamaN++ ? SND.mamaQ : SND.mama, 'keep_wail', SND.wailFb, sfx.groan); } // -2 dB after a phase's first
    if (e.wt >= KB.mama + KB.mamaGap) { ring(e.x + KB.crx, e.y + KB.cry, KB.wailN, e.ra + Math.PI / KB.wailN, KB.wailSp); rest(e); }
  } else if (st === 'drop' || st === 'rain') { // each fork shudders for its tell (staggered), then lets go
    const gap = st === 'rain' ? 6 : KB.dropGap, tel = st === 'rain' ? KB.rain : KB.drop;
    for (let k = 0; k < e.dn; k++) {
      if (e.wt === 1 + k * gap) sample('kboss_chime', SND.chime); // its tell starts: the fork rattles on the hoop
      if (e.wt === tel + k * gap && e.ma[e.dq[k]]) { dropFork(e, e.dq[k]); sample('kboss_snap', SND.snap); }
    }
    if (e.wt >= tel + (e.dn - 1) * gap + 20) rest(e);
  }
}

// ---------------- the phases ----------------
function phaseTo(e, ph, late) {
  e.ph = ph; e.pt = 0; e.tr = ph === 1 ? KB.tr1 : KB.tr2; e.st = 'idle'; e.wt = 0; e.cool = 30; e.att = 0; e.wins = 0; e.mamaN = 0;
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
    e.pa = pendAt(e.p3t++);
    pendXY(e.pa, V); rotXY(V[0], V[1], e.th, V);
    e.rocker.ox = V[0]; e.rocker.oy = V[1]; e.rocker.x = e.x + V[0]; e.rocker.y = e.y + V[1]; e.rocker.hp = e.rocker.max;
    if (e.p3t % (KB.pPer / 2) === KB.pPer / 4) sample('kboss_swing', SND.swing); // an end of the swing, every 90 f
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
  if (!$.P.alive) return;
  // the clock: waits out the roll-in and the transitions, pauses while you're dead
  if (e.t >= KB.enter && e.tr <= 0 && !e.rage) {
    e.pl = KB.clock; e.pt++;
    if (e.pt >= KB.clock) {
      if (e.ph < 2) { if (e.ph === 1) e.wins = KB.p2MinWin; e.hp = Math.min(e.hp, floorOf(e)); e.late = 1; } // IT WON'T LET GO: forced on
      else { // the one capped enrage: never escapes, the grade capped at B
        e.rage = 1; e.pl = 0;
        banner(KEEPSAKE_BANNERS.hold, KEEPSAKE_BANNERS.rage, '#ff3a2a', 140);
        ks('kboss_enrage', SND.enrage, 'keep_wail', SND.wailFb, sfx.roar);
        if ($.G.st) $.G.st.gcap = capGrade($.G.st.gcap || 'S', KB.rageGrade);
      }
    }
  }
  // a phase cut reached: the transition (an attack in flight is dropped with it, and so is the boomerang)
  if (e.tr <= 0 && e.ph < 2 && e.hp <= floorOf(e) + 1e-6 && (e.ph === 0 || e.wins >= KB.p2MinWin || e.late)) { phaseTo(e, e.ph + 1, e.late); e.late = 0; return; }
  if (e.ph === 2 && e.hp <= e.max * KB.end + 1e-6) { e.st = 'dying'; e.wt = 0; e.r = 0; e.hb = null; e.pl = 0; return; }
  if (e.tr > 0) { e.tr--; if (e.tr === 0) eyes(false); return; }
  if (e.t < KB.enter) return;
  e.wt++;
  if (e.st === 'idle') { if (e.wt >= e.cool) startAttack(e); }
  else attack(e);
  if (R() < .06) spark(e.x + rr(-30, 30), e.y + rr(-30, 30), 0, -rr(.2, .6), 18, '#d8d0c0');
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
    rage: 0, late: 0, my: -80, pa: 0, p3t: 0, la: Math.PI, lx: 0, ly: 0, bx: 0, by: 0, bs: 0, bl: 0, bd: 1, ra: 0, dn: 0,
    biome: b, title: KEEPSAKE_NAME, armor, hitSnd,
  });
  e.hb = [[KB.wx, KB.wy, KB.wr], [0, KB.cy, KB.cr]];
  e.wy = KB.wy;
  e.fx = new Float32Array(8); e.fl = new Float32Array(8); e.fu = new Uint8Array(8); e.fn = 0; e.fy = 0;
  e.fq = new Float32Array(8); e.fv = new Float32Array(8); e.fw = new Float32Array(8); e.lat = new Float32Array(3);
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
  // literals only at the top level (load order, src/CLAUDE.md). r is KB.r. HP 260 x depth (DEPTH.w.keepsake .6, the
  // Crux's: its guarded windows make extra HP count); tuned with tools/boss-probe.mjs to D55's band (28-34 s bot at the
  // stage-1 kit, >= 15 s strong). No skull, no teeth (the art rule): it is vinyl, the meat is the ship's
  et: { hp: 320, r: 44, gsz: 5, score: 16000, bio: 100, eyes: 0, teeth: 0, skull: 0, big: 1, mini: 1 },
  // the words are src/voice/keepsake.ts's: a leaf with no imports, so it is loaded before this file's top level runs
  name: KEEPSAKE_NAME,
  word: KEEPSAKE_READOUT,
  runup: KEEPSAKE_LOG.tract,
  spawn, update, kill, warn,
  prep: () => bankWant('kboss_'), // its banks are lazy (audio.ts LAZY): they decode from the stage's gate on
  arena: kbArena,
});
