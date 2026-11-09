// @ts-nocheck
// =====================================================================
//  THE SQUIDFUCKED SAUCER, the Open Orbit midboss: Matt's pick c3, the Natural-History Plate. A flying disc engraved like
//  a specimen plate and reversed to ivory scratchboard on black; George Shaw's cuttlefish arms (CC0) hang under it;
//  blood is the only colour. Art: tools/bossart/ufo/bake.py -> sprites/boss/ufo.png (+ .json).
//  Render-only. Gameplay (HP, attacks, hitboxes, timing) is enemies/mid/ufo.ts; everything here reads entity fields
//  (e.t, e.st, e.wt, e.la, e.ll, e.burst, e.hp, e.flash) and never calls the gameplay RNG.
//  Baked: the body by wound stage (the six hull cracks' hp bands), writhing arms, the hurt flash, and patches laid over
//  it for the parts that change: the three tumours (swell, crater), the belly hatch (dilation), the eye (gaze, tell,
//  blink). Live on top: the lash, drawn in the same engraved hand, the drips and bleeding cracks, the glow on tells.
// =====================================================================
import { $ } from '../../../state';
import { TAU, ctx, hash } from '../../../core';
import { srr, srnd } from '../../../srnd';
import { drop } from '../../../fx/spawn';
import { drawParts, emit, fxs, glowC, GROSS, rn, rnd, snd, spray, stepParts, strand } from '../midbosses';
import { bakedWarm, bf, breath, pour, trackDeath } from '../baked';
import { HATCH_O, LASH_O, TUMOURS } from '../../../enemies/mid/ufo';

const K = 'ufo';
// the plate's three inks: blood is the only colour (AUDIT.md section 8)
const INK = '#0c0a0b', IVORY = '#ddd3b6', BLOOD = '#8a0c14', BLOOD_D = '#4a050a';
/** wound stage from the hp fraction, on the hull cracks' thresholds (.85, .55, .3: tools/bossart/ufo/paint.py STAGE_HP) */
const stage = (e) => { const f = e.hp / e.max; return f > .85 ? 0 : f > .55 ? 1 : f > .3 ? 2 : 3; };
const EYE = [-.7, 4.7]; // the eye-core in the art (the sim's r15 core is centred on 0,0)
const RIM = (x) => .5 + 8.4 * Math.sqrt(Math.max(0, 1 - (x / 56) ** 2)); // the disc's underside y at x
const DRIPS = [-26, 7, -5, 31, -20, 22, -40, 40]; // where blood leaves the rim, the first 3 + 2 per stage
const CRACK_END = [[-26, 8], [34, 6], [2, 6], [52, 3], [-42, 6], [22, 11]]; // each opened crack bleeds from its lower end

