// Title hero: THE KEEPSAKE's head (Matt 2026-11-20: "love the baby doll head on the title"), in ROT's place
// (titlelayout.ts TITLE_HERO). Baked at title resolution by tools/prep_keepsake_title.py from Matt's doll photos and the
// photo fork (src/sprites/title/doll_*.png + doll.json): a soft dark halo, the sphere-lit face, the sleep eyes and the wound
// with its fork at four rises. Drawn like ROT, on the display canvas at device resolution through the eye queue
// (eyes.ts drawEyeQ's `draw` hook), except the halo, which goes on the low-res canvas under the drips and the title's
// text. Imply-only (D46/D53): a toy and its wound.
//  - idle: it dozes (titledoze.ts titleDoze, a pure function of $.T: the title rig and a resume see the same frame)
//  - DESCEND (menus.ts startRun -> armTitleOut): the run starts at once, as it always did. The last title frame is kept,
//    and over the run's first frames (titledoze.ts TOUT: 30 frames, half a second) it is drawn on top with the eyes
//    snapped open and the fork working up out of the wound, held, then faded off the run. Render only: no sim frame waits
// Render only: srnd for the drips, never the sim RNG; nothing allocated per frame once the layers have loaded.
import { $ } from '../state';
import { H, W, cv, ctx } from '../core';
import { srnd, srr } from '../srnd';
import { drops } from '../world';
import { EYEQ } from './eyes';
import { light } from './util';
import { TITLE } from '../titlelayout';
import { onDescend } from '../menus';
import { HALF, TOUT, titleDoze, titleOutPose } from './titledoze';
import LAY from '../sprites/title/doll.json';

