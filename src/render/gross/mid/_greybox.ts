// @ts-nocheck
// Pass 1's body (build plan LS2 art gate; tone note D39 A1): a dark, angular, asymmetric mass for a `wip` kind, so a
// pool lane can fly its mechanic before its art exists. A kind's art file is then one line:
//   export default greybox({ col: '#7ab8d8', r: 20, tell: (e) => (e.st === 'tel' ? e.wt / 40 : 0) });
// Tone (D39): no eye, no circle or blob, no breathing. It sits in shadow (its facets are the biome tint pushed down to the
// bottom of the value range), holds still, hitches on a hash-timed twitch, and its telegraph is a seam across its front
// that splits open and throws light: the only light it has.
// Render-only and stateless: the hull is built once per kind in greybox(), motion is a hash of e.t (and e.eid when the
// sim set one), no RNG, no cached layer, so warm() has nothing to build. A frame allocates nothing.
// The leading underscore keeps this file out of both registry globs (it is not a kind).
import { TAU, hash } from '../../../core';
import { glowC } from '../midbosses';
import type { MidArt } from './index';

export interface Greybox {
  /** the home biome's tint, a CSS hex colour: the facets are this pushed dark (a crossover is retinted by drawMidCross) */
  col: string;
  /** body radius, px. Draw it the size of the kind's fit, so the terrain fit and the hitbox read true */
  r: number;
  /** telegraph strength 0..1 from the sim's own fields: the seam opens and throws light. Make it readable at phone
   *  size (spec §9): it is the only cue a greybox gives. Called every frame: no allocation. In a crossover the host
   *  tint washes it too (drawMidCross), like every kind's art */
  tell?: (e: any) => number;
}

const N = 11; // hull vertices: enough to read as a broken mass, few enough to stay angular
const M = 6; // seam points

/** '#rrggbb' scaled by f toward black, as an rgb() string (built once per kind, never per frame) */
function shade(hex: string, f: number): string {
  const v = parseInt(hex.slice(1, 7), 16) || 0;
  return `rgb(${((v >> 16) & 255) * f | 0},${((v >> 8) & 255) * f | 0},${(v & 255) * f | 0})`;
}

