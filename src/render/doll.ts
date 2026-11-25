// @ts-nocheck
// MINI DOLL HEADS' art (sim: enemies/doll.ts). sprites/dollhead@4.png (tools/prep_dollheads.py, 16x16 frames facing
// left: 0 shut, 1 half, 2 open = the tell, 3 the lunge, tipped face-first) and dollshard@3.png (three flat 5x5 vinyl
// shards). Frames are STATES, not a loop: shut while drifting with a rare half-lidded blink, the clack shut -> half ->
// open through the tell, 3 for the lunge. Until the strips load: a code-drawn head, the vinyl dimmed to ~75% with a 1 px
// dark outline and painted eyes that open, so it never reads as a bright bullet. Render-only: srnd() and hashes, never R()
import { $ } from '../state';
import { TAU } from '../core';
import { spr, sprReady } from '../sprites';
import { dollFrame } from '../enemies/doll';
import { CHIPS, CHIP_G } from '../fx/dollchips';

const VIN = '#a08f79', VIN_L = '#b8a284', VIN_D = '#6e5e4c', LINE = '#241a14', IRIS = '#2c3442';

/** the frame to draw: the sim's state frame, plus a 6 f half-lidded blink every ~2 s while drifting (by index, no draw) */
function frameOf(e) {
  const f = dollFrame(e);
  return f === 0 && e.st !== 'tell' && (e.t + (e.i || 0) * 37) % 130 < 6 ? 1 : f;
}

/** one doll head at the drawEnemy origin */
export function drawDoll(c, e) {
  const f = frameOf(e);
  if (sprReady('dollhead') && spr(c, 'dollhead', f, 0, 0)) return;
  // the fallback head: a dimmed vinyl ball, a darker jaw shade, a curl on the crown, eyes by frame
  c.save();
  if (f === 3) c.rotate(-.25);
  c.fillStyle = LINE;
  c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill();
  c.fillStyle = VIN;
  c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill();
  c.fillStyle = VIN_D;
  c.beginPath(); c.arc(.5, 2.5, 4.2, .1, Math.PI - .1); c.fill(); // the shade under the cheeks
  c.fillStyle = VIN_L;
  c.fillRect(-2, -5, 3, 1); // the crown's dull sheen
  c.fillStyle = VIN_D;
  c.fillRect(1, -7, 2, 1); c.fillRect(2, -8, 1, 1); // the moulded curl
  c.fillStyle = LINE;
  for (const ex of [-4, -.5]) {
    if (f === 0) c.fillRect(ex, -.5, 2, 1); // shut: the painted lashes
    else if (f === 1) { c.fillRect(ex, -1, 2, 1); c.fillStyle = IRIS; c.fillRect(ex + .5, 0, 1, 1); c.fillStyle = LINE; } // half
    else { c.fillStyle = '#d9d2c4'; c.fillRect(ex, -1.5, 2, 2); c.fillStyle = IRIS; c.fillRect(ex, -1, 1.5, 1.5); c.fillStyle = LINE; } // open
  }
  c.fillStyle = '#6a3a34';
  c.fillRect(-2.5, 3, 1.5, 1); // the little painted mouth (no teeth)
  c.restore();
}

/** the shards of the heads that died (fx/dollchips.ts): flat pale chips tumbling under gravity, fading out. Call once a
 *  frame in world space (render/hud.ts drawWorld) */
export function drawDollChips(c) {
  const G = $.G;
  if (!G) return;
  const sh = sprReady('dollshard');
  for (const q of CHIPS) {
    if (!q.on) continue;
    const a = (G.t | 0) - q.t0;
    if (a < 0 || a > q.l) { q.on = 0; continue; }
    const x = q.wx + q.vx * a - (G.scroll || 0), y = q.y + q.vy * a + .5 * CHIP_G * a * a, rot = q.rot + q.vr * a;
    const al = Math.min(1, (q.l - a) / 12);
    if (sh) spr(c, 'dollshard', q.k, x, y, { rot, a: al });
    else {
      c.save();
      c.globalAlpha *= al;
      c.translate(x, y); c.rotate(rot);
      c.fillStyle = LINE; c.fillRect(-2, -1.5, 4, 3);
      c.fillStyle = q.k === 1 ? VIN : VIN_L; c.fillRect(-1.5, -1, 3, 2);
      c.restore();
    }
  }
}
