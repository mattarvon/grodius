import { describe, expect, it } from 'vitest';
import {
  BANDS, LAYOUTS, bandAt, bossAt, forkAfter, hellCore, hellCorr, innerBand, kindOf, lastStage, layout, nSlots, row,
  beatPlan, driftRow, driftsOf, setLayout, slotSpans, slotOf, slotRow, stageOfSlot, ufoAt, ufoGapEnd, type LayoutEntry,
} from '../../src/layout';

// ---- the invariants every layout entry must keep (design/content-expansion.md §2.2, §3.2) ----
// MIN_GAP px: breath to set piece, breath to bossX, and a DRIFT midboss's forced exit to the next WARNING. Per the
// game-designer ruling (LS1-A review), "WARNING" is what the player sees: the next encounter's telegraph (a miniWarn
// banner, a row's warnX banner, another drift's WARNING), not the later G.mini write.
const MIN_GAP = 300;
type Row = LayoutEntry['stages'][number];

/** the gates a biome row is checked at: earliest (taken by x0, so the span starts at x0 + pad[0]) and latest (gateLate) */
const gates = (r: Row) => [['early', r.x0], ...(r.gateLate != null ? [['late', r.gateLate]] : [])] as [string, number][];

/** the breaths, the midboss WARNING and the set-piece x for a biome row and gate: src/layout.ts beatPlan, which
 *  biomes.ts biomeScript builds the script from */
const biomeBeats = (L: LayoutEntry, r: Row, from: number, remix: boolean) => beatPlan(r, from, remix, L);

/** every entry the invariants run on */
const ENTRIES = Object.entries(LAYOUTS) as [string, LayoutEntry][];

/** every invariant violation in a layout entry, as readable strings (empty = clean) */
function violations(L: LayoutEntry) {
  const out: string[] = [], S = L.stages;
  if (S[0].x0 !== 0) out.push(`stage 0 starts at ${S[0].x0}, not 0`);
  S.forEach((r, i) => {
    if (i && S[i - 1].x1 !== r.x0) out.push(`stages ${i - 1}/${i} not contiguous: ${S[i - 1].x1} vs ${r.x0}`);
    if (r.x1 <= r.x0) out.push(`stage ${i} is empty`);
    if (r.bossX < r.x0 || r.bossX > r.x1) out.push(`stage ${i} bossX ${r.bossX} outside [${r.x0}, ${r.x1}]`);
    if (r.gateLate != null && (r.gateLate < r.x0 || r.gateLate > r.bossX)) out.push(`stage ${i} gateLate ${r.gateLate} outside [x0, bossX]`);
  });
  if (S[S.length - 1].x1 !== L.level) out.push(`last stage ends at ${S[S.length - 1].x1}, level is ${L.level}`);
  const slots = S.filter((r) => r.kind === 'biome').map((r) => r.slot);
  if (slots.some((s, i) => s !== i)) out.push(`biome slots not 0..n-1 in order: ${slots}`);
  if (!S.some((r) => r.kind === 'drive')) out.push('no drive row');
  S.forEach((r, i) => {
    // every WARNING the player sees in this stage (world x): breath midboss WARNINGs at every gate and visit, other
    // drifts' WARNINGs, and the end encounter's (its warnX banner, else the miniWarn at bossX)
    const warns: number[] = [r.warnX ?? r.bossX, ...(r.drift || []).map((d) => r.x0 + d.at)];
    if (r.kind === 'biome') for (const [g, from] of gates(r)) for (const remix of [false, true]) {
      const b = biomeBeats(L, r, from, remix), tag = `stage ${i} ${g} gate${remix ? ' remix' : ''}`;
      if (b.warn != null) warns.push(b.warn);
      for (const x of b.sets) {
        const d = Math.min(...b.breaths.map((br) => x < br.a ? br.a - x : x > br.z ? x - br.z : 0));
        if (d < MIN_GAP) out.push(`${tag}: set piece at ${x.toFixed(1)} is ${d.toFixed(1)} px from the breath`);
      }
      const last = Math.max(...b.breaths.map((br) => br.z));
      if (r.bossX - last < MIN_GAP) out.push(`${tag}: breath ends ${(r.bossX - last).toFixed(1)} px before bossX`);
    }
    // a DRIFT midboss does not hold the scroll: it must be forced out >= MIN_GAP before the next WARNING (§3.2 rule 1)
    for (const d of r.drift || []) {
      const at = r.x0 + d.at, exit = r.x0 + d.gapEnd - d.exitLead, later = warns.filter((w) => w > at);
      if (exit <= at) out.push(`stage ${i}: ${d.k} forced exit before its own WARNING`);
      if (later.length) { const next = Math.min(...later); if (next - exit < MIN_GAP) out.push(`stage ${i}: ${d.k} forced exit at ${exit} is ${next - exit} px before the next WARNING at ${next}`); }
    }
  });
  return out;
}

