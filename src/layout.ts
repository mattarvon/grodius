// The descent layout as a table (D19, design/content-expansion.md §2.2; build plan LS1 row A). Every world-x anchor
// of a descent lives here: the stage rows (kind, span, boss x, the fork before a biome slot), the Saucer's
// stage-relative WARNING and forced exit, the biome beat fractions, where biome terrain hands back to the ship, the
// world bands (AMT, buildTerrain, the corridor backdrop, hell flashes) and the HUD depth marks.
//
// `long4` (Orbit, biome, biome, Drive, each long) is the default since D24: src/lab.ts DEFAULT_LAYOUT switches to it at
// boot. `short` is the pre-LS1 descent, byte-identical to the code it replaced (proved by tools/layout-parity.mjs and
// the harness, which pin ?layout=short), reachable through the LAB and ?layout=short until it is deleted; `long5` is
// LS3-0. Sim code reads the ACTIVE entry through the accessors below at call time, never a copy taken at import, so a
// flag can switch the entry before a run starts.
//
// Pure data and pure functions: no imports, so tests, the game and the probes (tools/layout-arg.mjs, in Node and
// in-page) can load it without a DOM.

export type StageKind = 'orbit' | 'biome' | 'interior' | 'drive';

/** a midboss that does NOT hold the scroll (the Saucer): stage-relative x of its WARNING and of the end of its
 *  filler-skip window; it is forced out once the scroll passes gapEnd - exitLead */
export interface Drift { k: string; at: number; gapEnd: number; exitLead: number }

export interface StageRow {
  kind: StageKind;
  /** biome rows: which biome slot (index into G.route) */
  slot?: number;
  /** biome rows: the slot is chosen at a fork that opens when the previous stage clears */
  fork?: boolean;
  /** world span; contiguous, x1 of one row is x0 of the next */
  x0: number;
  x1: number;
  /** biome rows: where the biome's own content nominally ends (SEG.x1 before the table; informational) */
  end?: number;
  /** world x of the stage's end encounter: the Maw spawn, the biome boss WARNING, the Drive's startBoss */
  bossX: number;
  /** world x of the end encounter's warning banner, when it is not a miniWarn at bossX. It counts as a WARNING for
   *  the DRIFT forced-exit rule (spec §3.2 rule 1, measured to what the player sees) */
  warnX?: number;
  drift?: Drift[];
  /** biome rows, legacy: the breath ends no earlier than the spawn span's midpoint + this (the old mid-stage Maw) */
  breathAfterMid?: number;
  /** biome rows: the latest world x the slot's gate is taken at (the `from` of biomes.ts choose(): scroll + W + 10 when
   *  the fork opens after the previous stage's boss). Only the layout invariant test reads it: a late gate shortens the
   *  spawn span, so every beat gap is checked at both the earliest (x0) and this latest gate. */
  gateLate?: number;
  /** long Orbit / Drive rows: the cell-and-filler plan the long script generator builds from (enemies/scripts.ts,
   *  src/cellpick.ts). The short rows have none: their scripts are today's hand-made sections */
  plan?: StagePlan;
  /** long rows: stage-relative x of CP1, overriding checkpoint.ts cp1X's rule for this row (D31 stretch §4: the Orbit's
   *  mid-breath end + 150, the Drive's pressure breath). Absent: the rule. Data only for now: cp1X reads it once the
   *  fix lane's checkpoint.ts lands (it owns that file in wave 2) */
  cp1?: number;
  /** Orbit rows: a HELD midboss (slot B, LS2-orbit's tug), stage-relative x of its WARNING. Unset until that kind ships.
   *  layout.test.ts holds it >= 300 px past every drift's forced exit and >= 300 px before the Maw's banner
   *  (heldRange below) */
  held?: { at: number };
  /** long4 Orbit / Drive rows (DIFFICULTY-SPEC §2.1 "Checkpoints", C21): the checkpoint list, stage-relative scroll x
   *  in order. 0 is the stage start (CP0). The rules (tests/unit/orbitdrive.test.ts): <= CP_RULE.maxGap px of scroll
   *  between any two, one at the end encounter's WARNING - CP_RULE.warnLead, none inside a `sigs` window or the Saucer's
   *  drift. Ordinary cells and filler may be live there: checkpoint.ts cpSafe already waits out any midboss or boss, and
   *  a restore replays the script past the checkpoint. checkpoint.ts (W2) reads it through cpsOf(); absent (short, biome
   *  rows): its own rule */
  cps?: number[];
  /** long4 Orbit / Drive rows: the signature windows (LVL §2.3 SIG_WINDOWS), stage-relative [a, b) with the window's
   *  swept-fit floor. sigs.ts sigWindows() (W3) and the probes read them in world x through rowSigWindows() */
  sigs?: SigWin[];
}

/** a signature window, stage-relative: the span of the ship's world x (scroll + ship x) while the set piece meets it,
 *  and its swept-fit floor (LVL S1: >= 72; 100 outside every window). CREW KNOTS' bodies spawn from 2150 but drift into
 *  the ship from ~2450, so its window is 2400-3450 */
export interface SigWin { id: string; a: number; b: number; floor: number }

/** a generated stage (spec §3.4 "Authoring method"; LS1 row E). All x are stage-relative to the row's x0 */
export interface StagePlan {
  /** hand-authored cells, about 300 px each: where each starts, and which tagged pool it draws from. `floor` is the
   *  Drive's first slot, the cells that open on the corridor-floor kinds (mutants, crawlers, wombs). The long4 corridor
   *  has a floor and ceiling until its chamber, so the tag is a pool, not the only stretch with a floor */
  slots: { x: number; tag: 'intro' | 'build' | 'peak' | 'floor' }[];
  /** generator filler: a beat every `gap` px over [a, b), kinds from the `mix` table (src/cellpick.ts) */
  fill: { a: number; b: number; gap: number; mix: 'orbit' | 'interior' }[];
  /** Descent 1 plays the pool's fixed opener in the first `opener` slots (Orbit's teaching cells) */
  opener?: number;
}

/** a breath: an empty window (no spawns) ending at p `end`, `len` of the spawn span long. `mid`: it holds the biome's
 *  midboss (its WARNING sits `warnLead` before the end). `release`: one guaranteed pod formation and the next log line
 *  right after it (spec §3.2 "Release") */
