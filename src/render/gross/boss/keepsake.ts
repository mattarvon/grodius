// @ts-nocheck
// THE KEEPSAKE stage boss's art (D55). Sim: enemies/boss/keepsake.ts; geometry: enemies/boss/_keepsake.ts KB.
//
// Three tiers, best first, so a hit never lands on nothing:
//  1 the boss atlas (kboss-art, tools/prep_keepsake_boss.py): src/sprites/boss/keepsake-boss.{png,json}, route art through
//    baked.ts bf() (lazy: the warm-up loads it once the route has it, render/warmup.ts). The contract is
//    tools/keepsake-boss-art.json: face0-3, then eye_<open|half|shut|empty>, then wound_<seat|proud|gape|brain>, each
//    pre-rotated at the 5 tilts -32/-16/0/16/32 (the nearest is drawn, never turned at runtime), offsets from the origin
//    (52, 67) of a 104x124 box; die x 4 (tipping onto its side); rocker_open/shut x 13 swing angles (-108..108 deg);
//    crier x 2; fork x 16 (the photo fork's spin angles, render/fork.ts bigFork); mfork x 2 (hanging, drop tell: mobFork)
//  2 the greybox while the atlas is on its way: the midboss's own sprite (keepsake@6.png, Matt's doll, 48x58 on (24, 31))
//    at 104 / 48, which is the contract's box, rotated at runtime
//  3 a procedural head (a vinyl ellipse, sockets, the crown) until either has loaded
// The overlays the sim's state needs to read are procedural in tiers 2-3: the crack, the split and its meat, the crier,
// the rocker on its wire, the swing's arc. The telegraphs (under): the fountain's landing marks and paths, the aimed
// and boomerang lines, the flying fork, the hoop mobile (a ring seen edge-on, never crossed bars: those read as a cross)
// with each fork's drop tell and column mark. Imply-only (D46/D53): a toy and the ship's meat, no child, no bone, no teeth.
// IT WON'T LET GO (D59): the planted forks (tines out of the floor and ceiling, a dim enemy-fire glow, a dab of the
// ship's blood where they went in), the recall's and the tug's threads (dashed, then a solid 3 px line, the throw
// line's grammar), the forks flying home, and CRACKED's search beam: a hatched cone from the rocker's glass eyes and,
// when it finds the ship, a hatched band down the ship's column that fills top to bottom over its 50 f (it reads with
// the sound off and the flashes off: hatching, not a colour alone). Every fork is drawn by render/fork.ts drawFork, the
// one fork path (eshots draw through it too), so the fork reskin lands everywhere at once.
// Render-only: e.t / $.T and hashes for motion, the midboss fx stream for particles, never the sim RNG; nothing
// allocated per frame (module scratch only).
import { $ } from '../../../state';
import { PH, W, ctx, hash } from '../../../core';
import { ceilAt, floorAt } from '../../../world';
import { KB, lobFrames, pendXY, riseCap, rotXY } from '../../../enemies/boss/_keepsake';
import { glow } from '../../util';
import { BIG_LEN, bigFork as atlasFork, drawFork, mobFork } from '../../fork';
import { spr, sprReady } from '../../../sprites';
import { drawParts, emit, fxs, glowC, GROSS, rn, rnd, spray, stepParts, strand } from '../midbosses';
import { bakedBuilt, bakedDrop, bakedReady, bakedWarm, bf, pour, trackDeath } from '../baked';

// ---- the art contract (tools/keepsake-boss-art.json; the atlas's own json holds every frame's offset)
const K = 'keepsake-boss', MID = 'keepsake', FK = 'keepsake-fork';
const TILTS = [-32, -16, 0, 16, 32].map((d) => (d * Math.PI) / 180); // the baked tilts, canvas radians (+ clockwise)
const SWING = 18 * Math.PI / 180; //  rocker_*: 13 frames, -108..108 deg in 18 deg steps (index 6 hangs)
const APEX = 10; //                   rocker_*'s anchor sits this far down the wire from the pivot (its weight 48 below it: KB.pLen 58)
const MFORK = KB.mobFs; //            the hanging forks' scale (drawFork: 15 px at 1): 33 px
const EYE_L = ['eye_open', 'eye_half', 'eye_shut', 'eye_empty'], WOUND_L = ['wound_seat', 'wound_proud', 'wound_gape', 'wound_brain'], FACE_L = ['face0', 'face1', 'face2', 'face3'];
const MS = 104 / 48; //              the midboss sprite's scale to the boss box (its origin (24, 31) lands on ~(52, 67))
const EYE = [[-18, 0], [18, 0]]; //  the sockets at tilt 0 (the manifest's perTilt eyeL / eyeR)
const OPEN = 0, HALF = 1, SHUT = 2, EMPTY = 3;
const BLOOD = '#8a0c14', BLOOD_D = '#4a050a', VINYL = '#d6bfa2', VINYL_D = '#8a6e56';
const DASH = [5, 4], SOLID = [], ARC = [2, 4];
const FAN_K = [-1, 1]; // the throw fan's outer lines
// the search beam's colours, awake and resting (built once: no string per frame)
const BEAM_FILL = ['rgba(190,220,255,.07)', 'rgba(190,220,255,.0245)'], BEAM_HATCH = ['rgba(205,230,255,.28)', 'rgba(205,230,255,.098)'];
const BEAM_EDGE = ['rgba(215,235,255,.55)', 'rgba(215,235,255,.1925)'];
const P = new Float32Array(2), Q = new Float32Array(2);

