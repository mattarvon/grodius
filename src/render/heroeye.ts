// Title hero: the ROT eye (concept #7, Matt 2026-11-08), rebuilt live from layers baked by tools/gen_eyes.py so the lens
// can move. The baked ball and lens hold no sphere lighting (rot_shade and rot_spec do, and those stay put), so the eye
// looks round wherever the lens goes. The layout and silhouette come from sprites/rot_layout.json, generated with the sprites.
import { $ } from '../state';
import { SPR, sprReady } from '../sprites';
import ROT from '../sprites/rot_layout.json'; // tools/gen_eyes.py: outline = silhouette radius by angle (clockwise on screen from +x), half and lensHalf = layer half-widths, gaze = the lens offset baked in; all in ball radii
const ROT_OUTLINE: number[] = ROT.outline, ROT_HALF: number = ROT.half, ROT_LENS_HALF: number = ROT.lensHalf, ROT_GAZE_X: number = ROT.gazeX, ROT_GAZE_Y: number = ROT.gazeY;

const TAU = Math.PI * 2, N = ROT_OUTLINE.length;
const ROLL = .12;       // the ball rolls this fraction of the lens's travel: enough to read as one solid thing turning
const FORE = .28;       // lens foreshortening at one ball radius off centre
const SEP = 'rgba(120,104,70,'; // tallow separator: lifts the silhouette off the black
const MEM = 'rgba(150,135,95,.55)', MEM_LIP = 'rgba(24,16,8,.75)';
const SNAP = .94; // of a strand's cycle: the rest is the fall, short, so a loose bead is rare
const DROOL_FLOOR = 1.29; // ball radii below the centre: game y 231 at the title's ey and r, where the credits start
const DROOL = 'rgba(122,104,48,.30)', DROOL_E = 'rgba(176,158,96,.40)', BEAD = 'rgba(138,112,44,.55)', BEAD_G = 'rgba(226,216,176,.7)';
const RIM = 'rgba(10,6,3,.6)', STANDIN = '#231d13';
const PX = new Float32Array(N), PY = new Float32Array(N);

/** nothing to warm: the layers are sprites now. Kept for warmup.ts and the rigs */
export function warmHeroEye() { return false; }

/** this frame's silhouette: the baked lumps, a slow half-amplitude wobble, and the jiggle on a hitch */
function fillOutline(r: number, t: number, jig: number) {
  for (let k = 0; k < N; k++) {
    const th = k / N * TAU;
    const rr = r * (ROT_OUTLINE[k] + .008 * Math.sin(3 * th + t * .045) + .006 * Math.sin(5 * th - t * .063 + 1) + .0035 * Math.sin(9 * th + t * .11) + jig * .05 * Math.sin(4 * th + t * .5));
    PX[k] = Math.cos(th) * rr;
    PY[k] = Math.sin(th) * rr;
  }
}
function tracePath(D: CanvasRenderingContext2D) {
  D.beginPath();
  D.moveTo(PX[0], PY[0]);
  for (let k = 1; k < N; k++) D.lineTo(PX[k], PY[k]);
  D.closePath();
}

// the glow's gradient is only rebuilt when the eye's device size changes
let GLOW: CanvasGradient | null = null, glowR = -1;
function glowBehind(D: CanvasRenderingContext2D, r: number) {
  if (glowR !== r) {
    GLOW = D.createRadialGradient(0, 0, r * .95, 0, 0, r * 1.25);
    GLOW.addColorStop(0, SEP + '.10)');
    GLOW.addColorStop(1, SEP + '0)');
    glowR = r;
  }
  D.fillStyle = GLOW!;
  D.fillRect(-r * 1.25, -r * 1.25, r * 2.5, r * 2.5);
}

/** nictitating membrane: a sheet of old tallow pulled across from the lower left. Inside the ball's clip */
function membrane(D: CanvasRenderingContext2D, r: number, cover: number) {
  // the edge sags bow * (y / far)^2, so .65 bows it about .27 r across the ball's width: under .2 it read as a ruled line
  const front = r * (-1.05 + 2.1 * cover), bow = r * .65, far = r * 1.5;
  D.save();
  D.rotate(-Math.PI / 4); // +x is now up-right, the direction it travels
  D.fillStyle = MEM;
  D.beginPath();
  D.moveTo(-far, -far);
  D.lineTo(front - bow, -far);
  D.quadraticCurveTo(front + bow, 0, front - bow, far);
  D.lineTo(-far, far);
  D.closePath();
  D.fill();
  // the wet lip: one game px (r is 88 of them), the edge alone
  D.beginPath();
  D.moveTo(front - bow, -far);
  D.quadraticCurveTo(front + bow, 0, front - bow, far);
  D.strokeStyle = MEM_LIP;
  D.lineWidth = Math.max(1, r / 88);
  D.stroke();
  D.restore();
}