export interface Breath { end: number; len: number; mid?: boolean; release?: boolean }
/** a tempo band of the spawn loop: it runs until p `until`, or until the end of breath `{ breath: i }`. Slot gap is
 *  B.gap x `gap`; the double chance is `dbl` (absolute) or B.dbl + `dbl` capped at .85 (`rel`). `sig`: rolls the
 *  signature 60% of the time. `lead`: the band's first slot is alone, the signature or the biome's second-ranked mix
 *  kind (intro B). `third`: Descent 2+ adds a third spawn 35% of the time (a number sets that chance; beat-probe's 1.7 spawns/s peak exit). `stop`: no spawns (the arena run-up) */
export interface Tempo { until: number | { breath: number }; gap: number; dbl: number; rel?: boolean; sig?: boolean; lead?: 'sig' | 'second'; third?: boolean | number; stop?: boolean }
/** biome stage beats, p = progress through the spawn span (biomes.ts biomeScript; spec §3.2) */
export interface Beats {
  /** the spawn span is [x0 + pad[0], bossX - pad[1]], starting no earlier than the gate x + gateLead (a scroll x: the
   *  gate x is the right screen edge, so -W + 320 puts the first spawn on fully blended biome terrain) */
  pad: [number, number];
  gateLead: number;
  /** BREATHS, in p order */
  breaths: Breath[];
  tempo: Tempo[];
  /** set pieces, first visit and repeat visit (remix) */
  sets: number[];
  remixSets: number[];
  /** the midboss WARNING sits this far before its breath's end (it lands ~60 px before, the scroll coasts to a stop) */
  warnLead: number;
  /** the arena run-up: from this p no spawns, the last log line, and terrain movement C (arena) blends in over
   *  `arenaBlend` px. Absent: the legacy beat (short), two log lines (span start, span midpoint), no movement C */
  runup?: number;
  arenaBlend?: number;
  /** a DRIFT midboss in a midboss breath (it does not hold the scroll) is forced out this far before the next
   *  WARNING in its stage: the next midboss breath's WARNING, else the boss WARNING at bossX (spec §3.2 rule 1, the
   *  UFO_GAP_END pattern made stage-relative through beatPlan; >= 300 px, layout.test.ts). Absent: no DRIFT biome slots */
  driftLead?: number;
  /** terrain movement B, the gimmick (spec §3.3). World x band, from breath `between[0]`'s end + `lead[0]` to breath
   *  `between[1]`'s start + `lead[1]`, blended in and out over `blend` px inside the band. Present on a layout, it also
   *  turns on the set-piece draw (src/setdraw.ts). Absent (short): movement A throughout and the biome's one set piece */
  moveB?: { between: [number, number]; lead: [number, number]; blend: number };
}

export interface LayoutEntry {
  id: 'short' | 'long4' | 'long5';
  /** geometry revision (D31 stretch §5 option 1): bumped whenever a retune moves the entry's world x, so a resume save
   *  written on the old geometry can be refused. Absent means 1 (short). Read through layoutRev(); runsave.ts stores and
   *  checks it after the fix lane's merge (it owns that file in wave 2) */
  rev?: number;
  /** world length the terrain arrays cover (LEVEL) */
  level: number;
  stages: StageRow[];
  /** biome terrain blends back to the ship's own over [tEnd[0], tEnd[1]] (the Gravity Drive approach) */
  tEnd: [number, number];
  beats: Beats;
  /** world bands, each [rise0, rise1] or [rise0, rise1, fall0, fall1] (sstep up, then 1 - sstep down) */
  bands: { hull: number[]; corr: number[]; core: number[]; space: number[]; inner: number[] };
  /** buildTerrain's bands: floor in (fT), ceiling in (cT), the corridor's squeeze (kT), the chamber (zT), and the
   *  x range of the hull's alternating blocks. long4 only (absent on short, so its arithmetic is untouched): `hT` the
   *  hull lift (the floor rises `lift` px over the MERIDIAN's hull), `oT` the breach (a ceiling flap comes down
   *  `flap` px past the base ceiling, and the floor lifts too), `oClamp` the breach's minimum column gap, `kD` the
   *  corridor squeeze depths [floor, ceiling] (short's 24 / 28 when absent) */
  terrain: {
    fT: number[]; cT: number[]; kT: number[]; zT: number[]; blocks: [number, number];
    hT?: number[]; oT?: number[]; lift?: number; flap?: number; oClamp?: number; kD?: [number, number];
    /** long4's hull run: over [x0, x1] every 360 px cell (not every other) carries a floor block `h` px tall */
    hRun?: { x0: number; x1: number; h: number };
  };
  /** hell-flash weights, keyed to stage kinds: `corr` spans the last biome slot and the Drive approach, `core` the
   *  Drive chamber. In `short` they are exactly the AMT corr/core bands they replaced (neutral re-key) */
  hell: { corr: number[]; core: number[] };
  /** world x of the tick marks on the HUD depth bar */
  hudMarks: number[];
  /** the stages' midbosses come from the picker (src/midpick.ts, spec §6.3; build plan LS1 row F): one per midboss
   *  breath (two per long biome stage) with the slot leave clocks, slot B held back while a midboss is up, filler
   *  suppressed while one is up, and the fork's acid/snot rule (§6.5). Absent (short): each biome stage gets its own
   *  home midboss on today's 1400 f clock, and nothing else changes */
  picker?: boolean;
}

// ---------------- the short layout: today's descent ----------------
const SHORT: LayoutEntry = {
  id: 'short',
  level: 10000,
  stages: [
    // Open Orbit: the Saucer drifts in (WARNING at 800, its filler window to 1840), then SOMETHING IS COMING and the Maw
    { kind: 'orbit', x0: 0, x1: 2300, bossX: 2120, warnX: 2000, drift: [{ k: 'ufo', at: 800, gapEnd: 1840, exitLead: 60 }] },
    // gateLate: the gate x the parity bots take (bx 2658 / 5637 in tools/layout-parity.baseline.json), rounded up
    { kind: 'biome', slot: 0, fork: true, x0: 2300, x1: 5150, end: 5050, bossX: 4950, gateLate: 2660 },
    // slot 1's breath is shifted to end just past mid + 260, where the old mid-stage Maw was
    { kind: 'biome', slot: 1, fork: true, x0: 5150, x1: 8300, end: 8200, bossX: 8020, breathAfterMid: 260, gateLate: 5640 },
    // ~18 s of Gravity Drive approach after stage 2 (docs/pacing.md 3.3): WARNING: GRAVITY WELL CRITICAL, then startBoss
    { kind: 'drive', x0: 8300, x1: 10000, bossX: 9300, warnX: 9060 },
  ],
  tEnd: [8300, 8600],
  beats: {
    pad: [220, 160], gateLead: 60,
    breaths: [{ end: .55, len: .1, mid: true }],
    // today's loop: intro (q < .2) sparse with the signature first, build to the breath's end, peak to .9, tail
    tempo: [
      { until: .2, gap: 1.4, dbl: .2, sig: true, lead: 'sig', third: true },
      { until: { breath: 0 }, gap: 1, dbl: 0, rel: true, third: true },
      { until: .9, gap: .75, dbl: .15, rel: true, third: true },
      { until: 1, gap: 1, dbl: 0, rel: true, third: true },
    ],
    sets: [.3, .75], remixSets: [.22, .62], warnLead: 210,
  },
  bands: {
    hull: [2200, 2700],
    corr: [5000, 5500, 8900, 9300],
    core: [8900, 9350],
    space: [4800, 5400],
    inner: [5000, 5400, 9100, 9500],
  },
  terrain: { fT: [2250, 2700, 8850, 9200], cT: [3500, 3950, 8850, 9200], kT: [5050, 5500, 8750, 9100], zT: [8900, 9300], blocks: [2800, 5000] },
  hell: { corr: [5000, 5500, 8900, 9300], core: [8900, 9350] },
  hudMarks: [2400, 5200],
};

