// @ts-nocheck
import { $ } from '../state';
import { drawBiomeFX } from '../biomes';
import { pk, xpNeed, perkName, perkDesc, perkReq, perkCost, perkMax, perkFX, perkFlavor } from '../perks';
import { stageInfo, stageLabel } from '../stages';
import { sfx } from '../audio';
import { WARD_MAX } from '../player';
import { BOSS_AT, C, FONT_D, FONT_H, H, PH, R, TAU, W, clamp, ctx, lerp, rr } from '../core';
import { AMT, LIGHTS, arcs, caps, enemies, eshots, flashes, orbs, shots, sparks, texts } from '../world';
import { POD, mult } from '../enemies/update';
import { GM, ROM, gmL, graftSwap } from '../mutations';
import { SLOTS, needOf, optPos, slotLocked, slotMaxed } from '../player';
import { pad } from '../menus';
import { glow, light, poly, txt } from '../render/util';
import { eye, flushLo } from '../render/eyes';
import { drawBolt, drawShip, drawWraith } from '../render/ship';
import { drawContraptionFX } from '../contraptions';
import { drawEnemy } from '../render/enemies';
import { drawBoss } from '../render/boss';
import { drawDecals, drawDrops, drawGibs, drawMists } from '../render/gore';
import { drawBG, drawDecor, drawLighting, drawTerrain } from '../render/terrain';
import { drawBabe, drawHype } from '../render/hype';

