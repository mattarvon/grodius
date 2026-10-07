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
import { gunTier, smoke } from './fx/gunfx';

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
  {
    // POWER readout: say what just changed, in plain terms
    const [s, d, short] = powerText(i);
    pop($.P.x, $.P.y - 16, short, POD[i].h, 9, 60);
    $.G.feed = { s, d, t: 150, ml: 150 };
  }
  flash($.P.x, $.P.y, 40, 10, POD[i].c);
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * TAU;
    spark($.P.x, $.P.y, Math.cos(a) * 2.4, Math.sin(a) * 2.4, 14, POD[i].h);
  }
}
/** [feed title, feed detail, pop over the ship] for a pod level-up */
export function powerText(i) {
  const P = $.P;
  switch (i) {
    case 0: return ['THRUST ' + P.speed, `ship speed +${Math.round(P.speed * .42 / 1.25 * 100)}%`, 'THRUST ' + P.speed + ': FASTER'];
    case 1: return P.missile > 1 ? ['MISSILE II // TWIN SALVO', 'up + down rockets, 40% faster reload, +20% blast', 'MISSILE II: TWIN SALVO'] : ['MISSILE // GROUND ROCKETS', 'splash rockets ride the floor', 'MISSILE: ROCKETS'];
    case 2: return ['SPLIT // 3-WAY FAN', 'three rounds per shot, fanned wide', 'SPLIT: 3-WAY FAN'];
    case 3: return ['ARC // PIERCING BEAM', 'x1.7 damage, burns through every body in line', 'ARC: PIERCING BEAM'];
    case 4: return P.pyre > 1 ? ['PYRE II // EYE STORM', 'every gunner lobs, 50% faster', 'PYRE II: EYE STORM'] : ['PYRE // FLAMING EYES', 'lobbed eyes burst and set meat burning', 'PYRE: FIRE EYES'];
    case 5: return ['WRAITH ' + P.options + ' // +1 GUNNER', `${P.options + 1} guns firing, +${50 * P.options}% damage`, `WRAITH: ${P.options + 1} GUNS`];
    default: { const n = ['', 'MEMBRANE', 'MIRROR', 'BONE AEGIS'][P.wardLv]; return ['WARD // ' + n, ['', 'soaks 3 hits', 'soaks 3 hits, reflects bullets', 'soaks 3, reflects, bone shield ahead'][P.wardLv], n]; }
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
// ---- weapon numbers (tuned with tools/dps-probe.mjs: every pickup is a felt jump, not a rounding error) ----
/** SPLIT fan: [angle (rad), damage share]. 3-way spread: the core plus two flankers that sweep the screen */
const FAN = [[0, 1], [-.2, .8], [.2, .8]];
/** WRAITH gunners hit at half weight: +50% / +33% / +25% per wraith instead of x2/x3/x4 (keeps the top end sane) */
const WR = .5;
export function fire() {
  const cal = gmL('cal'),
    serr = gmL('serr'),
    dm = 1.25 ** serr * 1.22 ** cal * dmMul(), // geometric: every graft level is a +22-25% step, not a shrinking one
    rem = Math.max(-1, Math.min(0, $.P.cd || 0)),
    rp = gmL('rapid'),
    tier = gunTier(),
    rate = 1.25 ** rp * (1 + [0, .08, .15, .21][pk('rof')]),
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
    r: 2 + cal * .8,
    cal,
    serr,
    pierce: gmL('pierce') + pk('pierce'),
    seek: gmL('seek'),
    rip: gmL('ripple'),
    t: 0,
    ...o
  });
  if ($.P.laser) {
    // ARC: fractional cooldown (remainder carries) so every rate step counts; hard floor so it can't hose
    $.P.cd = Math.max(5, 9 / rate) + rem;
    for (let j = 0; j < org.length; j++) {
      const o = org[j];
      shots.push({
        k: 'laser',
        x: o.x + 8,
        y: o.y,
        vx: 9,
        vy: 0,
        len: 6,
        dmg: 1.7 * dm * (j ? WR : 1),
        hit: new Set(),
        r: 2,
        w: 1 + Math.min(1.6, (dm - 1) * .8),
        seed: R() * 99,
        wr: j > 0
      });
    }
    sfx.laser(tier);
  } else {
    $.P.cd = Math.max(3.5, 7 / rate) + rem;
    for (let j = 0; j < org.length; j++) {
      const o = org[j];
      if ($.P.double) {
        for (const [a, f] of FAN) B(o.x + 10, o.y, Math.cos(a) * 7.5, Math.sin(a) * 7.5, { dmg: dm * f * (j ? WR : 1), fan: 1, wr: j > 0 });
      } else B(o.x + 10, o.y, 7.5, 0, { dmg: dm * (j ? WR : 1), wr: j > 0 });
    }
    sfx.shot(tier);
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
  // muzzle: flash + recoil grow with how much gun you carry
  {
    const mz = 8 + tier * 3 + ($.P.laser ? 3 : 0),
      mc = $.P.laser ? '140,200,255' : dm >= 1.8 ? '255,120,90' : dm >= 1.2 ? '255,210,140' : '190,225,255';
    flash($.P.x + 13, $.P.y, mz, 3 + (tier > 2 ? 1 : 0), mc);
    for (let j = 1; j < org.length; j++) flash(org[j].x + 6, org[j].y, mz * .6, 3, '255,150,90');
    if ($.P.double) for (const [a] of FAN) if (a) spark($.P.x + 12, $.P.y, Math.cos(a) * 3.2, Math.sin(a) * 3.2, 4, '#ffd8ff');
    $.P.kick = Math.min(3.2, ($.P.kick || 0) + .5 + tier * .3);
  }
  if ($.P.missile && $.P.mcd <= 0) {
    const m2 = $.P.missile > 1;
    $.P.mcd = Math.round((m2 ? 24 : 34) * (1 - .2 * pk('reload')));
    for (let j = 0; j < org.length; j++) {
      const o = org[j], w = j ? WR : 1;
      shots.push({
        k: 'missile',
        x: o.x,
        y: o.y + 3,
        vx: 2.4,
        vy: 2.4,
        dmg: (m2 ? 3.6 : 3) * dm * w,
        r: 3.5,
        dir: 1,
        g: 0,
        lv: $.P.missile
      });
      if (m2) shots.push({
        k: 'missile',
        x: o.x,
        y: o.y - 3,
        vx: 2.4,
        vy: -2.4,
        dmg: 3.6 * dm * w,
        r: 3.5,
        dir: -1,
        g: 0,
        lv: 2
      });
      smoke(o.x - 2, o.y + 3, 2.5, 22, -.8, .3);
    }
    sfx.missile($.P.missile);
    $.G.shake = Math.min(6, $.G.shake + .5);
  }
  if ($.P.pyre && $.P.pcd <= 0) {
    const p2 = $.P.pyre > 1;
    $.P.pcd = Math.round((p2 ? 20 : 30) * (1 - .2 * pk('reload')));
    const src = p2 ? org : [org[0]];
    for (let j = 0; j < src.length; j++) shots.push({
      k: 'pyre',
      x: src[j].x + 8,
      y: src[j].y,
      vx: 4.4,
      vy: -1.1,
      dmg: 5 * dm * (j ? WR : 1),
      r: p2 ? 5 : 4,
      lv: $.P.pyre,
      rot: R() * TAU
    });
    flash($.P.x + 12, $.P.y, 22, 6, '255,140,40');
    sfx.fireball($.P.pyre);
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
