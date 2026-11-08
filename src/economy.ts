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

/** a layout entry (spec §2.2) */
export type EntryId = 'short' | 'long4' | 'long5';
/** a stage kind (spec §2.2); lane A's `src/layout.ts` owns the stage list itself */
export type Kind = 'orbit' | 'biome' | 'interior' | 'drive';
/** the hits/min column a stage reads: by stage kind, and by biome slot for biome stages (spec §8) */
export type HpmCol = 'orbit' | 'biome0' | 'interior' | 'biome1' | 'drive';
export type Grade = 'S' | 'A' | 'B' | 'C';
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
const HPM_LONG4 = { orbit: HPM_LONG.orbit, biome0: HPM_LONG.biome0, biome1: HPM_LONG.biome1, drive: HPM_LONG.drive };
/** spec §7: the biomass targets are the same for both long entries (holds 2-4 purchases per Infirmary visit) */
const BIO_LONG: readonly [Band, Band, Band] = [[1300, 1500], [2100, 2400], [2600, 3600]];

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
    killBio: .47,
    // D31 §2.2: carrier pods are per spawn, so the keep falls by the stretch ratio to land D1 pods ~-35%:
    // .35 x .70 / 1.45 ~ .17 (post-stretch projection; provisional, re-fit in step 5 on pod-probe stages[].pods)
    capKeep: .17,
    // D31 §2.2: formations multiply with the stretch's spawn sections; .5 is the post-stretch projection (.7 on today's
    // stages). One R() per cleared formation on long4 only. Provisional, re-fit in step 5 (pod-probe kinds.pod)
    grpPod: .5,
    // D31 §2.3: measure first. If the stretched build ends D1 with more graft levels than the step-0 baseline, set the
    // measured kill ratio (~1.4) so grafts keep today's per-stage timing (pod-probe G.gm at each tally)
    graftMul: 1,
    intra: .35, // late Descent 1 would otherwise stay soft over a longer descent (depth-probe, playtest.mjs hits/min)
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
    glut: [3, 7], // ~9 Maw + midboss kills per descent
    d1Elite: { ord: 3, p: .05 }, // optional in spec §7: teaches elites before Descent 2 (stage 4 = biome slot 1)
    driveLife: { add: 1, cap: 5 }, // Q11: exposure per descent doubles
    hpm: HPM_LONG,
    hpmBanded: ['orbit', 'biome0', 'interior', 'biome1', 'drive'],
    targets: { lvD1: [13, 15], lvStage: { 0: 4, 1: 8 }, bio: BIO_LONG },
  },
};

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
export const capKept = (id: EntryId, r: number): boolean => !(r < 1 - E(id).capKeep);

/** D31: does a cleared formation drop its pod. `pod`: the biome breath's release formation, always. `rnd` is drawn
 *  only when the entry's grpPod is below 1 and the formation is not exempt (short draws nothing) */
export const grpDrops = (id: EntryId, pod: unknown, rnd: () => number): boolean => {
  const p = E(id).grpPod;
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
