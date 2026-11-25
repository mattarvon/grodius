// @ts-nocheck
import { $ } from '../state';
import { PH, R, TAU, W, clamp, pick, ri, rr } from '../core';
import { sfx } from '../audio';
import { ceilAt, enemies, eshots, floorAt } from '../world';
import { startBoss } from '../boss/update';
// DO NOT REMOVE: unused here, but this import loads the midboss kinds and fixes the spawn <-> ufo ESM init order. The
// harness runs the dev server, not the bundle, so a removal that breaks the built game would pass every gate.
import './mid';
import { MID_ET, MID_SIM } from './mid/roster';
import { depthHP, midLateMul } from '../depth';
import { BUL, ENTRY, KNOT, aimLeadA, clearOfShip, flayHunts, laneX, leadOf, revChanceOf, volleyFits, knotLane } from '../notice';
import { TIER, capRate } from '../tier'; // the tier's faucet multiplier at the two pod rolls (W0)
import { bsMul, revChance as revChanceT } from '../rank';
import { firstShot } from './cadence'; // D62: the Drive's first-shot range
import { fillerQuiet, meetMid, midHpMul } from '../midslot';
import { bandClamp } from '../terrainb';
import { ECON, capKept, econId, formExtra, noticeOf, rebuildMul } from '../economy';
import { kindOf } from '../layout';
// the W0 adapter (rank, tier, the cap context): one module, enemies/g3.ts
import { REC_TY, cadMulOf, capOf, g3, rankOf, rhoOf, tierOf } from './g3';
export { cadMulOf, capCls, capOf, g3, rankOf, rhoOf, tierOf } from './g3';

// ---------------- enemies ----------------
// the midbosses' rows come from their own files (enemies/mid/): MID_ET is this same object
export const ET = Object.assign(MID_ET, {
  drone: {
    hp: 1,
    r: 7,
    gsz: 1,
    score: 100,
    bio: 2
  },
  corpse: {
    hp: 5,
    r: 9,
    gsz: 1.6,
    score: 300,
    bio: 5,
    half: 1,
    eyes: 2,
    teeth: 3
  },
  eye: {
    hp: 7,
    r: 8,
    gsz: 1.4,
    score: 400,
    bio: 6,
    eyes: 1
  },
  crawler: {
    hp: 6,
    r: 8,
    gsz: 1.5,
    score: 350,
    bio: 6,
    teeth: 4
  },
  hatch: {
    hp: 1,
    r: 5,
    gsz: .7,
    score: 80,
    bio: 1
  },
  doll: { hp: 1, r: 6, gsz: .8, score: 120, bio: 1, dry: 1 }, // MINI DOLL HEADS (enemies/doll.ts): vinyl, dry: no blood, no gore
  womb: {
    hp: 14,
    r: 12,
    gsz: 2.4,
    score: 900,
    bio: 14,
    half: 1,
    amnio: 1
  },
  cross: {
    hp: 12,
    r: 10,
    gsz: 2.2,
    score: 800,
    bio: 10,
    skull: 2,
    limbs: 2,
    eyes: 1,
    teeth: 4
  },
  hook: {
    hp: 7,
    r: 8,
    gsz: 1.8,
    score: 450,
    bio: 7,
    limbs: 2,
    eyes: 1,
    teeth: 3
  },
  flayer: {
    hp: 16,
    r: 9,
    gsz: 2.4,
    score: 1100,
    bio: 12,
    skull: 1,
    teeth: 6,
    eyes: 2
  },
  maw: {
    hp: 120,
    r: 24,
    gsz: 4,
    score: 6000,
    bio: 70,
    half: 1,
    eyes: 6,
    teeth: 16,
    big: 1,
    mini: 1
  },
  crux: {
    hp: 145,
    r: 20,
    gsz: 5,
    score: 15000,
    bio: 90,
    skull: 3,
    limbs: 4,
    eyes: 4,
    teeth: 12,
    big: 1,
    mini: 1
  },
  nailbar: {
    hp: 16,
    r: 9,
    gsz: 1,
    score: 800,
    bio: 4,
    teeth: 0,
    eyes: 0,
    skull: 0,
    limbs: 0
  },
  butcher: {
    hp: 300,
    r: 20,
    gsz: 5,
    score: 18000,
    bio: 110,
    skull: 2,
    limbs: 5,
    eyes: 8,
    teeth: 10,
    big: 1,
    mini: 1
  }
});
/** the G3 spawn-side body rule (§2.1 "Fairness", S5): an off-screen entrant never starts within BUL.noBody (48 px) of
 *  the ship, plus BUL.bodyPad for its first frame; a midboss, a boss, a part or a parent's child is placed by its owner.
 *  short: unchanged (parity) */
