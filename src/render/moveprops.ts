// @ts-nocheck
// Movement B's decor, one prop per gimmick (spec §3.3; build plan LS2-mv). Interim procedural art: how these look waits
// on round 2 (meridian, idiom; spec §3.3 "Waits on round 2"). Draw-only: no RNG (positions from hash and the gimmick's
// own cells, motion from $.T), no allocation in the loops, one composite switch per prop pass.
//
// Every prop stays inside the terrain mass or within a few px of its edge. Collision is the terrain arrays and nothing
// else, so a prop standing out in the gap would read as a wall that isn't there.
import { $ } from '../state';
import { PH, TAU, W, ctx, hash } from '../core';
import { ceilAt, floorAt } from '../world';
import { glow } from './util';
import { MOVE, MOVES, moveK, narrowNear, ventNear } from '../terrainb';

/** the props' own sizes (draw only; the terrain's are terrainb.ts MOVE) */
const PROP_K = {
  /** acid B0: a ladder of rungs every 58 px, the old level's rust line 2 px above the water */
  tank: { every: 58, rung: 8 },
  /** acid B1: three creases per fold, this far either side of its middle */
  fold: [-22, 0, 22],
  /** fire B0: tips lower than this off PH are cut-down stubs, no flame */
  spireMin: 30,
  /** fire B1: the grille's depth into the roof above the mouth, its bar pitch */
  grille: { deep: 14, bar: 7 },
  /** snot B0: a contraction band's half width and depth into the wall; the wave's speed toward the player */
  band: { half: 7, deep: 14, speed: .12 },
};
const lit = () => { ctx.globalCompositeOperation = 'lighter'; };
const flat = () => { ctx.globalCompositeOperation = 'source-over'; };
/** the n range of cells `every` px wide that are both on screen and inside band m */
const n0 = (m, sc, e) => Math.floor(Math.max(sc, m.a) / e);
const inView = (m, sc, n, e) => n * e < Math.min(sc + W, m.z);

