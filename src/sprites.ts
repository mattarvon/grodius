// @ts-nocheck
// ---------------- sprites ----------------
// src/sprites/<name>@<frames>.png: horizontal strips of equal frames, already cut, scaled to in-game size and graded by
// tools/sprite_prep.py from the OpenGameArt picks in assets-raw/sprites (credited in CREDITS.md). "@<frames>" is left
// out for a single image. They load in the background: spr() returns false until ready, and callers fall back to their
// code-drawn art.
// RULE: sprite draws and their fallbacks never touch the gameplay RNG (core R / rr / ri / pick). The harness seeds
// Math.random and renders real frames, so a render-side R() call that depends on image-load timing would desync it.
// Use srnd() below for any render randomness.
const URLS = import.meta.glob('./sprites/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const SPR: Record<string, { img: HTMLImageElement, n: number, fw: number, fh: number }> = {};
for (const [p, u] of Object.entries(URLS)) {
  const m = p.match(/\/([^/@]+)(?:@(\d+))?\.png$/);
  const img = new Image(), s = (SPR[m[1]] = { img, n: +(m[2] || 1), fw: 0, fh: 0 });
  img.onload = () => { s.fw = img.width / s.n; s.fh = img.height; };
  img.src = u;
}
export const sprReady = (k) => SPR[k] && SPR[k].fw > 0;
/** frame count of sprite k (1 until loaded) */
export const sprN = (k) => (SPR[k] ? SPR[k].n : 1);

/** Draw frame f (wraps, fractional ok) of sprite k centred on (x, y). Options: s = scale, sx/sy = per-axis scale
 *  (negative mirrors), rot = radians, a = alpha, ax/ay = anchor 0..1 (default .5 = centre; ay 1 = feet on y).
 *  Returns false (and draws nothing) until the image has loaded. Respects the caller's ctx.filter (hit flash). */
export function spr(c, k, f, x, y, o: any = {}) {
  const s = SPR[k];
  if (!s || !s.fw) return false;
  const n = s.n, i = (((f | 0) % n) + n) % n;
  const sc = o.s ?? 1, sx = (o.sx ?? 1) * sc, sy = (o.sy ?? 1) * sc;
  c.save();
  c.translate(x, y);
  if (o.rot) c.rotate(o.rot);
  if (o.a != null) c.globalAlpha *= o.a;
  c.scale(sx, sy);
  c.imageSmoothingEnabled = !!o.smooth;
  c.drawImage(s.img, i * s.fw, 0, s.fw, s.fh, -s.fw * (o.ax ?? .5), -s.fh * (o.ay ?? .5), s.fw, s.fh);
  c.restore();
  return true;
}
/** animation frame for a clock t (game frames, 60/s) at fps frames per second */
export const sprAt = (t, fps) => Math.floor(t * fps / 60);

// render-only RNG (xorshift32): never the gameplay R()
let seed = 0x9e3779b9;
export function srnd() {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}
