// @ts-nocheck
import { $ } from '../state';
import { biomeEdge, biomeK, biomeTerrainFill, drawBiomeBG, drawBiomeDecor, splatCols, biomeDark } from '../biomes';
import { C, H, PH, TAU, TS, W, ctx, hash, lc, lctx, sstep } from '../core';
import { AMT, LIGHTS, ceilAt, floorAt, splats } from '../world';
import { DERE, STARS, fleshPat, metalPat } from '../textures';
import { drawChain, drawHookTip, drawSkull, glow, glowSpr, invCross, light, poly } from '../render/util';
import { eye } from '../render/eyes';

// --- terrain & backgrounds ---
export function drawTerrain() {
  const sc = $.G.scroll,
    x0 = -(sc % TS),
    corr = AMT.corr(sc + W / 2);
  const mtx = new DOMMatrix().translate(-sc, 0);
  metalPat.setTransform(mtx);
  fleshPat.setTransform(mtx);
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
    if (corr > 0 && bk < 1) {
      ctx.globalAlpha = corr * .7 * (1 - bk);
      ctx.fillStyle = fleshPat;
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
    invCross(ctx, x, f - 24, 24, 3, '#0b0e12');
    invCross(ctx, x - .5, f - 24, 24, 2, '#2a323c');
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
export function drawDerelict(a, sc) {
  if (a <= 0) return;
  ctx.globalAlpha = a;
  const off = W * .55 - sc * .12,
    base = PH * .72;
  for (const s of DERE) {
    const x = off + s.x;
    if (x > W + 80 || x + s.w < -80) continue;
    ctx.fillStyle = '#0d1116';
    ctx.fillRect(x, base - s.h, s.w + 1, s.h + 18);
    ctx.fillStyle = '#1d252e';
    ctx.fillRect(x, base - s.h, s.w, 1);
    if (s.sp) {
      ctx.fillStyle = '#0d1116';
      poly(ctx, [[x + s.w / 2 - 3, base - s.h], [x + s.w / 2, base - s.h - s.sp], [x + s.w / 2 + 3, base - s.h]]);
      ctx.fillRect(x + s.w / 2 - 6, base - s.h - s.sp * .4, 12, 1);
    }
    for (const w of s.win) {
      if (($.T >> 5) % 7 === w.dx % 7 && w.dx % 5 === 0) continue;
      ctx.fillStyle = w.dx % 3 ? '#a8d4ff' : '#ffcf7a';
      ctx.fillRect(x + w.dx, base - s.h + 2 + w.dy * .7, 1, 1);
    }
  }
  const rx = off + 1560,
    ry = base - 10;
  if (rx < W + 120 && rx > -140) {
    ctx.strokeStyle = '#141a21';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(rx, ry, 48, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#29313b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(rx, ry, 52, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#0d1116';
    ctx.fillRect(rx - 3, ry - 58, 6, 116);
    ctx.fillRect(rx - 58, ry - 3, 116, 6);
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
    ctx.fillStyle = `rgba(190,220,250,${.55 * fl})`;
    ctx.fillRect(cx - 2, cy - 18, 4, 36);
    ctx.fillRect(cx - 10, cy + 5, 20, 4);
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
    invCross(ctx, cx, yT, h, 9, '#0a0c0f');
    invCross(ctx, cx - 1, yT, h, 6, '#141920');
    ctx.save();
    ctx.translate(cx, yT + h * .48);
    ctx.fillStyle = '#120909';
    ctx.fillRect(-5, -18, 10, 28);
    ctx.fillRect(-4, -36, 3, 18);
    ctx.fillRect(1, -36, 3, 18);
    ctx.fillRect(-20, 8, 40, 3);
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
  invCross(ctx, cx, cy - 150, 320, 22, 'rgba(14,0,2,.85)');
  invCross(ctx, cx, cy - 150, 320, 14, 'rgba(70,4,10,.35)');
  ctx.globalCompositeOperation = 'lighter';
  glow(cx, cy, 260, '110,0,10', .35 + .1 * Math.sin($.T * .05));
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
export function drawBG() {
  const sc = $.G ? $.G.scroll : $.T * .6;
  const sp = $.G ? AMT.space(sc) : 1;
  const bg = ctx.createLinearGradient(0, 0, 0, PH);
  bg.addColorStop(0, '#020306');
  bg.addColorStop(1, '#070b14');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, PH);
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
    drawDerelict(sp * (1 - AMT.corr(sc)), sc);
    drawInterior(AMT.corr(sc) > 0 ? sstep(5000, 5400, sc) * (1 - sstep(8500, 8900, sc)) : 0, sc);
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
