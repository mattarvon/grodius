// @ts-nocheck
import { $ } from '../state';
import { H, TAU, W, ctx, hc, hx } from '../core';
import { srnd, srr, sri } from '../srnd';
import { SET } from '../save';
import { GLQ } from '../render/eyes';

// --- hell flash image ---
export function makeHell() {
  hx.fillStyle = '#160000';
  hx.fillRect(0, 0, W, H);
  for (let i = 0; i < 50; i++) {
    hx.fillStyle = `rgba(${120 + srnd() * 120 | 0},0,0,${srnd() * .5})`;
    hx.fillRect(srnd() * W, srnd() * H, srnd() * W * .6, srnd() * 3);
  }
  const cx = W / 2 + srr(-90, 90),
    cy = H / 2 + srr(-20, 20),
    s = srr(.9, 1.5);
  hx.save();
  hx.translate(cx, cy);
  hx.scale(s, s * srr(1, 1.35));
  hx.rotate(srr(-.15, .15));
  hx.fillStyle = '#d6bfae';
  hx.beginPath();
  hx.ellipse(0, -10, 46, 58, 0, 0, TAU);
  hx.fill();
  for (let i = 0; i < 340; i++) {
    hx.fillStyle = `rgba(${60 + srnd() * 60 | 0},0,0,${srnd() * .45})`;
    hx.fillRect(srr(-46, 46), srr(-68, 48), srr(1, 4), srr(1, 9));
  }
  hx.fillStyle = '#000';
  hx.beginPath();
  hx.ellipse(-18, -18, 12, 15, .2, 0, TAU);
  hx.ellipse(18, -18, 12, 15, -.2, 0, TAU);
  hx.fill();
  hx.fillStyle = '#ff1010';
  hx.beginPath();
  hx.arc(-18, -16, 2, 0, TAU);
  hx.arc(18, -16, 2, 0, TAU);
  hx.fill();
  hx.fillStyle = '#000';
  hx.beginPath();
  hx.ellipse(0, 28, 15, 32, 0, 0, TAU);
  hx.fill();
  hx.fillStyle = '#e8e0cc';
  for (let k = -3; k <= 3; k++) {
    hx.fillRect(k * 4 - 1.5, -3, 3, 7);
    hx.fillRect(k * 4 - 1.5, 52, 3, 6);
  }
  hx.fillStyle = '#8a0000';
  hx.fillRect(-21, -5, 3, 44);
  hx.fillRect(16, -5, 3, 58);
  hx.fillRect(-1, 58, 3, 30);
  hx.restore();
  hx.strokeStyle = 'rgba(255,40,40,.45)';
  hx.lineWidth = 1;
  hx.beginPath();
  for (let i = 0; i < 24; i++) {
    const x = srnd() * W,
      y = srnd() * H;
    hx.moveTo(x, y);
    hx.lineTo(x + srr(-60, 60), y + srr(-60, 60));
  }
  hx.stroke();
}
// Photosensitivity: a full-screen wash may start at most once per MIN_GAP steps (60 Hz -> <= 3 per second).
// A wash that tries to start sooner holds its previous (fading) level until the gap has passed.
const MIN_GAP = 20;
const LIM = { white: { shown: 0, last: -99 }, red: { shown: 0, last: -99 }, hell: { last: -99, on: false } };
function limited(s, v) {
  if (v > s.shown + .05) {
    if ($.T - s.last >= MIN_GAP) { s.last = $.T; s.shown = v; } else s.shown *= .85;
  } else s.shown = v;
  return s.shown;
}
export function postFX() {
  if (!$.G) return;
  // HELL FLASHES OFF removes every full-screen flash, wash and tear; the sim state ($.G.white etc.) is unchanged
  const on = SET.flashes;
  if ($.G.glitch > 0) for (let i = 0; i < 3; i++) {
    const y = srnd() * H | 0,
      h = sri(2, 14),
      dx = sri(-14, 14);
    if (on) GLQ.push([0, y, W, h, dx, y, W, h]);
  }
  const hl = LIM.hell;
  if ($.G.hell > 0) {
    if (!hl.on && $.T - hl.last >= MIN_GAP) { hl.on = true; hl.last = $.T; }
  } else hl.on = false;
  if (on && hl.on && $.G.hell > 0) {
    ctx.save();
    ctx.globalAlpha = .92;
    // jitter and the inverted look change every 10 steps (3 Hz), not every frame: a per-frame flip is a strobe
    const k = $.T / 10 | 0;
    ctx.translate((k * 7 % 9) - 4, (k * 5 % 9) - 4);
    if (k % 2) ctx.globalCompositeOperation = 'difference';
    ctx.drawImage(hc, 0, 0);
    ctx.restore();
  }
  const red = limited(LIM.red, $.G.red);
  if (on && red > .02) {
    ctx.fillStyle = `rgba(160,0,8,${red * .4})`;
    ctx.fillRect(0, 0, W, H);
  }
  const white = limited(LIM.white, $.G.white);
  if (on && white > .02) {
    ctx.fillStyle = `rgba(255,250,245,${white})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// --- hype man: SGT. RAMROD SLAB ---
