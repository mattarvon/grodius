// @ts-nocheck
import { $ } from './state';
import { pk, perkTick, lastGasp, ribShards, twitchB } from './perks';
import { ECON, bankBio, econId } from './economy';
import { PH, R, TAU, W, clamp, lerp, ri, rr } from './core';
import { SET, lv } from './save';
import { sfx } from './audio';
import { buzz } from './platform';
import { I, touch } from './input';
import { ceilAt, floorAt, shots } from './world';
import { solidAt } from './solids';
import { flash, pop, spark } from './fx/spawn';
import { feedAfter, killPlayer, respawn } from './flow';
import { POD, hurt, podType } from './enemies/update';
import { dmMul, gmL, gunDm, sporeBurst } from './mutations';
import { gunTier, smoke } from './fx/gunfx';
import { SURV, hardOn, wardCapOf } from './death';

// ---------------- player ----------------
export const SLOTS = ['THRUST', 'MISSILE', 'SPLIT', 'ARC', 'PYRE', 'WRAITH', 'WARD'];
// progression: each level costs fragments (pods of that type); seals broken by mini-bosses raise the level ceiling
export const SMAX = [5, 2, 1, 1, 2, 3, 3];
/** WARD membrane soaks this many hits (was 10) */
export const WARD_MAX = 3;
/** the most hits WARD holds right now: its level (1/2/3) on long4, WARD_MAX elsewhere (DIFFICULTY-SPEC §2.1 "WARD
 *  level-up": every refill and top-up caps here). Gates H1 / H2 */
export const wardCap = () => wardCapOf($.P, hardOn(), WARD_MAX);
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
/** long4 (tune-tc, gate E3): is every slot at its seal-0 cap? The gun and side pairs count as one slot each (either
 *  form held at its cap); WARD counts its level, not its hits. Pure read of $.P / $.G */
function atCeiling() {
  const P = $.P;
  return P.speed >= capLv(0) && ((P.double && P.double >= capLv(2)) || (P.laser && P.laser >= capLv(3)))
    && ((P.missile && P.missile >= capLv(1)) || (P.pyre && P.pyre >= capLv(4))) && P.options >= capLv(5) && (P.wardLv || 0) >= capLv(6);
}
/** SEAL PRIMING (long4 only, seal 0 only; tune-tc, gate E3 "K1 before biome B's first WARNING + 30 s"). Once the ship
 *  holds the whole seal-0 kit (K0), a pod of a sealed slot the ship already flies (THRUST, its MISSILE, WRAITH, WARD)
 *  is stored toward that slot's next level instead of turning into nothing. When the seal breaks at the stage-2 tally
 *  the stored parts grow in, all at once under one banner (settlePrimes). ARC and PYRE are never primed: they
 *  would swap out the held form, and a primed swap ate biome B's pods (it1: K1 at 443 s on seed 1, the kit SPLIT ->
 *  ARC and MISSILE -> PYRE). Why: K1 costs 9 fragments past K0 (economy spec §1) and every one had to come from biome
 *  B's ~5 pods before its WARNING + 30 s, spread over 6 pod types, so K1 never completed (W6 gates: 0/5 seeds), while
 *  biome A's 8-11 pods were all wasted at K0. A death drops the stored parts (resetPlayer clears P.frag). Off in meter
 *  mode (its POWER buys whole levels) and on short / long5, so they are unchanged */
export const PRIME = {
  /** pods short of the next level a primed slot stops at (0: the whole level is stored) */
  short: 0,
  /** the seal priming works under (0: toward K1 only; a later seal keeps today's dead pods) */
  seal: 0,
} as const;
/** the slots priming may store into: THRUST, MISSILE while it is the held side gun, WRAITH, WARD */
const primeSlot = (i) => i === 0 || i === 5 || i === 6 || (i === 1 && $.P.missile > 0);
export function primeOk(i) {
  if (!hardOn() || SET.meter || (($.G && $.G.seal) || 0) !== PRIME.seal || !primeSlot(i) || !slotLocked(i) || !atCeiling()) return false;
  return (($.P.frag && $.P.frag[i]) || 0) < needOf(i) - PRIME.short;
}
/** set while settlePrimes grows the stored levels in: applyPower then skips its per-level pop and feed (one combined
 *  banner says it instead: ux-designer, 4 banners in 160 f could not be read) */
