// =====================================================================
//  ECONOMY TABLES PER LAYOUT ENTRY (design/content-expansion.md §7 and §8; build plan LS1 item G0).
//  Each layout entry (`short`, `long4`, `long5`, spec §2.2) carries its own seals, grade normalisation, S-grade rule,
//  stage XP, per-kill XP and biomass factors, intra-descent depth, GLUTTONY thresholds, Descent 1 elites, Drive lives
//  and would-be hits/min targets. The functions below (all but econId) are pure: they take the entry id and plain numbers, read no
//  module state and draw no RNG, so they can be unit tested.
//
//  WIRED (LS1 item G) for the active layout entry (`econId()`): stages.ts (seals, grades), perks.ts (stage XP),
//  enemies/update.ts (kill XP, kill biomass, D31 formation pods), enemies/spawn.ts (D31 carrier keep), depth.ts (intra-descent depth) and mutations.ts (GLUTTONY, D31 graft thresholds) read it. The
//  `short` entry reproduces today's literals exactly (frozen golden copy in tests/unit/economy.test.ts), so the short
//  layout is unchanged. Descent 1 elites and Drive lives are not wired: both are null on short and long4 (D26), and
//  `long5` wires them at LS3-0.
//
//  Values marked *start* are the spec's starting points; item G tunes them against pod-probe until the targets in
//  `targets` are met. Values marked Q<n> wait on Matt's answer to spec §12 question n (the recommended default is here).
// =====================================================================
import { layout } from './layout';
import { NOTICE } from './notice';

/** a layout entry (spec §2.2) */
export type EntryId = 'short' | 'long4' | 'long5';
/** a stage kind (spec §2.2); lane A's `src/layout.ts` owns the stage list itself */
export type Kind = 'orbit' | 'biome' | 'interior' | 'drive';
/** the hits/min column a stage reads: by stage kind, and by biome slot for biome stages (spec §8) */
export type HpmCol = 'orbit' | 'biome0' | 'interior' | 'biome1' | 'drive';
export type Grade = 'S' | 'A' | 'B' | 'C';
/** D58 (Matt, 2026-11-15; rebuilt on D61, 2026-11-21): what changes in a late stage (lateStage: biome slot B and later,
 *  and the Drive) on a long entry. null = nothing (short: today's game). Enemy fire changes only on the Drive (D62);
 *  D58 #1, the everywhere version, was dropped once the fixed probe showed late pressure at its band. The death refill
 *  is untouched: D58 #5 was dropped for D61 Pass 2's BLACK BOX rule. production/decision-log.md D62 */
export interface LateSet {
  /** D58 #4: held midboss HP multiplier in biome slot B and later (spawn.ts midboss), on top of D27's MID_HP. Revises
   *  D27/D29's one slot-blind band: slot B is re-banded to the power runs carry into it */
  midLate: number;
  /** D58 #4: per-kind overrides of midLate, for a kind the one multiplier leaves outside its band */
  midLateK: Readonly<Record<string, number>>;
  /** D62 (Matt, 2026-11-21): the Drive stage's regular-enemy cooldowns x driveCool (cadence.ts coolFor): the one stage
   *  under its D61 band on the fixed probe. 1 = none */
  driveCool: number;
  /** D62: the Drive stage's regular shooters' first-shot delay (frames) in place of each spawner's own range; null = their
   *  own. Still one ri() draw */
  driveFirst: readonly [number, number] | null;
}
/** D58 #3: rank drones (formationExtra) = round(k * min(cap, pow)); `extra` = the extra drones carry no pod and drop no
 *  biomass, and pay `xp` x their kill XP. short keeps today's round(3 * min(2, pow)) at full pay */
export interface FormSet { k: number; cap: number; xp: number; extra: boolean }
/** D61 Pass 1's rate knobs (src/notice.ts NOTICE): how often the threats that notice the ship come */
export type NoticeRates = Pick<typeof NOTICE, 'hazEvery' | 'hazEveryD3' | 'flayEvery' | 'flayCool' | 'hazInFight'>;
/** D63 (Matt, 2026-11-21: "I don't need to do anything but hold the spacebar down. can't die and I am way overpowered,
 *  and the enemies are predictable and die instantly"): Pass 2's curve on a long entry. null = none (short: today's
 *  game). Gate: a parked mortal bot (tools/pod-probe.mjs --mortal --park) game-overs in Descent 1. decision-log D63 */