// ---------------- long4's stretch (D31 part 2: each stage ~120-150 s; $P/audit/d31-stretch.md §1) ----------------
/** how much longer each long4 stage is than its LS1 row. Every anchor after a stage is written as its LS1 value plus
 *  the cumulative stretch before it (S0..S3 below), so changing one constant shifts everything downstream */
const STRETCH = {
  /** Open Orbit: +2400 (D37, Matt). Sized for LS2-orbit's held slot B (the derelict tug, ~10 s of hold); until the tug
   *  ships out of ?mids=wip the Orbit runs short (~116-120 s, under the 120 s floor). Extra length lands in the climax
   *  filler (it ends ORBIT_RUNUP before the Maw's banner). Measured by pod-probe tally_s (~126-130 s with the tug) */
  orbit: 2400,
  /** biome slot A (stage 1-2): gate to bossX 3550 + this. D31's single +2550 (~102 s of scroll) is split per slot so the
   *  biome lane can set each. DIFFICULTY-SPEC §2.4 / LVL §8 ask 1950 (slot A measured 151 s median, L6 band <= 145) and
   *  1450 for slot B (165 s, band <= 150; it drops midboss B, C24). Both held at 2550 in W3b: at 1450 slot B's movement-B
   *  band blends in with a 19 px cliff (terrainb.test.ts, limit 14), which is the biome lane's geometry (W3c / W3a) to
   *  fix first. Flipping them moves only S1 / S2, the biome rows and every anchor after them. pod-probe tally_s, gate L6 */
  biomeA: 2550,
  biomeB: 2550,
  /** the Drive approach: 2700 -> 4800 px (~77.5 s from the stage start at ~x0 + 148; DIFFICULTY-SPEC §2.4, LVL §8).
   *  D31 had +2400 (its last 300 px a filler window to DRIVE_WARN - 80); C23 caps the fight at 60 s (collapse 45 s,
   *  self-destruct 60 s, W4b), so 77.5 + 60 = ~138 s holds the Drive at <= 140 (L6 <= 145). The 300 px came out of
   *  that last filler window, which is gone: the WARNING now follows ~7.7 s of quiet (LVL §6.2). pod-probe tally_s */
  drive: 2100,
};
const S0 = STRETCH.orbit, S1 = S0 + STRETCH.biomeA, S2 = S1 + STRETCH.biomeB, S3 = S2 + STRETCH.drive;
/** #19 (game-designer): the Orbit climax's last spawn sits >= 300 px (~5 s at ~59.8 px/s) before SOMETHING IS COMING
 *  (the window ends here and its last beat is <= b - 1). LS1 had 80 px (~1.3 s), so the Maw's banner landed on a busy
 *  screen. density-probe */
const ORBIT_RUNUP = 300;
/** stage-relative x of the long Orbit's Maw banner, and of the Drive's WARNING */
const ORBIT_WARN = 4080 + S0, DRIVE_WARN = 2460 + STRETCH.drive;

/** the checkpoint list's rules (DIFFICULTY-SPEC §2.1 "Checkpoints", C21; GR rule 7 "at most about 30 s back") */
export const CP_RULE = {
  /** px of scroll between two checkpoints at most: 30 s at the base 1 px/f (held screens add no scroll) */
  maxGap: 1800,
  /** one checkpoint at the end encounter's WARNING - 10 s, so a fight death replays the run-up, never the stage */
  warnLead: 600,
};

// The cell-and-filler plans (spec §3.4 "Authoring method"; enemies/scripts.ts builds them, src/cellpick.ts picks the
// cells). Draw order is the array order (scripts.ts pickPlanned: every cell slot, then every filler window), so new
// slots and windows go at the END, and a moved window keeps its length and gap (stretch plan §2.1). Caveat the plan
// missed: a new cell slot adds a draw before the first filler draw, so the filler (the Saucer's window included)
// draws shift on long4, and the bigger build/peak pools change which cell the same draw picks (cellpick.ts
// tier[floor(r * len)]). Only Descent 1's teaching opener, fixed rather than drawn, is stable (level-design review).
/** long Open Orbit, rev 3 (DIFFICULTY-SPEC §2.4, LVL §3): the teaching opener (3 intro cells, 180..1060, each ending on
 *  an authored carrier in Descent 1), the Saucer (1080-2100), CREW KNOTS (2150-3300, fixed beats in enemies/scripts.ts:
 *  they replace rev 2's build slots 2100 / 2700 and the filler at 2400-2700 / 3000-3300), the breath while the hull
 *  rises (3300-3700, empty: still reserved for the held slot B), then the rush along the hull (build 3700, peak 4300)
 *  and through the breach (peak 5000, the climax filler), the quiet run-up, the Maw. The hull turrets and the breach's
 *  wombs are fixed beats too (ORBIT_SIG.turrets). Draw order: the slots in x order, then the windows */
