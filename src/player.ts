// @ts-nocheck
import { $ } from './state';
import { pk, perkTick, lastGasp, ribShards } from './perks';
import { PH, R, TAU, W, clamp, lerp, ri, rr } from './core';
import { lv } from './save';
import { sfx } from './audio';
import { buzz } from './platform';
import { I, touch } from './input';
import { ceilAt, floorAt, shots } from './world';
import { flash, pop, spark } from './fx/spawn';
import { killPlayer, respawn } from './flow';
import { POD, hurt } from './enemies/update';
import { gmL, sporeBurst } from './mutations';

// ---------------- player ----------------
export const SLOTS = ['THRUST', 'MISSILE', 'SPLIT', 'ARC', 'PYRE', 'WRAITH', 'WARD'];
// progression: each level costs fragments (pods of that type); seals broken by mini-bosses raise the level ceiling
export const SMAX = [5, 2, 1, 1, 2, 3, 3];
/** WARD membrane soaks this many hits (was 10) */
export const WARD_MAX = 3;
export const NEED = [[1, 1, 2, 2, 3], [1, 2], [1], [2], [2, 3], [2, 3, 4], [1, 2, 3]];
export const SBASE = [[2, 3, 4, 5], [1, 2, 2, 2], [1, 1, 1, 1], [0, 1, 1, 1], [0, 1, 2, 2], [1, 2, 3, 3], [1, 2, 3, 3]];
export const slotLv = i => [$.P.speed, $.P.missile, $.P.double, $.P.laser, $.P.pyre, $.P.options, $.P.wardLv || 0][i];
export const startLv = i => 0; // every life starts naked; power is earned in-run
export function capLv(i) {
  return Math.max(startLv(i), SBASE[i][Math.min(3, $.G && $.G.seal || 0)]);
}
export function needOf(i) {
  return NEED[i][Math.min(NEED[i].length - 1, slotLv(i))];
}
export function slotLocked(i) {
  return slotLv(i) >= capLv(i) && slotLv(i) < SMAX[i];
}
export function slotMaxed(i) {
  const l = slotLv(i);
  if (i === 6) return l >= capLv(6) && $.P.shield >= WARD_MAX;
  return l >= capLv(i);
}
export function applyPower(i, full) {
  if (i == null || i < 0 || !$.P.alive) return;
  if (i === 6 && slotLv(6) >= capLv(6) && $.P.shield < WARD_MAX) {
    $.P.shield = WARD_MAX;
    if ($.P.wardLv >= 3) $.P.aegis = 12;
    sfx.shield();
    buzz('light');
    pop($.P.x, $.P.y - 14, 'WARD RESTORED', POD[6].h, 8, 40);
    return;
  }
  if (slotMaxed(i)) {
    $.G.score += 1500;
    $.G.bio += 5;
    $.meta.bio += 5;
    pop($.P.x, $.P.y - 14, slotLocked(i) ? 'SEALED  +1500' : '+1500 SURPLUS', '#cfd9e3', 8, 40);
    sfx.pick();
    return;
  }
  $.P.frag = $.P.frag || [];
  $.P.frag[i] = ($.P.frag[i] || 0) + 1;
  const nd = needOf(i);
  if (!full && $.P.frag[i] < nd) {
    $.G.slotF = $.G.slotF || [];
    $.G.slotF[i] = 20;
    sfx.pick();
    pop($.P.x, $.P.y - 14, SLOTS[i] + ' ' + $.P.frag[i] + '/' + nd, POD[i].h, 8, 40);
    for (let k = 0; k < 5; k++) spark($.P.x, $.P.y, rr(-2, 2), rr(-2, 2), 10, POD[i].h);
    return;
  }
  $.P.frag[i] = 0;
  if (i === 0) $.P.speed++;else if (i === 1) {
    $.P.missile++;
    $.P.pyre = 0;
  } else if (i === 2) {
    $.P.double = 1;
    $.P.laser = 0;
  } else if (i === 3) {
    $.P.laser = 1;
    $.P.double = 0;
  } else if (i === 4) {
    $.P.pyre++;
    $.P.missile = 0;
  } else if (i === 5) $.P.options++;else {
    $.P.wardLv = Math.min(3, ($.P.wardLv || 0) + 1);
    $.P.shield = WARD_MAX;
    if ($.P.wardLv >= 3) $.P.aegis = 12;
  }
  $.G.slotF = $.G.slotF || [];
  $.G.slotF[i] = 40;
  sfx.power();
  pop($.P.x, $.P.y - 14, i === 6 ? ['', 'MEMBRANE', 'MIRROR', 'BONE AEGIS'][$.P.wardLv] : SLOTS[i] + (i === 4 && $.P.pyre > 1 ? ' II' : ''), POD[i].h, 8, 50);
  flash($.P.x, $.P.y, 40, 10, POD[i].c);
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * TAU;
    spark($.P.x, $.P.y, Math.cos(a) * 2.4, Math.sin(a) * 2.4, 14, POD[i].h);
  }
}
export function optPos(i) {
  const h = $.P.hist,
    k = (i + 1) * 13;
  if (!h.length) return {
    x: $.P.x - 14 * (i + 1),
    y: $.P.y
  };
  return h[Math.min(k, h.length - 1)];
}
export function playerHit() {
  if (!$.P.alive || $.P.inv > 0) return false;
  if ($.G.st) $.G.st.hits++;
  if ($.P.shield > 0) {
    $.P.shield = Math.max(0, $.P.shield - 1);
    $.P.inv = Math.round(18 * (1 + .5 * pk('inv')));
    ribShards(shots, dmMul());
    sfx.shield();
    buzz('light');
    sporeBurst();
    for (let i = 0; i < 10; i++) spark($.P.x, $.P.y, rr(-3, 3), rr(-3, 3), 12, '#9fd2ff');
    return false;
  }
  if (lastGasp()) return false;
  killPlayer();
  return true;
}
/** perk-side damage multiplier (SERRATED MARROW, GLASS JAW) */
export const dmMul = () => (1 + .1 * pk('dmg')) * (pk('glass') ? 1.35 : 1);
export function fire() {
  const cal = gmL('cal'),
    dm = (1 + .15 * gmL('serr')) * (1 + .1 * cal) * dmMul(),
    rem = Math.max(-1, Math.min(0, $.P.cd)),
    rp = gmL('rapid'),
    org = [{
      x: $.P.x,
      y: $.P.y
    }];
  for (let i = 0; i < $.P.options; i++) org.push(optPos(i));
  const B = (x, y, vx, vy, o = {}) => shots.push({
    k: 'bolt',
    x,
    y,
    vx,
    vy,
    dmg: dm,
    r: 2 + cal * .45,
    pierce: gmL('pierce') + pk('pierce'),
    seek: gmL('seek'),
    rip: gmL('ripple'),
    t: 0,
    ...o
  });
  if ($.P.laser) {
    $.P.cd = Math.max(7, 9 - rp);
    for (const o of org) shots.push({
      k: 'laser',
      x: o.x + 8,
      y: o.y,
      vx: 8.5,
      vy: 0,
      len: 4,
      dmg: 1.7 * dm,
      hit: new Set(),
      r: 2
    });
    sfx.laser();
  } else {
    $.P.cd = Math.max(5, 7 - rp);
    for (const o of org) {
      B(o.x + 10, o.y, 7.5, 0);
      if ($.P.double) B(o.x + 6, o.y - 2, 5.3, -5.3, {
        diag: 1
      });
    }
    sfx.shot();
  }
  {
    const tl = gmL('tail');
    if (tl && $.P.cd >= 0) {
      const src = [org[0]];
      for (const o of src) {
        B(o.x - 10, o.y, -6.5, 0, {
          seek: 0
        });
        if (tl >= 2) {
          B(o.x - 8, o.y - 2, -4.6, -4.6, {
            seek: 0
          });
          B(o.x - 8, o.y + 2, -4.6, 4.6, {
            seek: 0
          });
        }
      }
    }
  }
  // TWITCH GLAND: fractional cooldown (the remainder carries) so every level counts; hard floor so it can't hose
  if (pk('rof')) $.P.cd = Math.max($.P.laser ? 6 : 4, $.P.cd / (1 + [0, .08, .15, .21][pk('rof')])) + rem;
  flash($.P.x + 13, $.P.y, 9, 3, '190,225,255');
  if ($.P.missile && $.P.mcd <= 0) {
    $.P.mcd = Math.round(34 * (1 - .2 * pk('reload')));
    for (const o of org) {
      shots.push({
        k: 'missile',
        x: o.x,
        y: o.y + 3,
        vx: 1.5,
        vy: 2.2,
        dmg: 3 * dm,
        r: 3,
        dir: 1,
        g: 0
      });
      if ($.P.missile > 1) shots.push({
        k: 'missile',
        x: o.x,
        y: o.y - 3,
        vx: 1.5,
        vy: -2.2,
        dmg: 3 * dm,
        r: 3,
        dir: -1,
        g: 0
      });
    }
    sfx.missile();
  }
  if ($.P.pyre && $.P.pcd <= 0) {
    $.P.pcd = Math.round(($.P.pyre > 1 ? 20 : 30) * (1 - .2 * pk('reload')));
    const src = $.P.pyre > 1 ? org : [org[0]];
    for (const o of src) shots.push({
      k: 'pyre',
      x: o.x + 8,
      y: o.y,
      vx: 4.4,
      vy: -1.1,
      dmg: 5 * dm,
      r: 4,
      rot: R() * TAU
    });
    sfx.fireball();
  }
}
export function updatePlayer() {
  if (!$.P.alive) {
    $.G.deadT--;
    if ($.G.deadT <= 0) respawn();
    return;
  }
  if ($.P.slow > 0) $.P.slow--;
  if (pk('glass') && $.P.shield > 1) $.P.shield = 1;
  perkTick(hurt);
  const sp = (1.25 + $.P.speed * .42) * (1 + .08 * pk('spd')) * ($.P.slow > 0 ? .45 : 1);
  // SNOT ROCKET: periodic piercing glob
  if (pk('snot') && $.state === 'play' && ($.G.t % (pk('snot') > 1 ? 150 : 240)) === 0) {
    shots.push({ k: 'bolt', x: $.P.x + 10, y: $.P.y, vx: 4.2, vy: 0, dmg: 4, r: 5, pierce: 8, glob: 1, t: 0 });
    sfx.glob();
  }
  let dx = I.x,
    dy = I.y;
  if (dx && dy) {
    dx *= .75;
    dy *= .75;
  }
  let mx = dx * sp,
    my = dy * sp;
  if (touch.dx || touch.dy) {
    mx += clamp(touch.dx, -9, 9);
    my += clamp(touch.dy, -9, 9);
    touch.dx = touch.dy = 0;
  }
  $.P.x = clamp($.P.x + mx, 10, W - 16);
  $.P.y = clamp($.P.y + my, 6, PH - 6);
  $.P.bank = lerp($.P.bank, clamp(my, -2, 2), .25);
  if (mx || my) {
    $.P.hist.unshift({
      x: $.P.x,
      y: $.P.y
    });
    if ($.P.hist.length > 80) $.P.hist.pop();
  }
  if ($.P.inv > 0) $.P.inv--;
  {
    const L = gmL('regrow');
    if (L) {
      const cap = [0, 1, 2][L],
        per = [0, 1200, 720][L]; // REGROWTH: 1 hit back every 20s (lvl 1), up to 2 every 12s (lvl 2)
      if ($.P.shield < cap && $.G.t % per === 0) {
        $.P.shield = Math.min(cap, Math.floor($.P.shield) + 1);
        for (let k = 0; k < 8; k++) spark($.P.x + rr(-8, 8), $.P.y + rr(-8, 8), 0, -.5, 14, '#ff8aa0');
      }
    }
  }
  if ($.P.wardLv >= 3 && $.P.aegis < 12 && $.G.t % 400 === 0) $.P.aegis++;
  $.P.cd--;
  $.P.mcd--;
  $.P.pcd--;
  if (I.fire && $.P.cd <= 0) fire();
  spark($.P.x - 13, $.P.y + rr(-1, 1), -rr(1, 2.6), rr(-.2, .2), ri(6, 12), R() < .5 ? '#ffd0a0' : '#ff5a20');
  if ($.P.inv <= 0) for (const [ox, oy] of [[12, 0], [-9, -4], [-9, 4], [0, -4], [0, 4]]) {
    const wx = $.P.x + ox + $.G.scroll,
      y = $.P.y + oy;
    if (y >= floorAt(wx) || y <= ceilAt(wx)) {
      if (lastGasp()) return;
      killPlayer();
      return;
    }
  }
}

// ---------------- shots / collisions ----------------