export interface HardSet {
  /** shield hits a WARD pod adds once WARD is at its cap (player.ts applyPower), up to WARD_MAX. Was a full refill.
   *  DIFFICULTY-SPEC §2.1 replaces it (shield capped at wardLv): HANDED TO W2, which may edit or retire this field and
   *  its long4 value (the one exception to W0 owning economy.ts); W6 deletes what is left */
  wardTop: number;
  /** most FULL pods a death gives back, main gun first: the boss-fight lifeline (flow.ts bossRecoveryNote) and BLACK
   *  BOX (flow.ts blackBox). Was up to 3 and everything. DIFFICULTY-SPEC §2.1 replaces both (tier.ts TIER.lifeline /
   *  TIER.blackBox, R1's FULL main-gun pod): HANDED TO W2 like wardTop */
  recover: number;
  /** regular enemies' HP x (1 + powHP * min(powCap, G.pow)) at spawn (depth.ts depthHP): toughness follows the one
   *  power budget (src/power.ts), so a grown build no longer deletes fodder on contact. Revises D1's power rule */
  powHP: number;
  powCap: number;
  /** the Gravity Drive's HP x(1 + driveRank * G.rank) (depth.ts driveMul) on this entry, in place of DEPTH.driveRank
   *  (short keeps DEPTH's .6). DIFFICULTY-SPEC C22 / GR rule 6: 0 on long4, rank never changes HP */
  driveRank: number;
  /** CALIBER / SERRATION graft damage per level (mutations.ts gunDm). Was 1.22 / 1.25 */
  cal: number;
  serr: number;
  /** D61 Pass 1 at full strength (undoes D62's toning; short keeps D62's rates) */
  notice: NoticeRates;
}
/** a stage's grading counters (the fields of `G.st` that grading reads) */
export interface StageCounts { kills: number; spawned: number; hits: number; deaths: number }
type Band = readonly [number, number];

export interface EconEntry {
  /** stages per descent; must match lane A's layout entry */
  n: number;
  /** clears-in-a-run -> seal tier broken (stages.ts clearStage) */
  seals: Readonly<Record<number, number>>;
  /** grade normalisation reference seconds: the hit penalty is scaled by ref/Ts (Ts = the stage's scroll seconds).
   *  null = no normalisation (today's absolute penalty) */
  gradeRef: number | null;
  /** most hits an S grade allows (deaths must be 0 either way) */
  sHits: number;
  /** stage-clear XP lump = a + b * ord + c * loop (perks.ts stageXP) */
  xp: { a: number; b: number; c: number };
  /** per-kill XP multiplier (enemies/update.ts gainXP on kill) */
  killXP: number;
  /** kill biomass multiplier (the pods that kills drop; grade pay and Infirmary pay are not scaled) */
  killBio: number;
  /** D31: chance a carrier spawn keeps its pod (enemies/spawn.ts mk: the existing keep roll's threshold, no new draw) */
  capKeep: number;
  /** D31: chance a cleared formation drops its pod (enemies/update.ts killEnemy). 1 = always, and no R() is drawn.
   *  The biome breath's release formation (group.pod) always drops */
  grpPod: number;
  /** D31: multiplier on the kill-count graft thresholds (mutations.ts GM n), GLUTTONY excepted (it reads `glut`) */
  graftMul: number;
  /** biomass paid once per profile for the first kill of each midboss kind (spec §6.4), recorded in meta.mbK; 0 = none */
  firstKill: number;
  /** intra-descent depth: dep = loop + intra * ord / (n - 1) */
  intra: number;
  /** D58 #2: stage-boss HP x (1 + bossOrd * ord / (n - 1)) by the stage's order in the descent (depth.ts depthHP, the
   *  shared stage-boss path: every biome boss, a registry stage boss included). 0 = none */
  bossOrd: number;
  /** D58 #2: a stage-boss kind's share of bossOrd (default 1), so one global knob can land every slot-B boss in its
   *  band: a kind whose base fight is already long takes less, the Maw (short by its escape clock) more */
  bossOrdW: Readonly<Record<string, number>>;
  /** D58 #3: rank drones (spawn.ts formationExtra) and what they pay */
  form: FormSet;
  /** D58 #4 and D62's Drive bump: the late-stage set; null = none */
  late: LateSet | null;
  /** D63: Pass 2's curve (survival, toughness, rank, Pass 1 rates); null = none */
  hard: HardSet | null;
  /** GLUTTONY graft thresholds (mutations.ts GM 'over' n: Maw + midboss kills) */
  glut: readonly number[];
  /** Descent 1 elites from stage ordinal `ord` at chance `p`; null = none in Descent 1 (today) */
  d1Elite: { ord: number; p: number } | null;
  /** ships gained per Gravity Drive kill, up to `cap`; null = none (today: lives come from hull only) */
  driveLife: { add: number; cap: number } | null;
  /** would-be hits/min targets for the invincible bot, rows D1..D3 (later descents read D3); null = no per-kind row */
  hpm: Readonly<Partial<Record<HpmCol, readonly [number, number, number]>>> | null;
  /** the columns held to the band at this entry's exit (others are measured only) */
  hpmBanded: readonly HpmCol[];
  /** probe targets item G and LS3-0 test against; null = none set (short: today's game is the reference) */
  targets: {
    /** ship level at the end of Descent 1 */
    lvD1: Band;
    /** ship level after Descent 1 stage ord, where the spec sets one */
    lvStage?: Readonly<Record<number, number>>;
    /** run biomass by the end of Descent 1, 2, 3 */
    bio: readonly [Band, Band, Band];
  } | null;
}

