// =====================================================================
//  SURVIVAL AND DEATH (DIFFICULTY-SPEC §2.1 "Survival", "Death penalty", "Tiers"; §2.2 "Lives and meta"; Matt's
//  decisions §7, all option A). Workstream W2. Pure: apart from hardOn (which reads the active layout's economy entry), every function takes its inputs as arguments (G, P, plain
//  tables) and draws no RNG, so tests/unit/death.test.ts drives the rules without a DOM. The files that act on them
//  (flow.ts, player.ts, perks.ts, mutations.ts, contraptions.ts, power.ts, checkpoint.ts, save.ts, menus.ts) read the
//  tables here and call these functions.
//
//  Every rule is long4-only: callers gate it on `hard` (ECON[econId()].hard, the D63 HardSet, non-null on long4 alone),
//  so `short` and layout-parity stay byte-identical (spec §5.3, gate T1).
//
//  W0 ADAPTER: the tier comes from W0's G.tier (src/tier.ts). Until W0 lands, `runTier` reads G.tier when it is set and
//  falls back to Normal, which is the long4 default (spec §2.1 "Plumbing"). This is the one spot to switch.
// =====================================================================
import { ECON, econId } from './economy';
import { TIER, tierG } from './tier';

/** are the long4 rules on? (the D63 HardSet is non-null on long4 alone; short and the parity layouts read false) */
export const hardOn = (): boolean => !!ECON[econId()].hard;

/** tier ids (spec §2.1 Tiers; G.tier 0-3) */
export const EASY = 0, NORMAL = 1, HARD = 2, VERY_HARD = 3;
/** the run's tier: G.tier (src/tier.ts tierG; the names are its TIER_NAME), else Normal, the long4 default. Pure */
export const runTier = (G: any): number => tierG(G);

export type Strip = 'gradual' | 'full';
export type GaspRule = 'stage' | 'descent' | 'off';
/** the death and recovery columns of the spec §2.1 tier table (the bullet, rank and capsule columns are W0's tier.ts) */
export interface DeathTier {
  /** spec "Death strip": Easy loses only its top power-up; the rest lose everything */
  strip: Strip;
  /** THRUST levels kept on a full strip (C18: min(1, speed) on Normal, 0 on Hard and Very Hard) */
  thrustKeep: number;
  /** spec "Position on death" (Decision 1A): restart at the last checkpoint, else respawn in place */
  checkpoint: boolean;
  /** C15: the boss-fight lifeline (FULL pods on a fight death) survives on Easy only */
  lifeline: boolean;
  /** spec "LAST GASP": per stage on Easy, per descent on Normal and Hard, off on Very Hard */
  gasp: GaspRule;
  /** C16: BLACK BOX makes wave R1's main-gun pod FULL; off on Very Hard */
  blackBox: boolean;
}
/** read off W0's tier table (src/tier.ts TIER: strip 'gradual' / 'full1' / 'full', checkpoint, lifeline, gasp, blackBox),
 *  one row per tier [Easy, Normal, Hard, Very Hard], so the table lives in one place */
export const DEATH_TIER: readonly DeathTier[] = [0, 1, 2, 3].map((t) => ({
  strip: TIER.strip[t] === 'gradual' ? 'gradual' : 'full',
  thrustKeep: TIER.strip[t] === 'full1' ? 1 : TIER.strip[t] === 'gradual' ? 5 : 0, // C18; Easy keeps it unless it is the top power-up
  checkpoint: TIER.checkpoint[t],
  lifeline: TIER.lifeline[t],
  gasp: TIER.gasp[t],
  blackBox: TIER.blackBox[t],
}));
export const deathTier = (G: any): DeathTier => DEATH_TIER[runTier(G)];

/** survival values (spec §2.1 "Survival"; gates H1 slack 6-10 and H2 shield hits / deaths <= 1.5 measure them) */
export const SURV = {
  /** C20: i-frames after a WARD hit breaks (was 18), x(1 + .5 PAIN SPONGE) as before. GR §5: no chain hits. Gate F1 */
  wardInv: 40,
  /** C20: i-frames on an in-place respawn (was 160). Gate F1 (no death within 30 f of i-frames ending) */
  respawnInv: 120,
  /** C20: i-frames on a checkpoint restore (was 280): CP.lead's 120 f lead-in, so they end as the scroll reaches cpX */
  cpInv: 120,
  /** REGROWTH frames per hit at graft level 1 / 2 (was 1200 / 720: halved, SYS lever 1). Gate H1 */
  regrowPer: [0, 2400, 1440],
  /** REGROWTH hit cap by graft level (unchanged), further capped at max(1, wardLv) */
  regrowCap: [0, 1, 2],
  /** SCAB WEAVE: chance per level that a kill regrows a WARD hit (was .06). Gate H1 */
  scab: .03,
  /** SYS lever 1 / C19: WARD's weight in the pod roll at every tier (was .9 x dial). W1 owns the roll (podType) */
  wardPodW: .45,
} as const;