const bodyClear = (b, o) => g3() && $.P && $.P.alive && !b.mini && !b.big && !o.par && !o.kid;
export function mk(k, x, y, o = {}) {
  const b = ET[k],
    hm = 1 + .4 * $.G.loop;
  if (bodyClear(b, o)) [x, y] = clearOfShip(x, y, $.P.x, $.P.y, W, PH, BUL.noBody + BUL.bodyPad + Math.max(0, (b.r || 7) - 9)); // a big body (a knot, r 24) by its edge, not its centre (systems-designer)
  const e = {
    k,
    x,
    y,
    vx: 0,
    vy: 0,
    t: 0,
    flash: 0,
    rot: 0,
    dead: false,
    ...b,
    ...o
  };
  // HP no longer tracks rank: pressure lives in fire rate + spawn density (BS(), every(), formation()),
  // not in sponge toughness. Depth (depth.ts) still scales HP from Descent 2 on so fodder survives long enough to shoot.
  e.hp = b.hp * hm * (o.hpm || 1);
  // ...and from Descent 2 on, depth keeps it climbing past the rank cap (src/depth.ts; dm = 1 in Descent 1)
  e.dm = depthHP(k, b, o);
  // G3 popcorn rule (§2.3 roster, ENC E1, GR rule 5): a drone or hatchling dies to one main-gun hit at every power
  // level and tier; HP = base x (1 + .4 loop) only. Gate R2 (dps-probe: drone TTK 1 bolt at every kit)
  if ((POPCORN[k] || o.pop) && g3()) { e.dm = 1; e.hp = b.hp * hm * (o.hpm || 1); } // pop: a torn-off knot corpse (1 HP)
  e.hp *= e.dm;
  e.max = e.hp;
  // kid: born from a midboss, not scripted. rec: a recovery carrier, an economy object (out of the grade's spawned)
  if (!b.mini && !o.par && !o.kid && !o.rec && !o.split && $.G.st) $.G.st.spawned++; // split: torn off a knot (the knot counted)
  // D31: the entry's keep (economy.ts capKeep; short .35) x the tier's faucet (tier.ts capRate). A typed carrier (capTy: recovery waves) always keeps it, no draw
  if (e.cap && !e.mini && e.capTy == null && !capKept(econId(), R(), capRate() * rebuildMul(econId(), $.G, $.P))) e.cap = false;
  enemies.push(e);
  return e;
}
/** the popcorn kinds (one hit, at every power level: §2.3 roster) */
const POPCORN = { drone: 1, hatch: 1, doll: 1 };
/** bullet speed factor. short: today's pow curve. long4 (§2.1): x(1 + .02 rank) x min(1.3, 1 + .12 loop), never pow;
 *  eshoot() caps the result at V_CAP */
export const BS = () => g3() ? bsMul($) : Math.min(1.45, 1 + .12 * $.G.loop) * (1 + .35 * Math.min(2.0, $.G.pow || 0)); // long4: rank.ts bsMul

// ---------------- the bullet cap (§2.1 "Bullet caps"): counted shots, atomic volleys, the 64 px rule ----------------
/** counted shots: every eshots entry except a hazard (haz: KEEPSAKE's planted forks). The probe counts the same way */
export function countedShots() {
  let n = 0;
  for (let i = 0; i < eshots.length; i++) if (!eshots[i].haz) n++;
  return n;
}
/** an open volley's reserved slots (VQ.n, good for this frame only) and the frame a volley was last refused */
const VQ = { n: 0, t: -1, no: -1 };
/** reserve a volley of n shots spawned at (x, y): it fits under the cap of context cls (default: the current context;
 *  regular shooters pass 'scroll'), and (x, y) is at least 64 px from the ship. All of it or none (§2.1). True: the next
 *  n eshoot() calls this frame spawn without asking again. short: always true (no cap, no rule; parity) */
export function volley(n, x, y, cls) {
  if (!g3()) return true;
  const P = $.P, t = $.G.t;
  if ((P && P.alive && Math.hypot(P.x - x, P.y - y) < BUL.noShot) || eshots.length + n > BUL.backstop || !volleyFits(countedShots(), n, capOf(cls))) {
    VQ.no = t;
    VQ.n = 0;
    return false;
  }
  VQ.n = n;
  VQ.t = t;
  return true;
}
/** close an open volley: slots a caller reserved and did not spend never leak to the next shot (systems-designer) */
export const endVolley = () => { VQ.n = 0; };
/** was a volley refused this frame (the shooter retries after min(remaining, 20 f): notice.ts retryIn) */
export const refused = () => VQ.no === $.G.t;
/** an enemy shot. Returns the shot, or null when it was refused (the cap, the 64 px rule, the 260 backstop). On long4
 *  every shot carries rev (0, or 1 for a revenge bullet: the probe's D3 signal) and its speed is capped at V_CAP.
 *  cls: the cap context to count against (a regular shooter passes 'scroll'). A shot inside an open volley() spawns
 *  without asking again */
export function eshoot(x, y, a, sp, k = 'orb', cls?) {
  if (eshots.length > BUL.backstop) return null;
  const on = g3();
  let v = sp * BS();
  if (on) {
    if (VQ.n > 0 && VQ.t === $.G.t) VQ.n--;
    else if (!volley(1, x, y, cls)) return null;
    else VQ.n = 0;
    v = Math.min(BUL.vcap[tierOf()], v);
  }
  const s = {
    x,
    y,
    vx: Math.cos(a) * v,
    vy: Math.sin(a) * v,
    r: k === 'glob' ? 3 : k === 'spike' ? 4 : 2,
    k,
    t: 0,
    rev: REV.on // D3 probe signal on every shot: 1 on a revenge shot (revShot / revRing), else 0 (W0 contract)
  };
  eshots.push(s);
  k === 'glob' ? sfx.glob() : sfx.eshot();
  return s;
}
/** set while revenge bullets spawn, so eshoot() flags them (rev: 1) */
const REV = { on: 0 };
/** a regular shooter's aimed shot (D63's BRUTAL fan is gone: §2.1 deletes every BRUTAL lever) */
export function shootB(x, y, a, sp, k = 'orb', cls?) {
  return eshoot(x, y, a, sp, k, cls);
}
/** the lead angle from (x, y) for a shot of base speed sp (§2.1 aim lead, C8): L = .2 + .6 rho, from the ship's last-frame
 *  displacement (P.vx, P.vy: W0 stores them after the move; 0 until then, which is exact aim). short: exact aim */