/** spec §8: the default row set for both long entries. `long4` has no interior stage, so it gets no interior column
 *  (and room for a `long4` row of its own if item G needs one, spec §8) */
const HPM_LONG = {
  orbit: [.5, 1.0, 1.3],
  biome0: [.8, 1.3, 1.6],
  interior: [.8, 1.2, 1.5],
  biome1: [1.1, 1.6, 1.9],
  drive: [1.3, 1.8, 2.0],
} as const;
/** D61 (Matt, 2026-11-20, "make the game harder overall"): long4 (the default layout) gates on the HARDER bands, rows
 *  D1..D3; they replace spec §8's gentle cells for long4 only (long5 keeps HPM_LONG). Floors are the gate */
const HPM_LONG4 = {
  orbit: [1.0, 1.6, 2.0],
  biome0: [1.8, 2.6, 3.0],
  biome1: [3.0, 3.8, 4.2],
  drive: [3.5, 4.2, 4.6],
} as const;
/** spec §7: the biomass targets are the same for both long entries (holds 2-4 purchases per Infirmary visit) */
const BIO_LONG: readonly [Band, Band, Band] = [[1300, 1500], [2100, 2400], [2600, 3600]];

/** today's formation density and pay (short, long5) */
const FORM_TODAY: FormSet = { k: 3, cap: 2, xp: 1, extra: false };
/** D58 #4 (rebuilt on D61): long4's late-stage set. Slot-B midbosses to D61's 10-13 s at the BIOME B kit (rank .71),
 *  midboss-probe --ord 2 --leave 1260; D61 base (x1): Choir 5.8, Womb 4.9, Apprentice 4.8, Brood 4.1 s */
const LATE_LONG4: LateSet = {
  // #4: per kind, each to ~11 s. DIFFICULTY-SPEC §2.3: choir 2.0 -> 1.6 [FIT, provisional until W4's eye-takes-.4
  // weak point lands; measure gate K3 (B 10-13 s) only after W4 merges: on W0-W3 builds the slot-B Choir is ~20% softer]
  midLateK: { choir: 1.6, cyst: 2.4, prentice: 2.4, brood: 2.7 },
  driveFirst: [20, 60], // D62: Drive shooters fire on arrival (was each spawner's 40-150 f; most died first)
  driveCool: .7, // D62: the Drive's fodder fires sooner again (tools/playtest.mjs hits/min, 1-4 column)
  midLate: 2.2, // #4: any other held kind in slot B (a new pool kind starts here)
};

