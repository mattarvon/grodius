// =====================================================================
//  ECONOMY TABLES PER LAYOUT ENTRY (design/content-expansion.md §7 and §8; build plan LS1 item G0).
//  Each layout entry (`short`, `long4`, `long5`, spec §2.2) carries its own seals, grade normalisation, S-grade rule,
//  stage XP, per-kill XP and biomass factors, intra-descent depth, GLUTTONY thresholds, Descent 1 elites, Drive lives
//  and would-be hits/min targets. The functions below are pure: they take the entry id and plain numbers, read no
//  module state and draw no RNG, so they can be unit tested and wired later.
//
//  NOT WIRED YET (G0). stages.ts, perks.ts, depth.ts, mutations.ts still hold today's literals. LS1 item G wires the
//  `long4` entry; the `short` entry reproduces those literals exactly (pinned in tests/unit/economy.test.ts against the
//  live code), so wiring it changes nothing.
//
//  Values marked *start* are the spec's starting points; item G tunes them against pod-probe until the targets in
//  `targets` are met. Values marked Q<n> wait on Matt's answer to spec §12 question n (the recommended default is here).
// =====================================================================

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
  /** clears-in-a-run -> seal tier broken (stages.ts SEAL_AT) */
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
const { interior: _noInterior, ...HPM_LONG4 } = HPM_LONG;
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
    killXP: .75, // *start*: LV 13±1 at the end of Descent 1 (pod-probe, item G)
    killBio: .75, // *start*: one fewer long stage than long5 needs a smaller cut (pod-probe D1-D3 biomass, item G)
    intra: .35, // late Descent 1 would otherwise stay soft over a longer descent (depth-probe, playtest.mjs hits/min)
    glut: [3, 6], // ~5 midbosses per descent in LS1
    d1Elite: null,
    driveLife: null,
    hpm: HPM_LONG4,
    // Orbit (no slot B) and the Drive (no approach midboss) are measured in LS1 and banded from LS2-orbit / LS2-ship
    hpmBanded: ['biome0', 'biome1'],
    targets: { lvD1: [12, 14], bio: BIO_LONG },
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

/** seal tier scheduled for the `cleared`-th stage clear of the run, or 0. The caller keeps clearStage's guard that a
 *  tier only breaks if it is above G.seal */
export const sealAt = (id: EntryId, cleared: number): number => E(id).seals[cleared] || 0;

/** grade points: kill% x100 - 10 x hits (x ref/Ts on a normalised entry) - 30 x deaths. Ts = the stage's scroll seconds.
 *  A stage shorter than the reference grades its hits harder (the spec formula, uncapped) */
export function gradePts(id: EntryId, st: StageCounts, Ts?: number): number {
  const ref = E(id).gradeRef, pct = st.kills / Math.max(1, st.spawned);
  // no usable Ts (missing, 0, negative, NaN): grade as a reference-length stage rather than divide by it
  const hitW = ref == null || !(Ts > 0) ? 1 : ref / Ts;
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
