// @ts-nocheck
// THE WATCHER's art (g5; sim: enemies/watcher.ts). A whole eyeball ~30 px across drifting past, drawn with the
// realistic hi-res eye renderer (eyes.ts eye(): the display layer), its iris on the ship, 4 pale optic-nerve strands
// trailing behind it (drawHatch's nerve pink), bloodshot veins, and a blink tell: the lid closes, snaps wide, the pupil
// blows. Its whites are dimmed to <= 85% brightness (an .85 alpha over a dark backing ball), so it never reads as an
// enemy bullet's hot core or a pod.
// LAYER ORDER (the bullet is sacred): eye() queues onto the display canvas, which drawWorld's flushLo() paints at the
// END of the world pass (render/hud.ts drawWorld -> flushLo -> drawEyeQ). The enemy shots are drawn after that, by
// drawEShots onto the cleared low-res layer, and present() lays that layer OVER the display canvas. So every enemy
// bullet draws on top of the eye: a 30 px eye never hides one. (It does draw over the ship and the terrain, as every
// queued eye in the game does.)
// Render-only: srnd() / $.T / fields the sim set, never R().
import { $ } from '../state';
import { TAU, ctx } from '../core';
import { srnd, sri, srr } from '../srnd';
import { drop, flash, gib, mist } from '../fx/spawn';
import { EYEQ, eye, eyeSet } from './eyes';
import { WATCH, WDIE, dilOf, lidOf } from '../enemies/watcher';

/** the iris colour: a cold, pale-ringed blue, apart from the toxic-green enemy fire and the turret eye's olive */
const IRIS = '#3b6fd0';
/** the nerve's pinks (render/enemies.ts drawHatch's fallback nerve) and its vessel */
const NERVE = ['#2e0507', '#8c1219', '#d2646c'], VESSEL = '#5a0a0e'; // Matt 2026-11-25: stringy, bloody optic nerves, not tentacles
/** px: where each of the 4 strands leaves the back of the ball (angle off its tail), and its length */
const STRANDS = [[-.95, 20], [-.7, 31], [-.45, 40], [-.2, 27], [0, 46], [.18, 36], [.4, 24], [.62, 38], [.85, 19]];
/** the .85 whites rule: the eye is queued at this alpha over a dark backing ball */
const DIM = .85;
/** the strand's sample points (reused: no allocation per frame) */
const SP = Array.from({ length: 12 }, () => [0, 0]);

/** one strand from the ball's back at angle a (0 = straight behind, +x), length L, wave w (px: an S that travels down
 *  it), droop (px, + down). A tapering cubic: thick at the ball, thin and torn at the end */
function strand(c, r, a, L, w, droop, al = 1) {
  const bx = Math.cos(a) * r * .8, by = Math.sin(a) * r * .8, d = a * .7,
    ex = bx + Math.cos(d) * L, ey = by + Math.sin(d) * L + droop,
    nx = -Math.sin(d), ny = Math.cos(d), // the strand's normal: the S bends along it
    c1x = bx + (ex - bx) / 3 + nx * w, c1y = by + (ey - by) / 3 + ny * w,
    c2x = bx + (ex - bx) * 2 / 3 - nx * w * .8, c2y = by + (ey - by) * 2 / 3 - ny * w * .8;
  const n = SP.length - 1;
  for (let j = 0; j <= n; j++) {
    const t = j / n, u = 1 - t, A = u * u * u, B = 3 * u * u * t, C = 3 * u * t * t, D = t * t * t;
    SP[j][0] = A * bx + B * c1x + C * c2x + D * ex; SP[j][1] = A * by + B * c1y + C * c2y + D * ey;
  }
  c.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    c.strokeStyle = NERVE[i];
    c.globalAlpha = al * (i === 2 ? .7 : 1);
    const w0 = [1.5, .95, .35][i]; // thin strings, not tentacles
    for (let j = 0; j < n; j++) { // taper: each segment a little thinner
      c.lineWidth = w0 * (1 - .6 * j / n);
      c.beginPath(); c.moveTo(SP[j][0], SP[j][1] - (i === 2 ? .45 : 0)); c.lineTo(SP[j + 1][0], SP[j + 1][1] - (i === 2 ? .45 : 0)); c.stroke();
    }
  }
  c.globalAlpha = al;
  c.strokeStyle = VESSEL; // a vessel running along it
  c.lineWidth = .35;
  c.beginPath(); c.moveTo(SP[0][0], SP[0][1] + .7);
  for (let j = 1; j < n; j++) c.lineTo(SP[j][0], SP[j][1] + .6);
  c.stroke();
  c.fillStyle = '#8a0f12'; // the torn end, bloody
  c.fillRect(ex - .7, ey - .7, 1.5, 1.5);
  c.lineCap = 'butt';
  return [ex, ey];
}

