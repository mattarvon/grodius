// @ts-nocheck
// THE KEEPSAKE, pass 2 (wip: Matt hasn't signed the art off): a bald vinyl baby-doll head, face on, from Matt's own photos
// of his own unmarked antique doll (D7, D53), baked by tools/prep_keepsake.py into sprites/keepsake@6.png (48x58 frames,
// the boss origin at frame px (24, 31): 0 eyes open, 1 half, 2 shut, the fork's slot in the split crown; 3-5 the same
// with the wound gaping) and sprites/keepsake-fork.png (the ornate silver fork, tines down). Boot art (roster `boot`):
// sprites.ts loads both at boot, so warm() has nothing to build and there is no built or drop.
// The eyes are the tell. It dozes half-lidded, drooping shut now and then, and never opens them at rest: when it wakes
// and stares (wide open) an attack is coming. `under` keeps pass 1's honest telegraphs: the fountain's landing marks and
// the rest of each fork's fall, the throw's and the boomerang's lines, and the boomerang itself.
// Render-only: e.t and hashes for motion, the midboss fx stream (../midbosses rnd) for particles, never the sim RNG,
// nothing allocated per frame. Sim: enemies/mid/keepsake.ts
import { $ } from '../../../state';
import { PH, W, ctx, hash } from '../../../core';
import { floorAt } from '../../../world';
import { KEEP, lobFrames, riseCap } from '../../../enemies/mid/_keepsake';
import { glow } from '../../util';
import { drawFork } from '../../fork';
import { spr, sprReady } from '../../../sprites';
import { drawParts, emit, fxs, GROSS, rn, rnd, snd, spray, stepParts, strand } from '../midbosses';
import { pour, trackDeath } from '../baked';
import { greybox } from './_greybox';

const K = 'keepsake', FK = 'keepsake-fork';
const OX = 24, OY = 31; //          the boss origin inside a head frame (tools/prep_keepsake.py OX, OY)
const FORK_ENTRY = 15; //            the fork sprite's y where it goes into the skull (prep_keepsake.py FORK_ENTRY)
const OPEN = 0, HALF = 1, SHUT = 2, GAPE = 3; // frame indices; + GAPE: the fork's out
const BLOOD = '#8a0c14', BLOOD_D = '#4a050a';

/** pass 1's mass, until the sprite has loaded: a hit never lands on nothing */
const FALLBACK = greybox({ col: '#d8c8b4', r: 22 });

/** the eyes: dozing at rest (half, a hash-timed droop shut), and the tell wakes it: shut a beat, half, then wide open.
 *  Open never shows at rest, so open always means an attack is coming */
function eyes(e) {
  const t = e.t || 0;
  if (e.st === 'idle') {
    if (e.wt < 10) return HALF; //                      settling back after an attack
    const cyc = Math.floor(t / 150), f = t - cyc * 150;
    return hash(cyc * 3.7 + 1) < .55 && f > 60 && f < 74 + hash(cyc) * 30 ? SHUT : HALF; // a slow droop, not every time
  }
  if (e.st === 'tell') { const k = e.wt / KEEP.tell; return k < .14 ? SHUT : k < .3 ? HALF : OPEN; }
  if (e.st === 'aim' || e.st === 'boom') return e.wt < 5 ? HALF : OPEN;
  if (e.st === 'wail') return (e.wt >> 2) & 1 && e.wt < KEEP.wail * .6 ? HALF : OPEN; // fluttering awake, then the stare
  return OPEN; //                                       the fountain, the window, the boomerang in flight
}

/** how far the fork has worked loose, 0..1: the brain pushes it up on the fountain's tell, it sits proud through the
 *  fountain and the window, and tears loose on the boomerang's */
function loose(e) {
  switch (e.st) {
    case 'tell': return e.wt / KEEP.tell;
    case 'fount': case 'open': return .6;
    case 'boom': return e.wt / KEEP.boomTel;
    default: return 0;
  }
}

const DASH = [5, 4], SOLID = []; // built once: setLineDash takes them every frame without allocating

/** an aimed line from the wound along e.la: dashed and faint while it tracks you, solid and hot once it locks */
function line(e, locked, a) {
  const x = e.x + KEEP.wx, y = e.y + KEEP.wy;
  ctx.save();
  ctx.setLineDash(locked ? SOLID : DASH);
  ctx.lineDashOffset = -$.T * .6;
  ctx.globalAlpha = locked ? .55 + .35 * a : .25 + .3 * a;
  ctx.strokeStyle = locked ? '#ff503c' : '#ff8c6e';
  ctx.lineWidth = locked ? 3 : 1.2; // locked: 3 px, readable at phone size (spec §9)
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(e.la) * 560, y + Math.sin(e.la) * 560);
  ctx.stroke();
  ctx.restore();
}

