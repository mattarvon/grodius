// @ts-nocheck
// =====================================================================
//  MINI DOLL HEADS (Matt, 2026-11-25: "way too many flayers. we need more variety ... mini baby doll heads ... spread
//  the doll heads everywhere"). The rest of the crew kid's toy box, swallowed with THE KEEPSAKE (D55,
//  enemies/boss/keepsake.ts): small vinyl heads with sleep eyes. Never a body or a child, no teeth, no bone, no blood.
//
//  A Gradius "Fan"-style group: five heads (fixed on every tier: GR rule 15, tier.ts header) in from the right in a loose
//  bobbing line, DOLL.gap apart, drifting left with a sine bob. Popcorn: one bolt at every kit (spawn.ts POPCORN, gate
//  R2). The tell: once a head is on screen and ahead of the ship, its eyes clack open over DOLL.tell frames (shut, half,
//  open), each head at least DOLL.stagger frames after the last one in its group. Then the LUNGE: the ship's y locks as
//  the tell ends, and the head dashes at that height (DOLL.lvy a frame) while still flying left (DOLL.lvx), on off the
//  screen. CONTACT ONLY: a doll never fires (no eshoot anywhere in this file; elite.ts NO keeps the pustule shot off).
//  Normal is already too hard for Matt and friends (2026-11-25), so the heads add variety, not pressure: slow, telegraphed,
//  committed to a line the ship has seen.
//
//  Sim: frame counters and spawn fields only, no R() in the arm (the spawner draws none either). Sound: audio's sample()
//  and sfx (ar(), never R()). Shards: fx/dollchips.ts (srnd). Art: render/doll.ts.
// =====================================================================
import { $ } from '../state';
import { PH, W, clamp } from '../core';
import { ceilAt, floorAt } from '../world';
import { bandClamp } from '../terrainb';
import { sample, sfx } from '../audio';
import { dollChips } from '../fx/dollchips';
import { mk } from './spawn';

/** the doll heads' tuning (the DEPTH-table pattern). Probe: tests/unit/doll.test.ts; the pilot reads dollAt below */
export const DOLL = {
  n: 5, //        heads in a group: fixed on every tier (GR rule 15 forbids tiers changing formation size)
  gap: 16, //     px between heads in the line (Gradius's Fan spacing at this scale)
  x0: 16, //      the first head starts this far past the right edge (formation()'s W + 16)
  vx: 1.6, //     px/f drifting left: slower than a drone (1.75 sine), so a line reads before it acts
  amp: 10, //     px sine bob
  bobW: .07, //   rad/f: a 90 f bob
  bobPh: .9, //   rad between neighbours: the line ripples instead of bobbing as a bar
  pad: 12, //     px kept off the ceiling and floor (hatch()'s band pad)
  inX: 24, //     a head may start its tell only once it is this far inside the right edge (fully on screen, ~25 f in)
  ahead: 40, //   ...and only while it is more than this far ahead of the ship (x > ship.x + 40)
  tell: 24, //    f: the eyes clack open, shut -> half -> open (>= 20 f, the D59 tell rule for a contact attack)
  stagger: 12, // f: the least gap between two tells in one group (the heads go one by one, never as a wall)
  lvx: 2.2, //    px/f left during the lunge
  lvy: 2, //      px/f toward the locked y during the lunge
  cull: 16 //     px past the left edge (or 30 off the top / bottom): gone, not killed (no group credit)
};
/** the head's sprite frame by state (sprites/dollhead@4.png: 0 shut, 1 half, 2 open, 3 lunge) */
export const dollFrame = (e) => (e.st === 'lunge' ? 3 : e.st === 'tell' ? (e.wt < DOLL.tell / 3 ? 0 : e.wt < DOLL.tell * 2 / 3 ? 1 : 2) : 0);

/** the ceiling / floor band at screen x: a head's y is kept DOLL.pad inside it (a narrow passage: its middle) */
function band(x, y) {
  const wx = $.G.scroll + x, c = ceilAt(wx) + DOLL.pad, f = floorAt(wx) - DOLL.pad;
  return c <= f ? clamp(y, c, f) : (c + f) / 2;
}

/** a group of n doll heads (n defaults to 5 and does not scale with tier or power) in from the right at lane y, in a
 *  loose bobbing line. The group object {n, killed} rolls the group capsule when the line is cleared (update.ts
 *  killEnemy grpDrops). No R() drawn (mk() draws none either: no capsule on a head) */
