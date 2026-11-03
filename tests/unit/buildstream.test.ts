import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// LS1 row B2: every stage build draws from its own stream, Rs = stream(seedOf(runSeed, loop, stageIdx)), never the
// sim R(). The core mock THROWS on any sim RNG call, so a build that still drew R() fails here. Building stage i
// twice gives the same script x and kind list (what a resume, item H, rebuilds); another loop or stage does not.
const simDraw = () => { throw new Error('a stage build drew the sim RNG'); };
vi.mock('../../src/core', () => ({
  C: { blood: '', bloodD: '', bloodL: '' }, DC: ['', '', '', '', '', ''], FIRE: [], H: 270, PH: 254, TAU: Math.PI * 2, TS: 4, W: 480,
  R: simDraw, rr: simDraw, ri: simDraw, pick: simDraw,
  clamp: (v: number) => v, ctx: {}, dist2: () => 0, hash: () => 0, lerp: (a: number) => a, sstep: () => 0, vnoise: () => 0,
}));
vi.mock('../../src/world', () => ({ CEIL: new Float32Array(4), FLOOR: new Float32Array(4), ceilAt: () => 0, floorAt: () => 0, shots: [], enemies: [] }));
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

const { BIOME_KEYS, biomeScript, midStream, stageStream } = await import('../../src/biomes');
const { stageScript } = await import('../../src/enemies/scripts');
const { MID_SALT, midSeedOf, seedOf, stream, newRunSeed } = await import('../../src/rng');
const { PHASE1_BIOME_POOL, pickMids } = await import('../../src/midpick');
const { applyRun, decodeRun, serializeRun } = await import('../../src/runsave');

type Entry = { x: number; k?: string };
const list = (S: Entry[]) => S.map((e) => `${e.x}:${e.k}`);
const SEED = 0xc0ffee;
/** midSeedOf(SEED, 1, 1), recorded when the midboss stream landed */
const PINNED = 821404455;
/** the run state a stage build reads */
const run = (loop: number) => ({ loop, seed: SEED, script: [], si: 0, pend: [], route: [null, null], visitNo: [0, 0] });
/** build a biome stage the way biomes.ts biomeStage does: its own stream, from the gate x */
const buildBiome = (seg: number, b: string, from: number, v: number) => biomeScript(seg, b, from, v, stream(seedOf($.G.seed, $.G.loop, seg + 1)));
/** build a non-biome stage the way stagebuild.ts does: section picks and placement from its own stream */
const buildOther = (i: number) => stageScript(i, stream(seedOf($.G.seed, $.G.loop, i)));

describe('per-stage build streams', () => {
  beforeEach(() => { $.G = run(1); });

  it('builds a biome stage twice to the same script x and kind list, first and repeat visits', () => {
    for (const b of BIOME_KEYS) for (const v of [0, 1]) for (const [seg, from] of [[0, 2658.007], [1, 5637.022]] as const) {
      const a = list(buildBiome(seg, b, from, v)), c = list(buildBiome(seg, b, from, v));
      expect(a.length).toBeGreaterThan(10);
      expect(c).toEqual(a);
    }
  });

  it('builds Open Orbit and the Drive approach twice to the same list, in every descent', () => {
    for (const L of [0, 1, 2, 3]) {
      $.G = run(L);
      for (const i of [0, 3]) {
        const a = list(buildOther(i));
        expect(list(buildOther(i))).toEqual(a);
        expect(a.every((s) => !s.endsWith(':undefined'))).toBe(true); // every entry names what it spawns
      }
    }
  });

  it('gives another descent a different biome list', () => {
    const a = list(buildBiome(0, 'fire', 2658.007, 0));
    $.G = run(2);
    expect(list(buildBiome(0, 'fire', 2658.007, 0))).not.toEqual(a);
  });

  it('gives another stage a different stream, so the same biome rolls differently there', () => {
    const k = (S: Entry[]) => S.map((e) => e.k);
    const a = k(biomeScript(0, 'ice', 2658.007, 0, stream(seedOf(SEED, 1, 1))));
    const b = k(biomeScript(0, 'ice', 2658.007, 0, stream(seedOf(SEED, 1, 2))));
    expect(b).not.toEqual(a);
  });

  it('gives another run seed a different remix pick', () => {
    $.G = run(2);
    const a = list(buildOther(0));
    const picks = new Set([a.join()]);
    for (let s = 1; s < 12; s++) { $.G = { ...run(2), seed: s }; picks.add(list(buildOther(0)).join()); }
    expect(picks.size).toBeGreaterThan(1);
  });

  it('plays the classic variants in Descent 1 whatever the seed', () => {
    $.G = run(0);
    const a = list(buildOther(0));
    $.G = { ...run(0), seed: 7 };
    expect(list(buildOther(0))).toEqual(a);
  });
});

