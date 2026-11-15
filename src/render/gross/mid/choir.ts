// @ts-nocheck
// Render-only: own RNG and particles (../midbosses.ts), no gameplay state touched. Sim: enemies/mid/choir.ts.
import { $ } from '../../../state';
import { TAU, ctx, hash } from '../../../core';
import { glowC, fxs, spray, stepParts, drawParts, strand, snd, emit, rnd, rn, GROSS } from '../midbosses';
import { bakedBuilt, bakedDrop, bakedFallback, bakedWarm, bf, breath, pour, trackDeath, twitch, woundStage } from '../baked';

// =====================================================================
//  THE NAIL CHOIR - an eye cut out of its socket: six torn muscles, orbital fat, a trailing nerve, the cornea frosted blind,
//  and it follows you anyway (Matt's pick c3 The Enucleated Eye). Art: tools/bossart/choir/bake.py -> sprites/boss/choir.png.
//  The body frames carry the muscles and fat; the globe is its own list per gaze angle, drawn over them, so the eye tracks
//  you (idle: your position; tell: e.ha) without rotating a pixel sprite. The nailbars' art is drawChoirNail below.
// =====================================================================
const K = 'choir', NA = 16;
const DEATH = { k: K, list: 'die', rate: 6, fall: .02, hold: 30, gore: (x, y, age) => pour(x - 2, y, age, { w: 15, h: 15, jets: 6, len: 80, meat: 18, rope: 6 }) };
// boss-local drip points: the cut nerve, the torn strap ends that hang low; then the wounds that open with each stage
const ENDS = [[29, 39, 9, 83], [-34, 21, 6, 101], [6, 37, 7, 67], [22, 33, 5, 119]];
const WOUNDS = [[10, -9, 5, 53], [13, 9, 6, 61], [6, -5, 9, 41], [16, 13, 7, 47]];
/** gaze angle -> its baked frame (index i is i * 22.5 deg) */
const gi = (a) => Math.round(((a % TAU) + TAU) % TAU / TAU * NA) % NA;

function grossChoir(c, e) {
  const s = fxs(e), t = e.t, tel = e.st === 'tel' ? e.wt / 40 : 0;
  stepParts(s);
  trackDeath(e, DEATH);
  if (s.ev === 'idle>tel') snd('gross_gargle', .55, .4);
  if (s.ev === 'tel>idle') { spray(s, e.x - 10, e.y, 10, '#8a1a1a', 1.6, 1.1, .3); spray(s, e.x - 10, e.y, 6, '#c8dcea', 1.4, .8, .2); }
  if (e.dead || e.hp <= 0) { if (!bf(c, K, 'die', 0)) bakedFallback(c, e.r); return; }
  const w = woundStage(e);
  // the eye: on the tell it holds the fan's aim; otherwise it watches you from the cornea (the fan origin)
  const a = e.st === 'tel' ? e.ha : Math.atan2($.P.y - e.y, $.P.x - (e.x - 10));
  // the tell trembles: a whole-pixel shake of body and globe together, so the globe never slips off its socket
  const ox = tel > .45 ? (hash(t * 1.37) * 3 | 0) - 1 : 0;
  let ok;
  if (e.flash) ok = bf(c, K, 'hurt' + w) && bf(c, K, 'gh' + w);
  else if (tel) ok = bf(c, K, 'tell' + w, twitch(t, 3, 7 - tel * 4), ox) && bf(c, K, (tel > .3 ? 't' : 'g') + w, gi(a), ox);
  else ok = bf(c, K, 'idle' + w, breath(t, 6, 120 - w * 22, 5)) && bf(c, K, 'g' + w, gi(a));
  if (!ok) bakedFallback(c, e.r);
  // the wet a still frame can't hold: the cut nerve and the torn strap ends drip, the wounds bleed more with each stage
  for (let i = 0; i < ENDS.length; i++) { const h = ENDS[i]; strand(c, s, e, 60 + i, h[0], h[1], h[2], 1, 'rgba(62,8,14,.9)', h[3], '#5a0a12', 1.3); }
  for (let i = 0; i < w * 2 && i < WOUNDS.length; i++) { const h = WOUNDS[i]; strand(c, s, e, 70 + i, h[0], h[1], h[2], 1 + .2 * w, 'rgba(96,6,14,.95)', h[3], '#8a0c14', .6); }
  if (e.flash && rnd() < .55 * GROSS) emit(s, e.x + rn(-8, 14), e.y + rn(-12, 12), rn(-1.6, 1.6), rn(-1.8, .2), '#7a0a12', rn(.8, 1.6), 0, 60);
  if (w === 2 && rnd() < .06 * s.dt) emit(s, e.x + 6, e.y - 5, rn(-.3, .3), rn(-.2, .3), '#9a9890', rn(.7, 1.1), 0, 70); // the vitreous weeps out
  // the tell: blood rises under the frost and the cornea throws ice light down the fan line
  if (tel > 0 && rnd() < (.1 + tel * .4) * s.dt) emit(s, e.x - 10 + rn(-3, 3), e.y + rn(-3, 3), rn(-.6, .2), rn(-.4, .6), hash(t) < .6 ? '#a8201e' : '#d8eef8', rn(.6, 1.1), 0, 24, .05);
  drawParts(c, s, e);
  if (tel) {
    c.globalCompositeOperation = 'lighter';
    glowC(c, -10 + ox, 0, 7 + tel * 13, '160,215,255', .2 + .55 * tel);
    c.globalCompositeOperation = 'source-over';
  }
}