/** the short layout's known exceptions (accepted by the game-designer lead, LS1-A review; production/decision-log.md
 *  D20): it reproduces today's descent exactly, and today's repeat-visit set pieces and the Saucer's exit sit closer
 *  than the D19 rules allow. Pinned so they cannot drift; any other entry must be clean */
const LEGACY: Partial<Record<string, RegExp[]>> = {
  short: [
    /^stage 0: ufo forced exit at 1780 is 220 px before the next WARNING at 2000$/, // "SOMETHING IS COMING", ~3.7 s
    /^stage 1 early gate remix: set piece at 3927\.4 is 158\.9 px from the breath$/,
    /^stage 2 early gate remix: set piece at 6913\.8 is 38\.8 px from the breath$/,
    // with the gate taken as late as the parity bots take it, the span is ~9% shorter and the gaps shrink
    /^stage 1 late gate remix: set piece at 4003\.4 is 144\.9 px from the breath$/,
    /^stage 2 late gate: set piece at 7320\.0 is 280\.0 px from the breath$/,
    /^stage 2 late gate remix: set piece at 7039\.2 is 0\.0 px from the breath$/, // the set piece lands inside the breath
  ],
};

describe('layout invariants, every entry', () => {
  for (const [id, L] of ENTRIES) {
    it(`${id}: stages contiguous, breaths >= 300 px from set pieces and bossX at both gates, DRIFT exits >= 300 px before the next WARNING`, () => {
      const v = violations(L!), legacy = LEGACY[id] || [];
      expect(v.filter((s) => !legacy.some((re) => re.test(s)))).toEqual([]);
      // every pinned exception still exists (if one is fixed, drop it from LEGACY)
      for (const re of legacy) expect(v.some((s) => re.test(s))).toBe(true);
    });
  }

  it('catches a gap between stages, a late DRIFT exit and a breath on top of the boss', () => {
    const bad: LayoutEntry = JSON.parse(JSON.stringify(LAYOUTS.short));
    bad.id = 'long4';
    bad.stages[1].x0 = 2310;
    bad.stages[0].warnX = undefined; // measure the Saucer against the Maw's miniWarn-less spawn at bossX
    bad.stages[0].drift![0].gapEnd = 2000;
    bad.stages[2].breathAfterMid = 1500; // the breath now ends past bossX - 300
    const v = violations(bad).join('\n');
    expect(v).toMatch(/stages 0\/1 not contiguous/);
    expect(v).toMatch(/ufo forced exit at 1940 is 180 px before the next WARNING at 2120/);
    expect(v).toMatch(/stage 2 early gate: breath ends .* px before bossX/);
  });

  it('catches a DRIFT midboss in a biome slot whose exit runs into the breath WARNING', () => {
    // the Calving Shelf case (spec §3.2): a drift midboss early in a biome stage, its window ending just before the breath
    const bad: LayoutEntry = JSON.parse(JSON.stringify(LAYOUTS.short));
    bad.id = 'long4';
    bad.stages[1].drift = [{ k: 'shelf', at: 300, gapEnd: 1400, exitLead: 0 }];
    const v = violations(bad).join('\n');
    expect(v).toMatch(/stage 1: shelf forced exit at 3700 is -?\d+ px before the next WARNING at 35\d\d/);
  });
});

// ---- the short entry is today's descent, number for number ----
const sstep = (a: number, b: number, x: number) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
// the literal formulas the table replaced (world.ts AMT, render/terrain.ts:514, buildTerrain), sampled across the level
const OLD = {
  hull: (s: number) => sstep(2200, 2700, s),
  corr: (s: number) => sstep(5000, 5500, s) * (1 - sstep(8900, 9300, s)),
  core: (s: number) => sstep(8900, 9350, s),
  space: (s: number) => 1 - sstep(4800, 5400, s),
  inner: (s: number) => sstep(5000, 5400, s) * (1 - sstep(9100, 9500, s)),
  fT: (s: number) => sstep(2250, 2700, s) * (1 - sstep(8850, 9200, s)),
  cT: (s: number) => sstep(3500, 3950, s) * (1 - sstep(8850, 9200, s)),
  kT: (s: number) => sstep(5050, 5500, s) * (1 - sstep(8750, 9100, s)),
  zT: (s: number) => sstep(8900, 9300, s),
};

