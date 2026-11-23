// The biome signatures' runtime (src/biomes.ts: the runs and the local engine adapter that stands in for W3a's
// solids.ts): the terrain comes back exactly, the lodge rule, S5 for the mucus plug, the hazard pause, and a stage
// built twice plans the same runs. core's hash / vnoise are the real arithmetic; only the DOM side is stubbed.
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
  const k = ['banner', 'behindWave', 'butcher', 'corpse', 'crawler', 'crossT', 'eyeT', 'flayer', 'formation', 'hatch', 'hookE', 'logLine', 'maw', 'midboss', 'miniWarn', 'womb', 'crux', 'mutant', 'slime'];
  return Object.fromEntries(k.map((n) => [n, () => {}]));
});

const L = await import('../../src/layout');
const BI = await import('../../src/biomes');
const S = await import('../../src/sigs');
const { CATALOG } = await import('../../src/setdraw');

/** a flat corridor: ceiling 30, floor 224 (gap 194) */
function flat() { const n = 6000; world.CEIL = new Float32Array(n).fill(30); world.FLOOR = new Float32Array(n).fill(224); }
function freshG(extra: object = {}) { $.G = { t: 0, loop: 0, seed: 7, scroll: 1000, scrollSpeed: 1, pend: [], script: [], si: 0, route: [null, null], visitNo: [0, 0], bx: [null, null, null], ...extra }; $.P = { x: 150, y: 127, alive: true, inv: 0 }; world.shots.length = 0; }
const E = () => BI.sigRuns().eng as any;
const step = (n: number) => { for (let i = 0; i < n; i++) { $.G.t++; E().step(); } };

describe('the engine adapter', () => {
  beforeAll(() => L.setLayout('long4'));
  it('a tide rises, never under its fit floor, and puts the terrain back exactly', () => {
    flat(); freshG(); E().reset();
    const F0 = world.FLOOR.slice(), C0 = world.CEIL.slice(), V = S.TIDE.vars[2];
    E().armTide({ x0: 1200, x1: 1650, d: V.d, rise: V.rise, hold: V.hold, drain: V.drain, tell: S.TIDE.tell, fit: 160, sig: 'b0:t', v: 2 });
    step(S.TIDE.tell + V.rise + 10);
    expect(Math.min(...world.FLOOR.slice(300, 412))).toBeCloseTo(30 + 160 + S.TIDE.pad, 0); // the 70 px rise capped at the fit floor + pad
    for (let i = 300; i < 412; i++) expect(world.FLOOR[i] - world.CEIL[i]).toBeGreaterThanOrEqual(160);
    step(S.tideLen(2));
    expect(world.FLOOR).toEqual(F0); expect(world.CEIL).toEqual(C0);
    expect(E().wins.length).toBe(0);
  });
  it('a swallow clenches inside its window only and puts the terrain back exactly', () => {
    flat(); freshG(); E().reset();
    const F0 = world.FLOOR.slice(), V = S.SWALLOW.vars[0];
    E().armSwallow({ x0: 1200, x1: 1680, S: V.S, T: V.T, dur: 400, tell: S.SWALLOW.tell, fit: 72, split: false, sig: 'b0:s', v: 0 });
    step(S.SWALLOW.tell + V.T / 2);
    expect(world.CEIL[360]).toBeGreaterThan(30 + V.S - 1);
    expect(world.CEIL[250]).toBe(30); // outside
    step(400);
    expect(world.FLOOR).toEqual(F0);
  });
  it('a block that would leave the fit under its floor shatters; one that would not lodges into the terrain', () => {
    for (const [fit, lodges] of [[190, false], [100, true]] as const) {
      flat(); freshG(); E().reset();
      $.P.y = 60; // near the ceiling: the block turns up to it
      const k = E().spawnIce({ lane: 60, fit, sig: 'b0:m' });
      expect(k).not.toBeNull();
      step(400);
      expect(E().blocks.length).toBe(0);
      expect(E().lodged.length).toBe(lodges ? 1 : 0);
      expect(Math.max(...world.CEIL) > 30).toBe(lodges);
    }
  });
  it('S5: never spawns a block within 48 px of the ship', () => {
    flat(); freshG(); E().reset();
    $.P.x = 480; $.P.y = 127;
    expect(E().spawnIce({ lane: 127, fit: 100, sig: 'b0:m' })).toBeNull();
  });
  it('S5: a plug cell never forms (or re-forms) within 24 px of the ship, and the plug closes the column once grown', () => {
    flat(); freshG(); E().reset();
    $.G.scroll = 1000; $.P.x = 200; $.P.y = 127; // the ship sits on the plug's column
    const p = E().spawnPlug({ wx: 1205, tell: 44, sig: 'b0:p' });
    step(60);
    const near = p.cells.filter((c: any, j: number) => Math.abs(p.yTop + (j + .5) * p.cell - 127) < 24);
    expect(near.length).toBeGreaterThan(0);
    for (const c of near) expect(c.on).toBe(false);
    // the ship leaves: the waiting cells form, the column is whole and closed
    $.P.x = 20; step(5);
    expect(p.cells.every((c: any) => c.on)).toBe(true);
    const i = Math.round(1205 / 4);
    expect(world.FLOOR[i] - world.CEIL[i]).toBeLessThanOrEqual(0);
    // a shot cuts the cell it meets, and only that one
    world.shots.push({ x: 1200 - 1000 - 6, y: 127, vx: 8, k: 'bolt' });
    step(1);
    expect(p.cells.filter((c: any) => !c.on).length).toBe(1);
    expect(world.shots.length).toBe(0);
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
    expect(() => BI.hookHazards()).not.toThrow(); // no bossrules.ts on this base: a no-op
  });
});
