// @ts-nocheck
import { $ } from '../state';
import { C, FONT_D, FONT_H, H, PH, TAU, W, ctx, hash, psBtn, sstep, swapRm } from '../core';
import { srnd, srr, sri } from '../srnd';
import { SET, lv } from '../save';
import { touch } from '../input';
import { drops } from '../world';
import { shopNext } from '../flow';
import { GM, ROM, gmL, gunHeld, gunSlots } from '../mutations';
import { buy, buySocket, exitArmed, fmtBio, overItems, pad, pauseItems, rigAct, rigBolted, rigCost, rigFree, rigOwned, rigUp, rigUpCost, shopAct, shopItems, shopSec, sockCost, titleItems, titleSubOf } from '../menus';
import { SHOP_EXIT, SHOP_LIST, SUB_BACK, TITLE_MENU } from '../backstep';
import { RIG_LV, SOCKET_COST, SOCKET_MAX, rigFresh, rigInit, rigged, sockets } from '../contraptions';
import { glow, light, txt } from '../render/util';
import { EYEQ, GLQ, eye, present } from '../render/eyes';
import { drawShip } from '../render/ship';
import { PIC, ready } from '../textures';
import { pIn, pOut } from '../perf';
import { drawBoss } from '../render/boss';
import { drawDrops } from '../render/gore';
import { drawBG, drawSplats } from '../render/terrain';
import { postFX } from '../render/hell';
import { drawEShots, drawHUD, drawWorld } from '../render/hud';
import { SPR, spr, sprAt } from '../sprites';
import { drawTitleHead } from './titlehead';

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
    if (it.r) txt(it.r, x + w, yy, it.rc || (sel ? '#ffb0b0' : '#5b6573'), 'right');
    $.menuBoxes.push({
      x: x - 12,
      y: yy - 3,
      w: w + 24,
      h: 13,
      i,
      a: it.a,
      confirm: it.confirm
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
  drawTitleEye();
  if (srnd() < .25) drops.push({
    x: srr(W * .55, W * .95),
    y: -2,
    px: 0,
    py: 0,
    vx: 0,
    vy: srr(.5, 1.5),
    s: 1,
    c: srnd() < .5 ? 0 : 1,
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
  drawTitleHead();
  const gx = srnd() < .04 ? sri(-4, 4) : 0;
  txt('GRODIUS', 26 + gx + 2, 30 + 2, '#1a0003', 'left', 64, FONT_D);
  txt('GRODIUS', 26 + gx, 30, '#b3121a', 'left', 64, FONT_D);
  if (srnd() < .05) {
    {
      const y = 40 + sri(0, 40),
        h = sri(3, 8);
      GLQ.push([20, y, 240, h, 20 + sri(-8, 8), y, 240, h]);
    }
  }
  if (!SET.asked && !$.gate) {
    txt('THIS GAME HAS FLASHING IMAGES.', 28, 96, '#f0c8c8');
    txt('YOU CAN CHANGE THIS LATER IN OPTIONS.', 28, 142, '#8fa3b8');
  } else txt('DERELICT MERIDIAN // NEPTUNE ORBIT', 28, 96, '#6d8094');
  if ($.gate) {
    $.menuBoxes = [];
    if (($.T >> 5) % 2 === 0) txt(touch.used || matchMedia('(pointer: coarse)').matches ? 'TAP TO DESCEND' : 'PRESS ANY KEY', 40, 140, '#e0242c', 'left', 10);
  } else drawMenu(titleItems(), 40, TITLE_MENU.y, 150); // up to 7 rows (14px) must clear the help text and the sub-menu BACK at y 206
  const it = !$.gate && SET.asked && titleSubOf() ? titleItems() : null;
  if (it) {
    // a sub-menu (OPTIONS, LAB): a thumb-sized BACK where the help and HI were; the BACK row stays for keys
    const bi = it.findIndex(x => x.l === 'BACK');
    if (bi >= 0) bigBtn(SUB_BACK.x, SUB_BACK.y, SUB_BACK.w, SUB_BACK.h, '< BACK', bi, it[bi].a); // a sub-menu without a BACK row draws no button rather than throw
  } else {
    txt('ARROWS/WASD MOVE   Z/SPACE FIRE', 28, 208, '#5b6573');
    txt((SET.meter ? 'CAPSULES MOVE THE METER, X POWERS UP' : 'FLY INTO A POD TO TAKE IT') + '   P PAUSE   M MUTE', 28, 217, '#5b6573');
    txt(touch.used ? 'TOUCH: DRAG TO FLY, AUTO-FIRE' + (SET.meter ? ', POWER BUTTON' : '') : 'GAMEPAD: A FIRE, ' + (SET.meter ? 'B POWER, ' : '') + 'START PAUSE', 28, 226, '#3f4955');
    txt('HI ' + pad($.hi, 8), 28, 240, '#8fa3b8');
  }
  // a first Android back at the title root armed the leave (backstep.ts EXIT_ARM_T): say what the second does in the
  // next row slot under LAB, lined up with the rows (root: <= 6 rows, so y <= 194, clear of the help text at 208)
  if (exitArmed()) txt('PRESS BACK AGAIN TO LEAVE', 40, TITLE_MENU.y + titleItems().length * TITLE_MENU.pitch, '#ffd0a0');
  txt('EXTREME GORE. FLASHING IMAGES.', W - 8, H - 12, '#c46a6e', 'right');
  txt('SPRITES: TIAMALT, SCARCZ, C.BELLANGER, D.COOK, SUNBURN, CIDERCORPSE', W - 8, H - 39, '#3a4048', 'right', 7);
  txt('MUSIC: DANCRAMP - VOID, FREESOUND ARTISTS   SFX: KENNEY, FREESOUND', W - 8, H - 30, '#3a4048', 'right', 7);
  txt('IMAGES: NASA/ESA/CSA JWST, VOYAGER 2, CHANDRA, FLICKR   SEE CREDITS.MD', W - 8, H - 21, '#3a4048', 'right', 7);
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
  drawOverCreep(a);
  const rows = [['SCORE', pad($.G.score, 8)], ['KILLS', $.G.kills], ['WORST CARNAGE', $.G.maxCombo + ' CHAIN'], ['BIOMASS HARVESTED', Math.floor($.G.bio)], ['DEEPEST', `DESCENT ${$.G.loop + 1}`]];
  rows.forEach((r, i) => {
    txt(r[0], W / 2 - 90, 116 + i * 11, '#6d7a88');
    txt(String(r[1]), W / 2 + 90, 116 + i * 11, '#cfd9e3', 'right');
  });
  if ($.G.newHi && ($.T >> 4) % 2) txt('NEW RECORD', W / 2, 100, '#ffd23a', 'center', 14, FONT_D);
  drawMenu(overItems(), W / 2 - 80, 180, 160);
  ctx.globalAlpha = 1;
}
/** game over: the horned skull-thing (src/sprites/creep@16.png) rises at the left of the tally and chews on your score,
 *  eyes flaring molten on the GIF's glow cycle, bloody drool stringing off its jaw. Render-only clocks ($.T). */
const CREEP_EYE = [0, .25, .55, .85, 1, .85, .55, .25];
function drawOverCreep(a) {
  if (!SPR.creep || !SPR.creep.fw) return;
  const T = $.T, f = sprAt(T, 8), rise = 1 - sstep(15, 75, $.G.overT), x = 58, y = 132 + rise * 36 + Math.sin(T * .021) * 1.5;
  ctx.save();
  ctx.globalAlpha = a * (1 - rise * .7);
  // a blood-red halo so it reads off the dark overlay
  ctx.globalCompositeOperation = 'lighter';
  glow(x, y + 4, 72, '140,0,8', .4);
  ctx.globalCompositeOperation = 'source-over';
  spr(ctx, 'creep', f, x, y);
  // eye flare on the glow cycle; the hot core sits on the sprite's own glowing pupils
  const e = CREEP_EYE[f % 8];
  if (e > .1) {
    ctx.globalCompositeOperation = 'lighter';
    for (const ex of [x - 13, x + 9]) glow(ex, y + 9, 8 + 7 * e, '255,110,20', .5 * e);
    ctx.globalCompositeOperation = 'source-over';
  }
  // drool: three strings off the lower jaw that stretch, snap and fall
  const jo = [0, 0, 1, 2, 3, 3, 2, 1][f % 8], jy = y + 44 + jo;
  for (const [dx, sp, ph] of [[-11, 1, 0], [-3, .8, 37], [9, 1.2, 71]]) {
    const c = ((T * sp + ph) % 90) / 90, len = Math.min(1, c * 1.6) * 14, fall = c < .62 ? 0 : (c - .62) * 140;
    ctx.fillStyle = '#b0101c';
    ctx.fillRect(x + dx, jy + fall, 1, c < .62 ? len : 3);
    ctx.fillStyle = '#ff3a3a';
    ctx.fillRect(x + dx, jy + fall + (c < .62 ? len : 3) - 1, 1, 1);
  }
  // every chomp spits a little of your score back across the table (the GIF cycle is 8 frames at 8 fps = 60 ticks)
  const ph = (T % 60) / 60;
  for (let k = 0; k < 4; k++) {
    const t = ph - .3 - k * .035;
    if (t <= 0 || t > .4) continue;
    const u = t / .4;
    ctx.fillStyle = k % 2 ? '#c3121c' : '#7a0a10';
    ctx.globalAlpha = a * (1 - u * .6);
    ctx.fillRect(x + 16 + u * (66 + k * 14), y + 24 + jo - Math.sin(u * Math.PI) * (10 + k * 3) + u * 8, k > 1 ? 1 : 2, k > 1 ? 1 : 2);
  }
  ctx.restore();
}
function wrapTxt(s, x, y, w, col, size = 7, lh = 9, max = 4) {
  ctx.font = `${size}px ${FONT_H}`;
  const words = s.split(' '), lines = [];
  let cur = '';
  for (const wd of words) {
    const t = cur ? cur + ' ' + wd : wd;
    if (ctx.measureText(t).width > w && cur) {
      lines.push(cur);
      cur = wd;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  lines.slice(0, max).forEach((l, i) => txt(l, x, y + i * lh, col, 'left', size));
  return Math.min(max, lines.length) * lh;
}
/** a small clickable button inside a shop row; acts on the first tap */
function shopBtn(x, y, w, label, state, i, a) {
  const sel = $.menuSel === i;
  ctx.fillStyle = state === 'go' ? (sel ? '#6a0c12' : '#3a070b') : state === 'on' ? '#2a2410' : '#121519';
  ctx.fillRect(x, y - 2, w, 9);
  ctx.strokeStyle = state === 'go' ? '#c3121c' : state === 'on' ? '#8a7a40' : '#2a3038';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y - 1.5, w - 1, 8);
  txt(label, x + w / 2, y, state === 'go' ? '#ffd0d0' : state === 'on' ? '#e8d8a0' : '#4b5663', 'center', 7);
  $.menuBoxes.push({ x, y: y - 2, w, h: 9, i, a, now: 1 });
}
/** a thumb-sized exit button in the shopBtn style (Infirmary RETURN / DESCEND, the title sub-menus' BACK): acts on
 *  the first tap, and lights up when keys select its row (index i) */
function bigBtn(x, y, w, h, label, i, a) {
  const sel = $.menuSel === i;
  ctx.fillStyle = sel ? '#6a0c12' : '#3a070b';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = sel ? '#ff5a5a' : '#c3121c';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  txt(label, x + w / 2, y + h / 2 - 4, sel ? '#ffffff' : '#ffd0d0', 'center', 8);
  $.menuBoxes.push({ x, y, w, h, i, a, now: 1 });
}
/** Infirmary wall decor: the Zombie Take Away poster (src/sprites/poster@6.png, rain animates) pasted up in the gap
 *  between the graft names and their BUY buttons, under the list so rows and highlights draw over it. The neon spills
 *  onto the wall and stutters on a fixed pattern (render-only). (x, y) = top-left. */
function drawShopPoster(x, y) {
  const S = SPR.poster;
  if (!S || !S.fw) return;
  const T = $.T, w = S.fw, h = S.fh;
  // neon stutter: mostly on, a double blink every few seconds, the odd brown-out
  const ph = T % 211, buzz = ph < 4 || (ph > 9 && ph < 12) ? .15 : ph > 120 && ph < 126 ? .55 : 1;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(x + 2, y + 2, w, h);
  ctx.globalAlpha = .88;
  spr(ctx, 'poster', sprAt(T, 8), x, y, { ax: 0, ay: 0 });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  glow(x + 77, y + 34, 26, '255,60,170', .16 * buzz); // EAT HERE
  glow(x + 34, y + 8, 30, '40,230,220', .11 * (buzz < 1 ? 1.4 - buzz : 1)); // HUMANFLESH (blinks out of step)
  ctx.globalCompositeOperation = 'source-over';
  if (buzz < 1) {
    ctx.fillStyle = `rgba(0,0,0,${.45 * (1 - buzz)})`;
    ctx.fillRect(x + 68, y + 3, 16, 66);
  }
  // grime: damp creep up from the bottom, a drip line, rusty tacks
  const g = ctx.createLinearGradient(0, y + h - 30, 0, y + h);
  g.addColorStop(0, 'rgba(30,14,6,0)');
  g.addColorStop(1, 'rgba(30,14,6,.5)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y + h - 30, w, 30);
  ctx.fillStyle = 'rgba(70,6,10,.7)';
  ctx.fillRect(x + 21, y, 1, 9 + ((T >> 6) % 3));
  ctx.fillRect(x + 22, y, 1, 4);
  for (const [tx, ty] of [[x + 2, y + 2], [x + w - 4, y + 2], [x + 2, y + h - 5]]) {
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(tx, ty, 2, 2);
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(tx, ty, 1, 1);
  }
  ctx.restore();
}
const RIG_ANCHOR = { saw: [14, 0], gut: [6, 7], leech: [-2, -8], spine: [-6, -7], hook: [2, 8], furnace: [-14, 4], choir: [0, -12] };
const RIG_SHORT = { saw: 'SAW', gut: 'GUT', leech: 'LEECH', spine: 'SPINE', hook: 'WINCH', furnace: 'FURNACE', choir: 'CHOIR' };
export function drawShop() {
  rigInit();
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  glow(W * .5, -20, 220, '160,190,220', .16);
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < W; i += 7) {
    const len = 4 + hash(i * .3) * 16 + Math.sin($.T * .01 + i) * 3;
    ctx.fillStyle = '#3d0206';
    ctx.fillRect(i, 0, 2, len);
    ctx.beginPath();
    ctx.arc(i + 1, len, 1.6, 0, TAU);
    ctx.fill();
  }
  // x-ray films pinned up behind everything, lit from a cold lightbox
  ctx.globalCompositeOperation = 'lighter';
  if (ready('xray-teeth')) {
    ctx.globalAlpha = .13;
    ctx.drawImage(PIC['xray-teeth'], 140, H - 96);
  }
  if (ready('xray-skull')) {
    ctx.globalAlpha = .2 + .03 * Math.sin($.T * .03);
    ctx.drawImage(PIC['xray-skull'], 330, 36);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  drawShopPoster(146, 158);
  txt('THE INFIRMARY', 14, 10, '#b3121a', 'left', 26, FONT_D);
  txt('BUILD YOUR WAR MACHINE. GRAFTS ARE PERMANENT.', 16, 36, '#6d8094', 'left', 7);
  // biomass purse
  {
    const bw = 118, bx = W - bw - 10;
    ctx.fillStyle = '#1a0306';
    ctx.fillRect(bx, 10, bw, 16);
    ctx.strokeStyle = '#6a0c12';
    ctx.strokeRect(bx + .5, 10.5, bw - 1, 15);
    txt(fmtBio($.meta.bio), bx + bw - 6, 14, '#ffb0b0', 'right', 8);
    txt('BIOMASS', bx + 5, 15, '#7a4a4c', 'left', 7);
  }
  const it = shopItems(), LX = 12, LW = 284, RH = SHOP_LIST.rh;
  $.menuBoxes = [];
  let y = SHOP_LIST.top, sec = -1, bottom = 0;
  const HEAD = ['CONTRAPTIONS  //  ENTER BUY / BOLT   RIGHT UPGRADE', 'SOCKETS', 'GRAFTS', ''];
  it.forEach((x, i) => {
    const sc = shopSec(x.k);
    if (x.k === 'back') {
      // the exit is a button anchored bottom-left (H - 38), outside the list's flow; keys still reach it as the last row
      const loop = shopNext === 'loop', E = SHOP_EXIT;
      bigBtn(E.x, E.y, loop ? E.wLoop : E.w, E.h, loop ? 'DESCEND >' : '< RETURN', i, () => shopAct(it[i]));
      return;
    }
    if (sc !== sec) {
      sec = sc;
      y += sc ? SHOP_LIST.gap : 0;
      txt(HEAD[sc], LX + 2, y, '#8a3a3c', 'left', 7);
      ctx.fillStyle = '#3a0a0e';
      ctx.fillRect(LX, y + 8, LW, 1);
      y += SHOP_LIST.head;
    }
    const sel = $.menuSel === i;
    if (sel) {
      ctx.fillStyle = 'rgba(161,13,20,.3)';
      ctx.fillRect(LX, y - 2, LW, RH + 1);
      ctx.fillStyle = C.bloodL;
      ctx.fillRect(LX, y - 2, 2, RH + 1);
    }
    const pips = (n, l, px) => { for (let k = 0; k < n; k++) { ctx.fillStyle = k < l ? C.bloodL : '#26303a'; ctx.fillRect(px + k * 7, y, 5, 5); } };
    if (x.k === 'rig') {
      const r = x.r, own = rigOwned(r.id), bolted = rigBolted(r.id), l = own ? $.meta.cl[r.id] || 1 : 0;
      txt(r.name, LX + 8, y, sel ? '#fff' : own ? '#cfd9e3' : '#8a98a8', 'left', 7);
      pips(3, l, 112);
      if (bolted) txt('BOLTED', 136, y, '#e8d8a0', 'left', 7);
      else if (own) txt('SPARE', 136, y, '#6d7a88', 'left', 7);
      const c = rigCost(r), can = $.meta.bio >= c, full = rigged().length >= sockets();
      if (!own) shopBtn(182, y, 56, c ? 'BUY ' + c : 'TAKE FREE', can ? 'go' : 'off', i, () => rigAct(r));
      else if (bolted) shopBtn(182, y, 56, 'UNBOLT', 'on', i, () => rigAct(r));
      else shopBtn(182, y, 56, full ? 'FULL' : 'BOLT ON', full ? 'off' : 'go', i, () => rigAct(r));
      const uc = rigUpCost(r);
      if (own) shopBtn(241, y, 55, uc ? 'LV' + (l + 1) + ' ' + uc : 'MAX', uc && $.meta.bio >= uc ? 'go' : 'off', i, () => rigUp(r));
    } else if (x.k === 'sock') {
      const l = lv('socket'), c = sockCost();
      txt('EXTRA SOCKET', LX + 8, y, sel ? '#fff' : '#9fb0c2', 'left', 7);
      pips(SOCKET_MAX, sockets(), 112);
      txt(rigged().length + '/' + sockets() + ' USED', 136, y, '#6d7a88', 'left', 7);
      shopBtn(182, y, 114, c ? 'CUT A SOCKET  ' + c : 'HULL IS FULL', c && $.meta.bio >= c ? 'go' : 'off', i, buySocket);
    } else if (x.k === 'upg') {
      const u = x.u, l = lv(u.id), mx = l >= u.max, cost = mx ? 0 : u.cost[l], can = !mx && $.meta.bio >= cost;
      txt(u.name, LX + 8, y, sel ? '#fff' : '#9fb0c2', 'left', 7);
      pips(u.max, l, 112);
      shopBtn(241, y, 55, mx ? 'GRAFTED' : 'BUY ' + cost, can ? 'go' : 'off', i, () => buy(u));
    }
    $.menuBoxes.push({ x: LX, y: y - 2, w: LW, h: RH, i, a: () => shopAct(it[i]) }); // after the buttons: a button hit wins
    bottom = y - 2 + RH;
    y += SHOP_LIST.pitch;
  });
  // a new graft or contraption row must not slide under the exit button (tests/unit/backstep.test.ts checks the budget)
  if (import.meta.env.DEV && bottom > SHOP_EXIT.y - 2 && !drawShop.warned) {
    drawShop.warned = 1;
    console.error(`Infirmary list ends at y ${bottom}, over the exit button at ${SHOP_EXIT.y}`);
  }
  // ---- right: the ship on the slab, its sockets, the selected thing ----
  const PX = 304, PW = W - PX - 10, sx = 386, sy = 74, ss = 2.4;
  ctx.fillStyle = 'rgba(20,4,6,.75)';
  ctx.fillRect(PX, 32, PW, H - 44);
  ctx.strokeStyle = '#2a0a0e';
  ctx.strokeRect(PX + .5, 32.5, PW - 1, H - 45);
  $.P = $.P || { x: sx, y: sy, hist: [] };
  {
    // idle-animate the live rig state so the preview breathes (render/ship.ts reads $.P.rig)
    const R = ($.P.rig ||= rigFresh()), t = $.T;
    R.saw.spin = .5 + .5 * Math.sin(t * .03);
    R.saw.rot = (R.saw.rot || 0) + .3;
    R.gut.charge = (t % 170) / 170;
    R.leech.fill = (t % 300) / 300;
    R.spine.cd = Math.min(1, (t % 140) / 110);
    R.hook.phase = 0;
    R.hook.st = 0;
    R.hook.tx = sx;
    R.hook.ty = sy;
    R.furnace.heat = .6 + .4 * Math.sin(t * .05);
    R.choir.chg = (t % 240) / 240;
  }
  ctx.globalCompositeOperation = 'lighter';
  glow(sx, sy, 50, '160,20,30', .4);
  ctx.globalCompositeOperation = 'source-over';
  drawShip(ctx, sx, sy, 0, ss, 1);
  // sockets
  const rg = rigged(), cur = it[$.menuSel] || {};
  for (let k = 0; k < SOCKET_MAX; k++) {
    const bw = 50, bx = PX + 6 + k * (bw + 4), by = 110, open = k < sockets(), q = rg[k];
    if (q) {
      const [ax, ay] = RIG_ANCHOR[q.id] || [0, 0];
      ctx.strokeStyle = cur.r && cur.r.id === q.id ? '#ff5a5a' : '#5a1a1e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + bw / 2, by);
      ctx.lineTo(bx + bw / 2, by - 6);
      ctx.lineTo(sx + ax * ss, sy + ay * ss);
      ctx.stroke();
      ctx.fillStyle = '#ff5a5a';
      ctx.fillRect(sx + ax * ss - 1, sy + ay * ss - 1, 2, 2);
    }
    ctx.fillStyle = q ? '#3a0a0e' : open ? '#0d1014' : '#08090b';
    ctx.fillRect(bx, by, bw, 22);
    ctx.strokeStyle = q ? (cur.r && cur.r.id === q.id ? '#ff5a5a' : '#a3242c') : open ? '#3a4048' : '#1a1d22';
    if (!open) ctx.setLineDash([2, 2]);
    ctx.strokeRect(bx + .5, by + .5, bw - 1, 21);
    ctx.setLineDash([]);
    txt('SOCKET ' + (k + 1), bx + bw / 2, by + 3, '#6d5a5c', 'center', 7);
    if (q) txt(RIG_SHORT[q.id] + ' ' + ROM[q.lvl], bx + bw / 2, by + 12, '#ffd0c0', 'center', 7);
    else if (open) txt('EMPTY', bx + bw / 2, by + 12, '#4b5663', 'center', 7);
    else txt(SOCKET_COST[k - 1] + ' BIO', bx + bw / 2, by + 12, '#6d7a88', 'center', 7);
  }
  // selected item detail
  let dy = 140;
  const DX = PX + 6, DW = PW - 12;
  if (cur.k === 'rig') {
    const r = cur.r, own = rigOwned(r.id), l = own ? $.meta.cl[r.id] || 1 : 0;
    txt(r.name, DX, dy, '#ff8a8a', 'left', 8);
    dy += 11;
    dy += wrapTxt(r.desc, DX, dy, DW, '#bfd6ee', 7, 9, 4) + 3;
    RIG_LV[r.id].forEach((s, k) => {
      const on = k < l;
      txt(ROM[k + 1], DX, dy, on ? '#ffd23a' : '#4b5663', 'left', 7);
      dy += wrapTxt(s, DX + 14, dy, DW - 14, on ? '#e8d8b4' : k === l ? '#9fb0c2' : '#55606c', 7, 9, 2) + 1;
    });
    dy += 3;
    if (!own) txt(rigFree() ? 'YOUR FIRST CONTRAPTION IS FREE' : 'COSTS ' + r.cost + ' BIO', DX, dy, rigFree() ? '#ffd23a' : '#8a98a8', 'left', 7);
    else if (l < 3) txt('LEVEL ' + (l + 1) + ': ' + rigUpCost(r) + ' BIO  (RIGHT)', DX, dy, '#8a98a8', 'left', 7);
  } else if (cur.k === 'sock') {
    txt('EXTRA SOCKET', DX, dy, '#ff8a8a', 'left', 8);
    dy += 11;
    wrapTxt('Cut another socket into the hull so one more contraption can ride along. Up to 3. Bolt and unbolt freely between runs.', DX, dy, DW, '#bfd6ee', 7, 9, 5);
  } else if (cur.k === 'upg') {
    txt(cur.u.name, DX, dy, '#ff8a8a', 'left', 8);
    dy += 11;
    wrapTxt(cur.u.desc, DX, dy, DW, '#bfd6ee', 7, 9, 5);
  } else {
    txt(shopNext === 'loop' ? 'BACK INTO THE MERIDIAN' : 'BACK TO THE SURFACE', DX, dy, '#ff8a8a', 'left', 8);
    dy += 11;
    wrapTxt('Bolted contraptions ride with you every run. Kills, clears and grades pay biomass.', DX, dy, DW, '#8a98a8', 7, 9, 4);
  }
  // feedback / help line
  // right of the exit button (the spec's x 116; 140 beside the wider DESCEND >)
  const FX = SHOP_EXIT.x + (shopNext === 'loop' ? SHOP_EXIT.wLoop : SHOP_EXIT.w) + 8;
  if ($.shopMsg) txt($.shopMsg.s, FX, H - 11, $.shopMsg.col, 'left', 7);
  else txt(touch.used ? 'TAP A BUTTON TO ACT   TAP A ROW TO INSPECT' : 'ARROWS PICK   Z/ENTER ACT   RIGHT UPGRADE   X/ESC LEAVE', FX, H - 11, '#5b6573', 'left', 7);
}
export function render() {
  $.menuBoxes = [];
  // the touch pause button only where it works (play, pause): elsewhere it covered the Infirmary purse and did nothing.
  // Written only on a change, so no DOM write per frame
  const psH = !(touch.used && ($.state === 'play' || $.state === 'pause'));
  if (psBtn.hidden !== psH) psBtn.hidden = psH;
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
    pIn();
    ctx.save();
    ctx.translate(shx, shy);
    drawWorld();
    ctx.restore();
    pOut('world');
    pIn();
    drawSplats();
    postFX();
    // enemy bullets go over the hell image and the washes: a bullet must never be hidden by an effect
    ctx.save();
    ctx.translate(shx, shy);
    drawEShots();
    ctx.restore();
    pOut('fx');
    pIn();
    drawHUD();
    pOut('hud');
    if ($.state === 'over') drawOver();
    if ($.state === 'pause') {
      drawOverlay('PAUSED', 'THE SHIP IS STILL LISTENING', '#9fb0c2');
      drawMenu(pauseItems(), W / 2 - 70, 124, 140);
      drawMutList();
    }
  }
  ctx.restore();
  pIn();
  present();
  pOut('present');
}

// ---------------- loop ----------------

// Beside drawTitleEye on purpose: this lane may only touch this function's neighbourhood (imports hoist anyway)
import { titleGaze } from './titlegaze';
const TGZ = { x: 0, y: 0, ang: 0, m: 0, bl: 0, jig: 0, phase: 0 }, TGZ_LATE = { x: 0, y: 0, ang: 0, m: 0, bl: 0, jig: 0, phase: 0 };
const ROPE_N = 14, ROPE_X = new Float32Array(ROPE_N + 1), ROPE_Y = new Float32Array(ROPE_N + 1);
const ROPE_W = [22, 17, 11, 4], ROPE_C = ['#140a08', '#33201a', '#57402a', '#8c7a4e'];
/** title rope: the optic nerve from behind the eye, nearly straight up out of frame */
function titleRope(ex, ey, r, t, jerk, jerkAng) {
  for (let k = 0; k <= ROPE_N; k++) {
    const f = k / ROPE_N, sag = f * (1 - f) * 4; // pinned at the ball and the far end, so a jerk reads as a whip
    ROPE_X[k] = ex + r * .4 + f * 10 + Math.sin(t * .02 + f * 4) * 3 * f + Math.cos(jerkAng) * jerk * 7 * sag;
    ROPE_Y[k] = ey - r * .27 - f * (ey + 40) + Math.cos(t * .017 + f * 3) * 1.5 + Math.sin(jerkAng) * jerk * 2 * sag;
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let b = 0; b < ROPE_W.length; b++) {
    const w = ROPE_W[b], top = w === 4 ? -4 : 0;
    ctx.strokeStyle = ROPE_C[b];
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(ROPE_X[0], ROPE_Y[0] + top);
    for (let k = 1; k <= ROPE_N; k++) ctx.lineTo(ROPE_X[k], ROPE_Y[k] + top);
    ctx.stroke();
  }
  ctx.strokeStyle = '#2a120c';
  ctx.lineWidth = 1;
  for (let v = 0; v < 3; v++) {
    ctx.beginPath();
    for (let k = 0; k <= ROPE_N; k++) { const o = Math.sin(k * 1.7 + v * 2) * 5; k ? ctx.lineTo(ROPE_X[k] + o, ROPE_Y[k]) : ctx.moveTo(ROPE_X[k] + o, ROPE_Y[k]); }
    ctx.stroke();
  }
}
/** title hero: the ROT eye hung on its optic nerve, cropped by the right frame. Holds still, then hitches (titlegaze.ts) */
function drawTitleEye() {
  const t = $.T, ex = 396, ey = PH * .46, r = 88;
  titleGaze(t, TGZ);
  titleGaze(t - 8, TGZ_LATE); // the rope hears about a hitch 8 frames after the eye does
  titleRope(ex, ey, r, t, TGZ_LATE.jig, TGZ_LATE.ang);
  if (srnd() < .06) drops.push({ x: ex + srr(-r * .4, r * .6), y: ey + srr(r * .3, r * .8), px: 0, py: 0, vx: 0, vy: srr(.3, 1), s: 1, c: srnd() < .6 ? 0 : 1, l: 300 });
  light(ex - r * .2, ey - r * .2, 120, .35);
  eye(ctx, ex, ey, r, { hero: 1, jig: TGZ.jig, ang: TGZ.ang, m: TGZ.m, blink: TGZ.bl, al: 1 });
}
