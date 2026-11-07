// @ts-nocheck
// Render-only: own RNG and particles (../midbosses.ts), no gameplay state touched. Sim: enemies/mid/prentice.ts.
import { $ } from '../../../state';
import { C, TAU, ctx } from '../../../core';
import { ceilAt } from '../../../world';
import { drawChain, drawHookTip, poly } from '../../util';
import { glowC, eyeC, fxs, emit, spray, stepParts, drawParts, strand, bubble, wiggler, layer, popSnd, GROSS, rnd, rn, hn, lay } from '../midbosses';

// =====================================================================
//  THE BUTCHER'S APPRENTICE - blistered, weeping, crawling with maggots, crying, snot bubble, offal loincloth
// =====================================================================
const burnTex = () => layer('burn', 32, 44, (x) => {
  x.translate(16, 22);
  x.beginPath();
  x.ellipse(0, 0, 13.5, 19.5, 0, 0, TAU);
  x.clip();
  for (let i = 0; i < 40; i++) { // charred scabs + raw weeping patches
    const px = (hn(i) - .5) * 26, py = (hn(i, 1) - .5) * 38, k = hn(i, 2);
    x.fillStyle = k < .45 ? 'rgba(12,3,2,.85)' : k < .7 ? 'rgba(200,40,36,.85)' : k < .85 ? 'rgba(255,120,40,.6)' : 'rgba(245,215,110,.75)';
    x.beginPath();
    x.ellipse(px, py, 1 + hn(i, 3) * 2.6, .8 + hn(i, 4) * 1.8, hn(i, 5) * 3, 0, TAU);
    x.fill();
  }
  x.strokeStyle = 'rgba(255,100,30,.75)'; // cracked, split skin, the meat under it still cooking
  x.lineWidth = .6;
  x.beginPath();
  for (let i = 0; i < 9; i++) { let px = (hn(i, 6) - .5) * 24, py = (hn(i, 7) - .5) * 34; x.moveTo(px, py); for (let q = 0; q < 3; q++) { px += (hn(i, q + 8) - .5) * 6; py += 2 + hn(q, i) * 3; x.lineTo(px, py); } }
  x.stroke();
  x.strokeStyle = 'rgba(240,215,110,.55)'; // dried serum runs
  x.lineWidth = .7;
  x.beginPath();
  for (let i = 0; i < 6; i++) { const px = (hn(i, 12) - .5) * 20, py = (hn(i, 13) - .5) * 24; x.moveTo(px, py); x.lineTo(px + .5, py + 4 + hn(i, 14) * 5); }
  x.stroke();
});
// blisters on the body: [x, y, rmax]
const BLIS = [[-8, -12, 2.8], [-10, -3, 3.2], [-4, -5, 2.2], [10, -14, 2.4], [-1, -15, 2], [12, -3, 2.2], [-11, 4, 1.8]];
function offal(c, t) { // loincloth of guts: dangling intestine loops, a kidney; returns the loop bottoms (they drip)
  c.lineCap = 'round';
  const loops = [[-13, 6, 20], [-7, 7, 27], [-1, 6, 18], [5, 7, 24]], bot = [];
  for (let i = 0; i < loops.length; i++) {
    const [x0, y0, d] = loops[i], sw = Math.sin(t * .06 + i * 1.3) * 2;
    c.beginPath();
    c.moveTo(x0, y0);
    c.bezierCurveTo(x0 - 2 + sw, y0 + d, x0 + 8 + sw, y0 + d, x0 + 6, y0);
    c.strokeStyle = '#2a0608';
    c.lineWidth = 4.2;
    c.stroke();
    c.strokeStyle = i % 2 ? '#b8606a' : '#cc8080';
    c.lineWidth = 3;
    c.stroke();
    c.strokeStyle = 'rgba(255,215,215,.75)';
    c.lineWidth = .7;
    c.stroke();
    bot.push([x0 + 3 + sw * .75, y0 + d * .75 + 1.5]);
  }
  c.lineCap = 'butt';
  // the belt of it: a twist of bowel across the waist
  c.fillStyle = '#3a0a0c';
  poly(c, [[-14, 3], [13, 3], [13, 8.5], [-14, 8.5]]);
  c.fillStyle = '#a84850';
  for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(-11.5 + i * 4.6, 5.8, 2.6, 1.9, .5, 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(255,200,200,.7)';
  for (let i = 0; i < 6; i++) c.fillRect(-12.6 + i * 4.6, 4.6, 1.4, .6);
  // a kidney hanging off it on a tube
  const ks = Math.sin(t * .05) * 1.4;
  c.strokeStyle = '#6a1a22';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(10, 8);
  c.lineTo(12 + ks, 22);
  c.stroke();
  c.fillStyle = '#3a060c';
  c.beginPath();
  c.ellipse(12 + ks, 25, 3, 3.8, .3, 0, TAU);
  c.fill();
  c.fillStyle = '#802030';
  c.beginPath();
  c.ellipse(11.6 + ks, 24.4, 2, 2.8, .3, 0, TAU);
  c.fill();
  bot.push([12 + ks, 28.5]);
  return bot;
}
function grossPrentice(c, e) {
  const s = fxs(e), t = e.t;
  stepParts(s);
  c.fillStyle = '#1a0503';
  c.beginPath();
  c.ellipse(1, 3, 15, 21, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#4e180e';
  c.beginPath();
  c.ellipse(0, 2, 13.5, 19.5, 0, 0, TAU);
  c.fill();
  c.drawImage(burnTex(), -16, -20);
  c.fillStyle = '#2a0a06';
  const HOLES = [[6, -8, 4, 3], [-7, 10, 3, 4], [8, 12, 2.4, 2]];
  for (const [x, y, rx, ry] of HOLES) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, TAU);
    c.fill();
  }
  c.strokeStyle = C.bone;
  c.lineWidth = 1.3;
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    c.moveTo(2, -10 + k * 5);
    c.quadraticCurveTo(9, -9 + k * 5, 11, -4 + k * 5);
    c.stroke();
  }
  // maggots writhing in the burn holes
  if (GROSS > 0) for (let h = 0; h < HOLES.length; h++) {
    const [hx, hy, rx, ry] = HOLES[h], n = Math.round((4 - h) * GROSS);
    for (let q = 0; q < n; q++) { const a = t * .03 * (q % 2 ? 1 : -1) + q * 2.1 + h; wiggler(c, hx + Math.cos(a) * rx * .5, hy + Math.sin(a) * ry * .5, a + Math.PI / 2 + Math.sin(t * .3 + q) * .6, 1.1); }
  }
  // blisters: swelling, weeping, popping; burning fat spits off the skin
  for (let q = 0; q < BLIS.length; q++) {
    const [bx, by, br] = BLIS[q];
    c.fillStyle = 'rgba(230,40,30,.85)'; // angry red base
    c.beginPath();
    c.arc(bx, by + .3, br * .9 + .5, 0, TAU);
    c.fill();
    const r = bubble(c, s, e, 200 + q, bx, by, br, 60 + q * 17, 'rgba(240,220,150,.9)', 'rgba(255,245,200,.95)', '#f0d070', 5);
    if (r > br * .8 && rnd() < .05 * s.dt * GROSS) emit(s, e.x + bx, e.y + by, rn(-.8, .8), rn(-1.6, -.5), '#ffe080', 1, 1, rn(20, 40), .1);
  }
  if (rnd() < .2 * s.dt * GROSS) { const a = rnd() * TAU; emit(s, e.x + Math.cos(a) * 12, e.y + 2 + Math.sin(a) * 18, Math.cos(a) * rn(.4, 1.2), rn(-1.8, -.6), rnd() < .5 ? '#ffd060' : '#fff0b0', 1, 1, rn(18, 36), .09); }
  // weeping burns: serum running off the wounds
  strand(c, s, e, 210, -9, -2, 5, .8, 'rgba(235,215,120,.85)', 55, '#f0e090', .4);
  strand(c, s, e, 211, 10, 4, 4, .8, 'rgba(235,215,120,.85)', 70, '#f0e090', .4);
  // maggots crawling over the skin, and dropping off
  if (GROSS > 0) for (let q = 0; q < Math.round(6 * GROSS); q++) {
    const a = t * (.008 + q * .002) * (q % 2 ? 1 : -1) + q * 1.7, mx = Math.cos(a) * (8 + (q % 3) * 1.5), my = -6 + Math.sin(a) * (9 + (q % 2) * 2);
    wiggler(c, mx, my, a + (q % 2 ? Math.PI / 2 : -Math.PI / 2) + Math.sin(t * .25 + q) * .5, 1.35);
  }
  if (rnd() < .025 * s.dt * GROSS) emit(s, e.x + rn(-8, 8), e.y + rn(8, 18), rn(-.3, .3), .2, '#efe6c4', 1, 2, 90, .1);
  // loincloth of offal
  const bot = offal(c, t);
  for (let i = 0; i < bot.length; i++) if (i !== 2) strand(c, s, e, 220 + i, bot[i][0], bot[i][1], 5 + i, 1.1, i === 4 ? '#5a0a10' : '#8a1018', 48 + i * 11, '#c01a24', .6);
  drawHookTip(c, 0, -21, Math.PI, 1);
  // sack hood, three eyes, a mouth that glows before it spits
  c.fillStyle = '#3a2a1a';
  c.beginPath();
  c.ellipse(-4, -24, 8.5, 8, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#5a4630';
  c.beginPath();
  c.ellipse(-4, -25, 7.5, 7, 0, 0, TAU);
  c.fill();
  // sodden with tears and snot: dark wet patches on the sack
  c.fillStyle = 'rgba(30,20,10,.55)';
  c.beginPath();
  c.ellipse(-8, -21, 3.4, 4, .2, 0, TAU);
  c.fill();
  const la = Math.atan2($.P.y - e.y + 24, $.P.x - e.x + 4), spit = e.st === 'spit' && e.wt < 40, sk = Math.min(1, e.wt / 24);
  if (s.ev === 'idle>spit' && GROSS > 0) { spray(s, e.x - 13.5, e.y - 23, 7, '#c8d060', 1.2, 1); popSnd(s, .6); }
  const EY = [[-7, -27, 1.9], [-2, -28, 1.5], [-5, -22, 1.2]];
  for (const [ex, ey, er] of EY) eyeC(c, ex, ey, er, { ang: la, iris: '#ffb347', bs: 3, blink: (t + ex * 9) % 140 < 5 ? 1 : 0, lid: '#3a2a1a' });
  // crying: tear tracks streaming down, red raw rims
  if (GROSS > 0) {
    c.fillStyle = 'rgba(190,230,255,.85)';
    for (let q = 0; q < 3; q++) {
      const [ex, ey, er] = EY[q], L = 4 + ((t * .2 + q * 3) % 5);
      c.fillRect(ex - .3 - (q === 2 ? .8 : 0), ey + er, .6, L);
      c.beginPath();
      c.arc(ex - (q === 2 ? .8 : 0), ey + er + L, .6, 0, TAU);
      c.fill();
    }
    if (rnd() < .06 * s.dt) emit(s, e.x - 8 + rn(-2, 2), e.y - 17, rn(-.2, .1), .2, 'rgba(190,230,255,.9)', .9, 0, 70);
  }
  c.fillStyle = spit ? '#ff6a1a' : '#160203';
  const sob = spit ? 0 : Math.sin(t * .8) * .3;
  c.beginPath();
  c.ellipse(-8 + sob, -19, 2.4, spit ? 2 + sk * 1.6 : 1.2 + Math.abs(sob), 0, 0, TAU);
  c.fill();
  // snot: a string down the lip and a bubble that grows with every sob; it pops when it spits
  c.fillStyle = '#2a1408';
  c.fillRect(-12.6, -23.5, 1.4, 1.2);
  strand(c, s, e, 230, -12, -22.6, 7, .9, 'rgba(200,210,90,.9)', 90, '#d8e070', .8);
  if (!spit) bubble(c, s, e, 231, -15, -23.2, 4, 80, 'rgba(210,220,120,.45)', 'rgba(230,240,160,.95)', '#c8d060', 6);
  if (spit) {
    c.globalCompositeOperation = 'lighter';
    glowC(c, -8, -19, 6 + sk * 8, '255,120,30', .7);
    c.globalCompositeOperation = 'source-over';
  }
  // cleaver arm
  const ba = e.ba, ax = -8, ay = -6, L = 28;
  c.lineCap = 'round';
  c.strokeStyle = C.fleshD;
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(ax, ay);
  c.lineTo(ax + Math.cos(ba) * 13, ay + Math.sin(ba) * 13);
  c.stroke();
  c.strokeStyle = C.flesh;
  c.lineWidth = 3;
  c.stroke();
  c.lineCap = 'butt';
  c.save();
  c.translate(ax + Math.cos(ba) * 13, ay + Math.sin(ba) * 13);
  c.rotate(ba);
  c.fillStyle = '#2a1f12';
  c.fillRect(-2, -1.5, 6, 3);
  c.fillStyle = '#4a4f56';
  c.fillRect(4, -8, L - 6, 11);
  c.fillStyle = e.st === 'tel' && ($.T >> 2) % 2 ? '#ffd0b0' : '#a8b0b8';
  c.fillRect(4, -8, L - 6, 2);
  c.fillStyle = '#1a0806';
  c.fillRect(L - 9, -8, 3, 11);
  c.fillStyle = C.blood;
  c.fillRect(10, -8, 2, 5);
  if (GROSS > 0) { // skin and hair stuck to the blade
    c.fillStyle = '#c87a6a';
    poly(c, [[13, 1], [19, 0], [18, 3.5], [14, 3]]);
    c.fillStyle = '#6a1a14';
    c.fillRect(16, 1, 4, 2);
    c.fillStyle = '#1a0a04';
    c.fillRect(14, 2.6, .5, 2.4);
    c.fillRect(15.4, 2.8, .5, 2);
  }
  c.restore();
  if (rnd() < .08 * s.dt * GROSS) { const d = rn(10, 26); emit(s, e.x + ax + Math.cos(ba) * (13 + d), e.y + ay + Math.sin(ba) * (13 + d), 0, .2, '#a01018', 1, 0, 70); }
  drawParts(c, s, e);
}