/** a pass-1 greybox kind's art: a dark angular mass whose telegraph is a lit split down its front */
export function greybox(g: Greybox): MidArt {
  const R = g.r;
  let s = R * 7.7;
  for (let i = 0; i < g.col.length; i++) s = (s * 31 + g.col.charCodeAt(i)) % 9973; // each kind its own hull
  // the hull: uneven radii, heavier and longer at the back (+x, away from the player), a blunt, broken front
  const hx = new Float32Array(N), hy = new Float32Array(N), fc: string[] = [], rim: boolean[] = [];
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU + (hash(s + i) - .5) * .4, back = Math.cos(a) > 0;
    // one shard jutting up off the back (i 9), the belly sagging forward (i 4): no two halves match
    const rr = R * (.74 + hash(s + i * 3.7) * .34) * (back ? 1.12 : .88) * (i === 9 ? 1.22 : i === 4 ? 1.12 : 1);
    hx[i] = Math.cos(a) * rr * 1.08;
    hy[i] = Math.sin(a) * rr * .9 + (back ? -R * .06 : R * .05);
  }
  // facets: a fan from an off-centre hub, each lit by how far it faces up (the room's only light is from above and dim)
  const ox = -R * .14, oy = -R * .1;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, mx = (hx[i] + hx[j]) * .5 - ox, my = (hy[i] + hy[j]) * .5 - oy, up = -my / Math.hypot(mx, my);
    fc.push(shade(g.col, .1 + .12 * Math.max(0, up) + hash(s + i * 5.3) * .04));
    rim.push(up > .45);
  }
  // the seam: a jagged split down the front, top to belly; nx, ny its normals, tp its taper (shut at both ends)
  const sx = new Float32Array(M), sy = new Float32Array(M), nx = new Float32Array(M), ny = new Float32Array(M), tp = new Float32Array(M);
  for (let i = 0; i < M; i++) {
    const f = i / (M - 1);
    sx[i] = R * (-.5 + f * .32 + (i % 2 ? .09 : -.05) * (hash(s + i * 9.1) + .4));
    sy[i] = R * (-.62 + f * 1.22);
    tp[i] = Math.sin(f * Math.PI) ** .7;
  }
  for (let i = 0; i < M; i++) {
    const a = Math.max(0, i - 1), b = Math.min(M - 1, i + 1), dx = sx[b] - sx[a], dy = sy[b] - sy[a], l = Math.hypot(dx, dy) || 1;
    nx[i] = -dy / l; ny[i] = dx / l;
  }
  const plate = shade(g.col, .2), rimCol = shade(g.col, .4);
  // the seam as a lens of half-width w around its line, dir +1 then back along -1: no allocation
  const lens = (c, w) => {
    c.beginPath();
    for (let i = 0; i < M; i++) { const d = w * tp[i]; i ? c.lineTo(sx[i] + nx[i] * d, sy[i] + ny[i] * d) : c.moveTo(sx[i], sy[i]); }
    for (let i = M - 2; i > 0; i--) { const d = w * tp[i]; c.lineTo(sx[i] - nx[i] * d, sy[i] - ny[i] * d); }
    c.closePath();
  };
  return {
    draw(c, e) {
      const t = e.t || 0, id = e.eid || 0, k = g.tell ? Math.max(0, Math.min(1, g.tell(e))) : 0;
      // stillness, then a hitch: one beat in ~7 of 26 frames twitches for 4 frames, timed by a hash, never a metronome
      const ph = Math.floor(t / 26), q = t - ph * 26, jt = q < 4 && hash(ph * 1.7 + id * 13.1) > .86 ? hash(ph + id) - .5 : 0;
      c.save();
      if (jt) { c.translate(jt * 2, -jt); c.rotate(jt * .08); }
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        c.fillStyle = fc[i];
        c.beginPath(); c.moveTo(ox, oy); c.lineTo(hx[i], hy[i]); c.lineTo(hx[j], hy[j]); c.closePath();
        c.fill();
      }
      // the hull's edge: near-black, then a faint tint rim only on the upward faces
      c.beginPath();
      for (let i = 0; i < N; i++) i ? c.lineTo(hx[i], hy[i]) : c.moveTo(hx[i], hy[i]);
      c.closePath();
      c.lineJoin = 'miter';
      c.lineWidth = 1.5;
      c.strokeStyle = 'rgba(4,2,3,.85)';
      c.stroke();
      c.strokeStyle = rimCol;
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i < N; i++) if (rim[i]) { const j = (i + 1) % N; c.moveTo(hx[i], hy[i]); c.lineTo(hx[j], hy[j]); }
      c.stroke();
      // machine part: a bolted plate on the back, and three ribs showing through the belly
      c.fillStyle = plate;
      c.beginPath(); c.moveTo(R * .3, -R * .42); c.lineTo(R * .78, -R * .2); c.lineTo(R * .68, R * .16); c.lineTo(R * .24, R * .02); c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(4,2,3,.8)'; c.lineWidth = 1; c.stroke();
      c.fillStyle = 'rgba(120,104,78,.8)'; // tallow bolts: a tint-coloured dot can read as a bullet
      c.fillRect(R * .36, -R * .3, 1, 1); c.fillRect(R * .62, -R * .14, 1, 1);
      c.strokeStyle = 'rgba(120,104,78,.45)'; // tallow, low: bone under skin
      c.lineWidth = 1;
      c.beginPath();
      for (let q2 = 0; q2 < 3; q2++) { const x = R * (-.02 + q2 * .2); c.moveTo(x, R * .32); c.lineTo(x + R * .12, R * .62); }
      c.stroke();
      // the seam: shut, a dark crack with a dull wound-red lip; open, wound-red lips round a hot core that throws light
      if (k <= 0) {
        c.strokeStyle = '#030102'; c.lineWidth = 2;
        c.beginPath();
        for (let i = 0; i < M; i++) i ? c.lineTo(sx[i], sy[i]) : c.moveTo(sx[i], sy[i]);
        c.stroke();
        c.strokeStyle = 'rgba(110,18,14,.55)'; c.lineWidth = .8; c.stroke();
      } else {
        const w = R * (.05 + .2 * k);
        c.fillStyle = '#4a0808';
        lens(c, w + 1.5); c.fill();
        c.fillStyle = '#b8261a';
        lens(c, w); c.fill();
        const a = c.globalAlpha;
        c.globalAlpha = a * (.35 + .65 * k);
        c.fillStyle = '#ffd49a';
        lens(c, w * .5); c.fill();
        c.globalAlpha = a;
        c.globalCompositeOperation = 'lighter';
        glowC(c, sx[2], sy[2] + R * .1, R * (.5 + 1.1 * k), '255,150,80', .2 + .55 * k);
        c.globalCompositeOperation = 'source-over';
      }
      c.restore();
    },
    // nothing cached, so no built or drop: the warm-up leaves it out of the drop pass (warmplan.ts routeKeys)
    warm: () => false,
  };
}
