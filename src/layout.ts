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
// Pure data and pure functions: no imports, so tests and core.ts can load it without a DOM.

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

/** biome stage beat fractions, p = progress through the spawn span (biomes.ts biomeScript) */
export interface Beats {
  /** the spawn span is [x0 + pad[0], bossX - pad[1]] (later of x0 + pad[0] and the gate x + 60) */
  pad: [number, number];
  /** the breath (no spawns, the midboss): ends at p `end`, `len` of the span long */
  breath: { end: number; len: number };
  /** set pieces, first visit and repeat visit (remix) */
  sets: number[];
  remixSets: number[];
  /** the midboss WARNING sits this far before the breath's end (it lands ~60 px before, the scroll coasts to a stop) */
  warnLead: number;
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
  beats: { pad: [220, 160], breath: { end: .55, len: .1 }, sets: [.3, .75], remixSets: [.22, .62], warnLead: 210 },
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

export const LAYOUTS: Partial<Record<LayoutEntry['id'], LayoutEntry>> = { short: SHORT };
let active: LayoutEntry = SHORT;

/** the active layout entry */
export const layout = () => active;
/** switch the active entry. Contract: only before newGame() (the flag parse, build plan item D); a run in progress
 *  has G.route, G.bx and the terrain arrays sized for the old entry, and the @deprecated boot-time aliases
 *  (core LEVEL/BOSS_AT, biomes SEG, ufo UFO_AT/UFO_GAP_END) keep the entry active at import. Item J deletes the
 *  aliases before item D lets this run with anything but 'short'. */
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
export const slotRow = (s: number) => active.stages.find((r) => r.kind === 'biome' && r.slot === s)!;
/** the stage index that flies biome slot s */
export const stageOfSlot = (s: number) => active.stages.findIndex((r) => r.kind === 'biome' && r.slot === s);
/** index of the last stage in a descent */
export const lastStage = () => active.stages.length - 1;
/** clearing stage i opens a fork into this biome slot, or -1 */
export const forkAfter = (i: number) => { const n = active.stages[i + 1]; return n && n.kind === 'biome' && n.fork ? n.slot! : -1; };
/** the first stage of kind k */
export const rowOfKind = (k: StageKind) => active.stages.find((r) => r.kind === k)!;
/** world x of the Gravity Drive fight (startBoss; was BOSS_AT) */
export const bossAt = () => rowOfKind('drive').bossX;
/** world x of a stage-relative x in stage row r */
export const wx = (r: StageRow, rel: number) => r.x0 + rel;
/** the Saucer: its stage row and drift entry */
export const ufoRow = () => active.stages.find((r) => r.drift && r.drift.some((d) => d.k === 'ufo'))!;
export const ufoDrift = () => ufoRow().drift!.find((d) => d.k === 'ufo')!;
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

/** the biome slots as {x0, x1, bossX} (SEG before the table; x1 is the slot's nominal content end) */
export const segs = () => active.stages.filter((r) => r.kind === 'biome').map((r) => ({ x0: r.x0, x1: r.end ?? r.x1, bossX: r.bossX }));

/** test hook (tools/layout-parity.mjs): the static anchors, under their pre-table names */
export const parityAnchors = () => ({ level: active.level, bossAt: bossAt(), seg: segs(), tEnd: [...active.tEnd], ufoAt: ufoAt(), ufoGapEnd: ufoGapEnd() });
