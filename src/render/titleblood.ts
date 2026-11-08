// The title's easter egg: Matt's tiny severed head, peeking in at the screen's edges now and then. DOM-free leaf (imports
// only srnd) so tests/unit/titleblood.test.ts can drive it; titlehead.ts draws. Each visit comes in and leaves through the
// same edge and only ever slides along a rail in a free zone, so it never has to cross the menu, logo or ROT. Advanced by
// the $.T delta, not per render, so 120 Hz doesn't double its speed and a rig jump can't burst the pool. Render only: this
// isn't world.drops, and nothing here reaches the sim. Path choices are srnd().
import { srnd, srr, sri } from '../srnd';

const hsh = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/** head_egg@3 cell, game px */
export const HEAD = { w: 19, h: 31, eyeX: 6, eyeY: 17, stumpX: 10, stumpY: 29, ballLeft: 1 };

/** The free zones. Each rail is the head's top-left between two points, safe at every point with the bob and the 8 px of
 *  margin ROT's wobble needs; `out` is the off-screen direction, always straight away from the no-go areas. `floor` kills
 *  drips before they reach text or ROT. Checked against every no-go rect by tests/unit/titleblood.test.ts */
export const RAILS = [
  { n: 'top', x0: 4, y0: -6, x1: 340, y1: -6, ox: 0, oy: -1, floor: 28 },        // chin and eye hang into y 0-25, above the logo
  { n: 'left', x0: 1, y0: 30, x1: 1, y1: 236, ox: -1, oy: 0, floor: 270 },       // x to 20: the logo and menu start at 26
  { n: 'bottom', x0: 4, y0: 252, x1: 296, y1: 252, ox: 0, oy: 1, floor: 270 },   // head above the eye only: credits end at 249, age line at x 322
  { n: 'topRight', x0: 458, y0: -4, x1: 458, y1: 8, ox: 1, oy: 0, floor: 44 },   // right of ROT's rope, above its shoulder
  { n: 'bottomRight', x0: 470, y0: 198, x1: 466, y1: 197, ox: 1, oy: 0, floor: 229 }, // a peek: ROT above-left, credits below
];

/** the visit's pace: slow, and long gone between. Frames at 60/s unless noted */
export const VISIT = {
  firstGap: 240,        // 4 s after the title opens, so a player who lingers can find it
  gap: [360, 1200],     // 6-20 s absent
  offscreen: 24,        // px beyond the rail a visit starts and ends: the head is partly off, so it peeks rather than pops
  slide: .25,           // px/frame in and out
  drift: .15,           // px/frame along the rail, about 9 px/s
  driftLen: [40, 90],   // px of a drift; shorter rails just use what they have
  linger: [120, 300],
};

/** the head's small life, hash-timed: stillness, then a hitch */
export const MOTION = {
  bob: { period: 110, jitter: 70 },   // holds 0.7-3 s at -1, 0 or +1
  throb: { period: 170, jitter: 90, up: 6, skip: .3 }, // 11-frame-ish kicks with long gaps; some epochs do nothing
  hop: { period: 230, jitter: 120, hold: 40, chance: .6 }, // the iris hops 1 px and looks back
};

/** drips trailing off the eye and stump */
export const DRIP = {
  cap: 24,            // Matt: a trail, not a pour. Enough for 3-4 s of drips at the rate below, so it rarely hits the cap
  rate: .05,          // per spawn point per frame while on screen: one drop about every 10 frames between the two
  wide: .15,          // share of drops 2 px wide
  gravity: .05, vMax: 1.8, // a slow fall, so a drip is a streak of 1-3 px rather than a line
  tailK: 1.4,
  life: [40, 90],     // frames, then gone: no pool. The last third darkens through flat reds, so it fades without alpha
};

export const maxStep = 3; // most sim steps in one render

// ---- motion: pure functions of t ----

/** the last hash-jittered epoch start at or before t, an integer, O(1). jitter must be < period */
export function epochStart(t: number, period: number, jitter: number, salt: number) {
  let k = Math.floor(t / period), s = k * period + Math.floor(hsh(k + salt) * jitter);
  if (s > t) { k--; s = k * period + Math.floor(hsh(k + salt) * jitter); }
  return s;
}
const epochK = (s: number, period: number) => Math.floor(s / period);

export function bobY(t: number) {
  const m = MOTION.bob, k = epochK(epochStart(t, m.period, m.jitter, 7), m.period);
  return Math.floor(hsh(k * 1.9 + 2) * 3) - 1;
}
/** head_egg@3 frame: 0 rest, 1 throb, 2 iris hop */
export function eggFrame(t: number) {
  const th = MOTION.throb, s = epochStart(t, th.period, th.jitter, 53);
  if (t - s < th.up && hsh(epochK(s, th.period) * 2.3 + 7) >= th.skip) return 1;
  const h = MOTION.hop, sh = epochStart(t, h.period, h.jitter, 71);
  return t - sh < h.hold && hsh(epochK(sh, h.period) * 3.1 + 5) < h.chance ? 2 : 0;
}

// ---- the visit: one state machine, no allocation ----

