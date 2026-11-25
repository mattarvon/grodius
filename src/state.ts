// Shared mutable game state: anything reassigned from more than one module lives here.
export const $: any = {};

// ---- the difficulty rebuild's G and P fields (DIFFICULTY-SPEC §5.6; W0 contract, scratchpad spec/W0-CONTRACT.md).
// $ stays `any` (the architecture: module state, no DI); these interfaces are the documented shape for W1-W4 and
// the probes. Every field is optional on a G: absent reads as the default named here, so a G built before a stream
// lands (or short's, which carries no tier) behaves exactly as today.

/** one queued recovery wave (spec §2.1 "Recovery waves", C17): W2's respawn() / deathRestart() push it, step.ts counts
 *  `t` down once a world step and calls enemies/spawn.ts recoveryWave(pods, y) at 0. Never saved: saves happen where
 *  the queue is empty (W2 asserts that at its save points) */
export interface RecoveryQ {
  /** world steps until the wave launches */
  t: number;
  /** the typed pods its carriers drop, in kill order (R1: THRUST, the main-gun form, MISSILE or PYRE; R2: WRAITH x2) */
  pods: readonly RecPod[];
  /** the lane; omitted: the ship's height when it launches (recoveryWave picks it, +-40 px) */
  y?: number;
}
/** a recovery pod: a player.ts SLOTS index (0 THRUST, 1 MISSILE, 2 SPLIT, 3 ARC, 4 PYRE, 5 WRAITH, 6 WARD); full: a
 *  FULL pod (BLACK BOX, C16) */
export interface RecPod { ty: number; full?: boolean }

/** G fields the rebuild adds */
export interface GDiff {
  /** the difficulty tier 0-3 (tier.ts): set at run start on long4 only (lab.ts tierPick), in the run save. Absent
   *  (short, a pre-tier save) reads Normal (tier.ts tierG) */
  tier?: 0 | 1 | 2 | 3;
  /** the integer rank (rank.ts rank($)), mirrored by step.ts once a world step, before the ship moves: for the HUD,
   *  debug and probes. Sim code calls the rank.ts helpers, which compute it live. The spec's `G.rank`: it is named `rk`
   *  because `G.rank` still holds the legacy power clamp min(1, G.pow) that the W4 fight files and the harness read
   *  until they move to rank.ts (W6 retires G.rank) */
  rk?: number;
  /** 1 while the ship's world x is inside a sigs.ts sigWindows() entry (step.ts): the 'setp' cap context. Absent = 0 */
  setp?: 0 | 1;
  /** queued recovery waves (RecoveryQ); absent = none */
  recovery?: RecoveryQ[];
  /** red pods picked up this run: every 12th becomes blue (spec §2.2, W1). In the run save. Absent = 0 */
  redN?: number;
  /** 1 while a blue that landed on an authored opener's pod is owed to the next red that is not an opener's
   *  (enemies/update.ts dropCap). In the run save. Absent = 0 */
  blueOwe?: 0 | 1;
  /** 1 once the run's first SEAL PRIMING part was stored and its one-time log line queued (player.ts). In the run save
   *  and kept over a death restart. Absent = 0 */
  primeLog?: 0 | 1;
  /** 1 while the bolted contraption is knocked offline by a death until the next stage clear (decision 4A, W2's
   *  rigLive). In the run save. Absent = 0 */
  rigOff?: 0 | 1;
  /** the descent (G.loop) whose LAST GASP is spent on a per-descent tier (tier.ts TIER.gasp); absent or -1: unspent.
   *  In the run save */
  gaspD?: number;
}
/** P fields the rebuild adds */
export interface PDiff {
  /** the ship's displacement over the last frame (px), written by player.ts after the move; aimLead (W1) reads it.
   *  0 on a still or fresh ship; not saved */
  vx?: number;
  vy?: number;
}