/** spec §2.1 "Recovery waves" (ECO §2.3, C17): typed pods flown in after every respawn and checkpoint restart. Gate E1:
 *  >= 2 pods within 10 s of each, R1 is 3 */
export const RECOVERY = {
  /** R1 arrives this long after control returns (3 s); with 120 f of i-frames it lands just after they end (C20) */
  r1: 180,
  /** R2 arrives this long after R1 (12 s) */
  r2: 720,
  /** R1 flies in at the ship's height +- this (px) */
  spread: 40,
} as const;

/** Decision 3A: ships in Descent 1 for every profile. REINFORCED HULL's ship arrives at the Descent 2 gate */
export const SHIPS = {
  /** spare ships at a Descent 1 start (3 ships: the one flying plus 2) */
  d1Spare: 2,
  /** the descent (loop) whose start brings HULL's ship */
  hullAt: 1,
  /** save v4: biomass refunded to a profile that owned HULL level 2 (spec §2.2) */
  hull2Refund: 500,
} as const;

/** Decision 4A: contraptions in Descent 1 (spec §2.2 "Contraptions") */
export const RIG_D1 = {
  /** only this many bolted rigs run in Descent 1: the first one */
  rigs: 1,
  /** at this level, whatever was bought */
  lvl: 1,
  /** it wakes once this many stages are cleared (the stage-2 tally: seal 1) */
  wakeAt: 2,
} as const;

/** spec §2.2 "Perk levels follow the seals": a perk's max is min(max, 1 + seal). Gate E7 */
export const perkCapOf = (max: number, seal: number, hard: boolean): number => (hard ? Math.min(max, 1 + (seal | 0)) : max);

/** the most WARD hits the ship can hold: wardLv (1/2/3) on long4, WARD_MAX elsewhere (spec "WARD level-up") */
export const wardCapOf = (P: any, hard: boolean, WARD_MAX: number): number => (hard ? Math.min(WARD_MAX, (P && P.wardLv) || 0) : WARD_MAX);

/** may LAST GASP fire now, and where is it marked spent? Very Hard: never. Normal and Hard: once per descent, in
 *  G.gaspD (the descent whose gasp is spent, -1 unspent: W0's run-save field, so an app kill can't refill it). Easy:
 *  once per stage, in G.gasp (the stage key, today's rule). Pure: returns what to check and write */
export function gaspSlot(G: any): { f: 'gaspD' | 'gasp'; k: number } | null {
  const r = deathTier(G).gasp;
  if (r === 'off') return null;
  return r === 'descent' ? { f: 'gaspD', k: G.loop | 0 } : { f: 'gasp', k: (G.stage | 0) + (G.loop | 0) * 10 };
}

// ---------------- the strip ----------------
/** the gun slots a gradual (Easy) death strips, first held first: WRAITH, the main-gun form, MISSILE/PYRE, THRUST */
export const EASY_ORDER = ['options', 'gun', 'side', 'speed'] as const;
/** the loadout a respawn keeps, from the ship that died (P0). Full strip: THRUST min(keep, speed), nothing else.
 *  Gradual: everything except the first held slot of EASY_ORDER; WARD and fragments are lost as on Normal */
export function keptLoadout(P0: any, t: DeathTier) {
  const out = { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0 };
  if (!P0) return out;
  if (t.strip === 'full') { out.speed = Math.min(t.thrustKeep, P0.speed | 0); return out; }
  Object.assign(out, { speed: P0.speed | 0, missile: P0.missile | 0, double: P0.double | 0, laser: P0.laser | 0, pyre: P0.pyre | 0, options: P0.options | 0 });
  for (const s of EASY_ORDER) {
    if (s === 'options' && out.options) { out.options = 0; break; }
    if (s === 'gun' && (out.double || out.laser)) { out.double = out.laser = 0; break; }
    if (s === 'side' && (out.missile || out.pyre)) { out.missile = out.pyre = 0; break; }
    if (s === 'speed' && out.speed) { out.speed = 0; break; }
  }
  return out;
}

// ---------------- grafts (Decision 2A, C28) ----------------
export interface GraftDef { id: string; k: string; n: readonly number[] }
/** the kill count a graft at level l starts from: the threshold that earned level l (0 at level 0) */
export const graftBase = (n: readonly number[], l: number): number => (l > 0 ? n[l - 1] : 0);
/** a death's graft cost on long4: every held graft loses a level AND its kill counter rewinds to the threshold that
 *  earned the level it fell to, so the lost level is earned again from scratch (gate D2). CALIBER's counter is G.gmk
 *  ('*'). `wiped`: the death also cleared the screen's pods (a checkpoint restart), so a graft pod that was on screen
 *  and not taken is lost too: its pending flag drops and its counter rewinds the same way. Returns true when any graft
 *  lost a level. Mutates G.gm, G.kk, G.gmk, G.gpend. No RNG */