const LONG4_ORBIT_PLAN: StagePlan = {
  slots: [
    { x: 180, tag: 'intro' }, { x: 480, tag: 'intro' }, { x: 780, tag: 'intro' },
    { x: 3700, tag: 'build' }, { x: 4300, tag: 'peak' }, { x: 5000, tag: 'peak' },
  ],
  fill: [
    { a: 1150, b: 2100, gap: 80, mix: 'orbit' }, // the Saucer's window: eaten while it is up (runScript, $.G.eat)
    { a: 4000, b: 4300, gap: 70, mix: 'orbit' }, // the hull run, ~0.9 beats/s
    { a: 4600, b: 5000, gap: 55, mix: 'orbit' }, // into the breach, ~1.1 beats/s
    { a: 5300, b: ORBIT_WARN - ORBIT_RUNUP, gap: 55, mix: 'orbit' }, // the climax under the flap (880 px, ~14.7 s)
  ],
  opener: 3,
};
/** long Drive approach, rev 3 (x relative to the row's x0; DIFFICULTY-SPEC §2.4, LVL §6). The corridor keeps its floor
 *  and ceiling over the whole approach: the slot-B biome's terrain hands back over tEnd (480-780), the base corridor
 *  holds its squeeze (kT) until it falls over 4250-4600 into the chamber, so the rev-2 note that only the first slot has
 *  a floor was stale (grodius-audit open item). The `floor` slot is just the first one, the cell that opens on a
 *  mutant; the interior mix's terrain kinds fit anywhere before ~4250. Beats: the log line at 230 and the wall eyes
 *  at 430 (fixed, in enemies/scripts.ts; both clear the stage start, ~x0 + 148), the floor and intro cells, two
 *  authored carriers (830, 1000), THE STROKE (1100-2420, pistons, fixed beats; it replaces rev 2's build slots 1140 /
 *  1800 and the filler at 1440-1740 / 2100-2400), a sparse filler through it (one beat per 140 px, no terrain kinds:
 *  LVL §4 rule 3 keeps turrets 60 px off a piston), the pressure breath (2420-2750, a checkpoint), the rush (filler, then
 *  three peaks), and ~7.7 s of quiet to the WARNING (rev 2's last filler window, 4090-4780, is gone) */
const LONG4_DRIVE_PLAN: StagePlan = {
  slots: [
    { x: 230, tag: 'floor' }, { x: 520, tag: 'intro' },
    { x: 3150, tag: 'peak' }, { x: 3470, tag: 'peak' }, { x: 3790, tag: 'peak' },
  ],
  fill: [
    { a: 1180, b: 2420, gap: 140, mix: 'orbit' }, // through THE STROKE: drones, sentries, crew, flayers, swarms only
    { a: 2750, b: 3150, gap: 60, mix: 'interior' }, // out of the breath, into the peaks
  ],
};

