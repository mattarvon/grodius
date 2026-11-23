// @ts-nocheck
// =====================================================================
//  THE MIDBOSS FIGHTS' DIFFICULTY RULES (DIFFICULTY-SPEC §2.3 "Fights", workstream W4a). One shared helper for the five
//  Descent 1 midbosses (ufo, choir, cyst, prentice, brood), so every fight reads the same rank, cadence, cap and budget.
//
//  Everything here is gated on g3(): long4's hard set (ECON[econId()].hard). On `short` the kinds keep their old code
//  paths line for line, so the short harness and layout parity stay byte-identical (spec §5.3, gate T1).
//
//  THE W0 ADAPTER. fightRank() / fightRho() / fightTier() / fightCap() below are the ONE spot that reads src/rank.ts and
//  src/tier.ts (W0 contract); nothing else in the fights reads the rank or the tier.
//
//  Pure of the DOM: imports state, economy, world, rank and tier only, so tests drive it (tests/unit/midfight.test.ts). No R().
// =====================================================================
import { $ } from '../../state';
import { ECON, econId } from '../../economy';
import { ceilAt, eshots } from '../../world';
import { VCAP, bsMul, bulletCap, rank, rankP, rho } from '../../rank';
import { tierG } from '../../tier';
import { DN } from './_deny';

/** the tuning (frames, bullets). Every value: its spec tag, and the gate that measures it */
export const FT = {
  /** spec §2.1 "every fire interval": I x (1.25 - .6 rho), never under 18 f [GR §2 S, C2]; unit test cad() */
  cadHi: 1.25, cadLo: .6, cadFloor: 18,
  /** C3: a fight's variant unlocks at rank >= 14 (unit test variant()); measured by midboss-probe's rank column */
  varRank: 14,
  /** the brief and spec §2.3: a fight emits at most 15 bullets in any 120 f window (B3 measures the on-screen max) */
  budget: 15, window: 120,
  /** a periodic emitter (ring, sing) never repeats inside the budget window, so one ring per 120 f at most (DER: the
   *  spec's per-fight 120 f tables count one ring; at rho 1 the cadence alone would put two in a window) */
  perMin: 121,
  /** the opening: a fight attacks from e.t > enter (was 120) with a first cooldown of open (was 100-110), so at the slot-A
   *  TTK (8-11 s, half of it phase 1) each phase holds at least two attacks: K1, every spot hit >= 2 times per phase
   *  (midboss-probe --spots). The first tell still runs >= 44 f, and the body is on screen by e.t 20 */
  enter: 60, open: 20,
  /** a periodic emitter (ring, sing) fires only while the live counted shots + its volley stay at or under soft, so the
   *  fight's typical screen holds near .6 of the cap (B3: p90 <= .6 x 16 = 9.6); attacks still fill to the cap */
  soft: 9,
} as const;

/** the difficulty rebuild is on: long4's hard set (short keeps every old path) */
export const g3 = () => !!ECON[econId()].hard;

// ---------------- the W0 adapter: the fights' one doorway to src/rank.ts and src/tier.ts ----------------
/** the tier, 0-3 (tier.ts tierG: Normal when G carries none) */
export const fightTier = () => tierG($.G);
/** spec §2.1 P_term (rank.ts rankP): held power only, by slot */
export const pTerm = (P: any, gm: any): number => rankP(P, { gm });
/** the integer rank (spec §2.1; rank.ts rank) */
export const fightRank = (): number => rank($);
/** rho = min(rank, 16) / 16 (rank.ts rho) */
export const fightRho = () => rho($);
/** the midboss bullet cap at the current tier (rank.ts bulletCap, the set-piece / midboss class) */
export const fightCap = () => bulletCap($, 'setp');

// ---------------- the rules every fight reads ----------------
/** an idle cooldown or pattern interval I under the one rank rule (no pow term, no dial): I x (1.25 - .6 rho), floor 18 */
export const cad = (I: number, rho = fightRho()) => Math.max(FT.cadFloor, Math.round(I * (FT.cadHi - FT.cadLo * rho)));
/** a periodic emitter's interval: cad(I), but never inside the budget window (FT.perMin) */
export const per = (I: number, rho = fightRho()) => Math.max(FT.perMin, cad(I, rho));
/** every(): true on the frames a periodic emitter of interval I fires (spawn.ts every()'s replacement in the fights) */
export const ev = (e: any, I: number) => e.t % per(I) === 0;
/** the fight's variant is unlocked (rank >= 14) */
export const variant = (rank = fightRank()) => rank >= FT.varRank;
/** the litter size (spec §2.1 "Hatchling litters"): 3 + round(2 rho) */
export const litter = (rho = fightRho()) => 3 + Math.round(2 * rho);