/** D63 (Matt, 2026-11-21): long4's Pass 2 curve. Fitted on pod-probe --mortal --park (the gate) and --mortal --pilot */
const HARD_LONG4: HardSet = {
  // W2 (DIFFICULTY-SPEC §2.1 Survival): a WARD pod at its cap adds 1 hit, and player.ts wardCap() caps it at the WARD
  // level (1/2/3). Gates H1 / H2
  wardTop: 1,
  // W2 (C15): the boss-fight lifeline's FULL pods, kept on Easy only (death.ts DEATH_TIER lifeline). BLACK BOX no longer
  // reads it on long4 (C16: R1's main-gun pod comes FULL instead, flow.ts queueRecovery). Gate E1
  recover: 2,
  // DIFFICULTY-SPEC C30 / GR rule 5: 0. Popcorn dies in one main-gun hit at every power level; HP scaling made
  // enemies last, not threaten [SYS §3]. Was 1.5 (D63). Gate R2 (dps-probe TTK rig: drone 1 bolt at every kit)
  powHP: 0,
  powCap: 2, //  the cap every()/BS()/formation() already put on pow (read only while powHP > 0)
  driveRank: 0, // C22: was DEPTH.driveRank .6. W4 re-fits the Drive's base HP (start 700, gate K3) and C23's clock holds the fight
  // D63's rankCap 1.25 is deleted (spec §2.1): G.rank is the legacy min(1, pow) on every layout again, and the
  // rebuild's integer rank lives in src/rank.ts
  cal: 1.18, serr: 1.2, // package Pass 2: graft damage softened (was 1.22 / 1.25)
  notice: { hazEvery: 3, hazEveryD3: 2, flayEvery: 1, flayCool: 1, hazInFight: true }, // D61 as merged
};