export function aimLead(x, y, sp) {
  const P = $.P;
  if (!g3()) return aimA(x, y);
  const v = Math.min(BUL.vcap[tierOf()], sp * BS());
  return aimLeadA(x, y, P.x, P.y, P.vx || 0, P.vy || 0, v, leadOf(rhoOf()));
}
/** a regular shooter's led single shot, counted against the scroll cap (§2.1): the shot, or null when refused */
export const aimShot = (x, y, sp, k = 'orb') => eshoot(x, y, aimLead(x, y, sp), sp, k, 'scroll');
/** a revenge bullet (§2.1): one unled orb at .8 x v_kind from (x, y), counted against the scroll cap, skipped within
 *  64 px of the ship or when the cap is full (no retry: it was the enemy's last act) */
export function revShot(x, y, v) {
  if (!$.P || !$.P.alive) return null;
  REV.on = 1;
  const s = eshoot(x, y, aimA(x, y), BUL.revV * v, 'orb', 'scroll');
  REV.on = 0;
  return s;
}
/** a large enemy's revenge ring (Hard and Very Hard, Descent 2+: §2.1): 6 orbs, atomic */
export function revRing(x, y, v) {
  if (!$.P || !$.P.alive || !volley(BUL.revRing, x, y, 'scroll')) return false;
  REV.on = 1;
  for (let i = 0; i < BUL.revRing; i++) eshoot(x, y, aimA(x, y) + i * TAU / BUL.revRing, BUL.revV * v, 'orb', 'scroll');
  REV.on = 0;
  endVolley();
  return true;
}
/** the revenge chance at the current tier and descent (rank.ts revChance(tier, loop)); 0: draw nothing */
export const revChance = () => (g3() ? revChanceT(tierOf(), $.G.loop || 0) : 0);
export const aimA = (x, y) => Math.atan2($.P.y - y, $.P.x - x),
  wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
export const onScreen = e => e.x > -10 && e.x < W - 6;
/** a rear wave's lane: the ship's height when it is called (D61 Pass 1, "it notices you"; src/notice.ts). It used to
 *  flip the wave 60 px clear of the ship, which made the back half of the screen a sanctuary. The scripted y is the
 *  fallback with no ship. The 100 f warning (rearWarn) and the caller's terrain fit still apply */
export function rearLane(y) {
  return $.P ? $.P.y : y;
}
export function rearWarn(y, f) {
  $.G.warn.push({
    y,
    t: 100,
    ml: 100
  });
  sfx.tele();
  $.G.pend.push({
    t: 100,
    f
  });
}
/** a rear drone wave at the ship's height, telegraphed 100 f ahead. The lane is picked once, at the telegraph, so the
 *  warning tells the truth and the ship has its 100 f to step off it (D59's tell rule). fit: a lane filter (biomes.ts
 *  rearY keeps a set piece's wave out of the terrain); it runs again at fire time because the terrain has scrolled by
 *  then. Default identity: every other caller */
export function behindWave(y, n = 5, o = {}, fit = (v) => v) {
  y = fit(rearLane(y));
  rearWarn(y, () => formation('behind', fit(y), n, o));
}
/** extra drones a power-scaled formation gets (density is where power shows, D1): the entry's round(k * min(cap, pow)),
 *  economy.ts form. short: round(3 * min(2, pow)), 0..6. long4 (D58 #3, Matt: break the snowball): round(2 * min(1, pow)),
 *  0..2, and those drones pay half XP and no pod or biomass (enemies/update.ts killEnemy, e.extra) */
export const formationExtra = () => formExtra(econId(), $.G.pow || 0);
/** formation() options (DIFFICULTY-SPEC §5.6 contract; W1 / W2 / W3 code against it). Documentation: this file is
 *  @ts-nocheck, so tsc does not enforce it. Any other field goes to every drone's mk() (hpm, ghost, ...).
 *  - fixed: spawn exactly n (no formationExtra): a scripted set piece whose layout must hold. It does
 *    NOT mean "an opening carrier": that is `open`
 *  - pod: the group always drops its pod with no keep roll (the biome breath's release, D31)
 *  - open: an authored opening carrier (spec §2.2): the last kill always drops, no keep roll, red sac art. Stored as
 *    group.open = 1 (pod-probe tags its pods `fixed:open`; gate E2 counts them). W0: recorded only; W1 wires the drop
 *  - rec: a recovery wave (C17): 1 HP, unarmed, harmless to touch, out of hits/min, the cap and the grade's spawned.
 *    Stored as group.rec = 1 (pod-probe tags `rec`). W0: recorded only; W1's recoveryWave sets it
 *  - pat: overrides the pattern argument (W1's 'drop' / 'rise' / 'loop' entries go through either)
 *  - shooter: designated shooters (C6): 1 = the leader (member 0), 2 = also the last member (rank >= 14). Stored as
 *    group.shooter. W0: recorded only; W1 marks the members and gives them their 12 f tell */
