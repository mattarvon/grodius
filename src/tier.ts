// =====================================================================
//  DIFFICULTY TIERS (DIFFICULTY-SPEC §2.1 "Tiers", Matt's decision 6, 2026-11-22): Easy / Normal (default) / Hard /
//  Very Hard replace D63's BRUTAL dial. A tier changes aggression (rank base, revenge), the cost of a death (strip,
//  checkpoint, LAST GASP, BLACK BOX) and the variable pod faucet. It never multiplies enemy count, bullets per volley
//  or HP (GR rule 15). Long4 only: short ignores the tier (spec §5.3), so its G never carries one.
//
//  One integer 0-3 on G.tier, chosen at run start (lab.ts tierPick: ?tier=N > ?brutal=N (read as Normal, for one
//  release) > the LAB's DIFFICULTY row > Normal) and kept in the run save (runsave.ts; an old `brutal` resumes as
//  Normal, because the levers it named are gone).
//
//  Pure lookups: nothing here draws R(). The tables are read by src/rank.ts (rank base, caps, V_CAP, revenge) and by
//  W2's death code (strip, position, LAST GASP, BLACK BOX, lifeline) through the accessors below.
// =====================================================================
import { $ } from './state';

/** a difficulty tier: 0 Easy, 1 Normal, 2 Hard, 3 Very Hard */
export type Tier = 0 | 1 | 2 | 3;
/** Normal: what a long run flies when nothing chose a tier (spec §2.1) */
export const TIER_DEFAULT: Tier = 1;
/** the LAB / title names (new strings, localization-lead: UI copy, uppercase like every LAB value) */
export const TIER_NAME: readonly string[] = ['EASY', 'NORMAL', 'HARD', 'VERY HARD'];

/** what a death strips (spec §2.1 death penalty; W2 reads it in flow.ts):
 *  'gradual' Easy: one slot a death, WRAITH -> main-gun form -> MISSILE/PYRE -> THRUST;
 *  'full1' Normal: everything, THRUST min(1, speed) kept (C18); 'full' Hard/VH: everything, THRUST 0 */
export type Strip = 'gradual' | 'full1' | 'full';
/** LAST GASP's refresh (spec §2.1 survival): once per stage, once per descent, or never */
export type Gasp = 'stage' | 'descent' | 'off';
type Col<T> = readonly [T, T, T, T];

/** the tier table, one column per tier [Easy, Normal, Hard, Very Hard]. Each row cites its source and its gate */
export const TIER: {
  base: Col<number>; caps: Col<readonly [number, number, number]>; vcap: Col<number>; capRate: Col<number>;
  rev: Col<readonly [number, number, number]>; strip: Col<Strip>; checkpoint: Col<boolean>; lifeline: Col<boolean>;
  gasp: Col<Gasp>; blackBox: Col<boolean>;
} = {
  /** rank's T_base (src/rank.ts): the Gradius III DIP values [GR §2 S]. Gates R1 / D1 */
  base: [0, 2, 4, 6],
  /** bullet caps [scroll, set piece / midboss, boss / Drive] (rank.ts bulletCap): Normal is GR rule 1's 8/16/24 (C4),
   *  Easy x.75 and Hard/VH x1.25 (C5: never above 1.5x). Gate B1 */
  caps: [[6, 12, 18], [8, 16, 24], [10, 20, 30], [10, 20, 30]],
  /** enemy bullet top speed px/f (rank.ts VCAP): the ship at THRUST 3 (2.51) and 4 (2.93) [GR rule 3]. Gate S1 */
  vcap: [2.6, 2.6, 2.9, 2.9],
  /** the variable pod faucet only (economy.ts capKept / grpDrops `m`; tier.ts capRate): GR rule 15 verbatim (C25).
   *  Gate E2 */
  capRate: [1.5, 1, 1, .8],
  /** popcorn revenge chance by descent [D1, D2, D3+] (rank.ts revChance): the Gradius V table [GR rule 9]. Gate D3 */
  rev: [[0, 0, 0], [0, .33, .5], [.33, .5, 1], [.5, 1, 1]],
  /** the death strip (C18; Easy is GR §4 Beginner) */
  strip: ['gradual', 'full1', 'full', 'full'],
  /** true: a death rewinds to the last checkpoint (decision 1A); false: respawn in place (Easy) */
  checkpoint: [false, true, true, true],
  /** true: the boss-fight lifeline (2 FULL pods on a fight death) is kept (C15: Easy only) */
  lifeline: [true, false, false, false],
  /** LAST GASP's refresh (spec §2.1 survival) */
  gasp: ['stage', 'descent', 'descent', 'off'],
  /** BLACK BOX: recovery wave R1's main-gun pod arrives FULL (C16: off on Very Hard) */
  blackBox: [true, true, true, false],
};

/** a tier 0-3 from anything (a URL value, a stored LAB or run-save field), or null */
export const tierOf = (v: unknown): Tier | null => {
  if (typeof v === 'string') return /^[0-3]$/.test(v) ? (+v as Tier) : null; // not +v: ' ' and '0x1' are numbers too
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 3 ? (v as Tier) : null;
};
/** the tier a G flies: its G.tier, else Normal. A G without one (short, a pre-tier save) reads Normal; short's
 *  callers gate on the layout before they act on any tier value (spec §5.3) */
export const tierG = (G: any): Tier => tierOf(G && G.tier) ?? TIER_DEFAULT;
/** the current run's tier ($.G) */
export const tier = (): Tier => tierG($.G);
/** the variable pod faucet's multiplier for the current run: TIER.capRate on a G that carries a tier (long4), else 1
 *  (short never sets G.tier, so its keep rolls and formation drops are unchanged). Pure lookup, no R() */
export const capRate = (): number => ($.G && tierOf($.G.tier) != null ? TIER.capRate[$.G.tier as Tier] : 1);

// ---- the D63 BRUTAL shim (spec §5.1 risk "Removing bru() from about 20 call sites"). Every BRUTAL lever is deleted;
// bru() returns the lever's neutral value (dial 0, which was pass2 exactly: 1 for a multiplier, 0 for an addend), so
// the call sites in files other streams own keep compiling and do nothing. Each stream deletes the calls in its own
// files (W1 enemies/spawn.ts and enemies/update.ts, W4 render/gross/crux.ts) and W6 deletes this shim.
const NEUTRAL = { hp: 1, bossHp: 1, driveHp: 1, cool: 1, fire: 1, bs: 1, fan: 0, aimAll: 0, dens: 0, pod: 1, ward: 1 } as const;
/** a retired BRUTAL lever: always its neutral value (1 or 0). Do not add callers */
export const bru = (k: keyof typeof NEUTRAL): number => NEUTRAL[k];