// ---------------- long4: the long layout (spec §2.2, §3.2-3.4; D24 made it the default) ----------------
// Rows are sized by scroll time, not row width: a biome stage is timed from its gate (the scroll holds at the fork
// ~50 px past the previous Maw, ~200 px past a biome boss: its miniWarn runs 150 f while the scroll coasts) to its boss
// WARNING at bossX. LS1: bossX - gate scroll = 3550 px gave ~60 s of scroll (production/qa/evidence/ls1-d.md); the
// D31 stretch adds STRETCH.biome to that.
const LONG4: LayoutEntry = {
  id: 'long4',
  rev: 3, // 3: DIFFICULTY-SPEC §2.4 (Orbit hull and breach, CREW KNOTS, THE STROKE, the biome A/B stretch split, the
  //          4800 px Drive approach); 2 was the D31 stretch, 1 the LS1 geometry (LEVEL 15150)
  level: 15150 + S3,
  stages: [
    // Open Orbit. The Saucer's WARNING at 1080 (spec §3.4 "around 1100"; not 1100 itself, an Orbit script x in
    // enemies/scripts.ts that layout-literals.test.ts would trip), its filler window to 2100 (docs/pacing.md 3.2's
    // ~1000 px), forced out at 2040 (D20 rule 1). The drifting Saucer holds no scroll, so the row is sized by its
    // content (D22). The Maw 120 px after SOMETHING IS COMING. `held`: LS2-orbit's slot-B WARNING goes in the breath
    // (~3490), heldRange. Checkpoints (C21, <= 30 s apart): the start, before the Saucer, after it and before CREW KNOTS,
    // after the knots, at the breach, and the Maw banner - 10 s. cp1 (rev 2's single CP1) is the post-knots one
    { kind: 'orbit', x0: 0, x1: 4380 + S0, bossX: 4200 + S0, warnX: ORBIT_WARN, drift: [{ k: 'ufo', at: 1080, gapEnd: 2100, exitLead: 60 }], plan: LONG4_ORBIT_PLAN, cp1: 3550,
      cps: [0, 1000, 2110, 3550, 4590, ORBIT_WARN - CP_RULE.warnLead], sigs: [{ id: 'crew_knots', a: 2400, b: 3450, floor: 100 }] },
    // gate scroll ~bossX + 50 of the Maw, so the gate x (scroll + W + 10) is ~that + 490; gateLate rounds up
    { kind: 'biome', slot: 0, fork: true, x0: 4380 + S0, x1: 8000 + S1, end: 7900 + S1, bossX: 7800 + S1, gateLate: 4750 + S0 },
    // gate scroll ~the slot-0 row's x1 (the biome boss lands 150 f after its WARNING, then the scroll coasts ~50 px)
    { kind: 'biome', slot: 1, fork: true, x0: 8000 + S1, x1: 11750 + S2, end: 11650 + S2, bossX: 11550 + S2, gateLate: 8500 + S1 },
    // the Drive approach: 4800 px (~77.5 s) from where slot 1's boss leaves the scroll to startBoss; its WARNING: GRAVITY
    // WELL CRITICAL 240 px before, and 700 px of chamber past it. Checkpoints: the start, just before THE STROKE's first
    // spawn beat, the pressure breath (CP1: rebuildAt resumes 120 px before it, onto an empty screen), the WARNING - 10 s.
    // THE STROKE's window is where the ship's world x meets the pistons
    { kind: 'drive', x0: 11750 + S2, x1: 15150 + S3, bossX: 14450 + S3, warnX: 14210 + S3, plan: LONG4_DRIVE_PLAN, cp1: 2460,
      cps: [0, 660, 2460, DRIVE_WARN - CP_RULE.warnLead], sigs: [{ id: 'stroke', a: 1100, b: 2385, floor: 80 }] },
  ],
  // the biome hands back to the ship one screen into the Drive approach, so slot 1's boss arena (screen to x0 + 480)
  // stays on movement C; biomeExit's look hand-back (G.bx[2] = scroll + W + 10) lands at the same x
  tEnd: [12230 + S2, 12530 + S2],
  beats: {
    // the span starts 330 px of scroll after the gate (its right-edge x + 320 - W: the terrain has finished blending
    // in) and ends 60 px before the boss WARNING. Late-gate span ~5700 px, so 300 px (D20) is p ~.053
    pad: [160, 60], gateLead: -160,
    // template v3 (stretch plan §2.5; D31 amended). The LS1 fractions scaled with the span would have grown every
    // fixed-length beat 1.76x, so they are re-cut. Breath 1 holds midboss A then the release (pod formation, log line
    // 2); breath 2 midboss B; each `len .05` (~285 px late gate: the WARNING 210 px before the end has 75 px of
    // margin). Breath 3 is the rest before the climax (~3.3 s): no midboss, no release, silent
    breaths: [{ end: .36, len: .05, mid: true, release: true }, { end: .66, len: .05, mid: true }, { end: .855, len: .035 }],
    tempo: [
      { until: .08, gap: 1.4, dbl: .2, sig: true, lead: 'sig' }, //             intro A: the signature alone, then 60% signature
      { until: .15, gap: 1.25, dbl: .25, lead: 'second' }, //                    intro B: the second-ranked kind gets its own first slot
      { until: { breath: 0 }, gap: 1, dbl: 0, rel: true }, //                    build A (S1)
      { until: { breath: 1 }, gap: 1.1, dbl: -.1, rel: true }, //                build B (S2), lighter: movement B's band
      { until: { breath: 2 }, gap: .75, dbl: .15, rel: true, third: true }, //   peak A (S3), Descent 2+ third spawn
      // peak B, the climax. Its Descent 2+ third spawn is .1, not .35: beat-probe read Descent 2 fire at 1.87 spawns/s (.35)
      // and 1.71 (.15), over LS1's 1.7 exit (level-design ruling). (1 + .8 + .1) / 70 * 60 = ~1.63 (the probe reads ~.03
      // above that model); Descent 1 is unchanged (no third spawn)
      { until: .94, gap: .7, dbl: .2, rel: true, third: .1 },
      { until: 1, gap: 1, dbl: 0, stop: true }, //                               arena run-up: no spawns (~6.6 s with the pad)
    ],
    // first visit .22/.50/.75, a repeat visit .02-.03 earlier; every set piece >= ~370 px from every breath edge at
    // the late gate (snapping moves a placed entry <= ~68 px, so placed x keeps D20's 300 too)
    sets: [.22, .5, .75], remixSets: [.19, .48, .73], warnLead: 210,
    runup: .94, arenaBlend: 200,
    // a DRIFT slot-A midboss (the Calving Shelf in wave 2) is gone 300 px before slot B's WARNING. The window is now
    // ~1400-1415 px (~23.5 s, slot A WARNING to exit, late/early gate), longer than the 1080 f slot clock, so the clock is
    // the binding exit
    driftLead: 300,
    // movement B fills build B: its blend starts at breath 1's end, where CP1 is written (spec §3.3: movement A runs
    // "intro to CP1"), so midboss A's held screen shows it coming; it ends 200 px into breath 2, before the left edge
    // of midboss B's held screen, so that fight is on movement A. Unchanged from ls2-mv: it grows with the span to
    // ~1220 px of full gimmick (~20 s, D31 amended "about 18 s") at the late gate. movement-shots, route-probe
    moveB: { between: [0, 1], lead: [0, 200], blend: 200 },
  },
  // the same shapes as short, re-anchored on the long rows: the hull closes in at the Orbit's end, the corridor rises
  // where slot 0's boss is and squeezes from slot 1's start, and everything opens into the chamber over the 400 px
  // before the Drive's bossX
  bands: {
    // the hull band (render/terrain.ts hull decor, fx/update.ts's hull low-pass) arrives with the hull floor at 3500
    hull: [3300, 3950],
    corr: [7850 + S1, 8350 + S1, 14050 + S3, 14450 + S3],
    core: [14050 + S3, 14500 + S3],
    space: [7650 + S1, 8250 + S1],
    inner: [7850 + S1, 8250 + S1, 14250 + S3, 14650 + S3],
  },
  terrain: {
    // rev 3, Orbit (LVL §3.1, D-3 "hull from 3500"): the floor comes in over 3500-3950 (rev 2: 6730-7180) and the
    // hull blocks start at 3950 (rev 2: 7280). The ceiling's own band (cT) still starts in biome A, where the biome
    // rewrite covers it; the Orbit's only ceiling is the breach flap (oT)
    fT: [3300, 3950, 14000 + S3, 14350 + S3], cT: [5580 + S0, 6030 + S0, 14000 + S3, 14350 + S3],
    kT: [7900 + S1, 8350 + S1, 13900 + S3, 14250 + S3], zT: [14050 + S3, 14450 + S3], blocks: [3950, 7850 + S1],
    // the hull lift: the plating floor sits 36 px higher (mean floor y ~188, FH ~74%) from the hull's arrival. It falls
    // inside biome A's stretch (the slot-A rewrite owns that terrain from its gate), so neither the biomes nor the Drive
    // see it. D-5: kept under the Maw (fade over 6300-6550 only if the Maw's fit fails). space-probe L1
    // [FIT] lift 36 -> 46: LVL's 36 measured an x >= 3700 median FH of 77-79% (space-probe seeds 1/3/5, band <= 72)
    // the rise starts at 3300 (LVL 3500): over 650 px the 46 px lift keeps the climbing floor's slope <= .6 (S3)
    hT: [3300, 3950, 7850 + S1, 8350 + S1], lift: 46,
    // [FIT] the hull run's blocks: one every 360 px and 48 px tall (rev 2's every 720 px, 34 tall measured 0.4-1.3
    // forced moves/min, band >= 4: L3). Never under the flap (world.ts), and off before the Maw's arena (D-5). L3 / M3
    hRun: { x0: 3950, x1: 6450, h: 48 },
    // the breach (LVL §3.1): a ceiling flap comes down over 4900-5250 and goes back up over 5850-6200, `flap` px below
    // the base ceiling (mean ~52), over the lifted floor: FH median ~54% (136 px) for ~10 s at full, the column gap
    // clamped to 108 inside it (104 elsewhere), no hull block under it (world.ts). The ramps are 350 px, not LVL's 250,
    // so the flap's visible edge slopes <= .6 (S3; orbitdrive.test.ts). space-probe L1 / L2, route-probe minGap
    // [FIT] full drop 5250-5950 (LVL ~10 s): the 600 px span measured an Orbit FH p10 of 61-63% (band <= 55)
    oT: [4900, 5250, 5950, 6350], flap: 28, oClamp: 108,
    // the Drive approach deepened (LVL §6.1): the squeeze terms 24 / 28 -> 38 / 42, mean gap ~148 -> ~130 (~51%), the
    // 104 clamp kept. [FIT] LVL's 34 / 38 measured a terrain-only median of 54% (orbitdrive.test.ts), over L1's 52 even
    // before THE STROKE's pistons (which count in the probe's FH): +4 a side. space-probe L1 (approach median <= 52%,
    // p10 <= 43%), route-probe minGap
    kD: [38, 42],
  },
  // PROVISIONAL (creative-director condition, LS1-A review): per-kind hell values are authored after art round 2, never
  // copied from the AMT bands. Until then they are keyed to the stage rows, not to AMT: `corr` rises over slot 1's
  // first 500 px (the last biome slot) and falls into the Drive chamber; `core` is the chamber
  hell: { corr: [8000 + S1, 8500 + S1, 14050 + S3, 14450 + S3], core: [14050 + S3, 14500 + S3] },
  // PROVISIONAL (art-director: the tick design for long rows is an art decision): a tick just inside each biome slot's
  // start, and one just inside the Drive's (render/hud.ts draws every mark at m / bossAt() along the bar)
  hudMarks: [4480 + S0, 8050 + S1, 11750 + S2 + 50],
  picker: true,
};