export interface FormOpts { fixed?: boolean | 1; pod?: boolean | 1; open?: boolean | 1; rec?: boolean | 1; pat?: string; shooter?: 0 | 1 | 2; [k: string]: unknown }
/** a drone wave of n (+ formationExtra()); o: FormOpts above */
export function formation(pat, y, n = 5, o: FormOpts = {}) {
  // pod: the group always drops its pod (the biome breath's release, D31). open: an authored opening carrier (§2.2
  // faucet: the last kill always drops, no keep roll, never rank extras; pod-probe's `fixed:open` tag reads group.open).
  // rec: a recovery wave (recoveryWave below). v: drop / rise's vertical speed (the teaching beat flies ENTRY.vTeach)
  const { fixed, pod, open, rec, shooter, pat: pat2, v, ...mo } = o;
  if (pat2) pat = pat2;
  const n0 = n, tag = ECON[econId()].form.extra, on = g3(); // D58 #3: mark the rank drones (long4); short marks none
  if (!fixed && !open && !rec) n += formationExtra(); // denser waves as you power up (short: uncapped past rank 1 so Infirmary buys still add bodies; long4: economy.ts form)
  const g = {
    n,
    killed: 0
  };
  if (pod || open) g.pod = 1;
  if (open) g.open = 1;
  if (rec) g.rec = 1;
  const edge = pat === 'drop' || pat === 'rise';
  // drop / rise: y is the lane x (laneX, picked at the tell); they level off on the ship's half (ENTRY.yHi / yLo)
  const yt = edge ? PH * ($.P && $.P.y > PH / 2 ? ENTRY.yLo : ENTRY.yHi) : 0;
  if (shooter) g.shooter = shooter;
  // G3 (§2.1 "Fairness", S5): the whole formation moves out along its entry edge until no member starts within 48 px
  // (+ bodyPad) of the ship, so its spacing holds (mk() would push only the members on the ship). No R()
  const at = (i) => [pat === 'behind' ? -16 - i * 16 : edge ? Math.min(y, W - ENTRY.lanePad - (n - 1) * ENTRY.gap) + i * ENTRY.gap : W + 16 + i * 16,
    pat === 'drop' ? -16 - i * ENTRY.gap : pat === 'rise' ? PH + 16 + i * ENTRY.gap : y];
  let sx = 0, sy = 0;
  if (on && $.P && $.P.alive) for (let i = 0; i < n; i++) {
    const [ax, ay] = pat === 'wall' ? [W + 16, y + (i - (n - 1) / 2) * 15] : at(i), [cx, cy] = clearOfShip(ax, ay, $.P.x, $.P.y, W, PH, BUL.noBody + BUL.bodyPad);
    if (Math.abs(cx - ax) > Math.abs(sx)) sx = cx - ax;
    if (Math.abs(cy - ay) > Math.abs(sy)) sy = cy - ay;
  }
  for (let i = 0; i < n; i++) {
    const x0 = at(i)[0] + sx,
      y0 = at(i)[1] + sy;
    const e = mk('drone', x0, y0, {
      group: g,
      pat,
      i,
      y0,
      ghost: pat === 'behind' ? 60 + i * 9 : 0,
      ...mo
    });
    if (tag && i >= n0) { e.extra = 1; e.cap = false; } // after mk(): its keep roll (if any) is still drawn, so R() counts hold
    if (pat === 'wall') {
      e.x = W + 16 + sx;
      e.y = y + (i - (n - 1) / 2) * 15;
      e.y0 = e.y;
    }
    if (edge) { e.yt = yt; e.dv = (pat === 'drop' ? 1 : -1) * (v || ENTRY.v); }
    if (on) {
      e.ent = pat === 'behind' ? 'left' : pat === 'drop' ? 'top' : pat === 'rise' ? 'bottom' : 'right';
      // (rec stays on the group, W0 contract: a recovery carrier is e.rec || e.group.rec everywhere it is read)
      // C6: the designated shooter is the leader, member 0 (W6 tune: it is the first in, so it tells within N3's 30 f
      // and before the statue reaches it; the last member waited 16 px x n behind), marked by index, no R(); the last
      // scripted member (never a rank extra) shoots too at rank >= 14 (e.sh 2). A dive drone and a recovery carrier
      // never shoot (ENC roster)
      if (!rec && pat !== 'dive') { if (i === 0) e.sh = 1; else if (i === n0 - 1) e.sh = 2; }
    }
  }
  return g;
}
/** a drop or rise wave (§2.3, LVL §2.4): a 60 f chevron on the top or bottom edge at laneX = clamp(P.x + 110, 200,
 *  W - 40), picked at the tell so the tell tells the truth; then formation(pat, laneX, n, o). o.v: 1.2 in a teaching beat */
