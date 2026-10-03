// @ts-nocheck
import { $ } from '../state';
import { H, R, TAU, W, ctx, hc, hx, ri, rr } from '../core';
import { SET } from '../save';
import { GLQ } from '../render/eyes';

// --- hell flash image ---
export function makeHell() {
  hx.fillStyle = '#160000';
  hx.fillRect(0, 0, W, H);
  for (let i = 0; i < 50; i++) {
    hx.fillStyle = `rgba(${120 + R() * 120 | 0},0,0,${R() * .5})`;
    hx.fillRect(R() * W, R() * H, R() * W * .6, R() * 3);
  }
  const cx = W / 2 + rr(-90, 90),
    cy = H / 2 + rr(-20, 20),
    s = rr(.9, 1.5);
  hx.save();
  hx.translate(cx, cy);
  hx.scale(s, s * rr(1, 1.35));
  hx.rotate(rr(-.15, .15));
  hx.fillStyle = '#d6bfae';
  hx.beginPath();
  hx.ellipse(0, -10, 46, 58, 0, 0, TAU);
  hx.fill();
  for (let i = 0; i < 340; i++) {
    hx.fillStyle = `rgba(${60 + R() * 60 | 0},0,0,${R() * .45})`;
    hx.fillRect(rr(-46, 46), rr(-68, 48), rr(1, 4), rr(1, 9));
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
    const x = R() * W,
      y = R() * H;
    hx.moveTo(x, y);
    hx.lineTo(x + rr(-60, 60), y + rr(-60, 60));
  }
  hx.stroke();
}
export function postFX() {
  if ($.G && $.G.glitch > 0) for (let i = 0; i < 3; i++) {
    const y = R() * H | 0,
      h = ri(2, 14),
      dx = ri(-14, 14);
    GLQ.push([0, y, W, h, dx, y, W, h]);
  }
  if ($.G && $.G.hell > 0) {
    ctx.save();
    ctx.globalAlpha = .92;
    ctx.translate(rr(-4, 4), rr(-4, 4));
    if (R() < .5) ctx.globalCompositeOperation = 'difference';
    ctx.drawImage(hc, 0, 0);
    ctx.restore();
  }
  if ($.G && $.G.red > .02) {
    ctx.fillStyle = `rgba(160,0,8,${$.G.red * .4})`;
    ctx.fillRect(0, 0, W, H);
  }
  if ($.G && $.G.white > .02) {
    ctx.fillStyle = `rgba(255,250,245,${$.G.white * (SET.flashes ? 1 : .4)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// --- hype man: SGT. RAMROD SLAB ---
