// THE KEEPSAKE's forks (enemies/boss/keepsake.ts). Every fork in the fight is drawn here, so a reskin lands everywhere:
//  - the 15 px fork (the fountain, the aimed throw, and anything else drawn at scale 1): drawFork, in code, with a real
//    fork's proportions (taken from the photo below: a slim handle with a flared terminal, a 1 px neck, a bowl that
//    flares to a 5 px head, three tines over the last 29%), a 1 px near-black outline that never scales, and four steel
//    stops sampled from the baked photo fork (tools/keepsake-boss-art.json forkRamp)
//  - the forks 33 px and longer are baked from a photograph (tools/keepsake_fork.py: Museums Victoria's Walker & Hall
//    table fork, CC BY 4.0) into the boss atlas: bigFork (59 px, 16 baked spin angles, never rotated at runtime) and
//    mobFork (the hanging mobile's 33 px fork, dim or its drop tell). Both return false while the atlas loads; the
//    caller then draws drawFork at that size
// Render-only: no RNG, no allocation.
import { bf } from './gross/baked';

const KEY = 'keepsake-boss';
// the steel, sampled from the baked photo fork (forkRamp): dark / mid / light / specular, and the outline
const DARK = '#3e3734', MID = '#747170', LIGHT = '#a19f9d', SPEC = '#fcf4e7', OUT = '#060708';
/** the baked big fork's length and spin step (keepsake-boss-art.json fork.size, fork.angles) */
export const BIG_LEN = 59, BIG_ANGLES = 16;
/** the baked mobile fork's length (mfork.size): tines down from its top */
export const MOB_LEN = 33;

// the fork at scale 1, tines along +x, the bridge at 0: the terminal's end at -9, the tines' tips at +6 (the old
// line fork's extents, so every caller's anchor holds)
function body(c: CanvasRenderingContext2D): void {
  c.moveTo(-8, -1); //                                   the terminal (flared, rounded), the handle tapering to the neck
  c.arc(-8, 0, 1, -Math.PI / 2, Math.PI / 2, true);
  c.lineTo(-5, .8); c.lineTo(-1, .5); c.lineTo(.2, .5);
  c.lineTo(1.9, 2.5); c.lineTo(1.9, -2.5); //            the bowl flares to the 5 px head
  c.lineTo(.2, -.5); c.lineTo(-1, -.5); c.lineTo(-5, -.8);
  c.closePath();
}
function tine(c: CanvasRenderingContext2D, y: number): void {
  c.moveTo(1.9, y - .5); c.lineTo(5.3, y - .5); c.lineTo(6, y); c.lineTo(5.3, y + .5); c.lineTo(1.9, y + .5); c.closePath();
}

/** a fork at (x, y) pointing along angle a (tines first), s = scale (1 = the 15 px fork); the outline stays 1 px */
export function drawFork(c: CanvasRenderingContext2D, x: number, y: number, a: number, s = 1): void {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.scale(s, s);
  c.lineJoin = 'round';
  // the outline first, then the steel over its inner half: it fills the tine gaps and the seams never show
  c.beginPath(); body(c); tine(c, -2); tine(c, 0); tine(c, 2);
  c.strokeStyle = OUT; c.lineWidth = 2 / s; c.stroke();
  c.fillStyle = MID; c.fill();
  // lit from above (the -y side, before the turn): the near half light, the far half and the bowl's hollow dark
  c.fillStyle = LIGHT;
  c.beginPath(); c.moveTo(-8, -1); c.lineTo(-5, -.8); c.lineTo(-1, -.5); c.lineTo(-1, 0); c.lineTo(-8, 0); c.closePath(); c.fill();
  c.beginPath(); tine(c, -2); c.fill();
  c.fillStyle = DARK;
  c.beginPath(); c.moveTo(-8, 0); c.lineTo(-1, 0); c.lineTo(-1, .5); c.lineTo(-5, .8); c.lineTo(-8, 1); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(.2, .5); c.lineTo(1.9, 2.5); c.lineTo(1.9, .3); c.closePath(); c.fill();
  c.beginPath(); tine(c, 2); c.fill();
  c.fillStyle = SPEC; // the hot specular on the terminal: steel, not bone
  c.fillRect(-8.8, -.9, 2.2, .7);
  c.restore();
}

/** the big fork, spinning: tines along a, the nearest of the baked angles ([k] = tines down turned k x 22.5 deg) */
export function bigFork(c: CanvasRenderingContext2D, x: number, y: number, a: number, alpha = 1): boolean {
  const k = Math.round((a - Math.PI / 2) / (2 * Math.PI / BIG_ANGLES));
  if (alpha >= 1) return bf(c, KEY, 'fork', k, x, y);
  const p = c.globalAlpha;
  c.globalAlpha = p * alpha;
  const ok = bf(c, KEY, 'fork', k, x, y);
  c.globalAlpha = p;
  return ok;
}

/** a mobile fork hanging (or falling straight) tines down, its tips at (x, tip); tell: the drop tell's brighter frame */
export function mobFork(c: CanvasRenderingContext2D, x: number, tip: number, tell = false): boolean {
  return bf(c, KEY, 'mfork', tell ? 1 : 0, Math.round(x), Math.round(tip) - MOB_LEN);
}
