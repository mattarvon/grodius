// @ts-nocheck
// Weapon feel: how hard the gun is right now (drives muzzle/sound/kick), bounded smoke + shockwave rings,
// and hit feedback that scales with damage (sparks, spray, knockback, crit pops, kill hitstop).
import { $ } from '../state';
import { pk } from '../perks';
import { gmL } from '../mutations';
import { R, TAU, clamp, rr, ri } from '../core';
import { sfx } from '../audio';
import { drop, gore, mist, pop, spark } from './spawn';

/** 0..~9: how much killing power the ship carries. Muzzle flash, recoil and shot sound key off this. */
export function gunPow() {
  const P = $.P;
  if (!P) return 0;
  return (P.double || P.laser ? 1.2 : 0) + P.missile * .5 + P.pyre * .7 + P.options * .6 + gmL('cal') * .7 + gmL('serr') * .7 + gmL('rapid') * .5 + gmL('over') * .5 + pk('dmg') * .3 + (pk('glass') ? .6 : 0);
}
/** 0..4 sound/visual tier */
export const gunTier = () => Math.min(4, Math.floor(gunPow() / 1.5));

// ---- smoke puffs (missile trails, muzzle) + shockwave rings: own small pools, hard-capped ----
export const SMOKE = [], RINGS = [];
export function smoke(x, y, r, l, vx = -.35, vy = -.1, c = 0) {
  if (SMOKE.length >= 160) return;
  SMOKE.push({ x, y, r, vr: rr(.06, .14), vx, vy, l, ml: l, c });
}
export function ring(x, y, r0, r1, l, col, w = 2) {
  if (RINGS.length >= 24) RINGS.shift();
  RINGS.push({ x, y, r0, r1, l, ml: l, col, w });
}
export function stepGunFX() {
  const ss = ($.G && $.G.scrollSpeed) || 0;
  for (let i = SMOKE.length - 1; i >= 0; i--) {
    const s = SMOKE[i];
    s.x += s.vx - ss * .5;
    s.y += s.vy;
    s.vx *= .97;
    s.r += s.vr;
    if (--s.l <= 0) { SMOKE[i] = SMOKE[SMOKE.length - 1]; SMOKE.pop(); }
  }
  for (let i = RINGS.length - 1; i >= 0; i--) if (--RINGS[i].l <= 0) { RINGS[i] = RINGS[RINGS.length - 1]; RINGS.pop(); }
  const P = $.P;
  if (P && P.kick) P.kick = P.kick < .1 ? 0 : P.kick * .72;
}

let critGoreT = -99, stopT = -99;
/** hit feedback. d = damage dealt, crit = multiplier (>1 on a crit), dir = travel direction, col = rgb of the round */
export function impact(e, d, x, y, dir, crit = 1, col = '255,230,200') {
  const G = $.G;
  // sparks scale with damage (bounded)
  const n = Math.min(10, 1 + Math.round(d * 1.6));
  for (let k = 0; k < n; k++) spark(x, y, -dir * rr(.4, 2.6) + rr(-.6, .6), rr(-1.8, 1.8), ri(5, 11), k & 1 ? '#fff4e0' : `rgb(${col})`);
  // heavy rounds blow a cone of blood out the far side
  if (d >= 2.2) {
    const m = Math.min(16, Math.round(d * 2.2));
    for (let k = 0; k < m; k++) drop(x, y, dir * rr(1.2, 4.2), rr(-1.6, 1.2), rr(1, 1.8), R() < .25 ? 2 : 0, ri(40, 90));
    if (R() < .5) mist(x + dir * 4, y, rr(3, 4 + d), 22);
  }
  // knockback on fodder (bosses/minis are anchored)
  if (!e.dead && !e.big && !e.mini && !e.par && d >= 1.4) {
    const kb = Math.min(5, (d - 1) * 1.1);
    e.x += dir * kb;
  }
  if (G && d >= 3) G.shake = Math.min(6, (G.shake || 0) + Math.min(1.2, d * .12));
  if (crit > 1) {
    pop(x, y - 10, crit >= 3 ? 'CRIT x3' : 'CRIT', '#ffd23a', crit >= 3 ? 11 : 9, 30);
    for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; spark(x, y, Math.cos(a) * 2.6, Math.sin(a) * 2.6, 10, '#ffd23a'); }
    if (G && G.t - critGoreT > 5) { critGoreT = G.t; gore(x, y, .45, { dir }); }
    sfx.crit();
  } else if (d >= 6) pop(x + rr(-3, 3), y - 9, '' + Math.round(d * 10), '#ffe0c0', 7, 22);
  if (d >= 2.2) sfx.hitHeavy(d);
  // kill weight: a heavy blow freezes the frame (throttled so a hose doesn't stutter the game)
  if (G && e.dead) {
    const heavy = e.big || e.mini;
    if (heavy) G.hitstop = Math.max(G.hitstop || 0, 5);
    else if ((d >= 3 || crit > 1) && G.t - stopT > 30) { stopT = G.t; G.hitstop = Math.max(G.hitstop || 0, 2); }
  }
}
