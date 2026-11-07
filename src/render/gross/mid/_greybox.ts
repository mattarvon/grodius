// @ts-nocheck
// Pass 1's body (build plan LS2 art gate): "a procedural blob in the biome tint" for a `wip` kind, so a pool lane can fly
// its mechanic before its art exists. A kind's art file is then one line:
//   export default greybox({ col: '#7ab8d8', r: 20, tell: (e) => (e.st === 'tel' ? e.wt / 40 : 0) });
// Render-only and stateless: the wobble is a function of e.t, no RNG, no cached layer, so warm() has nothing to build.
// The leading underscore keeps this file out of both registry globs (it is not a kind).
import { TAU } from '../../../core';
import { blob, glowC } from '../midbosses';
import type { MidArt } from './index';

export interface Greybox {
  /** its fill, a CSS hex colour: the home biome's tint (a crossover is retinted by drawMidCross on top) */
  col: string;
  /** body radius, px. Draw it the size of the kind's fit, so the terrain fit and the hitbox read true */
  r: number;
  /** telegraph strength 0..1 from the sim's own fields: the rim brightens and a glow grows. Make it readable at
   *  phone size (spec §9): it is the only cue a greybox gives */
  tell?: (e: any) => number;
}

// the wobble's clock, set before blob() calls rim: one shared function, so a frame allocates nothing
let T = 0;
const rim = (a: number, i: number) => 1 + Math.sin(a * 3 + T * .05) * .06 + Math.sin(a * 5 - T * .03 + i) * .03;

/** a pass-1 greybox kind's art: a wobbling blob with one eye that tracks its telegraph */
export function greybox(g: Greybox): MidArt {
  return {
    draw(c, e) {
      const t = e.t || 0, k = g.tell ? Math.max(0, Math.min(1, g.tell(e))) : 0;
      if (k) {
        c.globalCompositeOperation = 'lighter';
        glowC(c, 0, 0, g.r * (1.2 + k), '255,240,200', .15 + .45 * k);
        c.globalCompositeOperation = 'source-over';
      }
      T = t;
      blob(c, 24, g.r, rim);
      c.fillStyle = g.col;
      c.fill();
      c.lineWidth = 2 + k * 2;
      const a = c.globalAlpha;
      if (k) c.globalAlpha = a * (.4 + .6 * k);
      c.strokeStyle = k ? '#fff0c8' : 'rgba(0,0,0,.45)';
      c.stroke();
      c.globalAlpha = a;
      // one eye, so facing and the telegraph read without art
      const er = g.r * .28;
      c.fillStyle = '#f0e8d8';
      c.beginPath();
      c.arc(-g.r * .3, -g.r * .15, er, 0, TAU);
      c.fill();
      c.fillStyle = k ? '#ff3a2a' : '#1a0a0a';
      c.beginPath();
      c.arc(-g.r * .3 - er * .3, -g.r * .15, er * (.45 + .25 * k), 0, TAU);
      c.fill();
    },
    warm: () => false, // nothing cached: no layer to build or drop
    built: () => true,
    drop() {},
  };
}