export const ECON: Readonly<Record<EntryId, EconEntry>> = {
  // today's game, exactly. Deleted one milestone after the long layout becomes the default (spec §2.2)
  short: {
    n: 4,
    seals: { 2: 1, 4: 2, 6: 3 }, // end of the first biome, end of Descent 1, Descent 2's first biome
    gradeRef: null,
    sHits: 0,
    xp: { a: 30, b: 45, c: 40 },
    killXP: 1,
    killBio: 1,
    capKeep: .35, // today's keep roll (spawn.ts dropped a carrier's pod at R() < .65), so the same draws keep the same pods
    grpPod: 1, // today: every cleared formation drops, and no draw is made (short's R() count is unchanged)
    graftMul: 1, // today's GM thresholds
    firstKill: 0, // today's game pays nothing and writes no kill record
    intra: 0, // depth is per descent only
    bossOrd: 0, // today: a stage boss's HP reads the loop only
    bossOrdW: {},
    form: FORM_TODAY,
    late: null, // today's game in every stage
    hard: null, // today's game: WARD refills, full lifeline, flat fodder HP, rank cap 1, D62's Pass 1 rates
    glut: [2, 4],
    d1Elite: null,
    driveLife: null,
    hpm: null, // no per-kind targets today: the whole-run 1-2 band of pacing §3.9 (D2-D3) is the only one
    hpmBanded: [],
    targets: null,
  },
  // what LS1 ships behind the flag: 4 long stages, measured against its own bands
  long4: {
    n: 4,
    // {1,3,5} would break after Orbit, biome B and Descent 2's Orbit, which matches no rationale: keep today's
    // schedule (seals at ~3.3, 8 and 11.5 min) and change no seal copy in LS1
    seals: { 2: 1, 4: 2, 6: 3 },
    gradeRef: 35, // today's ~35 s of scroll, so a 35 s stage grades exactly as today; without it grades collapse on 1.75x the exposure
    sHits: 1, // Q9: a two-minute no-hit stage is a different ask
    xp: { a: 30, b: 45, c: 40 }, // today's lump; the per-kill cut below does the work
    // D31 (audit/d31-economy.md §1-2.1): LV 10-11 at the end of Descent 1 over the stretched 120-150 s stages. .30 is the
    // post-stretch projection (fit range .25-.35; LS1 item G's .85 measured LV 13-14 on today's stages). Provisional,
    // re-fit in step 5 on the stretched build: k = (1010 - 390) / raw kill XP (pod-probe xpTot, seeds 1-5)
    killXP: .3,
    firstKill: 100, // spec §6.4; once per profile, so it is not in the steady-state D1 biomass bands
    // D1 biomass 1300-1500 steady state (pod-probe, item G; run biomass minus the once-per-profile first-kill pay).
    // The spec's .75 start measured 1311-1681 with one midboss per biome stage, then 1412-1834 (median 1627) once F's
    // second midboss landed
    // D31 §2.4: the stretch grows kill pods ~x1.45 (1434 -> ~1900), so .65 x 1400/1900 ~ .47 holds the band. Provisional,
    // re-fit in step 5: killBio x (1400 - B_fixed) / (B_measured - B_fixed) (pod-probe finalBio, seeds 1-5)
    // Fit 1 (2026-11-08): .47 gave steady-state 1619 [1440-1723]; B_fixed = 4 S grades x 40 + 3 choices x 30 = 250,
    // so .47 x (1400 - 250) / (1619 - 250) = .395, rounded to .40. Final build: steady 1366 [1235-1536], in band (production/qa/evidence/ls2-d31.md)
    killBio: .4,
    // D31 §2.2: carrier and formation pods are per spawn, the variable faucet. Fit 1 (2026-11-08, ls2-d31 report): at the
    // .17 / .5 projections the stretched build gave 48 D1 pod pickups, the same as main's 48 (spawns rose x1.8, not
    // x1.45). Fixed pods (midboss/Maw 11, Saucer 2, choice 3, release 2) are 18 of them, so -35% (31) needs the variable
    // 30 cut to ~13: f = (.65 x 48 - 18) / 30 = .44 on both knobs. pod-probe stages[].src, seeds 1/3/5/7/11
    // DIFFICULTY-SPEC §2.2 random faucet: .075 -> .05 [FIT to the 32-35 Descent 1 total, gate E2] now that each
    // stage's authored opening carriers (group.open, W3) and the typed recovery waves carry the guaranteed pods
    capKeep: .05,
    // One R() per cleared non-release formation, long4 only (short: grpPod 1, no draw). D31 fit 1 gave .22; spec §2.2
    // cuts it to .12 [FIT, gate E2] for the same reason. The tier's faucet multiplier applies here (tier.ts capRate)
    grpPod: .12,
    // D31 §2.3: measured (fit 1, 2026-11-08): the stretched build ended D1 with 6-7 graft levels against main's 5, on
    // x1.8 the kills (674 vs 375 median). graftMul = the kill ratio, so grafts keep today's per-stage timing
    // (pod-probe grades[3].kit.gm, kills)
    graftMul: 1.8,
    intra: .35, // late Descent 1 would otherwise stay soft over a longer descent (depth-probe, playtest.mjs hits/min)
    // D58 #2 (rebuilt on D61): x1.3 in slot A and x1.6 in slot B by default; the biome bosses now fight in slot A only
    // (THE KEEPSAKE holds slot B). Weights to D61's 15-22 s at the BIOME B kit (boss-probe --ord 1 / 2): Bloat x1.2 (13.1
    // s at x1), Butcher x1.6 (10.1), the Maw capped at x2 (4.5 s; more would put the STAGE 1 kit at its 28 s escape
    // clock). THE KEEPSAKE 0: D59 fitted its base HP 440 to 38-46 s at kit=mid with no stage-order term (its note asks
    // for exactly this if D58 #2 ships), and boss-probe gives it 34.6 s at the STAGE 1 kit, 28.5 at BIOME B
    bossOrd: .9,
    bossOrdW: { crux: .667, butcher: 2, maw: 3.333, keepsake: 0 },
    // D58 #3 (Matt): break the snowball (+2 rank drones at most, half XP, no pod/biomass). DIFFICULTY-SPEC §2.1: k 0,
    // rank never changes formation size (GR rule 6); `extra` and `xp` stay as the record and price nothing at k 0
    form: { k: 0, cap: 1, xp: .5, extra: true },
    late: LATE_LONG4,
    hard: HARD_LONG4,
    // GLUTTONY counts Maw + midboss kills: per long4 descent the Saucer + 2 + 2 biome midbosses, the Open Orbit Maw and
    // 0-2 biome Maw stage bosses, so 6-8 when every one is killed (short: 2-4)
    glut: [3, 6],
    d1Elite: null,
    driveLife: null,
    hpm: HPM_LONG4,
    // Orbit (no slot B) and the Drive (no approach midboss) are measured in LS1 and banded from LS2-orbit / LS2-ship
    hpmBanded: ['biome0', 'biome1'],
    // D31: Descent 1 ends at LV 10-11; at least LV 3 after Open Orbit so the first picks still land in stage 1 (risk R5)
    targets: { lvD1: [10, 11], lvStage: { 0: 3 }, bio: BIO_LONG },
  },
  // the D19 target and the LS3-0 exit: Orbit, biome, interior, biome, Drive
  long5: {
    n: 5,
    seals: { 1: 1, 3: 2, 5: 3 }, // Q10: after the Orbit Maw, the interior and the Drive (~1.5, 5.5, 9.5 min)
    gradeRef: 35,
    sHits: 1, // Q9
    xp: { a: 40, b: 35, c: 40 },
    killXP: .75, // LV 4 / 8 after stages 1 / 2, LV 14±1 at the end of Descent 1 (pod-probe, LS3-0)
    killBio: .6, // Q12: holds purchases per Infirmary visit at 2-4 items
    capKeep: .35, // D31 is a long4 cut: long5 keeps today's pod faucets until LS3-0 fits its own
    grpPod: 1,
    graftMul: 1,
    firstKill: 100, // spec §6.4
    intra: .35,
    bossOrd: 0, // D58 is a long4 pass, as D31 was: long5 keeps today's until LS3-0 fits its own
    bossOrdW: {},
    form: FORM_TODAY,
    late: null,
    hard: null, // a long4 pass, as D58 was
    glut: [3, 7], // ~9 Maw + midboss kills per descent
    d1Elite: { ord: 3, p: .05 }, // optional in spec §7: teaches elites before Descent 2 (stage 4 = biome slot 1)
    driveLife: { add: 1, cap: 5 }, // Q11: exposure per descent doubles
    hpm: HPM_LONG,
    hpmBanded: ['orbit', 'biome0', 'interior', 'biome1', 'drive'],
    targets: { lvD1: [13, 15], lvStage: { 0: 4, 1: 8 }, bio: BIO_LONG },
  },
};