let quiet = false;
/** after the seal breaks: every slot whose stored parts fill its next level takes it, all on one frame, under one
 *  banner. A stored MISSILE level the ship no longer flies (it took PYRE since) is dropped, never shown as 2/1 */
function settlePrimes() {
  const P = $.P, G = $.G;
  if (!P.frag || !hardOn() || (G.seal || 0) <= PRIME.seal) return;
  if (P.frag[1] && !P.missile) P.frag[1] = 0;
  let names = null;
  for (const i of [0, 1, 5, 6]) if ((P.frag[i] || 0) >= needOf(i) && slotLv(i) < capLv(i) && primeSlot(i)) {
    P.frag[i] = needOf(i) - 1;
    quiet = true;
    applyPower(i, false);
    quiet = false;
    (names ||= []).push(powerText(i)[2]);
  }
  if (names) {
    pop(P.x, P.y - 16, 'STORED PARTS GROW IN', '#ffe2a0', 9, 70);
    feedAfter({ s: 'STORED PARTS GROW IN', d: names.join(' // '), t: 180, ml: 180 });
  }
}
/** K0 (spec §2.2) per slot at seal 0: THRUST, MISSILE or PYRE, SPLIT or ARC, WRAITH and WARD at their seal-0 caps. The
 *  first slot still short of it, in R1's order (THRUST, main gun, side gun) then R2's (WRAITH, WARD); -1 once K0 is held.
 *  A missing gun form is SPLIT, a missing side gun MISSILE (K0's forms). Pure read of $.P / $.G */