/** the hi-res overlay queued right after the eye (EYEQ, drawn on the display canvas in order): thick veins crawling in
 *  from the rim, the hit flash (red, never white), the tell's rim pulse. Called with device (X, Y) and radius R */
function overlay(D, X, Y, R, q) {
  D.save();
  D.translate(X, Y);
  D.beginPath(); D.arc(0, 0, R, 0, TAU); D.clip();
  D.strokeStyle = `rgba(118,10,18,${.55 * (1 - q.lid * .8)})`; // veins: under the lid they are hidden by it
  D.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = q.seed * .31 + i * 2.399, l = .3 + .12 * ((i * 7 + q.seed) % 4);
    let x = Math.cos(a) * R * 1.02, y = Math.sin(a) * R * 1.02, h = a + Math.PI;
    D.lineWidth = Math.max(1, R * .055);
    D.beginPath(); D.moveTo(x, y);
    for (let k = 0; k < 4; k++) { h += Math.sin(i * 3.1 + k * 1.7) * .45; x += Math.cos(h) * R * l * .3; y += Math.sin(h) * R * l * .3; D.lineTo(x, y); }
    D.stroke();
    D.lineWidth = Math.max(.6, R * .025); // one fork off it
    D.beginPath(); D.moveTo(x, y); D.lineTo(x + Math.cos(h + .9) * R * .12, y + Math.sin(h + .9) * R * .12); D.stroke();
  }
  if (q.flash) { D.fillStyle = `rgba(255,70,60,${q.flash >= 3 ? .34 : .16})`; D.fillRect(-R, -R, R * 2, R * 2); } // an armoured (lid-shut) hit is dimmer
  D.restore();
  if (q.tel > 0) { // the tell's rim: a wet red ring, swelling to the shot
    D.strokeStyle = `rgba(255,40,30,${.25 + .5 * q.tel})`;
    D.lineWidth = Math.max(1, R * (.06 + .06 * q.tel));
    D.beginPath(); D.arc(X, Y, R * (1.02 + .06 * q.tel), 0, TAU); D.stroke();
  }
}
const OV = new WeakMap(); // enemy -> its overlay's queue entry (render-only; the sim object is untouched)

/** DRAW.watcher: the ctx is at the eye's centre (render/enemies.ts drawEnemy) */
export function drawWatcher(c, e) {
  const r = e.r, t = $.T, P = $.P, lid = lidOf(e), tel = e.st === 'tel' ? Math.max(0, (e.wt - WATCH.open) / (WATCH.tell - WATCH.open)) : 0;
  const ang = P ? Math.atan2(P.y - e.y, P.x - e.x) : Math.PI, ga = c.globalAlpha;
  // the nerves trail behind (it flies left): a slow swim, faster through the tell
  const sw = t * (e.st === 'tel' ? .16 : .07);
  c.fillStyle = '#8a0f12';
  for (let i = 0; i < STRANDS.length; i++) {
    const [a, L] = STRANDS[i], [x, y] = strand(c, r, a + Math.sin(sw + i * 1.9) * .14, L, Math.sin(sw * 1.3 + i * 1.3) * 7, 2 + Math.sin(sw + i) * 3.5);
    // blood beading off the torn ends and letting go (every other string, out of step)
    if (i % 2 === 0) {
      const q0 = (e.t + (e.bph || 0) + i * 11) % 30;
      c.globalAlpha = ga;
      c.fillStyle = q0 > 22 ? '#5e070b' : '#9a1016';
      c.fillRect(x - .5, y + q0 * .4, 1, 1 + (q0 > 22 ? 1 : 0));
    }
  }
  c.globalAlpha = ga;
  // the dark backing ball: the dimmed eye shows it through (the .85 whites rule), and the low-res pass reads as a ball
  c.fillStyle = '#2a080b';
  c.beginPath(); c.arc(0, 0, r + .6, 0, TAU); c.fill();
  c.globalAlpha = ga * DIM;
  eye(c, 0, 0, r, { ang, m: .8, iris: IRIS, bs: 2.5, blink: lid, dil: dilOf(e), lid: '#5a1418' });
  c.globalAlpha = ga;
  let q = OV.get(e);
  if (!q) { q = { draw: overlay, mf: e.mf }; OV.set(e, q); }
  if (e.mf !== q.mf) { q.mf = e.mf; flash(e.x + Math.cos(ang) * r * .4, e.y + Math.sin(ang) * r * .4, 10, 5, '255,60,60'); } // the sim's shot (e.mf): its muzzle flash, once
  q.lid = lid; q.flash = e.flash; q.tel = tel; q.seed = e.bph || 0; q.al = ga;
  if (c === ctx && !$.EYE_LOW) {
    const m = c.getTransform();
    q.x = m.e; q.y = m.f; q.r = r * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
    EYEQ.push(q); // after the eye: drawn over it, still under the enemy shots
  } else overlay(c, 0, 0, r, q);
}

