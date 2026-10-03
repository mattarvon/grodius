// @ts-nocheck
import { $ } from '../state';
import { FIRE, H, R, W, dist2, pick, ri, rr, swapRm } from '../core';
import { SET } from '../save';
import { AU, say, sfx, tone } from '../audio';
import { AMT, ceilAt, decals, drops, flashes, floorAt, geysers, gibs, grav, mists, orbs, sparks, splats, texts } from '../world';
import { addDecal, drop, spark, splat } from '../fx/spawn';
import { makeHell } from '../render/hell';

// ---------------- fx simulation ----------------
export function updateFX() {
  const g = grav(),
    ss = $.G ? $.G.scrollSpeed : 0,
    sc = $.G ? $.G.scroll : 0;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.px = d.x;
    d.py = d.y;
    d.vy += g;
    d.vx *= .988;
    d.vy *= .988;
    d.x += d.vx - ss * .6;
    d.y += d.vy;
    d.l--;
    const wx = d.x + sc,
      f = floorAt(wx),
      c = ceilAt(wx);
    if (d.y >= f) {
      addDecal(wx, f, d.s, 1);
      swapRm(drops, i);
      continue;
    }
    if (d.y <= c) {
      addDecal(wx, c, d.s, -1);
      swapRm(drops, i);
      continue;
    }
    if (d.l <= 0 || d.x < -10 || d.x > W + 10 || d.y > H + 10 || d.y < -20) swapRm(drops, i);
  }
  for (let i = gibs.length - 1; i >= 0; i--) {
    const q = gibs[i];
    q.l--;
    if (q.stuck) {
      q.x -= ss;
      if (q.stuck < 0 && R() < .002) {
        q.stuck = 0;
        q.vy = .5;
      }
    } else {
      q.vy += g;
      q.vx *= .99;
      q.vy *= .99;
      q.x += q.vx - ss * .45;
      q.y += q.vy;
      q.rot += q.vr;
      const wx = q.x + sc,
        f = floorAt(wx),
        c = ceilAt(wx),
        rad = q.s * .5;
      if (q.y + rad >= f) {
        q.y = f - rad;
        addDecal(wx, f, q.s * .7, 1);
        if (Math.abs(q.vy) > .5) sfx.squish();
        q.vy *= -.32;
        q.vx *= .55;
        q.vr *= .5;
        if (Math.abs(q.vy) < .6) {
          q.stuck = 1;
          q.vy = 0;
          q.vx = 0;
          q.vr = 0;
          q.l = Math.max(q.l, 420);
        }
      } else if (q.y - rad <= c) {
        q.y = c + rad;
        addDecal(wx, c, q.s * .7, -1);
        q.vy = Math.abs(q.vy) * .3;
        q.vx *= .5;
        if (R() < .5) {
          q.stuck = -1;
          q.vx = 0;
          q.vy = 0;
          q.vr = 0;
          q.l = Math.max(q.l, 420);
        }
      }
    }
    if (q.burning > 0) {
      q.burning--;
      if (R() < .7) spark(q.x, q.y, rr(-.3, .3), -rr(.4, 1.3), ri(6, 14), pick(FIRE));
    }
    if (q.bleed > 0) {
      q.bleed--;
      if (q.bleed % (q.k === 'half' ? 2 : 5) === 0) drop(q.x, q.y, q.vx * .3 + rr(-.3, .3), q.vy * .3 + rr(-.3, .3), q.k === 'half' ? 1.6 : 1, R() < .4 ? 1 : 0, 55);
    }
    if (q.pts && (q.k === 'rope' || q.k === 'eye')) {
      const p = q.pts;
      p[0].x = q.x;
      p[0].y = q.y;
      const seg = q.k === 'rope' ? 2.6 : 2.2;
      for (let j = 1; j < p.length; j++) {
        const a = p[j],
          vx = (a.x - a.px) * .94,
          vy = (a.y - a.py) * .94;
        a.px = a.x;
        a.py = a.y;
        a.x += vx - ss * .45;
        a.y += vy + g;
        const fl = floorAt(a.x + sc);
        if (a.y > fl) a.y = fl;
        const cl = ceilAt(a.x + sc);
        if (a.y < cl) a.y = cl;
      }
      for (let it = 0; it < 2; it++) for (let j = 1; j < p.length; j++) {
        const a = p[j - 1],
          b = p[j],
          dx = b.x - a.x,
          dy = b.y - a.y,
          dd = Math.hypot(dx, dy) || 1,
          df = (dd - seg) / dd;
        if (j === 1) {
          b.x -= dx * df;
          b.y -= dy * df;
        } else {
          a.x += dx * df * .5;
          a.y += dy * df * .5;
          b.x -= dx * df * .5;
          b.y -= dy * df * .5;
        }
      }
    }
    if (q.l <= 0 || q.x < -40 || q.x > W + 40 || q.y > H + 40) swapRm(gibs, i);
  }
  for (let i = mists.length - 1; i >= 0; i--) {
    const m = mists[i];
    m.l--;
    m.r += m.vr;
    m.x -= ss * .5;
    if (m.l <= 0) swapRm(mists, i);
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.l--;
    s.x += s.vx;
    s.y += s.vy;
    s.vx *= .95;
    s.vy *= .95;
    if (s.l <= 0) swapRm(sparks, i);
  }
  for (let i = flashes.length - 1; i >= 0; i--) {
    if (--flashes[i].l <= 0) swapRm(flashes, i);
  }
  for (let i = geysers.length - 1; i >= 0; i--) {
    const q = geysers[i];
    q.l--;
    let x, y;
    if (q.att) {
      if (q.att.dead) {
        swapRm(geysers, i);
        continue;
      }
      x = q.att.x + q.ox;
      y = q.att.y + q.oy;
    } else {
      x = q.wx - sc;
      y = q.y;
    }
    for (let k = 0; k < q.rate; k++) {
      const a = q.a + rr(-.25, .25),
        sp = rr(1.5, 3.8) * (q.l / (q.l + 30));
      drop(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rr(1, 1.8), q.c || (R() < .3 ? 2 : 0), 100);
    }
    if (q.l <= 0) swapRm(geysers, i);
  }
  for (let i = splats.length - 1; i >= 0; i--) {
    const s = splats[i];
    s.l--;
    for (const d of s.dr) d.len += d.sp;
    if (s.l <= 0) swapRm(splats, i);
  }
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    o.t++;
    o.l--;
    o.vx *= .94;
    o.vy *= .94;
    o.x += o.vx - ss * .5;
    o.y += o.vy;
    if ($.P && $.P.alive && o.t > 14) {
      const d = Math.sqrt(dist2(o.x, o.y, $.P.x, $.P.y)) || 1;
      if (d < 90) {
        const f = d < 40 ? 2.6 : 1.1;
        o.x += ($.P.x - o.x) / d * f;
        o.y += ($.P.y - o.y) / d * f;
      }
      if (d < 8) {
        $.G.bio += o.v;
        $.meta.bio += o.v;
        sfx.squish();
        swapRm(orbs, i);
        continue;
      }
    }
    if (o.l <= 0 || o.x < -10) swapRm(orbs, i);
  }
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.l--;
    t.y -= .35;
    if (t.l <= 0) swapRm(texts, i);
  }
}
export const CARN = [[5, 'MESSY'], [10, 'GRISLY'], [20, 'VISCERAL'], [35, 'ABATTOIR'], [50, 'MEAT GRINDER'], [75, 'BEYOND THE GATE'], [100, 'HELL IS SHIPWIDE']];
export function updateCombo() {
  if ($.G.comboT > 0) {
    $.G.comboT--;
    if ($.G.comboT === 0) {
      $.G.combo = 0;
      $.G.cMile = 0;
    }
  }
  for (const [n, w] of CARN) if ($.G.combo >= n && $.G.cMile < n) {
    $.G.cMile = n;
    $.G.carn = {
      w,
      t: 90
    };
    if (n === 20) babe();else if (n >= 10) hype(n);
    if (n >= 10) splat(rr(80, 400), rr(40, 200), 1.5 + n / 40);
    $.G.red = Math.max($.G.red, .35);
  }
  if ($.G.carn && --$.G.carn.t <= 0) $.G.carn = null;
  if ($.G.hype && --$.G.hype.t <= 0) $.G.hype = null;
  if ($.G.babe && --$.G.babe.t <= 0) $.G.babe = null;
}
export const HYPE = {
  10: ['HELL YEAH', 'BROTHER!'],
  20: ["NOW WE'RE", "COOKIN' MEAT!"],
  35: ['SPLATTER', "'EM, BROTHER!"],
  50: ['GLORIOUS', 'CARNAGE!'],
  75: ['THE GATE', 'FEARS YOU!'],
  100: ['HELL IS', 'YOUR HOUSE!']
};
export function babe() {
  $.G.babe = {
    t: 230,
    ml: 230,
    y: rr(34, 52)
  };
  tone({
    f: 523,
    f2: 1046,
    dur: .25,
    vol: .05,
    type: 'triangle',
    wet: .3
  });
  tone({
    at: .15,
    f: 659,
    f2: 1318,
    dur: .3,
    vol: .05,
    type: 'triangle',
    wet: .3
  });
  setTimeout(() => say('excellent work, baby', {
    female: 1,
    pitch: 1.15,
    rate: .9
  }), 500);
}
export function hype(n) {
  const L = HYPE[n];
  if (!L) return;
  $.G.hype = {
    L,
    t: 150,
    ml: 150
  };
  sfx.hype();
  setTimeout(() => say(L.join(' ').replace(/[!']/g, '').toLowerCase()), 120);
}
export function hellFlash() {
  if (!SET.flashes) return;
  makeHell();
  $.G.hell = ri(3, 5);
  $.G.glitch = Math.max($.G.glitch, 8);
  sfx.whisper();
}
export function updateAmbient() {
  const s = $.G.scroll,
    corr = AMT.corr(s),
    core = AMT.core(s);
  if (AU.lp && $.G.t % 30 === 0) AU.lp.frequency.setTargetAtTime(140 + AMT.hull(s) * 60 + corr * 80 + core * 220 + ($.G.boss && $.G.boss.phase === 2 ? 180 : 0), AU.c.currentTime, 1.5);
  if (R() < .0018) sfx.groan();
  if (SET.flashes && R() < corr * .0011 + core * .0018 + ($.G.boss && $.G.boss.phase === 2 ? .003 : 0)) hellFlash();else if (R() < corr * .003) $.G.glitch = Math.max($.G.glitch, ri(2, 5));
  if (corr > 0 && R() < .012) $.G.flick = ri(2, 8);
  if ($.G.flick > 0) $.G.flick--;
  if ($.G.bossStarted && $.G.boss && $.G.boss.enter && $.G.t % 50 === 0) sfx.heart();
  // dripping ceilings
  for (let i = 0; i < decals.length; i++) {
    const d = decals[i];
    if (d.side < 0 && d.r > 2.2 && R() < .0035) {
      const x = d.wx - s;
      if (x > 0 && x < W) {
        drop(x, d.y + Math.min(d.r * 4, ($.T - d.t) * .05), 0, .2, 1, 0, 120);
        sfx.drip();
      }
    }
  }
  // transmissions
  if (!$.G.log && $.G.logQ.length) $.G.log = {
    s: $.G.logQ.shift(),
    t: 0
  };
  if ($.G.log && ++$.G.log.t > $.G.log.s.length * 2 + 170) $.G.log = null;
  if ($.G.banner && --$.G.banner.t <= 0) $.G.banner = null;
}
export function decayFX() {
  $.G.shake *= .86;
  if ($.G.shake < .2) $.G.shake = 0;
  $.G.white *= .9;
  $.G.red *= .93;
  if ($.G.hell > 0) $.G.hell--;
  if ($.G.glitch > 0) $.G.glitch--;
}

// ---------------- main step ----------------
