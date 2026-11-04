import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// LS1 row H: the resume's rebuild (stagebuild.ts rebuildAt) gives the same script x and kind list the run built, from
// the stored recipe alone (seed, loop, stage, route, visitNo, remixV, bx), and never draws the sim RNG: the core mock
// THROWS on any sim R/rr/ri/pick call (the buildstream.test.ts pattern). The terrain and the real game are diffed
// end to end by tools/resume-check.mjs.
const simDraw = () => { throw new Error('the rebuild drew the sim RNG'); };
vi.mock('../../src/core', () => ({
  C: { blood: '', bloodD: '', bloodL: '' }, DC: ['', '', '', '', '', ''], FIRE: [], H: 270, PH: 254, TAU: Math.PI * 2, TS: 4, W: 480,
  R: simDraw, rr: simDraw, ri: simDraw, pick: simDraw,
  clamp: (v: number) => v, ctx: {}, dist2: () => 0, hash: () => 0, lerp: (a: number) => a, sstep: () => 0, vnoise: () => 0,
}));
const terrain = vi.fn();
vi.mock('../../src/world', () => ({ CEIL: new Float32Array(4), FLOOR: new Float32Array(4), ceilAt: () => 0, floorAt: () => 0, shots: [], enemies: [], buildTerrain: (L: number) => terrain(L) }));
vi.mock('../../src/textures', () => ({ mkTex: () => ({}) }));
vi.mock('../../src/audio', () => ({ sfx: {}, sample: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/fx/spawn', () => ({ spark: () => {}, drop: () => {}, flash: () => {}, gore: () => {}, pop: () => {}, mist: () => {} }));
const noop = () => {};
vi.mock('../../src/enemies/spawn', () => ({
  banner: noop, behindWave: noop, butcher: noop, corpse: noop, crawler: noop, crossT: noop, eyeT: noop, flayer: noop, formation: noop,
  hatch: noop, hookE: noop, logLine: noop, maw: noop, midboss: noop, miniWarn: noop, womb: noop, crux: noop, mutant: noop, slime: noop, sentry: noop,
}));
vi.mock('../../src/render/util', () => ({ glow: noop, light: noop }));
vi.mock('../../src/stages', () => ({ startStage: noop }));
vi.mock('../../src/render/biomeart', () => ({ drawFX: noop, biomePat: noop, biomeTerrainFill: noop, biomeEdge: noop, drawBiomeBG: noop, drawBiomeDecor: noop, splatCols: noop, biomeDark: noop, biomeMist: noop }));
vi.mock('../../src/boss/update', () => ({ startBoss: noop }));
vi.mock('../../src/enemies/ufo', () => ({ ufoWarn: noop }));

const biomes: any = await import('../../src/biomes');
const { biomeReset, biomeStage } = biomes;
const { buildStage, rebuildAt } = await import('../../src/stagebuild');
const { setLayout, layout, stageOfSlot } = await import('../../src/layout');
const { applyRun, decodeRun, serializeRun } = await import('../../src/runsave');

type Entry = { x: number; k?: string };
const list = (S: Entry[]) => S.map((e) => `${e.x}:${e.k}`);
/** the run state the builds read, Descent `loop`, both gates taken (slot 1 a repeat visit) */
const run = (loop: number, stage: number) => {
  const L = layout();
  return { loop, stage, seed: 0xbadcafe, script: [] as Entry[], si: 0, pend: [], route: ['acid', 'ice'], visitNo: [0, 1], remixV: {},
    bx: [L.stages[1].x0 + 377.25, L.stages[2].x0 + 401.5, L.stages[3].x0 + 300] };
};
/** what the run itself built by the time it reached stage `stage`, in the order it built it */
function original(loop: number, stage: number) {
  $.G = run(loop, stage) as any;
  if (stage >= 0 && layout().stages[0].kind !== 'biome') buildStage(0);
  for (let i = 1; i <= stage; i++) {
    const r = layout().stages[i];
    if (r.kind === 'biome') biomeStage(r.slot!, $.G.bx[r.slot!]);
    else buildStage(i);
  }
  return $.G;
}
/** the same run after a save and a resume: only the run-save fields survive */
function resumed(G0: any, cpX: number) {
  const d = decodeRun(JSON.stringify(serializeRun({ ...G0, cpX, cpN: 1, layout: layout().id }, {})))!;
  $.G = { script: [], si: 0, pend: [] } as any;
  applyRun(d, $.G, null);
  rebuildAt(cpX);
  return $.G;
}
const left = (G: any, cpX: number) => list(G.script.slice(G.si).filter((e: Entry) => e.x > cpX));

describe('the resume rebuild', () => {
  beforeEach(() => { terrain.mockClear(); });

  it.each(['short', 'long4'] as const)('rebuilds every stage of %s to the same script still to fire, in Descents 1 and 2', (id) => {
    setLayout(id);
    for (const loop of [0, 1]) for (const stage of [0, 1, 2, 3]) {
      const r = layout().stages[stage], G0 = original(loop, stage), cpX = r.x0 + 500;
      const want = left(G0, cpX);
      expect(want.length).toBeGreaterThan(3);
      const G1 = resumed(G0, cpX);
      expect(list(G1.script.slice(G1.si))).toEqual(want);
      expect(G1.script[G1.si - 1]?.x ?? -Infinity).toBeLessThanOrEqual(cpX); // everything up to cpX skipped
      expect(terrain).toHaveBeenLastCalledWith(loop);
    }
    setLayout('short');
  });

  it('rebuilds a biome slot from its stored gate x, so a late gate keeps its own script', () => {
    setLayout('long4');
    const early = original(0, 1), cpX = 6000;
    const late = run(0, 1);
    late.bx[0] += 250;
    $.G = late as any;
    biomeStage(0, late.bx[0]);
    const want = left($.G, cpX);
    expect(want).not.toEqual(left(early, cpX));
    expect(list(resumed(late, cpX).script.slice($.G.si))).toEqual(want);
    setLayout('short');
  });

  it('never rebuilds a slot the run has not reached yet', () => {
    setLayout('long4');
    const G0 = original(0, 1), cpX = 5000;
    const G1 = resumed({ ...G0 }, cpX); // route[1] and bx[1] are set, but stage 1 is slot 0
    const s1 = layout().stages[stageOfSlot(1)];
    expect(G1.script.some((e: Entry) => e.x >= s1.x0 + 300)).toBe(false);
    setLayout('short');
  });
});

// item F's midboss state (sprint 3 F review carry-forward 1): G.mb (each stage's pair, picked once), G.mbUsed (met
// this descent), G.mbLast (each biome's previous pair, kept across descents). The resume calls biomeReset() BEFORE
// applyRun() (flow.ts resumeRun), so the restored state must stand; a new descent's biomeReset then forgets mb and
// mbUsed but keeps mbLast.
describe('the midboss picks across a resume', () => {
  const MB = { 0: ['ufo'], 1: ['choir', 'cyst'] }, USED = ['ufo', 'choir', 'cyst'], LAST = { ice: ['choir', 'cyst'], fire: ['prentice', 'brood'] };
  /** a run save taken at stage 1 CP1 holding the picker's state, restored the way resumeRun does */
  function restore() {
    const d = decodeRun(JSON.stringify(serializeRun({ ...run(0, 1), mb: MB, mbUsed: USED, mbLast: LAST, cpX: 6000, cpN: 1, layout: 'long4' }, {})))!;
    $.G = { script: [], si: 0, pend: [] } as any;
    biomeReset();
    applyRun(d, $.G, null);
    return $.G;
  }
  beforeEach(() => setLayout('long4'));

  it('keeps the stored picks, the met list and the previous pairs through the resume order', () => {
    const G = restore();
    expect(G.mb).toEqual(MB);
    expect(G.mbUsed).toEqual(USED);
    expect(G.mbLast).toEqual(LAST);
    setLayout('short');
  });

  it('reads a resumed stage pair back instead of picking again', () => {
    const G = restore();
    expect(biomes.stageMids(1, 'ice')).toEqual(['choir', 'cyst']);
    expect(G.mbUsed).toEqual(USED); // not met a second time
    setLayout('short');
  });

  it('forgets this descent picks at the next descent but keeps each biome previous pair', () => {
    const G = restore();
    biomeReset(); // startLoop's, for the next descent
    expect(G.mb).toEqual({});
    expect(G.mbUsed).toEqual([]);
    expect(G.mbLast).toEqual(LAST);
    setLayout('short');
  });
});