/** ice B0: pale fracture lines up the Crevasse's teeth, into the ice */
function crevasse(m, sc, t, a) {
  const e = MOVE.tooth.every;
  ctx.lineWidth = 1;
  for (let n = n0(m, sc, e); inView(m, sc, n, e); n++) {
    const wx = n * e + e / 2, k = moveK(m, wx), c = ceilAt(wx);
    if (k <= 0 || c < 16) continue;
    const x = wx - sc, h = hash(n * 1.7), sh = .55 + .45 * Math.sin(t * .05 + n * 1.3);
    ctx.globalAlpha = a * k * .9;
    ctx.strokeStyle = '#e6f6ff';
    ctx.beginPath(); ctx.moveTo(x, c - 2); ctx.lineTo(x + (h - .5) * 5, c * .62); ctx.lineTo(x + (h - .5) * 3 - 2, c * .3); ctx.lineTo(x + (h - .5) * 8, 0); ctx.stroke();
    ctx.globalAlpha = a * k * sh;
    ctx.strokeStyle = '#7ac4f4'; ctx.beginPath(); ctx.moveTo(x, c - 2); ctx.lineTo(x + (h - .5) * 5 + 3, c * .55); ctx.stroke();
  }
}
/** ice B1: a dark riser face at each step, a bright lip along the tread, a frost line under it */
function stairs(m, sc, t, a) {
  const e = MOVE.stair.every;
  for (let n = n0(m, sc, e); inView(m, sc, n, e); n++) {
    const wx = n * e + e / 2, k = moveK(m, wx), f = floorAt(wx), x0 = n * e - sc, fp = floorAt(n * e - 4);
    if (k <= 0) continue;
    ctx.globalAlpha = a * k;
    if (fp > f + 4) { ctx.fillStyle = '#16304a'; ctx.fillRect(x0, f, 4, fp - f); } // the riser this step climbs
    ctx.fillStyle = '#e6f4ff'; ctx.fillRect(x0 + 3, f, e - 6, 2);
    ctx.fillStyle = '#6aa8d8'; ctx.fillRect(x0 + 8, f + 5, e - 16, 1);
    ctx.fillStyle = '#3f78a8'; for (let q = 0; q < 5; q++) ctx.fillRect(x0 + 14 + q * 22, f + 9, 8, 1);
  }
}
/** acid B0: the tank wall's rungs going under, a rust line where the old level was */
function tank(m, sc, t, a) {
  const e = PROP_K.tank.every, r = PROP_K.tank.rung;
  for (let n = n0(m, sc, e); inView(m, sc, n, e); n++) {
    const wx = n * e + 20, k = moveK(m, wx), f = floorAt(wx), x = wx - sc;
    if (k <= 0) continue;
    const bob = Math.sin(t * .05 + n * 2.1) * 1.2;
    ctx.globalAlpha = a * k * .85;
    ctx.fillStyle = '#6a3a22'; ctx.fillRect(x, f + 4 + bob, 2, PH - f); ctx.fillRect(x + 10, f + 4 + bob, 2, PH - f);
    ctx.fillStyle = '#a8603a'; for (let q = 0; q < 4; q++) ctx.fillRect(x, f + r + q * r + bob, 12, 1);
    ctx.fillStyle = 'rgba(190,255,235,.8)'; ctx.fillRect(x - 3, f + Math.max(0, bob), 18, 1); // the waterline: never above the floor
  }
}
/** acid B1: dark creases up each fold, one teal bead running down the crease */
function folds(m, sc, t, a) {
  const e = MOVE.fold.every, Q = PROP_K.fold;
  ctx.strokeStyle = 'rgba(6,30,26,.9)'; ctx.lineWidth = 1.4; ctx.fillStyle = '#7ff0d8';
  for (let n = n0(m, sc, e); inView(m, sc, n, e); n++) {
    const wx = n * e + e / 2, k = moveK(m, wx), c = ceilAt(wx);
    if (k <= 0 || c < 20) continue;
    const x = wx - sc;
    ctx.globalAlpha = a * k;
    for (let i = 0; i < Q.length; i++) { const q = Q[i]; ctx.beginPath(); ctx.moveTo(x + q * 1.4, 0); ctx.quadraticCurveTo(x + q * 1.1, c * .6, x + q * .7, ceilAt(wx + q * .7) - 2); ctx.stroke(); }
    const ph = ((t + n * 37) % 120) / 120;
    ctx.fillRect(x - 1, c * ph - 2, 2, 3);
  }
}
/** fire B0: each spire's tip burns (glows in one 'lighter' pass, then the embers) */
function spires(m, sc, t, a) {
  const e = MOVE.spire.every, top = PH - PROP_K.spireMin;
  lit();
  for (let n = n0(m, sc, e); inView(m, sc, n, e); n++) {
    const wx = n * e + e / 2, k = moveK(m, wx), f = floorAt(wx);
    if (k <= 0 || f > top) continue;
    ctx.globalAlpha = a * k;
    glow(wx - sc, f + 3, 11, '255,110,20', .55 * (.7 + .3 * Math.sin(t * .11 + n * 1.9)));
  }
  flat();
  for (let n = n0(m, sc, e); inView(m, sc, n, e); n++) {
    const wx = n * e + e / 2, k = moveK(m, wx), f = floorAt(wx), x = wx - sc;
    if (k <= 0 || f > top) continue;
    ctx.globalAlpha = a * k;
    ctx.fillStyle = '#ffb347'; ctx.fillRect(x - 1.5, f, 3, 5);
    ctx.fillStyle = '#ff6a1a'; ctx.fillRect(x - 2.5, f + 5, 5, 7);
  }
}
/** fire B1: a dark, barred mouth in the roof at each vent, lit from below, so the jets have a place to come from. The
 *  grille sits in the roof mass just above the mouth (y ~20-34), clear of the HUD strip */