/** the sleep eyes, the tell: dozing half-lidded at rest (a slow droop shut now and then), wide open on every tell and in
 *  every transition, fluttering through the last frames of an AWAKE hold before the roll, open for good once it rages,
 *  and the three slow clacks shut when it dies. Open never shows at rest */
function eyeOf(e) {
  const t = e.t || 0;
  if (e.st === 'dying') { const w = e.wt, b = KB.dieBeat; return w < 6 ? HALF : w < b ? SHUT : w < b + 8 ? HALF : w < 2 * b ? SHUT : w < 2 * b + 6 ? HALF : SHUT; }
  if (e.rage || e.tr > 0) return OPEN;
  if (e.st === 'idle') {
    if (e.ph === 1 && e.tc != null) { // AWAKE: the lashes flutter before each roll
      const C = 2 * (KB.hold + KB.roll), c = ((e.tc % C) + C) % C, inHold = c < KB.hold || (c >= KB.hold + KB.roll && c < 2 * KB.hold + KB.roll);
      const left = c < KB.hold ? KB.hold - c : 2 * KB.hold + KB.roll - c;
      if (inHold && left <= KB.flutter) return (t >> 2) & 1 ? HALF : SHUT;
    }
    if (e.wt < 10) return HALF;
    const cyc = Math.floor(t / 150), f = t - cyc * 150;
    return hash(cyc * 3.7 + 1) < .55 && f > 60 && f < 74 + hash(cyc) * 30 ? SHUT : HALF;
  }
  if (e.st === 'tell') { const k = e.wt / KB.tell; return k < .14 ? SHUT : k < .3 ? HALF : OPEN; }
  if (e.st === 'wail' || e.st === 'mama') return (e.wt >> 2) & 1 && e.wt < KB.wail * .6 ? HALF : OPEN;
  return e.wt < 5 ? HALF : OPEN;
}
/** the wound: 0 the fork seated, 1 proud (a tell working it loose), 2 gaping (the fork out), 3 the brain (CRACKED) */
function woundOf(e) {
  if (e.ph === 2 && e.tr <= 0) return 3;
  if (e.st === 'fly' || e.st === 'open' || e.st === 'fount') return 2;
  if (e.st === 'tell' || e.st === 'boom') return 1;
  return 0;
}
/** how far the fork has worked loose, 0..1 */
const loose = (e) => (e.st === 'tell' ? e.wt / KB.tell : e.st === 'boom' ? e.wt / KB.boomTel : 0);
/** the crack: 0 whole, 1 hairline (AWAKE), 2 splitting (IT CRACKED, k = its progress), 3 open */
const crackOf = (e) => (e.ph === 0 ? 0 : e.ph === 1 ? 1 : e.tr > 0 ? 2 : 3);
/** the nearest baked tilt frame */
function tiltIx(th) { let b = 0; for (let i = 1; i < TILTS.length; i++) if (Math.abs(TILTS[i] - th) < Math.abs(TILTS[b] - th)) b = i; return b; }

// ---------------- telegraphs (under the body, screen px) ----------------
function line(e, locked, a) {
  let x = e.lx, y = e.ly;
  if (!locked) { rotXY(KB.wx, KB.wy, e.th, P); x = e.x + P[0]; y = e.y + P[1]; }
  ctx.save();
  ctx.setLineDash(locked ? SOLID : DASH);
  ctx.lineDashOffset = -$.T * .6;
  ctx.globalAlpha = locked ? .55 + .35 * a : .25 + .3 * a;
  ctx.strokeStyle = locked ? '#ff503c' : '#ff8c6e';
  ctx.lineWidth = locked ? 3 : 1.4; // locked: 3 px, readable at phone size (spec §9)
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(e.la) * 560, y + Math.sin(e.la) * 560); ctx.stroke();
  if (e.st === 'aim' && e.ph) { // from AWAKE the throw is a fan of three (D59): its two outer lines, thinner
    ctx.lineWidth = locked ? 2 : 1; ctx.globalAlpha *= .75; ctx.beginPath();
    for (const k of FAN_K) { const a = e.la + k * KB.fan; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 560, y + Math.sin(a) * 560); }
    ctx.stroke();
  }
  ctx.restore();
}
/** the big fork, spinning (tines first along a): the atlas's photo fork at the nearest of its 16 baked angles (never
 *  turned at runtime: that shimmers), with two faint copies where it was one and two frames ago; while the atlas loads,
 *  the midboss's fork, then a line fork at the same 59 px */
