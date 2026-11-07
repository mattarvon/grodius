// @ts-nocheck
// Movement B's decor, one prop per gimmick (spec §3.3; build plan LS2-mv). Interim procedural art: how these look waits
// on round 2 (meridian, idiom; spec §3.3 "Waits on round 2"). Draw-only: no RNG (positions from hash and the gimmick's
// own cells, motion from $.T), no allocation in the loops.
//
// Every prop stays inside the terrain mass or within a few px of its edge. Collision is the terrain arrays and nothing
// else, so a prop standing out in the gap would read as a wall that isn't there.
import { $ } from '../state';
import { PH, TAU, W, ctx, hash } from '../core';
import { ceilAt, floorAt } from '../world';
import { glow } from './util';
import { MOVES } from '../biomes';
import { MOVE, ventNear } from '../terrainb';

/** how far the gimmick has blended in at world x (1 inside the band, 0 outside) */
const fade = (m, wx) => Math.max(0, Math.min(1, (wx - m.a) / m.blend, (m.z - wx) / m.blend));
const lit = () => { ctx.globalCompositeOperation = 'lighter'; };
const flat = () => { ctx.globalCompositeOperation = 'source-over'; };

/** ice B0: pale fracture lines up the Crevasse's teeth, into the ice */
function crevasse(m, sc, t, a) {
  const e = MOVE.tooth.every;
  for (let n = Math.floor(Math.max(sc, m.a) / e); n * e < Math.min(sc + W, m.z); n++) {
    const wx = n * e + e / 2, k = fade(m, wx), c = ceilAt(wx);
    if (k <= 0 || c < 16) continue;
    const x = wx - sc, h = hash(n * 1.7), sh = .55 + .45 * Math.sin(t * .05 + n * 1.3);
    ctx.globalAlpha = a * k * .9;
    ctx.strokeStyle = '#e6f6ff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, c - 2); ctx.lineTo(x + (h - .5) * 5, c * .62); ctx.lineTo(x + (h - .5) * 3 - 2, c * .3); ctx.lineTo(x + (h - .5) * 8, 0); ctx.stroke();
    ctx.globalAlpha = a * k * sh;
    ctx.strokeStyle = '#7ac4f4'; ctx.beginPath(); ctx.moveTo(x, c - 2); ctx.lineTo(x + (h - .5) * 5 + 3, c * .55); ctx.stroke();
  }
}
/** ice B1: a bright lip along each step's tread, a frost line under it */
function stairs(m, sc, t, a) {
  const e = MOVE.stair.every;
  for (let n = Math.floor(Math.max(sc, m.a) / e); n * e < Math.min(sc + W, m.z); n++) {
    const wx = n * e + e / 2, k = fade(m, wx), f = floorAt(wx), x0 = n * e - sc;
    if (k <= 0) continue;
    ctx.globalAlpha = a * k;
    ctx.fillStyle = '#e6f4ff'; ctx.fillRect(x0 + 3, f - 1, e - 6, 2);
    ctx.fillStyle = '#6aa8d8'; ctx.fillRect(x0 + 8, f + 5, e - 16, 1);
    ctx.fillStyle = '#3f78a8'; for (let q = 0; q < 5; q++) ctx.fillRect(x0 + 14 + q * 22, f + 9, 8, 1);
  }
}
/** acid B0: the tank wall's rungs going under, a rust line where the old level was */
function tank(m, sc, t, a) {
  const e = 58;
  for (let n = Math.floor(Math.max(sc, m.a) / e); n * e < Math.min(sc + W, m.z); n++) {
    const wx = n * e + 20, k = fade(m, wx), f = floorAt(wx), x = wx - sc;
    if (k <= 0) continue;
    const bob = Math.sin(t * .05 + n * 2.1) * 1.2;
    ctx.globalAlpha = a * k * .85;
    ctx.fillStyle = '#6a3a22'; ctx.fillRect(x, f + 4 + bob, 2, PH - f); ctx.fillRect(x + 10, f + 4 + bob, 2, PH - f);
    ctx.fillStyle = '#a8603a'; for (let q = 0; q < 4; q++) ctx.fillRect(x, f + 8 + q * 8 + bob, 12, 1);
    ctx.fillStyle = 'rgba(190,255,235,.8)'; ctx.fillRect(x - 3, f - 2 + bob, 18, 1);
  }
}
/** acid B1: dark creases up each fold, one teal bead running down the crease */
function folds(m, sc, t, a) {
  const e = MOVE.fold.every;
  for (let n = Math.floor(Math.max(sc, m.a) / e); n * e < Math.min(sc + W, m.z); n++) {
    const wx = n * e + e / 2, k = fade(m, wx), c = ceilAt(wx);
    if (k <= 0 || c < 20) continue;
    const x = wx - sc;
    ctx.globalAlpha = a * k;
    ctx.strokeStyle = 'rgba(6,30,26,.9)'; ctx.lineWidth = 1.4;
    for (const q of [-22, 0, 22]) { ctx.beginPath(); ctx.moveTo(x + q * 1.4, 0); ctx.quadraticCurveTo(x + q * 1.1, c * .6, x + q * .7, ceilAt(wx + q * .7) - 2); ctx.stroke(); }
    const ph = ((t + n * 37) % 120) / 120;
    ctx.fillStyle = '#7ff0d8'; ctx.fillRect(x - 1, c * ph - 2, 2, 3);
  }
}
/** fire B0: each spire's tip burns */
function spires(m, sc, t, a) {
  const e = MOVE.spire.every;
  for (let n = Math.floor(Math.max(sc, m.a) / e); n * e < Math.min(sc + W, m.z); n++) {
    const wx = n * e + e / 2, k = fade(m, wx), f = floorAt(wx), x = wx - sc;
    if (k <= 0 || f > PH - 50) continue;
    const fl = .7 + .3 * Math.sin(t * .11 + n * 1.9);
    ctx.globalAlpha = a * k;
    lit(); glow(x, f + 3, 11, '255,110,20', .55 * fl); flat();
    ctx.fillStyle = '#ffb347'; ctx.fillRect(x - 1, f, 2, 5);
    ctx.fillStyle = '#ff6a1a'; ctx.fillRect(x - 2, f + 5, 4, 7);
  }
}
/** fire B1: a barred, glowing mouth in the roof at each vent, so the jets have a place to come from */
function chimney(m, sc, t, a) {
  const V = MOVE.vent;
  for (let wx = ventNear(Math.max(sc, m.a)) - V.every; wx < Math.min(sc + W + V.every, m.z); wx += V.every) {
    const k = fade(m, wx), x = wx - sc, c = ceilAt(wx);
    if (k <= 0 || x < -40 || x > W + 40) continue;
    const fl = .7 + .3 * Math.sin(t * .09 + wx);
    ctx.globalAlpha = a * k;
    lit(); glow(x, c, 20, '255,90,20', .6 * fl); flat();
    ctx.fillStyle = '#ff6a1a'; ctx.fillRect(x - V.half, 0, V.half * 2, c);
    ctx.fillStyle = '#ffd08a'; ctx.fillRect(x - V.half + 3, 0, V.half * 2 - 6, c * .5);
    ctx.fillStyle = '#160704'; for (let q = -V.half; q <= V.half; q += 7) ctx.fillRect(x + q - 1, 0, 2, c + 2);
    ctx.fillRect(x - V.half - 3, c - 1, V.half * 2 + 6, 2);
  }
}
/** snot B0: the walls' contraction bands, travelling at the player faster than the terrain does: this is the march */
function throat(m, sc, t, a) {
  const e = MOVE.throat.every / 2, off = (t * .7) % e;
  for (let wx = Math.floor(sc / e) * e - off; wx < sc + W + e; wx += e) {
    const k = fade(m, wx);
    if (k <= 0) continue;
    const x = wx - sc, c = ceilAt(wx), f = floorAt(wx);
    ctx.globalAlpha = a * k * .8;
    ctx.fillStyle = '#7a4a18'; ctx.fillRect(x - 4, 0, 8, c - 1); ctx.fillRect(x - 4, f + 1, 8, PH - f);
    ctx.fillStyle = '#f4e49a'; ctx.fillRect(x - 6, c - 2, 12, 2); ctx.fillRect(x - 6, f, 12, 2);
  }
}
/** snot B1: a shine and a dimple on each polyp */
function polyps(m, sc, t, a) {
  const e = MOVE.polyp.every;
  for (let n = Math.floor(Math.max(sc, m.a) / e); n * e < Math.min(sc + W, m.z); n++) {
    const wx = n * e + e / 2, k = fade(m, wx), f = floorAt(wx), x = wx - sc;
    if (k <= 0 || f > PH - 50) continue;
    const r = 10 + 2 * Math.sin(t * .04 + n);
    ctx.globalAlpha = a * k;
    ctx.fillStyle = 'rgba(122,74,24,.8)'; ctx.beginPath(); ctx.ellipse(x, f + 12, r * .8, r * .45, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a1a0a'; ctx.beginPath(); ctx.ellipse(x, f + 12, r * .3, r * .16, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,250,200,.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x - 3, f + 16, 13, -2.5, -1.6); ctx.stroke();
  }
}
const PROP = { ice: [crevasse, stairs], acid: [tank, folds], fire: [spires, chimney], snot: [throat, polyps] };

/** drawBiomeDecor's last step: the prop of any movement B on screen, at the decor's alpha a */
export function drawMoveProps(sc, a) {
  for (let s = 0; s < MOVES.length; s++) {
    const m = MOVES[s];
    if (m && m.z > sc && m.a < sc + W) PROP[m.b][m.mv](m, sc, $.T, a);
  }
  ctx.globalAlpha = a;
}