// --- HUD ---
export function drawHUD() {
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, PH, W, H - PH);
  ctx.fillStyle = '#262e37';
  ctx.fillRect(0, PH, W, 1);
  for (let i = 0; i < 7; i++) {
    const x = 4 + i * 46,
      y = PH + 3,
      w = 44,
      h = 11,
      f = $.G.slotF && $.G.slotF[i] > 0 ? $.G.slotF[i]-- : 0;
    const lvN = $.P ? [$.P.speed, $.P.missile, $.P.double, $.P.laser, $.P.pyre, $.P.options, $.P.wardLv || 0][i] : 0,
      mxN = [5, 2, 1, 1, 2, 3, 3][i];
    if (f) {
      ctx.fillStyle = `rgba(${POD[i].c},${f / 60})`;
      ctx.fillRect(x, y, w, h);
    }
    if ($.P && !slotMaxed(i)) {
      const fr = $.P.frag && $.P.frag[i] || 0,
        nd = needOf(i);
      if (fr) {
        ctx.fillStyle = `rgba(${POD[i].c},.35)`;
        ctx.fillRect(x + 1, y + 1, (w - 2) * fr / nd, h - 2);
      }
    }
    if ($.P && slotLocked(i)) {
      ctx.fillStyle = '#8a2a2a';
      ctx.fillRect(x + w - 7, y + 3, 5, 4);
      ctx.strokeStyle = '#8a2a2a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + w - 4.5, y + 3, 1.6, Math.PI, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = lvN ? POD[i].h : '#2a323b';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    txt(SLOTS[i], x + w / 2, y + 1, f ? '#fff' : lvN ? POD[i].h : '#4b5663', 'center', 7);
    for (let k = 0; k < mxN; k++) {
      ctx.fillStyle = k < lvN ? POD[i].h : '#1c232a';
      ctx.fillRect(x + w / 2 - mxN * 2.5 + k * 5 + 1, y + h - 2.5, 3, 1.5);
    }
  }
  drawShip(ctx, 341, PH + 8, 0, .45, 0);
  txt('x' + $.G.lives, 350, PH + 4, '#cfd9e3');
  ctx.fillStyle = C.bloodL;
  ctx.beginPath();
  ctx.arc(375, PH + 9, 2.4, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(372.8, PH + 8);
  ctx.lineTo(375, PH + 4);
  ctx.lineTo(377.2, PH + 8);
  ctx.fill();
  txt(String(Math.floor($.meta.bio)), 381, PH + 4, '#e8a0a0');
  txt('x' + mult().toFixed(1), W - 4, PH + 4, $.G.combo >= 10 ? '#ff6a6a' : '#5b6573', 'right');
  $.G.dScore = ($.G.dScore || 0) + ($.G.score - ($.G.dScore || 0)) * .2;
  if (Math.abs($.G.score - $.G.dScore) < 1) $.G.dScore = $.G.score;
  txt('SCORE ' + pad($.G.dScore, 8), 6, 4, '#cfd9e3');
  txt('HI ' + pad(Math.max($.hi, $.G.score), 8), W - 6, 4, '#6d7a88', 'right');
  txt('STAGE ' + stageLabel() + ' ' + stageInfo().name + '   SEALS ' + ['', 'I', 'II', 'III'][$.G.seal || 0] + '·'.repeat(3 - ($.G.seal || 0)), 6, 13, '#5b6573');
  if (!$.G.boss || $.G.boss.dying) {
    const bw = 110,
      bx = W / 2 - bw / 2,
      pr = clamp($.G.scroll / BOSS_AT, 0, 1);
    ctx.fillStyle = '#14191f';
    ctx.fillRect(bx, 8, bw, 2);
    for (const m of [2400, 5200]) ctx.fillStyle = '#36414c', ctx.fillRect(bx + bw * m / BOSS_AT, 6, 1, 6);
    ctx.fillStyle = C.bloodL;
    ctx.fillRect(bx, 8, bw * pr, 2);
    ctx.fillRect(bx + bw * pr - 1, 6, 2, 6);
    txt('DEPTH', W / 2, 12, '#4b5663', 'center');
  }
  if ($.G.combo >= 3) {
    const s = $.G.combo >= 20 ? 10 : 8;
    {
      const cw = 60 * $.G.comboT / 120;
      ctx.fillStyle = $.G.comboT < 40 ? '#ff3030' : '#7a2a2a';
      ctx.fillRect(W / 2 - cw / 2, 38, cw, 1);
    }
    txt($.G.combo + ' KILLS', W / 2, 28, `rgba(255,${120 - Math.min(100, $.G.combo * 2)},${110 - Math.min(100, $.G.combo * 2)},${.5 + .5 * $.G.comboT / 120})`, 'center', s);
  }
  if ($.G.carn) {
    const a = Math.min(1, $.G.carn.t / 30),
      sz = 22 + (90 - $.G.carn.t < 8 ? (8 - (90 - $.G.carn.t)) * 2 : 0);
    ctx.globalAlpha = a;
    txt($.G.carn.w, W / 2 + 1, 40, '#2a0003', 'center', sz, FONT_D);
    txt($.G.carn.w, W / 2, 39, '#e0242c', 'center', sz, FONT_D);
    ctx.globalAlpha = 1;
  }
  for (const w of $.G.warn) {
    if (($.T >> 3) % 2) continue;
    const a = Math.min(1, w.t / 20);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ff2a2a';
    for (let k = 0; k < 2; k++) {
      const x = 6 + k * 7;
      poly(ctx, [[x, w.y - 6], [x + 6, w.y], [x, w.y + 6], [x + 2.5, w.y]]);
    }
    txt('BEHIND', 24, w.y - 4, '#ff6a6a', 'left', 8);
    ctx.globalAlpha = 1;
  }
  {
    let x = 6,
      y = 22;
    for (const m of GM) {
      const l = gmL(m.id);
      if (!l) continue;
      if (x > 150) {
        x = 6;
        y += 8;
      }
      txt(m.c + l, x, y, m.sh ? '#7fb0e0' : '#c08060', 'left', 7);
      x += 24;
    }
  }
  if ($.G.mini && !$.G.mini.dead && $.G.mini.t > 30) {
    const m = $.G.mini,
      nm = m.title || {
        maw: 'THE MAW',
        crux: 'THE CRUCIFER',
        butcher: 'THE BUTCHER'
      }[m.k] || '',
      bw = 180,
      bx = W / 2 - bw / 2,
      y = PH - 56,
      k = Math.max(0, m.hp / m.max);
    txt(nm, W / 2, y - 10, '#e0242c', 'center', 8);
    ctx.fillStyle = '#14080a';
    ctx.fillRect(bx - 1, y - 1, bw + 2, 5);
    ctx.fillStyle = m.shielded ? '#5d6b7a' : C.bloodL;
    ctx.fillRect(bx, y, bw * k, 3);
    if (m.bars) {
      const n = m.bars.filter(b => !b.dead).length;
      if (n) txt(n + ' NAIL BARRIERS', W / 2, y + 5, '#8fa3b8', 'center', 7);
    }
  }
  if ($.G.tally && $.state !== 'pause') drawTally();
  drawXP();
  if ($.G.pick) drawPick();
  if ($.G.feed && $.state !== 'pause' && !$.G.pick) {
    const f = $.G.feed,
      a = Math.min(1, f.t / 25, (f.ml - f.t) / 10);
    ctx.globalAlpha = a;
    ctx.font = `7px ${FONT_H}`;
    const fw = Math.max(ctx.measureText(f.s).width, ctx.measureText(f.d.toUpperCase()).width) + 8;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(W - 4 - fw, 14, fw, 19);
    txt(f.s, W - 8, 16, '#ffb070', 'right', 7);
    txt(f.d.toUpperCase(), W - 8, 25, '#9fb0c0', 'right', 7);
    ctx.globalAlpha = 1;
  }
  if ($.state !== 'pause') {
    drawHype();
    drawBabe();
  }
  if ($.G.banner) {
    const b = $.G.banner,
      a = Math.min(1, b.t / 30, (b.ml - b.t) / 12),
      fl = R() < .06 ? .4 : 1;
    ctx.globalAlpha = a * fl;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0, PH * .36, W, b.sub ? 48 : 36);
    txt(b.text, W / 2 + 1, PH * .36 + 5, '#000', 'center', 28, FONT_D);
    txt(b.text, W / 2, PH * .36 + 4, b.col, 'center', 28, FONT_D);
    if (b.sub) txt(b.sub, W / 2, PH * .36 + 36, '#cfd9e3', 'center');
    ctx.globalAlpha = 1;
  }
  if ($.G.log) {
    const s = $.G.log.s.slice(0, Math.floor($.G.log.t / 2)),
      a = Math.min(1, ($.G.log.s.length * 2 + 170 - $.G.log.t) / 30);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(4, PH - 16, ctx.measureText ? Math.min(W - 8, s.length * 6.4 + 18) : 300, 12);
    txt('> ' + s + (($.T >> 4) % 2 ? '_' : ''), 8, PH - 14, '#bfd6ee');
    ctx.globalAlpha = 1;
  }
  if ($.P && $.P.alive && $.P.shield > 0) {
    ctx.fillStyle = '#14191f';
    ctx.fillRect($.P.x - 8, $.P.y + 11, 16, 1);
    ctx.fillStyle = '#9fd2ff';
    ctx.fillRect($.P.x - 8, $.P.y + 11, 16 * $.P.shield / WARD_MAX, 1);
  }
}
export function drawEShots() {
  // enemy fire: its own colour family (toxic green), outlined, drawn above gore, darkness and lens splats
  drawPerkFX();
  const pul = .75 + .25 * Math.sin($.T * .5);
  ctx.lineCap = 'round';
  for (const s of eshots) {
    const sp = Math.hypot(s.vx, s.vy) || 1,
      tl = s.k === 'spike' ? 9 : 6;
    ctx.strokeStyle = 'rgba(120,220,40,.45)';
    ctx.lineWidth = s.k === 'glob' ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(s.x - s.vx / sp * tl, s.y - s.vy / sp * tl);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.globalCompositeOperation = 'lighter';
  for (const s of eshots) glow(s.x, s.y, s.k === 'spike' ? 14 : s.k === 'glob' ? 11 : 9, '150,255,40', .55 * pul);
  ctx.globalCompositeOperation = 'source-over';
  for (const s of eshots) {
    if (s.k === 'glob') {
      const a = Math.atan2(s.vy, s.vx);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(a);
      ctx.fillStyle = '#050800';
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.2, 3.8, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#8fe01e';
      ctx.beginPath();
      ctx.ellipse(.3, 0, 4, 2.7, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e8ffb0';
      ctx.beginPath();
      ctx.ellipse(1, -.5, 2, 1.2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (s.k === 'spike') {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate($.T * .25);
      ctx.fillStyle = '#050800';
      poly(ctx, [[0, -6.5], [2, 0], [0, 6.5], [-2, 0]]);
      poly(ctx, [[-6.5, 0], [0, 2], [6.5, 0], [0, -2]]);
      ctx.fillStyle = '#b6ff3a';
      poly(ctx, [[0, -5], [1.2, 0], [0, 5], [-1.2, 0]]);
      poly(ctx, [[-5, 0], [0, 1.2], [5, 0], [0, -1.2]]);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 1.6, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = '#050800';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#b6ff3a';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x - .3, s.y - .3, 1.2, 0, TAU);
      ctx.fill();
    }
  }
}
export function drawWorld() {
  drawBG();
  if ($.P && $.P.alive) {
    light($.P.x + 20, $.P.y, 95, 1);
    light($.P.x, $.P.y, 40, 1);
  }
  drawMists();
  for (const e of enemies) if (e.k !== 'eye') drawEnemy(e);
  if ($.G.boss) drawBoss($.G.boss);
  drawTerrain();
  drawDecor();
  drawDecals();
  for (const e of enemies) if (e.k === 'eye') drawEnemy(e);
  drawGibs();
  drawDrops();
  drawBiomeFX();
  for (const o of orbs) {
    const p = .6 + .4 * Math.sin($.T * .3 + o.x);
    ctx.globalCompositeOperation = 'lighter';
    glow(o.x, o.y, 5, '255,80,110', .5 * p);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffb0c0';
    ctx.fillRect(o.x - .5, o.y - .5, 1.5, 1.5);
  }
  for (const c of caps) if (c.graft) {
    const m = GM.find(q => q.id === c.graft),
      x = c.x,
      y = c.y,
      pul = .5 + .5 * Math.sin(c.t * .18),
      col = m.sh ? '120,180,255' : '255,140,60';
    ctx.globalCompositeOperation = 'lighter';
    glow(x, y, 18, col, .35 + .25 * pul);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#4a1214';
    ctx.beginPath();
    ctx.ellipse(x, y, 7.5 + pul, 6.5 + pul * .6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#9a3a34';
    ctx.beginPath();
    ctx.ellipse(x - .5, y - .5, 6.4 + pul, 5.4 + pul * .5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#5a0a10';
    ctx.lineWidth = .6;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = k * 1.3 + c.t * .01;
      ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 5);
      ctx.lineTo(x + Math.cos(a + .4) * 3, y + Math.sin(a + .4) * 2.5);
    }
    ctx.stroke();
    eye(ctx, x, y, 3.2, {
      ang: Math.atan2($.P.y - y, $.P.x - x),
      iris: m.sh ? '#3b6fd0' : '#e05a10',
      bs: 1.6
    });
    const sw = graftSwap(m.id);
    txt(m.name + ' ' + ROM[c.glv], x, y - 19, m.sh ? '#9fd2ff' : '#ffb070', 'center', 7);
    if (sw) txt('SHEDS ' + sw.name, x, y + 10, '#8a5a5a', 'center', 7);
    light(x, y, 30, .9);
  }
  for (const c of caps) {
    if (c.graft) continue;
    const bl = c.blue,
      x = c.x,
      y = c.y,
      pd = bl ? null : POD[c.ty] || POD[0],
      col = bl ? '60,140,255' : pd.c,
      hx = bl ? '#2a6cff' : pd.h,
      pul = .5 + .5 * Math.sin(c.t * .2);
    ctx.globalCompositeOperation = 'lighter';
    glow(x, y, 15, col, .35 + .25 * pul);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = c.choice ? `rgba(255,210,58,${.6 + .4 * pul})` : `rgba(${col},${.5 + .4 * pul})`;
    ctx.lineWidth = c.choice ? 1.6 : 1;
    ctx.beginPath();
    ctx.arc(x, y, (c.choice ? 10 : 8) + pul * 1.5, 0, TAU);
    ctx.stroke();
    if (c.choice) txt('FULL LEVEL', x, y + 11, '#ffd23a', 'center', 7);
    ctx.fillStyle = '#7f909f';
    ctx.fillRect(x - 6, y - 2.5, 2, 5);
    ctx.fillRect(x + 4, y - 2.5, 2, 5);
    ctx.fillStyle = 'rgba(220,235,255,.35)';
    ctx.fillRect(x - 4, y - 2.5, 8, 5);
    const lvq = Math.sin(c.t * .15) * .6;
    ctx.fillStyle = hx;
    ctx.fillRect(x - 4, y - .5 + lvq, 8, 3 - lvq);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 3, y - 2, 2, 1);
    {
      let lb = bl ? 'PURGE' : SLOTS[c.ty] || '?';
      if (!bl && !c.choice && $.P && c.ty >= 0 && !slotMaxed(c.ty)) {
        const nd = needOf(c.ty);
        if (nd > 1) lb += ' ' + ($.P.frag && $.P.frag[c.ty] || 0) + '/' + nd;
      }
      txt(lb, x, y - 15, hx, 'center', 7);
    }
    light(x, y, 26, .8);
  }
  for (const s of eshots) {
    if (LIGHTS.length >= 50) break;
    light(s.x, s.y, 16, .6);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const s of shots) {
    if (s.k === 'laser') {
      ctx.fillStyle = 'rgba(80,170,255,.45)';
      ctx.fillRect(s.x, s.y - 2, s.len, 4);
      ctx.fillStyle = '#e6f6ff';
      ctx.fillRect(s.x, s.y - .5, s.len, 1.2);
      if (LIGHTS.length < 50) light(s.x + s.len / 2, s.y, 26, .5);
    } else if (s.k === 'missile') {
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(s.x - 5, s.y - .5, 2, 1);
    } else if (s.k === 'pyre') {
      glow(s.x - 3, s.y, 15, '255,90,20', .55);
      glow(s.x, s.y, 9, '255,200,120', .7);
      light(s.x, s.y, 34, .9);
    } else drawBolt(s);
  }
  for (const a of arcs) {
    const k = a.l / 9;
    ctx.strokeStyle = `rgba(255,90,70,${k})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(a.x1, a.y1);
    for (let j = 1; j < 6; j++) {
      const f = j / 6;
      ctx.lineTo(lerp(a.x1, a.x2, f) + rr(-3, 3), lerp(a.y1, a.y2, f) + rr(-3, 3));
    }
    ctx.lineTo(a.x2, a.y2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,230,220,${k})`;
    ctx.lineWidth = .5;
    ctx.stroke();
    light(a.x2, a.y2, 20, .6 * k);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const s of shots) if (s.k === 'pyre') {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = 'rgba(255,120,30,.85)';
    for (let k = 0; k < 3; k++) {
      const fy = rr(-2.5, 2.5);
      poly(ctx, [[-2, fy - 1.6], [-9 - rr(0, 5), fy], [-2, fy + 1.6]]);
    }
    eye(ctx, 0, 0, 3.6, {
      ang: s.rot,
      m: .9,
      iris: '#ff3a10',
      fire: 1,
      bs: 2.4,
      dil: .7
    });
    ctx.restore();
  }
  drawContraptionFX();
  for (const s of shots) if (s.k === 'missile') {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.g ? 0 : Math.atan2(s.vy, s.vx));
    ctx.fillStyle = '#8a96a3';
    ctx.fillRect(-3, -1, 6, 2);
    ctx.fillStyle = '#c0121b';
    ctx.fillRect(2, -1, 1, 2);
    ctx.restore();
  }
  if ($.P && $.P.alive) {
    for (let i = 0; i < $.P.options; i++) {
      const o = optPos(i);
      drawWraith(o.x, o.y, i);
    }
    if (!($.P.inv > 0 && ($.T >> 2) % 2)) drawShip(ctx, $.P.x, $.P.y, $.P.bank, 1, 1);
    if ($.P.aegis > 0) {
      const k = $.P.aegis / 12;
      ctx.lineCap = 'round';
      for (let j = 0; j < 5; j++) {
        const an = -.7 + j * .35;
        if (j / 5 >= k + .01) continue;
        ctx.strokeStyle = '#5e5040';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc($.P.x, $.P.y, 19, an - .15, an + .15);
        ctx.stroke();
        ctx.strokeStyle = '#e8d8b4';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    if ($.P.shield > 0) {
      const k = Math.min(1, $.P.shield / WARD_MAX);
      if ($.P.wardLv >= 2) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(220,230,255,${.25 + .15 * Math.sin($.T * .3)})`;
        ctx.lineWidth = .6;
        ctx.beginPath();
        ctx.arc($.P.x + 1, $.P.y, 17, 0, TAU);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${Math.round(255 * (1 - k)) + 60},${Math.round(200 * k)},${Math.round(255 * k)},${.5 + .3 * Math.sin($.T * .4)})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.lineDashOffset = -$.T * .5;
      ctx.beginPath();
      ctx.arc($.P.x + 1, $.P.y, 15, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const s of sparks) {
    ctx.globalAlpha = s.l / s.ml;
    ctx.fillStyle = s.c;
    ctx.fillRect(s.x, s.y, 1, 1);
  }
  ctx.globalAlpha = 1;
  for (const f of flashes) {
    glow(f.x, f.y, f.r * (1 + (1 - f.l / f.ml) * .4), f.c, .8 * f.l / f.ml);
    light(f.x, f.y, f.r * 2.2, f.l / f.ml);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const t of texts) {
    ctx.globalAlpha = Math.min(1, t.l / 20);
    txt(t.s, t.x, t.y, t.col, 'center', t.size);
  }
  ctx.globalAlpha = 1;
  const sc = $.G.scroll;
  let dk = AMT.corr(sc) * .62 + AMT.core(sc) * .3;
  if ($.G.flick > 0) dk = Math.min(.9, dk + .3);
  flushLo();
  drawLighting(dk);
}

// --- screens ---

/** stage clear card: slides in, counts up, stamps the grade */
function drawTally() {
  const t = $.G.tally, age = t.ml - t.t;
  if (t.t <= 0) return;
  const a = Math.min(1, age / 15, t.t / 30), x0 = W / 2 - 110, y0 = 52, w = 220, h = 116;
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(4,5,7,.82)';
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = t.col;
  ctx.fillRect(x0, y0, w, 1);
  ctx.fillRect(x0, y0 + h - 1, w, 1);
  txt(t.escaped ? 'STAGE ' + t.id + ' ENDED' : 'STAGE ' + t.id + ' CLEAR', x0 + 8, y0 + 6, '#e8f1ff', 'left', 8);
  txt(t.name, x0 + 8, y0 + 16, '#6d7a88', 'left', 7);
  const rows = [['KILLS', t.kills + '  (' + t.pct + '%)'], ['HITS TAKEN', t.hits + (t.deaths ? '  +' + t.deaths + ' DEATH' + (t.deaths > 1 ? 'S' : '') : '')], ['BEST CHAIN', t.chain], ['TIME', Math.floor(t.secs / 60) + ':' + String(t.secs % 60).padStart(2, '0')]];
  rows.forEach(([k, v], i) => {
    if (age < 20 + i * 12) return;
    txt(k, x0 + 8, y0 + 32 + i * 11, '#8fa3b8', 'left', 7);
    txt(String(v), x0 + 128, y0 + 32 + i * 11, '#cfd9e3', 'right', 7);
  });
  if (age > 80) {
    const k = Math.max(0, 1 - (age - 80) / 10), sz = 44 + k * 40;
    ctx.globalAlpha = a * (1 - k * .6);
    txt(t.g, x0 + 178 + 1, y0 + 30 - k * 20 + 1, '#000', 'center', sz, FONT_D);
    txt(t.g, x0 + 178, y0 + 30 - k * 20, t.col, 'center', sz, FONT_D);
    ctx.globalAlpha = a;
    if (age === 81) { sfx.bomb(); $.G.shake = Math.max($.G.shake, 6); }
  }
  if (age > 100) {
    txt('+' + t.bonus.toLocaleString('en-US') + (t.perfect ? '  PERFECT' : ''), x0 + 8, y0 + 82, t.perfect ? '#ffd23a' : '#ffb070', 'left', 8);
    txt('+' + t.bio + ' BIO', x0 + 8, y0 + 94, '#ff8aa0', 'left', 7);
    txt(t.best, x0 + w - 8, y0 + 94, t.best.startsWith('NEW') || t.best.startsWith('FIRST') ? '#ffd23a' : '#6d7a88', 'right', 7);
  }
  ctx.globalAlpha = 1;
}

/** ship level + XP bar, under the depth gauge */
function drawXP() {
  const G = $.G;
  if (G.lvl == null) return;
  const w = 84, x = W / 2 - w / 2 + 8, y = 22, f = Math.min(1, G.xp / xpNeed(G.lvl)), q = G.pickQ > 0 || !!G.pick, fl = (G.lvT || 0) / 40;
  // level badge
  ctx.fillStyle = q ? '#3a2a06' : '#0c1620';
  ctx.fillRect(x - 25, y - 2, 21, 9);
  ctx.fillStyle = q ? '#ffd23a' : '#2c4c6c';
  ctx.fillRect(x - 25, y - 2, 21, 1);
  txt('LV' + G.lvl, x - 14.5, y - 1, q ? '#ffd23a' : '#9fd2ff', 'center', 7);
  // segmented bar: 10 cells
  ctx.fillStyle = '#05080c';
  ctx.fillRect(x - 1, y, w + 2, 6);
  const n = 10, cw = w / n;
  for (let k = 0; k < n; k++) {
    const c0 = k / n, fill = clamp((f - c0) * n, 0, 1);
    ctx.fillStyle = '#101a24';
    ctx.fillRect(x + k * cw + .5, y + 1, cw - 1, 4);
    if (fill > 0) {
      ctx.fillStyle = q ? `rgba(255,${190 + 40 * Math.sin($.T * .3)},60,1)` : '#3f7fe8';
      ctx.fillRect(x + k * cw + .5, y + 1, (cw - 1) * fill, 4);
      ctx.fillStyle = q ? '#fff2b0' : '#9fd2ff';
      ctx.fillRect(x + k * cw + .5, y + 1, (cw - 1) * fill, 1);
    }
  }
  if (fl > 0) {
    ctx.globalAlpha = fl;
    ctx.fillStyle = '#fff6c8';
    ctx.fillRect(x - 1, y, w + 2, 6);
    ctx.globalAlpha = 1;
  }
  if (G.xpPop && !G.pick) {
    ctx.globalAlpha = Math.min(1, G.xpPop.t / 30);
    txt('+' + G.xpPop.n + ' XP', x - 29, y - 1, '#ffd23a', 'right', 7);
    ctx.globalAlpha = 1;
  }
  if (q && !G.pick) txt(G.pickQ > 1 ? 'MUTATION x' + G.pickQ : 'MUTATION READY', x + w + 4, y - 1, $.T % 30 < 20 ? '#ffd23a' : '#9a7a20', 'left', 7);
}
const BIOME_COL = { ice: ['#9fe0ff', '10,40,64', '120,210,255'], acid: ['#a6ff2a', '20,46,6', '166,255,42'], fire: ['#ff8a3a', '60,18,4', '255,120,40'], snot: ['#d8e86a', '40,44,8', '210,230,90'] };
/** wrap s into lines no wider than w at 7px */
function wrap(s, w) {
  ctx.font = `7px ${FONT_H}`;
  const out = [];
  let line = '';
  for (const wd of s.split(' ')) {
    const t = line ? line + ' ' + wd : wd;
    if (line && ctx.measureText(t).width > w) { out.push(line); line = wd; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
/** level-up: three mutation cards. Left/right (or up/down) + HOLD fire / Enter, or click/tap a card */
function drawPick() {
  const G = $.G, p = G.pick, n = p.opts.length, cw = 142, gap = 9, ch = 112, x0 = Math.round(W / 2 - (n * cw + (n - 1) * gap) / 2), y0 = 66,
    a = Math.min(1, p.t / 10), live = p.t > 30;
  // the world behind goes dark and red
  ctx.globalAlpha = a * .78;
  ctx.fillStyle = '#030204';
  ctx.fillRect(0, 0, W, PH);
  ctx.globalAlpha = a * .25;
  const vg = ctx.createRadialGradient(W / 2, PH / 2, 40, W / 2, PH / 2, 280);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(120,0,8,1)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, PH);
  ctx.globalAlpha = a;
  // title
  const ty = 22 + (1 - a) * -8;
  txt('SHIP LEVEL ' + G.lvl, W / 2 + 1, ty + 1, '#2a0003', 'center', 22, FONT_D);
  txt('SHIP LEVEL ' + G.lvl, W / 2, ty, '#e0242c', 'center', 22, FONT_D);
  txt('THE SHIP MUTATES  //  GRAFT ONE', W / 2, ty + 25, '#8a7a5a', 'center', 7);
  $.pickBoxes = [];
  p.opts.forEach((id, i) => {
    const sel = i === p.sel, l = pk(id) + 1, mx = perkMax(id), req = perkReq(id), cost = perkCost(id), bc = req && BIOME_COL[req],
      lift = sel ? 3 : 0, x = x0 + i * (cw + gap), y = y0 - lift + (1 - a) * 14 * (i + 1);
    // card body
    const gr = ctx.createLinearGradient(0, y, 0, y + ch);
    gr.addColorStop(0, bc ? `rgba(${bc[1]},.97)` : sel ? 'rgba(52,6,10,.97)' : 'rgba(16,14,18,.95)');
    gr.addColorStop(1, sel ? 'rgba(14,2,4,.97)' : 'rgba(6,6,8,.95)');
    ctx.fillStyle = gr;
    ctx.fillRect(x, y, cw, ch);
    // border: selected pulses blood red (biome cards in their colour)
    const pul = .6 + .4 * Math.sin($.T * .18);
    ctx.fillStyle = sel ? (bc ? bc[0] : `rgba(255,${40 + 30 * pul},50,1)`) : bc ? `rgba(${bc[2]},.45)` : '#2a2f36';
    const bw = sel ? 2 : 1;
    ctx.fillRect(x, y, cw, bw); ctx.fillRect(x, y + ch - bw, cw, bw); ctx.fillRect(x, y, bw, ch); ctx.fillRect(x + cw - bw, y, bw, ch);
    if (sel) {
      ctx.globalAlpha = a * .25 * pul;
      ctx.fillStyle = bc ? bc[0] : '#ff2030';
      ctx.fillRect(x - 3, y - 3, cw + 6, 2); ctx.fillRect(x - 3, y + ch + 1, cw + 6, 2); ctx.fillRect(x - 3, y - 3, 2, ch + 6); ctx.fillRect(x + cw + 1, y - 3, 2, ch + 6);
      ctx.globalAlpha = a;
    }
    // header tag
    const tag = req ? req.toUpperCase() + ' MUTATION' : cost ? 'BLOOD PACT' : l > 1 ? 'DEEPER' : 'MUTATION';
    const tagc = req ? bc[0] : cost ? '#ff5050' : l > 1 ? '#ffb070' : '#6d7a88';
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(x + bw, y + bw, cw - 2 * bw, 11);
    txt(tag, x + 7, y + 3, tagc, 'left', 7);
    // level pips (right of the tag): owned = dim gold, the one you'd take = bright & blinking
    for (let k = 0; k < mx; k++) {
      const px = x + cw - 8 - (mx - k) * 8;
      ctx.fillStyle = k < l - 1 ? '#9a7a20' : k === l - 1 ? ($.T % 24 < 16 || !sel ? '#ffd23a' : '#fff6c8') : '#262c33';
      ctx.fillRect(px, y + 4, 6, 4);
    }
    // name (shrinks if it doesn't fit)
    const nm = perkName(id);
    ctx.font = `8px ${FONT_H}`;
    const ns = ctx.measureText(nm).width > cw - 14 ? 7 : 8;
    txt(nm, x + 7, y + 17, sel ? '#ffffff' : '#d8dee6', 'left', ns);
    txt(l > 1 ? 'RANK ' + ['', 'I', 'II', 'III'][l] + ' OF ' + ['', 'I', 'II', 'III'][mx] : mx > 1 ? 'NEW  //  ' + mx + ' RANKS' : 'NEW  //  ONE TIME', x + 7, y + 28, sel ? '#c0a060' : '#6a6050', 'left', 7);
    ctx.fillStyle = sel ? 'rgba(224,36,44,.5)' : '#22262c';
    ctx.fillRect(x + 7, y + 38, cw - 14, 1);
    // description, wrapped
    let ly = y + 43;
    for (const ln of wrap(perkDesc(id, l).toUpperCase(), cw - 14)) { txt(ln, x + 7, ly, sel ? '#cfd9e3' : '#8fa0b2', 'left', 7); ly += 9; }
    if (cost) {
      ly += 3;
      for (const ln of wrap('COST: ' + cost.toUpperCase(), cw - 14)) { txt(ln, x + 7, ly, '#ff4a4a', 'left', 7); ly += 9; }
    }
    // flavour, in the gothic hand
    const fv = perkFlavor(id);
    if (fv) txt(fv, x + cw / 2, y + ch - 27, sel ? '#b0485a' : '#5a3a42', 'center', 10, FONT_D);
    // hold-to-graft meter on the selected card
    if (sel && live) {
      const hf = Math.min(1, p.hold / 26);
      ctx.fillStyle = '#14080a';
      ctx.fillRect(x + 7, y + ch - 8, cw - 14, 3);
      ctx.fillStyle = bc ? bc[0] : '#ff3040';
      ctx.fillRect(x + 7, y + ch - 8, (cw - 14) * hf, 3);
      if (hf > 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 7 + (cw - 14) * hf - 1, y + ch - 9, 2, 5); }
    }
    $.pickBoxes.push({ x, y, w: cw, h: ch, i });
  });
  // what you already carry
  const own = Object.entries(G.pk || {}).filter(([, v]) => v > 0).map(([k, v]) => perkName(k).split(' ').pop() + (v > 1 ? ' ' + ['', 'I', 'II', 'III'][v] : ''));
  txt(live ? '< >  CHOOSE     HOLD FIRE  /  ENTER  /  CLICK   TO GRAFT' : '. . .', W / 2, y0 + ch + 7, live ? ($.T % 40 < 30 ? '#c8b080' : '#8a7a5a') : '#3a3a3a', 'center', 7);
  if (own.length) {
    const ln = wrap('GRAFTED: ' + own.join(' · '), W - 40);
    ln.slice(0, 2).forEach((s, k) => txt(s, W / 2, y0 + ch + 19 + k * 9, '#5b6573', 'center', 7));
  }
  ctx.globalAlpha = 1;
}
/** perk effects in world space (drawn with the enemy-shot layer): BLOOD TRAIL slicks, ORBITING TEETH */
export function drawPerkFX() {
  for (const s of perkFX.slicks) {
    const k = Math.min(1, s.t / 30, (s.ml - s.t) / 8 + .2);
    ctx.globalAlpha = .55 * k;
    ctx.fillStyle = '#3a0006';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.r, s.r * .62, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8a0a14';
    ctx.beginPath();
    ctx.ellipse(s.x + Math.sin(s.seed) * 2, s.y - 1, s.r * .6, s.r * .35, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = .5 * k;
    ctx.fillStyle = '#ff5060';
    ctx.fillRect(s.x - s.r * .3 + Math.sin($.T * .1 + s.seed) * 2, s.y - s.r * .3, 2, 1);
  }
  ctx.globalAlpha = 1;
  for (const t of perkFX.teeth) {
    const tr = 5;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.a + Math.PI / 2);
    ctx.fillStyle = 'rgba(80,0,0,.6)';
    ctx.fillRect(-1, 3, 2, 6);
    ctx.fillStyle = '#efe3c2';
    ctx.beginPath();
    ctx.moveTo(-3, -tr);
    ctx.lineTo(3, -tr);
    ctx.lineTo(2.2, 1);
    ctx.lineTo(.6, tr);
    ctx.lineTo(-.6, tr - 2);
    ctx.lineTo(-2.2, 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8a1018';
    ctx.fillRect(-3, -tr, 6, 1.5);
    ctx.restore();
  }
}