/** D58 #4 / D62: is a stage of kind `kind` in biome slot `slot` a late stage: biome slot B or later, or the Drive */
export const lateStage = (kind: Kind | undefined, slot: number): boolean => kind === 'drive' || (kind === 'biome' && slot >= 1);

/** D58 #2: stage-boss kind `k`'s HP multiplier at stage ordinal `ord`: 1 + bossOrd * w_k * ord / (n - 1), w_k from
 *  bossOrdW (default 1); 1 on short */
export const bossOrdMul = (id: EntryId, ord: number, k = ''): number => {
  const e = E(id);
  return e.bossOrd && e.n > 1 ? 1 + e.bossOrd * (e.bossOrdW[k] ?? 1) * Math.min(1, Math.max(0, ord / (e.n - 1))) : 1;
};

/** D58 #3: rank drones in a formation at power `pow`: round(k * min(cap, pow)) (short: round(3 * min(2, pow)), 0..6) */
export const formExtra = (id: EntryId, pow: number): number => { const f = E(id).form; return Math.round(Math.min(f.cap, pow || 0) * f.k); };

/** the hits/min exit band: within ±30% of the target (build plan item G) */
export const HPM_TOL = .3;

const E = (id: EntryId): EconEntry => ECON[id];

/** the economy entry a layout id reads: its own entry, or `short` for an id with none */
export const econOf = (layoutId: string): EntryId => (Object.hasOwn(ECON, layoutId) ? (layoutId as EntryId) : 'short');
/** the active layout's economy entry: the one impure helper here (it reads src/layout.ts at call time, so a run
 *  started after setLayout() reads the new entry) */
export const econId = (): EntryId => econOf(layout().id);

/** seal tier scheduled for the `cleared`-th stage clear of the run, or 0. The caller keeps clearStage's guard that a
 *  tier only breaks if it is above G.seal */
