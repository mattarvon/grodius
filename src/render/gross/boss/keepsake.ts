// @ts-nocheck
// THE KEEPSAKE stage boss's art (D55). Sim: enemies/boss/keepsake.ts; geometry: enemies/boss/_keepsake.ts KB.
//
// Three tiers, best first, so a hit never lands on nothing:
//  1 the boss atlas (kboss-art): src/sprites/keepsake-boss-*.png strips, named and laid out by tools/keepsake-boss-art.json
//    (the contract: face = crack * 5 + tilt, eyes = eye * 5 + tilt, wound = wound * 5 + tilt, all 104x124 frames on the
//    (52, 66) origin; rocker, crier, death). Pre-rotated tilts: the nearest of -32/-16/0/16/32 is drawn, never rotated
//  2 the greybox: the midboss's own sprite (keepsake@6.png, Matt's doll, 48x58 on (24, 31)) at 2.15x, which IS the
//    contract's 104x124 frame on (52, 66), rotated at runtime (interim only: pixel art shimmers when turned)
//  3 a procedural head (a vinyl ellipse, sockets, the crown) until either has loaded
// The overlays the sim's state needs to read are procedural in tiers 2-3: the crack, the split and its meat, the crier,
// the rocker on its wire, the swing's arc. The telegraphs (under): the fountain's landing marks and paths, the aimed
// and boomerang lines, the flying fork, the hoop mobile (a ring seen edge-on, never crossed bars: those read as a cross)
// with each fork's drop tell and column mark. Imply-only (D46/D53): a toy and the ship's meat, no child, no bone, no teeth.
// Render-only: e.t / $.T and hashes for motion, the midboss fx stream for particles, never the sim RNG; nothing
// allocated per frame (module scratch only).
import { $ } from '../../../state';
import { PH, W, ctx, hash } from '../../../core';
import { ceilAt, floorAt } from '../../../world';
import { KB, lobFrames, pendXY, riseCap, rotXY } from '../../../enemies/boss/_keepsake';
import { glow } from '../../util';
import { drawFork } from '../../fork';
import { spr, sprReady } from '../../../sprites';
import { drawParts, emit, fxs, GROSS, rn, rnd, spray, stepParts, strand } from '../midbosses';
import { pour, trackDeath } from '../baked';

// ---- the art contract (tools/keepsake-boss-art.json): read at build time when present, these defaults otherwise
const MAN = Object.values(import.meta.glob('../../../../tools/keepsake-boss-art.json', { eager: true, import: 'default' }))[0] || {};
const FR = MAN.frame || { w: 104, h: 124, ox: 52, oy: 66 };
const TILTS = (MAN.tilts || [-32, -16, 0, 16, 32]).map((d) => (d * Math.PI) / 180);
const STRIP = MAN.strips || {};
const AX = (k, d) => (STRIP[k] ? STRIP[k].ox / STRIP[k].w : d), AY = (k, d) => (STRIP[k] ? STRIP[k].oy / STRIP[k].h : d);
const A = { face: 'keepsake-boss-face', eyes: 'keepsake-boss-eyes', wound: 'keepsake-boss-wound', rocker: 'keepsake-boss-rocker', crier: 'keepsake-boss-crier', death: 'keepsake-boss-death' };
const MID = 'keepsake', FK = 'keepsake-fork';
const MS = FR.w / 48; //               the midboss sprite's scale to the boss frame: 104 / 48 ~ 2.17 (its origin (24, 31) lands on ~(52, 67))
const EYE = MAN.eyes || [[-19, 0], [19, 0]];
const OPEN = 0, HALF = 1, SHUT = 2, EMPTY = 3;
const BLOOD = '#8a0c14', BLOOD_D = '#4a050a', VINYL = '#d6bfa2', VINYL_D = '#8a6e56';
const DASH = [5, 4], SOLID = [], ARC = [2, 4];
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
  ctx.restore();
}
function bigFork(x, y, a) { if (!spr(ctx, FK, 0, x, y, { rot: a - Math.PI / 2, s: 1.5 })) drawFork(ctx, x, y, a, 3); }

