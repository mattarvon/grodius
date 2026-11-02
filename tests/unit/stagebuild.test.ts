import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// LS1 rows C and B2: each stage is built by buildStage(i, fromX). These pin that the per-stage build of the short
// layout places Descent 1 exactly as the old up-front buildScript did, dispatches a biome stage to its slot, and merges
// into the live script. tests/unit/buildstream.test.ts covers the build streams (no sim RNG, rebuilds identical).
vi.mock('../../src/core', () => ({ PH: 254, W: 480 }));
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
  const { seedOf, stream } = await import('../../src/rng');
  const stageStream = (i: number) => stream(seedOf($.G.seed, $.G.loop, i));
  return { biomeStage: (...a: unknown[]) => biomeStage(...a), insertScript, stageStream };
});

const { stageScript } = await import('../../src/enemies/scripts');
const { seedOf, stream } = await import('../../src/rng');
const { buildStage } = await import('../../src/stagebuild');
const { lastStage, row } = await import('../../src/layout');

// the script x list at Descent 1's start, tools/layout-parity.baseline.json run 1 stage 0-0 (the classic variants;
// recorded from the old up-front buildScript). The exact numbers are the point
const D1 = [200, 400, 500, 580, 660, 730, 800, 980, 1040, 1100, 1220, 1320, 1400, 1500, 1620, 1700, 1760, 1880, 1900, 2000, 2120,
  8430, 8440, 8520, 8580, 8650, 8730, 8760, 8790, 8850, 8920, 8990, 9060, 9150, 9300];

/** every non-biome stage of a descent, each built as on its entry */
function buildDescent() {
  for (let i = 0; i <= lastStage(); i++) if (row(i)!.kind !== 'biome') buildStage(i);
}

describe('buildStage (short layout)', () => {
  beforeEach(() => {
    $.G = { loop: 0, seed: 1, script: [], si: 0, route: [null, null], visitNo: [0, 0] };
    biomeStage.mockClear();
  });

  it('places Descent 1 exactly as the old up-front build did', () => {
    buildDescent();
    expect($.G.script.map((e: { x: number }) => e.x)).toEqual(D1);
  });

  it('keeps every script x inside its own stage row, in every descent', () => {
    for (const L of [0, 1, 2]) {
      $.G.loop = L;
      for (const i of [0, 3]) {
        const r = row(i)!;
        for (const e of stageScript(i, stream(seedOf(1, L, i)))) expect(e.x >= r.x0 && e.x < r.x1).toBe(true);
      }
    }
  });

  it('builds a biome stage through its slot, from the gate x', () => {
    buildStage(2, 5637);
    expect(biomeStage).toHaveBeenCalledWith(1, 5637);
  });

  it('merges a stage into the unplayed script, sorted, leaving the played part alone', () => {
    buildStage(3);
    $.G.si = 2;
    const played = $.G.script.slice(0, 2);
    buildStage(0);
    expect($.G.script.slice(0, 2)).toEqual(played);
    const xs = $.G.script.slice(2).map((e: { x: number }) => e.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });
});