export function edgeWave(pat, n = 4, o = {}) {
  const x = Math.min(laneX($.P ? $.P.x : 60, W), W - ENTRY.lanePad - (n - 1) * ENTRY.gap); // the whole column under the chevron's reach (qa-lead)
  $.G.warn.push({ x, edge: pat === 'drop' ? 'top' : 'bottom', t: ENTRY.tell, ml: ENTRY.tell });
  sfx.tele();
  $.G.pend.push({ t: ENTRY.tell, f: () => formation(pat, x, n, o) });
}
/** a filler drone beat by entry edge (cellpick.ts droneEntry: the build stream's draw, never R()). y: the beat's lane */
export function entryWave(ent, y, n = 4) {
  if (ent.edge === 'behind') behindWave(y, Math.max(3, n - 1));
  else if (ent.edge === 'top') edgeWave('drop', n);
  else if (ent.edge === 'bottom') edgeWave('rise', n);
  else if (ent.edge === 'wall') {
    // no wall on screen at the lane: the other wall, and with neither the same edge's drop / rise (the beat never
    // vanishes, qa-lead). Round 4 (N4): it used to fall back to a right entry, which put biome A's walls on the right
    // edge (A read right 67%, wall 4% against 55 / 10). No R()
    const side = ent.pat === 'rise' ? 1 : -1;
    if (!wallBirth(n + 1, side, true) && !wallBirth(n + 1, -side, true)) edgeWave(side > 0 ? 'rise' : 'drop', n);
  }
  else formation(ent.pat, y, n);
}
/** a recovery wave (§2.1 recovery waves, C17; W2 queues G.recovery, stepRecovery below launches it): pods.length
 *  carriers in from the right at lane y (default the ship's height), spread +- 40 px, 1 HP, unarmed, harmless to touch (rec: 1; shots.ts skips rec bodies),
 *  outside the cap, hits/min and the grade's spawned. Each drops its own typed pod: a slot id (one fragment), or
 *  { ty, full: 1 } for a FULL pod (BLACK BOX). No R() for the types or the lanes */
export function recoveryWave(types, y0?) {
  const n = types ? types.length : 0;
  if (!n) return null;
  const py = clamp(y0 ?? ($.P ? $.P.y : PH / 2), 24 + BUL.recDy, PH - 24 - BUL.recDy);
  const g = { n, killed: 0, rec: 1 };
  for (let i = 0; i < n; i++) {
    const t = types[i], ty = REC_TY.swap(typeof t === 'number' ? t : t.ty), y = n > 1 ? py + BUL.recDy * (2 * i / (n - 1) - 1) : py;
    mk('drone', W + 16 + i * 22, y, { group: g, pat: 'sine', i, y0: y, rec: 1, cap: true, capTy: ty, capFull: typeof t === 'number' ? 0 : t.full ? 1 : 0 });
  }
  return g;
}
/** count down the queued recovery waves (G.recovery, state.ts RecoveryQ; W2 queues them on a respawn or a checkpoint
 *  restart) once a play step and launch each whose clock reaches 0, oldest first (queue order: pinned, since W1's
 *  carriers will draw R()). An entry queued with t <= 1 launches on the next step. Empty until W2: nothing runs */
export function stepRecovery() {
  const q = $.G.recovery;
  if (!q || !q.length) return;
  const n = q.length; // recoveryWave must not queue a wave itself (it would be compacted away): W2 queues, W1 launches
  for (let i = 0; i < n; i++) q[i].t--;
  let j = 0;
  for (let i = 0; i < n; i++) { const w = q[i]; if (w.t > 0) q[j++] = w; else recoveryWave(w.pods, w.y); } // no allocation
  q.length = j;
}
export function corpse(y, o = {}) {
  mk('corpse', W + 20, y, {
    vr: rr(-.03, .03),
    drift: rr(.15, .6),
    ph: R() * TAU,
    noLeg: R() < .4,
    noArm: R() < .3,
    cap: R() < .25,
    ...o
  });
}
export function eyeT(side) {
  const wx = $.G.scroll + W + 14;
  const y = side > 0 ? floorAt(wx) : ceilAt(wx);
  if (y > PH + 4 || y < -4) return;
  mk('eye', W + 14, y, {
    o: side,
    cool: ri(...first('eye', 40, 90)),
    veins: Array.from({
      length: 6
    }, () => [R() * TAU, rr(3, 6)]),
    blink: 0,
    cap: R() < .15
  });
}
export function crawler(side = 1) {
  const wx = $.G.scroll + W + 14,
    y = side > 0 ? floorAt(wx) : ceilAt(wx);
  if (y > PH + 4 || y < -4) return;
  mk('crawler', W + 14, y, {
    o: side,
    spd: rr(.4, .9),
    cool: ri(...first('crawler', 80, 140)),
    cap: R() < .3
  });
}
export function hatch(n, fromLeft, go) {
  if (fromLeft === 'top' || fromLeft === 'bottom') return wallBirth(n, fromLeft === 'top' ? -1 : 1);
  if (fromLeft && !go) {
    const py = $.P ? $.P.y : PH / 2,
      y = py < PH / 2 ? PH * .72 : PH * .28;
    rearWarn(y, () => hatch(n, true, 1));
    return;
  }
  for (let i = 0; i < n; i++) {
    let y = rr(30, PH - 30);
    if (fromLeft && $.P) for (let k = 0; k < 6 && Math.abs(y - $.P.y) < 45; k++) y = rr(30, PH - 30);
    const x = fromLeft ? -10 - i * 14 : W + 10 + i * 14, wx = $.G.scroll + x;
    y = bandClamp(y, wx, ceilAt(wx), floorAt(wx), 12); // inside a movement B band only, after the draws (short: no band, unchanged)
    mk('hatch', x, y, {
      fromLeft,
      ph: R() * TAU,
      ghost: fromLeft ? 55 + i * 8 : 0
    });
  }
}
/** "the wall gives birth" (§2.3, LVL §2.4): a 44 f bulge on the ceiling (side -1) or floor (+1) at laneX, then n
 *  hatchlings break out of it. Needs that wall edge on screen at laneX, the eyeT guard; skips quietly otherwise. The
 *  bulge rides the wall (its world x), and a hatchling that would be born within 48 px of the ship is not (S5) */
