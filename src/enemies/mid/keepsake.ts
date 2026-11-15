// @ts-nocheck
// =====================================================================
//  THE KEEPSAKE (ship pool, ANGLE; pass-1 greybox, wip). A crew kid's vinyl baby-doll head grown to midboss size
//  (vinyl, like Matt's own doll: D53): sleep eyes, a silver dinner fork rammed into the soft spot on top of the skull,
//  brain bulging round it. The kid is implied, never shown (D53).
//  Art: render/gross/mid/keepsake.ts. Its picker row is in ./roster.ts; its tuning, damage rule and fountain layout in
//  ./_keepsake.ts (pure, unit-tested by tests/unit/keepsake.test.ts).
//
//  ANGLE: the vinyl face takes x.15; only the wound on top, from above, takes full damage (keepHurt). So you want to sit
//  over its crown, and everything it does is about making that cost something:
//   TELL   (48 f): the brain bulges, the eyes open, the handles rise; the fountain's landing marks show from frame 1
//   FOUNT        : 3-4 forks (phase 2: 5) burst up out of the wound and arc down through the marked columns. One
//                  column always comes down on the ship's x (taken at the tell's first frame), so the firing lane level
//                  with the crown is contested; at least one lattice column is always empty, so there is always a gap
//   OPEN   (60 f): the last fork lands and the wound gapes, nothing fires: the safe beat to dive in (45 f in phase 2)
//   AIM    (46 f): between fountains a line tracks you for 30 f, locks for 16, then a fork flies tines-first along it
//  Under 50% (midPh2): the throws become the big fork, ripped out and thrown as a boomerang along a tracked, then
//  locked line, out to the far side and back (54 f line), and a slow wail ring (44 f tell), turn about between fountains.
//  The fountains get denser (5 forks of 7 columns) and the window shorter (45 f).
//  Nothing punishes shooting. No allocation in the update: the fountain writes into arrays made at spawn.
// =====================================================================
import { $ } from '../../state';
import { PH, R, W, dist2, lerp, rr } from '../../core';
import { sample, sfx, thr } from '../../audio';
import { eshots } from '../../world';
import { drop, spark } from '../../fx/spawn';
import { cdm } from '../../depth';
import { BS, aimA, eshoot, ring, wrapA } from '../spawn';
import { playerHit } from '../../player';
import { bandFit, lob, midLeave } from '../update';
import { midPh2 } from '../midhost';
import { defineMid } from './roster';
import { KEEP, forkCols, fountLattice, keepHurt, lobFrames, riseCap } from './_keepsake';

// ---- its sounds (pass 2, D53): tools/gen_keepsake_sfx.py writes src/sfx/keep_*/. Each level is set against the shared
// sound it replaces or the neighbour it sits with (ffmpeg ebur128, momentary max of the file, plus the gain here):
// the fork tink -35 LUFS (-39 close behind another: they come in fives), the face thud -43 and the wound squelch -40
// round the shared hit's -41 (they come at the fire rate), the throw -28 and the whirr -30 at the lash they replace
// (-28.5), the wail -20 with the midboss gargle (-18.8) and the roar (-17.8), the eye clack -33, small and crisp.
// Audio only: sample() and thr() draw ar() and the wall clock, never R(), so the sim is the same with sound on, off or
// not decoded; a bank not decoded yet falls back to the shared synth sound it replaced. The option objects are built
// once: no allocation in the update
const SND = {
  tink: { vol: .07, wet: .12, spread: .12 }, //          a fork lands on rock (the first of a fountain)...
  tinkQ: { vol: .045, wet: .12, spread: .16 }, //        ...and the ones close behind it, quieter, so five never tire
  throw: { vol: .1, wet: .18, spread: .06 }, //          the aimed throw, tines first
  spray: { vol: .065, rate: 1.25, wet: .18, spread: .08 }, // the fountain bursting from the wound
  pull: { vol: .1, rate: .8, wet: .2, spread: .08 }, //  the forks pulled out of the brain
  gape: { vol: .08, rate: .7, wet: .25, spread: .06 }, // the wound gaping open after the last fork
  out: { vol: .11, wet: .22, spread: .03 }, //           the boomerang leaving...
  back: { vol: .09, rate: 1.12, wet: .22, spread: .03 }, // ...and turning back, a little faster
  wail: { vol: .34, wet: .45, spread: .02 }, //           the crier: its second cry lands on the ring's release
  open: { vol: .25, rate: 1.08, wet: .08, spread: .05 }, // the sleep eyes clacking open on a tell...
  shut: { vol: .22, rate: .88, wet: .08, spread: .05 }, //   ...and shut again after it
  thud: { vol: .05, wet: .06, spread: .12 }, //          a shot on the vinyl face (x.15)
  sq: { vol: .09, wet: .12, spread: .14 }, //            a shot into the wound (full damage)
};
/** a sound from its bank, or the shared synth one it replaced while the bank is still decoding */
const ks = (cat, o, fb) => { if (!sample(cat, o)) fb?.(); };
/** a fork strikes the floor or the ceiling (the eshot's `land` hook, shots.ts): a steel tink, never two inside 40 ms,
 *  and quieter while the last one is under 200 ms old, so a fountain's run of five rings once and then patters */
