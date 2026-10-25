// @ts-nocheck
import { PH, R, TAU, W, ctx, pick, ri, rr } from './core';

// ---------------- photos ----------------
// src/img/*.png: real images (JWST deep field, Voyager/Webb Neptune, x-rays), made by tools/jades_backdrop.py and
// tools/import_openverse.py, credited in CREDITS.md. Load in the background; draw code checks ready() and falls back.
const IMG_URLS = import.meta.glob('./img/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const PIC: Record<string, HTMLImageElement> = {};
for (const [p, u] of Object.entries(IMG_URLS)) {
  const i = new Image();
  i.src = u;
  PIC[p.slice(6, -4)] = i;
}
export const ready = (k) => PIC[k] && PIC[k].complete && PIC[k].naturalWidth > 0;

// ---------------- real-tissue terrain textures ----------------
// src/img/tex-*.png (128px seamless tiles) made by tools/roda_textures.py from RODA open data: CAMELYON16 H&E
// lymph-node metastasis slides + CC0 iNaturalist slime moulds / jelly fungi (see that script and CREDITS.md).
/** GROSS: 0..1, how much of the real-tissue textures is laid over the old procedural terrain patterns.
 *  1 = full diseased tissue, 0 = the original hand-drawn look. Dial back here. */
export const GROSS = 1;
const TEXP = {};
/** cached repeat pattern for src/img/tex-<k>.png, or null until the image has loaded (callers fall back) */
export function texPat(k) {
  if (TEXP[k]) return TEXP[k];
  if (!ready('tex-' + k)) return null;
  return (TEXP[k] = ctx.createPattern(PIC['tex-' + k], 'repeat'));
}

// ---------------- textures ----------------
export function mkTex(fn) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  fn(c.getContext('2d'));
  return ctx.createPattern(c, 'repeat');
}
export const metalPat = mkTex(x => {
  x.fillStyle = '#12171c';
  x.fillRect(0, 0, 64, 64);
  for (const py of [0, 32]) for (const px of [0, 32]) {
    const s = R() * 8 | 0;
    x.fillStyle = `rgb(${21 + s},${26 + s},${33 + s})`;
    x.fillRect(px + 1, py + 1, 30, 30);
    x.fillStyle = '#07090c';
    x.fillRect(px, py, 32, 1);
    x.fillRect(px, py, 1, 32);
    x.fillStyle = '#2a323c';
    x.fillRect(px + 1, py + 1, 30, 1);
    x.fillStyle = '#56626f';
    for (const [rx, ry] of [[3, 3], [28, 3], [3, 28], [28, 28]]) x.fillRect(px + rx, py + ry, 1, 1);
  }
  for (let i = 0; i < 600; i++) {
    x.fillStyle = `rgba(0,0,0,${R() * .35})`;
    x.fillRect(R() * 64 | 0, R() * 64 | 0, 1, 1);
  }
  for (let i = 0; i < 5; i++) {
    x.fillStyle = `rgba(${60 + R() * 40 | 0},6,8,${rr(.15, .4)})`;
    const sx = R() * 64 | 0;
    x.fillRect(sx, R() * 30 | 0, 1, ri(6, 26));
  }
  x.fillStyle = 'rgba(0,0,0,.25)';
  x.fillRect(15, 0, 2, 64);
  x.fillRect(47, 0, 2, 64);
});
export const fleshPat = mkTex(x => {
  x.fillStyle = '#3a0c0e';
  x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 34; i++) {
    x.fillStyle = pick(['#5e1a1a', '#4a1214', '#7a2a26', '#2c0708']);
    x.beginPath();
    x.arc(R() * 64, R() * 64, rr(2, 8), 0, TAU);
    x.fill();
  }
  x.strokeStyle = '#1b0304';
  x.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    x.beginPath();
    let px = R() * 64,
      py = R() * 64;
    x.moveTo(px, py);
    for (let k = 0; k < 5; k++) {
      px += rr(-8, 8);
      py += rr(-8, 8);
      x.lineTo(px, py);
    }
    x.stroke();
  }
  for (let i = 0; i < 8; i++) {
    x.fillStyle = '#d6b46a';
    x.fillRect(R() * 64 | 0, R() * 64 | 0, 1, 1);
  }
});

// background stars and derelict silhouette
export const STARS = [0, 1, 2].map(l => Array.from({
  length: [80, 50, 24][l]
}, () => ({
  x: R() * W,
  y: R() * PH,
  b: rr(.3, 1),
  p: R() * TAU
})));
export const DERE = (() => {
  const a = [];
  let x = 0;
  while (x < 1500) {
    const w = ri(18, 70),
      h = ri(6, 26);
    a.push({
      x,
      w,
      h,
      sp: R() < .25 ? ri(10, 34) : 0,
      win: Array.from({
        length: ri(0, 4)
      }, () => ({
        dx: R() * w | 0,
        dy: R() * h | 0
      }))
    });
    x += w;
  }
  return a;
})();

// ---------------- helpers: particles ----------------
