// @ts-nocheck
// The SOLIDS' art (DIFFICULTY-SPEC §2.4, levels.md §2.1 / §5.1 / §5.4 / §6.3): procedural canvas only, built from the
// existing draws (drawCorpse's frozen crew, drawChain, the snot glob palette of render/biomeart.ts and bullets.ts, the
// greybox seam grammar for a tell), so there is no new asset and nothing to license.
// - MORGUE RUSH: a frozen crewman in a block of ice. Its tell is a frost streak down the lane it will fly.
// - MUCUS PLUG: ochre snot cells strung into a membrane; a growing cell swells pale (the tell), a cut one leaves torn
//   strands until it regrows.
// - THE STROKE: a flesh-crusted hydraulic ram, a chain lashed round it and what it crushed smeared on its plate; its tell
//   is a red seam splitting the plate and steam at the root.
// Draw-only: no R() (hash of the solid's id and $.T), no allocation in the loops (the corpse stand-ins are made once per
// solid id and dropped with it). Collision is the solid's box, so every draw stays inside it or within a px or two of
// it (S7: nothing that looks solid where it isn't); the ice tell and the piston's steam are light, never a shape. Known
// small exceptions: the plate's blood drips run up to 4 px past the tip and an ice block's keyline 2 px past its box.
import { $ } from '../state';
import { C, PH, TAU, W, ctx, hash } from '../core';
import { solids } from '../solids';
import { drawCorpse } from './enemies';
import { drawChain, glow } from './util';

/** draw-only sizes and colours (the sim's are solids.ts SOLID) */
const ART = {
  /** ice: body tint and alpha, the rim colours, the corpse's scale inside a 22 x 14 block */
  ice: { fill: 'rgba(90,200,255,.42)', hi: '#f2fbff', lo: '#0a2238', edge: '#03080e', corpse: .6, streak: 120 },
  /** snot: the cell palette (cream / ochre pus, raw lining under it), cell radius share of the cell size */
  snot: { dark: '#3a2406', body: '#c09a3a', pus: '#efe08a', vein: '#9a2a22', web: '#3e2606', webL: '#e8d27a', r: .45 },
  /** piston: metal, ribs every `rib` px, the plate's thickness */
  ram: { metal: '#39424c', light: '#6d7a88', dark: '#191e24', rib: 22, plate: 7, seam: '255,40,30' },
};
/** the corpse stand-in each ice block and piston draws (drawCorpse reads k, ph, twitch, t), by solid id */
const STAND: WeakMap<object, any> = new WeakMap(); // by the solid itself: ids restart each run, objects don't
function stand(s) {
  let e = STAND.get(s);
  if (!e) { e = { k: 'corpse', ph: hash(s.id * 1.7) * TAU, twitch: 0, t: 0, noLeg: hash(s.id * 3.1) < .3, noArm: hash(s.id * 5.3) < .3 }; STAND.set(s, e); }
  e.t = $.T;
  return e;
}

