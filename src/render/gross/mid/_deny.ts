// @ts-nocheck
// Render-only: the tells of the midbosses' area-denial moves (sim: enemies/mid/_deny.ts, D61). Procedural, no new art:
// they read with the sound and the flashes off, through hatching and ruled edges, not colour alone (D59's search-beam mark
// is the model). No RNG: motion from $.T, so the sim never feels it.
import { $ } from '../../../state';
import { ctx } from '../../../core';

/**
 * A marked lane: a band x0..x1 at y, half-height hh. k 0..1 fills it with hatching from x1 toward x0 (the way the
 * threat will travel); hot (the last frames of the tell, or the threat live) rules the edges solid in rgb, else dashed.
 * Three chevrons point the way along it (dir -1: leftward).
 */
export function laneBand(x0, x1, y, hh, k, hot, rgb, dir = -1) {
  const T = $.T || 0, fx = x1 - (x1 - x0) * Math.min(1, k);
  ctx.save();
  // the hatch: 45 deg strokes, 6 px apart, crawling the way it will come
  ctx.beginPath(); ctx.rect(fx, y - hh, x1 - fx, hh * 2); ctx.clip();
  ctx.strokeStyle = `rgba(${rgb},${.18 + .3 * k})`; ctx.lineWidth = 1;
  ctx.beginPath();
  const off = (T * (dir < 0 ? -1 : 1)) % 6;
  for (let x = fx - hh * 2 + off; x < x1 + hh * 2; x += 6) { ctx.moveTo(x, y + hh); ctx.lineTo(x + hh * 2, y - hh); }
  ctx.stroke();
  ctx.restore();
  ctx.save();
  // the ruled edges, the whole length (a lane you can see the ends of)
  ctx.strokeStyle = `rgba(${rgb},${hot ? .85 : .3 + .4 * k})`; ctx.lineWidth = hot ? 2 : 1;
  ctx.setLineDash(hot ? [] : [4, 4]); ctx.lineDashOffset = dir < 0 ? T * .5 : -T * .5;
  ctx.beginPath(); ctx.moveTo(x0, y - hh); ctx.lineTo(x1, y - hh); ctx.moveTo(x0, y + hh); ctx.lineTo(x1, y + hh); ctx.stroke();
  ctx.setLineDash([]);
  // chevrons along it, marching the way it will sweep
  ctx.strokeStyle = `rgba(${rgb},${.35 + .5 * k})`; ctx.lineWidth = 2;
  const L = x1 - x0, step = L / 3, m = ((T * 1.5) % step) * (dir < 0 ? -1 : 1);
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    let cx = x0 + step * (i + .5) + m;
    cx = x0 + (((cx - x0) % L) + L) % L;
    const s = hh * .45 * -dir;
    ctx.moveTo(cx + s, y - hh * .5); ctx.lineTo(cx, y); ctx.lineTo(cx + s, y + hh * .5);
  }
  ctx.stroke();
  ctx.restore();
}

/** a dashed line from (x, y) along angle a, len long; k 0..1 brightens it, solid when locked */
export function aimLine(x, y, a, len, k, locked, rgb) {
  ctx.save();
  ctx.strokeStyle = `rgba(${rgb},${.25 + .65 * k})`;
  ctx.lineWidth = locked ? 2 : 1;
  ctx.setLineDash(locked ? [] : [2, 3]); ctx.lineDashOffset = -($.T || 0);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  ctx.restore();
}

/**
 * A marked sector (DIFFICULTY-SPEC §2.3, the Saucer's phase-2 sweep): a wedge from (x, y) along a0, half rad either side,
 * len long, on context c (the caller's space). k 0..1 thickens the hatching; hot rules the two edges solid, else dashed.
 * Hatching in place of a fill, so it reads with colour off (D59's grammar, as laneBand)
 */
export function wedge(c, x, y, a0, half, len, k, hot, rgb) {
  const T = $.T || 0;
  c.save();
  c.beginPath(); c.moveTo(x, y); c.arc(x, y, len, a0 - half, a0 + half); c.closePath(); c.clip();
  c.strokeStyle = `rgba(${rgb},${.12 + .28 * k})`; c.lineWidth = 1;
  c.beginPath(); // arcs every 14 px, crawling outward: the reach is the threat
  for (let r = 18 + (T * .6) % 14; r < len; r += 14) { c.moveTo(x + Math.cos(a0 - half) * r, y + Math.sin(a0 - half) * r); c.arc(x, y, r, a0 - half, a0 + half); }
  c.stroke();
  c.restore();
  c.save();
  c.strokeStyle = `rgba(${rgb},${hot ? .85 : .3 + .4 * k})`; c.lineWidth = hot ? 1.6 : 1;
  c.setLineDash(hot ? [] : [4, 4]); c.lineDashOffset = -T * .5;
  c.beginPath();
  for (let i = -1; i <= 1; i += 2) { const a = a0 + i * half; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); } // no per-frame array
  c.stroke();
  c.restore();
}

/**
 * An edge chevron (DIFFICULTY-SPEC §2.3, the Brood's phase-1 litter): three stacked chevrons at column x on the top
 * (side 1) or bottom (side -1) edge, pointing in, h px tall in all; k 0..1 brightens them and they march inward; hot
 * rules a solid bar along the edge (the last frames)
 */
export function edgeChevron(x, side, ph, k, hot, rgb) {
  const T = $.T || 0, y0 = side > 0 ? 2 : ph - 2, s = side > 0 ? 1 : -1, m = (T * .5) % 8;
  ctx.save();
  ctx.strokeStyle = `rgba(${rgb},${.35 + .55 * k})`; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) { const y = y0 + s * (4 + i * 8 + m * k); ctx.moveTo(x - 7, y); ctx.lineTo(x, y + s * 6); ctx.lineTo(x + 7, y); }
  ctx.stroke();
  if (hot) { ctx.fillStyle = `rgba(${rgb},.8)`; ctx.fillRect(x - 10, side > 0 ? 0 : ph - 3, 20, 3); }
  ctx.restore();
}
