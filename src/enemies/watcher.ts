// @ts-nocheck
// =====================================================================
//  THE WATCHER (g5): a big, whole eyeball that drifts past, watching the ship. Matt: "there are way too many flayers.
//  we need more variety. can we do a sporadic big ass flying eyeball". A rare, readable event, not more pressure:
//  slow (.5 px/f, ~17 s across the screen), one aimed orb per 40 f blink tell, a ~180 f cooldown.
//  Not the 'hatch' (the small floating eyeball), not the 'eye' (the stalk turret on a wall), not the Choir's boss
//  "The Enucleated Eye". Spawner: watcher(y) (re-exported by spawn.ts). The lead places it (scripts.ts); this file
//  never does. Art: render/watcher.ts. Kill FX: killWatcher (enemies/update.ts killEnemy).
//  Sim: R() only through the spawn's one ri() and coolFor's ri() roll, both on the sim stream. Every particle (the
//  muzzle flash, the burst) is spawned by the render (render/watcher.ts, srnd()), audio uses sample()/sfx (ar()), so
//  rendering or not never moves the sim. No fx/ import here: spawn.ts re-exports watcher(), and its unit tests load
//  spawn.ts with no DOM (fx/spawn pulls in platform.ts).
// =====================================================================
import { $ } from '../state';
import { PH, TAU, W, clamp, lerp, ri } from '../core';
import { sample, sfx } from '../audio';
import { ceilAt, enemies, floorAt } from '../world';
import { BUL, retryIn } from '../notice';
import { coolFor, firstShot } from './cadence';
import { g3 } from './g3';
import { ET, aimA, aimLead, endVolley, eshoot, mk, volley } from './spawn';

/** THE WATCHER's tuning (frames, px). Probe: tests/unit/watcher.test.ts; fire-probe.mjs KINDS watcher (bullets/s) */
export const WATCH = {
  x0: 22, //      spawns at W + 22: its r 15 body fully off the right edge on its first frame
  vx: .5, //      px/f leftward in screen space, scroll-independent: 480 px in 16 s (studio: 16-20 s across)
  amp: 30, //     px of sine bob around its lane
  per: 240, //    f per bob (4 s): slow, so its line is readable
  ease: .12, //   it eases onto the bob, so a step in the terrain band never teleports it
  pad: 6, //      px of air it keeps between its edge and the ceiling or floor
  room: 8, //     the spawn needs this much bob room between its band's limits, else watcher() returns null
  inX: 20, //     it attacks only fully on screen: x < W - 20 (its r 15 is in) ...
  minX: 40, //    ... and x > 40 (the free-flyer edge rule, BUL.edge)
  tell: 40, //    the blink tell: >= 36 f (studio), every shot. close 0-14, shut 14-22, snaps wide 22-26, stares 26-40
  close: 14, //   f to close the lid
  shut: 22, //    the lid starts to snap open here (the wet blink cue plays)
  open: 26, //    wide open from here to the shot, the pupil dilating
  dil: 1.9, //    pupil dilation at the shot (1 at rest)
  idle: 200, //   f between its idle blinks (deterministic, from its phase): it blinks, so the shut lid is learned
  idleLen: 8, //  f an idle blink lasts
  shutMul: .3, // damage share while the lid is shut (> .5 closed): the weak point is the open eye
  first: [100, 130] as [number, number], // short's first-attack range (long4: BUL.first.watcher); ~20-40 f after it is fully in
  roll: 30, //    coolFor's jitter, ri(0, 30)
};

/** the lid's closure 0 (open) .. 1 (shut), from the sim state only: the render and the damage rule read the same value */
export function lidOf(e: any): number {
  const T = WATCH;
  if (e.st === 'tel') {
    const w = e.wt;
    if (w < T.close) return w / T.close;
    if (w < T.shut) return 1;
    if (w < T.open) return 1 - (w - T.shut) / (T.open - T.shut);
    return 0;
  }
  const q = (e.t + (e.bph || 0)) % T.idle;
  return q < T.idleLen ? 1 - Math.abs(q - T.idleLen / 2) / (T.idleLen / 2) : 0;
}
/** the pupil's dilation (1 at rest), widening from the snap to the shot */
export function dilOf(e: any): number {
  if (e.st !== 'tel' || e.wt < WATCH.shut) return 1;
  return 1 + (WATCH.dil - 1) * Math.min(1, (e.wt - WATCH.shut) / (WATCH.open + 6 - WATCH.shut));
}
/** e.armor (roster.ts midMul, every damage path): full damage with the lid open, x.3 while it is shut */
export function watcherArmor(e: any): number {
  return lidOf(e) > .5 ? WATCH.shutMul : 1;
}
/** the band it may fly in at screen x: [lo, hi] for its centre; lo > hi means no room */
function band(x: number, r: number): [number, number] {
  const wx = x + $.G.scroll, T = WATCH;
  return [Math.max(ceilAt(wx), 0) + r + T.pad, Math.min(floorAt(wx), PH) - r - T.pad];
}