/** may e attack this frame? (past its entrance: FT.enter on long4, 120 on short) */
export const entered = (e: any) => e.t > (g3() ? FT.enter : 120);
/** the first cooldown at spawn on long4 (FT.open); a kind's onSpawn calls it */
export function opening(e: any): void { if (g3()) e.cool = FT.open; }
/**
 * The rise of a lob that keeps under the long4 falling-glob cap (shots.ts: a glob FALLING faster than V_CAP is slowed
 * along its path, so a lob that would come down faster lands short of its mark: W6 measured the Butcher's spit and the
 * Saucer's swell missing every parked spot at mid height). The upward launch speed w (px/f) of a glob from (0, 0) that
 * comes down through (dx, dy) (screen y, down +; it falls .025/f), launching AND arriving at <= cap and still falling as
 * it arrives (lob()'s root): of those, the one nearest the preferred rise w0. None fits (too far for the cap): the one
 * that arrives slowest. Pure; tests/unit/midfight.test.ts
 */
export function lobRise(dx: number, dy: number, cap: number, w0 = 0, rise = Infinity, g = .025): number {
  let best = w0, bd = Infinity, low = w0, bl = Infinity, slow = w0, bs = Infinity;
  for (let t = 6; t <= 320; t += 2) {
    const vx = dx / t, w = (g * t * t / 2 - dy) / t, va = g * t - w;
    if (va < 0) continue; // still rising when it gets there: lob() solves the falling root
    const sp = Math.max(Math.hypot(vx, w), Math.hypot(vx, va)), under = w <= 0 || w * w / (2 * g) <= rise;
    if (under && sp <= cap) { if (Math.abs(w - w0) < bd) { bd = Math.abs(w - w0); best = w; } }
    else if (under && sp < bl) { bl = sp; low = w; }
    else if (sp < bs) { bs = sp; slow = w; }
  }
  return bd < Infinity ? best : bl < Infinity ? low : slow;
}
/** lob()'s vy (its rise, in BS units) for a glob from (x, y) through (tx, ty) under the flown tier's V_CAP (2% margin)
 *  and under the cave's ceiling (its apex 8 px below the lowest ceiling at the throw, the middle and the mark: W6 found
 *  the Butcher's arcs striking the fire arena's ceiling), as near the authored rise v0 (BS units) as fits. long4 only */
export const lobV = (x: number, y: number, tx: number, ty: number, v0: number): number => {
  const bs = Math.max(.1, bsMul($)), sc = $.G.scroll || 0;
  const top = Math.max(ceilAt(x + sc), ceilAt((x + tx) / 2 + sc), ceilAt(tx + sc)) + 8;
  return lobRise(tx - x, ty - y, VCAP(fightTier()) * .98, v0 * bs, Math.max(0, y - top)) / bs;
};
/**
 * A fan of n lobbed globs from (x, y) whose centre comes down exactly through (tx, ty) and the rest dx px apart along x
 * (pass enemies/update.ts lob as lobF: this file stays out of the sim's import cycle). A glob falls .025/f, so a glob
 * fan aimed straight at the ship (the old fan of globs) curves under a ship that sits still; this one is aimed: K1
 */
export function lobFan(lobF: (x: number, y: number, tx: number, ty: number, vy: number) => void, x: number, y: number, tx: number, ty: number, n: number, dx: number, vy: number): void {
  // a target above: just enough rise to come down through it (apex a few px over it, so a cave's ceiling rarely eats it)
  const v = ty < y ? Math.sqrt(.05 * (y - ty)) + .2 : vy;
  for (let i = 0; i < n; i++) { const gx = tx + (i - (n - 1) / 2) * dx; lobF(x, y, gx, ty, lobV(x, y, gx, ty, v)); } // each under the falling-glob cap (lobV)
}
/** a ring's first spoke on the long4 fights: aimed at the ship (rings never lead; DIFFICULTY-SPEC §2.1), so a ship that
 *  sits still meets one spoke wherever it parks (K1) */
export const ringA = (x: number, y: number) => Math.atan2($.P.y - y, $.P.x - x);
/** the long4 fights' rings fly at RING_V (the old 1-1.05 took most of a phase to cross the screen) [K1, B3 p90] */
export const RING_V = 2;

/** a periodic emitter's spend: the budget, under the soft ceiling (FT.soft) rather than the cap. A kind's e.rq 2 (the
 *  ring the phase-2 lurch calls) uses spend() instead: under the cap */