function wallBirth(n, side, wave = false) {
  const sx = laneX($.P ? $.P.x : 60, W), wx = $.G.scroll + sx, y = side > 0 ? floorAt(wx) : ceilAt(wx);
  if (y > PH + 4 || y < -4) return false;
  $.G.warn.push({ x: sx, wx, edge: side > 0 ? 'bottom' : 'top', birth: 1, t: ENTRY.birthTell, ml: ENTRY.birthTell });
  sfx.squish();
  $.G.pend.push({
    t: ENTRY.birthTell,
    f: () => {
      // wave: a filler drone beat born from the wall (entryWave) is a formation for the faucet, as the drone wave it
      // replaces: its last kill rolls the group pod (round 4: the wall births had taken E2's formation pods with them)
      const g = wave ? { n: 0, killed: 0 } : null;
      for (let i = 0; i < n; i++) {
        const w = wx + (i - (n - 1) / 2) * ENTRY.birthDx, x = w - $.G.scroll, wy = side > 0 ? floorAt(w) : ceilAt(w), yy = wy - side * 7;
        if (x < -8 || x > W + 8 || ($.P && Math.hypot($.P.x - x, $.P.y - yy) < BUL.noBody + (g3() ? BUL.kidPad : 0))) continue; // + the on-screen birth's reaction margin (long4)
        mk('hatch', x, yy, g ? { born: 1, ph: i * 1.7, vy: -side * 1.4, group: g } : { born: 1, ph: i * 1.7, vy: -side * 1.4 });
        if (g) g.n++;
      }
    }
  });
  return true;
}
export function womb() {
  const wx = $.G.scroll + W + 16,
    c = ceilAt(wx);
  if (c < -4) return;
  mk('womb', W + 16, c + 20, {
    st: 20,
    cool: ri(60, 100)
  });
}
export function maw(stageBoss = false) {
  $.G.mini = mk('maw', W + 40, PH / 2, {
    stageBoss,
    jaw: 0,
    eyesP: Array.from({
      length: 9
    }, () => ({
      a: rr(-1.2, 1.2),
      r: rr(8, 19),
      s: rr(1.6, 3),
      b: 0
    })),
    cap: 1,
    leave: 1700
  });
}
/** a held midboss (k = a kind in enemies/mid/roster.ts), in from the right edge. host = the biome it fights in;
 *  outside its home biome it is a crossover (enemies/midhost.ts: terrain-fitted y, host sparks and tint). leave = its
 *  leave clock in frames: the short layout's 1400, or the picker's slot clock (midpick.ts MID_CLOCK, spec §6.4) */
export function midboss(k, title, host?, leave = 1400) {
  const M = MID_SIM[k];
  if (!M) throw new Error(`midboss '${k}' is not registered (enemies/mid/${k}.ts defineMid)`);
  const e = mk(k, W + 50, PH * (M.spawnY ?? .5), { title, tx: W - 92, st: 'idle', wt: 0, cool: 110, att: 0, ba: -2.3, leave, host });
  // D27: long4's per-kind TTK band (midslot.ts MID_HP); 1 on short. D58 #4 (Matt, revising D27/D29): x LateSet.midLate in
  // biome slot B and later, re-banded to the power runs carry there; its parts (the Choir's nailbars, depthHP par.dm) too
  const lm = midLateMul(k), hm = midHpMul(k, ET[k].hp) * lm;
  if (lm !== 1) e.dm *= lm;
  if (hm !== 1) { e.hp *= hm; e.max = e.hp; }
  meetMid(k);
  if (M.onSpawn) M.onSpawn(e);
  $.G.mini = e;
}
export function crossT(side) {
  const wx = $.G.scroll + W + 16,
    sy = side > 0 ? floorAt(wx) : ceilAt(wx);
  if (sy > PH + 4 || sy < -4) return;
  mk('cross', W + 16, sy - side * 22, {
    o: side,
    cool: ri(...first('cross', 70, 130)),
    cap: R() < .3,
    noLeg: R() < .35
  });
}
export function hookE() {
  const wx = $.G.scroll + W + 16,
    c = Math.max(-10, ceilAt(wx)),
    room = floorAt(wx) - c;
  // len, sw, ph drawn first, in the object literal's old order, so the R() sequence is unchanged
  const len = rr(34, Math.max(40, room * .55)), sw = rr(.5, 1), ph = R() * TAU;
  // the anchor's ceiling is re-read at each shifted column (the update hangs it from ceilAt(ax): a sloped or inset
  // ceiling moves the body as the anchor moves), three passes at most; no R()
  let dx = 0, cA = c;
  for (let k = 0; k < 3; k++) { const s = hookClear(ax0Body(cA, len, sw, ph), dx); if (!s) break; dx += s; cA = Math.max(-10, ceilAt(wx + dx)); }
  const ax = W + 16 + dx;
  mk('hook', ax, cA + 30, {
    ax,
    ay: cA,
    len,
    sw,
    ph,
    noLeg: R() < .5,
    noArm: R() < .4,
    cap: R() < .2,
    twitch: 0,
    cut: R() < .5
  });
}
/** the hook's body on its first frame, relative to the anchor x: it hangs len below its (inset) ceiling anchor c and
 *  swings sin(ph) x sw x .55 rad (enemies/update.ts 'hook'), so it is not at (W + 16, c + 30) */