function chimney(m, sc, t, a) {
  const V = MOVE.vent, G = PROP_K.grille, x0 = ventNear(Math.max(sc, m.a)) - V.every, x1 = Math.min(sc + W + V.every, m.z);
  lit();
  for (let wx = x0; wx < x1; wx += V.every) {
    const k = moveK(m, wx), x = wx - sc;
    if (k <= 0 || x < -40 || x > W + 40) continue;
    ctx.globalAlpha = a * k;
    glow(x, ceilAt(wx), 16, '255,90,20', .45 * (.7 + .3 * Math.sin(t * .09 + wx)));
  }
  flat();
  for (let wx = x0; wx < x1; wx += V.every) {
    const k = moveK(m, wx), x = wx - sc, c = ceilAt(wx);
    if (k <= 0 || x < -40 || x > W + 40) continue;
    ctx.globalAlpha = a * k;
    ctx.fillStyle = '#3a0c04'; ctx.fillRect(x - V.half, c - G.deep, V.half * 2, G.deep);
    ctx.fillStyle = '#ff7a1a'; for (let q = -V.half + 3; q < V.half; q += G.bar) ctx.fillRect(x + q - 1, c - G.deep + 2, 2, G.deep - 2);
    ctx.fillStyle = '#160704'; ctx.fillRect(x - V.half - 3, c - 1, V.half * 2 + 6, 2);
  }
}
/** snot B0: contraction bands on the walls at each real narrow, their glow rolling from narrow to narrow toward the
 *  player: the march. Only the light moves; the walls are static (spec §3.3: terrain stays noise-only for the rebuild) */
function throat(m, sc, t, a) {
  const e = MOVE.throat.every, B = PROP_K.band;
  for (let wx = narrowNear(Math.max(sc, m.a)) - e; wx < Math.min(sc + W + e, m.z); wx += e) {
    const k = moveK(m, wx);
    if (k <= 0) continue;
    const x = wx - sc, c = ceilAt(wx), f = floorAt(wx), n = Math.round(wx / e), pulse = .35 + .65 * Math.max(0, Math.sin(t * B.speed + n * 1.3));
    ctx.globalAlpha = a * k;
    ctx.fillStyle = '#2a1208'; ctx.fillRect(x - B.half, c - B.deep, B.half * 2, B.deep); ctx.fillRect(x - B.half, f, B.half * 2, B.deep);
    ctx.globalAlpha = a * k * pulse;
    ctx.fillStyle = '#f4e49a'; ctx.fillRect(x - B.half, c - 3, B.half * 2, 3); ctx.fillRect(x - B.half, f, B.half * 2, 3);
  }
}
/** snot B1: a pale rim along each polyp's crown, a shine and a dimple */
function polyps(m, sc, t, a) {
  const e = MOVE.polyp.every;
  for (let n = n0(m, sc, e); inView(m, sc, n, e); n++) {
    const wx = n * e + e / 2, k = moveK(m, wx), f = floorAt(wx), x = wx - sc;
    if (k <= 0 || f > PH - 50) continue;
    const r = 10 + 2 * Math.sin(t * .04 + n);
    ctx.globalAlpha = a * k;
    ctx.strokeStyle = 'rgba(255,240,170,.75)'; ctx.lineWidth = 2; ctx.beginPath(); // the crown's rim, 1 px inside the floor
    for (let d = -28; d <= 28; d += 4) { const y = floorAt(wx + d) + 1; d === -28 ? ctx.moveTo(x + d, y) : ctx.lineTo(x + d, y); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(122,74,24,.8)'; ctx.beginPath(); ctx.ellipse(x, f + 12, r * .8, r * .45, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a1a0a'; ctx.beginPath(); ctx.ellipse(x, f + 12, r * .3, r * .16, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,250,200,.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x - 3, f + 16, 13, -2.5, -1.6); ctx.stroke();
  }
}
const PROP = { ice: [crevasse, stairs], acid: [tank, folds], fire: [spires, chimney], snot: [throat, polyps] };

/** drawBiomeDecor's last step: the prop of any movement B on screen, at the decor's alpha a. Leaves the canvas state as
 *  it found it */
export function drawMoveProps(sc, a) {
  ctx.save();
  for (let s = 0; s < MOVES.length; s++) {
    const m = MOVES[s], draw = m && PROP[m.b] && PROP[m.b][m.mv];
    if (draw && m.z > sc && m.a < sc + W) draw(m, sc, $.T, a);
  }
  ctx.restore();
}
