// =====================================================================
//  RANK (DIFFICULTY-SPEC §2.1 "Rank", C1): the Gradius III rank, the ONLY difficulty input of the rebuild.
//
//    rank = clamp(T_base + stageIdx + 6 * loop + P_term, 0, loop === 0 ? 16 : 31)       rho = min(rank, 16) / 16
//
//  T_base by tier (tier.ts TIER.base: 0 / 2 / 4 / 6), stageIdx the stage's index in its descent (0-3 on long4: Orbit,
//  biome A, biome B, Drive), 6 a descent ([DER] GIII's 8 per loop over 10 stages, scaled to 4), and P_term the power
//  the ship HOLDS (rankP below). Perks, rigs, LV and XP never count: they survive a death, and a death must drop rank.
//
//  What rank changes (the readers are W1 / W3 / W4; nothing reads rank in W0, so this module lands inert):
//    cadMul  every fire interval x(1.25 - .6 rho), floor 18 f (cadI)       x1.17 at rank 2, x.65 at 16
//    bsMul   bullet speed x(1 + .02 rank) x min(1.3, 1 + .12 loop), under VCAP(tier) (shotV)
//    leadL   aim lead L = .2 + .6 rho                                       .28 at rank 2, .80 at 16
//    hazMul  biome hazard cadence x(1.15 - .3 rho)
//    litter  hatchling litters 3 + round(2 rho)
//    variant fight variants and the second drone shooter at rank >= 14 (VARIANT_RANK)
//  Above 16 (Descent 2 on) rank feeds only bullet speed (still under VCAP) and the revenge table (revChance).
//  Rank NEVER changes HP, bullets per volley, formation size, caps, pods or terrain (spec §2.1, GR rule 6).
//
//  Everything here is a PURE function of the `$` it is handed (or of plain numbers): no module state, no R(), no
//  allocation. tools/probe-lib.mjs calls rank($) every frame, so it must stay that way. The helpers below compute rank
//  LIVE from $ (sim code calls them: within a step they see a pickup or a death at once). step.ts mirrors rank($) on
//  G.rk once a step, before the ship moves, for the HUD, debug and probes only: sim code must not mix the two.
//  Measured by: unit tests tests/unit/rank.test.ts; gates R1 (rank on Drive entry 16, after a naked respawn 5), D1
//  (rank 1 f after a death <= T_base + stageIdx + 3), B1 (caps), S1 (V_CAP) in tools/pod-probe.mjs.
// =====================================================================
import { kindOf } from './layout';
import { TIER, type Tier, tierG } from './tier';

/** the rank cap in Descent 1 and in every later descent (spec §2.1) */
export const RANK_CAP_D1 = 16;
export const RANK_CAP = 31;
/** [DER] rank per descent: Gradius III's 8 per loop of 10 stages, over 4 */
export const RANK_LOOP = 6;
/** C3: rank at which a fight's variant and the drone formation's second designated shooter unlock */
export const VARIANT_RANK = 14;
/** C2: the floor every rank-scaled fire interval keeps (frames) */
export const CAD_FLOOR = 18;

/** P_term weights per held slot ([GR §2 S] table mapped to our slots, spec §2.1). THRUST is 0: mobility, not threat */
export const RANK_W = {
  thrust: 0, //   per level
  missile: 1, //  per level
  pyre: 2, //     PYRE I: decision 24 (2026-11-23, R1), PYRE I weighs what MISSILE II does: K1 takes either ('MISSILE 2 or PYRE 1'),
  //               so a K1 ship on PYRE read one rank short of 16 at the Drive (gate R1). Spec §2.1's table said 1 per level
  pyre2: 1, //    each PYRE level past I (+1, like every other per-level slot): PYRE II = 3
  split: 2, //    SPLIT held (P.double)
  arc: 3, //      ARC held (P.laser); the two are separate slots, so a ship holding both pays both
  wraith: 1, //   per option
  ward: 4, //     flat once WARD level >= 1
  graft: 1, //    CALIBER + SERRATION levels (G.gm.cal + G.gm.serr), 1 each ...
  graftMax: 3, // ... and 3 at most
} as const;

/** P_term: the rank the ship's HELD power adds (guns, options, WARD and the two gun grafts). P null (no ship, or
 *  between a death and the respawn) holds nothing: 0 */
const NO_GM: Readonly<Record<string, number>> = Object.freeze({});
export function rankP(P: any, G: any): number {
  if (!P) return 0;
  const w = RANK_W, gm = (G && G.gm) || NO_GM; // no allocation per call (the probes call this every frame)
  return (P.speed || 0) * w.thrust + (P.missile || 0) * w.missile + (P.pyre > 0 ? w.pyre + (P.pyre - 1) * w.pyre2 : 0)
    + (P.double ? w.split : 0) + (P.laser ? w.arc : 0) + (P.options || 0) * w.wraith + ((P.wardLv || 0) >= 1 ? w.ward : 0)
    + Math.min(w.graftMax, ((gm.cal || 0) + (gm.serr || 0)) * w.graft);
}

/** the integer rank of the run in `$` (spec §2.1). No G: 0. Pure */
export function rank($: any): number {
  const G = $ && $.G;
  if (!G) return 0;
  const loop = G.loop || 0, cap = loop === 0 ? RANK_CAP_D1 : RANK_CAP;
  const r = TIER.base[tierG(G)] + (G.stage || 0) + RANK_LOOP * loop + rankP($.P, G);
  return Math.max(0, Math.min(cap, r));
}
/** rho = min(rank, 16) / 16, 0..1: what every rank-scaled behaviour but bullet speed and revenge reads */
export const rho = ($: any): number => Math.min(rank($), RANK_CAP_D1) / RANK_CAP_D1;