// ---------------- the lash, engraved live (a 238 px reach that sweeps any angle cannot be a baked sprite) ----------------
const N = 26, PX = new Float32Array(N), PY = new Float32Array(N), NX = new Float32Array(N), NY = new Float32Array(N);
/** fill PX/PY with a tentacle from (x0,y0) heading a0, length L, writhing more toward the tip */
function path(x0, y0, a0, L, amp, ph, t, sag) {
  let x = x0, y = y0;
  PX[0] = x; PY[0] = y;
  for (let i = 1; i < N; i++) {
    const f = i / (N - 1), a = a0 + Math.sin(t * .07 + ph - f * 3.2) * amp * f;
    x += Math.cos(a) * L / (N - 1);
    y += Math.sin(a) * L / (N - 1) + sag * f;
    PX[i] = x; PY[i] = y;
  }
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1), dx = PX[b] - PX[a], dy = PY[b] - PY[a], d = Math.hypot(dx, dy) || 1;
    NX[i] = -dy / d; NY[i] = dx / d;
  }
}
/** the limb along PX/PY: an ink band, ivory edge, ivory hatch ticks on its back, ivory sucker rings underneath */
const wdf = (i, w0, w1) => w0 + (w1 - w0) * i / (N - 1);
function limb(c, w0, w1, hot) {
  c.beginPath();
  c.moveTo(PX[0] + NX[0] * w0, PY[0] + NY[0] * w0);
  for (let i = 1; i < N; i++) c.lineTo(PX[i] + NX[i] * wdf(i, w0, w1), PY[i] + NY[i] * wdf(i, w0, w1));
  for (let i = N - 1; i >= 0; i--) c.lineTo(PX[i] - NX[i] * wdf(i, w0, w1), PY[i] - NY[i] * wdf(i, w0, w1));
  c.closePath();
  c.fillStyle = INK;
  c.fill();
  c.strokeStyle = IVORY;
  c.lineWidth = .7;
  c.stroke();
  // engraved hatching across the back: short ivory strokes, the plate's cross-hatch
  c.lineWidth = .5;
  c.beginPath();
  for (let i = 1; i < N - 1; i++) {
    const w = wdf(i, w0, w1);
    c.moveTo(PX[i] + NX[i] * w, PY[i] + NY[i] * w);
    c.lineTo(PX[i] + NX[i] * w * .1 + (PX[i + 1] - PX[i]) * .4, PY[i] + NY[i] * w * .1 + (PY[i + 1] - PY[i]) * .4);
  }
  c.stroke();
  // sucker rings down the underside; on the tell and the whip they run blood
  c.strokeStyle = hot ? BLOOD : IVORY;
  c.beginPath();
  for (let i = 2; i < N - 1; i += 2) {
    const w = wdf(i, w0, w1), r = Math.max(.45, w * .36), x = PX[i] - NX[i] * w * .45, y = PY[i] - NY[i] * w * .45;
    c.moveTo(x + r, y);
    c.arc(x, y, r, 0, TAU);
  }
  c.stroke();
}
/** the lash tentacle (local coords): hung coiled at rest, rearing back on the telegraph, whipping out along e.la */
function lash(c, e, t, tel, w) {
  const [lx, ly] = LASH_O, limp = 1 + w * .12;
  if (e.st === 'whip' && e.ll > 20) {
    const ext = Math.min(1, (e.ll - 18) / 220);
    path(lx, ly, e.la, e.ll, .05 * (1 - ext) + .02, 0, t * 3, 0);
    limb(c, 4.4, 1.2, 1);
    c.globalCompositeOperation = 'lighter';
    glowC(c, PX[N - 1], PY[N - 1], 7, '230,30,30', .5);
    c.globalCompositeOperation = 'source-over';
  } else {
    const a = tel ? e.la + Math.PI * .85 + Math.sin(t * .6) * .35 : Math.PI * .62 + Math.sin(t * .03) * .2;
    path(lx, ly, a, (tel ? 27 : 23) * limp, tel ? 1.2 : .7, 1.3, t * (1 + tel * 3), tel ? 0 : .25);
    limb(c, tel ? 4 : 3.4, .7, tel);
    if (tel) {
      c.globalCompositeOperation = 'lighter';
      glowC(c, PX[N - 1], PY[N - 1], 4 + tel * 6, '230,30,30', .3 + .5 * tel * ((($.T >> 2) & 1) ? 1 : .6));
      c.globalCompositeOperation = 'source-over';
    }
  }
}

