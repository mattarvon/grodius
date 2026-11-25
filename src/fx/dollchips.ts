// @ts-nocheck
// A mini doll head's death shards (enemies/doll.ts killDoll): flat pale vinyl chips, no blood, no decal, no bleed. They
// stay off the shared gib list on purpose: a gib bleeds, splats a blood decal where it lands and draws from the flesh
// atlas. A preallocated ring; each chip's path is a closed form of its age in sim steps ($.G.t), so it freezes with
// the pause and needs no update pass. Drawn by render/doll.ts drawDollChips.
// RULE: fx. Every draw here is srnd(), never the gameplay R().
import { $ } from '../state';
import { srnd, srr } from '../srnd';

/** chips alive at once (five heads x five chips, room for two lines dying together) */
const CN = 50;
/** the ring: wx (world x at birth), y, vx, vy, rot, vr, k (shard frame 0..2), t0 (the $.G.t of birth), l (frames) */
export const CHIPS = Array.from({ length: CN }, () => ({ on: 0, wx: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, k: 0, t0: 0, l: 0 }));
let ci = 0;
/** chip gravity, px/f^2 */
export const CHIP_G = .12;

/** five flat vinyl chips thrown from (x, y), mostly along the shot's direction dir */
export function dollChips(x, y, dir = 1) {
  const G = $.G;
  if (!G) return;
  for (let k = 0; k < 5; k++) {
    const q = CHIPS[ci];
    ci = (ci + 1) % CN;
    const a = srr(0, Math.PI * 2), sp = srr(.6, 2.2);
    q.on = 1;
    q.wx = (G.scroll || 0) + x + srr(-2, 2);
    q.y = y + srr(-2, 2);
    q.vx = Math.cos(a) * sp + dir * srr(.3, 1.2);
    q.vy = Math.sin(a) * sp - .8;
    q.rot = srnd() * Math.PI * 2;
    q.vr = srr(-.3, .3);
    q.k = k % 3;
    q.t0 = G.t | 0;
    q.l = 34 + (srnd() * 18 | 0);
  }
}
