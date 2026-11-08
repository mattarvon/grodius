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
}

/** a generated stage (spec §3.4 "Authoring method"; LS1 row E). All x are stage-relative to the row's x0 */
export interface StagePlan {
  /** hand-authored cells, about 300 px each: where each starts, and which tagged pool it draws from. `floor` is the
   *  Drive's first slot, the only stretch of the corridor with a floor and ceiling for mutants, crawlers and wombs */
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
 *  kind (intro B). `third`: Descent 2+ adds a third spawn 35% of the time. `stop`: no spawns (the arena run-up) */
export interface Tempo { until: number | { breath: number }; gap: number; dbl: number; rel?: boolean; sig?: boolean; lead?: 'sig' | 'second'; third?: boolean; stop?: boolean }
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
   *  x range of the hull's alternating blocks */
  terrain: { fT: number[]; cT: number[]; kT: number[]; zT: number[]; blocks: [number, number] };
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
  /** each biome stage: gate to bossX 3550 -> 5950 px (~99.5 s of scroll; +2100 put the low end at ~113 s, under the
   *  120 s band). pod-probe tally_s, stage-clock */
  biome: 2400,
  /** the Drive approach: 2700 -> 4800 px (80 s); its time is mostly the fight, which lengthens with the D31 part 1 cut.
   *  If pod-probe measures it under 120 s, add +300 here */
  drive: 2100,
};
const S0 = STRETCH.orbit, S1 = S0 + STRETCH.biome, S2 = S1 + STRETCH.biome, S3 = S2 + STRETCH.drive;
/** #19 (game-designer): the Orbit climax's last spawn sits >= 300 px (~5 s at ~59.8 px/s) before SOMETHING IS COMING
 *  (the window ends here and its last beat is <= b - 1). LS1 had 80 px (~1.3 s), so the Maw's banner landed on a busy
 *  screen. density-probe */
const ORBIT_RUNUP = 300;
/** stage-relative x of the long Orbit's Maw banner, and of the Drive's WARNING */
const ORBIT_WARN = 4080 + S0, DRIVE_WARN = 2460 + STRETCH.drive;

// The cell-and-filler plans (spec §3.4 "Authoring method"; enemies/scripts.ts builds them, src/cellpick.ts picks the
// cells). Draw order is the array order (scripts.ts pickPlanned: every cell slot, then every filler window), so new
// slots and windows go at the END, and a moved window keeps its length and gap (stretch plan §2.1). Caveat the plan
// missed: a new cell slot adds a draw before the first filler draw, so the filler (the Saucer's window included)
// draws shift on long4, and the bigger build/peak pools change which cell the same draw picks (cellpick.ts
// tier[floor(r * len)]). Only Descent 1's teaching opener, fixed rather than drawn, is stable (level-design review).
/** long Open Orbit: 3 intro cells (the ~15 s teaching opener in Descent 1, 180..1060), the Saucer, build x2, the
 *  mid-Orbit breath (3300-3700, empty: reserved for the held slot B), build, peak, peak, the climax, a quiet run-up,
 *  the Maw. Two arcs of rising tension with one rest between them (stretch plan §2.3) */
const LONG4_ORBIT_PLAN: StagePlan = {
  slots: [
    { x: 180, tag: 'intro' }, { x: 480, tag: 'intro' }, { x: 780, tag: 'intro' }, { x: 2100, tag: 'build' }, { x: 2700, tag: 'build' },
    { x: 4300, tag: 'peak' }, // peak #1, moved from 3300 past the breath
    { x: 3700, tag: 'build' }, // new: build #3, right after the breath
    { x: 5000, tag: 'peak' }, // new: peak #2
  ],
  fill: [
    { a: 1150, b: 2100, gap: 80, mix: 'orbit' }, // the Saucer's window: eaten while it is up (runScript, $.G.eat)
    { a: 2400, b: 2700, gap: 70, mix: 'orbit' }, // build, ~0.9 beats/s
    { a: 3000, b: 3300, gap: 70, mix: 'orbit' },
    { a: 4600, b: 5000, gap: 55, mix: 'orbit' }, // peak, ~1.1 beats/s (moved from 3600-4000)
    { a: 4000, b: 4300, gap: 70, mix: 'orbit' }, // new: build #3's filler
    { a: 5300, b: ORBIT_WARN - ORBIT_RUNUP, gap: 55, mix: 'orbit' }, // new: the climax (880 px, ~14.7 s at +2400)
  ],
  opener: 3,
};
/** long Drive approach (x relative to the row's x0): the floor cell where the corridor still has a floor, the wall eyes
 *  at 430 and the log line at 230 (both clear the stage start, ~x0 + 148; fixed beats in enemies/scripts.ts), the
 *  build, the pressure breath (2400-2750, empty, CP1's resume screen), three peaks, then the WARNING (§2.4) */
