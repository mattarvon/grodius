// @ts-nocheck
// Render-only: own RNG and particles (../midbosses.ts), no gameplay state touched. Sim: enemies/mid/cyst.ts.
import { $ } from '../../../state';
import { ctx, hash } from '../../../core';
import { DN, eruptStage, poolStage } from '../../../enemies/mid/_deny';
import { glowC, fxs, spray, stepParts, drawParts, strand, snd, emit, rnd, rn, GROSS } from '../midbosses';
import { bakedBuilt, bakedDrop, bakedFallback, bakedWarm, bf, breath, dieAge, pour, trackDeath, twitch, woundStage } from '../baked';

// =====================================================================
//  THE DISSOLVING WOMB - a torn placenta slung over an iron rod, its cord cut open at the spout (Matt's pick c2, D46: placenta,
//  cord and membrane only, nothing shaped like a person). Art: tools/bossart/cyst/bake.py -> sprites/boss/cyst.png
// =====================================================================
const K = 'cyst';
const DEATH = { k: K, body: false, len: 90, gore: (x, y, age) => pour(x, y + 4, age, { w: 18, h: 20, jets: 7, len: 80, meat: 20, rope: 5 }) };
// where it drips from, boss-local: the torn hem, then the wounds that open with each stage
const HEM = [[-14, 24, 13, 41], [-5, 30, 18, 57], [3, 28, 10, 73], [11, 22, 15, 49], [17, 14, 9, 88]];
const TEARS = [[-14, -4, 8, 37], [-10, 14, 9, 53], [14, 8, 11, 44]];
function grossCyst(c, e) {
  const s = fxs(e), t = e.t;
  stepParts(s);
  trackDeath(e, DEATH);
  if (s.ev === 'idle>swell') snd('gross_slosh', .5, .35);
  if (s.ev === 'swell>idle') { spray(s, e.x, e.y + 4, 16, '#6a0c12', 2, 1.4, .4); spray(s, e.x, e.y + 4, 8, '#3a0a10', 1.6, 1.2, .2); }
  if (s.ev === 'tel>spray') spray(s, e.x - 2, e.y - 19, 10, '#8a1a1a', 1.8, 1.2, .9);
  if (e.dead || e.hp <= 0) { // a split corpse: gore.ts redraws this through each half, so the halves tear as they tumble
    if (!bf(c, K, 'die', Math.min(5, dieAge(e) / 8 | 0))) bakedFallback(c, e.r);
    return;
  }
  const w = woundStage(e), sw = (e.sw || 0) / 30, tel = e.st === 'tel' ? e.wt / 45 : 0;
  let ok;
  const tk = e.tk != null && e.t - e.tk < 3; // r3: a hit the half floor held back (mid/_fight.ts phaseShare): a flinch, no blood
  if (e.flash) ok = bf(c, K, 'hurt' + w, tk ? 1 : 0);
  else if (sw > 0) ok = bf(c, K, 'swell' + w, Math.min(3, sw * 4 | 0));
  else if (e.st === 'tel') ok = bf(c, K, 'tell' + w, twitch(t, 4, 7 - tel * 4));
  else if (e.st === 'spray') ok = bf(c, K, 'gey' + w, twitch(t, 3, 4));
  else ok = bf(c, K, 'idle' + w, breath(t, 5, 110 - w * 18, 3));
  if (!ok) bakedFallback(c, e.r);
  // the wet that a still frame can't hold: threads off the hem, blood from the open tears, both shed real drops
  for (let i = 0; i < HEM.length; i++) { const h = HEM[i]; strand(c, s, e, 60 + i, h[0], h[1], h[2], 1, 'rgba(58,10,18,.9)', h[3], '#5a0a12', 1.2); }
  for (let i = 0; i < w * 2 && i < TEARS.length; i++) { const h = TEARS[i]; strand(c, s, e, 70 + i, h[0], h[1], h[2], 1.1, 'rgba(92,6,14,.95)', h[3], '#8a0c14', .6); }
  if (e.flash && !tk && rnd() < .5 * GROSS) emit(s, e.x + rn(-14, 14), e.y + rn(-14, 16), rn(-1.4, 1.4), rn(-1.8, .2), '#7a0a12', rn(.8, 1.5), 0, 60);
  // the cut cord bubbles with what's coming, and throws light: the honest tell
  if (tel > 0 && rnd() < (.15 + tel * .5) * s.dt) emit(s, e.x - 2 + rn(-3, 3), e.y - 20, rn(-.5, .5), rn(-1.5, -.5), hash(t) < .5 ? '#a8201e' : '#d8a080', rn(.7, 1.2), 0, 26, .08);
  drawParts(c, s, e);
  if (tel || sw) {
    c.globalCompositeOperation = 'lighter';
    glowC(c, -2, tel ? -19 : 4, tel ? 8 + tel * 12 : 16 + sw * 18, '60,230,195', tel ? .16 + .42 * tel : .08 + .2 * sw); // the swell glow sits low and soft: it lit the cord stump into a face
    c.globalCompositeOperation = 'source-over';
  }
}