describe('short layout reproduces today', () => {
  setLayout('short');
  const L = layout(), xs = Array.from({ length: 2241 }, (_, i) => -200 + i * 5);

  it('has the old anchors: LEVEL, BOSS_AT, SEG, T_END0/1, UFO_AT, UFO_GAP_END', () => {
    expect(L.level).toBe(10000);
    expect(bossAt()).toBe(9300);
    expect(slotSpans()).toEqual([{ x0: 2300, x1: 5050, bossX: 4950 }, { x0: 5150, x1: 8200, bossX: 8020 }]);
    expect(L.tEnd).toEqual([8300, 8600]);
    expect(ufoAt()).toBe(800);
    expect(ufoGapEnd()).toBe(1840);
  });

  it('has the old bands, bit for bit', () => {
    for (const x of xs) {
      expect(BANDS.hull(x)).toBe(OLD.hull(x));
      expect(BANDS.corr(x)).toBe(OLD.corr(x));
      expect(BANDS.core(x)).toBe(OLD.core(x));
      expect(BANDS.space(x)).toBe(OLD.space(x));
      expect(innerBand(x)).toBe(OLD.inner(x));
      // hell flashes are re-keyed to stage kinds, neutrally: the same curves as the AMT corr/core they read before
      expect(hellCorr(x)).toBe(OLD.corr(x));
      expect(hellCore(x)).toBe(OLD.core(x));
      for (const k of ['fT', 'cT', 'kT', 'zT'] as const) expect(bandAt(L.terrain[k], x)).toBe(OLD[k](x));
    }
    expect(L.terrain.blocks).toEqual([2800, 5000]);
    expect(L.hudMarks).toEqual([2400, 5200]);
  });

  it('has the old beat fractions and script anchors', () => {
    // today's single breath and its tempo, as a BREATHS table (beat template v2 keeps short's script byte-identical:
    // tools/layout-parity.mjs)
    expect(L.beats).toEqual({
      pad: [220, 160], gateLead: 60, breaths: [{ end: .55, len: .1, mid: true }],
      tempo: [
        { until: .2, gap: 1.4, dbl: .2, sig: true, lead: 'sig', third: true },
        { until: { breath: 0 }, gap: 1, dbl: 0, rel: true, third: true },
        { until: .9, gap: .75, dbl: .15, rel: true, third: true },
        { until: 1, gap: 1, dbl: 0, rel: true, third: true },
      ],
      sets: [.3, .75], remixSets: [.22, .62], warnLead: 210,
    });
    expect(L.beats.runup).toBeUndefined();
    expect(slotRow(1).breathAfterMid).toBe(260);
    expect(slotRow(0).breathAfterMid).toBeUndefined();
    expect([row(0)!.warnX, row(0)!.bossX]).toEqual([2000, 2120]); // SOMETHING IS COMING, the Maw
    expect([row(3)!.x0, row(3)!.warnX, row(3)!.bossX]).toEqual([8300, 9060, 9300]); // the Drive script's base, WARNING, startBoss
  });

  it('answers the old stage-index checks by kind', () => {
    expect([0, 1, 2, 3].map(kindOf)).toEqual(['orbit', 'biome', 'biome', 'drive']);
    expect([0, 1, 2, 3].map(slotOf)).toEqual([-1, 0, 1, -1]); // was route[stage - 1] for stages 1 and 2
    expect([0, 1, 2, 3].map(forkAfter)).toEqual([0, 1, -1, -1]); // was G.stage === 0 || G.stage === 1
    expect(nSlots()).toBe(2);
    expect([0, 1].map(stageOfSlot)).toEqual([1, 2]); // was seg + 1 in biomes.ts choose()
    expect(lastStage()).toBe(3); // was STAGES.length - 1
    expect(kindOf(4)).toBeUndefined();
    expect(slotOf(4)).toBe(-1);
  });

  it('finds drift midbosses by stage and by kind, and names what is missing', () => {
    expect(driftsOf(0)).toEqual([{ k: 'ufo', at: 800, gapEnd: 1840, exitLead: 60 }]);
    expect(driftsOf(1)).toEqual([]);
    expect(driftsOf(9)).toEqual([]);
    expect(driftRow('ufo').row).toBe(row(0));
    expect(() => driftRow('shelf')).toThrow(/no drift midboss 'shelf'/);
    expect(() => slotRow(5)).toThrow(/no biome slot 5/);
  });

  it('refuses an unknown layout id, including Object prototype keys a URL flag can carry', () => {
    expect(() => setLayout('long9')).toThrow(/unknown layout/);
    for (const k of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) expect(() => setLayout(k)).toThrow(/unknown layout/);
    expect(layout().id).toBe('short');
  });
});

