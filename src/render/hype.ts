// @ts-nocheck
import { $ } from '../state';
import { C, FONT_D, FONT_H, TAU, W, clamp, ctx, sstep } from '../core';
import { drawChain, poly, txt } from '../render/util';
import { drawEShots } from '../render/hud';
import { SPR, srnd } from '../sprites';
import { AU } from '../audio';

// --- hype man: SGT. RAMROD SLAB ---
export function drawSlab(c, jaw, t) {
  const sk = '#b97648',
    skD = '#7e4a2a',
    skL = '#dba070';
  // torso + traps
  c.fillStyle = skD;
  poly(c, [[-56, 2], [-48, -38], [-20, -52], [20, -52], [48, -38], [56, 2]]);
  c.fillStyle = sk;
  poly(c, [[-52, 2], [-45, -37], [-19, -49], [19, -49], [45, -37], [50, 2]]);
  c.strokeStyle = skD;
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-30, -26);
  c.quadraticCurveTo(-12, -14, 0, -26);
  c.quadraticCurveTo(12, -14, 30, -26);
  c.moveTo(0, -26);
  c.lineTo(0, -2);
  for (let k = 0; k < 3; k++) {
    c.moveTo(-8, -8 + k * -0);
    c.moveTo(-9, -10 + k * 5);
    c.lineTo(-2, -10 + k * 5);
    c.moveTo(2, -10 + k * 5);
    c.lineTo(9, -10 + k * 5);
  }
  c.stroke();
  c.fillStyle = skL;
  c.beginPath();
  c.ellipse(-20, -36, 8, 3, -.3, 0, TAU);
  c.ellipse(18, -36, 8, 3, .3, 0, TAU);
  c.fill();
  // spiked leather pad + chain bandolier
  c.fillStyle = '#161112';
  c.beginPath();
  c.ellipse(-40, -40, 18, 11, -.35, 0, TAU);
  c.fill();
  c.fillStyle = '#3a2e2c';
  c.beginPath();
  c.ellipse(-42, -43, 13, 5, -.35, 0, TAU);
  c.fill();
  c.fillStyle = '#cfd8e0';
  for (let k = 0; k < 4; k++) {
    const x = -54 + k * 8,
      y = -46 - k * 2.5;
    poly(c, [[x - 2.2, y + 3], [x, y - 6], [x + 2.2, y + 3]]);
  }
  drawChain(c, -40, -30, 34, 4, 1.6);
  // flexed right arm
  c.strokeStyle = skD;
  c.lineCap = 'round';
  c.lineWidth = 16;
  c.beginPath();
  c.moveTo(38, -40);
  c.lineTo(58, -46);
  c.lineTo(52, -82);
  c.stroke();
  c.strokeStyle = sk;
  c.lineWidth = 13;
  c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = sk;
  c.beginPath();
  c.ellipse(49, -52, 11, 9, -.3, 0, TAU);
  c.fill();
  c.fillStyle = skL;
  c.beginPath();
  c.ellipse(46, -56, 5, 3, -.3, 0, TAU);
  c.fill();
  c.strokeStyle = '#5a7090';
  c.lineWidth = .8;
  c.beginPath();
  c.moveTo(42, -50);
  c.quadraticCurveTo(48, -47, 55, -53);
  c.stroke();
  c.fillStyle = '#c3121c';
  c.fillRect(46, -78, 13, 5);
  c.fillStyle = '#ffd23a';
  c.fillRect(46, -78, 13, 1);
  c.fillStyle = sk;
  c.beginPath();
  c.arc(52, -87, 8, 0, TAU);
  c.fill();
  c.strokeStyle = skD;
  c.lineWidth = 1;
  c.beginPath();
  for (let k = 0; k < 3; k++) {
    c.moveTo(46 + k * 3.5, -92);
    c.lineTo(46 + k * 3.5, -86);
  }
  c.stroke();
  // neck
  c.fillStyle = sk;
  c.fillRect(-14, -66, 28, 18);
  c.strokeStyle = '#8a4a30';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-8, -64);
  c.lineTo(-10, -50);
  c.moveTo(8, -64);
  c.lineTo(11, -50);
  c.stroke();
  // head
  c.fillStyle = sk;
  c.beginPath();
  c.ellipse(0, -82, 17, 20, 0, 0, TAU);
  c.fill();
  c.fillStyle = skL;
  c.beginPath();
  c.ellipse(-6, -96, 7, 4, -.3, 0, TAU);
  c.fill();
  c.strokeStyle = '#5a2a1a';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(4, -100);
  c.lineTo(13, -89);
  for (let k = 0; k < 4; k++) {
    const f = k / 3,
      x = 4 + 9 * f,
      y = -100 + 11 * f;
    c.moveTo(x - 2, y + 1.5);
    c.lineTo(x + 2, y - 1.5);
  }
  c.stroke();
  // mutton chops
  c.fillStyle = '#2e1a10';
  poly(c, [[-17, -86], [-12, -84], [-9, -68], [-14, -62], [-18, -72]]);
  poly(c, [[17, -86], [12, -84], [9, -68], [14, -62], [18, -72]]);
  // chrome visor
  c.fillStyle = '#0d0f12';
  c.fillRect(-19, -91, 38, 9);
  const g = c.createLinearGradient(-16, -90, 16, -83);
  g.addColorStop(0, '#5fd0ff');
  g.addColorStop(.5, '#e8f6ff');
  g.addColorStop(1, '#2a6cff');
  c.fillStyle = g;
  c.fillRect(-15, -89.5, 13, 6);
  c.fillRect(2, -89.5, 13, 6);
  const gl = t * .08 % 3 - 1;
  c.fillStyle = 'rgba(255,255,255,.9)';
  c.fillRect(-15 + gl * 14, -89.5, 2, 6);
  c.fillRect(2 + gl * 14, -89.5, 2, 6);
  // yelling mouth
  const mh = 4 + jaw * 6;
  c.fillStyle = '#2a0606';
  c.beginPath();
  c.ellipse(0, -69, 8, mh, 0, 0, TAU);
  c.fill();
  c.fillStyle = C.bone;
  c.fillRect(-6, -69 - mh + 1, 12, 2.2);
  c.fillRect(-5, -69 + mh - 2.6, 10, 1.8);
  c.fillStyle = '#b83a3a';
  c.beginPath();
  c.ellipse(0, -69 + mh * .45, 4.5, mh * .35, 0, 0, Math.PI);
  c.fill();
  c.fillStyle = '#2e1a10';
  for (let k = -3; k <= 3; k++) c.fillRect(k * 2.4 - .5, -69 + mh + 1.5, 1, 1.2);
}
export function drawBabe() {
  const b = $.G.babe;
  if (!b) return;
  const age = b.ml - b.t,
    x = -40 + age * (W + 80) / b.ml,
    y = b.y + Math.sin(age * .07) * 4,
    wave = Math.sin(age * .3);
  ctx.save();
  ctx.globalAlpha = .92 * Math.min(1, b.t / 20, age / 10);
  // 80s neon trail
  ctx.globalCompositeOperation = 'lighter';
  for (const [c, o] of [['255,60,170', -2], ['60,220,255', 1], ['255,200,60', 4]]) {
    ctx.fillStyle = `rgba(${c},.55)`;
    ctx.fillRect(x - 60, y + o, 52, 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.translate(x, y);
  // surfboard
  ctx.fillStyle = '#ff3fa4';
  ctx.beginPath();
  ctx.ellipse(0, 1, 15, 2.6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(-12, .6, 24, .8);
  ctx.fillStyle = '#3cdcff';
  ctx.fillRect(-4, -.2, 8, .6);
  const sk = '#e39a62',
    skD = '#b46a3a';
  ctx.lineCap = 'round';
  // legs
  ctx.strokeStyle = skD;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-1, -14);
  ctx.lineTo(-4, -1);
  ctx.moveTo(1, -14);
  ctx.lineTo(4, -1);
  ctx.stroke();
  ctx.strokeStyle = sk;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // torso
  ctx.fillStyle = sk;
  ctx.beginPath();
  ctx.ellipse(0, -19, 3, 6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = skD;
  ctx.fillRect(1.6, -23, 1, 8);
  // bikini (full top + bottoms)
  ctx.fillStyle = '#ff2a6a';
  poly(ctx, [[-3, -15.5], [3, -15.5], [1.5, -13], [-1.5, -13]]);
  ctx.fillRect(-3, -21.5, 6, 2.2);
  ctx.fillStyle = '#ff8ab8';
  ctx.fillRect(-2.5, -21.5, 5, .6);
  // arms: one on hip, one waving
  ctx.strokeStyle = sk;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-2.5, -23);
  ctx.lineTo(-5, -18);
  ctx.lineTo(-2.6, -15.5);
  ctx.moveTo(2.5, -23);
  ctx.lineTo(6, -27);
  ctx.lineTo(7 + wave * 1.5, -32);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // head, shades, big blonde hair blowing back
  ctx.fillStyle = '#ffe060';
  poly(ctx, [[-2, -31], [-11, -27 + wave * .6], [-9, -24], [-3, -25], [0, -28]]);
  ctx.beginPath();
  ctx.arc(0, -28.5, 3.4, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = sk;
  ctx.beginPath();
  ctx.arc(.6, -27.5, 2.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(.4, -28.6, 3.4, 1.2);
  ctx.fillStyle = '#d0205a';
  ctx.fillRect(2, -25.8, 1.2, .7);
  ctx.fillStyle = '#fff3a0';
  ctx.fillRect(-1, -31.5, 2, .8);
  ctx.restore();
  // speech bubble
  if (age > 20 && b.t > 15) {
    const bx = clamp(x + 10, 6, W - 112),
      by = y - 46;
    ctx.save();
    ctx.globalAlpha = .92;
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx, by, 104, 12);
    ctx.fillStyle = '#ff2a6a';
    ctx.fillRect(bx, by, 104, 1);
    ctx.fillRect(bx, by + 11, 104, 1);
    poly(ctx, [[clamp(x + 6, bx + 4, bx + 100), by + 12], [clamp(x + 2, bx, bx + 96), by + 18], [clamp(x + 12, bx + 8, bx + 104), by + 12]]);
    txt('EXCELLENT WORK, BABY!', bx + 52, by + 3, '#d0205a', 'center', 7);
    ctx.restore();
  }
  // bullets stay on top
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 70, y - 50, 190, 62);
  ctx.clip();
  ctx.translate($.G.shx || 0, $.G.shy || 0);
  drawEShots();
  ctx.restore();
}

// --- hype voices: the comms window ---
// Every voice line (src/sfx/hype*, babe20, corpsevoice, bossreward, startgame) gets a face: a Reticulan from
// src/sprites/hface@18.png (tools/prep_screens.py, 3 jaw frames per face) that pops into the top-right corner like an
// incoming transmission, flaps its jaw while the clip plays (audio.ts voiceOn() stamps clip name + start/end on the
// audio clock) and glitches out after. Without recorded audio (muted, TTS fallback) it follows $.G.hype / $.G.babe.
// Render-only: all flicker comes from srnd() / $.T, never the gameplay RNG.
const VOICE = {
  'hell-yeah': [0, 'SGT. RAMROD SLAB'],
  shamalama: [1, 'BROTHER SHAMALAMA'],
  sfriend: [2, 'SURF CONTROL'],
  'stop-killing-me': [3, 'CREWMAN #5 // DECEASED', ['STOP KILLING ME', 'WITH YOUR SPACESHIP, SIR']],
  'keyster-easter': [4, 'THE KEYSTER'],
  'lesley-yeah-baby': [5, 'LESLEY, MISSION CONTROL']
};
const BY_CAT = { hype: 'hell-yeah', babe: 'sfriend', corpsevoice: 'stop-killing-me', bossreward: 'keyster-easter', startgame: 'lesley-yeah-baby' };
const voiceOf = (clip = '') => {
  // clip = file stem, e.g. 'hell-yeah-matty-1': match on the line, not the take
  for (const k in VOICE) if (clip === k || clip.startsWith(k + '-')) return VOICE[k];
  let h = 0; // a clip nobody mapped yet still gets the same face every time
  for (const ch of clip) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return [h % 6, 'UNKNOWN CALLER'];
};
const FW = 48, FH = 52, OPEN = 7, STATIC = 12, CLOSE = 16;
let cur = null; // { clip, v (linked AU.voice), t ($.T opened), out ($.T closing), L }
const vLive = (v, now) => v && now > v.t0 - .3 && now < v.t1 + .25;
function hypeSource(now) {
  const v = AU.voice;
  if (vLive(v, now)) return { v, clip: v.clip, L: /^hype/.test(v.cat) && $.G.hype ? $.G.hype.L : null };
  if ($.G.hype) return { clip: BY_CAT.hype, L: $.G.hype.L };
  if ($.G.babe) return { clip: BY_CAT.babe };
  return null;
}
export function drawHype() {
  const T = $.T, now = AU.c ? AU.c.currentTime : 0, s = hypeSource(now);
  if (s) {
    if (!cur || cur.out) cur = { clip: s.clip, v: s.v, t: T, out: 0, L: s.L };
    else if (s.v && s.v !== cur.v) {
      // the recorded clip lands a few frames after the hype/babe trigger: swap the face under the static; a new line
      // long after opens a fresh call
      if (T - cur.t < 40 || !cur.v) Object.assign(cur, { clip: s.clip, v: s.v });
      else cur = { clip: s.clip, v: s.v, t: T, out: 0 };
    }
    if (s.L) cur.L = s.L;
    // a linked clip that has finished hangs up even if the hype timer still runs
    if (cur.v && !vLive(cur.v, now) && !cur.out) cur.out = T;
  } else if (cur && !cur.out) cur.out = T;
  if (!cur) return;
  if (cur.out && T - cur.out > CLOSE) return void (cur = null);
  const [face, tag, cap] = voiceOf(cur.clip), L = cap || cur.L;
  const age = T - cur.t, out = cur.out ? (T - cur.out) / CLOSE : 0;
  const talking = !out && (cur.v ? now >= cur.v.t0 && now < cur.v.t1 : age > STATIC && age < 90);
  // syllables: two beating sines, quantised to shut / half / wide
  const syl = Math.abs(Math.sin(T * .43)) * (.55 + .45 * Math.sin(T * .117 + 1.3));
  const jaw = talking ? (syl > .5 ? 2 : syl > .2 ? 1 : 0) : 0;
  const wx = W - FW - 6, wy = 16;
  // open: a CRT line that unrolls; close: the picture tears and collapses back into the line
  const open = sstep(0, OPEN, age) * (1 - sstep(.5, 1, out)), hh = Math.max(1, Math.round((FH + 2) * open));
  const top = Math.round(wy + (FH + 2) / 2 - hh / 2), fade = out > .85 ? (1 - out) / .15 : 1;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(3,6,5,.86)';
  ctx.fillRect(wx - 1, top, FW + 2, hh);
  ctx.beginPath();
  ctx.rect(wx, top + 1, FW, Math.max(0, hh - 2));
  ctx.clip();
  const S = SPR.hface;
  if (S && S.fw && age >= 3) {
    const fx = (face * 3 + jaw) * S.fw;
    // the picture in 4 px bands that slip sideways on a bad signal (locking on, hanging up, the odd hiccup)
    const hic = (T * 7 + face * 13) % 97 < 3, tear = age < STATIC ? 1 - age / STATIC : out ? Math.min(1, out * 1.6) : hic ? .35 : 0;
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < FH; y += 4) {
      const o = tear && srnd() < .5 ? Math.round((srnd() - .5) * 18 * tear) : 0;
      ctx.drawImage(S.img, fx, y, S.fw, 4, wx + o, wy + 1 + y, S.fw, 4);
    }
    if (tear > .2) {
      // chroma tear: a red and a sick-green bar riding the worst slices
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k % 2 ? 'rgba(80,255,120,.25)' : 'rgba(255,40,40,.3)';
        ctx.fillRect(wx, wy + 1 + Math.floor(srnd() * FH), FW, 1 + Math.floor(srnd() * 3));
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // static snow while the link locks on
  if (age < STATIC + 4) {
    const k = 1 - sstep(STATIC - 4, STATIC + 4, age);
    for (let i = 0; i < 70; i++) {
      const g = (40 + srnd() * 200) | 0;
      ctx.fillStyle = `rgba(${g},${g},${g},${.85 * k})`;
      ctx.fillRect((wx + srnd() * FW) | 0, (wy + srnd() * (FH + 2)) | 0, 1 + ((srnd() * 3) | 0), 1);
    }
  }
  // scanlines + a slow rolling bar
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  for (let y = wy + 1; y < wy + FH + 1; y += 2) ctx.fillRect(wx, y, FW, 1);
  ctx.fillStyle = 'rgba(160,255,170,.06)';
  ctx.fillRect(wx, wy + 1 + ((T * .6) % (FH + 10)) - 8, FW, 6);
  ctx.restore();
  // bezel: crusted frame, corner brackets, REC light, drips
  if (hh > 3) {
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#4a0a0e';
    ctx.lineWidth = 1;
    ctx.strokeRect(wx - .5, top + .5, FW + 1, hh - 1);
    ctx.fillStyle = '#c3121c';
    const b = top + hh;
    for (const [x, y, w, h] of [[wx - 1, top, 5, 1], [wx - 1, top, 1, 5], [wx + FW - 4, top, 5, 1], [wx + FW, top, 1, 5], [wx - 1, b - 1, 5, 1], [wx - 1, b - 5, 1, 5], [wx + FW - 4, b - 1, 5, 1], [wx + FW, b - 5, 1, 5]]) ctx.fillRect(x, y, w, h);
    if (hh > 12 && (T >> 4) % 2) {
      ctx.fillStyle = '#ff2a2a';
      ctx.fillRect(wx + 3, top + 3, 2, 2);
    }
    ctx.fillStyle = '#6a0a10';
    for (const [dx, sp] of [[9, .05], [31, .033], [40, .071]]) ctx.fillRect(wx + dx, b, 1, 1 + ((age * sp) % 5 | 0));
    ctx.restore();
  }
  // caller tag + the line, left of the window
  if (age > STATIC && !out) {
    ctx.save();
    ctx.globalAlpha = sstep(STATIC, STATIC + 8, age) * .88;
    const tx = wx - 5;
    ctx.font = `7px ${FONT_H}`;
    const tw = ctx.measureText(tag).width;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(tx - tw - 3, wy, tw + 6, 9);
    txt(tag, tx, wy + 1, '#ffd23a', 'right', 7);
    if (L) {
      L.forEach((l, i) => {
        ctx.font = `11px ${FONT_D}`;
        const w = ctx.measureText(l).width, z = w > 118 ? (11 * 118) / w : 11, y = wy + 11 + i * 12;
        const j = talking && i === (T >> 3) % L.length ? 1 : 0;
        txt(l, tx + 1, y + 1, '#000', 'right', z, FONT_D);
        txt(l, tx, y - j, i ? '#e0242c' : '#fff3c4', 'right', z, FONT_D);
      });
    }
    ctx.restore();
  }
  // enemy fire always wins: redraw bullets over the window
  ctx.save();
  ctx.beginPath();
  ctx.rect(wx - 130, wy - 2, 130 + FW + 6, FH + 6);
  ctx.clip();
  ctx.translate($.G.shx || 0, $.G.shy || 0);
  drawEShots();
  ctx.restore();
}

// --- HUD ---