/** the big fork along angle a (tines first): the baked silver fork (drawn tines down, so turned a - 90 deg), or pass
 *  1's line fork until it has loaded */
function bigFork(x, y, a) {
  if (!spr(ctx, FK, 0, x, y, { rot: a - Math.PI / 2 })) drawFork(ctx, x, y, a, 2.1);
}

function under(e) {
  if (e.dead || e.gone) return;
  const st = e.st;
  // the fountain: a mark on each column's landing point, from the tell's first frame until that fork has landed
  if ((st === 'tell' || st === 'fount') && e.fn) {
    const k = st === 'tell' ? Math.min(1, e.wt / KEEP.tell) : 1, pul = .7 + .3 * Math.sin($.T * .35);
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < e.fn; i++) {
      if (st === 'fount' && e.wt >= e.fl[i]) continue;
      const x = e.fx[i], y = e.fy;
      // its velocity at the plane: the sim's, once launched; before that, from its planned rise and the wound now
      let vx = e.fv[i], vy = e.fw[i];
      if (e.fl[i] >= 1e9) {
        const ly = e.y + KEEP.wy - 4, u = riseCap(e.fq[i], ly), T = lobFrames(u, y - ly);
        vx = (x - e.x - KEEP.wx) / T; vy = -u + .025 * T;
      }
      // its real path: the last 40 f of its drop into the mark, then the rest of its fall to the floor; faint, dashed.
      // A fork crosses the mark's x only at the mark's y (it keeps its sideways speed), so a vertical line would lie
      ctx.globalAlpha = (.14 + .2 * k) * pul;
      ctx.strokeStyle = '#dce4ec';
      ctx.lineWidth = 1;
      ctx.setLineDash(DASH);
      ctx.beginPath(); ctx.moveTo(x - vx * 40, y - vy * 40 + 20); // t = -40: y + vy t + .0125 t^2
      for (let t = -34; t <= 0; t += 6) ctx.lineTo(x + vx * t, y + vy * t + .0125 * t * t);
      ctx.lineTo(x, y);
      for (let t = 6; t <= 240; t += 6) { // the glob arc below the plane (.025 px/f^2), until it meets the floor or leaves
        const px = x + vx * t, py = y + vy * t + .0125 * t * t, fl = Math.min(PH - 2, floorAt(px + $.G.scroll));
        if (py >= fl || px < 0 || px > W) { ctx.lineTo(px, Math.min(py, fl)); break; }
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash(SOLID);
      ctx.globalAlpha = (.45 + .5 * k) * pul;
      ctx.strokeStyle = '#ff6048';
      ctx.lineWidth = 3; // 3 px, readable at phone size (spec §9)
      ctx.beginPath(); ctx.moveTo(x - 5, y - 6); ctx.lineTo(x, y - 1); ctx.lineTo(x + 5, y - 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 6, y + 2); ctx.lineTo(x + 6, y + 2); ctx.stroke();
    }
    ctx.restore();
  }
  if (st === 'aim') line(e, e.wt >= KEEP.aim - KEEP.lock, e.wt / KEEP.aim);
  if (st === 'boom') line(e, e.wt >= KEEP.boomTel - KEEP.boomLock, e.wt / KEEP.boomTel);
  if (st === 'fly') { // the big fork, spinning, in the enemy-fire glow every enemy shot wears (render/hud.ts drawEShots)
    line(e, true, 1);
    ctx.globalCompositeOperation = 'lighter';
    glow(e.bx, e.by, 20, '150,255,40', .55 * (.75 + .25 * Math.sin($.T * .5)));
    ctx.globalCompositeOperation = 'source-over';
    bigFork(e.bx, e.by, $.T * .45);
  }
}

// ---------------- the head ----------------
/** the fork standing in the split, tines buried: only what's above the skull's surface at the slot shows */
function wedged(c, e, k, bx, by) {
  const x = KEEP.wx + bx, y = KEEP.wy + 1 + by, rise = Math.round(4 * k);
  const lean = .14 + (k > .6 ? (hash(e.t >> 1) - .5) * .1 * k : 0); // working loose: it rattles
  c.save();
  c.beginPath();
  c.rect(x - 14, y - 40, 28, 40); // the tines and the buried neck stay inside
  c.clip();
  c.translate(x, y);
  c.rotate(lean);
  if (!spr(c, FK, 0, 0, -FORK_ENTRY - rise, { ax: .5, ay: 0 })) drawFork(c, 0, -5 - rise, Math.PI / 2, 1.3);
  c.restore();
}

