// @ts-nocheck
import { $ } from '../state';
import { C, FONT_D, FONT_H, H, PH, R, TAU, W, ctx, hash, ri, rr, swapRm } from '../core';
import { lv } from '../save';
import { touch } from '../input';
import { drops } from '../world';
import { shopNext } from '../flow';
import { GM, ROM, gmL, gunHeld, gunSlots } from '../mutations';
import { buy, buySocket, fmtBio, overItems, pad, pauseItems, rigAct, rigBolted, rigCost, rigFree, rigOwned, rigUp, rigUpCost, shopAct, shopItems, shopSec, sockCost, titleItems } from '../menus';
import { RIG_LV, SOCKET_COST, SOCKET_MAX, rigFresh, rigInit, rigged, sockets } from '../contraptions';
import { glow, invCross, light, txt } from '../render/util';
import { EYEQ, GLQ, eye, present } from '../render/eyes';
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
  drawTitleEye();
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
  if ($.gate) {
    $.menuBoxes = [];
    if (($.T >> 5) % 2 === 0) txt(touch.used || matchMedia('(pointer: coarse)').matches ? 'TAP TO DESCEND' : 'PRESS ANY KEY', 40, 140, '#e0242c', 'left', 10);
  } else drawMenu(titleItems(), 40, 124, 150);
  txt('ARROWS/WASD MOVE   Z/SPACE FIRE', 28, 196, '#5b6573');
  txt('FLY INTO A POD TO TAKE IT   P PAUSE   M MUTE', 28, 206, '#5b6573');
  txt(touch.used ? 'TOUCH: DRAG TO FLY, AUTO-FIRE' : 'GAMEPAD: A FIRE, START PAUSE', 28, 216, '#3f4955');
  txt('HI ' + pad($.hi, 8), 28, 236, '#8fa3b8');
  txt('EXTREME GORE. FLASHING IMAGES.', W - 8, H - 12, '#5a2a2c', 'right');
  txt('MUSIC: DAVID KBD, KENTEN FINA (CC BY), RUSKERDAX  SFX: KENNEY', W - 8, H - 22, '#3a4048', 'right', 7);
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
  const it = shopItems(), LX = 12, LW = 284, RH = 10;
  $.menuBoxes = [];
  let y = 45, sec = -1;
  const HEAD = ['CONTRAPTIONS  //  ENTER BUY / BOLT   RIGHT UPGRADE', 'SOCKETS', 'GRAFTS', ''];
  it.forEach((x, i) => {
    const sc = shopSec(x.k);
    if (sc !== sec) {
      sec = sc;
      if (HEAD[sc]) {
        y += sc ? 2 : 0;
        txt(HEAD[sc], LX + 2, y, '#8a3a3c', 'left', 7);
        ctx.fillStyle = '#3a0a0e';
        ctx.fillRect(LX, y + 8, LW, 1);
        y += 10;
      } else y += 3;
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
    } else {
      txt(shopNext === 'loop' ? 'CONTINUE THE DESCENT  >' : '< RETURN', LX + 8, y, sel ? '#fff' : '#8fa3b8', 'left', 8);
    }
    $.menuBoxes.push({ x: LX, y: y - 2, w: LW, h: RH, i, a: () => shopAct(it[i]) }); // after the buttons: a button hit wins
    y += RH + 1;
  });
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
  if ($.shopMsg) txt($.shopMsg.s, LX + 2, H - 11, $.shopMsg.col, 'left', 7);
  else txt(touch.used ? 'TAP A BUTTON TO ACT   TAP A ROW TO INSPECT' : 'ARROWS PICK   Z/ENTER ACT   RIGHT UPGRADE   X/ESC LEAVE', LX + 2, H - 11, '#5b6573', 'left', 7);
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

/** title hero: a huge bloodshot eyeball hanging off its optic nerve, gaze wandering, the odd blink */
function drawTitleEye() {
  const t = $.T, ex = W * .73 + Math.sin(t * .007) * 4, ey = PH * .5 + Math.sin(t * .011) * 5, r = 74;
  // optic nerve: fleshy rope from behind the eye up out of frame, swaying
  const pts = [];
  for (let k = 0; k <= 14; k++) {
    const f = k / 14;
    pts.push([ex + 30 + f * 70 + Math.sin(t * .02 + f * 4) * 6 * f, ey - 20 - f * (ey + 40) + Math.cos(t * .017 + f * 3) * 3]);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, col] of [[22, '#2a0508'], [17, '#7a1e2a'], [11, '#b8485a'], [4, '#e08a96']]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) ctx.lineTo(x, y + (w === 4 ? -4 : 0));
    ctx.stroke();
  }
  ctx.strokeStyle = '#5a0a14';
  ctx.lineWidth = 1;
  for (let v = 0; v < 3; v++) {
    ctx.beginPath();
    for (let k = 0; k <= 14; k++) { const [x, y] = pts[k]; const o = Math.sin(k * 1.7 + v * 2) * 5; k ? ctx.lineTo(x + o, y) : ctx.moveTo(x + o, y); }
    ctx.stroke();
  }
  if (R() < .3) drops.push({ x: ex + rr(-20, 50), y: ey + rr(20, 60), px: 0, py: 0, vx: 0, vy: rr(.3, 1), s: 1, c: R() < .6 ? 0 : 1, l: 300 });
  // gaze: slow wander, occasional darting look, blink every few seconds
  const ang = Math.PI + Math.sin(t * .013) * .9 + (Math.sin(t * .0031) > .93 ? Math.sin(t * .2) * .6 : 0);
  const bc = t % 340, blink = bc < 10 ? Math.sin(bc / 10 * Math.PI) : 0;
  light(ex, ey, 140, .9);
  eye(ctx, ex, ey, r, { hero: 1, iris: '#2fd43a', ang, m: .32 + .18 * Math.sin(t * .009), dil: 1.05 + .15 * Math.sin(t * .021), bs: 2, blink, lid: '#8a3a40', al: 1 });
}