// nail tips on a bar, bar-local: the baked nails point -x, roots at x 2, tips at x -9
const TIPY = [-12, -6, 0, 6, 12];
/** a nailbar whose parent is the Choir (render/enemies.ts branches drawNailbar on e.par.k): a torn tendon sheet tacked up
 *  with real-rust nails. Singing (e.sing 36..0): rime races up the nails and the tips spark, so the glint stays readable */
export function drawChoirNail(c, e) {
  const d = e.hp < e.max * .5 ? 1 : 0, T = $.T || 0, sing = e.sing > 0 ? 1 - e.sing / 36 : 0;
  const ok = sing ? bf(c, K, 'sing' + d, Math.min(3, sing * 4 | 0)) : bf(c, K, 'bar' + d, breath(T + (e.i || 0) * 41, 4, 70, 9 + (e.i || 0)));
  if (!ok) { c.fillStyle = '#1a0c0e'; c.fillRect(-3, -15, 6, 30); }
  if (sing) {
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < TIPY.length; i++) {
      const fl = hash((T >> 2) * 1.9 + i * 7.3 + (e.i || 0)) < .35 ? .3 : 1; // each nail catches the light on its own beat
      glowC(c, -9, TIPY[i], 2 + sing * 4, '215,240,255', (.25 + .6 * sing) * fl);
    }
    c.globalCompositeOperation = 'source-over';
  }
}

/** under the body: the fan it's about to throw, as frost lines */
function under(e) {
  if (e.st !== 'tel') return;
  let n = 7; // 5 while a nailbar lives (a loop, not .some(): no per-frame closure)
  for (const b of e.bars) if (!b.dead) { n = 5; break; }
  const k = e.wt / 40;
  ctx.save();
  ctx.setLineDash([2, 4]);
  ctx.lineDashOffset = -$.T;
  ctx.strokeStyle = `rgba(170,220,255,${.15 + .45 * k})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < n; i++) { const a = e.ha + (i - (n - 1) / 2) * .16; ctx.moveTo(e.x - 10, e.y); ctx.lineTo(e.x - 10 + Math.cos(a) * 150, e.y + Math.sin(a) * 150); }
  ctx.stroke();
  ctx.restore();
}

/** the kind's art for the registry (./index.ts): draw, and its atlas for the per-route warm-up (render/warmup.ts) */
export default {
  draw: grossChoir,
  under,
  warm() { bakedWarm(K); return false; }, // false: nothing left to build
  built: () => bakedBuilt(K),
  drop() { bakedDrop(K); },
};
