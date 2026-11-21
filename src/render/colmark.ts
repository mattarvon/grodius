// The column mark (D59): a hatched band down a column with its edges ruled, filling from where the threat comes from
// toward where it goes as its tell runs out. THE KEEPSAKE's search beam marks the ship's column with it
// (render/gross/boss/keepsake.ts), and D61's aimed biome hazards mark theirs (render/biomeart.ts). It reads with the
// sound off and the flashes off: hatching, not a colour alone. Presentation only: no RNG.
import { ctx } from '../core';

/** stripes across the current clip, every `step` px at 45 deg (the search beam's and the mark's hatching) */
export function hatch(x0: number, y0: number, x1: number, y1: number, step: number, off: number) {
  ctx.beginPath();
  for (let u = x0 - (y1 - y0) + (off % step); u < x1; u += step) { ctx.moveTo(u, y1); ctx.lineTo(u + (y1 - y0), y0); }
  ctx.stroke();
}

/** the band from x - hw to x + hw, running from y0 (the source) to y1 (either way), hatched red over the share k (0..1)
 *  filled so far, the two edges ruled and a 3 px bar at the fill's edge. Leaves the stroke style, a 3 px line width and
 *  the edges' alpha set, for a caller's own marks on top (KEEPSAKE's chevrons); the caller saves and restores */
export function colMark(x: number, hw: number, y0: number, y1: number, k: number) {
  const x0 = x - hw, x1 = x + hw, fill = y0 + (y1 - y0) * k, a = Math.min(y0, fill), b = Math.max(y0, fill);
  ctx.beginPath(); ctx.rect(x0, a, 2 * hw, b - a); ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,90,60,.55)'; ctx.lineWidth = 1.5;
  hatch(x0, a, x1, b, 6, 0); // the part filled so far: dense red hatching
  ctx.restore();
  ctx.strokeStyle = '#ff6e50'; ctx.globalAlpha = .45 + .45 * k; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, fill); ctx.lineTo(x1, fill); ctx.stroke(); // the fill's edge, moving
}
