// @ts-nocheck
// Render-only: own RNG and particles (../midbosses.ts), no gameplay state touched. Sim: enemies/mid/cyst.ts.
import { C, TAU, hash } from '../../../core';
import { drawSkull, poly } from '../../util';
import { glowC, fxs, spray, stepParts, drawParts, strand, bubble, layer, snd, hn, blob, lay } from '../midbosses';

// =====================================================================
//  THE DISSOLVING WOMB - see-through, veined, sloshing with bile; the half-digested child still twitches
// =====================================================================
const wombVeins = () => layer('wveins', 50, 50, (x) => {
  x.translate(25, 25);
  x.beginPath();
  x.arc(0, 0, 20.5, 0, TAU);
  x.clip();
  x.lineCap = 'round';
  const br = (px, py, a, w, n, d) => {
    for (let i = 0; i < n; i++) {
      const nx = px + Math.cos(a) * 2.2, ny = py + Math.sin(a) * 2.2;
      x.strokeStyle = d ? '#c0304a' : '#7a1a40';
      x.lineWidth = w;
      x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
      px = nx; py = ny; a += (hn(px, py) - .5) * .9; w *= .9;
      if (d < 2 && hn(py, px) < .22) br(px, py, a + (hn(i, d) < .5 ? .8 : -.8), w * .8, n - i - 1, d + 1);
    }
  };
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + .4; br(Math.cos(a) * 21, Math.sin(a) * 21, a + Math.PI + (hn(i, 5) - .5) * .6, 1.3, 7, 0); }
});
function grossCyst(c, e) {
  const s = fxs(e), t = e.t, sw = (e.sw || 0) / 30, sc = 1 + sw * .22 + Math.sin(t * .07) * .03, tel = e.st === 'tel' ? e.wt / 45 : 0, rim = (a, i) => 22 + Math.sin(a * 4 + t * .06) * 1.6 + hash(i) * 2;
  stepParts(s);
  if (s.ev === 'idle>swell') snd('gross_slosh', .5, .35);
  if (s.ev === 'swell>idle') { spray(s, e.x, e.y + 4, 16, '#9a7024', 2, 1.4, .4); spray(s, e.x, e.y + 4, 8, '#8a2a3a', 1.6, 1.2, .2); }
  // placenta: ragged maroon strands with clots, hanging into the lake, dripping
  c.lineCap = 'round';
  for (let k = -2; k <= 2; k++) {
    const x0 = k * 6, L = 26 + hash(k + 4) * 14, w1 = Math.sin(t * .05 + k) * 4, w2 = Math.sin(t * .04 + k * 1.7) * 6;
    c.strokeStyle = '#3a0a18';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x0, 16);
    c.quadraticCurveTo(x0 * 1.4 + w1, 16 + L * .5, x0 + w2, 16 + L);
    c.stroke();
    c.strokeStyle = k % 2 ? '#8a2a3a' : '#6a1a30';
    c.lineWidth = 1.8;
    c.stroke();
    c.fillStyle = '#a03040';
    for (let q = 1; q < 4; q++) { const f = q / 4; c.beginPath(); c.arc(x0 + (x0 * .4 + w1) * 2 * f * (1 - f) + w2 * f * f, 16 + L * f, 1 + hash(q + k * 3) * .9, 0, TAU); c.fill(); }
    strand(c, s, e, 60 + k, x0 + w2, 16 + L, 5, 1.1, '#7a1a2a', 70 + k * 9, '#a02a3a', 1);
  }
  c.lineCap = 'butt';
  c.save();
  c.scale(sc, sc * (1 - sw * .08));
  // membrane: thin, see-through, fleshy
  c.fillStyle = 'rgba(52,14,34,.94)';
  blob(c, 22, 1, rim);
  c.fill();
  c.fillStyle = 'rgba(150,80,100,.42)';
  blob(c, 22, .9, rim);
  c.fill();
  c.save();
  blob(c, 22, .9, rim);
  c.clip();
  // the child: curled, skin going, skull showing, twitching
  const k = Math.sin(t * .04), tw = (t % 97 < 7 || t % 151 < 4) ? Math.sin(t * 2.3) * 1.4 : 0, kx = k + tw, ky = tw * .5;
  c.fillStyle = 'rgba(140,60,48,.92)';
  c.beginPath();
  c.ellipse(2 + kx, 4 + ky, 8, 10, .6 + k * .15 + tw * .1, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(221,210,122,.75)';
  c.beginPath();
  c.ellipse(4 + kx, 6 + ky, 4, 6, .6, 0, TAU);
  c.fill();
  // peeling skin flaps
  c.fillStyle = 'rgba(200,120,100,.9)';
  poly(c, [[-4 + kx, 7 + ky], [-7 + kx, 10 + ky + tw], [-3 + kx, 9 + ky]]);
  poly(c, [[7 + kx, -2 + ky], [10 + kx, -4 + ky - tw], [8 + kx, 0 + ky]]);
  // a kicking limb
  c.strokeStyle = '#a05040';
  c.lineWidth = 1.4;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-2 + kx, 10 + ky);
  c.lineTo(-6 + kx - tw * 1.5, 14 + ky + Math.sin(t * .1) * 1.2);
  c.lineTo(-8 + kx - tw * 2, 13 + ky);
  c.stroke();
  c.lineCap = 'butt';
  drawSkull(c, -4 + kx, -7 + ky, 5, 1);
  c.strokeStyle = C.bone;
  c.lineWidth = 1;
  c.beginPath();
  for (let q = 0; q < 4; q++) { c.moveTo(-1 + q * 2.5 + kx, 0 + ky); c.quadraticCurveTo(3 + q * 2.5 + kx, 4 + ky, 1 + q * 2.5 + kx, 9 + ky); }
  c.stroke();
  // umbilical cord to the wall, coiled and pulsing
  c.strokeStyle = '#4a1a3a';
  c.lineWidth = 3.2;
  c.beginPath();
  c.moveTo(6 + kx, 6 + ky);
  c.bezierCurveTo(14, 12 + Math.sin(t * .06) * 3, 18, -2, 13, -13);
  c.stroke();
  c.strokeStyle = '#9a5a7a';
  c.lineWidth = 2;
  c.stroke();
  c.strokeStyle = '#d090a8';
  c.lineWidth = .6;
  c.setLineDash([1.2, 1.6]);
  c.lineDashOffset = -t * .15;
  c.stroke();
  c.setLineDash([]);
  // bile: ochre (lime is the bullets' alone, D39) and sloshing over the lower half, digesting it
  const lv = 3 - sw * 4 + Math.sin(t * .05) * 1.5, tl = Math.sin(t * .03) * 3;
  c.fillStyle = 'rgba(140,100,26,.55)';
  c.beginPath();
  c.moveTo(-26, lv + tl);
  for (let x = -26; x <= 26; x += 4) c.lineTo(x, lv + tl * (-x / 26) + Math.sin(x * .4 + t * .12) * 1.1);
  c.lineTo(26, 30);
  c.lineTo(-26, 30);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(206,160,72,.8)';
  c.lineWidth = .7;
  c.beginPath();
  for (let x = -26; x <= 26; x += 4) { const y = lv + tl * (-x / 26) + Math.sin(x * .4 + t * .12) * 1.1; x === -26 ? c.moveTo(x, y) : c.lineTo(x, y); }
  c.stroke();
  // digesting fizz in the bile
  c.fillStyle = 'rgba(222,192,120,.7)';
  for (let q = 0; q < 8; q++) { const bx = -14 + hash(q + 31) * 28, by = lv + 14 - ((t * .3 + hash(q + 7) * 30) % 14); c.fillRect(bx, by, .8, .8); }
  c.restore();
  // veins through the membrane, swelling dark red as it bloats
  c.globalAlpha = Math.min(1, .55 + .2 * Math.sin(t * .11) + sw * .45);
  c.drawImage(wombVeins(), -25, -25);
  if (sw > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = sw * .5; c.drawImage(wombVeins(), -25, -25); c.globalCompositeOperation = 'source-over'; }
  c.globalAlpha = 1;
  // holes eaten through the membrane, acid-raw edges, oozing
  for (const [x, y, r] of [[-12, 8, 4], [13, -6, 3.2], [6, 15, 2.6], [-8, -15, 2.2]]) {
    c.fillStyle = '#04110e';
    c.beginPath();
    c.ellipse(x, y, r, r * .8, 0, 0, TAU);
    c.fill();
    c.strokeStyle = '#7ff0d8';
    c.lineWidth = .7;
    c.stroke();
    c.strokeStyle = 'rgba(200,60,80,.8)';
    c.lineWidth = .5;
    c.beginPath();
    c.ellipse(x, y, r + .7, r * .8 + .6, 0, .4, 2.6);
    c.stroke();
  }
  // acid blisters swelling up on the membrane and popping
  const BL = [[-15, -6, 2.6], [15, 4, 2.2], [-3, -18, 1.8], [9, -15, 2], [-17, 3, 1.6], [16, -11, 1.5], [-1, 18, 1.8]];
  for (let q = 0; q < BL.length; q++) { const [bx, by, br] = BL[q]; bubble(c, s, e, 100 + q, bx, by, br * (1 + sw * .4), 50 + q * 13, 'rgba(150,106,30,.8)', 'rgba(214,178,100,.9)', '#9a7024', 4); }
  c.fillStyle = 'rgba(230,220,240,.5)';
  c.beginPath();
  c.ellipse(-8, -12, 4, 1.8, -.6, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.6)';
  c.fillRect(11, 8, 1.5, .8);
  // the crown it spouts from
  c.fillStyle = '#0a2a24';
  c.beginPath();
  c.ellipse(-2, -20, 5, 3 + tel * 2, 0, 0, TAU);
  c.fill();
  c.fillStyle = tel ? '#ffbf62' : '#46e0c0';
  c.beginPath();
  c.ellipse(-2, -20, 2.6, 1.4 + tel * 1.6, 0, 0, TAU);
  c.fill();
  c.restore();
  // ooze from the holes
  strand(c, s, e, 70, -12 * sc, 11 * sc, 6, 1.2, 'rgba(140,100,28,.85)', 64, '#c89a48', 1);
  strand(c, s, e, 71, 6 * sc, 17 * sc, 5, 1, 'rgba(140,100,28,.85)', 82, '#c89a48', 1);
  drawParts(c, s, e);
  if (tel || sw) {
    c.globalCompositeOperation = 'lighter';
    glowC(c, -2, tel ? -20 : 0, tel ? 8 + tel * 12 : 16 + sw * 18, '60,230,195', .2 + .5 * Math.max(tel, sw));
    c.globalCompositeOperation = 'source-over';
  }
}

/** the kind's art for the registry (./index.ts): draw, and its static layer for the per-route warm-up (render/warmup.ts) */
export default {
  draw: grossCyst,
  warm() { wombVeins(); return false; }, // false: nothing left to build
  built: () => !!lay.wveins,
  drop() { delete lay.wveins; }, // its next draw rebuilds it (hn is hashed, so it is the same art)
};
