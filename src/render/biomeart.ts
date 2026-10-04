// @ts-nocheck
// Biome art: backgrounds, terrain textures, edge decor + signature set-pieces, ambient particles, hazards and fork gates.
// Draw-only. Everything static is pre-rendered once into small canvases (parallax tiles, sprites, 64px patterns);
// per frame we only blit those and add a bounded number of animated strokes. Set-pieces are placed by hashing world x,
// so they scroll with the terrain and come back identical every run. Enemy bullets are lime (#b6ff3a): nothing here
// uses lime. Acid is teal + sulfur, snot is cream/ochre pus, so the bullets stay the only lime thing on screen.
import { $ } from '../state';
import { FIRE, PH, TAU, W, ctx, hash } from '../core';
import { ceilAt, floorAt } from '../world';
import { mkTex } from '../textures';
import { glow, light } from './util';
import { BIOMES, biomeK } from '../biomes';

const FONT = 'Silkscreen, monospace';
const LW = 320; // parallax tile width
const rng = (s) => { s = (Math.abs(Math.floor(s)) % 2147483646) + 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const cnv = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); fn(x, w, h); return c; };
const lit = (f) => { ctx.globalCompositeOperation = 'lighter'; f(); ctx.globalCompositeOperation = 'source-over'; };

// ---------------- bodies ----------------
// limb tables: [elbowX, elbowY, handX, handY] for 2 arms (from shoulder) then 2 legs (from hip), in body units
const POSE = {
  scream: [[-4, -4, -6, -10], [4, -4, 6, -10], [-2, 5, -3, 11], [2, 5, 3, 11]],
  cross: [[-5, 0, -10, -1], [5, 0, 10, -1], [-1, 6, -1, 11], [1, 6, 1, 11]],
  hang: [[-2, 4, -2, 9], [2, 4, 3, 9], [-1, 6, -1, 12], [1, 6, 2, 12]],
  reach: [[-4, -3, -5, -9], [4, 2, 6, 6], [-2, 5, -4, 10], [2, 5, 4, 10]],
  slump: [[-4, 3, -7, 6], [4, 2, 8, 4], [-3, 4, -8, 5], [3, 4, 9, 6]],
  curl: [[-3, 2, 0, 0], [3, 2, 1, -1], [-3, 4, 0, 7], [3, 4, 1, 8]],
};
function figure(x, cx, cy, s, pose, col, head) {
  const P = POSE[pose];
  x.strokeStyle = col; x.lineCap = 'round'; x.lineJoin = 'round';
  x.lineWidth = 3.4 * s; x.beginPath(); x.moveTo(cx, cy - 6 * s); x.lineTo(cx, cy + 3 * s); x.stroke();
  x.lineWidth = 1.6 * s;
  for (let i = 0; i < 4; i++) { const [ex, ey, hx, hy] = P[i], oy = i < 2 ? cy - 5 * s : cy + 3 * s; x.beginPath(); x.moveTo(cx, oy); x.lineTo(cx + ex * s, oy + ey * s); x.lineTo(cx + hx * s, oy + hy * s); x.stroke(); }
  x.fillStyle = head || col; x.beginPath(); x.arc(cx, cy - 9 * s, 2.4 * s, 0, TAU); x.fill();
}
function face(x, cx, cy, s, eye, mouth) {
  x.fillStyle = eye; x.fillRect(cx - 1.3 * s, cy - 10 * s, .9 * s, .9 * s); x.fillRect(cx + .4 * s, cy - 10 * s, .9 * s, .9 * s);
  x.fillStyle = mouth; x.beginPath(); x.ellipse(cx, cy - 7.9 * s, .8 * s, 1.2 * s, 0, 0, TAU); x.fill();
}
function skull(x, cx, cy, s, bone) {
  x.fillStyle = bone; x.beginPath(); x.arc(cx, cy, 2.6 * s, 0, TAU); x.fill(); x.fillRect(cx - 1.4 * s, cy + 1.4 * s, 2.8 * s, 1.6 * s);
  x.fillStyle = '#0a0806'; x.beginPath(); x.arc(cx - 1 * s, cy - .2 * s, .75 * s, 0, TAU); x.arc(cx + 1 * s, cy - .2 * s, .75 * s, 0, TAU); x.fill();
  x.fillRect(cx - .25 * s, cy + .7 * s, .5 * s, .6 * s);
  for (let k = -1; k <= 1; k++) x.fillRect(cx + k * .8 * s - .2, cy + 1.9 * s, .35 * s, 1 * s);
}

