// Terrain movement B through the real rewriteTerrain (spec §3.3; build plan LS2-mv): the gap, the band, what short keeps,
// and that the stage's picks are drawn once. core's hash and vnoise are the real arithmetic; only the DOM side is stubbed.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const world = vi.hoisted(() => ({ CEIL: new Float32Array(0), FLOOR: new Float32Array(0) }));
vi.mock('../../src/core', () => {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t, clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
  const hash = (n: number) => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  const vnoise = (x: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
  const sstep = (a: number, b: number, x: number) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  return { C: {}, DC: [], FIRE: ['#f00'], H: 270, PH: 254, R: () => .5, TAU: Math.PI * 2, TS: 4, W: 480, ctx: {}, clamp, dist2: () => 0, hash, lerp, pick: (a: unknown[]) => a[0], ri: (a: number) => a, rr: (a: number) => a, sstep, vnoise };
});
vi.mock('../../src/world', () => ({ get CEIL() { return world.CEIL; }, get FLOOR() { return world.FLOOR; }, ceilAt: () => 0, floorAt: () => 254, shots: [], enemies: [] }));
vi.mock('../../src/textures', () => ({ mkTex: () => null }));
vi.mock('../../src/audio', () => ({ sfx: {}, sample: () => {} }));
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
const { BIOMES, MOVES, SET_KINDS, biomeReset, biomeScript, biomeStage, moveAt, stagePicks } = await import('../../src/biomes');
const { CATALOG } = await import('../../src/setdraw');
const { MOVE, MOVE_GAP, gimmick, ventNear } = await import('../../src/terrainb');

const KEYS = Object.keys(BIOMES), TS = 4;
/** a base level wider than any biome gap, so what is measured is the biome's own */
function base() {
  const n = Math.ceil(L.layout().level / TS) + 300;
  world.CEIL = new Float32Array(n).fill(10);
  world.FLOOR = new Float32Array(n).fill(244);
}
/** run seed s into biome b at slot seg, gate from, with the variant forced through the stored picks */
function fly(seg: number, b: string, from: number, mv: number, loop = 0) {
  base();
  const i = L.stageOfSlot(seg), route = [null, null] as (string | null)[];
  route[seg] = b;
  $.G = { loop, seed: 7, pend: [], script: [], si: 0, route, visitNo: [0, 0], bx: [null, null, null], mb: { [i]: ['choir', 'cyst'] }, picks: { [i]: { mv, sp: CATALOG[b].slice(0, 3) } }, spUsed: {} };
  MOVES.length = 0;
  biomeStage(seg, from);
  return L.beatPlan(L.slotRow(seg), from, false);
}
const gapOver = (a: number, z: number) => { let m = 1e9, M = 0; for (let i = Math.ceil(a / TS); i <= Math.floor(z / TS); i++) { const g = world.FLOOR[i] - world.CEIL[i]; m = Math.min(m, g); M = Math.max(M, g); } return [m, M]; };
const cases = KEYS.flatMap((b) => [0, 1].flatMap((mv) => [0, 1].flatMap((seg) => [0, 1, 3].map((loop) => ({ b, mv, seg, loop })))));

describe('movement B on long4', () => {
  beforeAll(() => L.setLayout('long4'));
  afterAll(() => L.setLayout('short'));

  it.each(cases)('$b B$mv slot $seg descent $loop: gap >= 108 from the gate to the boss, at both gates', ({ b, mv, seg, loop }) => {
    const r = L.slotRow(seg);
    for (const from of [r.x0, r.gateLate!]) {
      fly(seg, b, Math.max(from, r.x0), mv, loop);
      expect(gapOver(from + 300, r.bossX)[0]).toBeGreaterThanOrEqual(MOVE_GAP - 1e-3);
    }
  });

  it.each(cases)('$b B$mv slot $seg descent $loop: a naked ship can fly it', ({ b, mv, seg, loop }) => {
    // reachable y per tile at 1 px/frame scroll and the 1.25 px/f naked speed (spec §9), 10 px of clearance each edge
    const P = fly(seg, b, L.slotRow(seg).gateLate!, mv, loop), climb = 1.25 * TS, pad = 10;
    const i0 = Math.ceil(P.moveB!.a / TS), i1 = Math.floor(P.moveB!.z / TS);
    let lo = world.CEIL[i0] + pad, hi = world.FLOOR[i0] - pad;
    for (let i = i0 + 1; i <= i1; i++) {
      lo = Math.max(lo - climb, world.CEIL[i] + pad);
      hi = Math.min(hi + climb, world.FLOOR[i] - pad);
      expect(hi, `no way through at ${i * TS}`).toBeGreaterThan(lo);
    }
  });

  it.each(KEYS.flatMap((b) => [0, 1].map((mv) => ({ b, mv }))))('$b B$mv changes the terrain only inside its band', ({ b, mv }) => {
    const r = L.slotRow(0), P = fly(0, b, r.gateLate!, mv), snap = [world.CEIL.slice(), world.FLOOR.slice()];
    $.G.picks[1].mv = 1 - mv;
    base();
    MOVES.length = 0;
    biomeStage(0, r.gateLate!);
    let inside = 0;
    for (let i = 0; i < snap[0].length; i++) {
      const same = snap[0][i] === world.CEIL[i] && snap[1][i] === world.FLOOR[i], x = i * TS;
      if (x <= P.moveB!.a || x >= P.moveB!.z) expect(same, `${x}`).toBe(true);
      else if (!same) inside++;
    }
    expect(inside).toBeGreaterThan(100);
  });

  it('sits between the breaths: past breath 1, gone before midboss B\'s held screen, wide enough to fly', () => {
    for (const seg of [0, 1]) for (const from of [L.slotRow(seg).x0, L.slotRow(seg).gateLate!]) {
      const P = L.beatPlan(L.slotRow(seg), from, false), M = P.moveB!;
      expect(M.a).toBeGreaterThan(P.breaths[0].z);
      expect(M.z).toBeLessThan(P.breaths[1].z - 20); // the scroll holds ~20 px before the breath's end
      expect(M.z - M.a - 2 * M.blend).toBeGreaterThan(400);
    }
  });

  it('holds snot B0\'s throat to its 108-150 px gap', () => {
    const P = fly(0, 'snot', L.slotRow(0).gateLate!, 0), M = P.moveB!, [m, X] = gapOver(M.a + M.blend, M.z - M.blend);
    expect(m).toBeGreaterThanOrEqual(MOVE.throat.min - 1e-3);
    expect(X).toBeLessThanOrEqual(MOVE.throat.max + 1e-3);
  });

  it('steps ice B1\'s floor every 120 px, no step over one rise', () => {
    const P = fly(0, 'ice', L.slotRow(0).gateLate!, 1), M = P.moveB!, E = MOVE.stair.every;
    expect(E).toBe(120); // spec §3.3
    expect(MOVE.stair.rise).toBeLessThanOrEqual(24); // a face a naked ship clears in under 20 f
    for (let x = Math.ceil((M.a + M.blend) / E) * E; x + E < M.z - M.blend; x += E) {
      expect(world.FLOOR[(x + 8) / TS], `tread at ${x}`).toBeCloseTo(world.FLOOR[(x + E - 8) / TS], 3);
      expect(Math.abs(world.FLOOR[(x + E + 8) / TS] - world.FLOOR[(x + 8) / TS])).toBeCloseTo(MOVE.stair.rise, 3);
    }
  });

  it('raises acid B0\'s lake about 30 px', () => {
    const o = 40, x = 1000, [, fl] = gimmick('acid', 0, x, o, 20, 236);
    expect(fl).toBeLessThan(254 - 18 - MOVE.lake.rise + MOVE.lake.swell + 2);
  });

  it('opens fire B1\'s vents where ventNear says, with the mouth clear of spawnHazard\'s c > 4', () => {
    const v = ventNear(1234);
    expect(Math.abs(v - 1234)).toBeLessThanOrEqual(MOVE.vent.every / 2);
    expect(gimmick('fire', 1, v, 40, 30, 230)[0]).toBe(MOVE.vent.mouth);
    expect(MOVE.vent.mouth).toBeGreaterThan(4);
  });

  it('publishes the live band to hazards and props, and clears it on a new descent', () => {
    const P = fly(0, 'fire', L.slotRow(0).gateLate!, 1), M = P.moveB!;
    expect(moveAt((M.a + M.z) / 2)).toMatchObject({ b: 'fire', mv: 1 });
    expect(moveAt(M.a + 1)).toBeNull(); // still blending
    expect(moveAt(M.z + 1)).toBeNull();
    biomeReset();
    expect(moveAt((M.a + M.z) / 2)).toBeNull();
  });
});

describe('the stage picks', () => {
  beforeAll(() => L.setLayout('long4'));
  afterAll(() => L.setLayout('short'));
  beforeEach(() => { $.G = { loop: 0, seed: 11, pend: [], picks: {}, spUsed: {} }; });

  it('draws once: a rebuild reads the stored picks and leaves the used set alone', () => {
    const a = stagePicks(1, 'ice', 0), used = [...$.G.spUsed.ice];
    expect(stagePicks(1, 'ice', 0)).toBe(a);
    expect($.G.spUsed.ice).toEqual(used);
  });
  it('gives the same picks from the same run seed, and different ones across seeds', () => {
    const a = JSON.stringify(stagePicks(1, 'fire', 0));
    $.G = { loop: 0, seed: 11, pend: [], picks: {}, spUsed: {} };
    expect(JSON.stringify(stagePicks(1, 'fire', 0))).toBe(a);
    const all = new Set<string>();
    for (let s = 1; s < 40; s++) { $.G = { loop: 0, seed: s, pend: [], picks: {}, spUsed: {} }; all.add(stagePicks(1, 'fire', 0).sp.join()); }
    expect(all.size).toBeGreaterThan(10);
  });
  it('never moves the script: the same script with or without a prior draw', () => {
    const go = () => biomeScript(0, 'ice', 4750, 0, undefined, ['choir', 'cyst'], ['thaw', 'vigil', 'pack']).map((e: { x: number; k: string }) => e.x + e.k).join();
    $.G = { loop: 0, seed: 5, pend: [] };
    const a = go();
    stagePicks(1, 'ice', 0);
    expect(go()).toBe(a);
  });
  it('plays the drawn pieces in order at the three set-piece beats', () => {
    $.G = { loop: 0, seed: 5, pend: [] };
    const S = biomeScript(0, 'ice', 4750, 0, undefined, ['choir', 'cyst'], ['thaw', 'vigil', 'pack']), k = S.filter((e: { k: string }) => e.k.startsWith('set:')).sort((p: { x: number }, q: { x: number }) => p.x - q.x).map((e: { k: string }) => e.k);
    expect(k).toEqual(['set:thaw', 'set:vigil', 'set:pack']);
  });
  it('keeps the used set across descents and forgets the stage picks', () => {
    stagePicks(1, 'ice', 0);
    biomeReset();
    expect($.G.picks).toEqual({});
    expect($.G.spUsed.ice).toHaveLength(3);
  });
});

describe('the catalogue against the game', () => {
  it('names only real set pieces, including each biome\'s signature and remix signature', () => {
    for (const b of KEYS) {
      for (const id of CATALOG[b]) expect(SET_KINDS, id).toContain(id);
      expect(CATALOG[b]).toContain(BIOMES[b].set);
      expect(CATALOG[b]).toContain(BIOMES[b].remix.set);
    }
    expect(SET_KINDS.length).toBe(20);
  });
  it('finishes every new piece inside 60 f, so S3 is done before the run-up', () => {
    $.G = { loop: 0, seed: 5, pend: [] };
    L.setLayout('long4');
    for (const b of KEYS) for (const id of CATALOG[b].slice(2)) {
      $.G.pend = [];
      const S = biomeScript(0, b, 4750, 0, undefined, ['choir', 'cyst'], [id, id, id]).find((e: { k: string }) => e.k === 'set:' + id);
      S.f();
      expect(Math.max(0, ...$.G.pend.map((p: { t: number }) => p.t)), id).toBeLessThanOrEqual(60);
    }
    L.setLayout('short');
  });
});

describe('short', () => {
  it('has no movement B and no draw: biomeStage touches neither picks nor the used set', () => {
    L.setLayout('short');
    base();
    $.G = { loop: 0, seed: 7, pend: [], script: [], si: 0, route: ['ice', null], visitNo: [0, 0], bx: [2660, null, null] };
    MOVES.length = 0;
    biomeStage(0, 2660);
    expect(L.beatPlan(L.slotRow(0), 2660, false).moveB).toBeNull();
    expect(MOVES).toHaveLength(0);
    expect($.G.picks).toBeUndefined();
    expect($.G.spUsed).toBeUndefined();
    expect($.G.script.filter((e: { k: string }) => e.k.startsWith('set:')).every((e: { k: string }) => e.k === 'set:morgue')).toBe(true);
  });
});
