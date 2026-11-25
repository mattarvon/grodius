// W2 (DIFFICULTY-SPEC §2.1 "Death penalty" checkpoints, C21; §5.1 risk "Checkpoint restore inside a DYN or solids
// window"): the long4 checkpoint list (checkpoint.ts cpPlan) and a restore at EVERY checkpoint of every stage, every
// biome in both slots, Descents 1 and 2. A restore is the run-save round trip plus stagebuild.ts rebuildAt: it must
// decode, rebuild the same script still to fire as the run that wrote it, draw no sim RNG, and sit outside every
// signature window (sigs.ts sigWindows through checkpoint.ts sigSpans; W3's solids and DYN rebuild from the beat, so a
// window-free checkpoint is the mechanism's half of that risk). Mocks as resume.test.ts.
import { describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const simDraw = () => { throw new Error('the rebuild drew the sim RNG'); };
vi.mock('../../src/core', () => ({
  C: { blood: '', bloodD: '', bloodL: '' }, DC: ['', '', '', '', '', ''], FIRE: [], H: 270, PH: 254, TAU: Math.PI * 2, TS: 4, W: 480,
  R: simDraw, rr: simDraw, ri: simDraw, pick: simDraw,
  clamp: (v: number) => v, ctx: {}, dist2: () => 0, hash: () => 0, lerp: (a: number) => a, sstep: () => 0, vnoise: () => 0,
}));
vi.mock('../../src/world', () => ({ CEIL: new Float32Array(4), FLOOR: new Float32Array(4), ceilAt: () => 0, floorAt: () => 0, shots: [], enemies: [], buildTerrain: () => {} }));
vi.mock('../../src/textures', () => ({ mkTex: () => ({}) }));
vi.mock('../../src/audio', () => ({ sfx: {}, sample: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/fx/spawn', () => ({ spark: () => {}, drop: () => {}, flash: () => {}, gore: () => {}, pop: () => {}, mist: () => {} }));
const noop = () => {};
vi.mock('../../src/enemies/spawn', () => ({
  banner: noop, behindWave: noop, butcher: noop, corpse: noop, crawler: noop, crossT: noop, eyeT: noop, flayer: noop, formation: noop,
  hatch: noop, hookE: noop, logLine: noop, maw: noop, midboss: noop, miniWarn: noop, womb: noop, crux: noop, mutant: noop, slime: noop, sentry: noop, watcher: noop,
}));
vi.mock('../../src/render/util', () => ({ glow: noop, light: noop }));
vi.mock('../../src/stages', () => ({ startStage: noop, sealFor: () => 0 }));
vi.mock('../../src/render/biomeart', () => ({ drawFX: noop, biomePat: noop, biomeTerrainFill: noop, biomeEdge: noop, drawBiomeBG: noop, drawBiomeDecor: noop, splatCols: noop, biomeDark: noop, biomeMist: noop }));
vi.mock('../../src/boss/update', () => ({ startBoss: noop }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoWarn: noop }));

const { BIOME_KEYS, biomeStage } = await import('../../src/biomes');
const { buildStage, rebuildAt } = await import('../../src/stagebuild');
const { cpsOf, layout, setLayout } = await import('../../src/layout');
const { CP, cpInSig, cpPlan, stageStartX } = await import('../../src/checkpoint');
const { applyRun, decodeRun, serializeRun } = await import('../../src/runsave');

type Entry = { x: number; k?: string };
const list = (S: Entry[]) => S.map((e) => `${e.x}:${e.k}`);
const run = (loop: number, stage: number, route: string[]) => {
  const L = layout();
  return { loop, stage, seed: 0x5eed, script: [] as Entry[], si: 0, pend: [], route, visitNo: [0, 0], remixV: {},
    bx: [L.stages[1].x0 + 377.25, L.stages[2].x0 + 401.5, L.stages[3].x0 + 300] };
};
function original(loop: number, stage: number, route: string[]) {
  $.G = run(loop, stage, route) as any;
  buildStage(0);
  for (let i = 1; i <= stage; i++) {
    const r = layout().stages[i];
    if (r.kind === 'biome') biomeStage(r.slot!, $.G.bx[r.slot!]);
    else buildStage(i);
  }
  return $.G;
}
function restore(G0: any, cpX: number) {
  const d = decodeRun(JSON.stringify(serializeRun({ ...G0, cpX, cpN: 1, layout: layout().id, rev: layout().rev ?? 1 }, {})));
  expect(d, `checkpoint at ${cpX} decodes`).not.toBeNull();
  $.G = { script: [], si: 0, pend: [] } as any;
  applyRun(d!, $.G, null);
  rebuildAt(cpX);
  return $.G;
}
const routes = () => BIOME_KEYS.flatMap((a: string) => BIOME_KEYS.filter((b: string) => b !== a).map((b: string) => [a, b]));

describe('the long4 checkpoint list (C21)', () => {
  it('spaces every stage <= 30 s of scroll, ends 10 s before the boss WARNING, and stays inside the stage', () => {
    setLayout('long4');
    for (const route of routes()) for (const loop of [0, 1]) for (let i = 0; i < 4; i++) {
      const G = run(loop, i, route), r = layout().stages[i], plan = cpPlan(i, G, true, []);
      const start = stageStartX(i, G), xs = plan.map((q: any) => q.x);
      expect(xs.length).toBeGreaterThan(1);
      expect([...xs].sort((a, b) => a - b)).toEqual(xs);
      expect(xs.at(-1)).toBe((r.warnX ?? r.bossX) - CP.warnLead);
      let prev = start;
      for (const x of xs) { expect(x - prev).toBeLessThanOrEqual(CP.gap); expect(x).toBeGreaterThan(prev); prev = x; }
      expect(xs.at(-1)).toBeLessThan(r.bossX);
    }
  });

  it('keeps short on CP1 alone (today\'s rule, layout parity)', () => {
    setLayout('short');
    for (let i = 0; i < 4; i++) expect(cpPlan(i, run(0, i, ['ice', 'fire']), false).length).toBeLessThanOrEqual(1);
    setLayout('long4');
  });

  it('moves a checkpoint out of a signature window, and plans one just before each window starts', () => {
    setLayout('long4');
    const r = layout().stages[0], w = { x0: r.x0 + 1500, x1: r.x0 + 2400 }, plan = cpPlan(0, run(0, 0, ['ice', 'fire']), true, [w]);
    for (const q of plan) expect(cpInSig(q.x, [w])).toBe(false);
    expect(plan.some((q: any) => q.x === w.x0 - CP.shipX - 1)).toBe(true);
    // a window across the whole fill region still leaves the WARNING checkpoint (it is outside the window) and every gap
    // that can be filled outside the window filled
    const wide = { x0: r.x0 + 300, x1: r.x0 + 3000 }, p2 = cpPlan(0, run(0, 0, ['ice', 'fire']), true, [wide]);
    for (const q of p2) expect(cpInSig(q.x, [wide])).toBe(false);
  });

  it('uses a window cp (W3c sigCheckpoints) and the row cps list (W3b cpsOf) as anchors', () => {
    setLayout('long4');
    const r = layout().stages[0], w = { x0: r.x0 + 1500, x1: r.x0 + 2400, cp: r.x0 + 1380 }, plan = cpPlan(0, run(0, 0, ['ice', 'fire']), true, [w]);
    expect(plan.some((q: any) => q.x === w.cp)).toBe(true);
    const xs = cpPlan(0, run(0, 0, ['ice', 'fire']), true, []).map((q: any) => q.x);
    for (const x of cpsOf(0)!.filter((x) => x > r.x0)) expect(xs.some((q: number) => Math.abs(q - x) < CP.minSep)).toBe(true);
  });
});

describe('C21 holds with signature windows in the way (systems-designer)', () => {
  it('keeps every gap <= 30 s and no checkpoint in a window, for windows up to 25 s long anywhere in a stage', () => {
    setLayout('long4');
    const G = run(0, 0, ['ice', 'fire']);
    for (let i = 0; i < 4; i++) {
      const r = layout().stages[i], start = stageStartX(i, G), end = (r.warnX ?? r.bossX) - CP.warnLead;
      for (let at = start + 200; at < end - 400; at += 350) for (const len of [200, 700, 1500]) {
        const w = [{ x0: at, x1: at + len }], xs = cpPlan(i, G, true, w).map((q: any) => q.x);
        let prev = start;
        for (const x of xs) { expect(x - prev, `stage ${i} window ${at}+${len}`).toBeLessThanOrEqual(CP.gap); expect(cpInSig(x, w)).toBe(false); prev = x; }
      }
    }
  });
});

describe('a restore at every checkpoint (spec §5.1: "a unit test restores at every checkpoint of every biome")', () => {
  it.each([0, 1])('rebuilds the same script still to fire at each one, Descent %i, every route', (loop) => {
    setLayout('long4');
    let n = 0;
    for (const route of routes()) for (let i = 0; i < 4; i++) {
      const G0 = original(loop, i, route), plan = cpPlan(i, G0, true);
      for (const q of plan) {
        expect(cpInSig(q.x)).toBe(false);
        const want = list(G0.script.filter((e: Entry) => e.x > q.x));
        const G1 = restore(G0, q.x);
        expect(list(G1.script.slice(G1.si))).toEqual(want);
        expect(G1.script[G1.si - 1]?.x ?? -Infinity).toBeLessThanOrEqual(q.x);
        n++;
      }
    }
    expect(n).toBeGreaterThan(routes().length * 4 * 2); // at least two checkpoints a stage on average
  });
});