const TR = new Float32Array(9); // the boomerang's last three spots: [0..2] now (x, y, a), [3..5] a frame back, [6..8] two
let trT = -9, trN = 0;
function bigFork(x, y, a) {
  if ($.T !== trT) { trN = $.T > trT && $.T - trT <= 3 ? Math.min(3, trN + 1) : 1; TR.copyWithin(3, 0, 6); trT = $.T; }
  TR[0] = x; TR[1] = y; TR[2] = a;
  if (trN >= 3) atlasFork(ctx, TR[6], TR[7], TR[8], .18);
  if (trN >= 2) atlasFork(ctx, TR[3], TR[4], TR[5], .35);
  if (atlasFork(ctx, x, y, a)) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a - Math.PI / 2);
  const ok = spr(ctx, FK, 0, 0, 0, { s: 1.5 });
  ctx.restore();
  if (!ok) drawFork(ctx, x, y, a, BIG_LEN / 15);
}

/** the fountain's marks: a 3 px chevron on each landing point from the tell's first frame, and the fork's real path */
function marks(e) {
  const st = e.st, k = st === 'tell' ? Math.min(1, e.wt / KB.tell) : 1, pul = .7 + .3 * Math.sin($.T * .35);
  rotXY(KB.wx, KB.wy, e.th, P);
  const wx = e.x + P[0], wy = e.y + P[1];
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < e.fn; i++) {
    if (st === 'fount' && e.wt >= e.fl[i]) continue;
    const x = e.fx[i], y = e.fz[i];
    let vx = e.fv[i], vy = e.fw[i];
    if (e.fl[i] >= 1e9) { const ly = wy - 4, u = riseCap(e.fq[i], ly), T = lobFrames(u, y - ly); vx = (x - wx) / T; vy = -u + .025 * T; }
    ctx.globalAlpha = (.14 + .2 * k) * pul;
    ctx.strokeStyle = '#dce4ec'; ctx.lineWidth = 1; ctx.setLineDash(DASH);
    ctx.beginPath(); ctx.moveTo(x - vx * 40, y - vy * 40 + 20);
    for (let t = -34; t <= 0; t += 6) ctx.lineTo(x + vx * t, y + vy * t + .0125 * t * t);
    ctx.lineTo(x, y);
    for (let t = 6; t <= 240; t += 6) {
      const px = x + vx * t, py = y + vy * t + .0125 * t * t, fl = Math.min(PH - 2, floorAt(px + $.G.scroll));
      if (py >= fl || px < 0 || px > W) { ctx.lineTo(px, Math.min(py, fl)); break; }
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash(SOLID);
    ctx.globalAlpha = (.45 + .5 * k) * pul; ctx.strokeStyle = '#ff6048'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 5, y - 6); ctx.lineTo(x, y - 1); ctx.lineTo(x + 5, y - 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 6, y + 2); ctx.lineTo(x + 6, y + 2); ctx.stroke();
  }
  ctx.restore();
}

/** the hoop mobile: a ring seen edge-on, threads up to the ceiling and down to six hanging forks (contact hazards, in a
 *  dim enemy-fire glow that brightens on a fork's drop tell; the tell shudders it, glints its thread and marks its
 *  column down to the floor) */