export const LAYOUTS: Partial<Record<LayoutEntry['id'], LayoutEntry>> = { short: SHORT, long4: LONG4 };
// the module default; src/lab.ts applies DEFAULT_LAYOUT (long4, D24) at boot, before any run
let active: LayoutEntry = SHORT;

/** the active layout entry */
export const layout = () => active;
/** switch the active entry. Contract: only before newGame() (the flag parse, build plan item D; the probes'
 *  --layout, tools/layout-arg.mjs): a run in progress has G.route, G.bx and the terrain arrays sized for the old
 *  entry. Nothing copies the entry at import: item J deleted the boot-time aliases, and layout-literals.test.ts
 *  keeps them out. */
export function setLayout(id: string) {
  // own keys only: a URL flag reaches here, and 'constructor' or '__proto__' must not resolve to Object's
  const L = Object.hasOwn(LAYOUTS, id) ? LAYOUTS[id as LayoutEntry['id']] : undefined;
  if (!L) throw new Error('unknown layout ' + id);
  active = L;
}

// ---------------- stage accessors ----------------
/** stage row i of the active layout (undefined past the last stage) */
export const row = (i: number): StageRow | undefined => active.stages[i];
/** the kind of stage i */
export const kindOf = (i: number): StageKind | undefined => active.stages[i]?.kind;
/** the biome slot stage i flies, or -1 when it is not a biome stage */
export const slotOf = (i: number) => { const r = active.stages[i]; return r && r.kind === 'biome' ? r.slot! : -1; };
/** how many biome slots a descent has (the length of G.route) */
export const nSlots = () => active.stages.filter((r) => r.kind === 'biome').length;
/** the stage row of biome slot s */
export const slotRow = (s: number) => { const r = active.stages.find((x) => x.kind === 'biome' && x.slot === s); if (!r) throw new Error(`layout ${active.id} has no biome slot ${s}`); return r; };
/** the stage index that flies biome slot s */
export const stageOfSlot = (s: number) => active.stages.findIndex((r) => r.kind === 'biome' && r.slot === s);
/** index of the last stage in a descent */
export const lastStage = () => active.stages.length - 1;
/** clearing stage i opens a fork into this biome slot, or -1 */
export const forkAfter = (i: number) => { const n = active.stages[i + 1]; return n && n.kind === 'biome' && n.fork ? n.slot! : -1; };
/** the first stage of kind k */
export const rowOfKind = (k: StageKind) => { const r = active.stages.find((x) => x.kind === k); if (!r) throw new Error(`layout ${active.id} has no ${k} stage`); return r; };
/** world x of the Gravity Drive fight (startBoss; was BOSS_AT) */
export const bossAt = () => rowOfKind('drive').bossX;
/** world x of a stage-relative x in stage row r */
export const wx = (r: StageRow, rel: number) => r.x0 + rel;
/** the DRIFT midbosses of stage i (stage-relative WARNING / forced exit), [] when it has none */
export const driftsOf = (i: number): Drift[] => active.stages[i]?.drift || [];
/** the stage row and drift entry of the DRIFT midboss of kind k (first match; throws if the layout has none) */
export function driftRow(k: string) {
  const r = active.stages.find((s) => s.drift && s.drift.some((d) => d.k === k));
  if (!r) throw new Error(`layout ${active.id} has no drift midboss '${k}'`);
  return { row: r, drift: r.drift!.find((d) => d.k === k)! };
}
/** the geometry revision of an entry (absent: 1) */
export const layoutRev = (L: LayoutEntry = active) => L.rev ?? 1;
/** the stage-relative window a held Orbit midboss's WARNING may sit in: >= 300 px past every drift's forced exit
 *  (gapEnd - exitLead) and >= 300 px before the end encounter's banner (warnX, else bossX; D20 rule 1, both ways).
 *  Never null: lo > hi means the row has no room */
export function heldRange(r: StageRow, lead = 300) {
  const banner = (r.warnX ?? r.bossX) - r.x0;
  const exit = Math.max(0, ...(r.drift || []).map((d) => d.gapEnd - d.exitLead));
  return { lo: exit + lead, hi: banner - lead };
}
/** the Saucer: its stage row and drift entry */
export const ufoRow = () => driftRow('ufo').row;
export const ufoDrift = () => driftRow('ufo').drift;
/** world x of the Saucer's WARNING, and of the end of its filler-skip window */
export const ufoAt = () => wx(ufoRow(), ufoDrift().at);
export const ufoGapEnd = () => wx(ufoRow(), ufoDrift().gapEnd);

// ---------------- bands ----------------
// local copies of core.ts's clamp/sstep (same arithmetic, so the bands are bit-identical to the literals they replaced)
const sstep = (a: number, b: number, x: number) => { x = (x - a) / (b - a); x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };
/** a band value at world x s: sstep up over [b0, b1], and for a 4-number band times (1 - sstep down over [b2, b3]) */
export const bandAt = (b: number[], s: number) => b.length > 2 ? sstep(b[0], b[1], s) * (1 - sstep(b[2], b[3], s)) : sstep(b[0], b[1], s);
/** the world bands (world.ts AMT): hull plating, the MERIDIAN corridor, the drive core, open space */
export const BANDS = {
  hull: (s: number) => bandAt(active.bands.hull, s),
  corr: (s: number) => bandAt(active.bands.corr, s),
  core: (s: number) => bandAt(active.bands.core, s),
  space: (s: number) => 1 - bandAt(active.bands.space, s),
  /** the Orbit breach flap's weight (long4 terrain.oT), 0 where a layout has none: the render lane keys the flap's
   *  torn lip and the S7 deck dim on it with `hull` (LVL S7) */
  breach: (s: number) => (active.terrain.oT ? bandAt(active.terrain.oT, s) : 0),
};
/** the corridor interior backdrop's fade (render/terrain.ts drawInterior) */
export const innerBand = (s: number) => bandAt(active.bands.inner, s);
/** hell-flash weights at world x s (fx/update.ts updateAmbient) */
export const hellCorr = (s: number) => bandAt(active.hell.corr, s);
export const hellCore = (s: number) => bandAt(active.hell.core, s);