/** a dead KEEPSAKE: the kill word is PUT TO BED, so its eyes are shut; the pour comes out of the crown */
const DEATH = { k: K, body: false, len: 80, gore: (x, y, age) => pour(x + KEEP.wx, y + KEEP.wy + 4, age, { w: 8, h: 6, jets: 6, len: 70, meat: 10, rope: 3 }) };
// where the wound weeps from, boss-local: down the forehead from the split's lip (x, y, length, period)
const SEEP = [[-1, -21, 5, 61], [4, -20, 7, 47], [-4, -20, 4, 83], [6, -21, 6, 71]];

function drawKeepsake(c, e) {
  const s = fxs(e), t = e.t || 0;
  stepParts(s);
  trackDeath(e, DEATH);
  if (!sprReady(K)) { FALLBACK.draw(c, e); return; }
  if (e.dead || e.hp <= 0) { spr(c, K, SHUT + GAPE, -OX, -OY, { ax: 0, ay: 0 }); return; } // gore.ts's split halves
  const gape = e.st === 'fly', ev = s.ev;
  // ---- state edges: the spurts a still frame can't carry ----
  if (ev === 'tell>fount') spray(s, e.x + KEEP.wx, e.y + KEEP.wy - 2, 8, BLOOD, 1.6, 1.1, 1.2);
  if (ev === 'boom>fly') { spray(s, e.x + KEEP.wx, e.y + KEEP.wy - 1, 14, BLOOD, 2, 1.3, 1.6); snd('gross_gush', .7, .3); }
  if (ev === 'fly>idle') { spray(s, e.x + KEEP.wx, e.y + KEEP.wy - 1, 6, BLOOD_D, 1.2, 1, .8); snd('gross_slosh', .5, .3); }
  // ---- motion, in whole px (pixel art: a sub-pixel offset shimmers): a slow bob at rest that hitches now and then,
  // a tremble on the tell, a shudder on the wail ----
  let bx = 0, by = Math.round(Math.sin(t * .028 + (hash(Math.floor(t / 230)) - .5)) * 1.2);
  if (e.st === 'tell' && e.wt > KEEP.tell * .3 && hash(t >> 1) > .6) bx = hash(t) < .5 ? -1 : 1;
  if (e.st === 'wail') { const k = e.wt / KEEP.wail; bx = Math.round((hash(t) - .5) * 3 * k); by += Math.round((hash(t + 7) - .5) * 2 * k); }
  spr(c, K, eyes(e) + (gape ? GAPE : 0), bx - OX, by - OY, { ax: 0, ay: 0 });
  if (!gape) wedged(c, e, loose(e), bx, by);
  // ---- live wet: the wound weeps down the forehead, and gushes while the fork is out ----
  const n = gape ? 4 : e.st === 'open' || e.st === 'fount' ? 3 : 2;
  for (let i = 0; i < n; i++) { const h = SEEP[i]; strand(c, s, e, 90 + i, h[0] + bx, h[1] + by, h[2] + (gape ? 3 : 0), .9, 'rgba(110,6,14,.9)', gape ? h[3] >> 1 : h[3], BLOOD, .4); }
  if (gape && rnd() < .55 * s.dt * GROSS) emit(s, e.x + KEEP.wx + rn(-2, 2), e.y + KEEP.wy - 1, rn(-.9, .9), rn(-2.4, -1), rnd() < .7 ? BLOOD : BLOOD_D, rn(.8, 1.4), 0, 60);
  if (e.st === 'open' && rnd() < .12 * s.dt * GROSS) emit(s, e.x + KEEP.wx + rn(-3, 3), e.y + KEEP.wy, rn(-.4, .4), rn(-1, -.3), BLOOD, rn(.7, 1.1), 0, 50);
  if (e.flash && rnd() < .5 * GROSS) emit(s, e.x + KEEP.wx + rn(-4, 4), e.y + KEEP.wy + rn(-1, 2), rn(-1.2, 1.2), rn(-1.8, -.4), BLOOD, rn(.7, 1.2), 0, 50);
  drawParts(c, s, e);
}

/** the kind's art for the registry (./index.ts). A boot kind (roster `boot`): sprites.ts loads its PNGs at boot, so
 *  there is nothing to warm and no built or drop */
export default { draw: drawKeepsake, warm: () => false, under };