export const GONE = 0, IN = 1, DRIFT = 2, LINGER = 3, OUT = 4;
/** the visit, read by titlehead.ts. x and y are the head's top-left before the bob */
export const E = { phase: GONE, rail: 0, x: 0, y: 0, tx: 0, ty: 0, timer: VISIT.firstGap, visits: 0, done: 0 };

function towards(tx: number, ty: number, speed: number) {
  const dx = tx - E.x, dy = ty - E.y, d = Math.hypot(dx, dy);
  if (d <= speed) { E.x = tx; E.y = ty; return true; }
  E.x += dx / d * speed; E.y += dy / d * speed;
  return false;
}
function startVisit() {
  E.rail = sri(0, RAILS.length - 1);
  const r = RAILS[E.rail], len = Math.hypot(r.x1 - r.x0, r.y1 - r.y0);
  const u = srnd(), along = srr(VISIT.driftLen[0], VISIT.driftLen[1]) / (len || 1) * (srnd() < .5 ? 1 : -1);
  const v = Math.min(1, Math.max(0, u + along)); // clamped to the rail: that is what holds the no-go rule
  const px = r.x0 + (r.x1 - r.x0) * u, py = r.y0 + (r.y1 - r.y0) * u;
  E.x = px + r.ox * VISIT.offscreen; E.y = py + r.oy * VISIT.offscreen;
  E.tx = r.x0 + (r.x1 - r.x0) * v; E.ty = r.y0 + (r.y1 - r.y0) * v;
  E.phase = IN; E.visits++;
  railPx = px; railPy = py;
}
let railPx = 0, railPy = 0;

function visitStep() {
  const r = RAILS[E.rail];
  switch (E.phase) {
    case GONE:
      if (--E.timer <= 0) startVisit();
      break;
    case IN:
      if (towards(railPx, railPy, VISIT.slide)) E.phase = DRIFT;
      break;
    case DRIFT:
      if (towards(E.tx, E.ty, VISIT.drift)) { E.phase = LINGER; E.timer = sri(VISIT.linger[0], VISIT.linger[1]); }
      break;
    case LINGER:
      if (--E.timer <= 0) { E.phase = OUT; railPx = E.x + r.ox * VISIT.offscreen; railPy = E.y + r.oy * VISIT.offscreen; }
      break;
    case OUT:
      if (towards(railPx, railPy, VISIT.slide)) { E.phase = GONE; E.timer = sri(VISIT.gap[0], VISIT.gap[1]); E.done++; }
      break;
  }
}

// ---- drips: a fixed parallel-array pool, swap-removed ----

const N = DRIP.cap;
export const D = {
  n: 0, peak: 0,
  x: new Float32Array(N), y: new Float32Array(N), vy: new Float32Array(N),
  w: new Uint8Array(N), life: new Int16Array(N), age: new Int16Array(N),
};
function addDrip(x: number, y: number) {
  if (D.n >= N) return;
  const i = D.n++;
  D.x[i] = x; D.y[i] = y; D.vy[i] = 0; D.w[i] = srnd() < DRIP.wide ? 2 : 1;
  D.life[i] = sri(DRIP.life[0], DRIP.life[1]); D.age[i] = 0;
}
function dripStep(t: number) {
  // spawn points are inside the head's rect, which the rails keep clear; below the floor there is nothing to spawn
  if (E.phase !== GONE) {
    const r = RAILS[E.rail], hy = Math.round(E.y) + bobY(t), hx = Math.round(E.x);
    if (hy + HEAD.eyeY < r.floor && hy + HEAD.eyeY >= 0 && srnd() < DRIP.rate) addDrip(hx + HEAD.eyeX, hy + HEAD.eyeY);
    if (hy + HEAD.stumpY < r.floor && hy + HEAD.stumpY >= 0 && srnd() < DRIP.rate) addDrip(hx + HEAD.stumpX, hy + HEAD.stumpY);
  }
  const floor = RAILS[E.rail].floor;
  for (let i = D.n - 1; i >= 0; i--) {
    D.vy[i] = Math.min(DRIP.vMax, D.vy[i] + DRIP.gravity);
    D.y[i] += D.vy[i];
    if (++D.age[i] >= D.life[i] || D.y[i] >= floor) {
      const l = --D.n;
      D.x[i] = D.x[l]; D.y[i] = D.y[l]; D.vy[i] = D.vy[l]; D.w[i] = D.w[l]; D.life[i] = D.life[l]; D.age[i] = D.age[l];
    }
  }
  if (D.n > D.peak) D.peak = D.n;
}

let lastT = -1;
/** advance by the frame clock; returns the steps taken. Same T again (120 Hz) is 0 steps; a T jump is at most maxStep */
export function eggAdvance(T: number) {
  if (lastT < 0 || T < lastT) { lastT = T; return 0; }
  const d = Math.min(T - lastT, maxStep);
  for (let i = d - 1; i >= 0; i--) { visitStep(); dripStep(T - i); }
  lastT = T;
  return d;
}
/** back to an empty title (tests) */
export function eggReset() {
  lastT = -1; D.n = 0; D.peak = 0;
  E.phase = GONE; E.rail = 0; E.timer = VISIT.firstGap; E.visits = 0; E.done = 0;
}
