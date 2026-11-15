// Matt's tiny severed head (self-portrait), an easter egg floating in around the title's edges: one baked 3-frame strip and
// a few live drips, on the low-res ctx over the dim rect and behind the title's text. Integer pixels, flat reds, no alpha,
// no allocation per frame. Path and tuning are in titleblood.ts; this file only draws.
// head_egg@3.png is baked by a generator outside the repo, in ~/Pictures/grodius-head/, because its source photo is never committed.
import { $ } from '../state';
import { ctx } from '../core';
import { SPR } from '../sprites';
import { D, DRIP, E, GONE, bobY, eggAdvance, eggFrame } from './titleblood';

const CORE = '#b3101a', SHAD = '#6e0a10', CLOT = '#3a0608';

function drawDrips(phase: number, col: string) {
  ctx.fillStyle = col;
  for (let i = 0; i < D.n; i++) {
    // thirds of its life, wettest first: the fade, with no alpha
    if (Math.floor(D.age[i] * 3 / D.life[i]) !== phase) continue;
    const tail = 1 + Math.floor(D.vy[i] * DRIP.tailK);
    ctx.fillRect(Math.floor(D.x[i]), Math.floor(D.y[i]) - tail + 1, D.w[i], tail);
  }
}

/** The head, when it's visiting, and its drips. Draws nothing until the art is in */
export function drawTitleHead() {
  const s = SPR.head_egg;
  if (!(s && s.fw)) return;
  const T = $.T;
  eggAdvance(T);
  const smooth = ctx.imageSmoothingEnabled, al = ctx.globalAlpha;
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  drawDrips(2, CLOT);
  drawDrips(1, SHAD);
  drawDrips(0, CORE);
  if (E.phase !== GONE) ctx.drawImage(s.img, eggFrame(T) * s.fw, 0, s.fw, s.fh, Math.round(E.x), Math.round(E.y) + bobY(T), s.fw, s.fh);
  ctx.imageSmoothingEnabled = smooth;
  ctx.globalAlpha = al;
}