/** the biome slots as {x0, x1, bossX}: SEG before the table. Careful: x1 here is the slot's nominal content end
 *  (the row's `end`), not the row's x1 */
export const slotSpans = () => active.stages.filter((r) => r.kind === 'biome').map((r) => ({ x0: r.x0, x1: r.end ?? r.x1, bossX: r.bossX }));

/** the beat plan of biome row r with its gate taken at world x `from` (biomes.ts choose()), in scroll x: the spawn
 *  span [a, z], p -> x, the breaths, the set pieces, the midboss WARNING and the run-up. biomeScript, rewriteTerrain
 *  (movement C) and the layout invariant test all read this one function */
export function beatPlan(r: StageRow, from: number, remix: boolean, L: LayoutEntry = active) {
  const BT = L.beats, a = Math.max(r.x0 + BT.pad[0], from + BT.gateLead), z = r.bossX - BT.pad[1], mid = Math.round((a + z) / 2);
  const P = (q: number) => a + (z - a) * q;
  // short slot 1 (breathAfterMid) shifts its midboss breath to end just past mid + that, where the old mid-stage Maw was
  const breaths = BT.breaths.map((b) => {
    const bZ = b.mid && r.breathAfterMid != null ? Math.max(P(b.end), mid + r.breathAfterMid) : P(b.end);
    return { a: bZ - (z - a) * b.len, z: bZ, mid: !!b.mid, release: !!b.release };
  });
  const warns = breaths.filter((b) => b.mid).map((b) => Math.round(b.z - BT.warnLead));
  return {
    a, z, mid, P, breaths,
    sets: (remix ? BT.remixSets : BT.sets).map(P),
    /** scroll x of the first midboss WARNING (slot A's breath) */
    warn: warns.length ? warns[0] : null,
    /** scroll x of every midboss WARNING, by slot (slot A, slot B) */
    warns,
    /** by slot: the scroll x a DRIFT midboss there is forced out at (driftLead before the next WARNING, spec §3.2 rule
     *  1), or null when the layout has no DRIFT biome slots */
    driftExit: warns.map((_, s) => (BT.driftLead == null ? null : (s + 1 < warns.length ? warns[s + 1] : r.bossX) - BT.driftLead)),
    /** scroll x where the arena run-up starts, or null (legacy beat) */
    runup: BT.runup != null ? P(BT.runup) : null,
    /** terrain movement B's world x band {a, z, blend}, or null when the layout has none */
    moveB: BT.moveB ? { a: breaths[BT.moveB.between[0]].z + BT.moveB.lead[0], z: breaths[BT.moveB.between[1]].a + BT.moveB.lead[1], blend: BT.moveB.blend } : null,
  };
}

/** test hook (tools/layout-parity.mjs): the static anchors, under their pre-table names */
export const parityAnchors = () => ({ level: active.level, bossAt: bossAt(), seg: slotSpans(), tEnd: [...active.tEnd], ufoAt: ufoAt(), ufoGapEnd: ufoGapEnd() });

// ---------------- long4 checkpoints and signature windows (DIFFICULTY-SPEC §2.1, §2.4; LVL §2.3) ----------------
/** stage i's checkpoint list in scroll x (world), or null when the row has none (short, biome rows: checkpoint.ts's
 *  own rule). Pure: the row data only. W2's checkpoint.ts reads this (the list replaces rev 2's single CP1) */
export function cpsOf(i: number, L: LayoutEntry = active): number[] | null {
  const r = L.stages[i];
  return r && r.cps ? r.cps.map((x) => r.x0 + x) : null;
}
/** every fixed-row signature window of an entry in world x, as the probes read them ({ x0, x1, floor, id }). The biome
 *  windows move with their gate (beatPlan), so sigs.ts adds those itself */
export const rowSigWindows = (L: LayoutEntry = active) => L.stages.flatMap((r) => (r.sigs || []).map((s) => ({ id: s.id, x0: r.x0 + s.a, x1: r.x0 + s.b, floor: s.floor })));

// ---------------- the long Open Orbit's set pieces (LVL §3.2-3.4) ----------------
/** a CREW KNOTS variation: trigger x (stage-relative scroll x), each knot's lane as a share of PH and its trigger
 *  offset, an optional sentry, then the entry wave that follows. Knots spawn at x = W + 30 (spawn.ts knot, W1) */
export interface KnotVar {
  x: number; lanes: number[]; dx: number[]; sentry?: { dt: number; y: number; tx: number };
  then: { dt: number; k: 'drop' | 'rise' | 'behind'; n: number; teach?: boolean; carrier?: boolean };
}
/** a terrain turret: its world x (stage-relative: where it sits, not when it is called), kind and wall */
export interface Turret { wx: number; k: 'eye' | 'crawler' | 'womb'; side: 1 | -1 }
export const ORBIT_SIG = {
  /** CREW KNOTS (LVL §3.2): three escalating variations over 2150-3300 (36-55 s), no bullets added. v1 teaches (one
   *  knot, then a slow drop wave: Orbit's 4th authored carrier, at ~38 s), v2 splits the lane (knots 102 px apart, a
   *  46 px band between them and 48 above and below), v3 staggers three with a sentry behind and a rear wave. L7 body
   *  cover p90 40-55%, L4 statue body hits >= 4/min in the window */
  knots: [
    { x: 2150, lanes: [.5], dx: [0], then: { dt: 120, k: 'drop', n: 3, teach: true, carrier: true } },
    { x: 2550, lanes: [.3, .7], dx: [0, 0], then: { dt: 150, k: 'rise', n: 3 } },
    { x: 2950, lanes: [.25, .55, .8], dx: [0, 60, 120], sentry: { dt: 80, y: .4, tx: .8 }, then: { dt: 200, k: 'behind', n: 3 } },
  ] as KnotVar[],
  /** the hull run (3950-4950) and the breach (5200-5800) turrets, 10 in all (LVL §3.3 "8-10 terrain turrets"; rev 2
   *  had 0). Floor eyes and crawlers on the plating, a ceiling eye 40 px before the flap's full drop (a squeeze lip,
   *  LVL §4 rule 1), wombs and an eye on the flap. The ship passes every one, so D61's turn-and-fire-once covers the
   *  back half. Every one is called (wx - W - 14/16) after 3700, so the breath reserved for the held slot B stays empty
   *  (qa-lead review; orbitdrive.test.ts). N1 (shooters that fire), L4 */
  turrets: [
    { wx: 4200, k: 'crawler', side: 1 }, { wx: 4300, k: 'eye', side: 1 }, { wx: 4450, k: 'crawler', side: 1 },
    { wx: 4640, k: 'eye', side: 1 }, { wx: 4780, k: 'crawler', side: 1 }, { wx: 4900, k: 'eye', side: 1 },
    { wx: 5210, k: 'eye', side: -1 }, { wx: 5300, k: 'womb', side: -1 }, { wx: 5450, k: 'eye', side: -1 }, { wx: 5600, k: 'womb', side: -1 },
  ] as Turret[],
  /** the breach's wall birth: hatchlings out of the flap (LVL §3.3 hatch(4, 'top')), trigger x */
  breachHatch: { x: 5500, n: 4 },
};

