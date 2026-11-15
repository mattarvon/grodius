// @ts-nocheck
// THE KEEPSAKE, pass 1 (greybox): the shared dark mass, the seam is its telegraph, and `under` draws what a seam can't:
// the fountain's landing marks, the throw's and the boomerang's lines, and the boomerang itself. Pass 2 is photo art
// (Matt is photographing a real doll). Render-only: $.T for motion, no RNG, no allocation. Sim: enemies/mid/keepsake.ts
import { $ } from '../../../state';
import { PH, ctx } from '../../../core';
import { KEEP } from '../../../enemies/mid/_keepsake';
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
  ctx.lineWidth = locked ? 2 : 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(e.la) * 560, y + Math.sin(e.la) * 560);
  ctx.stroke();
  ctx.restore();
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
      // the column it comes down through: a faint drop line, then a bright chevron and a ground tick on the plane
      ctx.globalAlpha = (.12 + .18 * k) * pul;
      ctx.strokeStyle = '#dce4ec';
      ctx.lineWidth = 1;
      ctx.setLineDash(DASH);
      ctx.beginPath(); ctx.moveTo(x, Math.max(4, y - 70)); ctx.lineTo(x, Math.min(PH - 2, y + 26)); ctx.stroke();
      ctx.setLineDash(SOLID);
      ctx.globalAlpha = (.45 + .5 * k) * pul;
      ctx.strokeStyle = '#ff6048';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 5, y - 6); ctx.lineTo(x, y - 1); ctx.lineTo(x + 5, y - 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 6, y + 2); ctx.lineTo(x + 6, y + 2); ctx.stroke();
    }
    ctx.restore();
  }
  if (st === 'aim') line(e, e.wt >= KEEP.aim - KEEP.lock, e.wt / KEEP.aim);
  if (st === 'boom') line(e, e.wt >= KEEP.boomTel - KEEP.boomLock, e.wt / KEEP.boomTel);
  if (st === 'fly') { line(e, true, 1); drawFork(ctx, e.bx, e.by, $.T * .45, 2.1); } // the big fork, spinning
}

export default greybox({ col: '#d8c8b4', r: 22, tell, under });
