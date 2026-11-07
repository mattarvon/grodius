// @ts-nocheck
// Render-only: own RNG and particles (../midbosses.ts), no gameplay state touched. Sim: enemies/mid/brood.ts.
import { $ } from '../../../state';
import { TAU, hash } from '../../../core';
import { eye } from '../../eyes';
import { glowC, eyeC, fxs, emit, stepParts, drawParts, strand, bubble, layer, snd, GROSS, rnd, rn, hn, blob, lay } from '../midbosses';

// =====================================================================
//  THE BROOD MOTHER - a heaving mucus sac of grubs; crusted nostrils blowing bubbles; births in a gush
// =====================================================================
const mucusTex = () => layer('mucus', 46, 46, (x) => {
  x.translate(23, 23);
  x.beginPath();
  x.arc(0, 0, 19.5, 0, TAU);
  x.clip();
  for (let i = 0; i < 46; i++) {
    const a = hn(i, 1) * TAU, r = Math.sqrt(hn(i, 2)) * 19, k = hn(i, 3);
    x.fillStyle = k < .3 ? 'rgba(60,70,10,.5)' : k < .55 ? 'rgba(200,215,90,.45)' : k < .7 ? 'rgba(120,90,20,.5)' : k < .85 ? 'rgba(90,110,20,.45)' : 'rgba(170,60,40,.35)';
    x.beginPath();
    x.ellipse(Math.cos(a) * r, Math.sin(a) * r, 1 + hn(i, 4) * 3, .8 + hn(i, 5) * 1.6, a, 0, TAU);
    x.fill();
  }
  x.fillStyle = 'rgba(30,30,8,.8)'; // specks (hairs? crumbs? don't ask)
  for (let i = 0; i < 30; i++) { const a = hn(i, 7) * TAU, r = Math.sqrt(hn(i, 8)) * 18; x.fillRect(Math.cos(a) * r, Math.sin(a) * r, .8, .8); }
});
function grub(c, x, y, a, s, sq) { // a curled larva, segmented, pale, dark mandibles
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.scale(s, s);
  c.lineCap = 'round';
  c.strokeStyle = 'rgba(70,40,20,.75)';
  c.lineWidth = 3.4;
  c.beginPath();
  c.arc(0, 0, 2.4, .3 + sq, 4.6 - sq);
  c.stroke();
  c.strokeStyle = 'rgba(235,215,170,.88)';
  c.lineWidth = 2.6;
  c.stroke();
  c.strokeStyle = 'rgba(150,110,70,.9)';
  c.lineWidth = .4;
  c.beginPath();
  for (let q = 0; q < 5; q++) { const b = .6 + q * .8; c.moveTo(Math.cos(b) * 1.1, Math.sin(b) * 1.1); c.lineTo(Math.cos(b) * 3.7, Math.sin(b) * 3.7); }
  c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = '#3a1a08';
  c.beginPath();
  c.arc(Math.cos(4.6 - sq) * 2.4, Math.sin(4.6 - sq) * 2.4, 1.1, 0, TAU);
  c.fill();
  c.fillStyle = '#100604';
  c.fillRect(Math.cos(4.6 - sq) * 2.4 - .3, Math.sin(4.6 - sq) * 2.4 - 1.4, .7, .8);
  c.restore();
}
function grossBrood(c, e) {
  const s = fxs(e), t = e.t, bul = Math.min(1, e.bul || 0), sn = e.st === 'sneeze' && e.wt < 26 ? e.wt / 26 : 0, sc = 1 + Math.sin(t * .08) * .04 + bul * .1 + Math.max(0, Math.sin(t * .21)) * .02 * GROSS, rim = (a, i) => 21 + Math.sin(a * 3 + t * .05) * 1.4 + hash(i + 5) * 1.6 + Math.max(0, Math.sin(a * 5 - t * .09)) * 1.6 * GROSS;
  stepParts(s);
  if (s.ev === 'idle>birth') snd('gross_slosh', .45, .3);
  if (s.ev === 'birth>idle' && GROSS > 0) { // the gush
    const gx = e.x - 17, gy = e.y + 6;
    for (let i = 0; i < 26 * GROSS; i++) emit(s, gx, gy, rn(-3, -.3), rn(-1.6, 1.2), rnd() < .5 ? '#b8c040' : rnd() < .6 ? '#d8e070' : '#c05a48', rn(1, 2.2), rnd() < .15 ? 4 : 0, rn(50, 90));
    for (let i = 0; i < 3 * GROSS; i++) emit(s, gx, gy, rn(-2, -.5), rn(-1, .5), '#efe6c4', 1, 2, 80, .1);
    snd('gross_gush', .8, .35);
  }
  if (e.st === 'sneeze' && e.wt >= 26 && !s.f.sz) { s.f.sz = 1; for (let n = 0; n < 2; n++) for (let i = 0; i < 9 * GROSS; i++) emit(s, e.x - 21, e.y - 8 + n * 6, rn(-3.4, -1), rn(-1, 1), rnd() < .6 ? '#c8d050' : '#e8f0a0', rn(.8, 1.8), 0, rn(40, 70)); }
  if (e.st !== 'sneeze') s.f.sz = 0;
  // ropes of snot hanging off it, bubbles caught in them, gobs letting go
  c.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    const x = -12 + k * 6, L = 14 + hash(k) * 12, w1 = Math.sin(t * .04 + k) * 3, w2 = Math.sin(t * .05 + k) * 4;
    c.strokeStyle = 'rgba(120,140,20,.9)';
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(x, 15);
    c.quadraticCurveTo(x + w1, 15 + L * .5, x + w2, 15 + L);
    c.stroke();
    c.strokeStyle = 'rgba(210,225,110,.85)';
    c.lineWidth = 1.2;
    c.stroke();
    c.fillStyle = 'rgba(235,245,170,.9)';
    c.beginPath();
    c.arc(x + w1 * .5, 15 + L * .45, .9, 0, TAU);
    c.fill();
    strand(c, s, e, 300 + k, x + w2, 15 + L, 6, 1.4, 'rgba(170,190,50,.9)', 60 + k * 11, '#d8e070', 1.2);
  }
  c.lineCap = 'butt';
  c.save();
  c.scale(sc, sc);
  c.fillStyle = '#2a3206';
  blob(c, 20, 1, rim);
  c.fill();
  c.fillStyle = 'rgba(130,150,35,.85)';
  blob(c, 20, .9, rim);
  c.fill();
  c.drawImage(mucusTex(), -23, -23);
  // the litter: grubs squirming inside, pulsing, pushing at the skin
  const n = Math.round(6 + 3 * GROSS);
  for (let k = 0; k < n; k++) {
    const a = k * (TAU / n) + t * .012 * (k % 2 ? 1 : -1), r = 6 + (k % 3) * 4.2, x = Math.cos(a) * r + 2, y = Math.sin(a) * r * .82, p = Math.sin(t * .15 + k * 1.9);
    grub(c, x, y, a * 2 + t * .02 * (k % 2 ? 1 : -1), .85 + p * .12 + bul * .15, .3 + p * .3);
  }
  // a mucus film over them so they read as inside
  c.fillStyle = 'rgba(150,170,40,.28)';
  blob(c, 20, .88, rim);
  c.fill();
  c.strokeStyle = 'rgba(90,60,20,.7)';
  c.lineWidth = .7;
  c.beginPath();
  for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; c.moveTo(Math.cos(a) * 19, Math.sin(a) * 18); c.quadraticCurveTo(Math.cos(a + .5) * 12, Math.sin(a + .5) * 11, Math.cos(a + .8) * 6, Math.sin(a + .8) * 6); }
  c.stroke();
  // wet, glossy
  c.fillStyle = 'rgba(255,250,210,.55)';
  c.beginPath();
  c.ellipse(-6, -12, 5, 2, -.5, 0, TAU);
  c.fill();
  c.fillRect(9, -9, 2, 1);
  c.fillRect(12, 6, 1.4, .8);
  // mucus bubbles welling up through the skin
  for (let q = 0; q < 4; q++) bubble(c, s, e, 320 + q, [8, 14, -2, 4][q], [-14, -2, 15, 9][q], 1.8, 45 + q * 14, 'rgba(210,225,110,.6)', 'rgba(240,250,180,.95)', '#c8d050', 3);
  c.restore();
  // birth canal, dilating as it heaves, glistening and stringy
  c.fillStyle = '#3a1a0a';
  c.beginPath();
  c.ellipse(-17, 6, 3 + bul * 2, 3 + bul * 5, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#a83a24';
  c.beginPath();
  c.ellipse(-17, 6, 1.4 + bul * 1.6, 1.6 + bul * 4, 0, 0, TAU);
  c.fill();
  c.strokeStyle = 'rgba(220,120,100,.9)';
  c.lineWidth = .5;
  c.beginPath();
  c.ellipse(-17, 6, 2.6 + bul * 2, 2.6 + bul * 5, 0, 1.8, 4.6);
  c.stroke();
  if (bul > .5) { // crowning: a slick grub head pushing out
    c.fillStyle = '#d8a59a';
    c.beginPath();
    c.arc(-17, 6, 2.2 * bul, 0, TAU);
    c.fill();
    c.fillStyle = '#3a1a08';
    c.fillRect(-18.4, 5, .9, .9);
    c.fillRect(-16.4, 5, .9, .9);
    c.fillStyle = 'rgba(255,240,220,.7)';
    c.fillRect(-18, 4, 1.2, .6);
  }
  strand(c, s, e, 340, -17, 8 + bul * 5, 6 + bul * 8, 1.3 + bul, 'rgba(200,130,90,.85)', bul > .2 ? 26 : 70, '#d8a070', 1);
  strand(c, s, e, 341, -15.5, 8 + bul * 4, 4 + bul * 6, 1, 'rgba(180,200,70,.85)', bul > .2 ? 34 : 90, '#d8e070', 1);
  // face: a raw, wet snout; booger-crusted nostrils blowing snot bubbles; they swell huge before it sneezes
  c.fillStyle = '#2e3608';
  c.beginPath();
  c.ellipse(-18.5, -5, 4.6 + sn, 6.6 + sn, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#8a5a3a';
  c.beginPath();
  c.ellipse(-18.2, -5.4, 3.6 + sn, 5.6 + sn, 0, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(255,220,190,.6)';
  c.fillRect(-19.6, -10, 1.6, .7);
  for (let i = 0; i < 2; i++) {
    const y = [-8, -2][i];
    for (let q = 0; q < 4; q++) { c.fillStyle = q % 2 ? '#5a6a12' : '#6a5216'; c.beginPath(); c.arc(-19 + Math.cos(q * 1.7 + i) * 2.2, y + Math.sin(q * 1.7 + i) * 1.8, 1 + hash(q + i * 4) * .7, 0, TAU); c.fill(); }
    c.fillStyle = '#7a6a18';
    c.fillRect(-21, y - 1.6, 1.2, 1);
    c.fillStyle = '#2a1206';
    c.beginPath();
    c.ellipse(-19, y, 1.6 + sn * 1.6, 1.2 + sn * 1.2, 0, 0, TAU);
    c.fill();
    strand(c, s, e, 350 + i, -19.5, y + 1, 8 - i * 2, 1.1, 'rgba(190,210,70,.9)', 75 + i * 20, '#d8e870', 1.4);
    if (sn) bubble(c, s, e, 360 + i, -21 - sn * 2.4, y, 1 + sn * 3.2, 1, 'rgba(210,225,110,.5)', 'rgba(240,250,180,.95)', '#c8d050', 0, sn);
    else bubble(c, s, e, 362 + i, -20.6, y, 1.6, 50 + i * 23, 'rgba(210,225,110,.5)', 'rgba(240,250,180,.95)', '#c8d050', 3);
  }
  const la = Math.atan2($.P.y - e.y + 10, $.P.x - e.x + 8);
  for (const [ex, ey, er] of [[-8, -14, 2.4], [-2, -16, 1.8], [-11, -9, 1.5]]) {
    eyeC(c, ex, ey, er, { ang: la, iris: '#c8ac3a', bs: 3, blink: (t + ex * 5) % 160 < 6 ? 1 : 0, lid: '#5a5a18' });
    c.fillStyle = 'rgba(220,200,90,.95)'; // crusty eye goop in the corners
    c.fillRect(ex - er - .9, ey - .2, 1, 1);
    c.fillRect(ex + er - .1, ey + .3, .8, .8);
  }
  drawParts(c, s, e);
  if (sn) {
    c.globalCompositeOperation = 'lighter';
    glowC(c, -19, -5, 6 + sn * 10, '236,210,90', .3 + .5 * sn);
    c.globalCompositeOperation = 'source-over';
  }
}

/** the kind's art for the registry (./index.ts): draw, and its static layer for the per-route warm-up (render/warmup.ts) */
export default {
  draw: grossBrood,
  warm() { mucusTex(); return false; }, // false: nothing left to build
  built: () => !!lay.mucus,
  drop() { delete lay.mucus; }, // its next draw rebuilds it (hn is hashed, so it is the same art)
};
