// The descent layout as a table (D19, design/content-expansion.md §2.2; build plan LS1 row A). Every world-x anchor
// of a descent lives here: the stage rows (kind, span, boss x, the fork before a biome slot), the Saucer's
// stage-relative WARNING and forced exit, the biome beat fractions, where biome terrain hands back to the ship, the
// world bands (AMT, buildTerrain, the corridor backdrop, hell flashes) and the HUD depth marks.
//
// Only the `short` entry exists: today's descent (Orbit, biome, biome, Drive) at today's x values, byte-identical to
// the code it replaced (proved by tools/layout-parity.mjs and the harness). `long4` and `long5` are later rows
// (build plan sprint 2 item D, LS3-0). Sim code reads the ACTIVE entry through the accessors below at call time,
// never a copy taken at import, so a flag can switch the entry before a run starts.
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
}

export interface LayoutEntry {
  id: 'short' | 'long4' | 'long5';
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

// ---------------- long4: the LS1 long layout (spec §2.2, §3.2-3.4; build plan sprint 2 item D) ----------------
// Orbit, biome, biome, Drive, each long, behind ?layout=long. Rows are sized by scroll time, not row width: a biome
// stage is timed from its gate (the scroll holds at the fork ~50 px past the previous Maw, ~200 px past a biome boss:
// its miniWarn runs 150 f while the scroll coasts) to its boss WARNING at bossX. bossX - gate scroll = 3550 px gives
// ~60 s of scroll with the fork start and the midboss hold (two ~50 f speed ramps); measured: production/qa/evidence/ls1-d.md.
// The Orbit and Drive rows' spans, bossX, warnX and the Saucer's entry are D's; their script content is item E's (until
// E lands they replay today's scripts, placed by these rows: Orbit's filler ends ~1900, the Drive's ~700).
const LONG4: LayoutEntry = {
  id: 'long4',
  level: 14370,
  stages: [
    // Open Orbit 3600: the Saucer's WARNING at 1100 (spec §3.4); gapEnd keeps today's 1040 px window and is provisional
    // (item E owns it: >= 300 px before Orbit's slot B WARNING once LS2-orbit adds one). The Maw at 3420, its
    // SOMETHING IS COMING 120 px before, as in short
    { kind: 'orbit', x0: 0, x1: 3600, bossX: 3420, warnX: 3300, drift: [{ k: 'ufo', at: 1100, gapEnd: 2140, exitLead: 60 }] },
    // gate scroll ~3470 (the Maw holds at ~3420 + 50), so the gate x (scroll + W + 10) is ~3960; gateLate rounds up
    { kind: 'biome', slot: 0, fork: true, x0: 3600, x1: 7220, end: 7120, bossX: 7020, gateLate: 3970 },
    // gate scroll ~7220 (the biome boss lands 150 f after its WARNING at 7020, then the scroll coasts ~50 px)
    { kind: 'biome', slot: 1, fork: true, x0: 7220, x1: 10970, end: 10870, bossX: 10770, gateLate: 7720 },
    // the Drive approach: 2700 px (45 s) from where slot 1's boss leaves the scroll (~10970) to startBoss; its
    // WARNING: GRAVITY WELL CRITICAL 240 px before, and today's 700 px of chamber past it
    { kind: 'drive', x0: 10970, x1: 14370, bossX: 13670, warnX: 13430 },
  ],
  // the biome hands back to the ship one screen into the Drive approach, so slot 1's boss arena (scroll ~10970,
  // screen to ~11450) stays on movement C; biomeExit's look hand-back (G.bx[2] = scroll + W + 10) lands at the same x
  tEnd: [11450, 11750],
  beats: {
    // the span starts 330 px of scroll after the gate (its right-edge x + 320 - W: the terrain has finished blending
    // in) and ends 60 px before the boss WARNING; the run-up (p .9-1) is the rest of the spec's 6 s of quiet. Late
    // gate span ~3160 px, so 300 px is p ~.095: every breath/set-piece distance below keeps >= .10
    pad: [160, 60], gateLead: -160,
    // breath 1 holds midboss A (its WARNING 210 px before the end stays inside: .075 of the span is ~237 px), then the
    // release (a pod formation, log line 2). Breath 2 stays EMPTY in sprint 2: slot B's midboss and its miniWarn are
    // sprint 3 item F. The spec's .30-.36 / .62-.68 moved later and widened: with its S1 at .26 the 300 px rule fails
    breaths: [{ end: .41, len: .075, mid: true, release: true }, { end: .725, len: .075 }],
    tempo: [
      { until: .12, gap: 1.4, dbl: .2, sig: true, lead: 'sig' }, //               intro A: the signature alone, then 60% signature
      { until: .22, gap: 1.25, dbl: .25, lead: 'second' }, //                     intro B: the second-ranked kind gets its own first slot
      { until: { breath: 0 }, gap: 1, dbl: 0, rel: true }, //                     build A (S1)
      { until: { breath: 1 }, gap: 1.1, dbl: -.1, rel: true }, //                 build B (S2), lighter: movement B's slot (later item)
      { until: .9, gap: .75, dbl: .15, rel: true, third: true }, //               peak (S3), rear waves, Descent 2+ third spawn
      { until: 1, gap: 1, dbl: 0, stop: true }, //                                arena run-up: no spawns
    ],
    // first visit .23/.53/.86, a repeat visit earlier (the spec's -.02..-.04 shift, inside the same 300 px windows)
    sets: [.23, .53, .86], remixSets: [.2, .515, .83], warnLead: 210,
    runup: .9, arenaBlend: 200,
  },
  // the same shapes as short, re-anchored on the long rows: the hull closes in at the Orbit's end, the corridor rises
  // where slot 0's boss is and squeezes from slot 1's start, and everything opens into the chamber over the 400 px
  // before the Drive's bossX
  bands: {
    hull: [3500, 4000],
    corr: [7070, 7570, 13270, 13670],
    core: [13270, 13720],
    space: [6870, 7470],
    inner: [7070, 7470, 13470, 13870],
  },
  terrain: { fT: [3550, 4000, 13220, 13570], cT: [4800, 5250, 13220, 13570], kT: [7120, 7570, 13120, 13470], zT: [13270, 13670], blocks: [4100, 7070] },
  // PROVISIONAL (creative-director condition, LS1-A review): per-kind hell values are authored after art round 2, never
  // copied from the AMT bands. Until then they are keyed to the stage rows, not to AMT: `corr` rises over slot 1's
  // first 500 px (the last biome slot) and falls into the Drive chamber; `core` is the chamber
  hell: { corr: [7220, 7720, 13270, 13670], core: [13270, 13720] },
  // PROVISIONAL (art-director: the tick design for long rows is an art decision): today's rule, a tick just inside
  // each biome slot's start
  hudMarks: [3700, 7270],
};

export const LAYOUTS: Partial<Record<LayoutEntry['id'], LayoutEntry>> = { short: SHORT };
/** the long4 entry, not yet registered in LAYOUTS: the second-layout tripwire (layout-literals.test.ts) holds it out
 *  until item J deletes the boot-time aliases. Tests check its invariants as a fixture */
export const LONG4_ENTRY = LONG4;
let active: LayoutEntry = SHORT;

/** the active layout entry */
export const layout = () => active;
/** switch the active entry. Contract: only before newGame() (the flag parse, build plan item D; the probes'
 *  --layout, tools/layout-arg.mjs): a run in progress has G.route, G.bx and the terrain arrays sized for the old
 *  entry. Nothing copies the entry at import: item J deleted the boot-time aliases, and layout-literals.test.ts
 *  keeps them out. */
export function setLayout(id: string) {
  const L = LAYOUTS[id as LayoutEntry['id']];
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
  const mb = breaths.find((b) => b.mid);
  return {
    a, z, mid, P, breaths,
    sets: (remix ? BT.remixSets : BT.sets).map(P),
    /** scroll x of the midboss WARNING (the breath that holds it) */
    warn: mb ? Math.round(mb.z - BT.warnLead) : null,
    /** scroll x where the arena run-up starts, or null (legacy beat) */
    runup: BT.runup != null ? P(BT.runup) : null,
  };
}

/** test hook (tools/layout-parity.mjs): the static anchors, under their pre-table names */
export const parityAnchors = () => ({ level: active.level, bossAt: bossAt(), seg: slotSpans(), tEnd: [...active.tEnd], ufoAt: ufoAt(), ufoGapEnd: ufoGapEnd() });
