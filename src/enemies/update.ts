// @ts-nocheck
import { $ } from '../state';
import { gainXP, pk, spillSlick } from '../perks';
const VOL = { on: 0 };
import { clearStage } from '../stages';
import { PH, R, TAU, W, clamp, dist2, lerp, pick, ri, rr, sstep } from '../core';
import { SET, lv } from '../save';
import { sample, sfx } from '../audio';
import { caps, ceilAt, enemies, eshots, floorAt, geysers, orbs } from '../world';
import { drop, flash, gib, gore, mist, pop, spark, splat } from '../fx/spawn';
import { aimA, banner, eshoot, every, fan, mk, onScreen, ring } from '../enemies/spawn';
import { countKill } from '../mutations';
import { WARD_MAX, playerHit, slotMaxed } from '../player';
import { onKillContraptions } from '../contraptions';

// --- enemy behaviour ---
export function updEnemy(e) {
  e.t++;
  if (e.flash > 0) e.flash--;
  if (e.ghost > 0) e.ghost--;
  const ss = $.G.scrollSpeed;
  switch (e.k) {
    case 'drone':
      {
        if (e.pat === 'sine') {
          e.x -= 1.75;
          e.y = e.y0 + Math.sin((e.t + e.i * 9) * .07) * 26;
        } else if (e.pat === 'zig') {
          e.x -= 2;
          const ph = (e.t + e.i * 6) % 80 / 80;
          e.y = e.y0 + (ph < .5 ? ph * 4 - 1 : 3 - ph * 4) * 28;
        } else if (e.pat === 'wall') {
          e.x -= 1.25;
          e.y = e.y0 + Math.sin(e.t * .05) * 4;
        } else if (e.pat === 'behind') {
          e.x += 1.8;
          e.y = e.y0 + Math.sin(e.t * .06 + e.i) * 14 + (e.x > W * .5 ? (e.i - 2) * (e.x - W * .5) * .06 : 0);
        } else {
          if (!e.turn && e.x > W * .6) e.x -= 2.3;else {
            e.turn = 1;
            e.vy = lerp(e.vy, clamp(($.P.y - e.y) * .04, -1.9, 1.9), .06);
            e.x -= 2.7;
            e.y += e.vy;
          }
        }
        if (onScreen(e) && !(e.ghost > 0) && R() < .0025 * (1 + $.G.loop) && e.x > $.P.x + 40) eshoot(e.x, e.y, aimA(e.x, e.y), 1.5);
        break;
      }
    case 'corpse':
      {
        e.x -= e.vx ? -e.vx : ss * .85 + e.drift;
        e.y += Math.sin(e.t * .02 + e.ph) * .25;
        e.rot += e.vr;
        if (R() < .08) drop(e.x + rr(-3, 3), e.y + rr(-3, 3), rr(-.4, .4), rr(-.4, .4), 1, R() < .5 ? 0 : 1, 80);
        if (R() < .004) e.twitch = 12;
        if (e.twitch > 0) e.twitch--;
        break;
      }
    case 'eye':
      {
        e.x -= ss;
        const wx = e.x + $.G.scroll;
        e.y = e.o > 0 ? floorAt(wx) : ceilAt(wx);
        if (e.blink > 0) e.blink--;else if (R() < .006) e.blink = 10;
        e.cool--;
        if (e.cool <= 0 && onScreen(e) && e.x > 20) {
          e.cool = Math.max(55, 120 - $.G.loop * 18) + ri(0, 40);
          const ex = e.x,
            ey = e.y - e.o * 8;
          eshoot(ex, ey, aimA(ex, ey), 1.7);
          if ($.G.loop > 0) eshoot(ex, ey, aimA(ex, ey) + .25, 1.7);
          flash(ex, ey, 12, 5, '255,60,60');
        }
        break;
      }
    case 'crawler':
      {
        const wx = e.x + $.G.scroll,
          surf = e.o > 0 ? floorAt(wx) : ceilAt(wx);
        if (!e.air) {
          e.x -= ss + e.spd;
          e.y = surf - e.o * 7;
          if (Math.abs($.P.x - e.x) < 46 && (e.o > 0 ? $.P.y < e.y : $.P.y > e.y) && e.t > 30 && R() < .05) {
            e.air = 1;
            e.vy = -e.o * rr(2.8, 3.6);
            e.vx = ($.P.x - e.x) * .02;
          }
          e.cool--;
          if (e.cool <= 0 && onScreen(e)) {
            e.cool = ri(110, 170);
            eshoot(e.x, e.y - e.o * 4, aimA(e.x, e.y), 1.4, 'glob');
          }
          if (e.o > 0 && surf > PH + 10 || e.o < 0 && surf < -10) {
            e.air = 1;
            e.vy = 0;
            e.vx = 0;
          }
        } else {
          e.vy += e.o * .12;
          e.y += e.vy;
          e.x += (e.vx || 0) - ss;
          const s2 = e.o > 0 ? floorAt(e.x + $.G.scroll) : ceilAt(e.x + $.G.scroll);
          if (e.o > 0 ? e.y >= s2 - 7 && e.vy > 0 : e.y <= s2 + 7 && e.vy < 0) {
            e.air = 0;
            e.vx = 0;
          }
          if (e.y > PH + 30 || e.y < -30) e.dead = true;
        }
        break;
      }
    case 'hatch':
      {
        if (e.fromLeft) {
          e.x += 2.4;
          e.y += (e.x > $.P.x ? clamp(($.P.y - e.y) * .02, -.8, .8) : 0) + Math.sin(e.t * .3 + e.ph) * .6;
        } else {
          e.vx = -2.5;
          e.x += e.vx;
          e.vy = clamp(e.vy + ($.P.y > e.y ? .05 : -.05), -1.4, 1.4);
          e.y += e.vy + Math.sin(e.t * .3 + e.ph) * .5;
        }
        if (R() < .2) drop(e.x + 4, e.y, rr(-.3, .3), rr(-.2, .2), 1, R() < .5 ? 4 : 0, 40);
        break;
      }
    case 'womb':
      {
        e.x -= ss;
        e.y = ceilAt(e.x + $.G.scroll) + e.st + Math.sin(e.t * .04) * 1.5;
        e.cool--;
        if (e.cool <= 0 && onScreen(e) && e.x > 60) {
          e.cool = Math.max(70, 120 - $.G.loop * 15);
          mk('hatch', e.x, e.y + 12, {
            ph: R() * TAU,
            vy: 1
          });
          for (let i = 0; i < 10; i++) drop(e.x, e.y + 12, rr(-1, 1), rr(0, 2), 1.3, R() < .5 ? 4 : 0, 90);
          sfx.squish();
        }
        if (R() < .05) drop(e.x + rr(-6, 6), e.y + 12, 0, .3, 1, 4, 90);
        break;
      }
    case 'cross':
      {
        e.x -= ss;
        const sy = e.o > 0 ? floorAt(e.x + $.G.scroll) : ceilAt(e.x + $.G.scroll);
        e.y = sy - e.o * 22;
        e.cool--;
        if (e.cool <= 0 && onScreen(e) && e.x > 30) {
          e.cool = Math.max(70, 130 - $.G.loop * 18) + ri(0, 40);
          const hx = e.x,
            hy = e.y + 14,
            a = aimA(hx, hy),
            n = $.G.loop > 0 ? 2 : 1;
          for (let k = -n; k <= n; k++) eshoot(hx, hy, a + k * .2, 1.5);
          for (let k = 0; k < 14; k++) drop(hx, hy, rr(-1.5, 1.5), rr(-1, 1.5), 1.3, R() < .4 ? 2 : 0, 70);
          flash(hx, hy, 12, 5, '255,40,40');
        }
        if (R() < .12) drop(e.x + rr(-9, 9), e.y + rr(-16, 12), 0, .3, 1, R() < .5 ? 0 : 1, 90);
        break;
      }
    case 'hook':
      {
        e.ax -= ss;
        e.ay = Math.max(-10, ceilAt(e.ax + $.G.scroll));
        const ang = Math.sin(e.t * .035 + e.ph) * e.sw * .55 + (e.kick || 0);
        if (e.kick) e.kick *= .96;
        e.x = e.ax + Math.sin(ang) * e.len;
        e.y = e.ay + Math.cos(ang) * e.len;
        e.rot = Math.PI - ang;
        if (R() < .004) e.twitch = 14;
        if (e.twitch > 0) e.twitch--;
        if (R() < .22) {
          const hx = e.x + Math.sin(e.rot) * 9,
            hy = e.y - Math.cos(e.rot) * 9;
          drop(hx, hy, rr(-.2, .2), rr(.2, .6), 1.2, R() < .5 ? 0 : 1, 110);
        }
        if (e.t % 90 === 0) sfx.chain();
        break;
      }
    case 'flayer':
      {
        if (e.t < 520) e.x = lerp(e.x, e.tx, .03);else e.x -= 1.3;
        const wx = e.x + $.G.scroll,
          lo = ceilAt(wx) + 18,
          hi = floorAt(wx) - 18;
        e.y0 += clamp($.P.y - e.y0, -.5, .5) * .5;
        e.y = clamp(e.y0 + Math.sin(e.t * .035) * 16, lo, Math.max(lo, hi));
        if (e.ws === 'idle') {
          e.cool--;
          if (e.cool <= 0) {
            if ($.P.alive && e.x < W - 20 && dist2(e.x, e.y, $.P.x, $.P.y) < 155 * 155) {
              e.ws = 'tel';
              e.wt = 0;
              sfx.chain();
            } else e.cool = 20;
          }
        } else if (e.ws === 'tel') {
          e.wt++;
          e.ang = aimA(e.x - 7, e.y + 1);
          if (e.wt >= 34) {
            e.ws = 'strike';
            e.wt = 0;
            sfx.lash();
          }
        } else {
          e.wt++;
          const pts = whipPts(e),
            tip = pts[pts.length - 1];
          if (e.wt === 7) {
            for (let k = 0; k < 8; k++) spark(tip.x, tip.y, rr(-2, 2), rr(-2, 2), ri(5, 10), '#ffe0d0');
            flash(tip.x, tip.y, 14, 4, '255,220,200');
            $.G.shake += 1.5;
          }
          if (e.wt > 4 && e.wt < 16 && $.P.alive) for (let i = 4; i < pts.length; i++) if (dist2($.P.x, $.P.y, pts[i].x, pts[i].y) < 4.5 * 4.5) {
            playerHit();
            break;
          }
          if (e.wt >= 26) {
            e.ws = 'idle';
            e.cool = Math.max(60, 110 - $.G.loop * 15) + ri(0, 40);
          }
        }
        if (R() < .15) drop(e.x + rr(-5, 5), e.y + rr(-2, 8), rr(-.3, .3), rr(0, .5), 1, R() < .5 ? 0 : 1, 80);
        if ($.G.loop > 0 && e.ws === 'idle' && R() < .004 && onScreen(e)) eshoot(e.x, e.y - 8, aimA(e.x, e.y), 1.4, 'glob');
        break;
      }
    case 'nailbar':
      {
        const p = e.par;
        if (!p || p.dead) {
          killEnemy(e, -1);
          break;
        }
        e.x = p.x + e.ox;
        e.y = p.y + e.oy;
        if (R() < .05) drop(e.x, e.y + 10, 0, .4, 1, 0, 60);
        break;
      }
    case 'crux':
      {
        if (e.t < 220) e.x = lerp(e.x, e.tx, .03);
        const ph2 = e.hp < e.max * .5;
        e.y = PH / 2 + Math.sin(e.t * .012) * (PH * .22) * (ph2 ? 1.25 : 1);
        e.shielded = e.bars.some(b => !b.dead);
        if (!e.shielded && !e.exposed) {
          e.exposed = 1;
          banner('ITS HEART IS EXPOSED', '', undefined, 100);
          sfx.roar();
          gore(e.x - 14, e.y - 4, 2, {
            chain: 4,
            metal: 4
          });
        }
        if (e.t > 140 && $.P.alive) {
          if (every(e, 85)) fan(e.x - 26, e.y - 4, aimA(e.x - 26, e.y - 4), 5, .17, 1.7, 'spike');
          if (every(e, 160)) {
            ring(e.x - 26, e.y + 28, 9, e.t * .05, 1.15);
            ring(e.x + 26, e.y + 28, 9, e.t * .05 + .3, 1.15);
          }
          if (ph2 && e.t % 8 === 0) eshoot(e.x, e.y - 6, e.t * .11, 1.25);
          if (ph2 && every(e, 120)) {
            for (let k = 0; k < 5; k++) eshoot(e.x + rr(-10, 10), e.y - 50, -Math.PI / 2 + rr(-.9, .9), 1.6, 'glob');
          }
        }
        if (R() < .4) drop(e.x + rr(-6, 6), e.y + rr(-30, 30), rr(-.3, .3), rr(.2, .8), 1.4, R() < .5 ? 0 : 1, 90);
        break;
      }
    case 'butcher':
      {
        if (e.t < 240) e.x = lerp(e.x, e.tx, .025);
        const ph2 = e.hp < e.max * .5;
        if (ph2 && !e.cut) {
          e.cut = 1;
          banner('IT SNAPPED A CHAIN', '', undefined, 100);
          sfx.roar();
          gore(e.x + 10, e.y - 34, 2, {
            chain: 5
          });
        }
        e.sw += ph2 ? .03 : .018;
        e.y = (ph2 ? 112 : 96) + Math.sin(e.sw) * (ph2 ? 42 : 14);
        if (e.t >= 240) e.x = e.tx + (ph2 ? Math.cos(e.sw) * 22 : 0);
        const sx = e.x - 10,
          sy = e.y - 10;
        e.wt++;
        if (e.st === 'idle') {
          e.ba = lerp(e.ba, -2.3, .1);
          if (--e.cool <= 0 && e.t > 160 && $.P.alive) {
            e.att++;
            const near = Math.abs($.P.x - sx) < 120 && Math.abs($.P.y - sy) < 100;
            e.st = near && e.att % 3 !== 0 ? 'ctel' : e.att % 2 ? 'htel' : 'spit';
            e.wt = 0;
            if (e.st === 'ctel') sfx.tele();
            if (e.st === 'htel') {
              e.ha = aimA(e.x + 10, e.y - 8);
              sfx.chain();
            }
          }
        } else if (e.st === 'ctel') {
          e.ba = lerp(e.ba, -2.4, .2);
          if (e.wt >= 48) {
            e.st = 'cut';
            e.wt = 0;
            sfx.lash();
          }
        } else if (e.st === 'cut') {
          const p = Math.min(1, e.wt / 12);
          e.ba = -2.3 - p * (TAU - 4.6);
          if (e.wt === 6) {
            $.G.shake += 4;
            for (let k = 0; k < 30; k++) drop(sx - 60, sy, rr(-3, 0), rr(-2, 2), 1.6, R() < .4 ? 2 : 0, 80);
          }
          if ($.P.alive && e.wt <= 12) {
            const d = Math.sqrt(dist2($.P.x, $.P.y, sx, sy));
            let pa = Math.atan2($.P.y - sy, $.P.x - sx);
            if (pa < 0) pa += TAU;
            let cur = e.ba;
            if (cur < 0) cur += TAU;
            if (d > 18 && d < 100 && pa <= 3.99 && pa >= cur) playerHit();
          }
          if (e.wt >= 30) {
            e.st = 'idle';
            e.cool = ph2 ? 50 : 80;
          }
        } else if (e.st === 'htel') {
          e.ha = lerp(e.ha, aimA(e.x + 10, e.y - 8), .05);
          if (e.wt >= 40) {
            e.st = 'hook';
            e.wt = 0;
            e.hk = {
              d: 10,
              out: 1
            };
            sfx.lash();
          }
        } else if (e.st === 'hook') {
          const h = e.hk;
          h.d += h.out ? 7 : -5;
          if (h.d > 230) h.out = 0;
          const tx = e.x + 10 + Math.cos(e.ha) * h.d,
            ty = e.y - 8 + Math.sin(e.ha) * h.d;
          if (ty > floorAt(tx + $.G.scroll) || ty < ceilAt(tx + $.G.scroll) || tx < 0) {
            if (h.out) {
              h.out = 0;
              for (let k = 0; k < 8; k++) spark(tx, ty, rr(-2, 2), rr(-2, 2), 8, '#cfe6ff');
            }
          }
          if ($.P.alive && h.out && dist2($.P.x, $.P.y, tx, ty) < 8 * 8) playerHit();
          if (!h.out && h.d <= 12) {
            e.hk = null;
            e.st = 'idle';
            e.cool = ph2 ? 45 : 70;
          }
        } else if (e.st === 'spit') {
          if (e.wt === 10 || e.wt === 26) {
            const hx = e.x - 6,
              hy = e.y - 34;
            fan(hx, hy, aimA(hx, hy), ph2 ? 7 : 5, .2, 1.8, 'glob');
            for (let k = 0; k < 16; k++) drop(hx, hy, rr(-3, -.5), rr(-1, 1), 1.5, R() < .5 ? 0 : 1, 80);
          }
          if (e.wt >= 40) {
            e.st = 'idle';
            e.cool = ph2 ? 50 : 80;
          }
        }
        if (ph2 && every(e, 110)) ring(e.x, e.y + 6, 12, e.t * .07, 1.1);
        if (R() < .35) drop(e.x + rr(-14, 14), e.y + rr(0, 24), rr(-.3, .3), rr(.2, .8), 1.4, R() < .5 ? 0 : 1, 90);
        break;
      }
    case 'maw':
      {
        const tx = W - 82;
        if (e.t < e.leave) {
          e.x = lerp(e.x, tx, .025);
        } else {
          e.x += 1.6;
          if (e.x > W + 60) {
            e.dead = true;
            if (e.stageBoss) {
              clearStage(true);
              banner('IT GOT AWAY', 'NO REWARD', '#8a5a5a', 150);
            }
          }
        }
        e.y = PH / 2 + Math.sin(e.t * .017) * (PH * .28);
        const cyc = e.t % 130;
        e.jaw = cyc > 80 && cyc < 120 ? Math.min(1, (cyc - 80) / 14) : Math.max(0, e.jaw - .08);
        if (cyc === 100 && e.x < W - 20) {
          const a = aimA(e.x - 14, e.y);
          for (let k = -3; k <= 3; k++) eshoot(e.x - 14, e.y, a + k * .16, 1.6 + Math.abs(k) * .1, 'glob');
          for (let k = 0; k < 24; k++) drop(e.x - 14, e.y, rr(-3, -.5), rr(-1.5, 1.5), 1.6, R() < .4 ? 2 : 0, 80);
          $.G.shake += 2;
        }
        if (e.t % 55 === 20 && e.x < W - 20) {
          const ep = pick(e.eyesP),
            ex = e.x + Math.cos(ep.a + Math.PI) * ep.r,
            ey = e.y + Math.sin(ep.a) * ep.r;
          eshoot(ex, ey, aimA(ex, ey), 2);
        }
        for (const ep of e.eyesP) {
          if (ep.b > 0) ep.b--;else if (R() < .01) ep.b = 8;
        }
        if (R() < .3) drop(e.x + rr(-20, 20), e.y + rr(10, 22), rr(-.3, .3), rr(.2, .8), 1.2, R() < .5 ? 0 : 1, 90);
        if (e.hp < e.max * .5 && !e.wounded) {
          e.wounded = 1;
          gib(e.x + 10, e.y - 15, 1, -2, 'metal', 5);
          geysers.push({
            wx: e.x + $.G.scroll,
            y: e.y,
            att: e,
            ox: 6,
            oy: -14,
            a: -1.3,
            l: 400,
            rate: 3
          });
        }
        break;
      }
  }
  if (!e.mini && e.k !== 'nailbar' && e.t > 90 && (e.x < -50 || e.x > W + 70 || e.y < -60 || e.y > PH + 60)) e.dead = true;
  if (e.k === 'drone' && e.pat === 'behind' && e.x > W + 40) e.dead = true;
}
export function whipPts(e) {
  const hx = e.x - 7,
    hy = e.y + 1,
    pts = [];
  let len, ang, amp;
  if (e.ws === 'strike') {
    const p = e.wt / 26,
      ext = p < .3 ? sstep(0, .3, p) : 1 - sstep(.55, 1, p);
    len = 14 + 108 * ext;
    ang = e.ang;
    amp = (1 - ext) * 9 + 2;
  } else if (e.ws === 'tel') {
    len = 22;
    ang = e.ang + Math.PI + Math.sin(e.wt * .6) * .3;
    amp = 5;
  } else {
    len = 30;
    ang = Math.PI / 2 + .35 * Math.sin(e.t * .05);
    amp = 4;
  }
  for (let i = 0; i <= 14; i++) {
    const f = i / 14,
      w = Math.sin(f * 6 - e.t * .4) * amp * f;
    pts.push({
      x: hx + Math.cos(ang) * len * f - Math.sin(ang) * w,
      y: hy + Math.sin(ang) * len * f + Math.cos(ang) * w + (e.ws === 'idle' ? f * f * 6 : 0)
    });
  }
  return pts;
}
export function hurt(e, d, hx, hy, dir) {
  if (e.dead) return;
  if (e.k === 'crux' && e.shielded) {
    e.flash = 1;
    if (R() < .4) spark(hx, hy, rr(-2, 0), rr(-1, 1), 6, '#cfe6ff');
    sfx.tink();
    return;
  }
  e.hp -= d;
  e.flash = 3;
  if (e.k === 'hook') e.kick = (e.kick || 0) + .12;
  const n = 4 + Math.min(14, d * 4 | 0);
  for (let k = 0; k < n; k++) drop(hx, hy, dir * rr(.6, 2.8) + rr(-.8, .8), rr(-1.5, 1.3), rr(1, 1.9), R() < .3 ? 2 : 0, ri(50, 110));
  if (R() < .3) mist(hx, hy, rr(3, 5), 20);
  if (e.big && R() < .2) gib(hx, hy, dir * rr(.5, 2), rr(-1.5, 1), 'chunk', rr(1.5, 2.5));
  sfx.hit();
  if (e.hp <= 0) killEnemy(e, dir);
}
export const mult = () => 1 + Math.min(4, $.G.combo * .05);
export function killEnemy(e, dir = 1) {
  e.dead = true;
  gore(e.x, e.y, e.gsz, {
    dir,
    eyes: e.eyes || 0,
    teeth: e.teeth || 0,
    half: e.half ? e : null,
    amnio: e.amnio,
    skull: e.skull,
    limbs: e.limbs,
    fire: e.burn > 0,
    chain: e.k === 'hook' || e.k === 'flayer' ? 2 : 0
  });
  const sc = Math.round(e.score * mult() * (1 + $.G.loop * .5));
  $.G.score += sc;
  if (!e.par) gainXP(e.mini ? 30 : Math.max(1, e.score / 100));
  const vo = pk('volatile');
  // VOLATILE MEAT: one burst per kill, and meat killed BY a burst doesn't burst again (no screen-wide chains)
  if (vo && !e.mini && !e.par && !VOL.on) {
    const r = 18 + 8 * vo;
    flash(e.x, e.y, r, 8, '255,120,60');
    VOL.on = 1;
    let n = 0;
    for (const o of enemies) if (o !== e && !o.dead && n < 6 && dist2(o.x, o.y, e.x, e.y) < r * r) { n++; hurt(o, .6 + .6 * vo, o.x, o.y, 1); }
    VOL.on = 0;
  }
  if (!e.par) spillSlick(e.x, e.y);
  if (pk('scab') && $.P && $.P.wardLv > 0 && $.P.shield < WARD_MAX && R() < .06 * pk('scab')) {
    $.P.shield = Math.min(WARD_MAX, Math.floor($.P.shield) + 1);
    pop($.P.x, $.P.y - 12, 'SCAB', '#ff8aa0', 7, 30);
  }
  pop(e.x, e.y - 8, '+' + sc, '#cfd9e3', 8, 40);
  const bio = Math.ceil(e.bio * (1 + .25 * lv('gland')));
  const n = Math.min(8, Math.max(1, Math.round(bio / 3)));
  for (let i = 0; i < n; i++) orbs.push({
    x: e.x,
    y: e.y,
    vx: rr(-1.6, 1.6),
    vy: rr(-1.6, 1.6),
    v: bio / n,
    l: 600,
    t: 0
  });
  countKill(e);
  onKillContraptions(e);
  $.G.combo++;
  $.G.comboT = 120;
  $.G.kills++;
  if ($.G.combo > $.G.maxCombo) $.G.maxCombo = $.G.combo;
  if ($.G.st) {
    if (!e.mini && !e.par) $.G.st.kills++;
    $.G.st.chain = Math.max($.G.st.chain, $.G.combo);
  }
  if (e.cap) dropCap(e.x, e.y);
  if (e.group) {
    e.group.killed++;
    if (e.group.killed === e.group.n) dropCap(e.x, e.y);
  }
  if (e.k === 'crux' || e.k === 'butcher') {
    for (const b of e.bars || []) if (!b.dead) killEnemy(b, -1);
    miniReward(e);
    clearStage();
    for (let i = 0; i < 4; i++) splat(rr(80, 400), rr(30, 210), rr(3, 4.5));
    gore(e.x, e.y - 20, 4, {
      chain: 6,
      rope: 4,
      eyes: 4,
      black: e.k === 'crux'
    });
    gore(e.x, e.y + 20, 3, {
      limbs: 3,
      skull: 2
    });
    banner(e.k === 'crux' ? 'UNCRUCIFIED' : 'BUTCHERED', '', undefined, 130);
    $.G.hitstop = Math.max($.G.hitstop, 18);
    $.G.white = SET.flashes ? .6 : .25;
    sfx.roar();
    for (const s of eshots) for (let k = 0; k < 2; k++) drop(s.x, s.y, rr(-1, 1), rr(-1, 1), 1.4, 0, 90);
    eshots.length = 0;
  }
  if (e.k === 'corpse') sample('corpsevoice', { vol: 1.1, spread: .04, wet: .2, solo: true });
  if (e.k === 'maw') {
    if (e.stageBoss) {
      miniReward(e);
      clearStage();
    } else {
      dropCap(e.x - 20, e.y - 16);
      dropCap(e.x - 20, e.y + 16);
    }
    splat(rr(150, 330), rr(60, 160), 4);
    splat(rr(150, 330), rr(60, 160), 3);
    banner('TORN APART', '', undefined, 90);
  }
  if (e.k === 'eye') {
    geysers.push({
      wx: e.x + $.G.scroll,
      y: e.y,
      a: e.o > 0 ? -Math.PI / 2 : Math.PI / 2,
      l: 110,
      rate: 4
    });
    const g = gib(e.x, e.y - e.o * 8, rr(-1, 1), -e.o * rr(2, 3.5), 'eye', 3.4);
    if (g) g.iris = '#9bb030';
  }
  if (e.k === 'womb') {
    for (let i = 0; i < 3; i++) gib(e.x, e.y, rr(-1.5, 1.5), rr(0, 2), 'skin', rr(3, 5));
    geysers.push({
      wx: e.x + $.G.scroll,
      y: ceilAt(e.x + $.G.scroll) + 3,
      a: Math.PI / 2,
      l: 160,
      rate: 3,
      c: 4
    });
  }
  if ($.G.loop > 0 && e.k !== 'hatch' && !($.G.boss && $.G.boss.dying) && e.x < W - 10 && $.P.alive && dist2(e.x, e.y, $.P.x, $.P.y) > 70 * 70) eshoot(e.x, e.y, aimA(e.x, e.y), 1.3);
}
export const POD = [{
  c: '127,224,255',
  h: '#7fe0ff',
  w: 1
}, {
  c: '255,179,71',
  h: '#ffb347',
  w: 1
}, {
  c: '255,112,192',
  h: '#ff70c0',
  w: .8
}, {
  c: '76,141,255',
  h: '#4c8dff',
  w: .8
}, {
  c: '255,90,16',
  h: '#ff5a10',
  w: .8
}, {
  c: '176,128,255',
  h: '#b080ff',
  w: .7
}, {
  c: '216,228,240',
  h: '#d8e4f0',
  w: .9
}];
export function podType() {
  if (!$.P) return ri(0, 6);
  const ok = [];
  let tot = 0;
  for (let i = 0; i < 7; i++) {
    if (slotMaxed(i)) continue;
    let w = POD[i].w;
    if (i === 0 && $.P.speed >= 3) w *= .4;
    if (i === 2 && $.P.laser || i === 3 && $.P.double || i === 1 && $.P.pyre || i === 4 && $.P.missile) w *= .5;
    ok.push([i, w]);
    tot += w;
  }
  if (!ok.length) return -1;
  let r = R() * tot;
  for (const [i, w] of ok) {
    if ((r -= w) <= 0) return i;
  }
  return ok[ok.length - 1][0];
}
export function miniReward(e) {
  const pool = [];
  for (let i = 0; i < 7; i++) if ($.P && !slotMaxed(i)) pool.push(i);
  while (pool.length < 3) pool.push(ri(0, 6));
  for (let k = pool.length - 1; k > 0; k--) {
    const j = ri(0, k);
    [pool[k], pool[j]] = [pool[j], pool[k]];
  }
  const gid = $.T;
  for (let k = 0; k < 3; k++) caps.push({
    x: W * .58 + (k - 1) * 62,
    y: PH * .67,
    t: k * 20,
    blue: false,
    ty: pool[k],
    choice: gid
  });
  $.G.bio += 30;
  $.meta.bio += 30;
}
export function dropCap(x, y) {
  const blue = R() < .07;
  caps.push({
    x,
    y,
    t: R() * 100,
    blue,
    ty: blue ? -1 : podType()
  });
}

// ---------------- boss: the gravity drive ----------------
