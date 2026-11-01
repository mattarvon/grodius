import { describe, expect, it } from 'vitest';
import {
  BANDS, LAYOUTS, bandAt, bossAt, forkAfter, hellCore, hellCorr, innerBand, kindOf, lastStage, layout, nSlots, row,
  segs, setLayout, slotOf, slotRow, stageOfSlot, ufoAt, ufoGapEnd, type LayoutEntry,
} from '../../src/layout';

// ---- the invariants every layout entry must keep (design/content-expansion.md §2.2, §3.2) ----
// MIN_GAP px: breath to set piece, breath to bossX, and a DRIFT midboss's forced exit to the next WARNING. Per the
// game-designer ruling (LS1-A review), "WARNING" is what the player sees: the next encounter's telegraph (a miniWarn
// banner, a row's warnX banner, another drift's WARNING), not the later G.mini write.
const MIN_GAP = 300;
type Row = LayoutEntry['stages'][number];

/** the gates a biome row is checked at: earliest (taken by x0, so the span starts at x0 + pad[0]) and latest (gateLate) */
const gates = (r: Row) => [['early', r.x0], ...(r.gateLate != null ? [['late', r.gateLate]] : [])] as [string, number][];

/** the biome breath, its midboss WARNING and the set-piece x for a biome row and gate, mirroring biomes.ts biomeScript */
function biomeBeats(L: LayoutEntry, r: Row, from: number, remix: boolean) {
  const B = L.beats, a = Math.max(r.x0 + B.pad[0], from + 60), z = r.bossX - B.pad[1], mid = Math.round((a + z) / 2), P = (q: number) => a + (z - a) * q;
  const bZ = r.breathAfterMid != null ? Math.max(P(B.breath.end), mid + r.breathAfterMid) : P(B.breath.end), bA = bZ - (z - a) * B.breath.len;
  return { bA, bZ, warn: Math.round(bZ - B.warnLead), sets: (remix ? B.remixSets : B.sets).map(P) };
}

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
      warns.push(b.warn);
      for (const x of b.sets) {
        const d = x < b.bA ? b.bA - x : x > b.bZ ? x - b.bZ : 0;
        if (d < MIN_GAP) out.push(`${tag}: set piece at ${x.toFixed(1)} is ${d.toFixed(1)} px from the breath`);
      }
      if (r.bossX - b.bZ < MIN_GAP) out.push(`${tag}: breath ends ${(r.bossX - b.bZ).toFixed(1)} px before bossX`);
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
  for (const [id, L] of Object.entries(LAYOUTS)) {
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
    expect(segs()).toEqual([{ x0: 2300, x1: 5050, bossX: 4950 }, { x0: 5150, x1: 8200, bossX: 8020 }]);
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
    expect(L.beats).toEqual({ pad: [220, 160], breath: { end: .55, len: .1 }, sets: [.3, .75], remixSets: [.22, .62], warnLead: 210 });
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

  it('refuses an unknown layout id', () => {
    expect(() => setLayout('long9')).toThrow(/unknown layout/);
    expect(layout().id).toBe('short');
  });
});