/** one drool strand's bead: a teardrop hanging from (x, y - 2.2 br), its round end centred on (x, y) */
function teardrop(D: CanvasRenderingContext2D, x: number, y: number, br: number) {
  const w = br * 1.05;
  D.beginPath();
  D.moveTo(x, y - br * 2.2);
  D.bezierCurveTo(x + br * .2, y - br * 1.3, x + w, y - br * .7, x + w, y);
  D.arc(x, y, w, 0, Math.PI);
  D.bezierCurveTo(x - w, y - br * .7, x - br * .2, y - br * 1.3, x, y - br * 2.2);
  D.closePath();
  D.fill();
}

/** two ochre strands off the lower right: stretch, bead, snap, fall. From time alone */
function drool(D: CanvasRenderingContext2D, r: number, t: number) {
  const al = D.globalAlpha, floor = r * DROOL_FLOOR;
  for (let s = 0; s < 2; s++) {
    const th = Math.PI / 2 - .62 + s * .4 + Math.sin(t * .01 + s) * .03;
    const q = ((th / TAU * N) % N + N) % N, or = ROT_OUTLINE[q | 0];
    const ax = Math.cos(th) * r * or * .97, ay = Math.sin(th) * r * or * .97;
    const p = (t * (.0034 + s * .0007) * .6 + s * .37) % 1; // 60 % of the old rate
    const snap = p > SNAP, f = Math.min(p, SNAP) / SNAP, grown = r * .02 + r * .024 * f;
    // art-director: .4r at most, and the fullest strand and bead stop short of the credits
    const reach = Math.min(r * .4, floor - ay - r * .05);
    const len = r * .04 + (reach - r * .04) * f ** 1.7;
    const sway = Math.sin(t * .03 + s * 2) * r * .05, ex = ax + sway, ey = ay + len;
    if (!snap) { // always joined: root on the ball, tip inside the bead's neck
      const root = r * .012 + len * .05, tip = r * .005, mx = ax + sway * .3, my = ay + len * .45;
      D.beginPath();
      D.moveTo(ax - root, ay - r * .02);
      D.quadraticCurveTo(mx - tip * 1.5, my, ex - tip, ey);
      D.lineTo(ex + tip, ey);
      D.quadraticCurveTo(mx + tip * 1.5, my, ax + root, ay - r * .02); // left open: a stroked root is a flat cap on the ball
      D.fillStyle = DROOL;
      D.fill();
      D.strokeStyle = DROOL_E;
      D.lineWidth = Math.max(1, r * .005);
      D.stroke();
    }
    const fall = snap ? (p - SNAP) / (1 - SNAP) : 0, br = grown * (1 - fall * .4);
    const by = ey + fall * fall * Math.max(0, floor - ey - br); // lands fading, never across the credits
    D.globalAlpha = al * (1 - fall);
    D.fillStyle = BEAD;
    teardrop(D, ex, by, br);
    D.fillStyle = BEAD_G;
    D.beginPath();
    D.arc(ex - br * .3, by - br * .2, br * .14, 0, TAU); // art-director: half the old glint
    D.fill();
    D.globalAlpha = al;
  }
}

/** draw the hero at device-space (X,Y) radius r. e carries the lens offset (ang, m in ball radii), membrane (bl), jig */
export function drawHeroEye(D: CanvasRenderingContext2D, e: any, X: number, Y: number, r: number) {
  const t = $.T, m = e.m || 0, a = e.ang || 0;
  fillOutline(r, t, e.jig || 0);
  D.save();
  D.translate(X, Y);
  glowBehind(D, r);
  D.save();
  tracePath(D);
  D.clip();
  if (sprReady('rot_ball') && sprReady('rot_lens') && sprReady('rot_shade') && sprReady('rot_spec')) {
    const lx = Math.cos(a) * m * r, ly = Math.sin(a) * m * r, h = ROT_HALF * r, lh = ROT_LENS_HALF * r;
    // relative to the baked gaze: the ball and silhouette line up as painted when the lens is where it was painted
    D.drawImage(SPR.rot_ball.img, (lx - ROT_GAZE_X * r) * ROLL - h, (ly - ROT_GAZE_Y * r) * ROLL - h, h * 2, h * 2);
    D.save();
    D.translate(lx, ly);
    // squash along the gaze only: rotating back keeps the disc's creases from turning with it
    D.rotate(a);
    D.scale(1 - FORE * m, 1);
    D.rotate(-a);
    D.drawImage(SPR.rot_lens.img, -lh, -lh, lh * 2, lh * 2);
    D.restore();
    // under the lighting, not over it: on top it read as a flat paper flap, unlit by the ball it lies on
    if (e.bl > .005) membrane(D, r, e.bl);
    D.drawImage(SPR.rot_shade.img, -h, -h, h * 2, h * 2);
    D.drawImage(SPR.rot_spec.img, -h, -h, h * 2, h * 2);
  } else { // a layer still loading: never the old art, never nothing
    D.fillStyle = STANDIN;
    D.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
  }
  D.restore();
  tracePath(D);
  D.strokeStyle = RIM;
  D.lineWidth = Math.max(1, r * .018);
  D.stroke();
  drool(D, r, t);
  D.restore();
}
