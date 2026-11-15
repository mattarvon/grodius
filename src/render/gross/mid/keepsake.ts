// @ts-nocheck
// THE KEEPSAKE, pass 1 (greybox): the shared dark mass, the seam is its telegraph, and `under` draws what a seam can't:
// the fork standing in the wound (the weak spot has to be seen), the fountain's landing marks and the rest of each
// fork's fall, the throw's and the boomerang's lines, and the boomerang itself. Pass 2 is photo art (Matt is
// photographing a real doll). Render-only: $.T for motion, no RNG, no allocation. Sim: enemies/mid/keepsake.ts
import { $ } from '../../../state';
import { PH, W, ctx } from '../../../core';
import { floorAt } from '../../../world';
import { KEEP, lobFrames, riseCap } from '../../../enemies/mid/_keepsake';
import { glow } from '../../util';
import { drawFork } from '../../fork';
import { greybox } from './_greybox';

/** the seam's opening, 0-1, from the sim's own fields */
function tell(e) {
  switch (e.st) {
    case 'tell': return e.wt / KEEP.tell; //                   the brain bulging round the fork
    case 'fount': return Math.max(.4, 1 - e.wt / 24); //        still open while they fly
    case 'open': return .4; //                                  the window: the wound gapes
    case 'boom': return e.wt / KEEP.boomTel; //                 the big fork tearing loose
    case 'wail': return e.wt / KEEP.wail;
    case 'aim': return .2 + .3 * Math.min(1, e.wt / KEEP.aim);
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
  ctx.globalAlpha = locked ? .55 + .35 * a : .25 + .3 * a; // alpha, not an rgba() string: no string built per frame
  ctx.strokeStyle = locked ? '#ff503c' : '#ff8c6e';
  ctx.lineWidth = locked ? 3 : 1.2; // locked: 3 px, readable at phone size (spec §9)
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(e.la) * 560, y + Math.sin(e.la) * 560);
  ctx.stroke();
  ctx.restore();
}

/** the fork rammed in the soft spot, tines down, and the brain bulging round it: the weak spot, always shown (gone
 *  while the big fork is out in phase 2). Its handle rises with the fountain's tell */
function wound(e, k) {
  const x = e.x + KEEP.wx, y = e.y + KEEP.wy, sw = 1 + .5 * k;
  ctx.fillStyle = '#3a0a10'; // the hole
  ctx.beginPath(); ctx.ellipse(x, y + 1, 6.5 * sw, 3.2 * sw, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b86a72'; // brain pushing out of it, two lobes either side of the fork
  ctx.beginPath(); ctx.ellipse(x - 3.4, y - .5 - k, 3 * sw, 2.2 * sw, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 3.6, y - k, 2.6 * sw, 2 * sw, 0, 0, Math.PI * 2); ctx.fill();
  if (e.st !== 'fly') drawFork(ctx, x, y - 5 - 4 * k, Math.PI / 2, 1.3);
}

function under(e) {
  if (e.dead || e.gone) return;
  const st = e.st;
  wound(e, st === 'tell' ? Math.min(1, e.wt / KEEP.tell) : st === 'open' ? .3 : 0);
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
    drawFork(ctx, e.bx, e.by, $.T * .45, 2.1);
  }
}

export default greybox({ col: '#d8c8b4', r: 22, tell, under });