/** MORGUE RUSH's tell: a frost streak along the lane over the screen's right edge, brightening as the block comes */
function iceTell(s) {
  const k = Math.min(1, s.t / (s.tell || 50)), y = s.lane, x0 = W - ART.ice.streak;
  ctx.globalCompositeOperation = 'lighter';
  glow(W - 6, y, 10 + 8 * k, '170,220,255', .25 + .45 * k);
  ctx.globalCompositeOperation = 'source-over';
  // a dim guide line down the lane, rime crystals (2 x 3 '+' ticks) forming along it toward the screen edge: a crystal
  // grammar, not a dash, so it never reads as the ship's own bolts flying down the same lane (art-director)
  ctx.globalAlpha = .15 + .3 * k; ctx.fillStyle = '#8ec8f0'; ctx.fillRect(x0, y, ART.ice.streak, 1);
  ctx.fillStyle = ART.ice.hi;
  for (let i = 0; i < 10; i++) {
    const px = x0 + 6 + i * 11 + (hash(s.id * 7 + i) - .5) * 5, on = (10 - i) / 10 <= .25 + k; // they freeze in from the screen edge inward as k grows: it comes from there
    if (!on) continue;
    ctx.globalAlpha = (.35 + .6 * k) * (.4 + .6 * (px - x0) / ART.ice.streak);
    const py = y - 3 + ((i * 5) % 7);
    ctx.fillRect(px, py - 1, 1, 3); ctx.fillRect(px - 1, py, 3, 1);
  }
  ctx.globalAlpha = 1;
}
/** a block's inside, baked once (dropped with the solid): the cold dark and the crewman laid out on the rack */
const CORES: WeakMap<object, any> = new WeakMap();
function iceCore(s) {
  let cv = CORES.get(s);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = s.w; cv.height = s.h;
  const c = cv.getContext('2d');
  c.fillStyle = '#16324a'; c.fillRect(0, 0, s.w, s.h); // the cold dark behind the body
  c.translate(s.w / 2, s.h / 2);
  c.rotate(hash(s.id) < .5 ? Math.PI / 2 : -Math.PI / 2); // laid out flat on the morgue rack, head first either way
  c.scale(ART.ice.corpse, ART.ice.corpse);
  drawCorpse(c, stand(s));
  CORES.set(s, cv);
  return cv;
}
/** a frozen crewman in a block of ice */
function iceBlock(s, sc) {
  const x = s.x - sc, y = s.y, w = s.w, h = s.h, cx = x + w / 2, cy = y + h / 2, dmg = s.hp0 > 0 ? 1 - s.hp / s.hp0 : 0;
  if (s.st === 'fly') { // the slipstream behind it (right: it flies left)
    ctx.fillStyle = 'rgba(200,235,255,.35)';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + w + 2 + i * 5, y + 2 + i * 4, 6 + (($.T + i * 3) % 5), 1);
  }
  ctx.fillStyle = ART.ice.edge; ctx.fillRect(x - 2, y - 2, w + 4, h + 4); // a dark keyline: it reads as a thing in front of the biome's pale ice backdrop (S7's other half)
  ctx.drawImage(iceCore(s), x, y); // the crewman frozen inside, baked once per block (a clipped sprite per frame was
  // the ice draw's p95, performance-analyst T3)
  ctx.fillStyle = ART.ice.fill; ctx.fillRect(x, y, w, h); // the ice over him
  ctx.fillStyle = ART.ice.hi; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = ART.ice.lo; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x + 3, y + 2, 3, 1); ctx.fillRect(x + 2, y + 3, 1, 2); // a glint
  ctx.fillStyle = '#7a0b10'; ctx.fillRect(cx - 1 + (hash(s.id * 9) - .5) * 8, y + h - 3, 2, 1); // frozen blood at the base
  // cracks: one at a chip, a star when it is about to go
  ctx.strokeStyle = 'rgba(235,250,255,.85)'; ctx.lineWidth = 1;
  if (dmg > 0) {
    ctx.beginPath(); ctx.moveTo(x + w * .3, y); ctx.lineTo(cx, cy); ctx.lineTo(x + w * .8, y + h); ctx.stroke();
    if (dmg >= .5) { ctx.beginPath(); ctx.moveTo(x, y + h * .6); ctx.lineTo(cx, cy); ctx.lineTo(x + w, y + h * .3); ctx.stroke(); }
  }
  if (s.st === 'lodged') { // rime welded into the wall it hit: short spikes on the wall side, inside the box's run
    ctx.fillStyle = ART.ice.hi;
    const wy = s.side > 0 ? y + h : y;
    for (let i = 0; i < 5; i++) { const px = x + 2 + i * (w - 4) / 4, l = 2 + hash(s.id + i) * 3; ctx.fillRect(px, s.side > 0 ? wy - 1 : wy, 1, s.side > 0 ? -l : l); }
  }
  if (s.hit > 0) { ctx.globalAlpha = s.hit / 6 * .6; ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
}