let tinkT = -1e9;
function forkLand() {
  if (thr('kpT', 40)) return;
  const now = performance.now(), q = now - tinkT < 200;
  tinkT = now;
  ks('keep_tink', q ? SND.tinkQ : SND.tink, sfx.tink);
}
/** MidSim.hitSnd: the vinyl face (x.15) knocks dull, the wound squelches. The shared tink's and hit's throttles */
function keepHitSnd(_e, m) {
  if (m < 1) { if (!thr('kpH', 60)) ks('keep_thud', SND.thud, sfx.tink); }
  else if (!thr('kpW', 38)) ks('keep_squelch', SND.sq, sfx.hit);
  return true;
}
/** the sleep eyes: open on every tell, shut when it goes back to idle */
const eyes = (open) => ks('keep_clack', open ? SND.open : SND.shut, null);
/** back to idle after an attack: the eyes fall shut, the cooldown starts */
function rest(e, ph2) { e.st = 'idle'; e.wt = 0; e.cool = cd(ph2); eyes(false); }

const cd = (ph2) => Math.round((ph2 ? KEEP.cool2 : KEEP.cool) * (1 - .3 * ($.G.rank || 0)) * cdm()); // cdm: depth, src/depth.ts
/** the wound, screen px (the forks' launch point) */
const wX = (e) => e.x + KEEP.wx, wY = (e) => e.y + KEEP.wy;

/** the fountain's columns, landing plane and rise speeds, drawn at the tell's first frame (sim R(): 3n draws in
 *  phase 1 including the count roll, 3n - 1 in phase 2, whatever is picked). The lattice is anchored on the ship's x
 *  now, so one column always comes down on the firing lane level with the crown */
function planFount(e, ph2) {
  const n = ph2 ? 5 : 3 + (R() < .5 ? 1 : 0), sl = ph2 ? KEEP.slots2 : KEEP.slots;
  fountLattice($.P.x, e.x, sl, ph2 ? KEEP.pitch2 : KEEP.pitch, KEEP.x0, e.lat);
  e.fn = forkCols(n, sl, e.lat[1], e.lat[0], KEEP.jit, 12, W - 8, R, e.fx, e.fu, e.lat[2]);
  e.fy = wY(e) + KEEP.land;
  for (let i = 0; i < e.fn; i++) { e.fl[i] = 1e9; e.fq[i] = rr(KEEP.u0, KEEP.u1); } // not launched: its mark shows until it has landed
}
/** fork i leaves the wound now: a lob through its column on the landing plane. Its landing frame goes in e.fl, its
 *  velocity at the plane in e.fv / e.fw (the art draws the rest of its fall from them) */