const ax0Body = (c, len, sw, ph) => { const a = Math.sin(ph) * sw * .55; return [W + 16 + Math.sin(a) * len, c + Math.cos(a) * len]; };
/** G3 S5 for a hook (round-4 integration; L5 fire,snot body-on-ship:hook): how far right the anchor moves so the swung
 *  body starts outside BUL.noBody + bodyPad (+ its radius past 9) of the ship. 0 on short (parity) and when clear */
function hookClear([bx0, by], shift = 0) {
  if (!g3() || !$.P || !$.P.alive) return 0;
  const bx = bx0 + shift;
  const r = BUL.noBody + BUL.bodyPad + Math.max(0, ET.hook.r - 9), dy = by - $.P.y, dx = bx - $.P.x;
  if (dx * dx + dy * dy >= r * r) return 0;
  return $.P.x + Math.sqrt(Math.max(0, r * r - dy * dy)) - bx;
}
export function flayer(y) {
  mk('flayer', W + 18, y, {
    y0: y,
    tx: rr(W * .55, W * .8),
    ws: 'idle',
    wt: 0,
    ang: Math.PI,
    cool: ri(...first('flayer', 60, 110)), // G3: BUL.first.flayer (N3), else D62's Drive range
    cap: R() < .35,
    hunt: flayHunts($.G.flayN = ($.G.flayN || 0) + 1, g3() ? { flayEvery: TIER.flay[tierOf()][0] } : noticeOf(econId())) ? 1 : 0, // D62: every flayEvery-th flayer hunts (no R() draw); long4: the tier's share (D66)
    park: ($.G.flayN % 2) * 40 // D66: a second hunter parks 40 px further out, so two never stack in one column (art-director)
  });
}
export function logLine(s) {
  $.G.logQ.push(s);
}
// BulletML-lite pattern primitives. Volleys are atomic on long4 (§2.1): the whole fan or ring fits under the cap, or
// none of it spawns and the call returns false (the caller retries after min(remaining, 20 f): notice.ts retryIn).
// cls: the cap context; omitted, the current one (a midboss's setp, a boss's)
export const fan = (x, y, a, n, spread, sp, k, cls?) => {
  if (!volley(n, x, y, cls)) return false;
  for (let i = 0; i < n; i++) eshoot(x, y, a + (i - (n - 1) / 2) * spread, sp, k, cls);
  endVolley();
  return true;
};
export const ring = (x, y, n, a0, sp, k, cls?) => {
  if (!volley(n, x, y, cls)) return false;
  for (let i = 0; i < n; i++) eshoot(x, y, a0 + i * TAU / n, sp, k, cls);
  endVolley();
  return true;
};
/** a pattern clock: true every n frames of e's life. short: n x (1 - .4 pow). long4 (§2.1 rank table): n x (1.25 - .6 rho),
 *  never below 18 f (render/gross/crux.ts per() mirrors it) */
export const every = (e, n) => e.t % Math.max(18, Math.round(n * (g3() ? cadMulOf() : 1 - .4 * Math.min(2.0, $.G.pow || 0)))) === 0;
export function miniWarn(name, f) {
  banner('WARNING', name, '#ff2a2a', 170, true);
  sfx.dread();
  $.G.glitch = 10;
  $.G.pend.push({
    t: 150,
    f
  });
}
export function crux() {
  const e = mk('crux', W + 60, PH / 2, {
    tx: W - 92,
    bars: []
  });
  for (let i = 0; i < 4; i++) e.bars.push(mk('nailbar', e.x, e.y, {
    par: e,
    ox: -24 - i * 7,
    oy: 0,
    i
  }));
  $.G.mini = e;
}
export function butcher() {
  $.G.mini = mk('butcher', W + 70, 95, {
    tx: W - 112,
    st: 'idle',
    wt: 0,
    cool: 100,
    sw: 0,
    ba: -2.3,
    hk: null,
    att: 0
  });
}
/** show a banner for t frames. warn: it is a WARNING, so the render warm-up holds until it ends (warmplan.ts). A flag,
 *  not the text, so a copy change or a translation can never reopen the gate (common.md hard rule 3) */
export function banner(text, sub, col = '#d4141e', t = 200, warn = false) {
  $.G.banner = {
    text,
    sub,
    col,
    t,
    ml: t
  };
  if (warn) $.G.warnEnd = $.G.t + t; // the warm-up holds until this step (warmplan.ts). Write-only for the sim
}
// the Open Orbit and Gravity Drive approach scripts, remixed per descent, live in enemies/scripts.ts
export { stageScript } from './scripts';
export { dolls } from './doll'; // MINI DOLL HEADS: a group of 5 in a bobbing line (enemies/doll.ts)
export function runScript() {
  while ($.G.si < $.G.script.length && $.G.script[$.G.si].x <= $.G.scroll) {
    const s = $.G.script[$.G.si++];
    if ($.G.eat && s.x < $.G.eat) continue; // the Open Orbit midboss is up: its stretch of filler is skipped (enemies/mid/ufo.ts)
    if (fillerQuiet(s.k)) continue; // picker layouts: no filler while any midboss is up (midslot.ts; item K's precondition)
    s.f();
  }
}