export const sealAt = (id: EntryId, cleared: number): number => E(id).seals[cleared] || 0;

/** grade points: kill% x100 - 10 x hits (x min(1, ref/Ts) on a normalised entry) - 30 x deaths. Ts = the stage's scroll
 *  seconds (stages.ts stageTs). Clamped at 1 (D26, Matt): a stage shorter than the reference never grades its hits
 *  harder than today; a longer one weighs each hit less. Wiring must pass Ts on the long entries */
export function gradePts(id: EntryId, st: StageCounts, Ts?: number): number {
  const ref = E(id).gradeRef, pct = st.kills / Math.max(1, st.spawned);
  // no usable Ts (missing, 0, negative, NaN): grade as a reference-length stage rather than divide by it
  const hitW = ref == null || !(Ts > 0) ? 1 : Math.min(1, ref / Ts);
  return pct * 100 - st.hits * 10 * hitW - st.deaths * 30;
}

/** the stage grade (Ts as gradePts); an escaped boss always grades C (D5b) */
export function gradeOf(id: EntryId, st: StageCounts, Ts?: number, escaped = false): Grade {
  if (escaped) return 'C';
  const pts = gradePts(id, st, Ts);
  if (pts >= 70 && st.hits <= E(id).sHits && !st.deaths) return 'S';
  if (pts >= 50) return 'A';
  if (pts >= 30) return 'B';
  return 'C';
}

/** stage-clear XP lump for stage ordinal `ord` (0-based) in descent `loop` (0-based) */
export const stageXP = (id: EntryId, ord: number, loop: number): number => {
  const x = E(id).xp;
  return x.a + x.b * ord + x.c * loop;
};

/** XP for a kill whose base XP is `base` */
export const killXP = (id: EntryId, base: number): number => base * E(id).killXP;

/** biomass for a kill pod worth `v` */
export const killBio = (id: EntryId, v: number): number => v * E(id).killBio;

/** D31: does a carrier spawn keep its pod, given the keep roll r (one R() draw). Drops at r < 1 - capKeep, the old
 *  `r < .65` exactly on short (1 - .35 === .65 in doubles), so the same draw keeps the same pods */
export const capKept = (id: EntryId, r: number, m = 1): boolean => !(r < 1 - E(id).capKeep * m); // m: the tier's faucet (tier.ts capRate; 1 on short)

/** D31: does a cleared formation drop its pod. `pod`: the biome breath's release formation, always. `rnd` is drawn
 *  only when the entry's grpPod is below 1 and the formation is not exempt (short draws nothing) */
export const grpDrops = (id: EntryId, pod: unknown, rnd: () => number, m = 1): boolean => {
  const p = E(id).grpPod * m; // m: the tier's faucet (tier.ts capRate; 1 on short, which still draws nothing)
  return !!pod || p >= 1 || rnd() < p;
};

const graftMemo = new Map<readonly number[], { m: number; n: readonly number[] }>();
/** D31: a graft's kill-count thresholds on the entry: `base` itself at graftMul 1 (no copy), else base x graftMul
 *  rounded, at least 1 (memoised per base, so countKill allocates nothing per kill) */
export const graftN = (id: EntryId, base: readonly number[]): readonly number[] => {
  const m = E(id).graftMul;
  if (m === 1) return base;
  const c = graftMemo.get(base);
  if (c && c.m === m) return c.n;
  const n = base.map((v) => Math.max(1, Math.round(v * m)));
  graftMemo.set(base, { m, n });
  return n;
};

/** first-kill biomass for midboss kind `k` given the profile's kill record `rec` (meta.mbK): the entry's pay, or 0
 *  when the entry pays none or the kind is already recorded. The record is the guard against paying twice, so a kill
 *  replayed after a resume (H) pays nothing */
export const firstKillPay = (id: EntryId, rec: Readonly<Record<string, number>> | null | undefined, k: string): number =>
  E(id).firstKill > 0 && !(rec && Object.hasOwn(rec, k) && rec[k]) ? E(id).firstKill : 0;