export function k0Gap() {
  const P = $.P;
  if ((P.speed || 0) < capLv(0)) return 0;
  if (!P.double && !P.laser) return 2;
  if (!P.missile && !P.pyre) return 1;
  if ((P.options || 0) < capLv(5)) return 5;
  if ((P.wardLv || 0) < capLv(6)) return 6;
  return -1;
}
/** is slot i (a pod's type) already at its K0 level? The gun and side pairs count as one slot each */
function k0Held(i) {
  const P = $.P;
  if (i === 2 || i === 3) return !!(P.double || P.laser);
  if (i === 1 || i === 4) return !!(P.missile || P.pyre);
  return slotLv(i) >= capLv(i);
}
export function slotMaxed(i) {
  const l = slotLv(i);
  if (i === 6) return l >= capLv(6) && $.P.shield >= wardCap() && !primeOk(6);
  return l >= capLv(i) && !primeOk(i);
}
export function applyPower(i, full) {
  if (i == null || i < 0 || !$.P.alive) return;
  // long4, seal 0 (tune-tc, gate E2 K0 in Orbit): a pod rolled for a slot that filled before it was taken (the Saucer's
  // and the Maw's pairs drop together and roll the same state; updateCaps re-rolls a full slot only every 60 f) is
  // re-rolled as it is taken, so it is never wasted while K0 still has room. One R() (podType), maxed pods only. Seal 0
  // only: from seal 1 ARC and PYRE stay open beside SPLIT / MISSILE, and a re-roll there would swap the held gun form
  // (economy-designer); past K0 a full pod is SURPLUS, as Gradius pays it. A non-FULL recovery pod (c.rec) is re-rolled
  // here too, which is the point (it would otherwise be wasted), though shots.ts updateCaps never re-rolls one in flight
  // W6 round 3, K0 FIRST (gate E2 "K0 at the Orbit tally, 5 of 5"): while the ship is short of K0 at seal 0, a pod for a
  // slot already at its K0 level, WARD included whatever its hits, becomes the first missing K0 slot (k0Gap: THRUST, the
  // main gun, the side gun, WRAITH, WARD), deterministically, with no R(). Spec §2.2 counts Orbit's fixed pods as K0's
  // guarantee; tc's random re-roll (podType) still let a duplicate WARD pod top the shield up instead (W6 round 2: seed
  // 11 reached the Orbit tally at THRUST 1 after three WARD pods). Past K0 the old re-roll stands
  if (hardOn() && !full && !SET.meter && (($.G && $.G.seal) || 0) === PRIME.seal) {
    const g = k0Gap();
    if (g >= 0 && g !== i && (k0Held(i) || slotMaxed(i))) return applyPower(g, false);
    if (g < 0 && slotMaxed(i)) {
      const n = podType();
      if (n >= 0) return applyPower(n, false);
    }
  }
  if (i === 6 && slotLv(6) >= capLv(6) && $.P.shield < wardCap()) {
    const h = ECON[econId()].hard; // D63 long4: +wardTop hits, not a refill, and never past the WARD level (W2)
    $.P.shield = h ? Math.min(wardCap(), Math.floor($.P.shield) + h.wardTop) : WARD_MAX;
    if ($.P.wardLv >= 3) $.P.aegis = 12;
    sfx.shield();
    buzz('light');
    pop($.P.x, $.P.y - 14, h ? 'WARD +' + h.wardTop : 'WARD RESTORED', POD[6].h, 8, 40);
    return;
  }
  if (primeOk(i)) {
    // SEAL PRIMING: stored toward the sealed level, up to PRIME.short pods short of it (0: the whole level; a FULL pod
    // stores it at once). The pop says STORED, so a full count is not read as a level that failed to arrive
    $.P.frag = $.P.frag || [];
    const nd = needOf(i), f = full ? nd - PRIME.short : Math.min(nd - PRIME.short, ($.P.frag[i] || 0) + 1);
    $.P.frag[i] = f;
    $.G.slotF = $.G.slotF || [];
    $.G.slotF[i] = 20;
    sfx.pick();
    pop($.P.x, $.P.y - 14, SLOTS[i] + ' ' + f + '/' + nd + ' STORED', POD[i].h, 8, 40);
    for (let k = 0; k < 5; k++) spark($.P.x, $.P.y, rr(-2, 2), rr(-2, 2), 10, POD[i].h);
    return;
  }
  if (slotMaxed(i)) {
    $.G.score += 1500;
    bankBio(5, $.G, $.meta);
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
    const c0 = wardCap();
    $.P.wardLv = Math.min(3, ($.P.wardLv || 0) + 1);
    // long4 (Matt, decision 18, gate H2): a level-up raises the capacity and adds the new level's hit, but does NOT refill
    // the hits already lost (WARD 1 with 0 left -> WARD 2 with 1). Elsewhere (short) a refill to WARD_MAX, as before
    // (no floor: a graze-drained shield, shots.ts .34, keeps its part and gains the whole new hit; economy-designer)
    $.P.shield = hardOn() ? Math.min(wardCap(), ($.P.shield || 0) + Math.max(0, wardCap() - c0)) : wardCap();
    if ($.P.wardLv >= 3) $.P.aegis = 12;
  }
  $.G.slotF = $.G.slotF || [];
  $.G.slotF[i] = 40;
  sfx.power();
  {
    // POWER readout: say what just changed, in plain terms
    const [s, d, short] = powerText(i);
    if (!quiet) {
      pop($.P.x, $.P.y - 16, short, POD[i].h, 9, 60);
      $.G.feed = { s, d, t: 150, ml: 150 };
    }
  }
  flash($.P.x, $.P.y, 40, 10, POD[i].c);
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * TAU;
    spark($.P.x, $.P.y, Math.cos(a) * 2.4, Math.sin(a) * 2.4, 14, POD[i].h);
  }
}
// ---- classic Gradius meter (SET.meter): each POWER capsule moves the cursor one slot, POWER buys a full level ----
export function meterAdvance() {
  const G = $.G;
  G.cur = ((G.cur ?? -1) + 1) % SLOTS.length;
  G.slotF = G.slotF || [];
  G.slotF[G.cur] = 14;
  sfx.pick();
  const i = G.cur;
  pop($.P.x, $.P.y - 14, slotMaxed(i) ? SLOTS[i] + (slotLocked(i) ? ' SEALED' : ' MAX') : '> ' + SLOTS[i], slotMaxed(i) ? '#6d7a88' : POD[i].h, 8, 36);
}
export function meterBuy() {
  const G = $.G, i = G.cur;
  if (i == null || i < 0) return;
  if (slotMaxed(i)) {
    sfx.deny();
    pop($.P.x, $.P.y - 14, slotLocked(i) ? 'SEALED' : 'MAXED', '#8a5a5a', 8, 36);
    return;
  }
  G.cur = -1;
  applyPower(i, true);
}
/** [feed title, feed detail, pop over the ship] for a pod level-up */
export function powerText(i) {
  const P = $.P;
  switch (i) {
    case 0: return ['THRUST ' + P.speed, `ship speed +${Math.round(P.speed * .42 / 1.25 * 100)}%`, 'THRUST ' + P.speed + ': FASTER'];
    case 1: return P.missile > 1 ? ['MISSILE II // TWIN SALVO', 'up + down rockets, 40% faster reload, +20% blast', 'MISSILE II: TWIN SALVO'] : ['MISSILE // GROUND ROCKETS', 'splash rockets ride the floor', 'MISSILE: ROCKETS'];
    case 2: return ['SPLIT // 3-WAY FAN', 'three rounds per shot, fanned wide', 'SPLIT: 3-WAY FAN'];
    case 3: return ['ARC // PIERCING BEAM', `x${gun().arc} damage, burns through every body in line`, 'ARC: PIERCING BEAM'];
    case 4: return P.pyre > 1 ? ['PYRE II // EYE STORM', 'every gunner lobs, 50% faster', 'PYRE II: EYE STORM'] : ['PYRE // FLAMING EYES', 'lobbed eyes burst and set meat burning', 'PYRE: FIRE EYES'];
    case 5: return ['WRAITH ' + P.options + ' // +1 GUNNER', `${P.options + 1} guns firing, +${50 * P.options}% damage`, `WRAITH: ${P.options + 1} GUNS`];
    default: {
      const n = ['', 'MEMBRANE', 'MIRROR', 'BONE AEGIS'][P.wardLv], h = wardCap(), k = Math.ceil(P.shield || 0);
      // long4 (decision 18): a level-up no longer refills, so say what it holds when it is not full (game/economy-designer)
      const hs = (h === 1 ? '1 hit' : h + ' hits') + (hardOn() && k < h ? ` (${k} held)` : '');
      return ['WARD // ' + n, ['', `soaks ${hs}`, `soaks ${hs}, reflects bullets`, `soaks ${hs}, reflects, bone shield ahead`][P.wardLv], n];
    }
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
    $.P.inv = Math.round((hardOn() ? SURV.wardInv : 18) * (1 + .5 * pk('inv'))); // C20: 40 f on long4, no chain hits
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
export { dmMul }; // lives in src/mutations.ts next to gunDm(); re-exported for existing importers
/** SNOT ROCKET glob base damage, before gunDm() (it pierces 8, so it's worth ~4 bolts per enemy in line) */
export const SNOT_DMG = 4;
/** the SNOT ROCKET glob: scales like the main gun, so it keeps its share of the damage as depth HP grows */
export const snotGlob = (x, y) => ({ k: 'bolt', x: x + 10, y, vx: 4.2, vy: 0, dmg: SNOT_DMG * gunDm(), r: 5, pierce: 8, glob: 1, t: 0 });
// ---- weapon numbers (tuned with tools/dps-probe.mjs: every pickup is a felt jump, not a rounding error) ----
/** SPLIT fan: [angle (rad), damage share]. 3-way spread: the core plus two flankers that sweep the screen. A long4 run
 *  reads the flankers' share from GUN_L4.flank instead (decision 23) */
const FAN = [[0, 1], [-.2, .8], [.2, .8]];
/** WRAITH gunners hit at half weight: +50% / +33% / +25% per wraith instead of x2/x3/x4 (keeps the top end sane) */
const WR = .5;
/** the gun numbers a long4 run fires (tune-tc, gate E4: the strongest LEGAL MAX D1 kit <= 50 single-target dps). At
 *  today's numbers the four K1 variants measured 47 / 63 / 63 / 81 (SPLIT+MSL2 / SPLIT+PYRE1 / ARC+MSL2 / ARC+PYRE1,
 *  tools/dps-probe.mjs): ARC out-hit SPLIT 1.33x on one target and PYRE I alone out-hit the main gun (2.3x bare
 *  against MISSILE II's 1.0x, for 2 fragments against 3), and the perk / graft stack multiplied both. short and long5
 *  read GUN_TODAY, so they are unchanged */
const GUN_TODAY = { arc: 1.7, pyre: [0, 5, 5], flank: .8 };
/** long4 [FIT, dps-probe 6000 f]: ARC 1.3 (single target ~1.0x SPLIT; ARC keeps the pierce, SPLIT the spread) and a
 *  PYRE eye of .6 at level 1 (its burn, shots.ts pyreBoom, is most of PYRE I now: 12.5 ONE / 8.9 WALL, level with
 *  MISSILE II's 8.8 WALL); PYRE II keeps today's 5 (seal 2, Descent 2 on, outside E4). With SERRATION 1.06 (economy.ts) LEGAL MAX D1 reads
 *  41.7 / 46.5 / 42.7 / 47.4.
 *  flank: SPLIT's two flankers [FIT, decision 23 (2026-11-23), gate E4 WALL <= 140 (20x bare) on the flat-arena rig]:
 *  at today's .8 SPLIT+MSL2 read WALL 150 (r3-econ); the flankers carry the whole-screen sweep, the core the single
 *  target, so trimming them cuts WALL and leaves ONE alone. dps-probe 6000 f, SPLIT+MSL2 WALL / ONE: .70 145.2 / 43.0,
 *  .65 140.7 / 43.2 (over, by noise-sized margins: a second run read 141.0), .60 137.5 / 43.3. The other K1 variants
 *  stay under 111 */
const GUN_L4 = { arc: 1.3, pyre: [0, .6, 5], flank: .6 };
const gun = () => (hardOn() ? GUN_L4 : GUN_TODAY);
export function fire() {
  const cal = gmL('cal'),
    serr = gmL('serr'),
    dm = gunDm(), // geometric: every graft level is a +22-25% step, not a shrinking one (src/mutations.ts)
    rem = Math.max(-1, Math.min(0, $.P.cd || 0)),
    rp = gmL('rapid'),
    tier = gunTier(),
    rate = 1.25 ** rp * (1 + twitchB(pk('rof'))),
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
        dmg: gun().arc * dm * (j ? WR : 1),
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
        const fl = gun().flank; // .8 on short (FAN's own share, so the same doubles), GUN_L4.flank on long4
        for (const [a, f] of FAN) B(o.x + 10, o.y, Math.cos(a) * 7.5, Math.sin(a) * 7.5, { dmg: dm * (a ? fl : f) * (j ? WR : 1), fan: 1, wr: j > 0 });
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
      dmg: gun().pyre[Math.min(2, $.P.pyre)] * dm * (j ? WR : 1),
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
  settlePrimes();
  if ($.P.slow > 0) $.P.slow--;
  if (pk('glass') && $.P.shield > 1) $.P.shield = 1;
  perkTick(hurt);
  const sp = (1.25 + $.P.speed * .42) * (1 + .08 * pk('spd')) * ($.P.slow > 0 ? .45 : 1);
  // SNOT ROCKET: periodic piercing glob
  if (pk('snot') && $.state === 'play' && ($.G.t % (pk('snot') > 1 ? 150 : 240)) === 0) {
    shots.push(snotGlob($.P.x, $.P.y));
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
  const px0 = $.P.x, py0 = $.P.y;
  $.P.x = clamp($.P.x + mx, 10, W - 16);
  $.P.y = clamp($.P.y + my, 6, PH - 6);
  // DIFFICULTY-SPEC §2.1: the ship's displacement this frame, after the clamp, for W1's aimLead (state.ts PDiff). Read
  // from position only, never R(); not saved
  $.P.vx = $.P.x - px0;
  $.P.vy = $.P.y - py0;
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
      // REGROWTH: 1 hit back every 20s (lvl 1), up to 2 every 12s (lvl 2). long4 (W2, SYS lever 1): half as often
      // (40 s / 24 s) and never past max(1, WARD level). Gate H1
      const h = hardOn(),
        cap = h ? Math.min(SURV.regrowCap[L], Math.max(1, $.P.wardLv || 0)) : [0, 1, 2][L],
        per = h ? SURV.regrowPer[L] : [0, 1200, 720][L];
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
  if (SET.meter && I.power) meterBuy();
  spark($.P.x - 13, $.P.y + rr(-1, 1), -rr(1, 2.6), rr(-.2, .2), ri(6, 12), R() < .5 ? '#ffd0a0' : '#ff5a20');
  if ($.P.inv <= 0) for (const [ox, oy] of [[12, 0], [-9, -4], [-9, 4], [0, -4], [0, 4]]) {
    const wx = $.P.x + ox + $.G.scroll,
      y = $.P.y + oy;
    // a moving solid (src/solids.ts) is terrain: it kills through WARD (decision 5A). A stub until W3: never true
    if (y >= floorAt(wx) || y <= ceilAt(wx) || solidAt(wx, y)) {
      if (lastGasp()) return;
      killPlayer();
      return;
    }
  }
}

// ---------------- shots / collisions ----------------