// --- enemy behaviour ---

// ---------------- new enemies: the Sinus snot slime, the hulking mutant, the MERIDIAN security drone ----------------
// (behaviour: updNew() in update.ts; kill FX: killNew(); art: drawSlime / drawMutant / drawSentry in render/enemies.ts)
Object.assign(ET, {
  // a mucus slime oozing along the Sinus floor or ceiling: rears up and lobs snot, or lunges when you pass over it
  slime: { hp: 7, r: 9, gsz: 1.7, score: 450, bio: 6, amnio: 1, eyes: 0, teeth: 0, skull: 0, limbs: 0 },
  // a crewman the drive turned into a hulk, stalking the Cryovault and Furnace floors: slow, tough, hurls meat
  mutant: { hp: 26, r: 13, gsz: 3, score: 1600, bio: 16, big: 1, half: 1, skull: 1, limbs: 3, eyes: 2, teeth: 6 },
  // the derelict's own defence pods, still on patrol in Open Orbit: a brain in a can, bleeds blood-oil
  sentry: { hp: 6, r: 8, gsz: .8, score: 500, bio: 6, eyes: 1, teeth: 0, skull: 0, limbs: 0 },
});
export function slime(side = 1) {
  const wx = $.G.scroll + W + 16, y = side > 0 ? floorAt(wx) : ceilAt(wx);
  if (y > PH + 4 || y < -4) return;
  mk('slime', W + 16, y - side * 6, { o: side, spd: rr(.2, .45), cool: ri(...first('slime', 90, 130)), st: 'ooze', wt: 0, ph: R() * TAU, cap: R() < .2 });
}
export function mutant() {
  const wx = $.G.scroll + W + 24, f = floorAt(wx);
  if (f > PH + 4 || f - ceilAt(wx) < 70) return;
  mk('mutant', W + 24, f - 18, { fy: f, st: 'walk', wt: 0, cool: ri(...first('mutant', 110, 150)), spd: rr(.22, .36), cap: R() < .5 });
}
/** a security pod in from the right that parks at tx, fires two telegraphed bursts, then moves on. long4 in Open Orbit
 *  and the Drive (§2.3 roster): every 2nd one drops in from the top or bottom edge at tx instead (st 'drop', 2 px/f, the
 *  edge nearer its lane), after the edge chevron's 60 f tell. Counted on G.sentN, no R(); the spawn's draws are kept */
export function sentry(y, tx) {
  const o = { y0: y, tx: tx ?? rr(W * .6, W * .82), st: 'hover', wt: 0, cool: ri(...first('sentry', 50, 80)), shots: 0, ph: R() * TAU, cap: R() < .3 };
  const kd = kindOf($.G.stage || 0);
  if (g3() && (kd === 'orbit' || kd === 'drive') && ($.G.sentN = ($.G.sentN || 0) + 1) % 2 === 0) {
    const top = y < PH / 2, bx = $.P && $.P.alive ? $.P.x - BUL.sentryBack : -1, x = bx >= BUL.sentryBackMin ? bx : clamp(o.tx, 60, W - 40); // behind the ship when there is room (N2)
    $.G.warn.push({ x, edge: top ? 'top' : 'bottom', t: ENTRY.tell, ml: ENTRY.tell });
    sfx.tele();
    $.G.pend.push({ t: ENTRY.tell, f: () => mk('sentry', x, top ? -14 : PH + 14, { ...o, tx: x, st: 'drop', ent: top ? 'top' : 'bottom' }) });
    return;
  }
  mk('sentry', W + 14, y, o);
}
/** a regular shooter's first-attack range: long4's BUL.first[k] (ENC E2: within 30 f of becoming visible), else the
 *  kind's own range through firstShot (D62's Drive range). Either way the caller draws one ri() over it */
const first = (k, lo, hi) => (g3() ? BUL.first[k] : firstShot(lo, hi));

// ---------------- CREW KNOTS (LVL §3.2, the Orbit signature W3 places): knots of frozen crew that tear apart ----------------
Object.assign(ET, {
  // 5-7 suited bodies chained at the wrists, tumbling; shot, it tears into 2 clumps
  knot: { hp: KNOT.hp, r: KNOT.r, gsz: 2.6, score: 600, bio: 6, half: 1, eyes: 2, limbs: 3, skull: 1, teeth: 2 },
  // 2-3 bodies still chained; tears into 2 corpses (1 HP each, the popcorn rule)
  clump: { hp: KNOT.clumpHp, r: KNOT.clumpR, gsz: 1.8, score: 250, bio: 1, half: 1, eyes: 1, limbs: 2, teeth: 1 },
});
/** a crew knot at lane y (W3's Orbit beats): at x = W + 30, its lane moved 48 px off the ship's y when it would sit on
 *  it (notice.ts knotLane). Bodies drawn: 5-7, by a counter (no R()) */
export function knot(y) {
  const n = ($.G.knotN = ($.G.knotN || 0) + 1), yy = $.P ? knotLane(y, $.P.y, PH) : y;
  return mk('knot', W + KNOT.x0, yy, { y0: yy, nb: 5 + n % 3, rot: n * .9 });
}