// ---------------- the death (enemies/watcher.ts killWatcher pushes WDIE) ----------------
/** frames: the blood pumps out over [pump0, pump1); the lens flies for LENS; the nerves fall for NERVES; the iris
 *  disc hangs on for IRIS_HOLD, then fades over IRIS_FADE (studio: ~40 f, still pointed at the ship) */
const DIE = { pump0: 5, pump1: 46, lens: 80, nerves: 110, irisHold: 40, irisFade: 16, dil: 1.3 }; // dil: the dead pupil, relaxed from the shot's 1.9
/** the iris disc's hi-res draw (EYEQ custom entry): the iris photo, its pupil blown, torn muscle round its rim,
 *  turned toward the ship (foreshortened along its gaze, as paintEye does) */
function irisDraw(D, X, Y, R, q) {
  const set = eyeSet(IRIS, 0, 2.5); // a shared object: read .i now
  D.save();
  D.translate(X, Y);
  D.rotate(q.ang);
  D.scale(.72, 1);
  D.strokeStyle = 'rgba(110,14,20,.9)'; // the ciliary muscle torn off with it
  D.lineWidth = Math.max(1, R * .14);
  D.lineCap = 'round';
  D.beginPath();
  for (let k = 0; k < 7; k++) { const a = k * .9 + q.seed; D.moveTo(Math.cos(a) * R * .9, Math.sin(a) * R * .9); D.lineTo(Math.cos(a) * R * 1.35, Math.sin(a) * R * 1.35 + R * .2); }
  D.stroke();
  if (set.i) D.drawImage(set.i, -R * 2, -R * 2, R * 4, R * 4);
  else { D.fillStyle = IRIS; D.beginPath(); D.arc(0, 0, R, 0, TAU); D.fill(); }
  D.fillStyle = '#030000';
  D.beginPath(); D.arc(0, 0, R * .38 * DIE.dil, 0, TAU); D.fill();
  D.fillStyle = 'rgba(205,212,218,.55)'; // a wet glint, never bullet-white
  D.beginPath(); D.arc(-R * .32, -R * .3, R * .11, 0, TAU); D.fill();
  D.restore();
}
/** the burst (the sim's killWatcher only records it): the vitreous first, pale and clear-ish (DC[4]), a little blood, the
 *  sclera torn to skin, a couple of chunks, a wet mist and the flash */
function burst(d) {
  const { x, y, dir } = d;
  // Matt 2026-11-25: "when you kill them, blood shoots everywhere": a hard arterial spray all round, then the vitreous
  for (let k = 0; k < 140; k++) { const a = srr(0, TAU), sp = srr(1.5, 6.5); drop(x + srr(-4, 4), y + srr(-4, 4), Math.cos(a) * sp + dir * srr(0, 1.2), Math.sin(a) * sp - 1, srr(1.2, 2.6), srnd() < .65 ? 0 : 1, sri(70, 140)); }
  for (let j = 0; j < 6; j++) { const a = srr(0, TAU); for (let k = 0; k < 14; k++) { const sp = srr(3, 8); drop(x, y, Math.cos(a + srr(-.12, .12)) * sp, Math.sin(a + srr(-.12, .12)) * sp - .6, srr(1, 2), 0, sri(60, 120)); } } // six jets
  mist(x, y, 14, 60, 0);
  for (let k = 0; k < 44; k++) { const a = srr(0, TAU), sp = srr(.6, 3.4); drop(x + srr(-5, 5), y + srr(-5, 5), Math.cos(a) * sp + dir * srr(0, 1), Math.sin(a) * sp - .5, srr(1.1, 1.9), 4, sri(50, 100)); }
  for (let k = 0; k < 10; k++) { const a = srr(0, TAU), sp = srr(.4, 2); drop(x, y, Math.cos(a) * sp, Math.sin(a) * sp - .3, srr(1.2, 2), k % 3 ? 0 : 2, sri(60, 110)); }
  for (let k = 0; k < 4; k++) gib(x + srr(-6, 6), y + srr(-6, 6), srr(-2, 2) + dir * .6, srr(-2.4, .6), 'skin', srr(2.4, 3.6));
  for (let k = 0; k < 2; k++) gib(x, y, srr(-1.6, 1.6), srr(-2, .4), 'chunk', srr(2.4, 3.4));
  mist(x, y, 9, 46, 1);
  mist(x + srr(-4, 4), y + srr(-4, 4), 6, 34, 1);
  flash(x, y, 34, 8, '255,90,70');
}
let lastG = null;
/** THE WATCHER's death, once per render after the enemies (hud.ts drawWorld): the blood pumping out after the clear
 *  fluid, the lens flying off, the nerves gone limp and falling, the iris disc still watching the ship */
