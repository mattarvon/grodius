// @ts-nocheck
// Render-only: own RNG and particles (../midbosses.ts), no gameplay state touched. Sim: enemies/mid/choir.ts.
import { $ } from '../../../state';
import { C, TAU, ctx, hash } from '../../../core';
import { poly } from '../../util';
import { eye } from '../../eyes';
import { glowC, eyeC, fxs, stepParts, drawParts, strand, bubble, layer, snd, GROSS, hn, blob, lay } from '../midbosses';

// =====================================================================
//  THE NAIL CHOIR - a frozen pus-weeping eye in a crust of gargling, frostbitten mouths
// =====================================================================
const chRim = (a, i) => (i % 2 ? 15 : 21) + hash(i + 3) * 4;
const choirCrust = () => layer('choir', 60, 60, (x) => {
  x.translate(30, 30);
  x.fillStyle = '#081420';
  blob(x, 16, 1, chRim);
  x.fill();
  x.fillStyle = 'rgba(150,205,245,.6)';
  blob(x, 16, .86, chRim);
  x.fill();
  // dirty ice: frozen phlegm, old blood and pus caught in the crust
  x.save();
  blob(x, 16, .86, chRim);
  x.clip();
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU + hn(i) * .5, r = 15 + hn(i, 1) * 4, px = Math.cos(a) * r, py = Math.sin(a) * r, k = hn(i, 2);
    x.fillStyle = k < .5 ? 'rgba(190,200,70,.45)' : k < .75 ? 'rgba(110,20,30,.45)' : 'rgba(225,200,90,.5)';
    x.beginPath();
    x.ellipse(px, py, 2 + hn(i, 3) * 2, 1.2 + hn(i, 4) * 1.2, a, 0, TAU);
    x.fill();
  }
  x.strokeStyle = 'rgba(190,200,70,.5)'; // phlegm streaks frozen mid-run
  x.lineWidth = .8;
  x.beginPath();
  for (let i = 0; i < 7; i++) { const a = hn(i, 9) * TAU, r = 13 + hn(i, 8) * 5; x.moveTo(Math.cos(a) * r, Math.sin(a) * r); x.lineTo(Math.cos(a) * r + hn(i, 7) * 2 - 1, Math.sin(a) * r + 3 + hn(i, 6) * 3); }
  x.stroke();
  x.restore();
  x.strokeStyle = '#f2fbff';
  x.lineWidth = .7;
  x.beginPath();
  for (let i = 0; i < 16; i += 2) { const a = i / 16 * TAU, r = chRim(a, i) * .86; x.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  x.stroke();
});
// mouths: [x, y, size, drools] - set into the crust, facing out
const MOUTHS = [[-17, 1, 1.35, 1], [-11, -13, 1.1, 0], [-11, 13, 1.2, 1], [11, -12.5, 1, 0], [13, 9.5, 1.1, 1]];
function choirMouth(c, s, e, k, mx, my, sz, drool, tel) {
  const t = e.t, o = .45 + .55 * Math.max(0, Math.sin(t * (.09 + tel * .25) + k * 2)) + tel * .4, g = Math.sin(t * .7 + k) * .25 * (1 + tel * 2);
  c.save();
  c.translate(mx, my);
  c.scale(sz, sz);
  // frostbitten lips: purple-black, rimed white, split open and beading blood
  c.fillStyle = '#1c0c1c';
  c.beginPath();
  c.ellipse(0, 0, 4.4, 3 + o * .9, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#7a4068';
  c.beginPath();
  c.ellipse(0, -.2, 3.8, 2.5 + o * .8, 0, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(230,245,255,.85)';
  c.fillRect(-2.6, -2.6 - o * .8, 2, .7);
  c.fillStyle = '#140810';
  c.fillRect(1.2, -2.4 - o * .7, 1.6, .9);
  c.fillRect(-3, 1 + o * .5, 1.5, 1);
  // the throat, full of phlegm, gargling
  c.fillStyle = '#050102';
  c.beginPath();
  c.ellipse(0, 0, 2.9, 1.7 * o + .4, 0, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(190,200,70,.95)';
  c.beginPath();
  c.ellipse(g, .7 * o + .3, 1.8, .7 * o, 0, 0, Math.PI);
  c.fill();
  // rotten teeth: brown, black, one missing
  const T = ['#f0e4b0', '#8a7034', '#e0cc80', null, '#4a3414', '#fff4c8'];
  for (let i = 0; i < 3; i++) { const col = T[(i + k) % 6]; if (col) { c.fillStyle = col; c.fillRect(-2 + i * 1.4, -1.6 * o - .4, 1.1, 1.2 + (i % 2) * .5); } }
  for (let i = 0; i < 2; i++) { const col = T[(i + k + 3) % 6]; if (col) { c.fillStyle = col; c.fillRect(-1.3 + i * 1.6, 1.6 * o - .9, 1, 1); } }
  // splits in the lips, beading blood
  c.strokeStyle = '#d0203a';
  c.lineWidth = .45;
  c.beginPath();
  c.moveTo(-1, -2.4 - o * .8); c.lineTo(-.6, -1.4 - o * .7);
  c.moveTo(1.2, 2.2 + o * .7); c.lineTo(.8, 1.4 + o * .6);
  c.stroke();
  c.restore();
  // gargle bubbles boiling out of the phlegm
  bubble(c, s, e, k * 3 + 1, mx + g * 2, my + .6 * sz, (.9 + tel * 1.4) * sz, tel ? 14 : 28, 'rgba(210,215,110,.7)', 'rgba(240,245,160,.9)', '#c8cc5a', 3);
  if (drool) strand(c, s, e, k + 10, mx + .5, my + (1.6 * o + .5) * sz, 9 * sz, 1.1, 'rgba(195,205,85,.85)', 95 + k * 13, '#e4f0c0', 1.2);
}
function grossChoir(c, e) {
  const s = fxs(e), t = e.t, tel = e.st === 'tel' ? e.wt / 40 : 0;
  stepParts(s);
  if (s.ev === 'idle>tel') snd('gross_gargle', .55, .4);
  // tongues nailed to its orbiting nails, frozen stiff, spit icicles hanging off them
  for (const b of e.bars || []) {
    if (b.dead || GROSS <= 0) continue;
    const bx = b.x - e.x, by = b.y - e.y, fl = Math.sin(t * .06 + b.i * 3) * .4;
    c.save();
    c.translate(bx, by);
    c.fillStyle = '#4a1a2a';
    c.beginPath();
    c.moveTo(1, -6); c.quadraticCurveTo(8, -7 + fl, 11, -1 + fl * 2); c.quadraticCurveTo(8, 2, 1, 0);
    c.fill();
    c.fillStyle = '#a65a72';
    c.beginPath();
    c.moveTo(1, -5.2); c.quadraticCurveTo(7.5, -6 + fl, 10, -1.4 + fl * 2); c.quadraticCurveTo(7, .8, 1, -.8);
    c.fill();
    c.fillStyle = 'rgba(200,210,90,.8)';
    c.fillRect(4, -4, 3, .8);
    c.fillStyle = '#2a0a14';
    c.fillRect(5.5, -3.6, .5, 2.6);
    c.fillStyle = '#d8efff';
    for (let q = 0; q < 3; q++) poly(c, [[3 + q * 2.6, -.4], [4.4 + q * 2.6, -.6], [3.7 + q * 2.6, 3 + hash(q + b.i * 5) * 3]]);
    c.restore();
    strand(c, s, e, 40 + b.i, bx + 9.5, by + fl * 2, 6, .8, 'rgba(195,205,85,.8)', 120 + b.i * 17, '#e4f0c0', .8);
  }
  // pus-cicles: the eye's pus ran down and froze; it still drips
  for (let k = -2; k <= 2; k++) {
    const pus = k !== 1, h = 22 + hash(k + 9) * 6 + (pus ? 4 * GROSS : 0), x0 = k * 5;
    c.fillStyle = pus ? '#c8b040' : '#d8efff';
    poly(c, [[x0 - 1.9, 15], [x0 + 1.9, 15], [x0, h]]);
    c.fillStyle = pus ? 'rgba(240,225,120,.9)' : '#f4fbff';
    poly(c, [[x0 - 1, 15], [x0, 15], [x0 - .2, h - 3]]);
    if (pus) strand(c, s, e, 20 + k, x0, h - .5, 4, .9, 'rgba(225,205,80,.9)', 70 + k * 11, '#f0e070', .4);
  }
  c.drawImage(choirCrust(), -30, -30);
  const g = c.createRadialGradient(-3, -4, 1, 0, 0, 13);
  g.addColorStop(0, '#d88a7a');
  g.addColorStop(.6, '#7a3a3a');
  g.addColorStop(1, '#2a0f14');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, 13, 0, TAU);
  c.fill();
  // infected socket: yellow-green crust ringing the eye
  c.fillStyle = 'rgba(205,200,70,.9)';
  for (const [x, y, r] of [[-10, -1, 1.6], [6.2, 2, 1.3], [-6, 7.2, 1.2]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  // the choir: frostbitten mouths with rotten teeth, gargling frozen phlegm
  for (let k = 0; k < MOUTHS.length; k++) { const [mx, my, sz, dr] = MOUTHS[k]; if (k < 3 || GROSS > 0) choirMouth(c, s, e, k, mx, my, sz, dr && GROSS > 0, tel); }
  eyeC(c, -2, 0, 7.5, { ang: e.st === 'tel' ? e.ha : Math.atan2($.P.y - e.y, $.P.x - e.x), iris: '#9fd8ff', bs: 3, blink: !tel && t % 170 < 5 ? 1 : 0, lid: '#5a2a3a' });
  // nails driven through the lids
  c.fillStyle = '#b8c4d0';
  for (const [x, y, a] of [[-2, -9, 1.7], [-2, 9, -1.7], [6, -5, 2.6]]) {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.fillRect(-1, -6, 2, 9);
    c.fillRect(-2.2, -6, 4.4, 1.3);
    c.restore();
  }
  // it weeps pus from under the lid, a thick yellow run that freezes on the way down
  const wp = (Math.sin(t * .05) + 1) * .5;
  c.fillStyle = '#d8c040';
  c.beginPath();
  c.moveTo(-7, 5); c.quadraticCurveTo(-9, 10, -10.2, 15 + wp * 2); c.lineTo(-7.2, 15 + wp * 2); c.quadraticCurveTo(-6, 10, -3.5, 6.5);
  c.fill();
  c.fillStyle = 'rgba(255,245,170,.9)';
  c.fillRect(-7.4, 9, .7, 3);
  c.fillStyle = C.blood;
  c.fillRect(-2.6, 8, 1.2, 6 + Math.sin(t * .05) * 2);
  c.fillRect(5, -1, 1, 4);
  strand(c, s, e, 31, -8.6, 15 + wp * 2, 5, 1.2, '#d8c040', 60, '#f0e070', .5);
  drawParts(c, s, e);
  if (tel) {
    c.globalCompositeOperation = 'lighter';
    glowC(c, -2, 0, 10 + tel * 14, '160,215,255', .25 + .55 * tel);
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

/** the kind's art for the registry (./index.ts): draw, and its static layer for the per-route warm-up (render/warmup.ts) */
export default {
  draw: grossChoir,
  under,
  warm() { choirCrust(); return false; }, // false: nothing left to build
  built: () => !!lay.choir,
  drop() { delete lay.choir; }, // its next draw rebuilds it (hn is hashed, so it is the same art)
};