/** C2: fire-interval multiplier 1.25 - .6 rho (x1.25 naked at rank 0, x.65 at 16): regular cooldowns, every(), and
 *  every midboss and boss idle */
export const cadMul = ($: any): number => 1.25 - .6 * rho($);
/** a fire interval of `I` frames at the run's rank: round(I x cadMul), never under 18 f (C2) */
export const cadI = ($: any, I: number): number => Math.max(CAD_FLOOR, Math.round(I * cadMul($)));
/** bullet-speed multiplier (1 + .02 rank) x min(1.3, 1 + .12 loop): x1.04 at rank 2, x1.32 at 16 in Descent 1 */
export const bsMul = ($: any): number => {
  const G = $ && $.G;
  return (1 + .02 * rank($)) * Math.min(1.3, 1 + .12 * ((G && G.loop) || 0));
};
/** the enemy bullet top speed (px/f) at tier `t` [GR rule 3] */
export const VCAP = (t: Tier): number => TIER.vcap[t];
/** a bullet of authored base speed `v` (px/f) at the run's rank: min(VCAP(tier), v x bsMul). spec §2.1 */
export const shotV = ($: any, v: number): number => Math.min(VCAP(tierG($ && $.G)), v * bsMul($));
/** C8: aim lead L = .2 + .6 rho (.28 at rank 2, .8 at 16). The lead formula itself is spawn.ts aimLead (W1) */
export const leadL = ($: any): number => .2 + .6 * rho($);
/** biome hazard timers x(1.15 - .3 rho) (C29; x1.11 at rank 2, x.85 at 16) */
export const hazMul = ($: any): number => 1.15 - .3 * rho($);
/** hatchling litter size 3 + round(2 rho) (brood.ts, ufo.ts) */
export const litter = ($: any): number => 3 + Math.round(2 * rho($));
/** C3: are fight variants (and the second drone shooter) unlocked at this rank? */
export const variantOn = ($: any): boolean => rank($) >= VARIANT_RANK;

/** popcorn revenge chance at tier `t` in descent `loop` (0-based; D3 and later read the D3 column) [GR rule 9].
 *  0 means the caller draws NO R() (spec §5.2: Normal Descent 1 adds no draws) */
export const revChance = (t: Tier, loop: number): number => TIER.rev[t][Math.min(2, Math.max(0, loop | 0))];

// ---- bullet caps (spec §2.1 "Bullet caps", C4/C5)

/** a cap context: the scroll, a set piece or midboss, a stage boss or the Drive */
export type CapCls = 'scroll' | 'setp' | 'boss';
const CLS_I: Readonly<Record<CapCls, 0 | 1 | 2>> = { scroll: 0, setp: 1, boss: 2 };
/** a held midboss for the cap: a `mid` row, the Open Orbit Maw (spawned maw(true) but a midboss, as depth.ts isMid),
 *  or a mid-stage Maw (no stageBoss). tools/probe-lib.mjs PL.mawMid uses the same rule */
export const capMid = (m: any, G: any): boolean => !!m.mid || (m.k === 'maw' && (!m.stageBoss || kindOf((G && G.stage) || 0) === 'orbit'));
/** the cap context the run in `$` is in now: 'boss' while the Drive (G.boss) or a stage boss is up, 'setp' while a
 *  midboss is up or the ship is in a signature window (G.setp, step.ts from sigs.ts sigWindows), else 'scroll'. Pure */
export function capCtx($: any): CapCls {
  const G = $ && $.G;
  if (!G) return 'scroll';
  const m = G.mini && !G.mini.dead ? G.mini : null;
  if (G.boss || (m && !capMid(m, G))) return 'boss';
  if (m || G.setp) return 'setp';
  return 'scroll';
}
/** the counted-shot cap for context `cls` (default: the run's capCtx) at the run's tier. Regular shooters (drone,
 *  eye, cross, crawler, sentry, slime, mutant) pass 'scroll' even during a fight (spec §2.1). Pure */
export const bulletCap = ($: any, cls: CapCls = capCtx($)): number => TIER.caps[tierG($ && $.G)][CLS_I[cls]];
/** does enemy shot `q` count toward the cap? Every eshots entry except a hazard (`haz: 1`, e.g. THE KEEPSAKE's
 *  planted forks). tools/probe-lib.mjs PL.counted is the same predicate */
export const counted = (q: any): boolean => !q.haz;
/** counted shots in `list` (world.ts eshots). No allocation */
export function countShots(list: readonly any[]): number {
  let n = 0;
  for (let i = 0; i < list.length; i++) if (!list[i].haz) n++;
  return n;
}
/** free counted slots under the cap for context `cls`: bulletCap - countShots, never below 0. A volley of n fits only
 *  if n <= capRoom (volleys are atomic; W1 owns the retry, min(remaining, 20 f)) */
export const capRoom = ($: any, list: readonly any[], cls: CapCls = capCtx($)): number => Math.max(0, bulletCap($, cls) - countShots(list));
/** the volley retry delay (frames) after a volley that did not fit: min(remaining, 20) (spec §2.1) */
export const VOLLEY_RETRY = 20;
/** the no-spawn distance for an enemy shot around the ship, px (C9, GR rule 11) */
export const SHOT_CLEAR = 64;
