// @ts-nocheck
import { $ } from '../state';
import { PH, R, TAU, W, clamp, dist2, lerp, pick, rr } from '../core';
import { SET } from '../save';
import { sfx } from '../audio';
import { enemies, eshots } from '../world';
import { drop, gore, pop, spark, splat } from '../fx/spawn';
import { aimA, banner, eshoot, mk, wrapA } from '../enemies/spawn';
import { killEnemy } from '../enemies/update';
import { playerHit } from '../player';
import { hitShot } from '../shots';
import { hellFlash } from '../fx/update';

// ---------------- boss: the gravity drive ----------------
export function startBoss() {
  $.G.bossStarted = true;
  const m = 1 + .4 * $.G.loop;
  $.G.boss = {
    x: W + 150,
    y: PH / 2,
    tx: W - 110,
    hp: 560 * m,
    max: 560 * m,
    phase: 0,
    t: 0,
    ra: 0,
    rb: 0,
    eye: 0,
    laser: null,
    dying: 0,
    enter: 1,
    plates: [-.62, 0, .62].map(o => ({
      a: Math.PI + o,
      hp: 48 * m,
      max: 48 * m,
      f: 0
    })),
    tent: [{
      side: -1,
      ph: 0
    }, {
      side: 1,
      ph: Math.PI
    }],
    fl: 0
  };
  banner('THE GRAVITY DRIVE', 'IT WANTS TO TAKE YOU BACK WITH IT', undefined, 260);
  sfx.alarm();
  setTimeout(() => sfx.roar(), 900);
  $.G.glitch = 20;
}
export function tentPts(b, t) {
  const side = t.side,
    bx = b.x - 12,
    by = b.y + side * 30;
  const ang = Math.PI + side * (.42 + .55 * Math.sin(b.t * .021 * (1 + b.phase * .45) + t.ph));
  const len = 100 + 38 * Math.sin(b.t * .013 + t.ph),
    pts = [];
  for (let i = 0; i <= 16; i++) {
    const f = i / 16,
      w = Math.sin(f * 5 - b.t * .12 + t.ph) * 7 * f;
    pts.push({
      x: bx + Math.cos(ang) * len * f - Math.sin(ang) * w,
      y: by + Math.sin(ang) * len * f + Math.cos(ang) * w
    });
  }
  return pts;
}
export function updateBoss() {
  const b = $.G.boss;
  if (!b) return;
  b.t++;
  if (b.fl > 0) b.fl--;
  for (const p of b.plates) if (p.f > 0) p.f--;
  if (b.dying) {
    b.dying--;
    b.ra += .004;
    b.y += Math.sin(b.t * .5) * .6;
    if (b.dying % 6 === 0) {
      const a = R() * TAU,
        r = rr(0, 55);
      gore(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, rr(1.5, 3), {
        black: true,
        dir: rr(-1, 1),
        eyes: R() < .3 ? 2 : 0,
        teeth: 3
      });
      $.G.hitstop = 0;
    }
    if (b.dying % 28 === 0) {
      splat(rr(60, 420), rr(30, 220), rr(2, 4));
      $.G.glitch = 6;
      if (SET.flashes && R() < .5) hellFlash();
    }
    $.G.shake = Math.max($.G.shake, 5);
    if (b.dying === 1) {
      for (let i = 0; i < 4; i++) gore(b.x + rr(-30, 30), b.y + rr(-30, 30), 5, {
        black: true,
        rope: 4,
        eyes: 5,
        teeth: 12,
        metal: 10
      });
      for (let i = 0; i < 6; i++) splat(rr(40, 440), rr(20, 230), rr(3, 5));
      $.G.white = SET.flashes ? 1 : .4;
      $.G.boss = null;
      $.G.clearT = 330;
      if ($.P.alive) $.P.inv = 9999;
      banner('GATE SEALED', `DESCENT ${$.G.loop + 1} SURVIVED`, '#e8f1ff', 300);
      for (const e of eshots) for (let k = 0; k < 3; k++) drop(e.x, e.y, rr(-1, 1), rr(-1, 1), 1.4, 0, 90);
      eshots.length = 0;
    }
    return;
  }
  if (b.enter) {
    b.x = lerp(b.x, b.tx, .018);
    if (Math.abs(b.x - b.tx) < 1) b.enter = 0;
  }
  const platesUp = b.plates.some(p => p.hp > 0);
  const np = platesUp ? 0 : b.hp < b.max * .4 ? 2 : 1;
  if (np !== b.phase) {
    b.phase = np;
    sfx.roar();
    $.G.shake = 12;
    $.G.glitch = 16;
    if (SET.flashes) hellFlash();
    banner(np === 1 ? 'IT OPENED ITS EYE' : 'IT IS ANGRY NOW', '', undefined, 120);
    splat(rr(100, 380), rr(40, 200), 3);
  }
  b.y = PH / 2 + Math.sin(b.t * .012) * (36 + b.phase * 14);
  b.ra += .008 * (1 + b.phase * .7);
  b.rb -= .014 * (1 + b.phase * .6);
  b.eye = lerp(b.eye, b.phase > 0 ? 1 : 0, .04);
  if (b.enter) return;
  const ex = b.x,
    ey = b.y;
  if (b.phase === 0) {
    if (b.t % 80 === 0) for (let k = 0; k < 8; k++) {
      const a = b.ra + k * TAU / 8;
      if (Math.cos(a) < .35) eshoot(b.x + Math.cos(a) * 84, b.y + Math.sin(a) * 84, a, 1.5);
    }
    if (b.t % 170 === 85) {
      const a = aimA(ex - 40, ey);
      for (let k = -2; k <= 2; k++) eshoot(ex - 40, ey, a + k * .18, 1.5, 'glob');
    }
  } else {
    if (!b.laser && b.t % (b.phase === 2 ? 150 : 190) === 0) {
      b.laser = {
        tel: 60,
        beam: 0,
        ang: aimA(ex, ey)
      };
      sfx.tele();
    }
    if (b.laser) {
      const L = b.laser;
      if (L.tel > 0) {
        L.tel--;
        L.ang += wrapA(aimA(ex, ey) - L.ang) * .04;
        if (L.tel === 0) {
          L.beam = 50;
          sfx.beam();
          $.G.shake += 4;
        }
      } else {
        L.beam--;
        L.ang += clamp(wrapA(aimA(ex, ey) - L.ang), -.011, .011);
        $.G.shake = Math.max($.G.shake, 2);
        if ($.P.alive && $.P.inv <= 0) {
          const dx = $.P.x - ex,
            dy = $.P.y - ey,
            ca = Math.cos(L.ang),
            sa = Math.sin(L.ang),
            along = dx * ca + dy * sa,
            perp = Math.abs(-dx * sa + dy * ca);
          if (along > 0 && perp < 6) playerHit();
        }
        if (L.beam <= 0) b.laser = null;
      }
    }
    if (!b.laser && b.t % 50 === 0) {
      const a = aimA(ex, ey);
      for (let k = -1; k <= 1; k++) eshoot(ex - 20, ey, a + k * .22, 1.9);
    }
    if (b.t % 250 === 125) {
      const c = mk('corpse', ex - 30, ey, {
        vx: -2.3,
        vr: rr(-.08, .08),
        drift: 0,
        ph: 0,
        noLeg: R() < .5,
        cap: R() < .35
      });
      c.x = ex - 30;
      for (let k = 0; k < 30; k++) drop(ex - 24, ey, rr(-3, -.5), rr(-1.5, 1.5), 1.5, R() < .5 ? 3 : 0, 80);
      sfx.squish();
    }
    if (b.phase === 2) {
      if (b.t % 6 === 0) {
        const a = b.t * .13;
        eshoot(ex, ey, a, 1.25);
        eshoot(ex, ey, a + Math.PI, 1.25);
      }
      if (b.t % 95 === 0) {
        const a = aimA(ex, ey);
        eshoot(ex + Math.cos(a) * 70, ey + Math.sin(a) * 70, a, 2.4, 'spike');
      }
    }
  }
  // contact with player
  if ($.P.alive) {
    if (dist2($.P.x, $.P.y, b.x, b.y) < 62 * 62) playerHit();
    for (const t of b.tent) {
      const pts = tentPts(b, t);
      for (let i = 10; i < pts.length; i++) if (dist2($.P.x, $.P.y, pts[i].x, pts[i].y) < (i === 16 ? 8 : 5) ** 2) {
        playerHit();
        break;
      }
    }
  }
  if (R() < .15) {
    const t = pick(b.tent),
      pts = tentPts(b, t),
      q = pts[16];
    drop(q.x, q.y, rr(-.4, .4), .5, 1.2, R() < .5 ? 0 : 3, 80);
  }
}
export function bossHitByShot(s) {
  const b = $.G.boss;
  if (!b || b.dying || b.enter) return false;
  for (const p of b.plates) {
    if (p.hp <= 0) continue;
    const px = b.x + Math.cos(p.a) * 42,
      py = b.y + Math.sin(p.a) * 42;
    if (hitShot(s, px, py, 13)) {
      if (s.k === 'laser') {
        if (s.hit.has(p)) continue;
        s.hit.add(p);
      }
      p.hp -= s.dmg;
      p.f = 3;
      for (let k = 0; k < 4; k++) drop(s.x, s.y, rr(-2.5, -.3), rr(-1.4, 1.4), 1.5, R() < .3 ? 2 : 0, 90);
      sfx.hit();
      if (p.hp <= 0) {
        $.G.hitstop = Math.max($.G.hitstop, 6);
        gore(px, py, 2.6, {
          dir: -1,
          rope: 2,
          teeth: 4
        });
        $.G.score += 2500 * ($.G.loop + 1);
        pop(px, py, '+' + 2500 * ($.G.loop + 1), '#ffb0b0');
      }
      return true;
    }
  }
  const d2 = dist2(s.x + (s.k === 'laser' ? s.len : 0), s.y, b.x, b.y);
  if (d2 < 26 * 26) {
    if (b.plates.some(p => p.hp > 0)) {
      spark(s.x, s.y, rr(-2, -.5), rr(-1, 1), 8, '#cfe6ff');
      sfx.tink();
      return true;
    }
    if (s.k === 'laser') {
      if (s.hit.has(b)) return false;
      s.hit.add(b);
    }
    b.hp -= s.dmg;
    b.fl = 3;
    for (let k = 0; k < 3; k++) drop(s.x, s.y, rr(-2.5, -.3), rr(-1.4, 1.4), 1.5, R() < .6 ? 3 : 0, 90);
    sfx.hit();
    if (b.hp <= 0) {
      b.dying = 220;
      $.G.hitstop = 24;
      $.G.score += 30000 * ($.G.loop + 1);
      pop(b.x, b.y - 40, '+' + 30000 * ($.G.loop + 1), '#ffffff', 16, 120);
      sfx.roar();
      for (const e of enemies) if (!e.dead) killEnemy(e, -1);
    }
    return true;
  }
  return false;
}

// ---------------- mutations: you become what you kill ----------------
