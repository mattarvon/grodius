// LS2-0: the WIP flag end to end through biomes.ts stageMids, the call a real run makes. midreg.test.ts covers
// biomePool and pickBiomeMids with the flag as an argument; this file proves stageMids hands them lab.ts midsWip(),
// so a `wip: true` row reaches a biome stage only under ?mids=wip or the LAB row. The roster gains a greybox row (as
// a pool lane adds one) and midsWip is a switch; the rest is midslot.test.ts's mock set for loading biomes.ts.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

let seed = 1;
const R = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** the flag as lab.ts midsWip() reports it */
let wip = false;
vi.mock('../../src/lab', async (orig) => ({ ...(await orig<typeof import('../../src/lab')>()), midsWip: () => wip }));
/** the roster with one WIP biome-pool row appended, as a pool lane adds one (a held ice kind, Descent 1) */
vi.mock('../../src/enemies/mid/roster', async (orig) => {
  const m = await orig<typeof import('../../src/enemies/mid/roster')>();
  const ROSTER = [...m.ROSTER, { k: 'greybox', name: 'THE GREYBOX', label: 'GREYBOX', tag: 'WINDOW', pool: 'ice', min: 0, fit: { up: 20, dn: 20, hw: 20 }, wip: true }];
  return { ...m, ROSTER, biomePool: (w = false, rows = ROSTER) => m.biomePool(w, rows) };
});
vi.mock('../../src/core', () => ({
  C: {}, DC: [], FIRE: ['#f00'], H: 270, PH: 254, R: () => R(), TAU: Math.PI * 2, TS: 4, W: 480, ctx: {},
  clamp: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)), dist2: () => 0, hash: () => .5,
  lerp: (a: number, b: number, t: number) => a + (b - a) * t, pick: (a: unknown[]) => a[0],
  ri: (a: number) => a, rr: (a: number) => a, sstep: () => 0, vnoise: () => .5,
}));
vi.mock('../../src/world', () => ({ CEIL: [], FLOOR: [], ceilAt: () => 0, floorAt: () => 254, shots: [], enemies: [] }));
vi.mock('../../src/textures', () => ({ mkTex: () => null }));
vi.mock('../../src/audio', () => ({ sfx: { forkOpen: () => {} }, sample: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/fx/spawn', () => ({ spark: () => {}, drop: () => {}, flash: () => {}, gore: () => {}, pop: () => {}, mist: () => {} }));
vi.mock('../../src/render/util', () => ({ glow: () => {}, light: () => {} }));
vi.mock('../../src/enemies/elite', () => ({ eliteChance: () => 0, eliteRoll: () => {} }));
vi.mock('../../src/stages', () => ({ startStage: () => {} }));
vi.mock('../../src/render/biomeart', () => ({
  biomePat: () => {}, biomeTerrainFill: () => {}, biomeEdge: () => {}, drawBiomeBG: () => {}, drawBiomeDecor: () => {},
  splatCols: () => {}, biomeDark: () => 1, biomeMist: () => null, drawFX: () => {},
}));
vi.mock('../../src/enemies/spawn', () => {
  const noop = () => {};
  const k = ['banner', 'behindWave', 'butcher', 'corpse', 'crawler', 'crossT', 'eyeT', 'flayer', 'formation', 'hatch', 'hookE', 'logLine', 'maw', 'womb', 'crux', 'mutant', 'slime'];
  return {
    ...Object.fromEntries(k.map((n) => [n, noop])),
    miniWarn: noop,
    midboss: noop,
  };
});


const L = await import('../../src/layout');
const { stageMids } = await import('../../src/biomes');
const { MIDS } = await import('../../src/midpick');

const SEEDS = 300;
/** stage 1 (ice) picked fresh for each of SEEDS runs: how many runs meet the greybox */
const meets = () => {
  let n = 0;
  for (let s = 1; s <= SEEDS; s++) {
    $.G = { loop: 0, seed: s * 7919 };
    $.meta = { mb: {} };
    if (stageMids(1, 'ice').includes('greybox')) n++;
  }
  return n;
};

describe('stageMids and the WIP flag', () => {
  beforeAll(() => L.setLayout('long4'));
  afterAll(() => L.setLayout('short'));
  beforeEach(() => { seed = 1; wip = false; });

  it('knows the greybox row, so a run saved under the flag still loads', () => {
    expect(MIDS.greybox).toEqual({ body: 'greybox', tag: 'WINDOW', min: 0 });
  });

  it('never picks a WIP kind for a biome stage with the flag off', () => {
    expect(meets()).toBe(0);
  });

  it('picks the WIP kind in some biome stages with the flag on', () => {
    wip = true;
    expect(meets()).toBeGreaterThan(0);
  });
});