export function dolls(y, n = DOLL.n) {
  const g = { n, killed: 0 };
  for (let i = 0; i < n; i++) {
    const x = W + DOLL.x0 + i * DOLL.gap, wx = $.G.scroll + x;
    let y0 = bandClamp(y, wx, ceilAt(wx), floorAt(wx), DOLL.pad + DOLL.amp); // a movement B band (short: unchanged)
    y0 = clamp(y0, DOLL.pad + DOLL.amp, PH - DOLL.pad - DOLL.amp);
    const e = mk('doll', x, y0 + Math.sin(i * DOLL.bobPh) * DOLL.amp, { group: g, i, y0, st: 'drift', wt: 0, hitSnd: dollHitSnd });
    e.y0 += e.y - (y0 + Math.sin(i * DOLL.bobPh) * DOLL.amp); // mk()'s S5 shift off the ship moves the bob's centre with it
  }
  return g;
}

/** the doll arm (update.ts updEnemy 'doll'), once a frame */
export function updDoll(e) {
  const P = $.P, g = e.group;
  if (e.st === 'lunge') {
    e.x -= DOLL.lvx;
    e.y = band(e.x, e.y + clamp(e.ly - e.y, -DOLL.lvy, DOLL.lvy));
  } else {
    e.x -= DOLL.vx;
    e.y = band(e.x, e.y0 + Math.sin(e.t * DOLL.bobW + e.i * DOLL.bobPh) * DOLL.amp);
    if (e.st === 'tell') {
      if (++e.wt >= DOLL.tell) { // the lock: the ship's y as the tell ends, inside the band the head flies through
        e.st = 'lunge';
        e.ly = band(e.x, P && P.alive ? P.y : e.y);
        sfx.squish(); // the soft push-off (audio only)
      }
    } else if (P && P.alive && e.x < W - DOLL.inX && e.x > P.x + DOLL.ahead && (!g || g.tt == null || $.G.t - g.tt >= DOLL.stagger)) {
      e.st = 'tell';
      e.wt = 0;
      if (g) g.tt = $.G.t;
      sample('keep_clack', { vol: .35, rate: 1.6, spread: .08 }); // the sleep eyes clack open (THE KEEPSAKE's clack, smaller)
    }
  }
  if (e.x < -DOLL.cull || e.y < -30 || e.y > PH + 30) e.dead = true;
}

/** where a doll head will be t frames from now (screen px), for the pilot's threat model (tools/pilot.mjs). py: the
 *  ship's y now, the pilot's guess at the lock of a head still in its tell. Ignores the band clamp. Pure */
export function dollAt(e, t, py) {
  const bob = (u) => e.y0 + Math.sin((e.t + u) * DOLL.bobW + e.i * DOLL.bobPh) * DOLL.amp;
  if (e.st === 'lunge') { const d = e.ly - e.y; return [e.x - DOLL.lvx * t, e.y + Math.sign(d) * Math.min(Math.abs(d), DOLL.lvy * t)]; }
  if (e.st !== 'tell') return [e.x - DOLL.vx * t, bob(t)];
  const tl = Math.max(0, DOLL.tell - e.wt);
  if (t <= tl) return [e.x - DOLL.vx * t, bob(t)];
  const x1 = e.x - DOLL.vx * tl, y1 = bob(tl), d = py - y1, u = t - tl;
  return [x1 - DOLL.lvx * u, y1 + Math.sign(d) * Math.min(Math.abs(d), DOLL.lvy * u)];
}

/** e.hitSnd (roster.ts midHitSnd): a non-lethal hit is the vinyl thud; a lethal one stays quiet for the death's own */
function dollHitSnd(e) {
  if (e.hp > 0) sample('keep_thud', { vol: .45, rate: 1.5 }) || sfx.tink();
  return true;
}

/** the death (update.ts killEnemy): a dull vinyl thud, a short rubber squeak, flat pale shard chips. No blood, no gore */
export function killDoll(e, dir = 1) {
  dollChips(e.x, e.y, dir);
  sample('keep_thud', { vol: .55, rate: 1.4 }) || sample('thud', { vol: .4, rate: 1.6 });
  sfx.squeak();
}