// ---------------- terrain textures (64px patterns) ----------------
const PAT = {};
export function biomePat(b) {
  if (PAT[b]) return PAT[b];
  return (PAT[b] = mkTex((x) => {
    const r = rng(b.length * 977 + b.charCodeAt(0) * 13);
    const W3 = (f) => { for (const ox of [-64, 0, 64]) for (const oy of [-64, 0, 64]) { x.save(); x.translate(ox, oy); f(); x.restore(); } };
    if (b === 'ice') {
      x.fillStyle = '#4f7ea8'; x.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 16; i++) { const p = [r() * 64, r() * 64, r() * 64, r() * 64, r() * 64, r() * 64], c = r() < .5 ? `rgba(215,238,255,${.12 + r() * .25})` : `rgba(20,55,95,${.2 + r() * .25})`; W3(() => { x.fillStyle = c; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(p[2], p[3]); x.lineTo(p[4], p[5]); x.fill(); }); }
      // frozen blood veins trapped in the ice
      for (let i = 0; i < 3; i++) { const pts = [[r() * 64, r() * 64]]; for (let k = 0; k < 6; k++) pts.push([pts[k][0] + r() * 10 - 5, pts[k][1] + r() * 8]); W3(() => { x.strokeStyle = 'rgba(110,14,28,.55)'; x.lineWidth = 1; x.beginPath(); pts.forEach((p, k) => (k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.stroke(); }); }
      for (let i = 0; i < 7; i++) { const pts = [[r() * 64, r() * 64]]; for (let k = 0; k < 4; k++) pts.push([pts[k][0] + r() * 16 - 8, pts[k][1] + r() * 16 - 8]); W3(() => { x.strokeStyle = 'rgba(240,250,255,.7)'; x.lineWidth = .6; x.beginPath(); pts.forEach((p, k) => (k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.stroke(); }); }
      for (let i = 0; i < 10; i++) { x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(r() * 64 | 0, r() * 64 | 0, 1, 1); }
    } else if (b === 'acid') {
      // corroded, half-eaten hull plate: rust, pits, teal weeping, sulfur crust
      x.fillStyle = '#231710'; x.fillRect(0, 0, 64, 64);
      for (const py of [0, 32]) for (const px of [0, 32]) { const s = r() * 14 | 0; x.fillStyle = `rgb(${54 + s},${32 + s * .6 | 0},${20 + s * .3 | 0})`; x.fillRect(px + 1, py + 1, 30, 30); x.fillStyle = '#120a06'; x.fillRect(px + 3, py + 3, 1, 1); x.fillRect(px + 28, py + 3, 1, 1); }
      for (let i = 0; i < 26; i++) { const cx = r() * 64, cy = r() * 64, rr = .8 + r() * 3.2, rust = r() < .5; W3(() => { x.fillStyle = rust ? 'rgba(150,70,24,.55)' : 'rgba(8,5,3,.85)'; x.beginPath(); x.arc(cx, cy, rr, 0, TAU); x.fill(); if (!rust) { x.strokeStyle = 'rgba(70,215,185,.5)'; x.lineWidth = .6; x.stroke(); } }); }
      for (let i = 0; i < 6; i++) { const px = r() * 64 | 0, py = r() * 50, l = 6 + r() * 20; x.fillStyle = 'rgba(60,210,180,.35)'; x.fillRect(px, py, 1, l); x.fillStyle = 'rgba(150,255,230,.55)'; x.fillRect(px, py + l, 1, 1); }
      for (let i = 0; i < 8; i++) { const cx = r() * 64, cy = r() * 64; W3(() => { x.fillStyle = 'rgba(214,200,80,.32)'; x.beginPath(); x.ellipse(cx, cy, 2 + r() * 0, 1.2, 0, 0, TAU); x.fill(); }); }
    } else if (b === 'fire') {
      // basalt slag with live seams
      x.fillStyle = '#100807'; x.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 22; i++) { const cx = r() * 64, cy = r() * 64, w = 5 + r() * 10, h = 4 + r() * 7, v = r() * 22 | 0; W3(() => { x.fillStyle = `rgb(${30 + v},${18 + v * .5 | 0},${16 + v * .4 | 0})`; x.beginPath(); x.moveTo(cx - w / 2, cy); x.lineTo(cx - w / 4, cy - h / 2); x.lineTo(cx + w / 3, cy - h / 2); x.lineTo(cx + w / 2, cy + h / 5); x.lineTo(cx, cy + h / 2); x.fill(); }); }
      for (let i = 0; i < 3; i++) { let a = r() * TAU; const pts = [[r() * 64, r() * 64]]; for (let k = 0; k < 9; k++) { a += r() * 1.2 - .6; pts.push([pts[k][0] + Math.cos(a) * 5, pts[k][1] + Math.sin(a) * 5]); } W3(() => { x.lineCap = 'round'; for (const [w, c] of [[2.2, 'rgba(120,24,6,.7)'], [.9, 'rgba(255,110,26,.85)'], [.4, '#ffc860']]) { x.strokeStyle = c; x.lineWidth = w; x.beginPath(); pts.forEach((p, k) => (k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.stroke(); } }); }
    } else {
      // mucus-slathered, inflamed sinus lining: raw pink-red tissue under ochre snot, pus heads, veins
      x.fillStyle = '#3e2412'; x.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 12; i++) { const cx = r() * 64, cy = r() * 64, a = 4 + r() * 9, c = r() < .5 ? 'rgba(165,58,44,.45)' : 'rgba(120,36,30,.5)'; W3(() => { x.fillStyle = c; x.beginPath(); x.ellipse(cx, cy, a, a * .7, 0, 0, TAU); x.fill(); }); }
      for (let i = 0; i < 4; i++) { const pts = [[r() * 64, r() * 64]]; for (let k = 0; k < 5; k++) pts.push([pts[k][0] + r() * 14 - 7, pts[k][1] + r() * 14 - 7]); W3(() => { x.strokeStyle = 'rgba(70,6,10,.75)'; x.lineWidth = .9; x.beginPath(); pts.forEach((p, k) => (k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.stroke(); }); }
      for (let i = 0; i < 14; i++) { const cx = r() * 64, cy = r() * 64, a = 3 + r() * 8, rot = r() * 3; W3(() => { x.fillStyle = 'rgba(190,172,72,.38)'; x.beginPath(); x.ellipse(cx, cy, a * 1.15, a * .55, rot, 0, TAU); x.fill(); }); }
      for (let i = 0; i < 4; i++) { const cx = r() * 64, cy = r() * 64, a = 1.3 + r() * 1.8; W3(() => { x.fillStyle = '#9a2a1c'; x.beginPath(); x.arc(cx, cy, a + .9, 0, TAU); x.fill(); x.fillStyle = '#ecd88a'; x.beginPath(); x.arc(cx, cy, a, 0, TAU); x.fill(); x.fillStyle = '#fffbe0'; x.fillRect(cx - .6, cy - a * .6, 1, 1); }); }
      for (let i = 0; i < 12; i++) { x.fillStyle = 'rgba(255,255,220,.7)'; x.fillRect(r() * 64 | 0, r() * 64 | 0, 1, 1); }
    }
  }));
}
/** terrain fill overlay: call with the terrain path still set */
export function biomeTerrainFill(mtx) {
  const [b, k] = biomeK($.G.scroll + W / 2);
  if (!b) return 0;
  const p = biomePat(b);
  p.setTransform(mtx);
  ctx.globalAlpha = k;
  ctx.fillStyle = p;
  ctx.fill();
  ctx.globalAlpha = 1;
  return k;
}
/** scale for the derelict's darkness overlay: each biome keeps some dark but stays legible (BIOMES[b].dark) */
export const biomeDark = () => { if (!$.G) return 1; const [b, k] = biomeK($.G.scroll + W / 2); return b ? 1 - k * (1 - (BIOMES[b].dark ?? 1)) : 1; };
/** gore mist colour ('r,g,b') for the current biome, or null */
export const biomeMist = () => { if (!$.G) return null; const [b, k] = biomeK($.G.scroll + W / 2); return b && k > .5 ? BIOMES[b].mist : null; };
export const biomeEdge = () => { const [b, k] = biomeK($.G.scroll + W / 2); return b && k > .5 ? BIOMES[b].edge : null; };
/** splat colours for the current gore palette ([dark, mid, drip]) or null for the default red */
export const splatCols = () => { const [b, k] = biomeK($.G.scroll + W / 2); if (!b || k < .5) return null; const B = BIOMES[b].blood; return [B[1], B[0], B[0]]; };

// ---------------- parallax tiles ----------------
const LAY = {}, LPT = {};
function lay(key, fn) {
  if (LAY[key]) return LAY[key];
  const pts = (LPT[key] = []);
  return (LAY[key] = cnv(LW, PH, (x) => fn(x, rng(key.length * 7919 + key.charCodeAt(0) * 131 + key.charCodeAt(key.length - 1) * 17), pts)));
}
const tileOff = (sc, par) => Math.round(((sc * par) % LW + LW) % LW);
function drawLay(c, sc, par) { for (let x = -tileOff(sc, par); x < W; x += LW) ctx.drawImage(c, x, 0); }
function eachPt(key, sc, par, f) { for (let x0 = -tileOff(sc, par); x0 < W; x0 += LW) for (const p of LPT[key]) { const px = x0 + p.x; if (px > -60 && px < W + 60) f(px, p); } }
/** draw f at x, x-LW, x+LW so tile elements wrap seamlessly (all randomness must be rolled before) */
const wrap = (x, f) => { for (const o of [-LW, 0, LW]) { x.save(); x.translate(o, 0); f(); x.restore(); } };
const ridge = (i, a) => a.reduce((s, [amp, k, ph]) => s + amp * Math.sin(TAU * i / LW * k + ph), 0);

const L = {
  iceFar: (x, r) => {
    const g = x.createLinearGradient(0, PH * .3, 0, PH); g.addColorStop(0, '#132f48'); g.addColorStop(1, '#050d18');
    const top = (i) => PH * .44 + ridge(i, [[16, 2, 1], [9, 5, 2], [4, 11, 0]]) - Math.abs(Math.sin(TAU * i / LW * 7)) * 10;
    x.fillStyle = g; x.beginPath(); x.moveTo(0, PH); for (let i = 0; i <= LW; i += 4) x.lineTo(i, top(i)); x.lineTo(LW, PH); x.fill();
    x.strokeStyle = 'rgba(170,215,250,.35)'; x.lineWidth = 1; x.beginPath(); for (let i = 0; i <= LW; i += 4) i ? x.lineTo(i, top(i)) : x.moveTo(i, top(i)); x.stroke();
    for (let i = 0; i < 14; i++) { const cx = 8 + r() * (LW - 16); x.fillStyle = 'rgba(2,8,16,.5)'; x.fillRect(cx | 0, top(cx) + 6, 1, 20 + r() * 50); }
    // a distant line of crew, frozen standing up on the ridge
    for (let i = 0; i < 9; i++) { const cx = 10 + r() * (LW - 20); figure(x, cx, top(cx) - 2, .55, r() < .5 ? 'scream' : 'cross', 'rgba(6,14,26,.9)'); }
  },
  iceMid: (x, r, pts) => {
    for (let i = 0; i < 2; i++) {
      const cx = 80 + i * 160 + r() * 30, w = 58 + r() * 26, top = 70 + r() * 50, pose = ['scream', 'cross', 'reach'][(r() * 3) | 0], s = 1.7 + r() * .4, by = top + 58 + r() * 16;
      // crystal shard: wide base, broken peaks
      const sh = [[cx - w / 2, PH], [cx - w / 2 + 2, top + 40 + r() * 20], [cx - w * .3, top + 10 + r() * 14], [cx - w * .1, top + r() * 8], [cx + w * .12, top + 18 + r() * 10], [cx + w * .3, top + 6 + r() * 12], [cx + w / 2 - 2, top + 34 + r() * 24], [cx + w / 2, PH]];
      const path = () => { x.beginPath(); sh.forEach((p, k) => (k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); };
      path(); x.fillStyle = 'rgba(90,150,205,.2)'; x.fill();
      x.save(); path(); x.clip();
      const bg = x.createRadialGradient(cx, by - 6, 0, cx, by - 6, 30); bg.addColorStop(0, 'rgba(160,18,36,.5)'); bg.addColorStop(1, 'rgba(160,18,36,0)');
      x.fillStyle = bg; x.fillRect(cx - 40, by - 40, 80, 80);
      figure(x, cx, by, s, pose, 'rgba(46,76,112,.95)', '#506a80');
      face(x, cx, by, s, '#dff2ff', '#200208');
      x.fillStyle = '#6a0a18'; x.fillRect(cx - 1.3 * s, by - 9.1 * s, .6, 4 * s); x.fillRect(cx - .3, by - 7 * s, .8, 5 * s);
      x.fillStyle = 'rgba(200,230,255,.12)'; x.fillRect(cx - w / 2, top, w, PH);
      for (let k = 0; k < 5; k++) { x.fillStyle = `rgba(225,242,255,${.05 + r() * .12})`; x.beginPath(); x.moveTo(cx - w / 2 + r() * w, top + r() * 40); x.lineTo(cx - w / 2 + r() * w, top + 50 + r() * 90); x.lineTo(cx - w / 2 + r() * w, top + 30 + r() * 90); x.fill(); }
      x.restore();
      path(); x.strokeStyle = 'rgba(220,242,255,.45)'; x.lineWidth = 1; x.stroke();
      x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(cx - w / 2 + 4, top + 44, 1, PH);
      pts.push({ x: cx, y: top + 30, w });
    }
  },
  aur: null,
  acidFar: (x, r, pts) => {
    // digestion vats: glass cylinders of teal fluid with crew dissolving inside
    for (let i = 0; i < 2; i++) {
      const cx = 80 + i * 160 + r() * 16, w = 64 + r() * 14, top = 46 + r() * 30, lvl = top + 26 + r() * 20, pose = i ? 'slump' : 'curl';
      x.fillStyle = '#040b09'; x.fillRect(cx - w / 2, top, w, PH - top);
      const g = x.createLinearGradient(0, lvl, 0, PH); g.addColorStop(0, 'rgba(40,190,160,.42)'); g.addColorStop(1, 'rgba(6,50,44,.6)');
      x.fillStyle = g; x.fillRect(cx - w / 2, lvl, w, PH - lvl);
      for (let k = 0; k < 2; k++) {
        const bx = cx - 12 + k * 22 + r() * 6, by = lvl + 40 + r() * 50, s = 1.8 + r() * .4;
        figure(x, bx, by, s, k ? 'reach' : pose, 'rgba(70,40,30,.75)', 'rgba(70,40,30,.75)');
        x.strokeStyle = 'rgba(225,230,205,.75)'; x.lineWidth = .8; for (let q = 0; q < 4; q++) { x.beginPath(); x.arc(bx, by - 4 * s + q * 1.6 * s, 2.2 * s, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
        skull(x, bx, by - 9 * s, s * .85, 'rgba(225,230,205,.9)');
      }
      for (let k = 0; k < 14; k++) { x.strokeStyle = 'rgba(160,255,230,.35)'; x.lineWidth = .6; x.beginPath(); x.arc(cx - w / 2 + 4 + r() * (w - 8), lvl + 4 + r() * (PH - lvl), .8 + r() * 1.8, 0, TAU); x.stroke(); }
      x.fillStyle = 'rgba(150,255,225,.7)'; x.fillRect(cx - w / 2, lvl, w, 1);
      x.strokeStyle = 'rgba(110,190,170,.4)'; x.lineWidth = 1.2; x.strokeRect(cx - w / 2 + .5, top + .5, w - 1, PH);
      x.fillStyle = 'rgba(210,255,240,.1)'; x.fillRect(cx - w / 2 + 5, top + 4, 3, PH);
      x.fillStyle = '#2c1a0e'; x.fillRect(cx - w / 2 - 4, top - 8, w + 8, 9); x.fillRect(cx - w / 2 - 3, lvl - 12, w + 6, 3);
      x.fillStyle = '#5e3416'; x.fillRect(cx - w / 2 - 4, top - 8, w + 8, 2);
      x.fillStyle = '#1c100a'; x.fillRect(cx - 4, 0, 8, top - 8);
      pts.push({ x: cx, y: lvl, w });
    }
  },
  acidMid: (x, r) => {
    // corroded gantry, weeping teal
    const by = 22 + r() * 10;
    wrap(x, () => { x.fillStyle = '#1e130c'; x.fillRect(0, by, LW, 7); x.fillStyle = '#3e2412'; x.fillRect(0, by, LW, 1); });
    for (let i = 0; i < 18; i++) { const hx = r() * LW, hr = 1 + r() * 2.2; wrap(x, () => { x.fillStyle = '#040302'; x.beginPath(); x.arc(hx, by + 3.5, hr, 0, TAU); x.fill(); }); }
    for (let i = 0; i < 26; i++) { const dx = r() * LW | 0, l = 6 + r() * 46; wrap(x, () => { x.fillStyle = 'rgba(60,210,180,.22)'; x.fillRect(dx, by + 7, 1, l); x.fillStyle = 'rgba(150,255,230,.45)'; x.fillRect(dx, by + 7 + l, 1, 1); }); }
    for (let i = 0; i < 4; i++) { const sx = 20 + i * 80 + r() * 30; wrap(x, () => { x.strokeStyle = '#1a100a'; x.lineWidth = 4; x.beginPath(); x.moveTo(sx, by + 6); x.lineTo(sx + 24, by + 46); x.stroke(); }); }
    // a crewman hung from the gantry, the bottom half already gone
    const hx = 60 + r() * 200, s = 2;
    x.strokeStyle = '#140c08'; x.lineWidth = 1; x.beginPath(); x.moveTo(hx, by + 7); x.lineTo(hx, by + 30); x.stroke();
    figure(x, hx, by + 46, s, 'hang', 'rgba(80,44,32,.85)', 'rgba(80,44,32,.85)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; x.fillRect(hx - 12, by + 52, 24, 40); x.globalCompositeOperation = 'source-over';
    x.strokeStyle = 'rgba(225,228,200,.85)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(hx, by + 50); x.lineTo(hx, by + 58); x.moveTo(hx - 1, by + 52); x.lineTo(hx - 4, by + 64); x.moveTo(hx + 1, by + 52); x.lineTo(hx + 3, by + 66); x.stroke();
    skull(x, hx, by + 28, 1.7, 'rgba(225,228,200,.9)');
  },
  fireFar: (x, r, pts) => {
    // furnace wall: brick, incinerator mouths with the dead still standing in the fire
    x.fillStyle = '#0d0302'; x.fillRect(0, 60, LW, PH);
    for (let y = 64; y < PH; y += 7) for (let i = ((y / 7) % 2) * 8; i < LW; i += 16) { x.fillStyle = `rgba(${22 + r() * 14 | 0},${6 + r() * 4 | 0},3,1)`; x.fillRect(i + 1, y, 14, 6); }
    const sg = x.createLinearGradient(0, 60, 0, 150); sg.addColorStop(0, 'rgba(0,0,0,.9)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = sg; x.fillRect(0, 60, LW, 90);
    for (let i = 0; i < 3; i++) {
      const cx = 52 + i * 106 + r() * 16, w = 40 + r() * 10, h = 58 + r() * 14, by = PH * .66 + r() * 16;
      x.fillStyle = '#060101'; x.beginPath(); x.moveTo(cx - w / 2 - 4, by + 4); x.lineTo(cx - w / 2 - 4, by - h + w / 2); x.arc(cx, by - h + w / 2, w / 2 + 4, Math.PI, 0); x.lineTo(cx + w / 2 + 4, by + 4); x.fill();
      const g = x.createLinearGradient(0, by - h, 0, by); g.addColorStop(0, '#3a0802'); g.addColorStop(.5, '#b8380a'); g.addColorStop(1, '#ffb050');
      x.fillStyle = g; x.beginPath(); x.moveTo(cx - w / 2, by); x.lineTo(cx - w / 2, by - h + w / 2); x.arc(cx, by - h + w / 2, w / 2, Math.PI, 0); x.lineTo(cx + w / 2, by); x.fill();
      for (let k = 0; k < 3; k++) figure(x, cx - 12 + k * 12 + r() * 4, by - 14, 1.5 + r() * .3, r() < .6 ? 'scream' : 'reach', '#120302');
      x.fillStyle = '#1a0603'; for (let k = -2; k <= 2; k++) x.fillRect(cx + k * w / 5.2 - 1, by - h + 4, 2, h - 4);
      x.fillRect(cx - w / 2, by - h * .45, w, 2);
      pts.push({ x: cx, y: by - h * .4, w });
    }
  },
  fireMid: (x, r) => {
    // meat-hooks of charred dead
    for (let i = 0; i < 4; i++) {
      const cx = 30 + i * 80 + r() * 30, len = 20 + r() * 60, s = 1.6 + r() * .5, sway = r() * .2 - .1;
      x.strokeStyle = '#0a0302'; x.lineWidth = 1; x.setLineDash([2, 1]); x.beginPath(); x.moveTo(cx, 0); x.lineTo(cx, len); x.stroke(); x.setLineDash([]);
      x.save(); x.translate(cx, len); x.rotate(sway);
      figure(x, 0, 11 * s, s, 'hang', '#100403', '#160604');
      x.strokeStyle = 'rgba(255,110,30,.75)'; x.lineWidth = .7;
      for (let k = 0; k < 5; k++) { const yy = (2 + r() * 20) * s / 1.6; x.beginPath(); x.moveTo(-1.5 + r() * 3, yy); x.lineTo(-1.5 + r() * 3, yy + 2 + r() * 3); x.stroke(); }
      x.restore();
    }
  },
  snotFar: (x, r) => {
    // the sinus wall: inflamed mucosa, veins, weeping pores
    for (let i = 0; i < 16; i++) { const cx = r() * LW, cy = r() * PH, a = 14 + r() * 40, c = r() < .4 ? `rgba(120,34,26,${.12 + r() * .1})` : `rgba(120,108,30,${.14 + r() * .1})`; wrap(x, () => { x.fillStyle = c; x.beginPath(); x.ellipse(cx, cy, a, a * .7, 0, 0, TAU); x.fill(); }); }
    for (let i = 0; i < 7; i++) {
      let a = r() * TAU; const pts = [[r() * LW, r() * PH]]; for (let k = 0; k < 14; k++) { a += r() * .8 - .4; pts.push([pts[k][0] + Math.cos(a) * 7, pts[k][1] + Math.sin(a) * 7]); }
      const br = pts.slice(3).filter(() => r() < .3).map((p) => { const b = a + (r() < .5 ? 1 : -1) * (.6 + r() * .6); return [p, [p[0] + Math.cos(b) * 10, p[1] + Math.sin(b) * 10], [p[0] + Math.cos(b + .4) * 18, p[1] + Math.sin(b + .4) * 18]]; });
      wrap(x, () => { x.strokeStyle = 'rgba(100,14,12,.5)'; x.lineWidth = 1.3; x.lineCap = 'round'; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length - 1; k++) x.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2); x.stroke(); x.lineWidth = .7; for (const [p, q, e] of br) { x.beginPath(); x.moveTo(p[0], p[1]); x.quadraticCurveTo(q[0], q[1], e[0], e[1]); x.stroke(); } });
    }
    for (let i = 0; i < 30; i++) { const cx = r() * LW, cy = r() * PH, a = .8 + r() * 1.8; wrap(x, () => { x.fillStyle = 'rgba(150,120,40,.35)'; x.beginPath(); x.arc(cx, cy, a + 1, 0, TAU); x.fill(); x.fillStyle = 'rgba(16,10,2,.7)'; x.beginPath(); x.arc(cx, cy, a, 0, TAU); x.fill(); }); }
  },
  snotMid: (x, r) => {
    // mucus curtains sagging from the roof, and slime mounds heaving off the floor
    for (let i = 0; i < 5; i++) {
      const x0 = r() * LW, w = 30 + r() * 50, sag = 30 + r() * 70, n = 6, bot = [...Array(n + 1)].map((_, k) => sag * Math.sin(Math.PI * k / n) * (.6 + r() * .5));
      const drips = [...Array(3)].map(() => [x0 + r() * w, 6 + r() * 20]);
      wrap(x, () => {
        x.fillStyle = 'rgba(185,175,70,.2)'; x.beginPath(); x.moveTo(x0, 0); for (let k = 0; k <= n; k++) x.lineTo(x0 + w * k / n, bot[k]); x.lineTo(x0 + w, 0); x.fill();
        x.strokeStyle = 'rgba(245,240,170,.28)'; x.lineWidth = 1; x.beginPath(); for (let k = 0; k <= n; k++) k ? x.lineTo(x0 + w * k / n, bot[k] - 3) : x.moveTo(x0, bot[0]); x.stroke();
        for (const [dx, dl] of drips) { const by = bot[Math.round((dx - x0) / w * n)] || 0; x.fillStyle = 'rgba(200,190,80,.3)'; x.fillRect(dx, by - 2, 1.5, dl); x.beginPath(); x.arc(dx + .7, by + dl, 2, 0, TAU); x.fill(); }
      });
    }
    for (let i = 0; i < 4; i++) { const cx = r() * LW, w = 30 + r() * 40, h = 14 + r() * 26; wrap(x, () => { x.fillStyle = 'rgba(150,140,40,.2)'; x.beginPath(); x.ellipse(cx, PH, w, h, 0, Math.PI, 0); x.fill(); }); }
  },
};
// aurora curtain source: periodic in LW, padded by 20 so slices never run off the end
let AUR = null;
function aurora() {
  return AUR || (AUR = cnv(LW + 20, 110, (x) => {
    for (let i = 0; i < LW + 20; i += 2) {
      const h = 50 + 26 * Math.sin(TAU * i / LW * 3) + 14 * Math.sin(TAU * i / LW * 7 + 1) + 8 * Math.sin(TAU * i / LW * 17), m = .5 + .5 * Math.sin(TAU * i / LW * 2 + 2);
      const g = x.createLinearGradient(0, 108 - h, 0, 108);
      g.addColorStop(0, 'rgba(60,255,170,0)');
      g.addColorStop(.75, `rgba(${60 + m * 150 | 0},${255 - m * 150 | 0},${170 + m * 40 | 0},.35)`);
      g.addColorStop(1, `rgba(${180 + m * 70 | 0},255,220,.7)`);
      x.fillStyle = g; x.fillRect(i, 108 - h, 2, h);
    }
  }));
}
const GR = {};
let SHB = null;
function bgGrad(b) {
  if (GR[b]) return GR[b];
  const B = BIOMES[b], g = ctx.createLinearGradient(0, 0, 0, PH);
  g.addColorStop(0, B.bg[0]); g.addColorStop(1, B.bg[1]);
  return (GR[b] = g);
}

export function drawBiomeBG(sc) {
  const [b, k] = biomeK(sc + W / 2);
  if (!b) return;
  const t = $.T;
  ctx.globalAlpha = k;
  ctx.fillStyle = bgGrad(b); ctx.fillRect(0, 0, W, PH);
  if (b === 'ice') {
    const A = aurora(), off = ((sc * .04 + t * .15) % LW + LW) % LW;
    lit(() => { for (let j = 0; j < W / 20; j++) { const sx = Math.floor((off + j * 20) % LW), dy = -8 + Math.sin(t * .012 + j * .45) * 9 + Math.sin(t * .021 + j * 1.3) * 3; ctx.globalAlpha = k * (.55 + .25 * Math.sin(t * .01 + j * .3)); ctx.drawImage(A, sx, 0, 20, 110, j * 20, dy, 20, 110); } });
    ctx.globalAlpha = k;
    drawLay(lay('iceFar', L.iceFar), sc, .1);
    drawLay(lay('iceMid', L.iceMid), sc, .3);
    // a slow glint sliding over each frozen block
    eachPt('iceMid', sc, .3, (px, p) => { const g = ((t + p.x * 7) % 300) / 300; if (g < .12) { ctx.strokeStyle = `rgba(235,248,255,${.5 * (1 - g / .12)})`; ctx.lineWidth = 1.5; const gx = px - p.w / 2 + (g / .12) * p.w; ctx.beginPath(); ctx.moveTo(gx - 6, p.y); ctx.lineTo(gx + 6, p.y + 60); ctx.stroke(); } });
    const fg = ctx.createLinearGradient(0, PH * .6, 0, PH); fg.addColorStop(0, 'rgba(160,210,240,0)'); fg.addColorStop(1, 'rgba(160,210,240,.16)');
    ctx.fillStyle = fg; ctx.fillRect(0, PH * .6, W, PH * .4);
  } else if (b === 'acid') {
    drawLay(lay('acidFar', L.acidFar), sc, .12);
    eachPt('acidFar', sc, .12, (px, p) => {
      lit(() => glow(px, p.y, p.w * .7, '40,200,170', (.18 + .06 * Math.sin(t * .05 + p.x)) * k));
      for (let q = 0; q < 4; q++) { const ph = ((t * (.4 + q * .13) + q * 37 + p.x) % 120) / 120, bx = px - p.w / 2 + 8 + ((q * 17 + p.x) % (p.w - 16)); ctx.strokeStyle = 'rgba(170,255,235,.5)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.arc(bx + Math.sin(ph * 9 + q) * 2, PH - ph * (PH - p.y - 4), 1 + ph * 1.5, 0, TAU); ctx.stroke(); }
    });
    drawLay(lay('acidMid', L.acidMid), sc, .3);
    // sulfur fumes
    lit(() => { for (let i = 0; i < 4; i++) { const fx = ((i * 157 - sc * .2 + t * .3) % (W + 160) + W + 160) % (W + 160) - 80; glow(fx, PH - 30 - i * 14 + Math.sin(t * .01 + i) * 8, 70, '170,170,60', .12 * k); } });
  } else if (b === 'fire') {
    drawLay(lay('fireFar', L.fireFar), sc, .1);
    eachPt('fireFar', sc, .1, (px, p) => { const fl = .75 + .25 * Math.sin(t * .23 + p.x) * Math.sin(t * .071 + p.x * 3); lit(() => glow(px, p.y, p.w * 1.2, '255,90,20', .28 * fl * k)); light(px, p.y, 50, .5 * fl * k); });
    drawLay(lay('fireMid', L.fireMid), sc, .28);
    lit(() => { glow(W * .5, PH + 30, 300, '255,70,10', .4 * k); for (let x = 0; x < W; x += 40) glow(x + 20, PH, 40 + 14 * Math.sin(t * .06 + x), '255,140,30', .25 * k); });
    // ash drifting up, deterministic
    ctx.fillStyle = 'rgba(120,100,90,.6)';
    for (let i = 0; i < 28; i++) { const ax = ((hash(i * 3.1) * 1000 - sc * .5 + Math.sin(t * .02 + i) * 6) % W + W) % W, ay = PH - ((t * (.3 + hash(i) * .5) + hash(i * 7) * PH) % PH); ctx.fillRect(ax | 0, ay | 0, 1 + (i % 3 === 0), 1); }
    // heat shimmer: re-blit the lower background in slightly offset strips
    // (one snapshot into a buffer, then strips from the buffer: no canvas-onto-itself draws)
    const y0 = (PH * .45) | 0, hh = PH - y0, SB = SHB || (SHB = cnv(W, hh, () => {}));
    const sx = SB.getContext('2d'); sx.clearRect(0, 0, W, hh); sx.drawImage(ctx.canvas, 0, y0, W, hh, 0, 0, W, hh);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    for (let y = 0; y < hh; y += 5) { const dx = Math.round(Math.sin(t * .17 + (y + y0) * .35) * 1.3); if (dx) ctx.drawImage(SB, 0, y, W, 5, dx, y + y0, W, 5); }
    ctx.restore();
  } else {
    drawLay(lay('snotFar', L.snotFar), sc, .1);
    // throbbing inflammation
    lit(() => glow(W * .5, PH * .5, 260, '150,40,20', (.12 + .06 * Math.sin(t * .045)) * k));
    // pus blisters on the wall: inflate, glisten, burst, scab, regrow
    for (let n = Math.floor((sc * .25 - 60) / 90); n < (sc * .25 + W + 60) / 90; n++) {
      const hh = hash(n * 3.71 + .2); if (hh > .7) continue;
      const cx = n * 90 + hh * 50 - sc * .25, cy = 50 + hash(n * 1.93) * (PH - 100), R = 7 + hash(n * 5.1) * 11, per = 260 + hh * 260, ph = ((t + hh * 997) % per) / per;
      if (ph < .82) {
        const rr = R * Math.pow(ph / .82, .55) + 1;
        ctx.fillStyle = 'rgba(150,40,28,.5)'; ctx.beginPath(); ctx.arc(cx, cy, rr + 2, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(222,200,110,.55)'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(245,235,180,.55)'; ctx.beginPath(); ctx.arc(cx + rr * .15, cy + rr * .1, rr * .55, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,240,.7)'; ctx.fillRect(cx - rr * .45, cy - rr * .5, Math.max(1, rr * .25), 1);
        if (ph > .7 && (t >> 1) % 2) { ctx.strokeStyle = 'rgba(255,240,190,.6)'; ctx.lineWidth = .7; ctx.stroke(); }
      } else {
        const q = (ph - .82) / .18;
        ctx.fillStyle = `rgba(90,20,14,${.6 * (1 - q * .5)})`; ctx.beginPath(); ctx.arc(cx, cy, R * .6, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(230,215,130,${.7 * (1 - q)})`;
        for (let d = 0; d < 8; d++) { const a = d / 8 * TAU + hh, dd = R * (.6 + q * 2.2); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * dd, cy + Math.sin(a) * dd + q * q * 18, 1.6 * (1 - q * .5), 0, TAU); ctx.fill(); }
      }
    }
    drawLay(lay('snotMid', L.snotMid), sc, .3);
    // long mucus ropes: background strands that sag and sway
    for (let n = Math.floor((sc * .45 - 40) / 70); n < (sc * .45 + W + 40) / 70; n++) {
      const hh = hash(n * 2.17 + 9); if (hh > .55) continue;
      const x0 = n * 70 + hh * 40 - sc * .45, sw = Math.sin(t * .015 + n) * 8, len = PH * (.45 + hh * .7);
      ctx.strokeStyle = 'rgba(200,190,90,.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, -2); ctx.quadraticCurveTo(x0 + sw, len * .55, x0 + sw * .4, len); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,250,200,.22)'; ctx.lineWidth = .6; ctx.stroke();
      const dp = ((t * .6 + hh * 400) % 200) / 200;
      ctx.fillStyle = 'rgba(225,210,110,.55)'; ctx.beginPath(); ctx.arc(x0 + sw * .4 * dp, len * dp, 1.7, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x0 + sw * .4, len + 2, 2.4, 3.2, 0, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------- set-piece sprites (cached) ----------------
const SPR = {};
function spr(key, w, h, fn) { return SPR[key] || (SPR[key] = cnv(w, h, (x) => fn(x, rng(key.length * 31 + key.charCodeAt(key.length - 1) * 101)))); }
// a crewman frozen into a block of ice, mid-scream
const iceBlock = (v) => spr('ice' + v, 48, 64, (x, r) => {
  const pose = ['scream', 'cross', 'reach'][v], s = 1.9;
  const pts = [[3, 64], [1, 22 + r() * 8], [8 + r() * 6, 4 + r() * 6], [24, r() * 4], [38 + r() * 4, 6 + r() * 6], [47, 18 + r() * 10], [45, 64]];
  const path = () => { x.beginPath(); pts.forEach((p, k) => (k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); };
  path(); x.fillStyle = 'rgba(120,175,220,.75)'; x.fill();
  x.save(); path(); x.clip();
  const bg = x.createRadialGradient(24, 34, 0, 24, 34, 22); bg.addColorStop(0, 'rgba(150,16,32,.75)'); bg.addColorStop(1, 'rgba(150,16,32,0)'); x.fillStyle = bg; x.fillRect(0, 0, 48, 64);
  figure(x, 24, 40, s, pose, '#1e3250', '#5c788e');
  face(x, 24, 40, s, '#eaf8ff', '#1a0206');
  x.fillStyle = '#7a0a18'; x.fillRect(24 - 1.3 * s, 40 - 9.2 * s, .7, 4 * s); x.fillRect(24 + .4 * s, 40 - 9.2 * s, .7, 3 * s);
  x.strokeStyle = '#7a0c1c'; x.lineWidth = 1; x.beginPath(); x.moveTo(24, 26); x.lineTo(23 + r() * 2, 34); x.moveTo(25, 26); x.lineTo(27, 31); x.stroke();
  x.fillStyle = 'rgba(210,236,255,.3)'; x.fillRect(0, 0, 48, 64);
  for (let k = 0; k < 5; k++) { x.fillStyle = `rgba(240,250,255,${.1 + r() * .2})`; x.beginPath(); x.moveTo(r() * 48, r() * 64); x.lineTo(r() * 48, r() * 64); x.lineTo(r() * 48, r() * 64); x.fill(); }
  x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = .6; for (let k = 0; k < 3; k++) { let px = r() * 48, py = r() * 64; x.beginPath(); x.moveTo(px, py); for (let q = 0; q < 4; q++) { px += r() * 14 - 7; py += r() * 14 - 7; x.lineTo(px, py); } x.stroke(); }
  x.restore();
  path(); x.strokeStyle = '#eaf7ff'; x.lineWidth = 1; x.stroke();
  x.fillStyle = 'rgba(255,255,255,.8)'; x.fillRect(6, 24, 1, 30);
});
// half-dissolved skeleton slumped in the acid
const skel = (v) => spr('skel' + v, 52, 40, (x, r) => {
  const B = '#dcd8bc', cx = 24, cy = 24;
  x.strokeStyle = B; x.lineCap = 'round'; x.lineWidth = 1.6;
  x.beginPath(); x.moveTo(cx, cy + 12); x.quadraticCurveTo(cx - 3, cy, cx + 2, cy - 8); x.stroke(); // spine
  x.lineWidth = 1;
  for (let k = 0; k < 5; k++) { const y = cy - 6 + k * 3; x.beginPath(); x.ellipse(cx, y, 6 - k * .5, 2.4, 0, Math.PI * .05, Math.PI * .95, true); x.stroke(); }
  // flesh still hanging on
  x.fillStyle = '#7a3a28'; for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(cx - 6 + r() * 12, cy - 6 + r() * 12, 2 + r() * 2, 1 + r() * 2, r() * 3, 0, TAU); x.fill(); }
  x.fillStyle = '#a85a40'; for (let k = 0; k < 3; k++) x.fillRect(cx - 5 + r() * 10 | 0, cy - 4 + r() * 8 | 0, 1, 2 + r() * 4);
  // reaching arm
  x.strokeStyle = B; x.lineWidth = 1.2; x.beginPath(); x.moveTo(cx + 5, cy - 6); x.lineTo(cx + 13, cy - 13 - v * 3); x.lineTo(cx + 18 + v * 3, cy - 22); x.stroke();
  x.lineWidth = .7; for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(cx + 18 + v * 3, cy - 22); x.lineTo(cx + 19 + v * 3 + k * 2, cy - 26); x.stroke(); }
  x.lineWidth = 1.2; x.beginPath(); x.moveTo(cx - 5, cy - 6); x.lineTo(cx - 12, cy + 2); x.lineTo(cx - 18, cy + 8); x.stroke();
  x.save(); x.translate(cx - 1, cy - 13); x.rotate(-.35 + v * .5); skull(x, 0, 0, 1.9, B); x.restore();
  // fizz where meat meets bone
  x.fillStyle = 'rgba(120,250,220,.85)'; for (let k = 0; k < 10; k++) x.fillRect(cx - 8 + r() * 16 | 0, cy - 12 + r() * 20 | 0, 1, 1);
});
// melting crewman for a ceiling hook
const melt = spr.bind(null, 'melt', 24, 46, (x, r) => {
  figure(x, 12, 19, 1.6, 'hang', '#6e3424', '#7e4030');
  x.fillStyle = '#9a5038'; for (let k = 0; k < 6; k++) x.fillRect(8 + r() * 8 | 0, 12 + r() * 20 | 0, 1, 3 + r() * 10);
  x.fillStyle = 'rgba(80,220,190,.8)'; for (let k = 0; k < 6; k++) x.fillRect(8 + r() * 8 | 0, 4 + r() * 30 | 0, 1, 1);
  x.strokeStyle = '#dcd8bc'; x.lineWidth = .9; x.beginPath(); x.moveTo(10, 30); x.lineTo(10, 40); x.moveTo(14, 30); x.lineTo(15, 42); x.stroke();
  skull(x, 12, 4.6, 1.3, '#dcd8bc');
});
// charred hanging body
const charred = (v) => spr('char' + v, 26, 46, (x, r) => {
  const s = 1.7;
  figure(x, 14, 6 + 11 * s - 4, s, 'hang', '#c04a10', '#d05a18');
  figure(x, 12.4, 6 + 11 * s - 4.4, s, 'hang', '#0e0403', '#140604');
  x.strokeStyle = 'rgba(255,120,30,.9)'; x.lineWidth = .7;
  for (let k = 0; k < 7; k++) { const yy = 4 + r() * 34; x.beginPath(); x.moveTo(10 + r() * 6, yy); x.lineTo(10 + r() * 6, yy + 1 + r() * 3); x.stroke(); }
  x.fillStyle = '#ffd070'; x.fillRect(12, 5, 1, 1); x.fillRect(14, 5, 1, 1);
});
// body cocooned in a mucus sac
const cocoon = (v) => spr('coc' + v, 34, 50, (x, r) => {
  x.fillStyle = 'rgba(190,175,70,.55)'; x.beginPath(); x.ellipse(17, 26, 14, 22, 0, 0, TAU); x.fill();
  figure(x, 17, 30, 1.5, v ? 'curl' : 'scream', 'rgba(60,34,16,.9)', '#b8a078');
  face(x, 17, 30, 1.5, '#1a0a04', '#3a0606');
  x.fillStyle = 'rgba(215,200,100,.5)'; x.beginPath(); x.ellipse(17, 26, 14, 22, 0, 0, TAU); x.fill();
  x.strokeStyle = 'rgba(120,20,16,.6)'; x.lineWidth = .7; for (let k = 0; k < 4; k++) { let px = 8 + r() * 18, py = 8 + r() * 30; x.beginPath(); x.moveTo(px, py); for (let q = 0; q < 3; q++) { px += r() * 8 - 4; py += r() * 8; x.lineTo(px, py); } x.stroke(); }
  x.strokeStyle = 'rgba(250,245,190,.7)'; x.lineWidth = 1; x.beginPath(); x.ellipse(17, 26, 13, 21, 0, Math.PI * 1.05, Math.PI * 1.45); x.stroke();
  x.fillStyle = '#fffbe0'; x.fillRect(9, 12, 2, 1);
});

// ---------------- animated bits ----------------
function flame(x, y, h, w, seed, a = 1) {
  const t = $.T, fl = .72 + .28 * Math.sin(t * .41 + seed * 7) + .14 * Math.sin(t * .93 + seed * 3), hh = h * fl, sw = Math.sin(t * .23 + seed * 5) * w * .7;
  for (const [m, c] of [[1, `rgba(255,50,10,${.8 * a})`], [.66, `rgba(255,140,30,${.9 * a})`], [.34, `rgba(255,236,160,${.95 * a})`]]) {
    const ww = w * m, top = hh * (.55 + m * .45);
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - ww, y); ctx.quadraticCurveTo(x - ww * .7 + sw * .3, y - top * .5, x + sw * m, y - top); ctx.quadraticCurveTo(x + ww * .7 + sw * .3, y - top * .5, x + ww, y); ctx.fill();
  }
}
function pustule(x, y, R, ph, s, seed) {
  // s = 1 on floor (grows up), -1 on ceiling. ph in [0,1): swell .. pop .. scab
  if (ph < .8) {
    const r = R * (.35 + .65 * Math.pow(ph / .8, .7)), cy = y - s * r * .55, wob = ph > .65 ? Math.sin($.T * 1.3 + seed) * .5 : 0;
    ctx.fillStyle = '#8a2418'; ctx.beginPath(); ctx.ellipse(x, y - s * 1, r + 2.5, r * .55 + 1.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d4b850'; ctx.beginPath(); ctx.arc(x + wob, cy, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#efe0a0'; ctx.beginPath(); ctx.arc(x + wob + r * .1, cy - s * r * .15, r * .62, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fffbe2'; ctx.beginPath(); ctx.arc(x + wob, cy - s * r * .4, Math.max(.8, r * .26), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(140,30,20,.8)'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(x - r * .8, y - s * r * .2); ctx.quadraticCurveTo(x - r * .4, cy, x - r * .1, cy - s * r * .6); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(x + wob - r * .5, cy - r * .45, 1, 1);
  } else {
    const q = (ph - .8) / .2;
    ctx.fillStyle = '#5a0e0a'; ctx.beginPath(); ctx.ellipse(x, y - s, R * .8, R * .35, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c03a24'; ctx.beginPath(); ctx.ellipse(x, y - s, R * .45, R * .2, 0, 0, TAU); ctx.fill();
    if (q < .6) {
      const e = q / .6;
      ctx.fillStyle = `rgba(240,225,140,${1 - e})`;
      for (let d = 0; d < 7; d++) { const a = -Math.PI / 2 * s + (d - 3) * .32, v = R * (1.2 + (d % 3) * .5) * e * 2.2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * v, y + Math.sin(a) * v * 1.3 + s * e * e * 10, 1.4 + (d % 2), 0, TAU); ctx.fill(); }
    }
  }
}

// ---------------- edge decor + set-pieces ----------------
/** a crust/glaze band hugging the floor (s=1) or roof (s=-1): bulges `out` px into the corridor, sinks `dep` px into the wall */
function edgeBand(sc, s, out, dep, fill) {
  const ys = [];
  for (let x = -4; x <= W + 4; x += 3) { const wx = x + sc, e = s > 0 ? floorAt(wx) : ceilAt(wx); ys.push(e); }
  ctx.beginPath();
  for (let i = 0, x = -4; x <= W + 4; x += 3, i++) { const y = ys[i] - s * out(x + sc); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  for (let i = ys.length - 1, x = -4 + 3 * (ys.length - 1); i >= 0; x -= 3, i--) ctx.lineTo(x, ys[i] + s * dep);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function slots(sc, size, f) { for (let n = Math.floor((sc - 80) / size); n <= Math.floor((sc + W + 80) / size); n++) f(n, hash(n * 7.31 + size * .013)); }

export function drawBiomeDecor(sc) {
  const [b, k] = biomeK(sc + W / 2);
  if (!b || k < .05) return;
  const t = $.T;
  ctx.globalAlpha = k;
  if (b === 'ice') {
    // signature: crew frozen into blocks of ice, rooted in floor or roof
    slots(sc, 230, (n, hs) => {
      if (hs > .55) return;
      const wx = n * 230 + 40 + hs * 140, x = wx - sc, S = iceBlock((hs * 37 | 0) % 3);
      if (hash(n * 2.3) < .6) { const f = Math.min(floorAt(wx), floorAt(wx + 24), floorAt(wx + 46)); if (f < PH + 20) ctx.drawImage(S, x | 0, (f - S.height + 10) | 0); }
      else { const c = Math.max(ceilAt(wx), ceilAt(wx + 24), ceilAt(wx + 46)); if (c > -20) { ctx.save(); ctx.translate(x | 0, (c - 10) | 0); ctx.scale(1, -1); ctx.drawImage(S, 0, -S.height); ctx.restore(); } }
    });
    for (const s of [1, -1]) edgeBand(sc, s, (wx) => .8 + 1.8 * hash(Math.floor(wx / 3)) + 1.2 * Math.sin(wx * .07), 2.5, '#e6f4ff');
    for (let wx = Math.floor(sc / 12) * 12; wx < sc + W + 12; wx += 12) {
      const x = wx - sc, c = ceilAt(wx), f = floorAt(wx), h = hash(wx * .37);
      if (c > -2) {
        if (h < .62) { const len = 5 + h * 18, l2 = len * (.5 + hash(wx) * .3); ctx.fillStyle = '#a8d4f4'; ctx.beginPath(); ctx.moveTo(x - 3, c); ctx.lineTo(x + 3, c); ctx.lineTo(x, c + len); ctx.fill(); ctx.fillStyle = '#6a9cc8'; ctx.beginPath(); ctx.moveTo(x, c); ctx.lineTo(x + 3, c); ctx.lineTo(x, c + len); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, c, 1, l2); if (h < .2) { ctx.fillStyle = '#a8d4f4'; ctx.beginPath(); ctx.moveTo(x + 5, c); ctx.lineTo(x + 8, c); ctx.lineTo(x + 6.5, c + len * .45); ctx.fill(); } }
      }
      if (f < PH + 2) {
        if (h > .93) { // a frozen hand clawing out of the floor
          ctx.strokeStyle = '#9ab8cc'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, f + 2); ctx.lineTo(x + 2, f - 9); ctx.stroke();
          ctx.lineWidth = .9; for (let q = -2; q <= 2; q++) { ctx.beginPath(); ctx.moveTo(x + 2, f - 9); ctx.lineTo(x + 2 + q * 1.4, f - 13 - (q === 0 ? 1 : 0)); ctx.stroke(); }
          ctx.fillStyle = '#7a0c1c'; ctx.fillRect(x + 1, f - 7, 1, 2);
        }
      }
      if (h > .82 && ((t + h * 600) % 160) < 10 && c > -2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 3, c + 2, 1, 1); ctx.fillRect(x + 2, c + 3, 3, 1); }
    }
  } else if (b === 'acid') {
    // signature: skeletons half-dissolved in the pool (drawn under the acid surface) + melting corpses on hooks
    slots(sc, 250, (n, hs) => {
      const wx = n * 250 + 30 + hs * 160, x = wx - sc;
      if (hs < .5) {
        const f = floorAt(wx + 24), S = skel((hs * 41 | 0) % 2);
        if (f < PH + 10) {
          lit(() => glow(x + 24, f, 34, '40,210,170', .35 * k));
          ctx.drawImage(S, x | 0, (f - S.height + 12) | 0);
          for (let q = 0; q < 5; q++) { const ph = ((t * (.7 + q * .1) + q * 29 + n * 13) % 60) / 60; ctx.strokeStyle = `rgba(190,255,235,${.8 * (1 - ph)})`; ctx.lineWidth = .7; ctx.beginPath(); ctx.arc(x + 12 + q * 7 + Math.sin(ph * 8 + q) * 1.5, f - 2 - ph * 22, .8 + ph * 1.6, 0, TAU); ctx.stroke(); }
        }
      } else if (hs < .78) {
        const c = ceilAt(wx); if (c < -10) return;
        const len = 10 + hash(n) * 22, sw = Math.sin(t * .02 + n) * 1.5;
        ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, c); ctx.lineTo(x + sw, c + len); ctx.stroke();
        ctx.drawImage(melt(), (x + sw - 12) | 0, (c + len) | 0);
        for (let q = 0; q < 3; q++) { const ph = ((t * 1.1 + q * 41 + n * 7) % 70) / 70, fy = c + len + 42 + ph * ph * 120; if (fy < floorAt(wx)) { ctx.fillStyle = q ? 'rgba(90,220,190,.9)' : '#9a5038'; ctx.fillRect(x + sw - 2 + q * 2, fy, 1, 2 + ph * 2); } }
      }
    });
    // the pool: wobbling teal surface along the floor, foam, popping bubbles
    ctx.beginPath(); let first = true;
    for (let x = -4; x <= W + 4; x += 4) { const wx = x + sc, y = floorAt(wx) - 3 + Math.sin(t * .07 + wx * .12) * 1.1; first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; }
    ctx.lineTo(W + 4, PH + 10); ctx.lineTo(-4, PH + 10); ctx.closePath();
    ctx.fillStyle = 'rgba(24,150,126,.55)'; ctx.fill();
    ctx.beginPath(); first = true;
    for (let x = -4; x <= W + 4; x += 4) { const wx = x + sc, y = floorAt(wx) - 3 + Math.sin(t * .07 + wx * .12) * 1.1; first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; }
    ctx.strokeStyle = '#86f2da'; ctx.lineWidth = 1; ctx.stroke();
    for (let wx = Math.floor(sc / 14) * 14; wx < sc + W + 14; wx += 14) {
      const x = wx - sc, c = ceilAt(wx), f = floorAt(wx), h = hash(wx * .37), sy = f - 3 + Math.sin(t * .07 + wx * .12) * 1.1;
      if (f < PH + 4) {
        if (h > .55) { ctx.fillStyle = '#d8d068'; ctx.fillRect(x + (h * 9 | 0), sy - 1, 2, 1); ctx.fillRect(x + (h * 5 | 0), sy, 1, 1); }
        if (h < .4) { const ph = ((t * (.8 + h) + h * 400) % 90) / 90; if (ph < .85) { ctx.strokeStyle = 'rgba(200,255,240,.8)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.arc(x + 4, sy - ph * 2, .6 + ph * 2.4, Math.PI, 0); ctx.stroke(); } else { ctx.fillStyle = '#e8e070'; ctx.fillRect(x + 1, sy - 4, 1, 1); ctx.fillRect(x + 7, sy - 3, 1, 1); ctx.fillRect(x + 4, sy - 6, 1, 1); } }
        if (h < .12) lit(() => glow(x, sy, 12, '40,210,170', .3 * k));
      }
      if (c > -2) {
        ctx.fillStyle = 'rgba(30,16,8,.8)'; ctx.fillRect(x, c, 3, 3 + h * 8); ctx.fillStyle = 'rgba(70,210,180,.4)'; ctx.fillRect(x + 1, c, 1, 2 + h * 10);
        if (h > .72) { const d = ((t + h * 200) % 90) / 90, fy = c + 3 + d * d * 80; if (fy < f) { ctx.fillStyle = '#7ff0d8'; ctx.fillRect(x + 1, fy, 1, 2 + d * 2); } }
      }
    }
  } else if (b === 'fire') {
    // signature: charred crew strung up on chains, still burning
    slots(sc, 170, (n, hs) => {
      const wx = n * 170 + 30 + hs * 110, x = wx - sc;
      if (hs < .62) {
        const c = ceilAt(wx); if (c < -30) return;
        const len = 14 + hash(n * 1.7) * 40, sw = Math.sin(t * .021 + n * 2) * .14, S = charred((hs * 29 | 0) % 2);
        ctx.save(); ctx.translate(x, c); ctx.rotate(sw);
        ctx.strokeStyle = '#1a0a06'; ctx.lineWidth = 1.4; ctx.setLineDash([2, 1.4]); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, len); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#3a2a24'; ctx.fillRect(-1.5, len - 1, 3, 2);
        ctx.drawImage(S, -18, len, 36, 64);
        lit(() => { glow(0, len + 40, 34, '255,110,20', .5); flame(-3, len + 62, 24, 6, n); flame(4, len + 56, 18, 4.5, n + 1.7); flame(0, len + 34, 13, 5, n + 3.1); flame(-6, len + 26, 10, 3, n + 4.4); flame(5, len + 20, 8, 2.5, n + 5.2); });
        ctx.restore();
        light(x, c + len + 44, 60, .9);
        for (let q = 0; q < 3; q++) { const ph = ((t * .7 + q * 31 + n * 11) % 80) / 80; ctx.fillStyle = `rgba(40,30,28,${.5 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x + Math.sin(ph * 5 + q) * 4, c + len + 26 - ph * 34, 2 + ph * 4, 0, TAU); ctx.fill(); }
      } else if (hs < .84) {
        // floor pyre: a heap of the dead on a grate, burning
        const f = floorAt(wx); if (f > PH + 10) return;
        ctx.fillStyle = '#0c0403';
        for (let q = 0; q < 5; q++) { ctx.save(); ctx.translate(x + q * 5 - 10, f - 4 - (q % 2) * 4); ctx.rotate(q * 1.1 + hs); ctx.fillRect(-8, -1.6, 16, 3.2); ctx.restore(); }
        ctx.fillStyle = '#1a0806'; ctx.beginPath(); ctx.arc(x + 3, f - 12, 3, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffb040'; ctx.fillRect(x + 2, f - 13, 1, 1); ctx.fillRect(x + 4, f - 13, 1, 1);
        lit(() => { for (let q = 0; q < 5; q++) flame(x - 10 + q * 5, f - 2, 14 + (q % 3) * 6, 3.5, n * 3 + q); glow(x, f - 10, 30, '255,90,10', .5); });
        light(x, f - 10, 50, .9);
      }
    });
    // molten seam along the floor, soot along the roof
    ctx.beginPath(); let first = true;
    for (let x = -4; x <= W + 4; x += 4) { const y = floorAt(x + sc) + .5; first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; }
    ctx.strokeStyle = '#ff6a14'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = `rgba(255,220,130,${.6 + .3 * Math.sin(t * .1)})`; ctx.lineWidth = .8; ctx.stroke();
    for (let wx = Math.floor(sc / 28) * 28; wx < sc + W + 28; wx += 28) {
      const x = wx - sc, f = floorAt(wx), c = ceilAt(wx), h = hash(wx * .37);
      if (f < PH + 2) { lit(() => glow(x, f + 3, 14 + 6 * Math.sin(t * .17 + wx), '255,100,20', .4 * k)); if (h < .25) light(x, f, 40, .7); if (h > .7) { const ph = ((t * 1.3 + h * 300) % 50) / 50; ctx.fillStyle = FIRE[(h * 9 | 0) % 5]; ctx.fillRect(x + Math.sin(ph * 6) * 3, f - ph * 26, 1, 1); } }
      if (c > -2) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.ellipse(x + 14, c + 1, 15, 3 + h * 3, 0, 0, TAU); ctx.fill(); if (h < .3) { ctx.fillStyle = '#ff8a2a'; ctx.fillRect(x + 6 + h * 20, c + 1, 2, 1); } }
    }
  } else if (b === 'snot') {
    // mucus glaze riding the walls
    for (const s of [1, -1]) { edgeBand(sc, s, (wx) => 1.5 + 1.5 * Math.sin(wx * .09 + t * .03) + 2 * hash(Math.floor(wx / 16)), 4, 'rgba(206,190,84,.72)'); edgeBand(sc, s, (wx) => .5 + 1.5 * Math.sin(wx * .09 + t * .03) + 2 * hash(Math.floor(wx / 16)), -1, 'rgba(255,248,200,.35)'); }
    // signature: a pulsing boil cluster that squirts pus, or a crewman cocooned in snot
    slots(sc, 240, (n, hs) => {
      const wx = n * 240 + 40 + hs * 150, x = wx - sc, top = hash(n * 4.4) < .4, e = top ? ceilAt(wx) : floorAt(wx), s = top ? -1 : 1;
      if (top ? e < -10 : e > PH + 10) return;
      if (hs < .5) {
        ctx.fillStyle = '#7a2016'; ctx.beginPath(); ctx.ellipse(x, e, 22, 9, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#4a0a08'; ctx.lineWidth = .8; for (let q = 0; q < 5; q++) { ctx.beginPath(); ctx.moveTo(x - 20 + q * 9, e); ctx.quadraticCurveTo(x - 14 + q * 7, e - s * 6, x - 8 + q * 4, e - s * (3 + q)); ctx.stroke(); }
        const per = 280, ph = ((t + hs * 900) % per) / per;
        pustule(x - 12, e, 5, (ph + .3) % 1, s, n); pustule(x + 13, e, 6, (ph + .6) % 1, s, n + 1); pustule(x + 4, e - s * 3, 4, (ph + .8) % 1, s, n + 2);
        const R = 10 * (1 + .07 * Math.sin(t * .12)) * (ph < .86 ? .8 + ph * .25 : .7), cy = e - s * R * .7;
        ctx.fillStyle = '#9a2a1a'; ctx.beginPath(); ctx.arc(x, cy + s * 2, R + 2.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#d2b448'; ctx.beginPath(); ctx.arc(x, cy, R, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ecdc98'; ctx.beginPath(); ctx.arc(x + 1, cy - s * 2, R * .66, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff8d8'; ctx.beginPath(); ctx.arc(x, cy - s * R * .45, R * .3, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(150,30,20,.85)'; ctx.lineWidth = .7; for (let q = 0; q < 3; q++) { ctx.beginPath(); ctx.moveTo(x - R + q * 3, cy + s * R * .5); ctx.quadraticCurveTo(x - R * .5 + q * 2, cy, x - 2 + q * 2, cy - s * R * .5); ctx.stroke(); }
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - R * .5, cy - R * .5, 2, 1);
        if (ph > .86) { // SQUIRT
          const q0 = (ph - .86) / .14, hx = x, hy = cy - s * R;
          for (let d = 0; d < 14; d++) { const tt = q0 * 1.6 - d * .05; if (tt < 0) continue; const px = hx + tt * 46 * (n % 2 ? 1 : -1) * .6, py = hy - s * (tt * 70 - tt * tt * 60); ctx.fillStyle = d % 3 ? '#e8d880' : '#fff4c0'; ctx.beginPath(); ctx.arc(px, py, 2.2 - d * .1, 0, TAU); ctx.fill(); }
        }
      } else if (hs < .8) {
        const S = cocoon((hs * 23 | 0) % 2), pul = 1 + .04 * Math.sin(t * .07 + n);
        ctx.save(); ctx.translate(x, e); ctx.scale(pul, s * pul);
        ctx.strokeStyle = 'rgba(210,200,90,.7)'; ctx.lineWidth = 1.2; for (let q = -1; q <= 1; q++) { ctx.beginPath(); ctx.moveTo(q * 8, 0); ctx.lineTo(q * 4, -6); ctx.stroke(); }
        ctx.drawImage(S, -17, -S.height - 2); ctx.restore();
      }
    });
    for (let wx = Math.floor(sc / 14) * 14; wx < sc + W + 14; wx += 14) {
      const x = wx - sc, c = ceilAt(wx), f = floorAt(wx), h = hash(wx * .37);
      if (c > -2 && h < .5) {
        // snot drip: stretches, bulges, lets go
        const per = 150 + h * 260, ph = ((t + h * 977) % per) / per, maxl = 6 + h * 30, l = maxl * Math.min(1, ph / .75), bx = x + Math.sin(t * .02 + wx) * 1.5;
        ctx.strokeStyle = 'rgba(205,195,85,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, c); ctx.quadraticCurveTo(x, c + l * .6, bx, c + l); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,250,200,.6)'; ctx.lineWidth = .6; ctx.stroke();
        if (ph < .75) { const r = 1.6 + ph * 1.8; ctx.fillStyle = '#dccc64'; ctx.beginPath(); ctx.ellipse(bx, c + l + r * .6, r * .85, r * 1.15, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fffbe0'; ctx.fillRect(bx - r * .4, c + l, 1, 1); }
        else { const q = (ph - .75) / .25, fy = c + maxl + 4 + q * q * 140; if (fy < f) { ctx.fillStyle = '#dccc64'; ctx.beginPath(); ctx.ellipse(bx, fy, 2, 3, 0, 0, TAU); ctx.fill(); } }
      }
      if (h > .64) { const per = 300 + h * 300, ph = ((t + h * 1931) % per) / per, R = 2.5 + (h - .64) * 18; if (f < PH && hash(wx * 2.1) < .6) pustule(x + 5, f, R, ph, 1, wx); else if (c > 0) pustule(x + 5, c, R, ph, -1, wx); }
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------- ambient, hazards, fork gates ----------------
export function drawFX(haz, amb, gatePos) {
  const [bk] = $.G ? biomeK($.G.scroll + W / 2) : [null];
  for (const p of amb) {
    if (p.em) { ctx.fillStyle = p.c; ctx.fillRect(p.x | 0, p.y | 0, 1, 1 + (p.l & 1)); }
    else if (p.bub) { ctx.strokeStyle = 'rgba(120,235,210,.6)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(225,220,120,.7)'; ctx.fillRect(p.x - p.s * .5, p.y - p.s * .6, 1, 1); }
    else if (p.glob) { ctx.strokeStyle = 'rgba(210,195,90,.45)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 6 - p.s * 2); ctx.stroke(); ctx.fillStyle = '#d8c460'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s * .7, p.s, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff6d0'; ctx.fillRect(p.x - p.s * .3, p.y - p.s * .5, 1, 1); }
    else if (p.s > 1) { ctx.fillStyle = p.c; ctx.fillRect(p.x - 1, p.y, 3, 1); ctx.fillRect(p.x, p.y - 1, 1, 3); }
    else { ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 1, 1); }
  }
  if (bk === 'fire') lit(() => { for (let i = 0; i < amb.length; i += 3) { const p = amb[i]; if (p.em) glow(p.x, p.y, 3, '255,120,30', .35); } });
  const sc = $.G ? $.G.scroll : 0, T = $.T;
  for (const h of haz) {
    if (h.k === 'icicle') {
      const warn = h.t < 50, sh = warn ? Math.sin(h.t * 1.7) * (h.t / 50) * 1.6 : 0, x = h.x + sh, y = h.y, L = h.len;
      if (warn) {
        const f = floorAt(h.x + sc);
        if ((h.t >> 2) % 2) { ctx.fillStyle = 'rgba(255,70,60,.45)'; for (let yy = y + L + 4; yy < f; yy += 6) ctx.fillRect(h.x - .5, yy, 1, 3); ctx.fillStyle = '#ff4a3a'; ctx.beginPath(); ctx.moveTo(h.x - 3, f - 1); ctx.lineTo(h.x + 3, f - 1); ctx.lineTo(h.x, f - 5); ctx.fill(); }
        ctx.fillStyle = '#ffffff'; for (let q = 0; q < 3; q++) { const d = ((h.t * 2 + q * 13) % 30); ctx.fillRect(h.x - 4 + q * 4, y + d * .8, 1, 1); }
      } else { ctx.strokeStyle = 'rgba(220,240,255,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 2, y - 2); ctx.lineTo(x - 2, y - 10 - h.vy * 3); ctx.moveTo(x + 2, y - 2); ctx.lineTo(x + 2, y - 8 - h.vy * 3); ctx.stroke(); }
      ctx.fillStyle = '#9fd0f4'; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.lineTo(x + 1, y + L * .6); ctx.lineTo(x, y + L); ctx.lineTo(x - 2, y + L * .5); ctx.fill();
      ctx.fillStyle = '#5c90c0'; ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + L); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y, 1, L * .7);
      ctx.strokeStyle = warn && (h.t >> 2) % 2 ? '#ff5a4a' : '#eaf7ff'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x, y + L); ctx.lineTo(x + 5, y); ctx.stroke();
    } else if (h.k === 'geyser') {
      const span = h.y - h.top, R = span * .62;
      if (!h.reach) {
        const q = Math.min(1, h.t / 70), pul = .5 + .5 * Math.sin(h.t * (.3 + q * .6));
        ctx.strokeStyle = `rgba(100,240,210,${.12 + .25 * q * pul})`; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.strokeRect(h.x - 5, h.y - R, 10, R); ctx.setLineDash([]);
        lit(() => glow(h.x, h.y, 10 + q * 16, '40,220,180', .3 + .4 * q * pul));
        ctx.fillStyle = '#1aa88a'; ctx.beginPath(); ctx.ellipse(h.x, h.y, 4 + q * 5, 1.5 + q * 4 + pul * q, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#e0e070'; for (let d = 0; d < 4; d++) { const ph = ((h.t * 1.5 + d * 9) % 14) / 14; ctx.fillRect(h.x - 5 + d * 3, h.y - 2 - ph * (4 + q * 10), 1, 1); }
        continue;
      }
      const y0 = h.y - h.reach;
      lit(() => {
        for (let q = 0; q < 3; q++) { const w = 7 - q * 2.2, c = ['rgba(30,200,165,.5)', 'rgba(130,245,215,.6)', 'rgba(235,255,245,.8)'][q]; ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(h.x - w, h.y); for (let yy = h.y; yy > y0; yy -= 5) ctx.lineTo(h.x - w - Math.sin(yy * .3 + T * .6 + q) * 1.6, yy); ctx.lineTo(h.x, y0 - 2); for (let yy = y0; yy < h.y; yy += 5) ctx.lineTo(h.x + w + Math.sin(yy * .27 + T * .5 + q) * 1.6, yy); ctx.lineTo(h.x + w, h.y); ctx.fill(); }
        glow(h.x, (y0 + h.y) / 2, 34, '40,220,180', .45);
      });
      ctx.fillStyle = '#e4e07a'; for (let d = 0; d < 6; d++) { const a = d + T * .3; ctx.beginPath(); ctx.arc(h.x + Math.cos(a) * 5, y0 + Math.sin(a * 1.3) * 2, 1.6, 0, TAU); ctx.fill(); }
      light(h.x, (y0 + h.y) / 2, 50, .8);
    } else if (h.k === 'jet') {
      const R = h.span * .55, d = h.dir; // d=1 fires down from the roof, d=-1 up from the floor
      if (!h.reach) {
        const q = Math.min(1, h.t / 60), pul = .5 + .5 * Math.sin(h.t * (.3 + q * .8));
        ctx.strokeStyle = `rgba(255,120,40,${.12 + .3 * q * pul})`; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.strokeRect(h.x - 5, d > 0 ? h.y : h.y - R, 10, R); ctx.setLineDash([]);
        ctx.fillStyle = '#2a0c06'; ctx.fillRect(h.x - 6, d > 0 ? h.y - 1 : h.y - 2, 12, 3);
        ctx.fillStyle = q < .5 ? '#a02a08' : q < .85 ? '#ff7a1a' : '#fff0b0'; ctx.fillRect(h.x - 4, d > 0 ? h.y : h.y - 1, 8, 1);
        lit(() => glow(h.x, h.y, 8 + q * 18, '255,110,20', .3 + .5 * q * pul));
        continue;
      }
      const L = h.reach, y0 = d > 0 ? h.y : h.y - L;
      lit(() => {
        for (const [m, c] of [[1, 'rgba(255,50,10,.6)'], [.66, 'rgba(255,150,30,.75)'], [.33, 'rgba(255,245,190,.9)']]) {
          const w = 7 * m; ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(h.x - w, h.y);
          for (let s = 0; s <= 1; s += .125) ctx.lineTo(h.x - w * (1 - s * .7) - Math.sin(s * 9 + T * .9) * 2 * m, h.y + d * L * s);
          ctx.lineTo(h.x, h.y + d * (L + 4)); for (let s = 1; s >= 0; s -= .125) ctx.lineTo(h.x + w * (1 - s * .7) + Math.sin(s * 8 + T * .8 + 1) * 2 * m, h.y + d * L * s);
          ctx.fill();
        }
        glow(h.x, y0 + L / 2, 36, '255,110,20', .55);
      });
    } else if (h.k === 'strand') {
      const wx = h.x + sc, c = ceilAt(wx), f = floorAt(wx), sw = Math.sin(T * .05 + h.ph) * 6, th = .45 + .55 * (h.hp / 3);
      const P0x = h.x, P1x = h.x + sw * 3.5, P1y = (c + f) / 2 + 18, at = (u) => [(1 - u) * (1 - u) * P0x + 2 * (1 - u) * u * P1x + u * u * P0x, (1 - u) * (1 - u) * c + 2 * (1 - u) * u * P1y + u * u * f];
      ctx.beginPath(); for (let i = 0; i <= 12; i++) { const [px, py] = at(i / 12); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(120,110,30,.9)'; ctx.lineWidth = 4.6 * th; ctx.stroke();
      ctx.strokeStyle = 'rgba(214,200,92,.95)'; ctx.lineWidth = 3.2 * th; ctx.stroke();
      // beads of snot along the rope
      for (let i = 1; i < 7; i++) { const u = i / 7, [px, py] = at(u), r = (1.6 + 1.4 * (.5 + .5 * Math.sin(i * 1.7 + h.ph + T * .04))) * th; ctx.fillStyle = '#dccb66'; ctx.beginPath(); ctx.ellipse(px, py, r, r * 1.3, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,230,.9)'; ctx.fillRect(px - r * .5, py - r * .6, 1, 1); }
      ctx.strokeStyle = 'rgba(255,252,215,.65)'; ctx.lineWidth = .7; ctx.beginPath(); for (let i = 0; i <= 12; i++) { const [px, py] = at(i / 12); i ? ctx.lineTo(px - 1, py) : ctx.moveTo(px - 1, py); } ctx.stroke();
      // a glint sliding down it
      const g = (T * .012 + h.ph) % 1, [gx, gy] = at(g); ctx.fillStyle = '#ffffff'; ctx.fillRect(gx - 1, gy - 1, 2, 2); lit(() => glow(gx, gy, 6, '255,250,200', .4));
      // the sag drips
      const dp = ((T + h.ph * 99) % 50) / 50, [mx, my] = at(.5); ctx.fillStyle = '#dccb66'; ctx.beginPath(); ctx.ellipse(mx, my + 3 + dp * dp * 30, 1.6, 2.2, 0, 0, TAU); ctx.fill();
    }
  }
  const G = $.G;
  if (G && G.fork) drawGates(G.fork, gatePos);
}

// ---------------- fork gates ----------------
const MOTIF = {
  ice: (x, y, r, i, t) => { const ph = ((t * .6 + i * 23) % 80) / 80; ctx.fillStyle = '#eaf7ff'; ctx.fillRect(x - r + ((i * 37) % (2 * r)) + Math.sin(ph * 6 + i) * 2, y - r + ph * 2 * r, 1 + (i % 2), 1 + (i % 2)); },
  acid: (x, y, r, i, t) => { const ph = ((t * .5 + i * 19) % 80) / 80; ctx.strokeStyle = 'rgba(150,255,230,.85)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.arc(x - r + ((i * 37) % (2 * r)), y + r - ph * 2 * r, 1 + ph * 2, 0, TAU); ctx.stroke(); },
  fire: (x, y, r, i, t) => { const ph = ((t * .9 + i * 17) % 60) / 60; ctx.fillStyle = FIRE[i % 5]; ctx.fillRect(x - r + ((i * 37) % (2 * r)) + Math.sin(ph * 7 + i) * 3, y + r - ph * 2 * r, 1, 2); },
  snot: (x, y, r, i, t) => { const ph = ((t * .4 + i * 29) % 90) / 90, px = x - r + ((i * 37) % (2 * r)); ctx.strokeStyle = 'rgba(220,205,100,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, y - r); ctx.lineTo(px, y - r + ph * r * 1.4); ctx.stroke(); ctx.fillStyle = '#e8d878'; ctx.beginPath(); ctx.arc(px, y - r + ph * r * 1.4 + 1.5, 1.8, 0, TAU); ctx.fill(); },
};
const PREV = { ice: ['iceMid', L.iceMid], acid: ['acidFar', L.acidFar], fire: ['fireFar', L.fireFar], snot: ['snotFar', L.snotFar] };
function drawGates(f, gatePos) {
  const T = $.T, P = $.P, left = Math.max(0, (900 - f.t) / 900);
  for (let i = 0; i < 2; i++) {
    const p = gatePos(i), b = f.opts[i], B = BIOMES[b], open = Math.min(1, f.t / 40);
    const d = P ? Math.hypot(P.x - p.x, P.y - p.y) : 999, sel = Math.max(0, Math.min(1, 1 - (d - 24) / 90));
    const r = 24 * open * (1 + .12 * sel + .03 * Math.sin(T * .1 + i)), rx = Math.max(.5, r * .8), ry = Math.max(.5, r * .95);
    lit(() => glow(p.x, p.y, r * 2.8, B.rgb, .35 + .3 * sel));
    // the biome itself, seen through the hole
    ctx.save(); ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = B.bg[1]; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    ctx.fillStyle = `rgba(${B.rgb},.22)`; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    const [key, fn] = PREV[b], S = lay(key, fn);
    ctx.drawImage(S, 0, PH * .2, LW, PH * .8, p.x - r * 1.3, p.y - r * 1.05, r * 2.6, r * 2.3);
    for (let q = 0; q < 10; q++) MOTIF[b](p.x, p.y, r, q, T);
    const vg = ctx.createRadialGradient(p.x, p.y, r * .3, p.x, p.y, r); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(.7, 'rgba(0,0,0,.15)'); vg.addColorStop(1, 'rgba(0,0,0,.8)');
    ctx.fillStyle = vg; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    ctx.restore();
    // rings with teeth
    for (let q = 0; q < 3; q++) {
      const rr = Math.max(.5, r + 2 - q * 3.5), rot = T * (.03 + q * .02) * (i ? -1 : 1) * (q % 2 ? -1 : 1);
      ctx.strokeStyle = B.col; ctx.globalAlpha = (.95 - q * .25) * open; ctx.lineWidth = 2.2 - q * .55;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, rr * .86, rr * 1.0, 0, rot, rot + TAU * .8); ctx.stroke();
      if (q === 0) { ctx.beginPath(); for (let k = 0; k < 12; k++) { const a = rot + k / 12 * TAU, c = Math.cos(a), s = Math.sin(a); ctx.moveTo(p.x + c * rr * .86, p.y + s * rr); ctx.lineTo(p.x + c * (rr * .86 + 3.5), p.y + s * (rr + 3.5)); } ctx.lineWidth = 1; ctx.stroke(); }
    }
    // countdown ring draining
    ctx.globalAlpha = .9 * open; ctx.strokeStyle = left < .34 && (T >> 3) % 2 ? '#ff4a3a' : '#e8f1ff'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r * .86 + 7, r + 7, 0, -Math.PI / 2, -Math.PI / 2 + TAU * left); ctx.stroke();
    ctx.globalAlpha = 1;
    light(p.x, p.y, 60, .9);
    if (open > .9) {
      // name plate, pointing at its gate
      ctx.font = `8px ${FONT}`; const nw = ctx.measureText(B.name).width; ctx.font = `7px ${FONT}`; const tw = Math.max(nw, ctx.measureText(B.tag).width) + 12, px = p.x - r - 14 - tw, py = p.y - 11;
      ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(px, py, tw, 22);
      ctx.fillStyle = B.col; ctx.fillRect(px, py, 2, 22); ctx.globalAlpha = .35 + .4 * sel; ctx.fillRect(px, py + 21, tw, 1); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(px + tw, py + 7); ctx.lineTo(px + tw + 6 + sel * 3, py + 11); ctx.lineTo(px + tw, py + 15); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = `8px ${FONT}`; ctx.fillStyle = B.col; ctx.fillText(B.name, px + 7, py + 3);
      ctx.font = `7px ${FONT}`; ctx.fillStyle = '#9fb0c2'; ctx.fillText(B.tag, px + 7, py + 12);
    }
  }
  const secs = Math.max(0, Math.ceil((900 - f.t) / 60)), cx = W * .74, cy = PH * .5;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `7px ${FONT}`; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(cx - 44, cy - 14, 88, 28);
  ctx.fillStyle = '#cfd9e3'; ctx.fillText('FLY INTO A GATE', cx, cy - 8);
  ctx.font = `12px ${FONT}`; ctx.fillStyle = secs <= 5 && (T >> 3) % 2 ? '#ff4a3a' : '#ffffff'; ctx.fillText(String(secs), cx, cy + 5);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