describe('stream and seedOf', () => {
  it('repeats a sequence for the same seed and stays in [0, 1)', () => {
    const a = stream(42), b = stream(42), xs = Array.from({ length: 1000 }, () => a());
    expect(Array.from({ length: 1000 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('separates run seed, loop and stage', () => {
    const s = new Set<number>();
    for (const r of [0, 1, 2]) for (const L of [0, 1, 2]) for (const i of [0, 1, 2, 3]) s.add(seedOf(r, L, i));
    expect(s.size).toBe(36);
  });

  it('turns one sim draw into a 32-bit run seed', () => {
    expect(newRunSeed(() => 0)).toBe(0);
    expect(newRunSeed(() => 0.5)).toBe(2147483648);
    expect(newRunSeed(() => 0.9999999999)).toBeLessThan(4294967296);
  });
});

describe('the run seed in the run save', () => {
  it('round-trips G.seed, and the restored seed rebuilds the same biome stage', () => {
    $.G = { ...run(1), seed: 3141592653, stage: 1, bx: [2658.007, null, null], route: ['acid', null], visitNo: [1, 0], remixV: {} };
    const before = list(buildBiome(0, 'acid', $.G.bx[0], 1));
    const d = decodeRun(JSON.stringify(serializeRun($.G, null)));
    expect(d).not.toBeNull();
    $.G = run(0); // a fresh run object, as the resume path (item H) starts from
    applyRun(d, $.G, null);
    expect($.G.seed).toBe(3141592653);
    expect($.G.loop).toBe(1);
    expect(list(buildBiome(0, $.G.route[0], $.G.bx[0], $.G.visitNo[0]))).toEqual(before);
  });
});

// Sprint 2 review, carry-forward 4: the midboss pick (item F) must sit at a fixed place in each stage's build, or a
// rebuild differs. It has its own stream per stage (midStream(i), seed midSeedOf), not a position in the script's Rs,
// so the pick and the script are independent: either may run first, and either may change its draw count.
describe("the midboss pick's stream", () => {
  beforeEach(() => { $.G = run(1); });
  /** a two-slot pick with no home preference, so it draws twice (the most sensitive case) */
  const pick = (rng: () => number) => pickMids({ pool: PHASE1_BIOME_POOL, L: 1, used: [], rng }).picks;
  /** biome slot seg's script on its own stream (biomeScript's default rs is stageStream(stageOfSlot(seg))) */
  const script = (seg: number, b: string, v: number) => list(biomeScript(seg, b, [2658.007, 5637.022][seg], v));

  it('leaves every biome script unchanged when a midboss pick runs before it, after it, or not at all', () => {
    for (const b of BIOME_KEYS) for (const v of [0, 1]) for (const seg of [0, 1]) {
      const alone = script(seg, b, v);
      pick(midStream(seg + 1));
      const afterPick = script(seg, b, v);
      expect(afterPick).toEqual(alone);
    }
  });

  it('gives the same pick across rebuilds, whatever the script drew first', () => {
    for (const i of [1, 2]) {
      const first = pick(midStream(i));
      expect(first).toHaveLength(2);
      script(i - 1, 'fire', 1); // a remix visit: more script draws than a first visit
      expect(pick(midStream(i))).toEqual(first);
      script(i - 1, 'ice', 0);
      expect(pick(midStream(i))).toEqual(first);
    }
  });

  it('shows the hazard it removes: a pick drawn from the script stream after the script moves with the script', () => {
    // the shape F must not use: one Rs shared by biomeScript and the picker. Over these seeds the pick follows the
    // script's draw count (first visit vs remix), which is why the pick has midStream instead
    let moved = 0;
    for (let seed = 1; seed <= 16; seed++) {
      $.G = { ...run(1), seed };
      const after = (v: number) => { const rs = stageStream(1); biomeScript(0, 'fire', 2658.007, v, rs); return pick(rs).join(); };
      if (after(0) !== after(1)) moved++;
    }
    expect(moved).toBeGreaterThan(0);
  });

  it("is a different stream from the script's, for every run seed, loop and stage", () => {
    for (const r of [0, 1, SEED]) for (const L of [0, 1, 2]) for (const i of [0, 1, 2, 3]) expect(midSeedOf(r, L, i)).not.toBe(seedOf(r, L, i));
    const m = midStream(1), s = stageStream(1);
    expect(Array.from({ length: 8 }, () => m())).not.toEqual(Array.from({ length: 8 }, () => s()));
  });

  it('pins the salt and the seed, so a code change cannot silently re-roll every run', () => {
    expect(MID_SALT).toBe(0x4d1db055);
    expect(midSeedOf(SEED, 1, 1)).toBe(PINNED);
  });
});