// ---------------- the long Drive approach's set piece (LVL §6.3, THE STROKE) ----------------
/** a STROKE variation: piston x (world, stage-relative: the piston's left edge), and either `side` per piston (a
 *  single piston rooted in the ceiling -1 or the floor 1, leaving `gap` to the far wall) or `pair` (an opposed pair
 *  whose `gap` is centred at that share of the corridor). eyes: wall eyes' world x; behind: a rear wave's trigger x */
export interface StrokeVar { id: string; x: number[]; side?: (1 | -1)[]; pair?: number[]; gap: number; eyes?: number; behind?: number }
export const DRIVE_SIG = {
  /** the approach's authored carriers (§2.2 faucet: 2 in the Drive's first 45 s, "2 pods by 18 s"), trigger x.
   *  E2 fixed:open */
  carriers: [{ x: 830, pat: 'sine', y: .4, n: 4 }, { x: 900, pat: 'loop', y: .6, n: 4 }], // 900: done looping before v1 (level-designer)
  stroke: {
    /** piston width px (LVL §6.3) */
    w: 30,
    /** the engine cycle (W3A-API spawnPiston): tell 50 f (S4 >= 44), hold 90, rest 60; v .5 px/f is S2's edge-speed cap,
     *  so LVL's draft 1.2 extend / .8 retract run at .5 */
    tell: 50, hold: 90, rest: 60, v: .5,
    /** the ship's screen x when it has none (no ship). Each piston is spawned on its own beat and phased from the ship's
     *  x at that beat, so it is mid-hold as the scroll brings it to the ship, wherever the ship flies: the open lane
     *  alternates piston to piston (the weave the S3 numbers assume) and no parked x is a sanctuary (S8; a fixed
     *  reference x left a band at screen x ~260-300 where every piston was at rest: level-designer BLOCK). A ship that
     *  moves after the beat dodges it, as it should. Deterministic: sim state and frame-counter math, no R() (§5.2) */
    shipX: 120,
    /** a piston's spawn beat fires this far before it reaches the right edge. 0: built just off screen (x = scroll + W),
     *  and as late as that allows, so the checkpoint before THE STROKE (660) still replays v1's first beat (670) on a
     *  restore (stagebuild.ts rebuildAt keeps only entries past the checkpoint) and the one after it (2460) stays within
     *  1800 px (C21). orbitdrive.test.ts */
    lead: 0,
    /** a piston that would intrude less than this (px) is skipped: the corridor is already that tight there */
    minDepth: 8,
    /** LVL §6.3: v1 3 singles alternating ceiling / floor, pitch 130, gap 96; v2 3 opposed pairs, pitch 130, gap 84,
     *  centre alternating .38 / .62 of the corridor; v3 4 pairs, pitch 120, gap 80 (the window floor), wall eyes
     *  between pairs 2 and 3 (60 px from both piston centres, LVL §4 rule 3), a rear wave at trigger x 2190 (~+200).
     *  The variations sit 200 / 110 px apart (LVL's 1100-1500 / 1600-2000 / 2050-2400, packed 70 px tighter so the
     *  window plus its spawn lead fits between two checkpoints) */
    vars: [
      { id: 'v1', x: [1150, 1280, 1410], side: [-1, 1, -1], gap: 96 },
      { id: 'v2', x: [1610, 1740, 1870], pair: [.38, .62, .38], gap: 84 },
      { id: 'v3', x: [1980, 2100, 2220, 2340], pair: [.62, .38, .62, .38], gap: 80, eyes: 2175, behind: 2190 },
    ] as StrokeVar[],
  },
};

/** a single piston's tip y at full stroke: rooted in the ceiling (side -1) it stops `gap` above the floor; in the floor
 *  (side 1), `gap` below the ceiling. ce / fl: the tightest walls over the piston's swept columns. null when it would
 *  intrude less than minDepth (the corridor needs no piston there) */
export function pistonReach(side: 1 | -1, gap: number, ce: number, fl: number, minDepth = DRIVE_SIG.stroke.minDepth): number | null {
  const tip = side < 0 ? fl - gap : ce + gap, depth = side < 0 ? tip - ce : fl - tip;
  return depth < minDepth ? null : tip;
}
/** an opposed pair's gap centre: share q of the corridor, kept inside it so both tips leave the full `gap` (a centre
 *  pushing one tip into its wall would narrow the opening below the window floor) */
export function pairCentre(q: number, gap: number, ce: number, fl: number): number {
  const c = ce + (fl - ce) * q, lo = ce + gap / 2, hi = fl - gap / 2;
  return lo > hi ? (ce + fl) / 2 : Math.max(lo, Math.min(hi, c));
}
/** the rightmost ship x a piston (spawned at the right edge, W = 480) can be phased for with its whole tell on screen:
 *  it needs tell + ext + hold / 2 frames between spawning and reaching the ship */
export const pistonPxMax = (ext: number, S = DRIVE_SIG.stroke) => 480 - (S.tell + ext + S.hold / 2);
/** frames into its cycle a piston starts at (W3A-API spawnPiston `phase`, the cycle rest -> extend -> hold -> retract)
 *  so it is mid-hold when the scroll brings its world x to screen x px (the ship's x at the spawn beat). Spawned at scroll
 *  s for world x x, it gets there in x - px - s frames (1 px/f: the approach holds no screen). ext: its extend frames */
export function pistonPhase(x: number, s: number, cycle: number, ext: number, px = DRIVE_SIG.stroke.shipX, S = DRIVE_SIG.stroke): number {
  // a ship near the right edge: phase for the rightmost x whose tell still starts on screen (S4), so a piston never
  // arrives already closed with its tell played off screen (level-designer re-review); that ship meets it extending
  px = Math.min(px, pistonPxMax(ext, S));
  const mid = S.rest + ext + S.hold / 2, d = x - px - s;
  return (((mid - d) % cycle) + cycle) % cycle;
}
