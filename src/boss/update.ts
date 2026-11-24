// @ts-nocheck
import { $ } from '../state';
import { clearStage } from '../stages';
import { FIRE, PH, R, TAU, W, clamp, dist2, lerp, pick, ri, rr } from '../core';
import { SET } from '../save';
import { sfx } from '../audio';
import { enemies, eshots } from '../world';
import { drop, gore, pop, spark, splat } from '../fx/spawn';
import { aimA, banner, endVolley, eshoot, mk, volley, wrapA } from '../enemies/spawn';
import { killEnemy } from '../enemies/update';
import { playerHit } from '../player';
import { hitShot } from '../shots';
import { hellFlash } from '../fx/update';
import { critMul } from '../mutations';
import { perkFX, pk } from '../perks';
import { driveMul } from '../depth';
import { DRIVE, driveClock, pincerTargets, reachPose, tentBase, twinAngle } from './bossrules';
import { cad, driveHpMul, due, g3, iv, ivD, leadA, room, variant } from './bossfights';
import { reachK, tempoK } from '../tier';
import { segDist } from '../enemies/butcherhook';
import { capGrade } from '../enemies/boss/registry';

// ---------------- boss: the gravity drive ----------------
export function startBoss() {
  $.G.bossStarted = true;
  // HP tracks loop AND power: the one documented exception to the power rule (D1, design/progression.md): every other
  // enemy's HP comes from depth alone, but without its power terms the Drive's fight collapses (driveMul, src/depth.ts)
  // long4 (DIFFICULTY-SPEC C22): base HP DRIVE.hp [FIT], and neither rank nor the dial touch it (driveHpMul)
  const G3 = g3(), m = G3 ? driveHpMul() : driveMul(), hp0 = G3 ? DRIVE.hp : 560, pl0 = G3 ? DRIVE.plateHp : 48;
  $.G.boss = {
    x: W + 150,
    y: PH / 2,
    tx: W - 110,
    hp: hp0 * m,
    max: hp0 * m,
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
      hp: pl0 * m,
      max: pl0 * m,
      f: 0
    })),
    tent: [{
      side: -1,
      ph: 0
    }, {
      side: 1,
      ph: Math.PI
    }],
    fl: 0,
    g3: G3 ? 1 : 0, // long4: the REACH / twin beam / pincer fight and its clock (updateDrive3)
    ft: 0
  };
  banner('THE GRAVITY DRIVE', 'IT WANTS TO TAKE YOU BACK WITH IT', undefined, 260);
  sfx.siren();
  setTimeout(() => sfx.roar(), 900);
  $.G.glitch = 20;
}
export function tentPts(b, t) {
  const side = t.side,
    bx = b.x - 12,
    by = b.y + side * 30;
  let ang = Math.PI + side * (.42 + .55 * Math.sin(b.t * .021 * (1 + b.phase * .45) + t.ph));
  let len = 100 + 38 * Math.sin(b.t * .013 + t.ph),
    wk = 1;
  const pts = [];
  if (t.rs) { // long4 THE REACH (bossrules reachPose): it coils onto its locked line, shoots out straight, then sways again
    const p = reachPose(t.rs, t.rf, len, t.rl);
    len = p.len;
    ang += wrapA(t.ra - ang) * p.k;
    wk = 1 - p.k;
  }
  for (let i = 0; i <= 16; i++) {
    const f = i / 16,
      w = Math.sin(f * 5 - b.t * .12 + t.ph) * 7 * f * wk;
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
  bossDots(b);
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
      if (R() < .5) hellFlash();
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
      $.G.clearT = 480;
      clearStage();
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
  if (b.g3) { updateDrive3(b); return; }
  const platesUp = b.plates.some(p => p.hp > 0);
  const np = platesUp ? 0 : b.hp < b.max * .4 ? 2 : 1;
  if (np !== b.phase) {
    b.phase = np;
    sfx.roar();
    $.G.shake = 12;
    $.G.glitch = 16;
    hellFlash();
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
      if (volley(5, ex - 40, ey)) { for (let k = -2; k <= 2; k++) eshoot(ex - 40, ey, a + k * .18, 1.5, 'glob'); endVolley(); } // atomic on long4 (spawn.ts volley: all or none; short: always true)
    }
  } else {
    if (!b.laser && b.t % (b.phase === 2 ? 200 : 250) === 0) {
      // Big Core rule: it aims while it charges, then the beam is a straight line you dodge. One hit per sweep max.
      b.laser = {
        tel: 75,
        ml: 75,
        beam: 0,
        hit: false,
        ang: aimA(ex, ey)
      };
      sfx.tele();
    }
    if (b.laser) {
      const L = b.laser;
      if (L.tel > 0) {
        L.tel--;
        // tracks you for most of the charge, then locks for the last 20 frames so the dodge is readable
        if (L.tel > 20) L.ang += wrapA(aimA(ex, ey) - L.ang) * .04;
        if (L.tel === 0) {
          L.beam = 40;
          sfx.beam();
          $.G.shake += 4;
        }
      } else {
        L.beam--;
        $.G.shake = Math.max($.G.shake, 2);
        if ($.P.alive && $.P.inv <= 0 && !L.hit) {
          const dx = $.P.x - ex,
            dy = $.P.y - ey,
            ca = Math.cos(L.ang),
            sa = Math.sin(L.ang),
            along = dx * ca + dy * sa,
            perp = Math.abs(-dx * sa + dy * ca);
          if (along > 0 && perp < 6) {
            L.hit = true;
            playerHit();
          }
        }
        if (L.beam <= 0) b.laser = null;
      }
    }
    if (!b.laser && b.t % 50 === 0) {
      const a = aimA(ex, ey);
      if (volley(3, ex - 20, ey)) { for (let k = -1; k <= 1; k++) eshoot(ex - 20, ey, a + k * .22, 1.9); endVolley(); } // atomic on long4 (spawn.ts volley: all or none; short: always true)
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
// ---------------- long4: THE REACH, the twin beam and the pincer (DIFFICULTY-SPEC §2.3, encounters.md §4.10) ----------------
// The double spiral is gone. Phase 0 (plates up): each tentacle REACHES on a 220 f cycle, 110 apart: a 46 f coil tell
// (the tip glows, a dashed line to the ship locks for the last 16 f), 30 f out to 190 px, 30 f back; plus a 5-pellet
// forward ring every 100 and an aimed 3-orb fan every 120. Phase 1 (eye open): the beam every 220, a reach every 90
// alternating, the 3-fan every 70 (never while the beam charges), the thrown corpse. Phase 2 (< 40%): the TWIN BEAM every
// 200 (one line on the ship, one 70 px to the side with room: a >= 50 px lane between them), then both limbs close on
// that lane as a PINCER (tips >= 60 px apart), plus the 3-fan and a led spike every 95. Every interval x the rank rule;
// every volley reserved under the 24 cap. Its clock: 45 s THE WELL COLLAPSES (plates fall), 60 s it self-destructs (C23)
function updateDrive3(b) {
  const P = $.P, platesUp = b.plates.some(p => p.hp > 0);
  const np = platesUp ? 0 : b.hp < b.max * .4 ? 2 : 1;
  if (np !== b.phase) {
    b.phase = np;
    sfx.roar();
    $.G.shake = 12;
    $.G.glitch = 16;
    hellFlash();
    banner(np === 1 ? 'IT OPENED ITS EYE' : 'IT IS ANGRY NOW', '', undefined, 120);
    splat(rr(100, 380), rr(40, 200), 3);
    for (const t of b.tent) if (t.rs) { t.rs = 3; t.rf = 0; } // a phase change pulls the limbs home
    b.rn = 60;
  }
  b.y = PH / 2 + Math.sin(b.t * .012) * (36 + b.phase * 14);
  b.ra += .008 * (1 + b.phase * .7);
  b.rb -= .014 * (1 + b.phase * .6);
  b.eye = lerp(b.eye, b.phase > 0 ? 1 : 0, .04);
  if (b.enter) return;
  // the fight clock: it counts while the ship lives (a death is not the boss's time)
  if (P.alive) b.ft++;
  const clk = driveClock(b.ft);
  if (clk >= 1 && !b.col) {
    b.col = 1;
    for (const p of b.plates) if (p.hp > 0) {
      p.hp = 0; // no score: they fall, they were not broken
      gore(b.x + Math.cos(p.a) * 42, b.y + Math.sin(p.a) * 42, 2.2, { dir: -1, metal: 4, rope: 1 });
    }
    banner('THE WELL COLLAPSES', 'ITS PLATES SLOUGH OFF', '#ff8a3a', 140);
    sfx.roar();
    $.G.shake = Math.max($.G.shake, 10);
    return;
  }
  if (clk === 2) {
    b.timed = 1;
    if ($.G.st) $.G.st.gcap = capGrade($.G.st.gcap || 'S', DRIVE.grade);
    banner('IT TEARS ITSELF APART', 'NO REWARD', '#8a5a5a', 160);
    b.laser = null;
    bossDies(b);
    return;
  }
  const ex = b.x, ey = b.y, Rc = DRIVE.reach, Bm = DRIVE.beam;
  for (const t of b.tent) stepReach(b, t);
  if (b.phase === 0) {
    // the reach: tentacle 0 on the cycle, tentacle 1 alt0 later (40 f before tentacle 0's ends, at rank >= 14)
    b.rn = (b.rn ?? 60) - 1;
    if (b.rn <= 0) {
      b.rn = ivD(Rc.cyc0);
      reachAt(b, b.tent[0]);
      b.r1 = variant() ? Rc.tell + Rc.ext + Rc.hold + Rc.back - Rc.overlap : Math.round(Rc.alt0 * cad() * tempoK());
    }
    if (b.r1 > 0 && --b.r1 === 0) reachAt(b, b.tent[1]);
    if (due(b, 'c0', DRIVE.ring0.n, iv(DRIVE.ring0.every))) {
      const R0 = DRIVE.ring0, o = .2 * Math.sin(b.ra);
      for (let k = 0; k < R0.n; k++) { const a = Math.PI + o + (k / (R0.n - 1) - .5) * R0.arc; eshoot(ex + Math.cos(a) * 84, ey + Math.sin(a) * 84, a, R0.v); }
    }
    if (b.c1 == null) b.c1 = DRIVE.fan0.first;
    if (due(b, 'c1', DRIVE.fan0.n, iv(DRIVE.fan0.every))) {
      const F = DRIVE.fan0, a = aimA(ex - 40, ey), m = (F.n - 1) / 2; // fans never lead (E4)
      for (let k = -m; k <= m; k++) eshoot(ex - 40, ey, a + k * F.spread, F.v);
    }
  } else {
    // the beam: phase 1 one line, phase 2 two with a guaranteed lane, the pincer after it
    if (!b.laser) b.lc = (b.lc ?? 90) - 1;
    if (!b.laser && b.lc <= 0) {
      b.lc = ivD(b.phase === 2 ? Bm.every2 : Bm.every1);
      const a = aimA(ex, ey);
      b.laser = { tel: Bm.tel, ml: Bm.tel, beam: 0, hit: false, ang: a, ang2: b.phase === 2 ? twinAngle(ex, ey, P.x, P.y, PH) : null, r: Math.max(60, Math.hypot(P.x - ex, P.y - ey)) };
      sfx.tele();
    }
    if (b.laser) {
      const L = b.laser;
      if (L.tel > 0) {
        L.tel--;
        // it tracks you for most of the charge, then locks for the last 20 frames; the twin's second line keeps its lane
        if (L.tel > Bm.lock) {
          L.ang += wrapA(aimA(ex, ey) - L.ang) * .04;
          L.r = Math.max(60, Math.hypot(P.x - ex, P.y - ey));
          if (L.ang2 != null) L.ang2 = twinAngle(ex, ey, ex + Math.cos(L.ang) * L.r, ey + Math.sin(L.ang) * L.r, PH);
        }
        if (L.tel === 0) { L.beam = Bm.live; sfx.beam(); $.G.shake += 4; }
      } else {
        L.beam--;
        $.G.shake = Math.max($.G.shake, 2);
        if (P.alive && P.inv <= 0 && !L.hit && (inBeam(ex, ey, L.ang) || (L.ang2 != null && inBeam(ex, ey, L.ang2)))) { L.hit = true; playerHit(); }
        if (L.beam <= 0) {
          if (L.ang2 != null) pincer(b, L);
          b.laser = null;
        }
      }
    }
    // phase 1: a reach every half-cycle, alternating
    if (b.phase === 1) {
      b.rn = (b.rn ?? 60) - 1;
      if (b.rn <= 0) { b.rn = Math.round(ivD(Rc.cyc1) / 2); reachAt(b, b.tent[(b.ri = ((b.ri || 0) + 1) % 2)]); }
    }
    // the 3-fan, held while a beam charges
    if (!(b.laser && b.laser.tel > 0) && due(b, 'c2', DRIVE.fan1.n, iv(DRIVE.fan1.every))) {
      const F = DRIVE.fan1, a = aimA(ex, ey), m = (F.n - 1) / 2;
      for (let k = -m; k <= m; k++) eshoot(ex - 20, ey, a + k * F.spread, F.v);
    }
    if (b.phase === 1 && b.t % DRIVE.corpse === 125) { // phase 1 only (ENC 4.10)
      const c = mk('corpse', ex - 30, ey, { vx: -2.3, vr: rr(-.08, .08), drift: 0, ph: 0, noLeg: R() < .5, cap: R() < .35 });
      c.x = ex - 30;
      for (let k = 0; k < 30; k++) drop(ex - 24, ey, rr(-3, -.5), rr(-1.5, 1.5), 1.5, R() < .5 ? 3 : 0, 80);
      sfx.squish();
    }
    if (b.phase === 2 && due(b, 'c3', 1, iv(DRIVE.spike.every))) {
      const a = leadA(ex, ey, DRIVE.spike.v);
      eshoot(ex + Math.cos(a) * 70, ey + Math.sin(a) * 70, a, DRIVE.spike.v, 'spike');
    }
  }
  // contact: the hull, and the tentacles (a reaching limb along its whole outer half: its points sit 12 px apart)
  if (P.alive) {
    if (dist2(P.x, P.y, b.x, b.y) < 62 * 62) playerHit();
    for (const t of b.tent) {
      const pts = tentPts(b, t);
      let hit = false;
      for (let i = t.rs ? 8 : 10; i < pts.length && !hit; i++) {
        if (dist2(P.x, P.y, pts[i].x, pts[i].y) < (i === 16 ? 8 : 5) ** 2) hit = true;
        else if (t.rs && i > 8 && segDist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, P.x, P.y) < 5) hit = true;
      }
      if (hit) { playerHit(); break; }
    }
  }
  if (R() < .15) {
    const t = pick(b.tent),
      pts = tentPts(b, t),
      q = pts[16];
    drop(q.x, q.y, rr(-.4, .4), .5, 1.2, R() < .5 ? 0 : 3, 80);
  }
}
/** the ship in the beam from (ex, ey) at angle a: ahead of the eye and within its half-width */
function inBeam(ex, ey, a) {
  const dx = $.P.x - ex, dy = $.P.y - ey, ca = Math.cos(a), sa = Math.sin(a);
  return dx * ca + dy * sa > 0 && Math.abs(-dx * sa + dy * ca) < DRIVE.beam.half;
}
/** start a tentacle's reach at the ship (a no-op while it is already reaching) */
function reachAt(b, t) {
  if (t.rs) return;
  t.rs = 1; t.rf = 0; t.tx = null; t.ty = null; t.rl = Math.round(DRIVE.reach.len * (b.g3 ? reachK() : 1)); // r4: the tier's reach (tier.ts TIER.reach), carried on the limb: the render and the pilot read t.rl
  const B = tentBase(b.x, b.y, t.side);
  t.ra = Math.atan2($.P.y - B.y, $.P.x - B.x);
  sfx.tele(); // the coil's cue (the tell grammar), the wet under it
  sfx.squish();
}
/** the twin beam has ended: both limbs close on the lane between its lines, at the ship's distance */
function pincer(b, L) {
  const am = L.ang + wrapA(L.ang2 - L.ang) / 2, cx = clamp(b.x + Math.cos(am) * L.r, 12, W - 12), cy = clamp(b.y + Math.sin(am) * L.r, 12, PH - 12);
  const T = pincerTargets(b.x, b.y, cx, cy, am);
  for (const t of b.tent) {
    const q = T[t.side < 0 ? 0 : 1], B = tentBase(b.x, b.y, t.side);
    t.rs = 1; t.rf = 0; t.tx = q[0]; t.ty = q[1];
    t.ra = Math.atan2(q[1] - B.y, q[0] - B.x);
    t.rl = Math.min(DRIVE.pincer.len, Math.hypot(q[0] - B.x, q[1] - B.y));
  }
  sfx.tele();
  sfx.squish();
}
/** one frame of a tentacle's reach: the tell tracks its target (the ship, or the pincer's point) then locks */
function stepReach(b, t) {
  if (!t.rs) return;
  const Rc = DRIVE.reach;
  t.rf++;
  if (t.rs === 1) {
    if (t.rf <= Rc.tell - Rc.lock) {
      const B = tentBase(b.x, b.y, t.side), x = t.tx ?? $.P.x, y = t.ty ?? $.P.y;
      t.ra = Math.atan2(y - B.y, x - B.x);
      if (t.tx != null) t.rl = Math.min(DRIVE.pincer.len, Math.hypot(x - B.x, y - B.y));
    }
    if (t.rf >= Rc.tell) { t.rs = 2; t.rf = 0; sfx.lash(); }
  } else if (t.rs === 2) {
    if (t.rf >= Rc.ext + Rc.hold) { t.rs = 3; t.rf = 0; }
  } else if (t.rf >= Rc.back) { t.rs = 0; t.rf = 0; }
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
      p.hp -= s.dmg * shotCrit(s);
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
    b.hp -= s.dmg * shotCrit(s);
    b.fl = 3;
    if (s.k !== 'rig') { if (pk('ignite')) b.burn = Math.max(b.burn || 0, 90 * pk('ignite')); if (pk('corrode')) b.acid = Math.max(b.acid || 0, 160 * pk('corrode')); }
    for (let k = 0; k < 3; k++) drop(s.x, s.y, rr(-2.5, -.3), rr(-1.4, 1.4), 1.5, R() < .6 ? 3 : 0, 90);
    sfx.hit();
    if (b.hp <= 0) bossDies(b);
    return true;
  }
  return false;
}
/** crit roll for boss hits: bolts and ARC only (perk spores/mirrors/ribs never crit, same as on meat) */
function shotCrit(s) {
  return (s.k === 'bolt' && !s.spore && !s.mirror && !s.rib) || s.k === 'laser' ? critMul(s.x, s.y) : 1;
}
/** IMMOLATION / CORROSIVE SPIT on the exposed core: same per-frame rates as on meat. ORBITING TEETH chew plates then core */
function bossDots(b) {
  if (b.dying || b.enter) return;
  const platesUp = b.plates.some(p => p.hp > 0);
  if (!platesUp) {
    if (b.burn > 0) { b.burn--; b.hp -= .05; if (R() < .5) spark(b.x + rr(-20, 20), b.y + rr(-20, 10), rr(-.4, .4), -rr(.5, 1.6), ri(8, 16), pick(FIRE)); }
    if (b.acid > 0) { b.acid--; b.hp -= .02 * (1 + pk('corrode')); }
  }
  if ($.P.alive && pk('teeth') && b.t % 15 === 0) {
    const d = .5 * (1 + .1 * pk('dmg'));
    for (const t of perkFX.teeth || []) {
      const pl = b.plates.find(p => p.hp > 0 && dist2(t.x, t.y, b.x + Math.cos(p.a) * 42, b.y + Math.sin(p.a) * 42) < 17 * 17);
      if (pl) { pl.hp -= d; pl.f = 3; }
      else if (!platesUp && dist2(t.x, t.y, b.x, b.y) < 30 * 30) { b.hp -= d; b.fl = 3; }
      else continue;
      spark(t.x, t.y, rr(-2, 2), rr(-2, 2), 8, '#f0e2c0');
    }
  }
  if (b.hp <= 0) bossDies(b);
}
function bossDies(b) {
  if (b.dying) return;
  {
    {
      b.dying = 220;
      $.G.hitstop = 24;
      if (b.g3) { // long4: nothing keeps reaching or firing through the death throes (short keeps today's frame)
        b.laser = null;
        for (const t of b.tent) { t.rs = 0; t.rf = 0; }
      }
      if (!b.timed) { // a self-destruct (C23) pays no bounty
        $.G.score += 30000 * ($.G.loop + 1);
        pop(b.x, b.y - 40, '+' + 30000 * ($.G.loop + 1), '#ffffff', 16, 120);
      }
      sfx.roar();
      for (const e of enemies) if (!e.dead) killEnemy(e, -1);
    }
  }
}

// ---------------- mutations: you become what you kill ----------------