/** the membrane behind a plug column's live cells, so the cells read as one wall of snot, not beads */
function plugWeb(s, sc) {
  if (s.st !== 'live') return;
  const x = s.x - sc;
  ctx.fillStyle = ART.snot.web; ctx.fillRect(x, s.y, s.w, s.h); // the sheet fills its box exactly (S7)
  ctx.globalAlpha = .55 + .25 * Math.sin($.T * .07 + s.cy * .8); ctx.fillStyle = ART.snot.webL;
  ctx.fillRect(x + 1, s.y, 1, s.h); ctx.globalAlpha = 1; // a wet specular line down the player's side: one sheet, not beads
}
/** one snot cell: growing (pale, swelling: the tell), live (an ochre blob with a pus head), cut (torn strands) */
function plugCell(s, sc) {
  const c = s.w, x = s.x - sc + c / 2, y = s.y + c / 2, S = ART.snot, wob = Math.sin($.T * .09 + s.id * 1.3) * .5;
  if (s.st === 'cut') { // what the shot left: strands hanging from the cells either side, a drip working loose
    ctx.strokeStyle = 'rgba(220,205,100,.75)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 2, y - c / 2); ctx.lineTo(x - 1, y - c / 2 + 3 + wob); ctx.moveTo(x + 2, y + c / 2); ctx.lineTo(x + 1, y + c / 2 - 3 - wob); ctx.stroke();
    const ph = (($.T + s.id * 13) % 50) / 50;
    ctx.fillStyle = S.pus; ctx.fillRect(x - 1, y - c / 2 + 2 + ph * 6, 2, 2);
    return;
  }
  if (s.st === 'grow') { // the tell: strands thicken and pale across the throat, the cell swells into them
    // not solid yet, so never opaque (S7): the thickening strand is the signal; a cell kept waiting by the ship pulses
    const k = Math.min(1, s.t / (s.tell || 44)), r = c * S.r * (.3 + .7 * k), wait = s.t > (s.tell || 44) ? .5 + .5 * Math.sin($.T * .15) : 1;
    ctx.globalAlpha = (.3 + .5 * k) * wait; ctx.strokeStyle = '#f5eebe'; ctx.lineWidth = .6 + 1.6 * k;
    ctx.beginPath(); ctx.moveTo(x + wob, y - c / 2); ctx.lineTo(x - wob, y + c / 2); ctx.stroke();
    ctx.globalAlpha = (.15 + .3 * k) * wait; ctx.fillStyle = '#f4eab0';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .9, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  const r = c * S.r + wob * .4;
  ctx.fillStyle = S.dark; ctx.beginPath(); ctx.ellipse(x, y, r + .5, r * .95 + .4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = S.body; ctx.beginPath(); ctx.ellipse(x, y, r, r * .9, 0, 0, TAU); ctx.fill();
  if (hash(s.id * 2.9) < .35) { ctx.strokeStyle = S.vein; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(x - r * .7, y + 1); ctx.lineTo(x + r * .5, y - 1); ctx.stroke(); } // the raw lining shows through
  ctx.fillStyle = S.pus; ctx.beginPath(); ctx.arc(x + r * .25, y - r * .2, 1.3 + hash(s.id) * .8, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,250,215,.8)'; ctx.fillRect(x - r * .5, y - r * .55, 1.5, 1);
  if (s.hit > 0) { ctx.globalAlpha = s.hit / 6 * .5; ctx.fillStyle = '#fff8d0'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
}

/** a piston's baked head, drawn as a ceiling ram (plate at the bottom edge, the tip at y HEAD.h); by solid id */
const HEADS: WeakMap<object, any> = new WeakMap(), HEAD = { pad: 3, h: 40 }; // dropped with the solid
function head(s) {
  let cv = HEADS.get(s);
  if (cv) return cv;
  const w = s.w, R = ART.ram, H = HEAD.h, P = HEAD.pad;
  cv = document.createElement('canvas'); cv.width = w + 2 * P; cv.height = H;
  const c = cv.getContext('2d');
  drawChain(c, P + 3, H - 34, P + w - 3, H - 16, 1.2);
  c.fillStyle = '#4a5560'; c.fillRect(P, H - R.plate, w, R.plate);
  c.fillStyle = R.light; c.fillRect(P, H - R.plate, w, 1);
  c.fillStyle = C.bloodD; c.fillRect(P + 2, H - 3, w - 4, 3); // the smear under him
  c.save(); c.translate(P + w / 2, H - 2); c.scale(.7, -.32); c.rotate(Math.PI / 2); drawCorpse(c, stand(s)); c.restore();
  c.fillStyle = C.blood; c.fillRect(P + 4, H - 2, 6, 2); c.fillRect(P + w - 12, H - 1, 8, 1);
  HEADS.set(s, cv);
  return cv;
}
/** a THE STROKE piston: a hydraulic ram out of the wall, flesh-crusted, a chain round it, a crushed crewman on its plate */
function piston(s, sc) {
  const x = s.x - sc, w = s.w, R = ART.ram, top = s.side < 0, tip = s.tip, y0 = top ? -4 : tip, y1 = top ? tip : PH + 4;
  if (y1 - y0 < 2) return;
  const cyc = s.rest + 2 * s.ext + s.hold, u = (s.age + s.phase) % cyc; // where it is in its cycle (solids.ts stepPiston)
  const tell = s.st === 'tell' ? Math.max(0, Math.min(1, (u - (s.rest - s.tell)) / s.tell)) : 0;
  // the shaft: a polished hydraulic cylinder (vertical bands dark-mid-highlight-mid-dark, so it reads round and
  // machined, not as masonry), narrower than the plate so the plate reads as the business end; a seam every R.rib px
  const sx = x, sw = w; // the barrel fills the collision box's full width: no strip that kills but shows backdrop (S7)
  ctx.fillStyle = R.dark; ctx.fillRect(sx, y0, sw, y1 - y0);
  ctx.fillStyle = R.metal; ctx.fillRect(sx + 2, y0, sw - 4, y1 - y0);
  ctx.fillStyle = '#56626e'; ctx.fillRect(sx + 6, y0, sw - 14, y1 - y0);
  ctx.fillStyle = '#b9c6d2'; ctx.fillRect(sx + 9, y0, 2, y1 - y0); // the specular line down the barrel
  for (let yy = (top ? tip - R.plate - R.rib : tip + R.plate + R.rib); top ? yy > y0 : yy < y1; yy += top ? -R.rib : R.rib) {
    ctx.fillStyle = R.dark; ctx.fillRect(sx, yy, sw, 1); // the telescoping seams
  }
  // what it crushed, crusted on the shaft: flesh blotches with a fleck of bone, fixed by id and segment
  for (let i = 0; i < 6; i++) {
    const h = hash(s.id * 11 + i), yy = top ? tip - R.plate - 4 - i * 11 : tip + R.plate + 4 + i * 11;
    if (top ? yy < y0 : yy > y1) break;
    ctx.fillStyle = h < .5 ? C.fleshD : C.flesh; ctx.fillRect(x + 5 + h * 12, yy, 4 + h * 6, 3);
    if (h > .7) { ctx.fillStyle = C.bone; ctx.fillRect(x + 7 + h * 10, yy + 1, 2, 1); }
  }
  // the head (the plate, the crewman pressed flat on it, a chain lashed round the shaft above it): baked once per
  // piston (drawChain saves and rotates per link and the corpse is a clipped sprite: ~1 ms a frame for a screen of
  // them at 4x throttle, unbaked; performance-analyst T3), then one drawImage, flipped for a floor ram
  const hd = head(s);
  if (top) ctx.drawImage(hd, x - HEAD.pad, tip - HEAD.h);
  else { ctx.save(); ctx.translate(x - HEAD.pad, tip + HEAD.h); ctx.scale(1, -1); ctx.drawImage(hd, 0, 0); ctx.restore(); }
  ctx.fillStyle = C.blood; // and what runs off it: drips off the plate's lip, timed by the frame
  for (let i = 0; i < 3; i++) {
    const ph = (($.T * .6 + i * 23 + s.id * 7) % 40) / 40, dx = x + 5 + i * 9 + hash(s.id + i) * 4;
    ctx.fillRect(dx, top ? tip : tip - 2, 1, top ? 1 + ph * 3 : -1 - ph * 3);
  }
  if (tell > 0) { // the tell: a red seam splits the plate and throws light (the greybox grammar), steam at the root
    const sy = top ? tip - R.plate / 2 : tip + R.plate / 2, o = .5 + 1.5 * tell;
    ctx.globalCompositeOperation = 'lighter';
    glow(x + w / 2, sy, 10 + 12 * tell, R.seam, .25 + .5 * tell);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ff2a1a'; ctx.fillRect(x + 2, sy - o / 2, w - 4, o);
    ctx.fillStyle = '#ffd0b0'; ctx.fillRect(x + w / 2 - 3, sy - .5, 6, 1);
    const ry = top ? Math.max(4, Math.min(tip - R.plate - 6, 30)) : Math.min(PH - 4, Math.max(tip + R.plate + 6, PH - 30));
    for (let i = 0; i < 4; i++) { // steam off the root seal: soft puffs drifting into the gap, light not shape
      const ph = (($.T + i * 11) % 30) / 30;
      ctx.globalAlpha = (1 - ph) * .35 * tell;
      ctx.fillStyle = '#dfe6ee';
      ctx.beginPath(); ctx.arc(x + 6 + i * 6, ry + (top ? 1 : -1) * ph * 10, 2 + ph * 3, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
/** a generic slab: riveted plate */
function slab(s, sc) {
  const x = s.x - sc;
  ctx.fillStyle = '#2c333b'; ctx.fillRect(x, s.y, s.w, s.h);
  ctx.fillStyle = '#5d6a78'; ctx.fillRect(x, s.y, s.w, 1);
  ctx.fillStyle = '#8fa3b8'; for (let px = x + 3; px < x + s.w - 2; px += 8) { ctx.fillRect(px, s.y + 2, 1, 1); ctx.fillRect(px, s.y + s.h - 3, 1, 1); }
}

const onScreen = (s, sc) => s.x - sc < W + 40 && s.x + s.w - sc > -40;
/** drawTerrain's last step: every solid on screen, over the terrain (render/terrain.ts). Leaves the canvas as it found it */
export function drawSolids() {
  if (!$.G) return;

  if (!solids.length) return;
  const sc = $.G.scroll;
  ctx.save();
  for (const s of solids) if (s.k === 'piston' && !HEADS.has(s) && s.x - sc < W + 400) head(s); // bake before it shows, not mid-stroke
  for (const s of solids) if (s.k === 'plug' && onScreen(s, sc)) plugWeb(s, sc); // the membrane first, the cells over it
  for (const s of solids) {
    if (s.st === 'dead') continue;
    if (s.k === 'ice') { if (s.st === 'tell') { iceTell(s); iceCore(s); } else if (onScreen(s, sc)) iceBlock(s, sc); }
    else if (!onScreen(s, sc)) continue;
    else if (s.k === 'plug') plugCell(s, sc);
    else if (s.k === 'piston') piston(s, sc);
    else slab(s, sc);
  }
  ctx.restore();
}
