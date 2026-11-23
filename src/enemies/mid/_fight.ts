// @ts-nocheck
// =====================================================================
//  THE MIDBOSS FIGHTS' DIFFICULTY RULES (DIFFICULTY-SPEC §2.3 "Fights", workstream W4a). One shared helper for the five
//  Descent 1 midbosses (ufo, choir, cyst, prentice, brood), so every fight reads the same rank, cadence, cap and budget.
//
//  Everything here is gated on g3(): long4's hard set (ECON[econId()].hard). On `short` the kinds keep their old code
//  paths line for line, so the short harness and layout parity stay byte-identical (spec §5.3, gate T1).
//
//  THE W0 ADAPTER. src/rank.ts (W0) is not merged yet. fightRank() / fightTier() below are the ONE spot that reads the
//  rank: until W0 lands they compute the spec §2.1 formula from $ directly (T_base + stageIdx + 6 loop + P_term); when
//  it lands they become `rank($)` and `$.G.tier`, and nothing else in the fights changes.
//
//  Pure of the DOM: imports state, economy and world only, so tests drive it (tests/unit/midfight.test.ts). No R().
// =====================================================================
import { $ } from '../../state';
import { ECON, econId } from '../../economy';
import { eshots } from '../../world';

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
  /** C4/C5 the midboss cap by tier (Easy, Normal, Hard, Very Hard): B1/B3 */
  cap: [12, 16, 20, 20] as readonly number[],
  /** spec §2.1 T_base by tier */
  tBase: [0, 2, 4, 6] as readonly number[],
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

// ---------------- the W0 adapter (replace the bodies with rank.ts when it lands) ----------------
/** the tier, 0-3 (W0: G.tier, default 1 = Normal on long4) */
export const fightTier = () => { const t = $.G && $.G.tier; return t >= 0 && t <= 3 ? t : 1; };
/** spec §2.1 P_term: held power only, by slot (THRUST 0, MISSILE/PYRE 1 per level, SPLIT 2, ARC 3, WRAITH 1 per option,
 *  WARD 4 flat, CALIBER + SERRATION 1 per level capped 3). Perks, rigs, LV and XP never count */
export function pTerm(P: any, gm: any): number {
  if (!P) return 0;
  return (P.missile || 0) + (P.pyre || 0) + (P.double ? 2 : 0) + (P.laser ? 3 : 0) + (P.options || 0) + ((P.wardLv || 0) >= 1 ? 4 : 0)
    + Math.min(3, ((gm && gm.cal) || 0) + ((gm && gm.serr) || 0));
}
/** the integer rank (spec §2.1): clamp(T_base + stageIdx + 6 loop + P_term, 0, 16 in Descent 1 else 31). W0: rank($) */
export function fightRank(): number {
  const G = $.G || {}, loop = G.loop || 0, s = G.stage || 0; // as rank.ts: G.stage raw (W0 contract)
  const r = FT.tBase[fightTier()] + s + 6 * loop + pTerm($.P, G.gm);
  return Math.max(0, Math.min(loop === 0 ? 16 : 31, r));
}
/** rho = min(rank, 16) / 16. W0: rho($) */
export const fightRho = () => Math.min(fightRank(), 16) / 16;
/** the midboss bullet cap at the current tier. W0: bulletCap($, 'setp') */
export const fightCap = () => FT.cap[fightTier()];

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
 * A fan of n lobbed globs from (x, y) whose centre comes down exactly through (tx, ty) and the rest dx px apart along x
 * (pass enemies/update.ts lob as lobF: this file stays out of the sim's import cycle). A glob falls .025/f, so a glob
 * fan aimed straight at the ship (the old fan of globs) curves under a ship that sits still; this one is aimed: K1
 */
export function lobFan(lobF: (x: number, y: number, tx: number, ty: number, vy: number) => void, x: number, y: number, tx: number, ty: number, n: number, dx: number, vy: number): void {
  // a target above: just enough rise to come down through it (apex a few px over it, so a cave's ceiling rarely eats it)
  const v = ty < y ? Math.sqrt(.05 * (y - ty)) + .2 : vy;
  for (let i = 0; i < n; i++) lobF(x, y, tx + (i - (n - 1) / 2) * dx, ty, v);
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
