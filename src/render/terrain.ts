// @ts-nocheck
import { $ } from '../state';
import { biomeEdge, biomeK, biomeTerrainFill, drawBiomeBG, drawBiomeDecor, splatCols, biomeDark } from '../biomes';
import { C, H, PH, TAU, TS, W, ctx, hash, lc, lctx, sstep } from '../core';
import { AMT, LIGHTS, ceilAt, floorAt, splats } from '../world';
import { DERE, GROSS, PIC, STARS, fleshPat, metalPat, ready, texPat } from '../textures';
import { drawChain, drawHookTip, drawSkull, glow, glowSpr, hangSpine, light, poly } from '../render/util';
import { eye } from '../render/eyes';
import { innerBand } from '../layout';
import { SET } from '../save';

// --- terrain & backgrounds ---
export function drawTerrain() {
  const sc = $.G.scroll,
    x0 = -(sc % TS),
    corr = AMT.corr(sc + W / 2);
  const mtx = new DOMMatrix().translate(-sc, 0);
  metalPat.setTransform(mtx);
  fleshPat.setTransform(mtx);
  // the derelict's walls: real metastatic tissue (tex-flesh) creeping over the hull plate, thickest in the corridors
  const fp = GROSS > 0 ? texPat('flesh') : null;
  if (fp) fp.setTransform(mtx);
  for (const top of [true, false]) {
    ctx.beginPath();
    ctx.moveTo(-4, top ? -4 : PH + 4);
    for (let x = x0 - TS; x <= W + TS; x += TS) {
      const wx = x + sc;
      ctx.lineTo(x, top ? ceilAt(wx) : floorAt(wx));
    }
    ctx.lineTo(W + 4, top ? -4 : PH + 4);
    ctx.closePath();
    ctx.fillStyle = metalPat;
    ctx.fill();
    const bk = biomeTerrainFill(mtx);
    if (fp && bk < 1) {
      ctx.globalAlpha = (1 - bk) * (corr * .7 * (1 - GROSS) + GROSS * (.45 + .55 * corr));
      ctx.fillStyle = fp;
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (corr > 0 && bk < 1) {
      ctx.globalAlpha = corr * .7 * (1 - bk);
      ctx.fillStyle = fleshPat;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // the MERIDIAN's own corridor plating (CC0 sci-fi wall tiles, tools/prep_world.py): panels, pipes and vent hatches
    // with the flesh already growing over them, so the corridors read as a ship being eaten, not a cave
    const dp = corr > 0 && bk < 1 ? texPat('derelict') : null;
    if (dp) {
      dp.setTransform(mtx);
      ctx.globalAlpha = corr * (1 - bk);
      ctx.fillStyle = dp;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    for (let x = x0 - TS; x <= W + TS; x += TS) {
      const wx = x + sc,
        y = top ? ceilAt(wx) - 1 : floorAt(wx) + 1;
      x === x0 - TS ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = top ? '#0a0d10' : '#0a0d10';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    for (let x = x0 - TS; x <= W + TS; x += TS) {
      const wx = x + sc,
        y = top ? ceilAt(wx) - .5 : floorAt(wx) + .5;
      x === x0 - TS ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = biomeEdge() || (corr > .5 ? '#7a3a36' : '#6d8094');
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  if (biomeK(sc + W / 2)[1] < .5) for (let wx = Math.floor(sc / 32) * 32; wx < sc + W + 32; wx += 32) {
    const x = wx - sc,
      f = floorAt(wx),
      c = ceilAt(wx);
    if (f < PH + 2) {
      ctx.fillStyle = '#07090b';
      ctx.fillRect(x, f + 3, 2, 12);
      ctx.fillStyle = '#3b4652';
      ctx.fillRect(x + 2, f + 3, 1, 12);
    }
    if (c > -2) {
      ctx.fillStyle = '#07090b';
      ctx.fillRect(x, c - 15, 2, 12);
      ctx.fillStyle = '#3b4652';
      ctx.fillRect(x + 2, c - 15, 1, 12);
    }
    if (wx % 160 === 0) {
      const on = (($.T >> 4) + wx / 160) % 3 < 2;
      for (const [y, s] of [[f, 1], [c, -1]]) {
        if (s > 0 && y > PH + 2 || s < 0 && y < -2) continue;
        const ly = y - s * 2;
        ctx.fillStyle = '#22282f';
        ctx.fillRect(x - 2, ly - 1, 5, 3);
        ctx.fillStyle = on ? '#ff2a22' : '#4a0806';
        ctx.fillRect(x - 1, ly, 3, 1);
        if (on) {
          ctx.globalCompositeOperation = 'lighter';
          glow(x, ly, 14, '255,40,30', .35);
          ctx.globalCompositeOperation = 'source-over';
          light(x, ly, 26, .6);
        }
      }
    }
  }
  drawBiomeDecor(sc);
  const nob = 1 - biomeK(sc + W / 2)[1];
  if (corr > 0 && nob > .05) for (let wx = Math.floor(sc / 22) * 22; wx < sc + W + 22; wx += 22) {
    const h = hash(wx * .137);
    if (h > corr * .75 * nob) continue;
    const x = wx - sc;
    for (const s of [1, -1]) {
      const y = s > 0 ? floorAt(wx) : ceilAt(wx);
      if (s > 0 && y > PH || s < 0 && y < 0) continue;
      const r = 3 + hash(wx * .71 + s) * 8,
        cy = y - s * r * .35;
      ctx.fillStyle = '#3a0f0c';
      ctx.beginPath();
      ctx.ellipse(x, cy, r + 1, r * .7 + 1, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = hash(wx + s) < .5 ? '#8e3a32' : '#a3473c';
      ctx.beginPath();
      ctx.ellipse(x, cy, r, r * .7, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,190,170,.35)';
      ctx.beginPath();
      ctx.ellipse(x - r * .3, cy - r * .3 * s, r * .35, r * .18, 0, 0, TAU);
      ctx.fill();
      if (hash(wx * 3.1 + s) < .4) {
        ctx.fillStyle = C.fat;
        ctx.beginPath();
        ctx.arc(x + r * .4, cy - s * r * .2, 1.3, 0, TAU);
        ctx.fill();
      } else if (hash(wx * 5.7 + s) < .45 && r > 4) {
        const er = r * .42,
          ea = Math.atan2($.P.y - cy, $.P.x - x),
          bl = hash(wx + Math.floor($.T / 9)) < .04;
        eye(ctx, x, cy, er, {
          ang: ea,
          iris: hash(wx * 9 + s) < .5 ? '#8a9a22' : '#b01018',
          bs: 1.4,
          blink: bl ? 1 : 0,
          lid: '#8e3a32'
        });
      }
      ctx.strokeStyle = '#2a0507';
      ctx.lineWidth = .8;
      ctx.beginPath();
      ctx.moveTo(x + r, cy);
      ctx.quadraticCurveTo(x + r + 6, y - s * 1, x + r + 12, y - s * hash(wx) * 3);
      ctx.stroke();
    }
  }
}
export function drawDecor() {
  const sc = $.G.scroll,
    nob = 1 - biomeK(sc + W / 2)[1],
    corr = AMT.corr(sc + W / 2) * nob,
    hull = AMT.hull(sc + W / 2) * nob;
  if (corr > 0) for (let wx = Math.floor(sc / 46) * 46; wx < sc + W + 46; wx += 46) {
    const h = hash(wx * .53 + 3),
      x = wx - sc;
    if (h < corr * .5) {
      const c = ceilAt(wx);
      if (c < -2) continue;
      const len = 12 + hash(wx * .9) * 38,
        sw = Math.sin($.T * .03 + wx) * 3,
        ex = x + sw,
        ey = c + len;
      drawChain(ctx, x, c, ex, ey);
      drawHookTip(ctx, ex, ey, 0, 1);
      const g = hash(wx * 2.2);
      if (g < .3) drawSkull(ctx, ex + 2, ey + 7, 2.6, 0);else if (g < .6) {
        ctx.save();
        ctx.translate(ex + 2, ey + 5);
        ctx.rotate(Math.PI / 2 + sw * .05);
        ctx.fillStyle = C.suit;
        ctx.fillRect(0, -1.2, 9, 2.4);
        ctx.fillStyle = C.skin;
        ctx.fillRect(9, -1.3, 2, 2.6);
        ctx.fillStyle = C.blood;
        ctx.fillRect(-1, -1.3, 1.4, 2.6);
        ctx.restore();
      } else if (g < .8) {
        ctx.fillStyle = '#6e2b26';
        ctx.fillRect(ex, ey + 3, 5, 9);
        ctx.fillStyle = C.fat;
        ctx.fillRect(ex + 1, ey + 4, 1, 7);
        ctx.fillStyle = C.blood;
        ctx.fillRect(ex + 2, ey + 12, 1, 2);
      }
    } else if (h > 1 - corr * .45) {
      const f = floorAt(wx);
      if (f > PH) continue;
      const n = 3 + hash(wx * 1.7) * 4 | 0;
      for (let k = 0; k < n; k++) {
        const row = k < 3 ? 0 : k < 5 ? 1 : 2,
          col = row === 0 ? k : row === 1 ? k - 3 : 0;
        drawSkull(ctx, x + (col - (row === 0 ? 1 : row === 1 ? .5 : 0)) * 5.4, f - 3 - row * 4.6, 2.6, k === n - 1 && hash(wx) < .4);
      }
    }
  }
  if (hull > 0) for (let wx = Math.floor(sc / 120) * 120; wx < sc + W + 120; wx += 120) {
    if (hash(wx * .31) > .45) continue;
    const x = wx - sc + hash(wx) * 40,
      f = floorAt(wx);
    if (f > PH) continue;
    ctx.globalAlpha = hull;
    hangSpine(ctx, x, f - 24, 24, 3, '#0b0e12');
    hangSpine(ctx, x - .5, f - 24, 24, 2, '#2a323c');
    drawSkull(ctx, x + 5, f - 2.4, 2.4, 0);
    ctx.globalAlpha = 1;
  }
}
export function drawNeptune(a, sc) {
  if (a <= 0) return;
  ctx.globalAlpha = a;
  const x = W * .8 - sc * .02,
    y = 62,
    r = 48;
  // the real thing: Voyager 2's Neptune in Descent 1, Webb's ringed infrared Neptune from Descent 2 on
  const deep = ($.G && $.G.loop) > 0, k = deep ? 'neptune-webb' : 'neptune-voyager';
  if (ready(k)) {
    const im = PIC[k];
    ctx.drawImage(im, Math.round(x - im.width / 2), Math.round(y - im.height / 2));
    if (!deep) {
      ctx.strokeStyle = 'rgba(160,200,240,.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.6, r * .22, -.18, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  const g = ctx.createRadialGradient(x + 14, y - 16, 4, x, y, r);
  g.addColorStop(0, '#a8dcff');
  g.addColorStop(.5, '#3176d6');
  g.addColorStop(1, '#0a2357');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  for (let i = 0; i < 14; i++) {
    const by = y - r + i * 7 + Math.sin(i * 1.7) * 2;
    ctx.fillStyle = i % 3 ? 'rgba(255,255,255,.06)' : 'rgba(10,30,80,.18)';
    ctx.fillRect(x - r, by, r * 2, 2 + i % 3);
  }
  ctx.fillStyle = 'rgba(8,20,60,.6)';
  ctx.beginPath();
  ctx.ellipse(x - 8, y + 10, 7, 3.5, 0, 0, TAU);
  ctx.fill();
  const sh = ctx.createRadialGradient(x + 22, y - 22, r * .6, x + 10, y - 10, r * 1.6);
  sh.addColorStop(0, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,6,.92)');
  ctx.fillStyle = sh;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(160,200,240,.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.6, r * .22, -.18, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
/** Triton, Neptune's big retrograde moon (CC0 "Planet T", cut out and graded to nitrogen frost by tools/prep_world.py):
 *  a small eclipsed disc with its rim lit, below-right of Neptune and on a slightly nearer parallax so the two drift apart */
export function drawTriton(a, sc) {
  if (a <= 0 || !ready('triton')) return;
  const im = PIC.triton,
    x = W * .9 - sc * .028,
    y = 132;
  if (x < -im.width) return;
  ctx.globalAlpha = a * .8;
  ctx.drawImage(im, Math.round(x - im.width / 2), Math.round(y - im.height / 2));
  ctx.globalAlpha = 1;
}
// --- the derelict skyline: "the MERIDIAN's dead mall" (art-director direction, art-derelict-vapor) ---
// 8-bit vaporwave: dithered gradient bodies, 1 px neon roof/side edges, sun-stripe windows, stepped chrome spires,
// dead half-lit signs and a sliced sunset disc where the ring was. Palette is the art-director's, nothing else:
// no greens or teals, because enemy fire is round toxic lime and must stay the only green on screen.
const VP = {
  void: '#0b0716', body: '#160c2c', band: '#2a1450', rim: '#5a2a8c',
  mag: '#ff3fa4', cyan: '#3fd8ff', orange: '#ff8a3d', sun: '#ffd36b', chrome: '#ffb3e6',
};
/** skyline tuning: every live light stays at or under half the layer fade (readability over bullets) */
const DV = {
  neonA: .75, // roof/side neon and sign tubes, x a (Matt, round 2: push the vaporwave; lime orbs still read on top)
  lightA: .6, // windows and spire highlights, x a: a step under the neon so the edges carry the silhouette
  magK: .7, // share of blocks edged magenta rather than cyan (round 2: more magenta)
  discA: .7, // the sunset disc's drawImage, x a: background, never brighter than the bullets in front of it
  discR: 46, // inside the old ring's 48 px radius, centre at base-10 like the ring
  // disc x relative to `off`. The old ring's +1560 was never on screen: Open Orbit ends at off = -12 (short, x1 2300)
  // and -262 (long4, x1 4380), and space fades out long before +1560 comes round. At +100 the whole disc is on screen
  // from the first frame of Open Orbit (rx 364) through all of short's orbit (rx 88 at its end) and 78% of long4's
  // (gone at scroll ~3420), near screen centre mid-stage on both (short rx 226 at 1150, long4 rx 240 at ~1030).
  // Anything past ~+103 overlaps Triton (x W*.9 - sc*.028, y 132) as the faster disc overtakes it; +100 never does,
  // and Neptune (y 62, r 48) ends above the disc's top row (127)
  discX: 100,
  hazeA: .45, // the horizon haze's drawImage, x a: faint, the dither carries the ramp
  hazeH: 30, // haze rows above the base line: low and short, behind the blocks only (tallest roof is 26)
  top: 62, // bake rows above the base line: tallest block (26) + tallest spire (34) + mast
  foot: 18, // body rows below the base line (the old fillRect's +18), dissolving to the sky
  flickP: [100, 240], // frames between a flickering edge's drop-outs
};
// 4x4 Bayer thresholds: every gradient and dissolve is an ordered dither, never alpha (8-bit rule)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
let DBAKE = null; // { cv, disc, lit, live[] }: built once, on the first frame the skyline is drawn
/** bake the static skyline (bodies, dither, spires, sign frames) and the disc into offscreen canvases, once.
 *  Variety is hash() of the block index only: DERE itself (boot, sim RNG) is read, never re-rolled */
function bakeDerelict() {
  const last = DERE[DERE.length - 1],
    cw = last.x + last.w + 2,
    ch = DV.top + DV.foot,
    cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const c = cv.getContext('2d'),
    img = c.createImageData(cw, ch),
    px = img.data;
  const put = (x, y, col) => {
    if (x < 0 || y < 0 || x >= cw || y >= ch) return;
    const o = (y * cw + x) * 4;
    px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = 255;
  };
  const BAND = rgb(VP.band), BODY = rgb(VP.body), RIM = rgb(VP.rim);
  const B = DV.top, // the base line's row in the bake
    live = [];
  DERE.forEach((s, i) => {
    const t = B - s.h, // roof row
      H = s.h + DV.foot,
      L = { n: hash(i * 12.9) < DV.magK ? VP.mag : VP.cyan, side: hash(i * 3.7 + .2) < .5 ? 0 : s.w - 1, win: [], heart: [], hi: [], sign: [], lc: VP.orange, fl: null };
    // body: 3 solid rows of the band, a Bayer ramp into the body colour, then the last 10 rows dissolve into the sky
    const D = Math.max(4, Math.min(8, s.h - 3));
    for (let yy = 0; yy < H; yy++) {
      const f = (yy - 3) / D,
        q = (yy - (H - 10)) / 10;
      for (let x = s.x; x <= s.x + s.w; x++) {
        const y = t + yy;
        if (q > 0 && q > bay(x, y)) continue;
        put(x, y, yy < 3 || f < bay(x, y) ? BAND : BODY);
      }
    }
    const sign = !s.sp && s.w >= 22 && hash(i * 3.1 + .7) < .125;
    if (s.sp) {
      // stepped spire: stacked rows, 1 px narrower each side per step, a 1 px mast above the last step
      L.lc = VP.chrome;
      const cx = s.x + Math.round(s.w / 2),
        hw0 = Math.max(2, Math.round(s.sp / 6)),
        st = Math.max(1, Math.floor(s.sp * .7 / hw0));
      let y = t;
      for (let hw = hw0; hw >= 1; hw--)
        for (let k = 0; k < st; k++, y--) {
          for (let x = cx - hw; x <= cx + hw; x++) put(x, y - 1, BAND);
          L.hi.push([cx - hw - s.x, y - 1 - B]); // the chrome left highlight, drawn live
        }
      for (; y > t - s.sp; y--) put(cx, y - 1, BAND);
    } else if (hash(i * 5.3) < .15) L.lc = VP.sun; // sun yellow, sparingly
    else if (L.n === VP.mag && hash(i * 2.7 + .9) < .3) L.lc = VP.mag; // magenta-lit floors: still 4 colours a block
    if (sign) {
      // dead billboard on the roof: a rim-coloured frame, glyph mush of 3x5 cells, about half its tubes lit (live)
      const sw = Math.min(s.w - 6, 26) & ~1,
        bx = s.x + Math.round((s.w - sw) / 2),
        by = t - 10; // panel top: 7 rows tall, 3 px of posts under it
      for (let x = bx; x < bx + sw; x++) for (let y = by; y < by + 7; y++) put(x, y, x === bx || x === bx + sw - 1 || y === by || y === by + 6 ? RIM : BODY);
      for (let y = by + 7; y < t; y++) { put(bx + 2, y, BAND); put(bx + sw - 3, y, BAND); }
      // five strokes per cell (top, middle, bottom, left, right): never a letter, just the shape of one
      const seg = [[0, 0, 3, 1], [0, 2, 3, 1], [0, 4, 3, 1], [0, 0, 1, 5], [2, 0, 1, 5]];
      for (let g = 0, gx = bx + 2; gx + 3 <= bx + sw - 2; g++, gx += 4)
        seg.forEach((sg, k) => {
          if (hash(i * 9.7 + g * 1.31 + k * .37) < .45) return;
          if (hash(i * 4.1 + g * 2.9 + k * .61) < .5) L.sign.push([gx + sg[0] - s.x, by + 1 + sg[1] - B, sg[2], sg[3]]);
          else for (let x = 0; x < sg[2]; x++) for (let y = 0; y < sg[3]; y++) put(gx + sg[0] + x, by + 1 + sg[1] + y, RIM);
        });
    } else {
      // sun-stripe windows: rows every 3 px down to just under the base line; 2x1 dashes or full-width 1 px stripes.
      // About 1 in 10 windows overall beats magenta: 15% on the magenta-edged 70%, so a block keeps 4 colours
      const stripe = hash(i * 7.9 + .4) < .35;
      for (let r = 0, y = t + 3; y < B + 4; r++, y += 3) {
        if (hash(i * 1.7 + r * 9.1) < .3) continue; // a dark floor
        const ry = y - B;
        if (stripe) {
          if (hash(i * 2.2 + r * 5.3) < .55) (L.n === VP.mag && hash(i * 6.1 + r * 3.3) < .15 ? L.heart : L.win).push([2, ry, s.w - 4]);
        } else
          for (let k = 0, x = 2; x + 2 <= s.w - 2; k++, x += 4) {
            if (hash(i * 7.31 + r * 3.7 + k * .913) > .45) continue;
            (L.n === VP.mag && hash(i * 8.3 + r * 1.9 + k * .71) < .15 ? L.heart : L.win).push([x, ry, 2]);
          }
      }
    }
    // about 1 in 6 neon edges flicker: period, phase and a 2-4 frame drop-out from the block's hash
    if (hash(i * 4.7 + .3) < 1 / 6) {
      const P = DV.flickP[0] + Math.floor(hash(i * 8.1) * (DV.flickP[1] - DV.flickP[0]));
      L.fl = { P, o: Math.floor(hash(i * 2.3) * P), d: 2 + Math.floor(hash(i * 6.6) * 3), dbl: hash(i * 1.1) < .5 };
    }
    live.push(L);
  });
  c.putImageData(img, 0, 0);
  // the sliced sunset disc: yellow -> orange -> magenta stripe fill, Bayer at the hand-offs, gaps widening downward
  const r = DV.discR,
    n = r * 2 + 1,
    dc = document.createElement('canvas');
  dc.width = dc.height = n;
  const d = dc.getContext('2d'),
    di = d.createImageData(n, n),
    dp = di.data,
    SUN = rgb(VP.sun), OR = rgb(VP.orange), MAG = rgb(VP.mag),
    lit = new Uint8Array(n).fill(1);
  // the slices start 20 rows above centre, where they still clear the roofs (roof rows sit 16 above to 4 below the
  // centre): the solid run shrinks 6 -> 2 while the gap grows 1 -> 5
  for (let y = r - 20, k = 0; y < n; k++) {
    const gap = 1 + Math.floor(k / 1.6), run = Math.max(2, 6 - k);
    for (let g = 0; g < gap && y < n; g++, y++) lit[y] = 0;
    y += run;
  }
  // nothing below where the block bodies start dissolving (base+8 = centre+18): no slices floating under the skyline
  lit.fill(0, r + 18);
  for (let y = 0; y < n; y++) {
    if (!lit[y]) continue;
    const hw = Math.round(Math.sqrt(r * r - (y - r) * (y - r))),
      u = y / (n - 1);
    for (let x = r - hw; x <= r + hw; x++) {
      const b = bay(x, y),
        col = u < .18 ? SUN : u < .26 ? ((u - .18) / .08 > b ? OR : SUN) : u < .36 ? OR : u < .44 ? ((u - .36) / .08 > b ? MAG : OR) : MAG;
      const o = (y * n + x) * 4;
      dp[o] = col[0]; dp[o + 1] = col[1]; dp[o + 2] = col[2]; dp[o + 3] = 255;
    }
  }
  d.putImageData(di, 0, 0);
  // horizon haze behind the skyline only (DERE's span, hazeH rows up from the base line): #ff3fa4 stepped into
  // #2a1450 then dissolved, every step a Bayer density in 3-row bands (dithered, never an alpha gradient)
  const hh = DV.hazeH,
    hz = document.createElement('canvas');
  hz.width = cw;
  hz.height = hh;
  const hc = hz.getContext('2d'),
    hi = hc.createImageData(cw, hh),
    hp = hi.data,
    PINK = rgb(VP.mag), BAND2 = rgb(VP.band);
  for (let y = 0; y < hh; y++) {
    const up = Math.floor((hh - 1 - y) / 3) * 3 / hh; // 0 at the base line, ~1 at the top; stepped every 3 rows
    for (let x = 0; x < cw; x++) {
      const b = bay(x, y);
      if (up > .55 && (up - .55) / .45 > b) continue; // the top rows dissolve into the sky
      const col = up < .5 && up / .5 < b ? PINK : BAND2;
      const o = (y * cw + x) * 4;
      hp[o] = col[0]; hp[o + 1] = col[1]; hp[o + 2] = col[2]; hp[o + 3] = 255;
    }
  }
  hc.putImageData(hi, 0, 0);
  return { cv, disc: dc, haze: hz, lit, live };
}
// 1 Hz double beat (60 frames): a strong pulse, a weaker one 14 frames later, each falling off over 9 frames
const beat = t => {
  const p = k => k >= 0 && k < 9 ? 1 - k / 9 : 0;
  return Math.max(p(t % 60), .65 * p((t % 60) - 14));
};
/** bake the skyline in an idle boot slot, so Orbit's first frame doesn't pay for it (render/warmup.ts); false: done */
export function warmDerelict() { if (!DBAKE) DBAKE = bakeDerelict(); return false; }
/** the derelict skyline behind Open Orbit: one blit of the baked blocks plus the live neon, windows and disc shimmer */
export function drawDerelict(a, sc) {
  if (a <= 0) return;
  if (!DBAKE) DBAKE = bakeDerelict();
  const off = W * .55 - sc * .12,
    base = PH * .72,
    B = Math.round(base),
    ix = Math.round(off),
    T = $.T,
    { cv, live } = DBAKE;
  // the sunset disc sits behind the haze and the blocks (a sun on the horizon); DV.discX says why it sits where it does
  const rx = Math.round(off + DV.discX),
    ry = Math.round(base - 10),
    r = DV.discR,
    disc = rx < W + 120 && rx > -140;
  if (disc) {
    ctx.globalAlpha = a * DV.discA;
    ctx.drawImage(DBAKE.disc, rx - r, ry - r);
    // 1 px chrome scanline running down the disc, one pass per 90 frames, skipped where it crosses a slice gap
    const sy = Math.floor((T % 90) / 90 * (r * 2 + 1));
    if (DBAKE.lit[sy]) {
      const hw = Math.round(Math.sqrt(r * r - (sy - r) * (sy - r)));
      ctx.globalAlpha = a * DV.neonA * .6;
      ctx.fillStyle = VP.chrome;
      ctx.fillRect(rx - hw, ry - r + sy, hw * 2 + 1, 1);
    }
  }
  // horizon haze, then the static blocks: one blit each of the visible slice of the bake, at a whole-pixel x
  const s0 = Math.max(0, -ix),
    s1 = Math.min(cv.width, W - ix);
  if (s1 > s0) {
    ctx.globalAlpha = a * DV.hazeA;
    ctx.drawImage(DBAKE.haze, s0, 0, s1 - s0, DV.hazeH, ix + s0, B - DV.hazeH, s1 - s0, DV.hazeH);
    ctx.globalAlpha = a;
    ctx.drawImage(cv, s0, 0, s1 - s0, cv.height, ix + s0, B - DV.top, s1 - s0, cv.height);
  }
  // live lights: one path per colour, whole-pixel rects only (crisp, no anti-aliasing)
  const paths = {}, solo = [];
  const P = col => paths[col] || (paths[col] = new Path2D());
  const hb = beat(T);
  for (let i = 0; i < DERE.length; i++) {
    const s = DERE[i],
      x = ix + s.x;
    if (x > W || x + s.w < 0) continue;
    const L = live[i],
      t = B - s.h;
    // neon edge: roof + one side. A flickering edge drops out for 2-4 frames (HELL FLASHES off: a slow fade instead)
    let m = 1;
    if (L.fl) {
      const k = (T + L.fl.o) % L.fl.P;
      if (SET.flashes) m = k < L.fl.d || (L.fl.dbl && k >= L.fl.d + 3 && k < L.fl.d + 5) ? 0 : 1;
      else m = .25 + .75 * (.5 + .5 * Math.cos(k / L.fl.P * TAU));
    }
    if (m > 0) {
      const p = m === 1 ? P(L.n) : new Path2D();
      p.rect(x, t, s.w, 1);
      p.rect(x + L.side, t + 1, 1, s.h + 4);
      // the dead sign's lit tubes share the edge's colour and its drop-outs, plus their own buzz (none with flashes off)
      if (L.sign.length && (!SET.flashes || hash(i * 5.9 + Math.floor(T / 5)) > .12))
        for (const g of L.sign) p.rect(x + g[0], B + g[1], g[2], g[3]);
      if (m !== 1) solo.push([p, L.n, m]);
    }
    for (const w of L.win) P(L.lc).rect(x + w[0], B + w[1], w[2], 1);
    for (const h of L.hi) P(VP.chrome).rect(x + h[0], B + h[1], 1, 1);
    for (const w of L.heart) P('heart').rect(x + w[0], B + w[1], w[2], 1);
  }
  for (const col in paths) {
    const neon = col === VP.mag || col === VP.cyan;
    // heart cells never go fully dark between beats, so a window stays a window
    ctx.globalAlpha = a * (col === 'heart' ? DV.neonA * (.3 + .7 * hb) : neon ? DV.neonA : DV.lightA);
    ctx.fillStyle = col === 'heart' ? VP.mag : col;
    ctx.fill(paths[col]);
  }
  for (const [p, col, m] of solo) {
    ctx.globalAlpha = a * DV.neonA * m;
    ctx.fillStyle = col;
    ctx.fill(p);
  }
  if (disc) {
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = 'lighter';
    glow(rx, ry, 40, '200,20,30', .25 + .1 * Math.sin($.T * .03));
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}
export function drawInterior(a, sc) {
  if (a <= 0) return;
  ctx.globalAlpha = a;
  ctx.fillStyle = '#06080b';
  ctx.fillRect(0, 0, W, PH);
  const sp = 96,
    off = -(sc * .3 % sp);
  for (let x = off - sp; x < W + sp; x += sp) {
    const idx = Math.round((x - off) / sp + Math.floor(sc * .3 / sp));
    const cx = x + 58,
      cy = PH * .42,
      fl = hash(idx * 7.3 + Math.floor($.T / (6 + hash(idx) * 20))) > .12 ? 1 : .25;
    ctx.globalCompositeOperation = 'lighter';
    glow(cx, cy, 46, '150,190,230', .12 * fl);
    ctx.globalCompositeOperation = 'source-over';
    // flickering porthole (these were inverted-cross lights; round now so nothing reads as a religious symbol)
    ctx.strokeStyle = `rgba(190,220,250,${.55 * fl})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = `rgba(190,220,250,${.16 * fl})`;
    ctx.fill();
    ctx.fillStyle = '#0c1015';
    ctx.fillRect(x, 0, 24, PH);
    ctx.fillStyle = '#1a2129';
    ctx.fillRect(x + 23, 0, 1, PH);
    ctx.strokeStyle = '#0c1015';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + 60, 40, 36, Math.PI, TAU);
    ctx.stroke();
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = '#232b34';
      ctx.fillRect(x + 5, 20 + k * 38, 14, 2);
    }
  }
  const sp3 = 210,
    off3 = -(sc * .42 % sp3);
  for (let x = off3 - sp3; x < W + sp3; x += sp3) {
    const cx = x + 120,
      h = PH * .62,
      yT = PH * .12;
    hangSpine(ctx, cx, yT, h, 9, '#0a0c0f');
    hangSpine(ctx, cx - 1, yT, h, 6, '#141920');
    ctx.save();
    ctx.translate(cx, yT + h * .48);
    ctx.fillStyle = '#120909';
    ctx.fillRect(-5, -18, 10, 28);
    ctx.fillRect(-4, -36, 3, 18);
    ctx.fillRect(1, -36, 3, 18);
    ctx.fillRect(-9, 6, 3, 17); // arms hanging past the head
    ctx.fillRect(6, 6, 3, 17);
    ctx.beginPath();
    ctx.arc(0, 16, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3a0508';
    ctx.fillRect(-1, 20, 2, 8 + $.T * .05 % 14);
    ctx.restore();
  }
  const sp2 = 134,
    off2 = -(sc * .55 % sp2);
  for (let x = off2 - sp2; x < W + sp2; x += sp2) {
    const idx = Math.round((x - off2) / sp2 + Math.floor(sc * .55 / sp2)),
      len = 40 + hash(idx * 1.9) * 70,
      sw = Math.sin($.T * .018 + idx) * 6,
      cx = x + 40;
    ctx.strokeStyle = '#161b21';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let k = 0; k < len; k += 4) {
      const px = cx + sw * (k / len);
      ctx.moveTo(px - 1, k);
      ctx.lineTo(px + 1, k + 3);
    }
    ctx.stroke();
    const bx = cx + sw,
      by = len;
    ctx.save();
    ctx.translate(bx, by + 10);
    ctx.rotate(Math.PI + sw * .03);
    ctx.fillStyle = '#160c0d';
    ctx.fillRect(-4, -6, 8, 12);
    ctx.beginPath();
    ctx.arc(0, -9, 3.5, 0, TAU);
    ctx.fill();
    ctx.fillRect(-4, 6, 2, 9);
    ctx.fillRect(2, 6, 2, 8);
    ctx.fillStyle = '#3a0508';
    ctx.fillRect(-2, -3, 3, 5);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
export function drawCoreBG(a) {
  if (a <= 0) return;
  ctx.globalAlpha = a;
  const cx = W - 110,
    cy = PH / 2,
    t = $.T * .004;
  hangSpine(ctx, cx, cy - 150, 320, 22, 'rgba(14,0,2,.85)');
  hangSpine(ctx, cx, cy - 150, 320, 14, 'rgba(70,4,10,.35)');
  ctx.globalCompositeOperation = 'lighter';
  glow(cx, cy, 260, '110,0,10', .35 + .1 * Math.sin($.T * .05));
  if (ready('perseus-skull')) {
    // the Perseus cluster's "x-ray skull" (NASA Chandra) breathing in the well's glow
    const im = PIC['perseus-skull'], s = 1 + .03 * Math.sin($.T * .02);
    ctx.globalAlpha = a * (.32 + .1 * Math.sin($.T * .05));
    ctx.drawImage(im, cx - im.width * s / 2, cy - im.height * s / 2, im.width * s, im.height * s);
    ctx.globalAlpha = a;
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(150,40,40,.22)';
  ctx.lineWidth = 1;
  for (const [r, s] of [[130, 1], [175, -1], [230, 1]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k < 36; k++) {
      const an = k / 36 * TAU + t * s;
      ctx.moveTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r);
      ctx.lineTo(cx + Math.cos(an) * (r + 6), cy + Math.sin(an) * (r + 6));
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
const SKY = ['deepfield', 'sky-carina', 'sky-tarantula'],
  SKY_A = { deepfield: .7, 'sky-carina': .5, 'sky-tarantula': .55 };
/** Cassiopeia A (JWST MIRI, graded to raw meat and bile) hung in Open Orbit like a flayed wound: slow parallax,
 *  a cheap breath (scale + alpha of one pre-baked sprite, no per-pixel work) and a fainter out-of-phase echo */
function drawWound(a, sc, L) {
  if (!ready('sky-casa')) return;
  const im = PIC['sky-casa'],
    k = L % 3,
    x = W * [.5, .62, .4][k] - sc * .045,
    y = PH * [.66, .6, .7][k],
    br = Math.sin($.T * .021 + L),
    s = [.62, .78, .7][k] * (1 + .035 * br),
    w = im.width * s;
  if (x + w < 0) return;
  ctx.globalCompositeOperation = 'lighter';
  a *= k ? .7 : 1; // dimmer over the nebula skies of Descent 2 and 3
  ctx.globalAlpha = a * (.4 + .1 * br);
  ctx.drawImage(im, x - w / 2, y - w / 2, w, w);
  const s2 = s * (1.08 - .03 * br), w2 = im.width * s2;
  ctx.globalAlpha = a * .12 * (1 - br) * .5;
  ctx.drawImage(im, x - w2 / 2, y - w2 / 2, w2, w2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}
export function drawBG() {
  const sc = $.G ? $.G.scroll : $.T * .6;
  // a biome at full strength fills the sky opaque (BIOMES[b].bg), so everything below it would be painted and covered:
  // stars, nebula, Neptune, the derelict. None of those layers writes lights or other state (S2-K1, D30)
  if ($.G && biomeK(sc + W / 2)[1] >= 1) { drawBiomeBG(sc); return; }
  const sp = $.G ? AMT.space(sc) : 1;
  const bg = ctx.createLinearGradient(0, 0, 0, PH);
  bg.addColorStop(0, '#020306');
  bg.addColorStop(1, '#070b14');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, PH);
  // real sky behind the dot stars, all JWST via RODA (tools/jades_backdrop.py, tools/roda_sky.py): the JADES deep
  // field in Descent 1, Carina's "Cosmic Cliffs" (NGC 3324) in Descent 2, the Tarantula (30 Doradus) in Descent 3, then
  // round again; the title screen hangs over the cliffs
  const title = $.state === 'title', L = $.G && !title ? $.G.loop | 0 : 0;
  const sky = title ? 'sky-carina' : SKY[L % SKY.length];
  if (sp > 0 && ready(sky)) {
    const im = PIC[sky], ox = -((sc * .03) % im.width);
    ctx.globalAlpha = sp * (title ? .42 : SKY_A[sky]);
    ctx.drawImage(im, Math.round(ox), 0);
    if (ox + im.width < W) ctx.drawImage(im, Math.round(ox + im.width), 0);
    ctx.globalAlpha = 1;
  }
  if (sp > 0 && !title) drawWound(sp, sc, L);
  if (sp > 0) {
    STARS.forEach((L, l) => {
      const s = [.05, .15, .4][l];
      for (const st of L) {
        const x = ((st.x - sc * s) % W + W) % W,
          tw = .6 + .4 * Math.sin($.T * .05 + st.p);
        ctx.fillStyle = `rgba(${l === 2 ? '220,235,255' : '160,180,210'},${st.b * tw * sp})`;
        ctx.fillRect(x | 0, st.y | 0, l === 2 ? 1.5 : 1, 1);
      }
    });
  }
  if ($.G) {
    drawNeptune(sp, sc);
    drawTriton(sp, sc);
    drawDerelict(sp * (1 - AMT.corr(sc)), sc);
    drawInterior(AMT.corr(sc) > 0 ? innerBand(sc) : 0, sc);
    drawCoreBG(AMT.core(sc));
    drawBiomeBG(sc);
  }
}
export function drawLighting(dk) {
  dk *= biomeDark();
  if (dk <= .02) {
    LIGHTS.length = 0;
    return;
  }
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, W, H);
  lctx.fillStyle = `rgba(1,2,4,${dk})`;
  lctx.fillRect(0, 0, W, PH);
  lctx.globalCompositeOperation = 'destination-out';
  const LS = glowSpr('0,0,0');
  for (const L of LIGHTS) {
    lctx.globalAlpha = Math.min(1, L.a);
    lctx.drawImage(LS, L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  }
  lctx.globalAlpha = 1;
  ctx.drawImage(lc, 0, 0);
  LIGHTS.length = 0;
}
export function drawSplats() {
  const sp = splatCols();
  for (const s of splats) {
    const a = Math.min(1, s.l / 100) * .88;
    ctx.globalAlpha = a;
    ctx.fillStyle = sp ? sp[0] : '#3d0206';
    for (const b of s.b) {
      ctx.beginPath();
      ctx.arc(s.x + b.dx, s.y + b.dy, b.r + .8, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = sp ? sp[1] : '#8a0610';
    for (const b of s.b) {
      ctx.beginPath();
      ctx.arc(s.x + b.dx - .4, s.y + b.dy - .4, b.r, 0, TAU);
      ctx.fill();
    }
    for (const d of s.dr) {
      ctx.fillStyle = sp ? sp[2] : '#6a040b';
      ctx.fillRect(s.x + d.dx - d.w / 2, s.y + d.dy, d.w, d.len);
      ctx.beginPath();
      ctx.arc(s.x + d.dx, s.y + d.dy + d.len, d.w * .75, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,170,170,.35)';
    for (let i = 0; i < s.b.length; i += 3) {
      const b = s.b[i];
      ctx.fillRect(s.x + b.dx - b.r * .4, s.y + b.dy - b.r * .5, Math.max(1, b.r * .4), 1);
    }
  }
  ctx.globalAlpha = 1;
}

// --- hell flash image ---
