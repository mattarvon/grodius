// The biome signatures' runtime (src/biomes.ts: the runs, which drive W3a's solids.ts engine): the runs reach the
// engine, the hazard pause, and a stage built twice plans the same runs. core's hash / vnoise are the real arithmetic; only the DOM side is stubbed.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const world = vi.hoisted(() => ({ CEIL: new Float32Array(0), FLOOR: new Float32Array(0), shots: [] as any[] }));
vi.mock('../../src/core', () => {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t, clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
  const hash = (n: number) => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  const vnoise = (x: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
  const sstep = (a: number, b: number, x: number) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  return { C: {}, DC: [], FIRE: ['#f00'], H: 270, PH: 254, R: () => .5, TAU: Math.PI * 2, TS: 4, W: 480, ctx: {}, clamp, dist2: () => 0, hash, lerp, pick: (a: unknown[]) => a[0], ri: (a: number) => a, rr: (a: number) => a, sstep, vnoise };
});
const at = (A: Float32Array, x: number) => { const f = x / 4, i = Math.floor(f); return A[i] + (A[i + 1] - A[i]) * (f - i); };
vi.mock('../../src/world', () => ({ get CEIL() { return world.CEIL; }, get FLOOR() { return world.FLOOR; }, ceilAt: (x: number) => at(world.CEIL, x), floorAt: (x: number) => at(world.FLOOR, x), get shots() { return world.shots; }, enemies: [] }));
vi.mock('../../src/textures', () => ({ mkTex: () => null }));
vi.mock('../../src/audio', () => ({ sfx: new Proxy({}, { get: () => () => {} }), sample: () => true }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/fx/spawn', () => ({ spark: () => {}, drop: () => {}, flash: () => {}, gore: () => {}, pop: () => {}, mist: () => {} }));
vi.mock('../../src/render/util', () => ({ glow: () => {}, light: () => {} }));
vi.mock('../../src/enemies/elite', () => ({ eliteChance: () => 0, eliteRoll: () => {} }));
vi.mock('../../src/stages', () => ({ startStage: () => {} }));
vi.mock('../../src/render/biomeart', () => ({ biomePat: () => {}, biomeTerrainFill: () => {}, biomeEdge: () => {}, drawBiomeBG: () => {}, drawBiomeDecor: () => {}, splatCols: () => {}, biomeDark: () => 1, biomeMist: () => null, drawFX: () => {} }));
vi.mock('../../src/enemies/spawn', () => {
  const k = ['banner', 'behindWave', 'butcher', 'corpse', 'crawler', 'crossT', 'eyeT', 'flayer', 'formation', 'hatch', 'dolls', 'hookE', 'edgeWave', 'logLine', 'maw', 'midboss', 'miniWarn', 'womb', 'crux', 'mutant', 'slime', 'watcher'];
  return Object.fromEntries(k.map((n) => [n, () => {}]));
});

const L = await import('../../src/layout');
const BI = await import('../../src/biomes');
const S = await import('../../src/sigs');
const HR = await import('../../src/boss/bossrules');
const { CATALOG } = await import('../../src/setdraw');

/** a flat corridor: ceiling 30, floor 224 (gap 194) */
function flat() { const n = 6000; world.CEIL = new Float32Array(n).fill(30); world.FLOOR = new Float32Array(n).fill(224); }
function freshG(extra: object = {}) { $.G = { t: 0, loop: 0, seed: 7, scroll: 1000, scrollSpeed: 1, pend: [], script: [], si: 0, route: [null, null], visitNo: [0, 0], bx: [null, null, null], ...extra }; $.P = { x: 150, y: 127, alive: true, inv: 0 }; world.shots.length = 0; }
const SO = await import('../../src/solids');
const TB = await import('../../src/terrainb');

// the engine itself (tides, swallows, blocks, plugs, S5) is W3a's, tested in solids.test.ts / terrainb.test.ts; these
// check that the signature runs drive it (W6: the W3c stand-in adapter was swapped for the solids.ts imports)
describe('the runs drive the space engine (solids.ts)', () => {
  beforeAll(() => L.setLayout('long4'));
  function built(b: string) {
    const n = Math.ceil(L.layout().level / 4) + 300; world.CEIL = new Float32Array(n).fill(10); world.FLOOR = new Float32Array(n).fill(244);
    const i = L.stageOfSlot(0), route = [b, null] as (string | null)[];
    freshG({ route, mb: { [i]: ['choir', 'cyst'] }, picks: { [i]: { mv: 0, sp: CATALOG[b].slice(0, 3) } }, spUsed: {} });
    BI.biomeStage(0, L.slotRow(0).gateLate!);
    return BI.sigRuns() as any;
  }
  it('MORGUE RUSH releases its blocks into solids.ts, and a rebuild of the slot retires them', () => {
    const R = built('ice'), r = R.runs[0];
    $.G.scroll = r.V.x0; r.on = true; r.t = 0;
    for (let k = 0; k < 3; k++) { $.G.t++; R.step(); SO.stepSolids(); }
    const mine = () => SO.solids.filter((q: any) => q.k === 'ice' && q.sig === r.sig && q.st !== 'dead');
    expect(mine().length).toBeGreaterThan(0);
    built('ice');
    expect(mine().length).toBe(0);
  });
  it('HIGH TIDE arms a DYN tide window over its span on its first step', () => {
    const R = built('acid'), r = R.runs[0];
    $.G.scroll = r.V.x0 - 200; r.on = true; r.t = 0;
    $.G.t++; R.step();
    expect(TB.DYNS.some((w: any) => w.spec.kind === 'tide' && w.spec.x0 === r.V.x0 && w.spec.x1 === r.V.x1)).toBe(true);
    SO.resetSolids();
  });
});

describe('the runs', () => {
  beforeAll(() => L.setLayout('long4'));
  function build(b: string, seg = 0) {
    const n = Math.ceil(L.layout().level / 4) + 300; world.CEIL = new Float32Array(n).fill(10); world.FLOOR = new Float32Array(n).fill(244);
    const i = L.stageOfSlot(seg), route = [null, null] as (string | null)[]; route[seg] = b;
    freshG({ route, mb: { [i]: ['choir', 'cyst'] }, picks: { [i]: { mv: 0, sp: CATALOG[b].slice(0, 3) } }, spUsed: {} });
    BI.biomeStage(seg, L.slotRow(seg).gateLate!);
    return BI.sigRuns().runs.map((r: any) => ({ k: r.k, v: r.v, V: r.V, sig: r.sig }));
  }
  it('a stage built twice plans the same runs, windows and arming entries', () => {
    for (const b of ['ice', 'acid', 'fire', 'snot']) {
      const a = build(b), sa = $.G.script.filter((e: any) => e.k.startsWith('sig:')).map((e: any) => e.x);
      const c = build(b), sc = $.G.script.filter((e: any) => e.k.startsWith('sig:')).map((e: any) => e.x);
      expect(c).toEqual(a); expect(sc).toEqual(sa); expect(a.length).toBe(3);
      expect(S.sigWindows($).length).toBeGreaterThanOrEqual(3);
    }
  });
  it('the random hazard timer pauses while a variation runs, except HIGH TIDE v3 (its geysers)', () => {
    build('fire');
    const R = BI.sigRuns() as any;
    expect(R.pause()).toBe(false);
    R.runs[0].on = true;
    expect(R.pause()).toBe(true);
    build('acid');
    const A = BI.sigRuns() as any;
    A.runs[2].on = true;
    expect(A.pause()).toBe(false);
    A.runs[1].on = true;
    expect(A.pause()).toBe(true);
  });
  it('short has no signatures', () => {
    L.setLayout('short');
    try { flat(); freshG({ route: ['ice', null] }); BI.biomeStage(0, L.slotRow(0).x0); expect(BI.sigRuns().runs.length).toBe(0); }
    finally { L.setLayout('long4'); }
  });
});

describe('W4b hook', () => {
  it('dropHazard hangs a marked, shootable icicle under the ceiling at screen x; other kinds are ignored', () => {
    flat(); freshG();
    const H = (globalThis as any).__biome().haz, n = H.length;
    BI.dropHazard('icicle', 200);
    BI.dropHazard('jet', 200);
    expect(H.length).toBe(n + 1);
    expect(H[n]).toMatchObject({ k: 'icicle', x: 200, y: 32, aim: 1, shoot: 1 });
    BI.hookHazards();
    expect(HR.HAZ_HOOK.drop).toBe(BI.dropHazard); // registered at load, and again by hookHazards
  });
  it('refuses the drop between stages and without a live ship (W6 r4, L5 hazBad state:icicle)', () => {
    const H = (globalThis as any).__biome().haz;
    for (const set of [{ tally: {} }, { fork: {} }, { forkHold: true }, { clearT: 30 }] as Record<string, unknown>[]) {
      flat(); freshG(); Object.assign($.G as object, set); const n = H.length;
      BI.dropHazard('icicle', 200); expect(H.length, JSON.stringify(set)).toBe(n);
    }
    flat(); freshG(); const P = $.P; const n = H.length;
    try { ($.P as any) = { ...(P as object), alive: false }; BI.dropHazard('icicle', 200); expect(H.length).toBe(n);
      ($.P as any) = null; BI.dropHazard('icicle', 200); expect(H.length).toBe(n); } finally { ($.P as any) = P; }
  });
});