export const spendP = (e: any, n: number) => spend(e, n, Math.min(FT.soft, fightCap()));
/**
 * The first frame of phase 2 on long4: the fight lurches into it (its next attack comes within FT.open, not after the
 * rest of a cooldown), so phase 2 holds its two attacks at the slot-A TTK too (K1). True on that frame only, so the kind
 * can pick which attack opens the phase. e.p2s marks it done
 */
export function lurch(e: any, ph2: boolean): boolean {
  if (!ph2 || e.p2s) return false;
  e.p2s = 1;
  if (!g3()) return false;
  if (e.st === 'idle') e.cool = Math.min(e.cool, e.wt + FT.open);
  return true;
}

/**
 * g3: steer a midboss's diving hatchlings (spawned with own: e and ent = the edge they came from, 1 top, -1 bottom, or
 * 2 from its body). The hatchling's own arm (enemies/update.ts 'hatch') runs after this in the same frame (a child is later
 * in the list) and moves it 2.5 left and steers vy .05 toward the ship, so this pre-pays the arm: straight in off an edge,
 * then a dive at the ship at DN.eV, until it is past the ship's x or DN.eT frames old (then an ordinary hatchling). A
 * litter that only met the ship head on was erased by its forward fire (K2: bodies, not bullets). Frame math, no R()
 */
export function diveKids(e: any, list: readonly any[], ph: number): void {
  const P = $.P;
  for (const q of list) {
    if (q.dead || q.own !== e || !q.ent) continue;
    if (q.x < P.x - 8 || q.t > DN.eT) { q.ent = 0; continue; }
    const dx = P.x - q.x, dy = P.y - q.y, d = Math.hypot(dx, dy) || 1;
    const off = q.ent === 1 ? q.y < 0 : q.ent === -1 ? q.y > ph : false;
    const vy = Math.max(-1.35, Math.min(1.35, off ? q.ent * DN.eV : DN.eV * dy / d));
    q.x += 2.5 + (off ? 0 : DN.eV * dx / d);
    q.vy = vy - (P.y > q.y ? .05 : -.05);
  }
}

/** counted enemy shots alive (spec §2.1: every eshot not flagged haz) */
export function counted(): number {
  let n = 0;
  for (const s of eshots) if (!s.haz) n++;
  return n;
}
/** ledger slots: every volley is >= 1 bullet and the window holds <= FT.budget of them, so 16 never drops a live one */
const SLOTS = 16;
/** give e its emission ledger (at spawn): SLOTS (frame, bullets) pairs, no allocation after */
export function ledger(e: any): void { e.bT = new Array(SLOTS).fill(-1e9); e.bN = new Array(SLOTS).fill(0); }
/** bullets e emitted in the last FT.window frames */
export function spent(e: any): number {
  if (!e.bT) return 0;
  let s = 0;
  for (let i = 0; i < SLOTS; i++) if (e.t - e.bT[i] < FT.window) s += e.bN[i];
  return s;
}
/**
 * May e emit a volley of n bullets now? Under the 120 f budget and the midboss cap (live counted shots + n). True records
 * the volley in the ledger; false spawns nothing, and the caller waits (an attack holds its fire frame) or skips (a
 * periodic emitter). Volleys stay atomic: all n or none (spec §2.1 "Volleys are atomic"; W1's eshoot does the same at
 * the shot level once it lands, so this is the fights' own guarantee of the per-fight budget)
 */
export function spend(e: any, n: number, cap = fightCap()): boolean {
  if (!e.bT) ledger(e);
  if (spent(e) + n > FT.budget || counted() + n > cap) return false;
  let j = 0;
  for (let i = 1; i < SLOTS; i++) if (e.bT[i] < e.bT[j]) j = i;
  e.bT[j] = e.t; e.bN[j] = n;
  return true;
}

/**
 * The aim angle from (x, y) for a shot at v px/f, led by L = .2 + .6 rho (spec C8, §2.1 "Aim lead"): the ship's last-frame
 * displacement (P.vx, P.vy: W0 adds them; until then 0, so the aim is exact), t = min(60, dist / v), the aim point
 * clamped to y 6-248. W1 lands the shared aimLead (spawn.ts); this is its stand-in for the fights' single aimed shots
 */
export function aimLed(x: number, y: number, v: number, rho = fightRho()): number {
  const P = $.P, L = .2 + .6 * rho, dx = P.x - x, dy = P.y - y, t = Math.min(60, Math.hypot(dx, dy) / Math.max(.1, v));
  const ax = P.x + L * (P.vx || 0) * t, ay = Math.max(6, Math.min(248, P.y + L * (P.vy || 0) * t));
  return Math.atan2(ay - y, ax - x);
}
