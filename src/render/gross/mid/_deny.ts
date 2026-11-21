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
