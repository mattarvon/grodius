import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// LS1 row C: each stage is built by buildStage(i, fromX). These pin that the per-stage build of the short layout
// places exactly what the old up-front buildScript did, and that placing a stage never draws the sim RNG (the
// variant picks draw it once, at startLoop, in the old order).
let draws = 0;
let next = 0;
vi.mock('../../src/core', () => ({ PH: 254, W: 480, ri: (a: number, b: number) => { draws++; return Math.min(b, a + next); } }));
vi.mock('../../src/audio', () => ({ sfx: {} }));
vi.mock('../../src/boss/update', () => ({ startBoss: () => {} }));
vi.mock('../../src/enemies/ufo', () => ({ ufoWarn: () => {} }));
const noop = () => {};
vi.mock('../../src/enemies/spawn', () => ({ banner: noop, behindWave: noop, corpse: noop, crawler: noop, eyeT: noop, flayer: noop, formation: noop, hatch: noop, logLine: noop, maw: noop, mutant: noop, sentry: noop, womb: noop }));
const biomeStage = vi.fn();
vi.mock('../../src/biomes', async () => {
  // the real insertScript (pure on $.G); biomeStage is a spy, its own build is covered by the parity check
  const insertScript = (entries: { x: number }[]) => {
    const G = $.G, rest = G.script.slice(G.si).concat(entries).sort((a: { x: number }, b: { x: number }) => a.x - b.x);
    G.script = G.script.slice(0, G.si).concat(rest);
  };
  return { biomeStage: (...a: unknown[]) => biomeStage(...a), insertScript };
});

const { pickStageVariants, stageScript } = await import('../../src/enemies/scripts');
const { buildStage } = await import('../../src/stagebuild');
const { lastStage, row } = await import('../../src/layout');

// the script x list at Descent 1's start, tools/layout-parity.baseline.json run 1 stage 0-0 (the classic variants;
// recorded from the old up-front buildScript). The exact numbers are the point
const D1 = [200, 400, 500, 580, 660, 730, 800, 980, 1040, 1100, 1220, 1320, 1400, 1500, 1620, 1700, 1760, 1880, 1900, 2000, 2120,
  8430, 8440, 8520, 8580, 8650, 8730, 8760, 8790, 8850, 8920, 8990, 9060, 9150, 9300];

/** startLoop's build: the picks, then every non-biome stage */
function buildDescent(L: number) {
  pickStageVariants(L);
  for (let i = 0; i <= lastStage(); i++) if (row(i)!.kind !== 'biome') buildStage(i);
}

describe('buildStage (short layout)', () => {
  beforeEach(() => {
    $.G = { loop: 0, script: [], si: 0, route: [null, null], visitNo: [0, 0] };
    draws = 0;
    next = 0;
    biomeStage.mockClear();
  });

  it('places Descent 1 exactly as the old up-front build did', () => {
    buildDescent(0);
    expect($.G.script.map((e: { x: number }) => e.x)).toEqual(D1);
  });

  it('draws no RNG in Descent 1, and one per section from Descent 2 on, all at the picks', () => {
    buildDescent(0);
    expect(draws).toBe(0);
    $.G.script = [];
    buildDescent(1);
    expect(draws).toBe(5); // oA, oC, oD, dE, dF
    const before = draws;
    for (let i = 0; i <= lastStage(); i++) if (row(i)!.kind !== 'biome') stageScript(i);
    expect(draws).toBe(before); // placing a stage never draws
  });

  it('places the same stage the same way twice', () => {
    pickStageVariants(1);
    const a = stageScript(0).map((e: { x: number }) => e.x), b = stageScript(0).map((e: { x: number }) => e.x);
    expect(a).toEqual(b);
    expect(stageScript(3).map((e: { x: number }) => e.x)).toEqual(stageScript(3).map((e: { x: number }) => e.x));
  });

  it('keeps every script x inside its own stage row', () => {
    pickStageVariants(1);
    for (const i of [0, 3]) {
      const r = row(i)!;
      for (const e of stageScript(i)) expect(e.x >= r.x0 && e.x < r.x1).toBe(true);
    }
  });

  it('builds a biome stage through its slot, from the gate x', () => {
    buildStage(2, 5637);
    expect(biomeStage).toHaveBeenCalledWith(1, 5637);
  });

  it('merges a stage into the unplayed script, sorted, leaving the played part alone', () => {
    pickStageVariants(0);
    buildStage(3);
    $.G.si = 2;
    const played = $.G.script.slice(0, 2);
    buildStage(0);
    expect($.G.script.slice(0, 2)).toEqual(played);
    const xs = $.G.script.slice(2).map((e: { x: number }) => e.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });
});