function mobile(e) {
  if (e.ph < 1 || e.my < -70) return;
  const hx = e.x + KB.mobX, hy = e.my, rx = (KB.mobN - 1) / 2 * KB.mobDx + 6, dropping = e.st === 'drop' || e.st === 'rain';
  const gap = e.st === 'rain' ? 6 : KB.dropGap, tel = e.st === 'rain' ? KB.rain : KB.drop;
  ctx.save();
  // the hoop's hangers to the ceiling
  ctx.strokeStyle = 'rgba(200,190,170,.35)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (const s of [-1, 1]) { const x = hx + s * rx * .7, c = Math.max(-4, ceilAt(x + $.G.scroll)); ctx.moveTo(x, c); ctx.lineTo(hx, hy - 30); }
  ctx.moveTo(hx, hy - 30); ctx.lineTo(hx - rx, hy); ctx.moveTo(hx, hy - 30); ctx.lineTo(hx + rx, hy);
  ctx.stroke();
  // the hoop, edge-on: a thin steel ellipse (a ring, not bars)
  ctx.strokeStyle = '#060708'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(hx, hy, rx, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#b8c0c8'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.ellipse(hx, hy, rx, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < KB.mobN; i++) {
    if (!e.ma[i]) continue;
    const fx = e.x + KB.mobX + (i - (KB.mobN - 1) / 2) * KB.mobDx, tip = hy + KB.mobLen + e.ml[i], sway = Math.sin($.T * .03 + i * 1.7) * 1.2;
    let telK = 0;
    if (dropping) for (let k = 0; k < e.dn; k++) if (e.dq[k] === i && e.wt < tel + k * gap) telK = Math.max(0, Math.min(1, (e.wt - k * gap) / tel));
    const shud = telK > 0 ? (hash(($.T >> 1) + i * 13) - .5) * 2.4 * telK : 0, x = fx + sway + shud;
    // the thread (a glint runs down it on the tell)
    ctx.strokeStyle = telK > 0 && ($.T >> 2) & 1 ? '#ffffff' : 'rgba(220,214,200,.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(fx, hy + 2); ctx.lineTo(x, tip - 15 * MFORK); ctx.stroke();
    // the enemy-fire glow every enemy shot wears (D53), dim while it hangs, hot on its tell
    ctx.globalCompositeOperation = 'lighter';
    glow(x, tip - 14, 14 + 6 * telK, '150,255,40', .16 + .5 * telK);
    ctx.globalCompositeOperation = 'source-over';
    // tines down, its tip at `tip`, 33 px long: the atlas's photo fork (a lit rim so it reads as a hazard at true size;
    // the tell's frame brighter), the line fork at x2.2 while the atlas loads
    if (!mobFork(ctx, x, tip, telK > 0)) drawFork(ctx, x, tip - 6 * MFORK, Math.PI / 2, MFORK);
    if (telK > 0) { // the column it falls down, marked to the floor: dashed, then a 3 px bar where it lands
      const fl = Math.min(PH - 2, floorAt(x + $.G.scroll));
      ctx.globalAlpha = .25 + .45 * telK; ctx.strokeStyle = '#ff6048'; ctx.lineWidth = 1; ctx.setLineDash(DASH);
      ctx.beginPath(); ctx.moveTo(x, tip + 3); ctx.lineTo(x, fl - 4); ctx.stroke(); ctx.setLineDash(SOLID);
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 6, fl - 3); ctx.lineTo(x + 6, fl - 3); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

// ---------------- IT WON'T LET GO (D59) ----------------
/** the planted forks: tines out of the floor (side 1) or ceiling (-1), handle 1 px in. A shudder when a thread has it
 *  (the recall's and tug's tells) or a cry is about to shake it loose */
function planted(e) {
  if (!e.pn) return;
  const sc = $.G.scroll, threads = e.rcW > 0 || e.st === 'tug', cry = e.st === 'mama' && e.wt < KB.mama + KB.mamaGap;
  ctx.save();
  for (let i = 0; i < e.pn; i++) {
    const x0 = e.pX[i] - sc, y = e.pY[i], sd = e.pS[i];
    if (x0 < -10 || x0 > W + 10) continue;
    const hot = (threads && e.pQ[i]) || (cry && (sd > 0 || e.wt >= KB.mama)) ? 1 : 0;
    const x = x0 + (hot ? (hash(($.T >> 1) + i * 7) - .5) * 2.2 : 0);
    // where it went in: a dark dab and the ship's blood
    ctx.fillStyle = 'rgba(20,6,6,.8)'; ctx.beginPath(); ctx.ellipse(x0, y, 4, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = BLOOD; ctx.fillRect(x0 - 2, sd > 0 ? y - 1.5 : y, 4, 1.5);
    ctx.globalCompositeOperation = 'lighter';
    glow(x, y - sd * 7, 9 + 3 * hot, '150,255,40', .14 + .3 * hot);
    ctx.globalCompositeOperation = 'source-over';
    drawFork(ctx, x, y - sd * 6, sd > 0 ? -Math.PI / 2 : Math.PI / 2, 1); // tines out, its handle's end 3 px into the surface
  }
  ctx.restore();
}
/** the recall's and the tug's threads, from each chosen fork to where the wound was at the tell's start: dashed and
 *  faint, then a solid 3 px line for the last recLock frames (where each will fly is fixed) */
function threads(e, tug) {
  const tel = tug ? KB.tug : KB.recall, w = tug ? e.wt : e.rcW, k = Math.min(1, w / tel), locked = w >= tel - KB.recLock, sc = $.G.scroll;
  const q = tug ? 1 : 2, tx = tug ? e.tux : e.rtx, ty = tug ? e.tuy : e.rty; // the sim's TUG / RECALL threads
  ctx.save();
  ctx.setLineDash(locked ? SOLID : DASH); ctx.lineDashOffset = $.T * .6; // the dashes run toward the wound: it is pulling
  ctx.strokeStyle = locked ? '#ff503c' : '#ff8c6e';
  ctx.globalAlpha = locked ? .55 + .35 * k : .2 + .35 * k;
  ctx.lineWidth = locked ? 3 : 1.2;
  ctx.beginPath();
  for (let i = 0; i < e.pn; i++) {
    if (e.pQ[i] !== q) continue;
    ctx.moveTo(e.pX[i] - sc, e.pY[i] - e.pS[i] * 9); ctx.lineTo(tx, ty);
  }
  ctx.stroke();
  ctx.restore();
}
/** the forks flying home along their threads: the rest of each thread still drawn, the fork tines first */
function homing(e) {
  if (!e.fh) return;
  ctx.save();
  ctx.strokeStyle = '#ff503c'; ctx.globalAlpha = .5; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let j = 0; j < e.fh; j++) { ctx.moveTo(e.hX[j], e.hY[j]); ctx.lineTo(e.hX[j] + e.hVX[j] * e.hF[j], e.hY[j] + e.hVY[j] * e.hF[j]); }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  for (let j = 0; j < e.fh; j++) glow(e.hX[j], e.hY[j], 12, '150,255,40', .5);
  ctx.globalCompositeOperation = 'source-over';
  for (let j = 0; j < e.fh; j++) drawFork(ctx, e.hX[j], e.hY[j], Math.atan2(e.hVY[j], e.hVX[j]), 1);
  ctx.restore();
}
/** stripes across the current clip, every `step` px at 45 deg (the beam's and the mark's hatching) */
function hatch(x0, y0, x1, y1, step, off) {
  ctx.beginPath();
  for (let u = x0 - (y1 - y0) + (off % step); u < x1; u += step) { ctx.moveTo(u, y1); ctx.lineTo(u + (y1 - y0), y0); }
  ctx.stroke();
}
/** CRACKED's search beam: a hatched cone along the rocker's wire, pale glass blue, dimmed while it rests; and the mark,
 *  a hatched band down the ship's column with its edges ruled, filling from the ceiling to the floor as the forks come
 *  (three chevrons at the top where they will fall) */
function searchBeam(e) {
  if (!e.rocker || e.st === 'dying') return;
  const x = e.box, y = e.boy, a = Math.atan2(e.bdy, e.bdx), L = KB.bLen, h = KB.bHalf;
  const rest = e.bCd > 0 || e.mkT > 0 || e.p3t < KB.pRamp + KB.bArm, ri = rest ? 1 : 0; // resting: drawn at .35
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a - h) * L, y + Math.sin(a - h) * L); ctx.lineTo(x + Math.cos(a + h) * L, y + Math.sin(a + h) * L); ctx.closePath();
  ctx.fillStyle = BEAM_FILL[ri]; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = BEAM_HATCH[ri]; ctx.lineWidth = 1;
  hatch(Math.min(x, x + Math.cos(a) * L) - 80, Math.min(y, y + Math.sin(a) * L) - 80, Math.max(x, x + Math.cos(a) * L) + 80, Math.max(y, y + Math.sin(a) * L) + 80, 7, $.T * .4);
  ctx.restore();
  ctx.strokeStyle = BEAM_EDGE[ri]; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a - h) * L, y + Math.sin(a - h) * L); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a + h) * L, y + Math.sin(a + h) * L); ctx.stroke();
  if (e.mkT > 0) {
    const k = 1 - e.mkT / KB.bTel, hw = KB.bRainDx + 8, x0 = e.mkX - hw, x1 = e.mkX + hw, sc = $.G.scroll;
    const top = Math.max(0, ceilAt(e.mkX + sc)), bot = Math.min(PH, floorAt(e.mkX + sc)), fill = top + (bot - top) * k;
    ctx.beginPath(); ctx.rect(x0, top, 2 * hw, fill - top); ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(255,90,60,.55)'; ctx.lineWidth = 1.5;
    hatch(x0, top, x1, fill, 6, 0); // the part filled so far: dense red hatching
    ctx.restore();
    ctx.strokeStyle = '#ff6e50'; ctx.globalAlpha = .45 + .45 * k; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, bot); ctx.moveTo(x1, top); ctx.lineTo(x1, bot); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, fill); ctx.lineTo(x1, fill); ctx.stroke(); // the fill's edge, dropping
    for (let i = 0; i < KB.bRainN; i++) { // where the three forks fall
      const fx = e.mkX + (i - (KB.bRainN - 1) / 2) * KB.bRainDx;
      ctx.beginPath(); ctx.moveTo(fx - 4, top + 4); ctx.lineTo(fx, top + 9); ctx.lineTo(fx + 4, top + 4); ctx.stroke();
    }
    // the stare: a fine line from the glass eyes to the mark
    ctx.globalAlpha = 1; ctx.lineWidth = 1; ctx.setLineDash(DASH); ctx.strokeStyle = 'rgba(215,235,255,.6)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(e.mkX, (top + bot) / 2); ctx.stroke();
  }
  ctx.restore();
}