/** pay `n` biomass: always to the run's total G.bio, and to the wallet meta.bio only past what this run has already
 *  banked. meta.bio banks at once and survives a rewind, G.bio rewinds with the checkpoint, so without this a SURFACE +
 *  RE-ENTER (or option b's restart) replays the same kills, SURPLUS pods, boost and stage-clear pay and banks them again
 *  (ls2-read report, economy-designer; ls1-audit). meta.bioS/bioV hold the run seed and the mark; another seed means a
 *  new run, so nothing resets it. First-kill pay is once per profile, so it stays out of the mark (G.bioFk, enemies/
 *  update.ts firstKill): a replay cannot re-earn it. With no rewind the wallet gets exactly n, as it always did.
 *  Invariant: nothing subtracts from G.bio during a run, only a rewind lowers it (bioreplay.test.ts pins that); the mark
 *  reads G.bio's rise as earnings, so a subtraction would read as a replay and silently stop the pay.
 *  newGame clears the mark. A dev jump (G.jump) neither reads nor writes it: ?seed= can repeat a seed on one profile, and
 *  a jump would then pay nothing until it passed that seed's mark. The seed key still guards an app kill before the save */
export function bankBio(n: number, G: any, m: any): void {
  if (G.jump) { G.bio += n; m.bio += n; return; }
  const was = G.bio - (G.bioFk || 0), now = was + n, hi = m.bioS === G.seed ? m.bioV || 0 : 0;
  G.bio += n;
  if (now <= hi) return;
  m.bio += was >= hi ? n : now - hi;
  m.bioS = G.seed;
  m.bioV = now;
}

/** depth for regular enemies and midbosses at stage ordinal `ord` of descent `loop`: equals `loop` at each descent's
 *  first stage (so Open Orbit in Descent 1 stays at 1x) and reaches loop + intra at its last. The Drive's own HP keeps
 *  the integer loop (depth.ts driveMul) */
export const descDepth = (id: EntryId, loop: number, ord: number): number => {
  const e = E(id);
  return e.intra && e.n > 1 ? loop + e.intra * Math.min(1, Math.max(0, ord / (e.n - 1))) : loop;
};

/** GLUTTONY graft thresholds (Maw + midboss kills per level) */
export const gluttonyN = (id: EntryId): readonly number[] => E(id).glut;

/** chance that a Descent 1 spawn at stage ordinal `ord` is elite (later descents use enemies/elite.ts eliteChance) */
export const d1EliteChance = (id: EntryId, ord: number): number => {
  const d = E(id).d1Elite;
  return d && ord >= d.ord ? d.p : 0;
};

/** ships after a Gravity Drive kill; never takes a ship away from a run already above the cap */
export const livesAfterDrive = (id: EntryId, lives: number): number => {
  const d = E(id).driveLife;
  return d ? Math.max(lives, Math.min(d.cap, lives + d.add)) : lives;
};

/** the hits/min column a stage reads (`slot` = biome slot 0/1; ignored for other kinds) */
export const hpmCol = (kind: Kind, slot = 0): HpmCol => (kind === 'biome' ? (slot ? 'biome1' : 'biome0') : kind);

/** would-be hits/min target and its ±30% band for a stage, or null where the entry sets none. `banded` says whether
 *  the stage is held to the band at this entry's exit or only measured. The spec sets D1-D3 only: Descent 4 and later
 *  read the D3 row until a later descent gets targets of its own */
export function hpmTarget(id: EntryId, kind: Kind, slot: number, loop: number): { t: number; lo: number; hi: number; banded: boolean } | null {
  const e = E(id), col = hpmCol(kind, slot), row = e.hpm && e.hpm[col];
  if (!row) return null;
  const t = row[Math.min(row.length - 1, Math.max(0, loop))];
  return { t, lo: t * (1 - HPM_TOL), hi: t * (1 + HPM_TOL), banded: e.hpmBanded.includes(col) };
}

const NOTICE_OF: Readonly<Record<EntryId, typeof NOTICE>> = {
  short: NOTICE, long4: { ...NOTICE, ...HARD_LONG4.notice }, long5: NOTICE,
};
/** D63: Pass 1's knobs for entry `id`: NOTICE with the entry's HardSet rates over it (short and long5: D62's NOTICE) */
export const noticeOf = (id: EntryId): typeof NOTICE => NOTICE_OF[id];