/**
 * Under the body: its acid pools (D61), each a bubbling skin of bile on the rock with fumes standing off it. Fizzing (the
 * 44 f tell): a dashed outline of the burn zone over a thin film that spreads; burning: the full skin, the zone hatched
 * and its fumes, ruled at its top; drying: it fades to a stain. Hatching and edges carry it with the flashes off.
 */
function pools(e) {
  if (!e.pn) return;
  const T = $.T || 0, sc = $.G.scroll, hw = DN.plHW, h = DN.plH;
  ctx.save();
  for (let i = 0; i < e.pn; i++) {
    const a = e.t - e.pT[i], st = poolStage(a);
    if (st < 0) continue;
    const x = e.pX[i] - sc, y = e.pY[i], s = e.pS[i]; // s: 1 floor (fumes rise), -1 ceiling (it hangs and drips)
    if (x < -hw - 4 || x > 484 + hw) continue;
    const k = st === 0 ? a / DN.plArm : st === 1 ? 1 : 1 - (a - DN.plArm - DN.plLive) / DN.plDry;
    const w = hw * (st === 0 ? .35 + .65 * k : 1), top = y - s * h;
    // the skin: dark rim, sick green-teal bile, pale scum on it
    ctx.globalAlpha = st === 2 ? k : 1;
    ctx.fillStyle = '#1e2a0e';
    ctx.beginPath(); ctx.ellipse(x, y, w + 2, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = st === 0 ? 'rgba(120,200,60,.6)' : '#7fd23a';
    ctx.beginPath(); ctx.ellipse(x, y - s, w, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(220,255,170,.55)';
    for (let j = 0; j < 3; j++) { const bx = x + (hash(i * 13 + j * 7 + (T >> 4)) - .5) * w * 1.6, br = 1 + hash(j + i * 5 + (T >> 3)) * 1.6; ctx.fillRect(bx - br / 2, y - s * 2 - br / 2, br, br); }
    if (st === 0) { // the tell: the zone it will burn, dashed, tightening
      ctx.strokeStyle = `rgba(166,255,42,${.3 + .5 * k})`; ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]); ctx.lineDashOffset = -T * .5;
      ctx.strokeRect(x - hw, Math.min(y, top), hw * 2, h);
      ctx.setLineDash([]);
      continue;
    }
    // burning: the fumes stand off it, hatched, ruled at the top
    ctx.save();
    ctx.beginPath(); ctx.rect(x - hw, Math.min(y, top), hw * 2, h); ctx.clip();
    ctx.fillStyle = 'rgba(127,240,140,.14)'; // two washes, thicker at the skin (no gradient object per pool per frame)
    ctx.fillRect(x - hw, Math.min(y, top), hw * 2, h);
    ctx.fillRect(x - hw, s > 0 ? y - h / 2 : y, hw * 2, h / 2);
    ctx.strokeStyle = 'rgba(166,255,42,.28)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let q = -h + ((T * .6) % 6); q < hw * 2 + h; q += 6) { ctx.moveTo(x - hw + q, y); ctx.lineTo(x - hw + q - h * .6, top); }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = `rgba(166,255,42,${st === 1 ? .7 : .3})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - hw, top); ctx.lineTo(x + hw, top); ctx.stroke();
    // the eruption: boiling, its column outlined and hatched up from the skin (the tell); then the column stands
    const er = eruptStage(a), R = e.pR[i], cw = DN.plCW, y1 = y - s * R;
    if (er) {
      const b = a - DN.plArm - DN.plEr0, q = b % DN.plEvery;
      if (er === 1) {
        const kk = q / DN.plErTel, hot = q >= DN.plErTel - 16, yk = y - s * R * kk;
        ctx.save();
        ctx.beginPath(); ctx.rect(x - cw, Math.min(y, yk), cw * 2, Math.abs(y - yk)); ctx.clip();
        ctx.strokeStyle = `rgba(166,255,42,${.2 + .35 * kk})`; ctx.lineWidth = 1; ctx.beginPath();
        for (let v = -cw * 2 + ((T * s) % 6); v < R + cw * 2; v += 6) { ctx.moveTo(x - cw, y - s * v); ctx.lineTo(x + cw, y - s * (v + cw * 2)); }
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = hot ? 'rgba(255,70,50,.8)' : `rgba(166,255,42,${.3 + .4 * kk})`; ctx.lineWidth = hot ? 2 : 1;
        ctx.setLineDash(hot ? [] : [3, 3]); ctx.lineDashOffset = T * .5 * s;
        ctx.strokeRect(x - cw, Math.min(y, y1), cw * 2, R);
        ctx.setLineDash([]);
        for (let j = 0; j < 4; j++) { const ph = ((T * 2 + j * 11 + i * 7) % 20) / 20; ctx.fillStyle = `rgba(200,255,150,${.7 * (1 - ph)})`; ctx.fillRect(x + (hash(j * 9 + i + (T >> 2)) - .5) * w * 1.4, y - s * (1 + ph * 8), 2, 2); }
      } else { // the column: bile, a pale core, foam at its head
        const kq = (q - DN.plErTel) / DN.plErLive, wob = Math.sin(T * .9 + i) * 1.5, head = 1 - Math.max(0, kq - .8) * 5;
        const yh = y - s * R * Math.min(1, head);
        ctx.fillStyle = 'rgba(70,170,40,.75)'; ctx.fillRect(x - cw + wob * .5, Math.min(y, yh), cw * 2, Math.abs(y - yh));
        ctx.fillStyle = 'rgba(170,255,110,.65)'; ctx.fillRect(x - cw * .4 + wob, Math.min(y, yh), cw * .8, Math.abs(y - yh));
        ctx.fillStyle = 'rgba(230,255,200,.8)';
        for (let j = 0; j < 5; j++) ctx.fillRect(x + (hash(j * 5 + i * 3 + (T >> 1)) - .5) * cw * 2.6, yh - s * hash(j + (T >> 1)) * 6, 2, 2);
        ctx.strokeStyle = 'rgba(255,70,50,.7)'; ctx.lineWidth = 1; ctx.strokeRect(x - cw, Math.min(y, y1), cw * 2, R);
      }
    }
    // a bubble rising and bursting, on its own beat
    const ph = ((T + i * 23) % 40) / 40;
    ctx.fillStyle = `rgba(200,255,150,${.6 * (1 - ph)})`;
    ctx.beginPath(); ctx.arc(x + (hash(i * 3 + ((T + i * 23) / 40 | 0)) - .5) * w, y - s * (2 + ph * h), 1.2 + ph, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** the kind's art for the registry (./index.ts): draw, and its atlas for the per-route warm-up (render/warmup.ts) */
export default {
  draw: grossCyst,
  under: pools,
  warm() { bakedWarm(K); return false; }, // false: nothing left to build
  built: () => bakedBuilt(K),
  drop() { bakedDrop(K); },
};