function launch(e, i) {
  const x = wX(e), y = wY(e) - 4, n0 = eshots.length;
  const u = riseCap(e.fq[i], y), T = lobFrames(u, e.fy - y);
  lob(x, y, e.fx[i], e.fy, u / BS()); // lob() scales by BS(); fold it out so the arc (and its marks) never change with depth
  if (eshots.length > n0) { eshots[n0].fk = 1; eshots[n0].land = forkLand; } // drawn as a fork (render/hud.ts drawEShots), tinks where it lands; the cap can refuse it
  e.fl[i] = e.wt + Math.ceil(T);
  e.fv[i] = (e.fx[i] - x) / T; e.fw[i] = -u + .025 * T;
  for (let k = 0; k < 3; k++) drop(x + rr(-3, 3), y, rr(-.8, .8), -rr(.5, 1.6), 1.2, 0, 50);
}
/** is the ship on the boomerang (a disc at e.bx, e.by)? */
const onBoom = (e) => $.P.alive && dist2($.P.x, $.P.y, e.bx, e.by) < (KEEP.boomR + 2.6) ** 2;

function updKeepsake(e) {
  const go = midLeave(e), ph2 = midPh2(e);
  // a slow drift, held still while a line is up so the line is honest (the Saucer's rule), and through the fountain so
  // its landing plane stays level with the crown: the lane you shoot the wound from is the lane the forks come down in
  const still = e.st === 'aim' || e.st === 'boom' || e.st === 'fly' || e.st === 'tell' || e.st === 'fount';
  if (!still) e.y = lerp(e.y, PH * .58 + Math.sin(e.t * .011) * PH * .12, .04);
  if (e.host) bandFit(e); // a biome slot (the ?mid= test path): fitted into the cave like a crossover (roster `fit`)
  if (!go && e.t > 120 && $.P.alive) {
    e.wt++;
    if (e.st === 'idle') {
      if (e.wt >= e.cool) {
        const k = e.att++ % 4; // fountain, throw, fountain, throw; phase 2: fountain, boomerang, fountain, wail
        e.st = k % 2 === 0 ? 'tell' : !ph2 ? 'aim' : k === 1 ? 'boom' : 'wail';
        e.wt = 0;
        eyes(true);
        if (e.st === 'tell') { planFount(e, ph2); sfx.squish(); }
        else if (e.st === 'wail') ks('keep_wail', SND.wail, sfx.groan);
        else { e.la = aimA(wX(e), wY(e)); sfx.tele(); }
      }
    } else if (e.st === 'tell') { // the brain bulges round the fork: the art's seam opens with wt / tell
      if (R() < .4) spark(wX(e) + rr(-5, 5), wY(e) - rr(0, 4), rr(-.3, .3), -rr(.4, 1.2), 12, '#e8e2d8');
      if (e.wt >= KEEP.tell) { e.st = 'fount'; e.wt = 0; ks('keep_throw', SND.spray, sfx.lash); ks('keep_squelch', SND.pull, null); }
    } else if (e.st === 'fount') {
      const i = (e.wt - 1) / KEEP.stagger; // wt is 1 on the state's first frame: fork 0 leaves then
      if (i === (i | 0) && i < e.fn) launch(e, i);
      let left = 0;
      for (let j = 0; j < e.fn; j++) if (e.wt < e.fl[j]) left++;
      if (!left) { e.st = 'open'; e.wt = 0; ks('keep_squelch', SND.gape, sfx.squish); }
    } else if (e.st === 'open') { // the window: the wound gapes, nothing fires
      if (R() < .25) drop(wX(e) + rr(-4, 4), wY(e) + 2, rr(-.4, .4), rr(-.6, .2), 1.2, 0, 60);
      if (e.wt >= (ph2 ? KEEP.open2 : KEEP.open)) rest(e, ph2);
    } else if (e.st === 'aim') { // the throw's line: tracks, then locks
      if (e.wt < KEEP.aim - KEEP.lock) e.la += wrapA(aimA(wX(e), wY(e)) - e.la) * .12;
      if (e.wt >= KEEP.aim) {
        const n0 = eshots.length;
        eshoot(wX(e), wY(e), e.la, KEEP.throwSp, 'spike');
        if (eshots.length > n0) { eshots[n0].fk = 2; eshots[n0].land = forkLand; } // a straight fork, tines first
        ks('keep_throw', SND.throw, sfx.lash);
        rest(e, ph2);
      }
    } else if (e.st === 'boom') { // phase 2: the big fork's line tracks, then locks; then it flies
      if (e.wt < KEEP.boomTel - KEEP.boomLock) e.la += wrapA(aimA(wX(e), wY(e)) - e.la) * .1;
      if (e.wt >= KEEP.boomTel) {
        // out to the far end along the line: boomEnd's x, or the top or bottom edge first
        const dx = Math.cos(e.la), dy = Math.sin(e.la), x0 = wX(e), y0 = wY(e);
        let L = dx < -.05 ? (x0 - KEEP.boomEnd) / -dx : 400;
        if (dy < -.05) L = Math.min(L, (y0 - 6) / -dy);
        if (dy > .05) L = Math.min(L, (PH - 6 - y0) / dy);
        e.bl = Math.max(40, L); e.bs = 0; e.bd = 1; e.bx = x0; e.by = y0;
        e.st = 'fly'; e.wt = 0; ks('keep_whirr', SND.out, sfx.lash); $.G.shake += 2;
      }
    } else if (e.st === 'fly') {
      e.bs += e.bd * KEEP.boomSp;
      if (e.bs >= e.bl) { e.bs = e.bl; e.bd = -1; ks('keep_whirr', SND.back, sfx.chain); }
      e.bx = wX(e) + Math.cos(e.la) * e.bs; e.by = wY(e) + Math.sin(e.la) * e.bs;
      if (onBoom(e)) playerHit();
      if (e.bd < 0 && e.bs <= 0) { e.bs = 0; rest(e, ph2); }
    } else if (e.st === 'wail') {
      if (e.wt >= KEEP.wail) { ring(e.x, e.y, KEEP.wailN, e.t * .05, KEEP.wailSp); rest(e, ph2); } // the crier's second cry is this beat (gen_keepsake_sfx.py wail)
    }
  }
  if (go && e.st === 'fly') e.st = 'idle'; // withdrawing: the boomerang is gone with it
  if (R() < .06) spark(e.x + rr(-16, 16), e.y + rr(-12, 18), 0, -rr(.2, .6), 18, '#d8d0c0');
}

