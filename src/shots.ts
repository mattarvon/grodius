// @ts-nocheck
import { $ } from './state';
import { gainXP, pk } from './perks';
import { FIRE, PH, R, TAU, W, clamp, dist2, pick, ri, rr, swapRm } from './core';
import { SET, lv } from './save';
import { sfx } from './audio';
import { caps, ceilAt, enemies, eshots, floorAt, shots } from './world';
import { addDecal, drop, flash, gib, gore, mist, pop, spark, splat } from './fx/spawn';
import { banner, wrapA } from './enemies/spawn';
import { hurt, killEnemy, podType, updEnemy } from './enemies/update';
import { bossHitByShot } from './boss/update';
import { chainArc, critMul, gmL, graftTake } from './mutations';
import { applyPower, playerHit, slotMaxed } from './player';
import { light } from './render/util';

// ---------------- shots / collisions ----------------
export function hitShot(s, cx, cy, r) {
  if (s.k === 'laser') {
    const nx = clamp(cx, s.x, s.x + s.len),
      ny = clamp(cy, s.y - 1.5, s.y + 1.5);
    return dist2(nx, ny, cx, cy) < r * r;
  }
  return dist2(s.x, s.y, cx, cy) < (r + s.r) * (r + s.r);
}
export function boom(x, y, d = 0) {
  if (d) for (const e of enemies) {
    if (e.dead) continue;
    const ey = e.k === 'eye' ? e.y - e.o * 9 : e.k === 'cross' ? e.y + e.o * 12 : e.y;
    if (dist2(x, y, e.x, ey) < (24 + e.r) ** 2) hurt(e, d, e.x, ey, 1);
  }
  flash(x, y, 30, 9, '255,150,60');
  for (let i = 0; i < 18; i++) spark(x, y, rr(-2.5, 2.5), rr(-2.5, 1), ri(8, 20), pick(FIRE));
  for (let i = 0; i < 10; i++) drop(x, y, rr(-2, 2), rr(-2.5, .5), 1, 5, 40);
  if ($.G) $.G.shake += 1.2;
  sfx.bomb();
}
export function pyreBoom(x, y, d) {
  if (d) for (const e of enemies) {
    if (e.dead) continue;
    const r = 30 + e.r,
      dd = dist2(x, y, e.x, e.y);
    if (dd < r * r) {
      hurt(e, d * (dd < (12 + e.r) ** 2 ? 1 : .6), e.x, e.y, 1);
      if (!e.dead) e.burn = Math.max(e.burn || 0, 130);
    }
  }
  flash(x, y, 50, 14, '255,140,40');
  flash(x, y, 22, 8, '255,240,200');
  light(x, y, 90, 1);
  for (let i = 0; i < 34; i++) {
    const a = R() * TAU,
      sp = rr(.5, 3.5);
    spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp - .5, ri(10, 26), pick(FIRE));
  }
  for (let i = 0; i < 46; i++) {
    const a = R() * TAU,
      sp = rr(.4, 3);
    drop(x, y, Math.cos(a) * sp, Math.sin(a) * sp - .8, rr(1, 1.8), R() < .55 ? 5 : R() < .5 ? 2 : 0, ri(50, 110));
  }
  for (let i = 0; i < 3; i++) {
    const g = gib(x, y, rr(-2.4, 2.4), rr(-2.8, .6), 'eye', rr(1.8, 2.6));
    if (g) {
      g.burning = ri(70, 150);
      g.iris = '#ff3a10';
    }
  }
  for (let i = 0; i < 4; i++) mist(x + rr(-6, 6), y + rr(-6, 6), rr(4, 8), ri(25, 45));
  if ($.G) $.G.shake = Math.min(16, $.G.shake + 2.5);
  sfx.pyre();
}
export function updateShots() {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    let dead = false;
    if (s.k === 'laser') {
      s.len = Math.min(50, s.len + 8);
      s.x += s.vx;
    } else if (s.k === 'missile') {
      if (!s.g) {
        s.x += s.vx;
        s.y += s.vy;
        const wx = s.x + $.G.scroll,
          surf = s.dir > 0 ? floorAt(wx) : ceilAt(wx);
        if (s.dir > 0 ? s.y + 3 >= surf : s.y - 3 <= surf) {
          if (s.dir > 0 ? surf < PH + 5 : surf > -5) {
            s.g = 1;
          }
        }
      } else {
        const nx = s.x + 3.2,
          ns = s.dir > 0 ? floorAt(nx + $.G.scroll) : ceilAt(nx + $.G.scroll);
        if (Math.abs(ns - (s.y + s.dir * 3)) > 7) {
          boom(s.x, s.y);
          dead = true;
        } else {
          s.x = nx;
          s.y = ns - s.dir * 3;
        }
      }
      if ($.G.t % 2 === 0) spark(s.x - 3, s.y, -.5, rr(-.2, .2), 10, '#6b7480');
    } else if (s.k === 'pyre') {
      s.vy += .035;
      s.x += s.vx;
      s.y += s.vy;
      s.rot += .25;
      for (let k = 0; k < 2; k++) spark(s.x - 3, s.y + rr(-1.5, 1.5), rr(-1.6, -.4), rr(-.6, .2), ri(6, 14), pick(FIRE));
      if (R() < .35) drop(s.x - 3, s.y, rr(-1, -.2), rr(-.3, .3), 1, 5, 30);
    } else {
      if (s.k === 'bolt') {
        s.t++;
        if (s.seek && s.vx > 0) {
          if (!s.tg || s.tg.dead || $.G.t % 8 === 0) {
            let bd = 170 * 170;
            s.tg = null;
            for (const e of enemies) {
              if (e.dead || e.x < s.x - 6 || e.ghost > 0) continue;
              const d = dist2(e.x, e.y, s.x, s.y);
              if (d < bd) {
                bd = d;
                s.tg = e;
              }
            }
          }
          if (s.tg) {
            const sp = Math.hypot(s.vx, s.vy),
              a = Math.atan2(s.vy, s.vx),
              ty = s.tg.k === 'eye' ? s.tg.y - s.tg.o * 9 : s.tg.y,
              na = a + clamp(wrapA(Math.atan2(ty - s.y, s.tg.x - s.x) - a), -[0, .05, .09][s.seek], [0, .05, .09][s.seek]);
            s.vx = Math.cos(na) * sp;
            s.vy = Math.sin(na) * sp;
          }
        }
        if (s.rip) s.r = Math.min(2 + s.rip * 5, 2 + s.t * .55);
      }
      s.x += s.vx;
      s.y += s.vy;
    }
    if (!dead && !(s.k === 'missile' && s.g)) {
      const tx = s.k === 'laser' ? s.x + s.len : s.x,
        wx = tx + $.G.scroll;
      if (s.y >= floorAt(wx) || s.y <= ceilAt(wx)) {
        for (let k = 0; k < 4; k++) spark(tx, s.y, rr(-2, 0), rr(-1.5, 1.5), ri(5, 10), '#cfe6ff');
        if (s.k === 'missile') boom(s.x, s.y, s.dmg * .8);
        if (s.k === 'pyre') pyreBoom(s.x, s.y, s.dmg);
        dead = true;
      }
    }
    if (!dead) {
      for (const e of enemies) {
        if (e.dead) continue;
        const ey = e.k === 'eye' ? e.y - e.o * 9 : e.y;
        let hit = hitShot(s, e.x, ey, e.r);
        if (!hit && e.k === 'cross') hit = hitShot(s, e.x, e.y + e.o * 14, 9);
        if (!hit) continue;
        if (s.k === 'pyre') {
          pyreBoom(s.x, s.y, s.dmg);
          dead = true;
          break;
        }
        if (s.k === 'laser') {
          if (s.hit.has(e)) continue;
          s.hit.add(e);
          const d = s.dmg * critMul(e.x, e.y);
          hurt(e, d, e.x - e.r * .5, s.y, 1);
          onHitPerks(e);
          chainArc(e, d);
          continue;
        }
        if (s.k === 'bolt') {
          if (s.hit && s.hit.has(e)) continue;
          const d = s.dmg * critMul(e.x, e.y);
          hurt(e, d, s.x, s.y, s.vx < 0 ? -1 : 1);
          onHitPerks(e);
          if (!s.spore && !s.mirror) chainArc(e, d);
          if (s.pierce > 0) {
            s.pierce--;
            (s.hit || (s.hit = new Set())).add(e);
            for (let k = 0; k < 3; k++) spark(s.x, s.y, rr(0, 2), rr(-1, 1), 6, '#f0e2c0');
            continue;
          }
          dead = true;
          break;
        }
        hurt(e, s.dmg, s.x, s.y, 1);
        if (s.k === 'missile') boom(s.x, s.y, s.dmg * .8);
        dead = true;
        break;
      }
      if (!dead && $.G.boss && bossHitByShot(s) && s.k !== 'laser') {
        if (s.k === 'pyre') pyreBoom(s.x, s.y, 0);else if (s.k === 'missile') boom(s.x, s.y, 0);
        dead = true;
      }
    }
    if (dead || s.x > W + 12 || s.x < -14 || s.y < -12 || s.y > PH + 12) swapRm(shots, i);
  }
}
export function updateEShots() {
  for (let i = eshots.length - 1; i >= 0; i--) {
    const s = eshots[i];
    s.t++;
    let dead = false;
    if (s.k === 'glob') {
      s.vy += .025;
      if (s.t % 3 === 0) drop(s.x, s.y, rr(-.2, .2), rr(-.2, .2), 1, 1, 40);
    }
    s.x += s.vx - (s.k === 'glob' ? 0 : 0);
    s.y += s.vy;
    if (!s.grazed && pk('graze') && $.P.alive && dist2(s.x, s.y, $.P.x, $.P.y) < 14 * 14) {
      s.grazed = 1;
      gainXP(.6 * pk('graze'));
      $.G.score += 40 * pk('graze');
      spark(s.x, s.y, rr(-1, 1), rr(-1, 1), 8, '#9fd2ff');
    }
    const wx = s.x + $.G.scroll,
      f = floorAt(wx),
      c = ceilAt(wx);
    if (s.y >= f || s.y <= c) {
      if (s.k === 'glob') {
        addDecal(wx, s.y >= f ? f : c, 3, s.y >= f ? 1 : -1);
        for (let k = 0; k < 6; k++) drop(s.x, s.y, rr(-1.5, 1.5), s.y >= f ? rr(-2, -.5) : rr(.5, 2), 1.2, 0, 60);
      }
      dead = true;
    }
    if (!dead && $.P.alive && $.P.aegis > 0) {
      const dx = s.x - $.P.x,
        dy = s.y - $.P.y;
      if (dx > 9 && dx < 26 && Math.abs(dy) < 16) {
        $.P.aegis--;
        for (let k = 0; k < 5; k++) spark(s.x, s.y, rr(-.5, 2), rr(-1.5, 1.5), 9, '#f0e2c0');
        sfx.tink();
        dead = true;
      }
    }
    if (!dead && $.P.alive && dist2(s.x, s.y, $.P.x, $.P.y) < (s.r + 2.6 * (1 - .2 * pk('tiny'))) ** 2) {
      if ($.P.inv <= 0 || $.P.shield > 0) {
        playerHit();
        dead = true;
      }
    }
    if (!dead && $.P.alive && $.P.shield > 0 && dist2(s.x, s.y, $.P.x, $.P.y) < 16 * 16) {
      $.P.shield = Math.max(0, $.P.shield - .34);
      for (let k = 0; k < 4; k++) spark(s.x, s.y, rr(-2, 2), rr(-2, 2), 8, '#9fd2ff');
      if ($.P.wardLv >= 2) {
        let a = 0,
          bd = 1e9;
        for (const e of enemies) {
          if (e.dead) continue;
          const d = dist2(e.x, e.y, $.P.x, $.P.y);
          if (d < bd) {
            bd = d;
            a = Math.atan2(e.y - s.y, e.x - s.x);
          }
        }
        shots.push({
          k: 'bolt',
          x: s.x,
          y: s.y,
          vx: Math.cos(a) * 6,
          vy: Math.sin(a) * 6,
          dmg: 1.5,
          r: 2,
          mirror: 1
        });
      }
      dead = true;
    }
    if (dead || s.x < -12 || s.x > W + 12 || s.y < -12 || s.y > PH + 12) swapRm(eshots, i);
  }
}
export function updateEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.dead && e.burn > 0) {
      e.burn--;
      e.hp -= .05;
      if (R() < .7) spark(e.x + rr(-e.r, e.r), e.y + rr(-e.r, e.r * .5), rr(-.4, .4), -rr(.5, 1.6), ri(8, 16), pick(FIRE));
      if (R() < .15) drop(e.x + rr(-e.r, e.r), e.y, rr(-.5, .5), -rr(.2, 1), 1, 5, 40);
      if (e.hp <= 0) killEnemy(e, 1);
    }
    if (!e.dead && e.acid > 0) {
      e.acid--;
      e.hp -= .02 * (1 + pk('corrode'));
      if (R() < .25) drop(e.x + rr(-e.r, e.r), e.y + rr(-e.r, e.r), rr(-.3, .3), rr(0, .6), 1, 2, 40);
      if (e.hp <= 0) killEnemy(e, 1);
    }
    if (e.chill > 0) {
      e.chill--;
      if (R() < .3) spark(e.x + rr(-e.r, e.r), e.y + rr(-e.r, e.r), 0, -.3, 10, '#cfe8ff');
    }
    if (!e.dead && !(e.chill > 0 && !e.mini && $.T % 2)) updEnemy(e);
    if (!e.dead && !(e.ghost > 0) && $.P.alive && dist2(e.x, e.y, $.P.x, $.P.y) < (e.r + 4 - 1.3 * pk('tiny')) ** 2) {
      if ($.P.shield > 0 && !e.big) {
        hurt(e, 8, e.x, e.y, 1);
        playerHit();
      } else playerHit();
    }
    if (e.dead) swapRm(enemies, i);
  }
}
export function updateCaps() {
  for (let i = caps.length - 1; i >= 0; i--) {
    const c = caps[i];
    c.t++;
    if (c.choice) c.x += $.G.scrollSpeed * .55;
    if (!c.blue && !c.graft && !c.choice && c.ty >= 0 && $.G.t % 60 === 0 && $.P && slotMaxed(c.ty)) {
      const n = podType();
      if (n >= 0) c.ty = n;
    }
    if (c.graft && c.t < 100) {
      c.x += (c.tx - c.x) * .1;
      c.y += (c.ty - c.y) * .1;
    } else c.x -= $.G.scrollSpeed * .8 + .25;
    c.y += Math.sin(c.t * .05) * .3;
    const lr = Math.max(lv('lure'), pk('magnet'));
    if (lr && $.P.alive) {
      const d = Math.sqrt(dist2(c.x, c.y, $.P.x, $.P.y)) || 1;
      if (d < 60 + lr * 50) {
        c.x += ($.P.x - c.x) / d * (1 + lr);
        c.y += ($.P.y - c.y) / d * (1 + lr);
      }
    }
    if ($.P.alive && dist2(c.x, c.y, $.P.x, $.P.y) < 12 * 12) {
      if (c.graft) {
        if (gmL(c.graft) < c.glv) graftTake(c.graft);else {
          $.G.gpend[c.graft] = 0;
          $.G.score += 1000;
          sfx.pick();
        }
      } else if (c.blue) purge();else {
        if (c.ty < 0 || c.ty == null) c.ty = podType();
        applyPower(c.ty, !!c.choice || !!c.full);
        if (c.choice) {
          for (let j = caps.length - 1; j >= 0; j--) if (j !== i && caps[j].choice === c.choice) {
            gore(caps[j].x, caps[j].y, .5, {});
            swapRm(caps, j);
            if (j < i) i--;
          }
        }
      }
      $.G.score += 500;
      swapRm(caps, i);
      continue;
    }
    if (c.x < -12) {
      if (c.graft && $.G.gpend) $.G.gpend[c.graft] = 0;
      swapRm(caps, i);
    }
  }
}
export function purge() {
  sfx.purge();
  $.G.white = SET.flashes ? .85 : .35;
  $.G.red = 1;
  $.G.shake = 14;
  $.G.glitch = 10;
  splat(rr(120, 360), rr(60, 180), 4);
  banner('PURGE', '', undefined, 80);
  for (const e of enemies) if (!e.dead && e.x < W) hurt(e, e.big ? 45 : 999, e.x, e.y, 1);
  for (const s of eshots) for (let k = 0; k < 3; k++) drop(s.x, s.y, rr(-1, 1), rr(-1, 1), 1.4, 0, 90);
  eshots.length = 0;
  if ($.G.boss && !$.G.boss.dying && !$.G.boss.enter) {
    const b = $.G.boss;
    for (const p of b.plates) if (p.hp > 0) {
      p.hp -= 30;
      if (p.hp <= 0) {
        const px = b.x + Math.cos(p.a) * 42,
          py = b.y + Math.sin(p.a) * 42;
        gore(px, py, 2.6, {
          dir: -1,
          rope: 2,
          teeth: 4
        });
        $.G.score += 2500 * ($.G.loop + 1);
        pop(px, py, '+' + 2500 * ($.G.loop + 1), '#ffb0b0');
      }
    }
    if (!b.plates.some(p => p.hp > 0)) {
      b.hp -= 40;
      if (b.hp <= 0) {
        b.dying = 220;
        $.G.hitstop = 24;
        $.G.score += 30000 * ($.G.loop + 1);
        pop(b.x, b.y - 40, '+' + 30000 * ($.G.loop + 1), '#ffffff', 16, 120);
        sfx.roar();
        for (const e of enemies) if (!e.dead) killEnemy(e, -1);
      }
    }
  }
}

// ---------------- fx simulation ----------------

/** biome perks applied on every bullet/laser hit */
function onHitPerks(e) {
  if (e.dead) return;
  const fr = pk('frost'), co = pk('corrode'), ig = pk('ignite');
  if (fr) e.chill = Math.max(e.chill || 0, 40 + 30 * fr);
  if (co) e.acid = Math.max(e.acid || 0, 90 + 60 * co);
  if (ig) e.burn = Math.max(e.burn || 0, 50 + 50 * ig);
}