/** the fountain's marks: a 3 px chevron on each landing point from the tell's first frame, and the fork's real path */
function marks(e) {
  const st = e.st, k = st === 'tell' ? Math.min(1, e.wt / KB.tell) : 1, pul = .7 + .3 * Math.sin($.T * .35);
  rotXY(KB.wx, KB.wy, e.th, P);
  const wx = e.x + P[0], wy = e.y + P[1];
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < e.fn; i++) {
    if (st === 'fount' && e.wt >= e.fl[i]) continue;
    const x = e.fx[i], y = e.fy;
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
    ctx.beginPath(); ctx.moveTo(fx, hy + 2); ctx.lineTo(x, tip - 15); ctx.stroke();
    // the enemy-fire glow every enemy shot wears (D53), dim while it hangs, hot on its tell
    ctx.globalCompositeOperation = 'lighter';
    glow(x, tip - 7, 10 + 6 * telK, '150,255,40', .14 + .5 * telK);
    ctx.globalCompositeOperation = 'source-over';
    drawFork(ctx, x, tip - 15, Math.PI / 2, 1.5); // tines down, tip at `tip`
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

function under(e) {
  if (e.dead) return;
  mobile(e);
  if (e.st === 'dying') return;
  if ((e.st === 'tell' || e.st === 'fount') && e.fn) marks(e);
  if (e.st === 'aim') line(e, e.wt >= KB.aim - KB.lock, e.wt / KB.aim);
  if (e.st === 'boom') line(e, e.wt >= KB.boomTel - KB.boomLock, e.wt / KB.boomTel);
  if (e.st === 'fly') {
    line(e, true, 1);
    ctx.globalCompositeOperation = 'lighter';
    glow(e.bx, e.by, 22, '150,255,40', .55 * (.75 + .25 * Math.sin($.T * .5)));
    ctx.globalCompositeOperation = 'source-over';
    bigFork(e.bx, e.by, $.T * .45);
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
  if (sprReady(A.crier)) { spr(c, A.crier, p.dead ? 1 : 0, x, y, { ax: AX(A.crier, .5), ay: AY(A.crier, .5) }); return; }
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
  c.globalAlpha = .22; c.strokeStyle = '#ffb070'; c.lineWidth = 1; c.setLineDash(ARC);
  c.beginPath(); c.arc(px, py, KB.pLen, Math.PI / 2 - KB.pAmp, Math.PI / 2 + KB.pAmp); c.stroke();
  c.restore();
  pendXY(e.pa, Q);
  const bx = Q[0], by = Q[1], fl = e.rocker.flash > 0;
  if (sprReady(A.rocker)) {
    const f = e.pa > .4 ? 0 : e.pa < -.4 ? 2 : 1;
    spr(c, A.rocker, f, px, py, { ax: AX(A.rocker, .5), ay: AY(A.rocker, 0), rot: -e.pa });
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
  // ---- tier 1: the atlas (pre-rotated tilts; the death profile once it has tipped)
  if (sprReady(A.face)) {
    if (e.st === 'dying' && e.th > 1.1 && sprReady(A.death)) { spr(c, A.death, 0, bx, by, { ax: AX(A.death, .5), ay: AY(A.death, .5) }); drawParts(c, s, e); return; }
    const ti = tiltIx(e.th), ax = AX(A.face, FR.ox / FR.w), ay = AY(A.face, FR.oy / FR.h);
    spr(c, A.face, Math.min(3, cr) * TILTS.length + ti, bx, by, { ax, ay });
    if (sprReady(A.wound)) spr(c, A.wound, wd * TILTS.length + ti, bx, by, { ax, ay });
    if (sprReady(A.eyes)) spr(c, A.eyes, (p3 ? EMPTY : eye) * TILTS.length + ti, bx, by, { ax, ay });
    c.save(); c.translate(bx, by); c.rotate(e.th);
    if (p3) { crier(c, e); rocker(c, e, eye); }
    c.restore();
  } else {
    // ---- tiers 2-3: rotated at runtime (interim)
    c.save(); c.translate(bx, by); c.rotate(e.th);
    if (sprReady(MID)) {
      const f = (eye === EMPTY || p3 ? SHUT : eye) + (wd === 2 ? 3 : 0);
      spr(c, MID, f, -FR.ox, -FR.oy, { ax: 0, ay: 0, s: MS, smooth: true });
    } else procHead(c, p3 ? EMPTY : eye);
    if (p3) for (const [x, y] of EYE) { c.fillStyle = '#140808'; c.beginPath(); c.ellipse(x, y, 8, 6.5, 0, 0, Math.PI * 2); c.fill(); } // the sockets: the eyes are on the rocker now
    crack(c, e, cr);
    if (wd < 2) wedged(c, e, wd === 1 ? loose(e) : 0);
    if (p3) { crier(c, e); rocker(c, e, eye); }
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

/** the boss's art for the registry (./index.ts). Its sprites are boot art (sprites.ts loads every PNG): no warm-up */
export default { draw, under, warm: () => false };