export function drawWatcherFx() {
  if (lastG !== $.G) { lastG = $.G; WDIE.length = 0; }
  if (!WDIE.length) return;
  const c = ctx, P = $.P;
  for (let i = WDIE.length - 1; i >= 0; i--) {
    const d = WDIE[i], a = $.T - d.t;
    if (a < 0 || a > DIE.nerves) { WDIE.splice(i, 1); continue; }
    const { x, y, r } = d;
    // the burst on its first frame, then the blood pumped out after the clear fluid (the shared particles, srnd() only)
    if (d.pa < 0) { d.pa = 0; burst(d); }
    for (; d.pa < a; d.pa++) {
      const f = d.pa;
      if (f < DIE.pump0 || f >= DIE.pump1 || f % 2) continue;
      for (let k = 0, n = f < 20 ? 7 : 3; k < n; k++) drop(x + srr(-3, 3), y + srr(-3, 3), srr(-1.6, 1.6) + d.dir * .4, srr(-1.8, .6), srr(1.2, 2.2), srnd() < .6 ? 0 : 1, sri(70, 120));
    }
    // the nerves: limp, falling, trailing up behind their falling root
    if (a < DIE.nerves) {
      const k = Math.min(1, a / 24), ax = x + r * .5 - a * .25, ay = y + .025 * a * a, al = Math.min(1, (DIE.nerves - a) / 30);
      c.save();
      c.translate(ax, ay);
      for (let s = 0; s < STRANDS.length; s++) {
        const [sa, L] = STRANDS[s], wig = Math.sin(a * .3 + s * 2) * 3 * (1 - k);
        strand(c, 2, sa * (1 - k) - k * (1.2 + s * .22), L * (1 - .25 * k), wig, -k * 6, al);
      }
      c.restore();
      c.globalAlpha = 1;
    }
    // the lens: popped off the front, spinning (a disc seen edge-on as it turns), falling
    if (a < DIE.lens) {
      const lx = x + Math.cos(d.ang) * (r * .6 + a * 1.4), ly = y + Math.sin(d.ang) * r * .6 - a * 2.1 + .035 * a * a, sp = Math.abs(Math.cos(a * .22)) * .9 + .1;
      c.save();
      c.globalAlpha = Math.min(1, (DIE.lens - a) / 20);
      c.translate(lx, ly);
      c.rotate(a * .05);
      c.fillStyle = 'rgba(176,200,212,.38)';
      c.strokeStyle = 'rgba(214,228,234,.55)';
      c.lineWidth = .6;
      c.beginPath(); c.ellipse(0, 0, 4.6 * sp, 4.6, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = 'rgba(214,224,230,.7)';
      c.fillRect(-1.4 * sp, -2, 1, 1);
      c.restore();
    }
    // the iris disc: hangs on, still turned to the ship, then sinks and fades
    const hold = DIE.irisHold + DIE.irisFade;
    if (a < hold) {
      const ix = x + Math.cos(d.ang) * r * .35, iy = y + Math.sin(d.ang) * r * .35 + .004 * a * a,
        al = a < DIE.irisHold ? 1 : 1 - (a - DIE.irisHold) / DIE.irisFade,
        ga = P && P.alive ? Math.atan2(P.y - iy, P.x - ix) : d.ang, R = r * .5;
      const q = d.q || (d.q = { draw: irisDraw, seed: d.bph * .37 });
      q.ang = ga; q.al = al;
      if (!$.EYE_LOW) {
        const m = c.getTransform();
        q.x = m.a * ix + m.e; q.y = m.d * iy + m.f; q.r = R * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
        EYEQ.push(q);
      } else {
        c.globalAlpha = al;
        c.fillStyle = IRIS; c.beginPath(); c.ellipse(ix, iy, R * .72, R, ga, 0, TAU); c.fill();
        c.fillStyle = '#030000'; c.beginPath(); c.arc(ix, iy, R * .38 * DIE.dil, 0, TAU); c.fill();
        c.globalAlpha = 1;
      }
    }
  }
}