// ---------------- the boss ----------------
function drawUfoGross(c, e) {
  const s = fxs(e), t = e.t, f = s.f;
  stepParts(s);
  trackDeath(e, DEATH);
  if (e.dead || e.hp <= 0) return; // the kill plays from drawBakedDeaths (hud.ts): the baked split and the pour
  const w = stage(e);
  const tel = e.st === 'lash' ? Math.min(1, e.wt / (e.lash2 ? 28 : 42)) : 0;
  const sw = e.st === 'swell' && !f.cr0 ? Math.min(1, e.wt / 36) : 0;
  // ---- state edges: sounds, bursts, the litter ----
  if (s.ev === 'idle>swell') { snd('gross_slosh', .5, .35); f.cr0 = 0; }
  if (s.ev === 'idle>brood') snd('gross_gargle', .5, .4);
  if ((e.burst || 0) !== (f.burst || 0)) {
    f.burst = e.burst || 0; f.crT = t; f.cr0 = 1;
    for (let i = 0; i < TUMOURS.length; i++) { const [x, y] = TUMOURS[i]; spray(s, e.x + x, e.y + y, 9, i & 1 ? BLOOD : BLOOD_D, 1.8, 1.2, 1); }
    snd('gross_pop', .8, .25);
  }
  if (e.st === 'brood' && e.wt >= 40 && !f.drop) { f.drop = 1; f.dropT = t; spray(s, e.x + HATCH_O[0], e.y + HATCH_O[1] + 2, 14, BLOOD, 1.4, 1.3, -.4); snd('gross_gush', .7, .3); }
  if (e.st !== 'brood') f.drop = 0;
  const br = e.st === 'brood' ? Math.min(1, e.wt / 40) : Math.max(0, 1 - (t - (f.dropT ?? -99)) / 16);
  const crater = f.crT !== undefined && t - f.crT < 110;
  if (!crater && e.st !== 'swell') f.cr0 = 0;

  // ---- behind: the lash hung coiled under the front wing ----
  if (e.st !== 'lash' && e.st !== 'whip') lash(c, e, t, 0, w);
  // the lash's line: dashed, red, firming up as it locks (unchanged: the honest telegraph)
  if (e.st === 'lash') {
    const lock = e.wt >= (e.lash2 ? 12 : 26);
    c.save();
    c.setLineDash(lock ? [4, 2] : [2, 4]);
    c.lineDashOffset = -$.T;
    c.strokeStyle = `rgba(255,${lock ? 40 : 90},${lock ? 30 : 60},${.25 + .6 * tel})`;
    c.lineWidth = lock ? 1.4 : 1;
    c.beginPath();
    c.moveTo(LASH_O[0], LASH_O[1]);
    c.lineTo(LASH_O[0] + Math.cos(e.la) * 238, LASH_O[1] + Math.sin(e.la) * 238);
    c.stroke();
    c.restore();
  }

  // ---- the plate ----
  let ok;
  // the blood flash flickers rather than holds: under steady fire a held flash would paint the plate red for the whole fight
  if (e.flash >= 2 && (t & 3) < 2) ok = bf(c, K, 'hurt' + w);
  else {
    ok = bf(c, K, 'idle' + w, breath(t, 6, 150 - w * 22, 7));
    if (ok) {
      bf(c, K, 'hatch' + w, Math.round(br * 4));
      const tf = crater ? 5 : Math.round(sw * 4);
      for (let i = 0; i < 3; i++) bf(c, K, 'tum' + i + '_' + w, tf);
      // the gaze: the lash's aim while it lines up, else you; a hash-timed blink; at stage 3 it can't hold still
      let a;
      if (tel) a = e.la;
      else a = Math.atan2($.P.y - e.y - EYE[1], $.P.x - e.x - EYE[0]) + (w > 2 && hash(t >> 3) < .25 ? (hash((t >> 3) + 9) - .5) * 4 : 0);
      const ca = Math.cos(a), sa = Math.sin(a), gx = ca < -.38 ? -1 : ca > .38 ? 1 : 0, gy = sa < -.38 ? -1 : sa > .38 ? 1 : 0;
      if (!tel && !sw && (t + 40) % 190 < 6) bf(c, K, 'eyeB' + w, 0);
      else bf(c, K, (tel ? 'eyeT' : 'eye') + w, (gy + 1) * 3 + gx + 1);
    }
  }
  if (!ok) { // until the atlas lands: an unlit disc, so a hit never lands on nothing
    c.fillStyle = '#100c0d';
    c.beginPath();
    c.ellipse(0, .5, 56, 9, 0, 0, TAU);
    c.fill();
  }
  if (e.st === 'lash' || e.st === 'whip') lash(c, e, t, tel, w);

  // ---- live wet: blood off the rim and out of the open cracks, shedding real drops ----
  for (let i = 0; i < 3 + w * 2 && i < DRIPS.length; i++) { const x = DRIPS[i]; strand(c, s, e, 20 + i, x, RIM(x) - 1, 3 + (i % 3) * 2, .8, 'rgba(110,6,14,.92)', 70 + i * 13, BLOOD, 1); }
  for (let i = 0; i < w * 2 && i < CRACK_END.length; i++) { const h = CRACK_END[i]; strand(c, s, e, 40 + i, h[0], h[1], 4 + w, .9, 'rgba(140,8,16,.95)', 44 + i * 9, BLOOD, .8); }
  if (e.flash && rnd() < .6 * GROSS) emit(s, e.x + rn(-40, 30), e.y + rn(-6, 8), rn(-1.8, .4), rn(-1.8, .2), rnd() < .7 ? BLOOD : BLOOD_D, rn(.8, 1.5), 0, 60);
  if (br > 0 && rnd() < .3 * br * s.dt) emit(s, e.x + HATCH_O[0] + rn(-2, 2), e.y + HATCH_O[1] + 3, rn(-.3, .3), rn(.2, .9), BLOOD_D, rn(.8, 1.3), 0, 60);
  drawParts(c, s, e);
  // ---- the tells throw light: the tumours redden before the volley, the hatch before the litter ----
  if (sw || br) {
    c.globalCompositeOperation = 'lighter';
    const fl = (($.T >> 2) & 1) ? 1 : .7;
    if (sw) for (let i = 0; i < TUMOURS.length; i++) glowC(c, TUMOURS[i][0], TUMOURS[i][1] - 1, 5 + sw * 7, '230,30,30', (.18 + .45 * sw) * fl);
    if (br) glowC(c, HATCH_O[0], HATCH_O[1] + 1, 6 + br * 8, '220,20,30', .25 + .4 * br);
    c.globalCompositeOperation = 'source-over';
  }
}