/** THE WATCHER in from the right at lane y (default: its band's middle), bobbing +-30 px. Returns the enemy, or null when
 *  there is no room for it at the right edge (the band is too narrow) or one is already up (one at a time: it is an
 *  event). Always carries a capsule (e.cap set after mk(), so no keep roll is drawn). R(): one ri() (its first shot) */
export function watcher(y?: number) {
  for (const o of enemies) if (o.k === 'watcher' && !o.dead) return null;
  const T = WATCH, r = ET.watcher.r, x = W + T.x0, [lo, hi] = band(x, r);
  if (hi - lo < T.room) return null;
  const y0 = clamp(y ?? (lo + hi) / 2, lo, hi);
  const bph = Math.round(($.G.scroll || 0) * 1.7) % T.idle; // its idle-blink phase: from the scroll, no R()
  const e = mk('watcher', x, y0, { st: 'drift', wt: 0, shots: 0, bph, cool: ri(...(g3() ? BUL.first.watcher : firstShot(T.first[0], T.first[1]))), armor: watcherArmor });
  e.y0 = e.y; // mk() may have moved it off the ship (spawn.ts bodyClear)
  e.cap = true;
  sample('keep_squelch', { vol: .7, rate: .75, wet: .25 }) || sfx.squish(); // entry: a wet squelch (audio only)
  return e;
}

/** where its shot leaves: the pupil, r * .4 toward the ship */
const muzzle = (e: any): [number, number] => { const a = aimA(e.x, e.y); return [e.x + Math.cos(a) * e.r * .4, e.y + Math.sin(a) * e.r * .4]; };
/** may it start (or keep) a tell: fully on screen, the ship alive */
const canFire = (e: any) => $.P && $.P.alive && e.x < W - WATCH.inX && e.x > WATCH.minX;

/** one frame of THE WATCHER (enemies/update.ts updEnemy). No R() but coolFor's roll after a shot */
export function updWatcher(e: any) {
  const T = WATCH;
  e.x -= T.vx;
  const [lo, hi] = band(e.x, e.r);
  const ty = lo > hi ? (lo + hi) / 2 : clamp(e.y0 + Math.sin(e.t * TAU / T.per) * T.amp, lo, hi);
  e.y = lerp(e.y, ty, T.ease);
  if (e.st === 'tel') {
    e.wt++;
    if (e.wt === T.shut) sample('keep_squelch', { vol: .45, rate: 1.6, wet: .2 }) || sfx.squish(); // the wet blink: audio only
    if (!canFire(e)) { e.st = 'drift'; e.wt = 0; e.cool = retryIn(BUL.retry); return; } // the ship died or it drifted past x 40
    if (e.wt < T.tell) return;
    e.st = 'drift'; e.wt = 0;
    const [mx, my] = muzzle(e);
    // ONE half-led orb at the eye turret's speed, an atomic volley against the scroll cap; refused (the cap, 64 px) it
    // retries in 20 f, and the retry plays the whole blink again (every shot keeps its tell)
    if (volley(1, mx, my, 'scroll')) {
      eshoot(mx, my, aimLead(mx, my, BUL.v.eye), BUL.v.eye, 'orb', 'scroll');
      endVolley();
      e.shots++;
      e.cool = coolFor('watcher', ri(0, T.roll));
      e.mf = $.T; // the muzzle flash, drawn by the render (render/watcher.ts)
    } else e.cool = retryIn(BUL.retry);
    return;
  }
  e.cool--;
  if (e.cool <= 0 && canFire(e)) { e.st = 'tel'; e.wt = 0; }
}

/** the death the render plays (render/watcher.ts drawWatcherFx): position, $.T, the ship's bearing, the lid. Render-only
 *  state: the sim writes it and never reads it. Capped, so a headless run (nothing drawn) never grows it */
export const WDIE: any[] = [];
/** THE WATCHER bursts (enemies/update.ts killEnemy, in place of the generic gore). The sim records the death (WDIE)
 *  and plays the audio; the render (render/watcher.ts drawWatcherFx) spawns the whole burst from it: clear fluid first,
 *  the sclera torn to skin, then the blood pumping out, the lens flying off, the nerves going limp and the iris disc
 *  hanging on ~40 f, still turned to the ship. No R(), no particle from the sim */
export function killWatcher(e: any, dir = 1) {
  const x = e.x, y = e.y, P = $.P;
  WDIE.push({ x, y, t: $.T, ang: P ? Math.atan2(P.y - y, P.x - x) : Math.PI, dir, bph: e.bph || 0, r: e.r, pa: -1 });
  if (WDIE.length > 6) WDIE.shift();
  if ($.G) { $.G.shake = Math.min(16, ($.G.shake || 0) + 4); $.G.hitstop = Math.max($.G.hitstop || 0, 4); }
  sample('gross_pop', { vol: .95, wet: .25 }) || sfx.squish();
  sfx.gore(2.2); // the splat and the thud under it
}