const URLS = import.meta.glob('../sprites/title/doll_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const IMG: Record<string, HTMLImageElement> = {};
let warmed = false;
/** start loading the layers (warmup.ts, and the first title frame) */
export function warmTitleDoll(): boolean {
  if (warmed || typeof Image === 'undefined') return false;
  warmed = true;
  for (const [p, u] of Object.entries(URLS)) {
    const m = p.match(/doll_(\w+)\.png$/);
    if (!m) continue;
    const im = new Image();
    im.src = u;
    IMG[m[1]] = im;
  }
  return false;
}
const ready = (n: string) => !!IMG[n] && IMG[n].complete && IMG[n].naturalWidth > 0;
export const titleDollReady = () => ready('face') && ready('eye_half') && ready('wound_0');

const L = LAY.layers as Record<string, { off: number[]; size: number[]; px: number }>;
const EYE_L = ['eye_half', 'eye_shut', 'eye_open'];
const RISE_L = LAY.rises.map((r: number) => 'wound_' + r);

/** one layer at device (X, Y) = the head's origin, K device px per title px */
function layer(D: CanvasRenderingContext2D, n: string, X: number, Y: number, K: number) {
  if (!ready(n)) return;
  const l = L[n], k = K / l.px;
  D.drawImage(IMG[n], X + l.off[0] * k, Y + l.off[1] * k, l.size[0] * k, l.size[1] * k);
}

// the head in the eye queue: one object, rewritten each frame
const POSE = { eye: HALF, jy: 0 };
const Q = { x: 0, y: 0, r: 0, al: 1, eye: HALF, rise: 0, draw: drawHi };
function drawHi(D: CanvasRenderingContext2D, X: number, Y: number) {
  const K = $.DK;
  layer(D, 'face', X, Y, K);
  layer(D, EYE_L[Q.eye], X, Y, K);
  layer(D, RISE_L[Q.rise], X, Y, K);
}

/** the title's hero for this frame (screens.ts drawTitle, in ROT's place): the halo and the drips on the low-res canvas,
 *  the head queued for the display canvas */
export function drawTitleDoll() {
  warmTitleDoll();
  if (!titleDollReady()) return;
  const t = $.T, s = TITLE.doll.s, x = TITLE.doll.x, y = TITLE.doll.y;
  titleDoze(t, POSE);
  const hy = y + POSE.jy;
  // the halo: the head's own shadow in the scene, under the drips and the text
  if (ready('halo')) {
    const h = L.halo, k = 1 / h.px, sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(IMG.halo, x + h.off[0] * k, hy + h.off[1] * k, h.size[0] * k, h.size[1] * k);
    ctx.imageSmoothingEnabled = sm;
  }
  light(x - 10, hy - 40, 120, .35);
  // drips in the title's own style (world drops, gore.ts), off the jaw and the tear tracks, as ROT's fell off its underside
  if (srnd() < .06) drops.push({ x: x + srr(-22, 18) * s, y: hy + srr(40, 52) * s, px: 0, py: 0, vx: 0, vy: srr(.3, 1), s: 1, c: srnd() < .6 ? 0 : 1, l: 300 });
  if (srnd() < .03) drops.push({ x: x + (srnd() < .5 ? -18 : 18) * s + srr(-2, 2), y: hy + 14 * s, px: 0, py: 0, vx: 0, vy: srr(.2, .6), s: 1, c: 0, l: 300 });
  Q.x = x; Q.y = hy; Q.r = 170; Q.al = 1; Q.eye = POSE.eye; Q.rise = 0;
  EYEQ.push(Q);
}

// ---- DESCEND: the last title frame, its eyes snapped open, over the run's first half second
let SNAP: HTMLCanvasElement | null = null, outT = -1, outY = 0, flat = false;
const OP = { rise: 0, a: 1 };
const QO = { x: W / 2, y: H / 2, r: 1e5, al: 1, draw: drawOut };
function drawOut(D: CanvasRenderingContext2D) {
  if (!SNAP) return;
  D.drawImage(SNAP, 0, 0, SNAP.width, SNAP.height, 0, 0, W * $.DK, H * $.DK);
  if (flat) return;
  const K = $.DK, X = TITLE.doll.x * K, Y = outY * K;
  layer(D, 'eye_open', X, Y, K);
  layer(D, RISE_L[OP.rise], X, Y, K);
}
/** once the fork is up, paint the open eyes and the risen fork into the kept frame, so the fade is one layer (two
 *  translucent layers would let the dozing lids show through the open eyes) */
function flatten() {
  const C = SNAP!.getContext('2d')!, K = SNAP!.width / W, X = TITLE.doll.x * K, Y = outY * K;
  C.imageSmoothingEnabled = true;
  C.imageSmoothingQuality = 'high';
  layer(C, 'eye_open', X, Y, K);
  layer(C, RISE_L[RISE_L.length - 1], X, Y, K);
  flat = true;
}
/** DESCEND pressed on the title (menus.ts startRun, before newGame): keep the frame on screen for the snap. Nothing to
 *  do off the browser (the unit tests), or before the head is in */
export function armTitleOut() {
  if (typeof document === 'undefined' || !cv || $.state !== 'title' || !titleDollReady()) return;
  if (!SNAP) SNAP = document.createElement('canvas');
  const C = cv as HTMLCanvasElement;
  SNAP.width = C.width; SNAP.height = C.height;
  SNAP.getContext('2d')!.drawImage(C, 0, 0);
  outT = $.T;
  flat = false;
  outY = TITLE.doll.y + titleDoze($.T, POSE).jy;
}
onDescend(armTitleOut);
/** each frame (screens.ts render, every state): the snap while it runs, queued last so it draws over the run */
export function drawTitleOut() {
  if (outT < 0) return;
  const f = $.T - outT;
  if (f < 0 || f >= TOUT.end || $.state === 'title') { // done (or back on the title): let the snapshot go
    outT = -1;
    if (SNAP) { SNAP.width = SNAP.height = 0; }
    return;
  }
  titleOutPose(f, OP);
  if (f >= TOUT.hold && !flat) flatten();
  QO.al = OP.a;
  EYEQ.push(QO);
}