/** under the body: its chain, and the sweep cone */
function under(e) {
  drawChain(ctx, e.x, e.y - 20, e.x + 4, Math.max(-8, ceilAt(e.x + $.G.scroll)), 1.4);
  const sx = e.x - 8, sy = e.y - 6;
  if (e.st === 'tel') { // same sweep cone as the Butcher's, shorter
    const k = e.wt / 50;
    ctx.fillStyle = `rgba(255,60,20,${.08 + .22 * k * (($.T >> 2) % 2 ? 1 : .6)})`;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.arc(sx, sy, 84, 2.3, 3.99);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(255,120,60,${.4 + .5 * k})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(sx, sy, 84, 2.3, 3.99);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (e.st === 'cut' && e.wt <= 12) {
    let cur = e.ba;
    if (cur < 0) cur += TAU;
    ctx.fillStyle = 'rgba(255,220,180,.35)';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.arc(sx, sy, 84, cur, 3.99);
    ctx.closePath();
    ctx.fill();
  }
}

/** the kind's art for the registry (./index.ts): draw, and its static layer for the per-route warm-up (render/warmup.ts) */
export default {
  draw: grossPrentice,
  under,
  warm() { burnTex(); return false; }, // false: nothing left to build
  built: () => !!lay.burn,
  drop() { delete lay.burn; }, // its next draw rebuilds it (hn is hashed, so it is the same art)
};