// ---------------- death: the baked split (drawBakedDeaths) and a blood-only spill ----------------
// The plate's gore is blood and ivory only: drops on the blood indices (DC 0, 1), the pour's meat and gut, and engraved
// hull shards (below). The shared kill burst (the sim's gore() call) is untouched.
const SH = [];
let lastT = -1, lastG = null;
function deathGore(x, y, age) {
  pour(x, y + 6, age, { w: 30, h: 10, jets: 8, len: 96, meat: 18, rope: 6 });
  if (age === 1) {
    for (let i = 0; i < 26; i++) {
      const sx = srr(-54, 54);
      SH.push({ x: x + sx, y: y + srr(-6, 6), vx: sx * .03 + srr(-1.2, 1.2), vy: srr(-3.2, -.4), r: srnd() * TAU, vr: srr(-.3, .3), s: srr(1.6, 4), l: srr(70, 120), m: 120 });
    }
    snd('gross_gush', .85, .3);
    snd('splat_l', .9, .2);
  }
  // the split pumps out of its middle while it falls
  if (age < 64 && age % 2 === 0) for (let k = 0; k < 3; k++) drop(x + srr(-4, 4), y + srr(-2, 10), srr(-1.4, 1.4), srr(-.5, 2), srr(1.2, 2.2), srnd() < .6 ? 0 : 1, 90);
}
const DEATH = { k: K, list: 'die', rate: 8, fall: .02, drift: .25, hold: 30, gore: deathGore };

/** the Saucer's private fx, ticked once per render after the enemies (hud.ts): its death's engraved hull shards */
export function drawUfoFx() {
  if (lastG !== $.G) { lastG = $.G; SH.length = 0; lastT = $.T; }
  const dt = Math.max(0, Math.min(4, $.T - lastT));
  lastT = $.T;
  if (!SH.length) return;
  const c = ctx;
  for (let i = SH.length - 1; i >= 0; i--) {
    const p = SH[i];
    if (dt) {
      p.l -= dt;
      if (p.l <= 0) { SH[i] = SH[SH.length - 1]; SH.pop(); continue; }
      p.vy += .1 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
    }
    const s = p.s, ca = Math.cos(p.r), sa = Math.sin(p.r);
    c.globalAlpha = Math.min(1, p.l / 30);
    c.save();
    c.transform(ca, sa, -sa, ca, p.x, p.y); // a shard of the disc: an ivory sliver, engraved, blood on its broken edge
    c.fillStyle = IVORY;
    c.beginPath(); c.moveTo(-s, -s * .4); c.lineTo(s * .8, -s * .5); c.lineTo(s, s * .3); c.lineTo(-s * .6, s * .5); c.closePath(); c.fill();
    c.strokeStyle = INK; c.lineWidth = .5;
    c.beginPath(); c.moveTo(-s * .6, -s * .2); c.lineTo(s * .6, -s * .3); c.moveTo(-s * .4, s * .15); c.lineTo(s * .7, 0); c.stroke();
    c.strokeStyle = BLOOD; c.lineWidth = .8;
    c.beginPath(); c.moveTo(s, s * .3); c.lineTo(-s * .6, s * .5); c.stroke();
    c.restore();
  }
  c.globalAlpha = 1;
}

/** load the atlas (boot art: built once, held all session); false: nothing left to build */
export function warmUfo() { bakedWarm(K); return false; }

/** the kind's art for the registry (./index.ts). A boot kind: no built or drop */
export default { draw: drawUfoGross, warm: warmUfo };