export function graftRewind(G: any, defs: readonly GraftDef[], wiped: boolean): boolean {
  let lost = false;
  G.kk ||= {};
  for (const m of defs) {
    const held = (G.gm && G.gm[m.id]) || 0, pend = !!(G.gpend && G.gpend[m.id]);
    if (held <= 0 && !(wiped && pend)) continue;
    const l = Math.max(0, held - 1);
    if (held > 0) { G.gm[m.id] = l; lost = true; }
    const base = graftBase(m.n, l);
    if (m.k === '*') G.gmk = Math.min(G.gmk | 0, base);
    else G.kk[m.k] = Math.min(G.kk[m.k] || 0, base);
    if (wiped && G.gpend) G.gpend[m.id] = 0;
  }
  return lost;
}

// ---------------- the perk scar (Decision 2A) ----------------
/** perks weighted at or under this (POWER.perk) are never eaten: survival, economy and XP perks */
export const SCAR_MIN = .3;
/** the perk a death eats one level of: the held perk with the highest weight above SCAR_MIN, ties to the most recent
 *  pick in `order` (G.pkOrder, oldest first), then to the table order of `weights`. null = nothing eaten. Pure */
export function perkScarPick(pk: Record<string, number>, order: readonly string[], weights: Record<string, number>): string | null {
  let best: string | null = null, bw = SCAR_MIN, br = -2;
  const ids = Object.keys(weights);
  for (const id of ids) {
    if (!(pk[id] > 0)) continue;
    const w = weights[id], r = order.lastIndexOf(id);
    if (w > bw || (w === bw && best !== null && r > br)) { best = id; bw = w; br = r; }
  }
  return best;
}

// ---------------- contraptions (Decision 4A) ----------------
/** is the Descent 1 rig knocked offline? G.rigOff (0/1, W0's run-save field) is set by a death; G.rigOffC is the clear
 *  count at that death (not saved: flow.ts resumeRun puts the restored clear count back, since every checkpoint is
 *  written inside the stage of its death). It wakes once a later clear has happened (contraptions.ts clears the flag) */
export const rigDown = (G: any): boolean => !!G.rigOff && !(G.rigOffC != null && (G.cleared | 0) > G.rigOffC);
/** the rigs that actually run now: [{id, lvl}] from the bolted list. Descent 2 on (or off long4): every bolted rig at
 *  its bought level. Descent 1 on long4: only the first, at RIG_D1.lvl, from the stage-2 clear, and not while a death
 *  has knocked it offline (rigDown). Pure */
export function rigLiveOf(bolted: readonly { id: string; lvl: number }[], G: any, hard: boolean) {
  if (!hard || !G || (G.loop | 0) > 0) return bolted;
  const cl = G.cleared | 0;
  if (cl < RIG_D1.wakeAt) return [];
  if (rigDown(G)) return [];
  return bolted.slice(0, RIG_D1.rigs).map((r) => ({ id: r.id, lvl: Math.min(r.lvl, RIG_D1.lvl) }));
}

// ---------------- recovery waves ----------------
/** pod ids (player.ts SLOTS): THRUST, MISSILE, SPLIT, ARC, PYRE, WRAITH, WARD */
const THRUST = 0, MISSILE = 1, SPLIT = 2, ARC = 3, PYRE = 4, WRAITH = 5, WARD = 6;
/** wave R1's pods: THRUST, then the main-gun form the ship died with (SPLIT when it had none), then MISSILE (PYRE if it
 *  flew PYRE). `full`: the indices that come FULL (BLACK BOX: the main gun, C16) */
export function r1Pods(P0: any, blackBox: boolean): { ty: number[]; full: number[] } {
  const gun = P0 && P0.laser ? ARC : SPLIT, side = P0 && P0.pyre && !P0.missile ? PYRE : MISSILE;
  return { ty: [THRUST, gun, side], full: blackBox ? [1] : [] };
}
/** wave R2's pods: WRAITH and WRAITH, or WARD once WRAITH is at its cap (read when R2 flies) */
export const r2Pods = (wraithCapped: boolean): number[] => (wraithCapped ? [WARD, WARD] : [WRAITH, WRAITH]);

/** the recovery queue entries (W0 state.ts RecoveryQ: step.ts counts each `t` down and flies its pods through
 *  enemies/spawn.ts recoveryWave at 0): R1 at RECOVERY.r1, R2 RECOVERY.r2 after it, at the ship's height `y`. R2's
 *  WARD swap is read now, on the stripped ship. Never saved: saves wait until the queue is empty */
export function newRecovery(P0: any, blackBox: boolean, y: number, wraithCapped = false) {
  const r1 = r1Pods(P0, blackBox);
  return [
    { t: RECOVERY.r1, y, pods: r1.ty.map((ty, k) => (r1.full.includes(k) ? { ty, full: true } : { ty })) },
    { t: RECOVERY.r1 + RECOVERY.r2, y, pods: r2Pods(wraithCapped).map((ty) => ({ ty })) },
  ];
}
