// @ts-nocheck
import { $ } from '../state';
import { C, FONT_D, H, PH, R, TAU, W, ctx, hash, ri, rr, swapRm } from '../core';
import { lv } from '../save';
import { touch } from '../input';
import { drops } from '../world';
import { shopNext } from '../flow';
import { GM, ROM, gmL, gunHeld, gunSlots } from '../mutations';
import { buy, fmtBio, leaveShop, overItems, pad, pauseItems, shopItems, titleItems } from '../menus';
import { glow, invCross, txt } from '../render/util';
import { EYEQ, GLQ, present } from '../render/eyes';
import { drawShip } from '../render/ship';
import { drawBoss } from '../render/boss';
import { drawDrops } from '../render/gore';
import { drawBG, drawSplats } from '../render/terrain';
import { postFX } from '../render/hell';
import { drawEShots, drawHUD, drawWorld } from '../render/hud';

// --- screens ---
export function drawMutList() {
  txt('MUTATIONS // YOU BECOME WHAT YOU KILL // GUN GRAFTS ' + gunHeld().length + '/' + gunSlots(), W / 2, 170, '#8a5a5a', 'center', 7);
  GM.forEach((m, i) => {
    const col = i % 2,
      row = i >> 1,
      x = col ? W / 2 + 10 : 24,
      y = 181 + row * 12,
      l = gmL(m.id),
      c = m.k === '*' ? $.G.gmk : $.G.kk[m.k] || 0,
      nx = m.n[l];
    txt(m.name + (l ? ' ' + ROM[l] : ''), x, y, l ? m.sh ? '#9fd2ff' : '#ffb070' : '#55606c', 'left', 7);
    txt(nx != null ? c + '/' + nx + ' ' + m.w : 'MAX', x + 206, y, '#6d7a88', 'right', 7);
  });
  txt('WARD ' + ['NONE', 'MEMBRANE', 'MIRROR', 'BONE AEGIS'][$.P ? $.P.wardLv || 0 : 0], W / 2 + 10, 181 + 5 * 12, '#9fd2ff', 'left', 7);
}
export function drawMenu(items, x, y, w) {
  $.menuBoxes = [];
  items.forEach((it, i) => {
    const yy = y + i * 14,
      sel = $.menuSel === i;
    if (sel) {
      ctx.fillStyle = 'rgba(161,13,20,.35)';
      ctx.fillRect(x - 6, yy - 2, w + 12, 12);
      ctx.fillStyle = C.bloodL;
      ctx.fillRect(x - 10, yy + 1, 2, 6);
      ctx.fillRect(x - 12, yy + 3, 6, 2);
    }
    txt(it.l, x, yy, sel ? '#ffffff' : '#8fa3b8');
    if (it.r) txt(it.r, x + w, yy, sel ? '#ffb0b0' : '#5b6573', 'right');
    $.menuBoxes.push({
      x: x - 12,
      y: yy - 3,
      w: w + 24,
      h: 13,
      i,
      a: it.a
    });
  });
}
export function drawTitle() {
  drawBG();
  const b = {
    x: W * .73,
    y: PH * .48,
    ra: $.T * .006,
    rb: -$.T * .01,
    plates: [],
    tent: [],
    t: $.T,
    phase: 0,
    eye: Math.max(0, Math.sin($.T * .008)) * .9,
    fl: 0,
    laser: null,
    hp: 1,
    max: 1,
    dying: 1
  };
  $.P = $.P || {
    x: 40,
    y: PH / 2,
    hist: []
  };
  invCross(ctx, W * .73, -10, PH + 20, 16, '#0c0204');
  invCross(ctx, W * .73, -10, PH + 20, 10, '#2a0408');
  ctx.save();
  ctx.globalAlpha = .85;
  drawBoss(b);
  ctx.restore();
  if (R() < .25) drops.push({
    x: rr(W * .55, W * .95),
    y: -2,
    px: 0,
    py: 0,
    vx: 0,
    vy: rr(.5, 1.5),
    s: 1,
    c: R() < .5 ? 0 : 1,
    l: 300
  });
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.px = d.x;
    d.py = d.y;
    d.vy += .05;
    d.y += d.vy;
    if (d.y > H) swapRm(drops, i);
  }
  drawDrops();
  ctx.fillStyle = 'rgba(2,3,6,.55)';
  ctx.fillRect(0, 0, W * .56, H);
  const gx = R() < .04 ? ri(-4, 4) : 0;
  txt('GRODIUS', 26 + gx + 2, 30 + 2, '#1a0003', 'left', 64, FONT_D);
  txt('GRODIUS', 26 + gx, 30, '#b3121a', 'left', 64, FONT_D);
  if (R() < .05) {
    {
      const y = 40 + ri(0, 40),
        h = ri(3, 8);
      GLQ.push([20, y, 240, h, 20 + ri(-8, 8), y, 240, h]);
    }
  }
  txt('DERELICT MERIDIAN // NEPTUNE ORBIT', 28, 96, '#6d8094');
  drawMenu(titleItems(), 40, 124, 150);
  txt('ARROWS/WASD MOVE   Z/SPACE FIRE', 28, 196, '#5b6573');
  txt('FLY INTO A POD TO TAKE IT   P PAUSE   M MUTE', 28, 206, '#5b6573');
  txt(touch.used ? 'TOUCH: DRAG TO FLY, AUTO-FIRE' : 'GAMEPAD: A FIRE, START PAUSE', 28, 216, '#3f4955');
  txt('HI ' + pad($.hi, 8), 28, 236, '#8fa3b8');
  txt('EXTREME GORE. FLASHING IMAGES.', W - 8, H - 12, '#5a2a2c', 'right');
}
export function drawOverlay(title, sub, col) {
  ctx.fillStyle = 'rgba(8,0,1,.72)';
  ctx.fillRect(0, 0, W, H);
  txt(title, W / 2 + 2, 46 + 2, '#000', 'center', 44, FONT_D);
  txt(title, W / 2, 46, col, 'center', 44, FONT_D);
  if (sub) txt(sub, W / 2, 96, '#8fa3b8', 'center');
}
export function drawOver() {
  const a = Math.min(1, $.G.overT / 60);
  ctx.globalAlpha = a;
  drawOverlay('SIGNAL LOST', 'THE MERIDIAN KEEPS WHAT IT CATCHES', '#c3121c');
  const rows = [['SCORE', pad($.G.score, 8)], ['KILLS', $.G.kills], ['WORST CARNAGE', $.G.maxCombo + ' CHAIN'], ['BIOMASS HARVESTED', Math.floor($.G.bio)], ['DEEPEST', `DESCENT ${$.G.loop + 1}`]];
  rows.forEach((r, i) => {
    txt(r[0], W / 2 - 90, 116 + i * 11, '#6d7a88');
    txt(String(r[1]), W / 2 + 90, 116 + i * 11, '#cfd9e3', 'right');
  });
  if ($.G.newHi && ($.T >> 4) % 2) txt('NEW RECORD', W / 2, 100, '#ffd23a', 'center', 14, FONT_D);
  drawMenu(overItems(), W / 2 - 80, 180, 160);
  ctx.globalAlpha = 1;
}
export function drawShop() {
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  glow(W * .5, -20, 220, '160,190,220', .16);
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < W; i += 7) {
    const len = 8 + hash(i * .3) * 30 + Math.sin($.T * .01 + i) * 4;
    ctx.fillStyle = '#3d0206';
    ctx.fillRect(i, 0, 2, len);
    ctx.beginPath();
    ctx.arc(i + 1, len, 1.6, 0, TAU);
    ctx.fill();
  }
  txt('THE INFIRMARY', 20, 18, '#b3121a', 'left', 36, FONT_D);
  txt('GRAFT WHAT YOU HARVESTED. GRAFTS ARE PERMANENT.', 22, 56, '#6d8094');
  txt(fmtBio($.meta.bio), W - 14, 8, '#ffb0b0', 'right', 8);
  {
    let tr = 0;
    for (const k in $.meta.lv) tr += $.meta.lv[k] || 0;
    ctx.globalCompositeOperation = 'lighter';
    glow(372, 38, 40, '160,20,30', .4);
    ctx.globalCompositeOperation = 'source-over';
    drawShip(ctx, 368, 38, 0, 1.6, 1);
    txt('MUTATION ' + tr + '/19', 368, 56, '#8a5a5a', 'center', 7);
  }
  const it = shopItems();
  $.menuBoxes = [];
  it.forEach((x, i) => {
    const y = 72 + i * 17,
      sel = $.menuSel === i;
    if (sel) {
      ctx.fillStyle = 'rgba(161,13,20,.3)';
      ctx.fillRect(14, y - 3, W - 28, 15);
      ctx.fillStyle = C.bloodL;
      ctx.fillRect(14, y - 3, 2, 15);
    }
    if (x.back) {
      txt(shopNext === 'loop' ? 'CONTINUE THE DESCENT' : 'RETURN', 24, y + 1, sel ? '#fff' : '#8fa3b8');
    } else {
      const u = x.u,
        l = lv(u.id),
        mx = l >= u.max,
        cost = mx ? 0 : u.cost[l],
        can = !mx && $.meta.bio >= cost;
      txt(u.name, 24, y + 1, sel ? '#fff' : '#9fb0c2');
      for (let k = 0; k < u.max; k++) {
        ctx.fillStyle = k < l ? C.bloodL : '#26303a';
        ctx.fillRect(196 + k * 9, y + 1, 7, 7);
      }
      txt(mx ? 'GRAFTED' : cost + ' BIO', W - 22, y + 1, mx ? '#4b5663' : can ? '#ffb0b0' : '#5a3a3c', 'right');
    }
    $.menuBoxes.push({
      x: 14,
      y: y - 3,
      w: W - 28,
      h: 15,
      i,
      a: () => {
        const z = it[i];
        z.back ? leaveShop() : buy(z.u);
      }
    });
  });
  const s = it[$.menuSel];
  if (s && s.u) txt(s.u.desc, 24, H - 18, '#bfd6ee');else txt('Z/ENTER GRAFT   X/ESC LEAVE', 24, H - 18, '#5b6573');
}
export function render() {
  $.menuBoxes = [];
  $.FLUSHED = 0;
  EYEQ.length = 0;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if ($.state === 'title') {
    drawTitle();
  } else if ($.state === 'shop') {
    drawShop();
  } else {
    const shx = $.G.shx || 0,
      shy = $.G.shy || 0;
    ctx.save();
    ctx.translate(shx, shy);
    drawWorld();
    ctx.restore();
    drawSplats();
    ctx.save();
    ctx.translate(shx, shy);
    drawEShots();
    ctx.restore();
    postFX();
    drawHUD();
    if ($.state === 'over') drawOver();
    if ($.state === 'pause') {
      drawOverlay('PAUSED', 'THE SHIP IS STILL LISTENING', '#9fb0c2');
      drawMenu(pauseItems(), W / 2 - 70, 124, 140);
      drawMutList();
    }
  }
  ctx.restore();
  present();
}

// ---------------- loop ----------------