function keepSpawn(e) {
  // the wound is a small part on top of the head: its own hitbox, so a shot skimming the crown connects (src/CLAUDE.md)
  e.hb = [[KEEP.wx, KEEP.wy, KEEP.wr]];
  e.wy = KEEP.wy; // where its weak spot is, for tools/midboss-probe.mjs's bot (it aims at e.y + e.wy)
  e.fx = new Float32Array(8); e.fl = new Float32Array(8); e.fu = new Uint8Array(8); e.fn = 0; e.fy = 0;
  e.fq = new Float32Array(8); e.fv = new Float32Array(8); e.fw = new Float32Array(8); e.lat = new Float32Array(3);
  e.la = Math.PI; e.bx = e.by = e.bs = e.bl = 0; e.bd = 1;
}

defineMid('keepsake', {
  // literals only at the top level (src/CLAUDE.md load order): r is KEEP.r. HP 135, not the ANGLE peers' 95-100 (spec
  // §6.2): with the crown rule y-only and the head held still through the fountain, the invincible probe bot on the
  // wound killed 100 HP in 6.5 s at the stage-1 kit, under the 8-11 s band (D27). Tune from the probe: midboss-probe
  // --layout long4 --leave 1080 --seed 1. The probe bot never dodges, so a real fight runs longer than its number
  et: { hp: 135, r: 22, gsz: 4, score: 6000, bio: 70, skull: 1, eyes: 2, teeth: 4, big: 1, mini: 1, mid: 1 },
  word: 'PUT TO BED',
  spawnY: .58,
  onSpawn: keepSpawn,
  hurt: (e, _d, hx, hy) => keepHurt(e, hx, hy),
  hitSnd: keepHitSnd,
  update: updKeepsake,
});