function under(e) {
  if (e.dead) return;
  planted(e);
  mobile(e);
  homing(e);
  if (e.st === 'dying') return;
  if (e.ph === 2 && e.tr <= 0) searchBeam(e);
  if (e.rcW > 0) threads(e, false);
  if (e.st === 'tug') threads(e, true);
  if ((e.st === 'tell' || e.st === 'fount') && e.fn) marks(e);
  if (e.st === 'aim') line(e, e.wt >= KB.aim - KB.lock, e.wt / KB.aim);
  if (e.st === 'boom') line(e, e.wt >= KB.boomTel - KB.boomLock, e.wt / KB.boomTel);
  if (e.st === 'fly') {
    line(e, true, 1);
    ctx.globalCompositeOperation = 'lighter';
    glow(e.bx, e.by, 22, '150,255,40', .55 * (.75 + .25 * Math.sin($.T * .5)));
    ctx.globalCompositeOperation = 'source-over';
    bigFork(e.bx, e.by, e.bsa); // the sim's spin (KB.boomSpin ~0.3 rad a frame: about one baked angle per frame, so it
    // never strobes), the angle its capsule hitbox is turned to (review 2026-11-20)
  }
  // the wail's tell: the crier's ring swells round its source before it lets go
  if ((e.st === 'wail' && e.wt < KB.wail) || (e.st === 'mama' && e.wt < KB.mama)) {
    const k = e.wt / (e.st === 'wail' ? KB.wail : KB.mama), x = e.x + (e.st === 'mama' ? KB.crx : 0), y = e.y + (e.st === 'mama' ? KB.cry : -10);
    ctx.save(); ctx.globalAlpha = .2 + .5 * k; ctx.strokeStyle = '#ff8c6e'; ctx.lineWidth = 3; ctx.setLineDash(ARC);
    ctx.beginPath(); ctx.arc(x, y, 60 - 40 * k, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
}

// ---------------- the head ----------------
/** tier 3: the procedural head, head-local, upright (the caller has rotated) */
function procHead(c, eye) {
  c.fillStyle = '#1a1210';
  c.beginPath(); c.ellipse(0, -2, 46, 60, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = VINYL;
  c.beginPath(); c.ellipse(0, -2, 44, 58, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = VINYL_D;
  c.fillRect(-14, 50, 28, 6); // the stump
  for (const [x, y] of EYE) {
    c.fillStyle = '#20140f'; c.beginPath(); c.ellipse(x, y, 9, 7, 0, 0, Math.PI * 2); c.fill();
    if (eye !== EMPTY) {
      c.fillStyle = '#e8e4dc'; c.beginPath(); c.ellipse(x, y, 7, 5.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#5a8ab8'; c.beginPath(); c.arc(x, y, 3.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#080808'; c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill();
      if (eye !== OPEN) { c.fillStyle = VINYL_D; c.fillRect(x - 8, y - 7, 16, eye === SHUT ? 13 : 6.5); }
    }
  }
}
/** the fork in the soft spot, tines buried; only what stands above the skull shows */
function wedged(c, e, k) {
  const x = KB.wx, y = KB.wy + 2, rise = Math.round(6 * k), lean = .14 + (k > .6 ? (hash(e.t >> 1) - .5) * .12 * k : 0);
  c.save();
  c.beginPath(); c.rect(x - 22, y - 60, 44, 60); c.clip();
  c.translate(x, y); c.rotate(lean);
  if (!spr(c, FK, 0, 0, -22 - rise, { ax: .5, ay: 0, s: 1.5 })) drawFork(c, 0, -8 - rise, Math.PI / 2, 2);
  c.restore();
}
/** the crack and the split, head-local: a hairline from the soft spot down to the player-side eye; IT CRACKED opens it
 *  (k 0..1) into a wedge of the ship's meat and the brain round the fork. Mechanism and meat, never bone */
function crack(c, e, cr) {
  const L = [[KB.wx - 2, KB.wy + 6], [-6, -38], [-2, -30], [-12, -22], [-9, -14], [-17, -8]];
  if (cr >= 1) {
    c.strokeStyle = 'rgba(40,20,14,.85)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(L[0][0], L[0][1]); for (let i = 1; i < L.length; i++) c.lineTo(L[i][0], L[i][1]); c.stroke();
  }
  if (cr < 2) return;
  const k = cr === 3 ? 1 : 1 - e.tr / KB.tr2, w = 9 * k;
  c.fillStyle = '#2a0608';
  c.beginPath();
  c.moveTo(L[0][0] - w, L[0][1]);
  for (let i = 1; i < L.length; i++) c.lineTo(L[i][0] - w * (1 - i / L.length), L[i][1]);
  for (let i = L.length - 1; i >= 0; i--) c.lineTo(L[i][0] + w * (1.2 - i / L.length) + 2, L[i][1] + 1);
  c.closePath(); c.fill();
  // the meat inside: wet ship tissue and the brain bulging at the top, pulsing
  const pu = 1 + .06 * Math.sin((e.t || 0) * .12);
  c.fillStyle = BLOOD; c.beginPath(); c.ellipse(-6, -28, 5 * k, 14 * k, .3, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#c87a86'; c.beginPath(); c.ellipse(KB.wx - 2, KB.wy + 4, 12 * k * pu, 7 * k * pu, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#7a2a3a'; c.lineWidth = 1;
  c.beginPath(); for (let i = -2; i <= 2; i++) { c.moveTo(KB.wx - 2 + i * 4, KB.wy + 1); c.quadraticCurveTo(KB.wx + i * 4, KB.wy + 5, KB.wx - 2 + i * 4, KB.wy + 9); } c.stroke();
}
/** the crier: a perforated tin cylinder with a bellows, or crushed */
function crier(c, e) {
  const p = e.crier;
  if (!p) return;
  const x = KB.crx, y = KB.cry;
  if (bf(c, K, 'crier', p.dead ? 1 : 0, x, y)) return;
  c.fillStyle = '#121416'; c.fillRect(x - 8, y - 9, 16, 18);
  c.fillStyle = p.dead ? '#4a4e52' : '#8a9096'; c.fillRect(x - 7, y - 8, 14, 16);
  c.fillStyle = '#1a1c1e';
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c.fillRect(x - 5 + i * 4, y - 6 + j * 4, 1.5, 1.5);
  if (p.dead) { c.strokeStyle = '#2a2c2e'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 7, y - 2); c.lineTo(x + 7, y + 3); c.stroke(); }
  else { c.fillStyle = '#6a4a3a'; c.fillRect(x - 7, y + 8, 14, 3 + 1.5 * Math.sin((e.t || 0) * .2)); } // the bellows breathing
}
/** the swing's arc, faint (its tell: slow, constant, always drawn), then the rocker: the wire, the lead weight and the
 *  two glass eyes, open or shut with the sleep-eye state */
function rocker(c, e, eye) {
  if (!e.rocker) return;
  const px = KB.pvx, py = KB.pvy;
  c.save();
  c.globalAlpha = .4; c.strokeStyle = '#ffb070'; c.lineWidth = 2.5; c.setLineDash(ARC); // a lethal hazard's path: 2.5 px, .4
  c.beginPath(); c.arc(px, py, KB.pLen, Math.PI / 2 - KB.pAmp, Math.PI / 2 + KB.pAmp); c.stroke();
  c.restore();
  pendXY(e.pa, Q);
  const bx = Q[0], by = Q[1], fl = e.rocker.flash > 0;
  // the kill point: a hot rim round the weight, pulsing (drawn under the art, so the art reads on top of it)
  c.save(); c.globalCompositeOperation = 'lighter'; glowC(c, bx, by, KB.pR + 8, '255,80,40', .5 + .2 * Math.sin($.T * .3)); c.restore();
  c.strokeStyle = 'rgba(255,90,50,.85)'; c.lineWidth = 2; c.beginPath(); c.arc(bx, by, KB.pR + 1, 0, Math.PI * 2); c.stroke();
  if (bakedReady(K)) { // the wire to the frame's apex, then the swing frame nearest the angle
    const ax = px - Math.sin(e.pa) * APEX, ay = py + Math.cos(e.pa) * APEX, i = Math.max(0, Math.min(12, Math.round(e.pa / SWING) + 6));
    c.strokeStyle = '#a8b0b8'; c.lineWidth = 1; c.beginPath(); c.moveTo(px, py); c.lineTo(ax, ay); c.stroke();
    bf(c, K, eye === OPEN ? 'rocker_open' : 'rocker_shut', i, ax, ay);
    return;
  }
  c.strokeStyle = '#060708'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(px, py); c.lineTo(bx, by); c.stroke();
  c.strokeStyle = '#a8b0b8'; c.lineWidth = 1; c.beginPath(); c.moveTo(px, py); c.lineTo(bx, by); c.stroke();
  // the lead weight, then the eyes either side of it along the cross wire
  const nx = Math.cos(e.pa), ny = Math.sin(e.pa);
  c.fillStyle = fl ? '#d0d4d8' : '#3a3e44'; c.beginPath(); c.ellipse(bx, by + 3, 5, 6, 0, 0, Math.PI * 2); c.fill();
  for (const s of [-1, 1]) {
    const ex = bx + nx * 7 * s, ey = by - 2 + ny * 7 * s;
    c.fillStyle = '#060708'; c.beginPath(); c.arc(ex, ey, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f2eee6'; c.beginPath(); c.arc(ex, ey, 4.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5a8ab8'; c.beginPath(); c.arc(ex - .6, ey, 2.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#060708'; c.beginPath(); c.arc(ex - .6, ey, 1.1, 0, Math.PI * 2); c.fill();
    if (eye !== OPEN) { c.fillStyle = VINYL_D; c.beginPath(); c.arc(ex, ey, 4.3, Math.PI, eye === SHUT ? Math.PI * 3 : Math.PI * 2); c.fill(); }
  }
}

const DEATH = { k: MID, body: false, len: 80, gore: (x, y, age) => pour(x + KB.wx, y + KB.wy + 6, age, { w: 14, h: 10, jets: 7, len: 70, meat: 12, rope: 4 }) };

function draw(c, e) {
  const s = fxs(e), t = e.t || 0;
  stepParts(s);
  trackDeath(e, DEATH);
  const eye = eyeOf(e), wd = woundOf(e), cr = crackOf(e), p3 = e.ph === 2 && e.tr <= 0, ev = s.ev;
  if (ev === 'tell>fount') spray(s, e.x + KB.wx, e.y + KB.wy - 2, 10, BLOOD, 1.8, 1.2, 1.3);
  if (ev === 'boom>fly') spray(s, e.x + KB.wx, e.y + KB.wy - 1, 16, BLOOD, 2.2, 1.3, 1.7);
  // a slow bob in whole px (pixel art), a tremble on the tell, a shudder on the cries
  let bx = 0, by = Math.round(Math.sin(t * .028) * 1.2);
  if (e.st === 'tell' && e.wt > KB.tell * .3 && hash(t >> 1) > .6) bx = hash(t) < .5 ? -1 : 1;
  if (e.st === 'wail' || e.st === 'mama') { const k = Math.min(1, e.wt / KB.wail); bx = Math.round((hash(t) - .5) * 4 * k); }
  if (e.tr > 0) bx += Math.round((hash(t + 3) - .5) * 3);
  // ---- tier 1: the atlas (pre-rotated tilts, face -> eye -> wound; die once it tips past 40 deg)
  if (bakedReady(K)) {
    if (e.st === 'dying' && e.th > .7) {
      bf(c, K, 'die', Math.min(3, Math.floor((e.th - .7) / .25)), bx, by);
      drawParts(c, s, e); return;
    }
    const ti = tiltIx(e.th);
    bf(c, K, FACE_L[cr], ti, bx, by);
    bf(c, K, EYE_L[p3 || e.st === 'dying' ? EMPTY : eye], ti, bx, by);
    bf(c, K, WOUND_L[wd], ti, bx, by);
    c.save(); c.translate(bx, by); c.rotate(e.th);
    if (e.rocker) { crier(c, e); rocker(c, e, eye); } // CRACKED and its dying beat: the three clacks are the rocker's eyes (rocker_shut)
    c.restore();
  } else {
    bakedWarm(K); // a draw before the warm-up got to it starts the load; the greybox stands in
    // ---- tiers 2-3: rotated at runtime (interim)
    c.save(); c.translate(bx, by); c.rotate(e.th);
    if (sprReady(MID)) {
      const f = (eye === EMPTY || p3 ? SHUT : eye) + (wd === 2 ? 3 : 0);
      spr(c, MID, f, -52, -67, { ax: 0, ay: 0, s: MS, smooth: true });
    } else procHead(c, p3 ? EMPTY : eye);
    if (p3) for (const [x, y] of EYE) { c.fillStyle = '#140808'; c.beginPath(); c.ellipse(x, y, 8, 6.5, 0, 0, Math.PI * 2); c.fill(); } // the sockets: the eyes are on the rocker now
    crack(c, e, cr);
    if (wd < 2) wedged(c, e, wd === 1 ? loose(e) : 0);
    if (e.rocker) { crier(c, e); rocker(c, e, eye); }
    c.restore();
  }
  // live wet: the wound weeps, and gushes while the fork is out or the head is split
  rotXY(KB.wx, KB.wy, e.th, P);
  const wx = e.x + P[0], wy = e.y + P[1];
  if ((wd >= 2 || p3) && rnd() < .5 * s.dt * GROSS) emit(s, wx + rn(-3, 3), wy, rn(-1, 1), rn(-2.4, -1), rnd() < .7 ? BLOOD : BLOOD_D, rn(.9, 1.5), 0, 60);
  if (e.flash && rnd() < .5 * GROSS) emit(s, wx + rn(-5, 5), wy + rn(-1, 3), rn(-1.2, 1.2), rn(-1.8, -.4), BLOOD, rn(.8, 1.3), 0, 50);
  c.save(); c.rotate(e.th); // the wound weeping down the forehead, in the head's frame
  for (let i = 0; i < 3; i++) strand(c, s, e, 90 + i, KB.wx - 4 + i * 4 + bx, KB.wy + 8 + by, 6 + i * 2, 1, 'rgba(110,6,14,.9)', 61 + i * 17, BLOOD, .4);
  c.restore();
  drawParts(c, s, e);
}

/** the boss's art for the registry (./index.ts): the atlas is route art (warmplan.ts routeArt names it when bossFor places
 *  the boss on the route; render/warmup.ts loads and drops it). warm starts the download (decode is off the draw) */
export default { draw, under, warm: () => { bakedWarm(K); return false; }, built: () => bakedBuilt(K), drop: () => bakedDrop(K) };