// ---- the long layout (build plan sprint 2 item D; spec §2.2, §3.2-3.4) ----
describe('long4 entry', () => {
  const L = LAYOUTS.long4!, biomeRows = L.stages.filter((r) => r.kind === 'biome');

  it('is Orbit, biome slot 0, biome slot 1, Drive, with forks before both biome slots', () => {
    expect(L.stages.map((r) => r.kind)).toEqual(['orbit', 'biome', 'biome', 'drive']);
    expect(biomeRows.map((r) => [r.slot, r.fork])).toEqual([[0, true], [1, true]]);
  });

  it('has long rows: Orbit 3600, a 2700 px Drive approach, LEVEL near the spec estimate', () => {
    const [o, , , d] = L.stages;
    expect(o.x1 - o.x0).toBe(3600);
    expect(d.bossX - d.x0).toBe(2700);
    expect(d.warnX).toBeLessThan(d.bossX);
    // spec §2.2: ~13,500-14,000 for four stages; +370 for the 150 f biome-boss WARNING coasts and today's 700 px chamber
    expect(L.level).toBeGreaterThanOrEqual(13500);
    expect(L.level).toBeLessThanOrEqual(14400);
  });

  it('times each biome stage at ~3550 px from its gate scroll (~60 s of scroll) and sets gateLate past that gate', () => {
    // gate scroll: the fork holds the scroll ~50 px past the Orbit Maw's bossX and ~200 px past a biome boss's
    const gateScroll = [L.stages[0].bossX + 50, biomeRows[0].bossX + 200];
    biomeRows.forEach((r, s) => {
      expect(r.bossX - gateScroll[s]).toBe(3550);
      expect(r.gateLate).toBeGreaterThanOrEqual(gateScroll[s] + 480 + 10); // choose(): from = scroll + W + 10
      expect(r.breathAfterMid).toBeUndefined(); // short's legacy hack stays short's
    });
  });

  it('has two breaths, only the first holding a midboss in sprint 2, with its WARNING inside it', () => {
    expect(L.beats.breaths.map((b) => !!b.mid)).toEqual([true, false]);
    for (const r of biomeRows) for (const from of [r.x0, r.gateLate!]) {
      const b = beatPlan(r, from, false, L), [b1] = b.breaths;
      expect(b.warn!).toBeGreaterThanOrEqual(b1.a);
      expect(b.warn!).toBeLessThan(b1.z);
    }
  });

  it('keeps every set piece >= 150 px from every WARNING, breath 2s future one included, at both gates', () => {
    for (const r of biomeRows) for (const from of [r.x0, r.gateLate!]) for (const remix of [false, true]) {
      const b = beatPlan(r, from, remix, L);
      // sprint 3 item F puts slot B's miniWarn in breath 2 the same warnLead before its end
      const warns = [...b.breaths.map((br) => br.z - L.beats.warnLead), r.bossX];
      for (const x of b.sets) expect(Math.min(...warns.map((w) => Math.abs(w - x)))).toBeGreaterThanOrEqual(150);
      expect(b.sets).toHaveLength(3);
    }
  });

  it('starts the arena run-up after the last breath and before the boss, at p .9', () => {
    for (const r of biomeRows) {
      const b = beatPlan(r, r.gateLate!, false, L);
      expect(b.runup!).toBeGreaterThan(Math.max(...b.breaths.map((br) => br.z)));
      expect(b.runup!).toBeLessThan(r.bossX);
      expect(b.runup!).toBeCloseTo(b.P(.9), 6);
    }
  });

  it('flags its hell bands as stage-keyed, not copies of the AMT bands (creative-director condition)', () => {
    expect(L.hell.corr).not.toEqual(L.bands.corr);
    expect(L.hell.corr[0]).toBe(biomeRows[1].x0); // rises with the last biome slot
    expect(L.hudMarks).toHaveLength(biomeRows.length);
  });
});
