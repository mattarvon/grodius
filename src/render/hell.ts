// @ts-nocheck
import { $ } from '../state';
import { H, W, ctx } from '../core';
import { srnd, sri } from '../srnd';
import { SET } from '../save';
import { GLQ } from '../render/eyes';

// Photosensitivity: a full-screen wash may start at most once per MIN_GAP steps (60 Hz -> <= 3 per second).
// A wash that tries to start sooner holds its previous (fading) level until the gap has passed.
const MIN_GAP = 20;
const LIM = { white: { shown: 0, last: -99 }, red: { shown: 0, last: -99 } };
function limited(s, v) {
  if (v > s.shown + .05) {
    if ($.T - s.last >= MIN_GAP) { s.last = $.T; s.shown = v; } else s.shown *= .85;
  } else s.shown = v;
  return s.shown;
}
export function postFX() {
  if (!$.G) return;
  // HELL FLASHES OFF removes every full-screen wash and tear (the hell face image itself was removed 2026-11-15); the sim state ($.G.white etc.) is unchanged
  const on = SET.flashes;
  if ($.G.glitch > 0) for (let i = 0; i < 3; i++) {
    const y = srnd() * H | 0,
      h = sri(2, 14),
      dx = sri(-14, 14);
    if (on) GLQ.push([0, y, W, h, dx, y, W, h]);
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