const LONG4_DRIVE_PLAN: StagePlan = {
  slots: [
    { x: 230, tag: 'floor' }, { x: 520, tag: 'intro' }, { x: 830, tag: 'build' }, { x: 1140, tag: 'build' },
    { x: 3150, tag: 'peak' }, { x: 3470, tag: 'peak' }, // moved from 1760 / 2080 past the breath
    { x: 1800, tag: 'build' }, // new: build #3
    { x: 3790, tag: 'peak' }, // new: peak #3
  ],
  fill: [
    { a: 1440, b: 1740, gap: 65, mix: 'interior' },
    { a: 2100, b: 2400, gap: 65, mix: 'interior' }, // new: up to the pressure breath
    { a: 2750, b: 3150, gap: 60, mix: 'interior' }, // new: out of it, into the peaks
    { a: 4090, b: DRIVE_WARN - 80, gap: 55, mix: 'interior' }, // new: ends 80 px before the WARNING, as the LS1 Orbit's did
  ],
};

// ---------------- long4: the long layout (spec §2.2, §3.2-3.4; D24 made it the default) ----------------
// Rows are sized by scroll time, not row width: a biome stage is timed from its gate (the scroll holds at the fork
// ~50 px past the previous Maw, ~200 px past a biome boss: its miniWarn runs 150 f while the scroll coasts) to its boss
// WARNING at bossX. LS1: bossX - gate scroll = 3550 px gave ~60 s of scroll (production/qa/evidence/ls1-d.md); the
// D31 stretch adds STRETCH.biome to that.
const LONG4: LayoutEntry = {
  id: 'long4',
  rev: 2, // 2: the D31 stretch (rev 1 was the LS1 geometry, LEVEL 15150)
  level: 15150 + S3,
  stages: [
    // Open Orbit. The Saucer's WARNING at 1080 (spec §3.4 "around 1100"; not 1100 itself, an Orbit script x in
    // enemies/scripts.ts that layout-literals.test.ts would trip), its filler window to 2100 (docs/pacing.md 3.2's
    // ~1000 px), forced out at 2040 (D20 rule 1). The drifting Saucer holds no scroll, so the row is sized by its
    // content (D22). The Maw 120 px after SOMETHING IS COMING. CP1 after the mid-Orbit breath (3700 + 150, ~54% in:
    // the LS1 rule put it at 2250, ~32%). `held`: LS2-orbit's slot-B WARNING goes in the breath (~3490), heldRange
    { kind: 'orbit', x0: 0, x1: 4380 + S0, bossX: 4200 + S0, warnX: ORBIT_WARN, drift: [{ k: 'ufo', at: 1080, gapEnd: 2100, exitLead: 60 }], plan: LONG4_ORBIT_PLAN, cp1: 3850 },
    // gate scroll ~bossX + 50 of the Maw, so the gate x (scroll + W + 10) is ~that + 490; gateLate rounds up
    { kind: 'biome', slot: 0, fork: true, x0: 4380 + S0, x1: 8000 + S1, end: 7900 + S1, bossX: 7800 + S1, gateLate: 4750 + S0 },
    // gate scroll ~the slot-0 row's x1 (the biome boss lands 150 f after its WARNING, then the scroll coasts ~50 px)
    { kind: 'biome', slot: 1, fork: true, x0: 8000 + S1, x1: 11750 + S2, end: 11650 + S2, bossX: 11550 + S2, gateLate: 8500 + S1 },
    // the Drive approach: 4800 px (80 s) from where slot 1's boss leaves the scroll to startBoss; its WARNING: GRAVITY
    // WELL CRITICAL 240 px before, and 700 px of chamber past it. CP1 in the pressure breath (the midpoint rule put it
    // in filler; rebuildAt resumes 120 px before it, onto an empty screen)
    { kind: 'drive', x0: 11750 + S2, x1: 15150 + S3, bossX: 14450 + S3, warnX: 14210 + S3, plan: LONG4_DRIVE_PLAN, cp1: 2600 },
  ],
  // the biome hands back to the ship one screen into the Drive approach, so slot 1's boss arena (screen to x0 + 480)
  // stays on movement C; biomeExit's look hand-back (G.bx[2] = scroll + W + 10) lands at the same x
  tEnd: [12230 + S2, 12530 + S2],
  beats: {
    // the span starts 330 px of scroll after the gate (its right-edge x + 320 - W: the terrain has finished blending
    // in) and ends 60 px before the boss WARNING. Late-gate span ~5550 px, so 300 px (D20) is p ~.054
    pad: [160, 60], gateLead: -160,
    // template v3 (stretch plan §2.5; D31 amended). The LS1 fractions scaled with the span would have grown every
    // fixed-length beat 1.76x, so they are re-cut. Breath 1 holds midboss A then the release (pod formation, log line
    // 2); breath 2 midboss B; each `len .05` (~278 px late gate: the WARNING 210 px before the end has 68 px of
    // margin). Breath 3 is the rest before the climax (~3.3 s): no midboss, no release, silent
    breaths: [{ end: .36, len: .05, mid: true, release: true }, { end: .66, len: .05, mid: true }, { end: .855, len: .035 }],
    tempo: [
      { until: .08, gap: 1.4, dbl: .2, sig: true, lead: 'sig' }, //             intro A: the signature alone, then 60% signature
      { until: .15, gap: 1.25, dbl: .25, lead: 'second' }, //                    intro B: the second-ranked kind gets its own first slot
      { until: { breath: 0 }, gap: 1, dbl: 0, rel: true }, //                    build A (S1)
      { until: { breath: 1 }, gap: 1.1, dbl: -.1, rel: true }, //                build B (S2), lighter: movement B's band
      { until: { breath: 2 }, gap: .75, dbl: .15, rel: true, third: true }, //   peak A (S3), Descent 2+ third spawn
      { until: .94, gap: .7, dbl: .2, rel: true, third: true }, //               peak B, the climax
      { until: 1, gap: 1, dbl: 0, stop: true }, //                               arena run-up: no spawns (~6.6 s with the pad)
    ],
    // first visit .22/.50/.75, a repeat visit .02-.03 earlier; every set piece >= ~370 px from every breath edge at
    // the late gate (snapping moves a placed entry <= ~68 px, so placed x keeps D20's 300 too)
    sets: [.22, .5, .75], remixSets: [.19, .48, .73], warnLead: 210,
    runup: .94, arenaBlend: 200,
    // a DRIFT slot-A midboss (the Calving Shelf in wave 2) is gone 300 px before slot B's WARNING. The window is now
    // ~1365-1380 px (~23 s, slot A WARNING to exit, late/early gate), longer than the 1080 f slot clock, so the clock is
    // the binding exit
    driftLead: 300,
    // movement B fills build B: its blend starts at breath 1's end, where CP1 is written (spec §3.3: movement A runs
    // "intro to CP1"), so midboss A's held screen shows it coming; it ends 200 px into breath 2, before the left edge
    // of midboss B's held screen, so that fight is on movement A. Unchanged from ls2-mv: it grows with the span to
    // ~1190 px of full gimmick (~20 s, D31 amended "about 18 s") at the late gate. movement-shots, route-probe
    moveB: { between: [0, 1], lead: [0, 200], blend: 200 },
  },
  // the same shapes as short, re-anchored on the long rows: the hull closes in at the Orbit's end, the corridor rises
  // where slot 0's boss is and squeezes from slot 1's start, and everything opens into the chamber over the 400 px
  // before the Drive's bossX
  bands: {
    hull: [4280 + S0, 4780 + S0],
    corr: [7850 + S1, 8350 + S1, 14050 + S3, 14450 + S3],
    core: [14050 + S3, 14500 + S3],
    space: [7650 + S1, 8250 + S1],
    inner: [7850 + S1, 8250 + S1, 14250 + S3, 14650 + S3],
  },
  terrain: {
    fT: [4330 + S0, 4780 + S0, 14000 + S3, 14350 + S3], cT: [5580 + S0, 6030 + S0, 14000 + S3, 14350 + S3],
    kT: [7900 + S1, 8350 + S1, 13900 + S3, 14250 + S3], zT: [14050 + S3, 14450 + S3], blocks: [4880 + S0, 7850 + S1],
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
 *  (gapEnd - exitLead) and >= 300 px before the end encounter's banner (D20 rule 1, both ways). Null on a row with
 *  no banner */
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
