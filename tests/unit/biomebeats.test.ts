// Beat template v2 (build plan sprint 2 item D; spec §3.2): biomeScript's output on the long4 entry. The short entry's
// script is proved byte-identical by tools/layout-parity.mjs and the harness, not here.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// a seeded sim RNG (mulberry32) so a script rebuilds the same in every run
let seed = 1;
const R = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const calls: string[] = []; // what the script entries spawned when fired
const rec = (k: string) => (..._: unknown[]) => { calls.push(k); };

vi.mock('../../src/core', () => ({
  C: {}, DC: [], FIRE: ['#f00'], H: 270, PH: 254, R: () => R(), TAU: Math.PI * 2, TS: 4, W: 480, ctx: {},
  clamp: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)), dist2: () => 0, hash: () => .5,
  lerp: (a: number, b: number, t: number) => a + (b - a) * t, pick: (a: unknown[]) => a[0],
  ri: (a: number) => a, rr: (a: number) => a, sstep: () => 0, vnoise: () => .5,
}));
vi.mock('../../src/world', () => ({ CEIL: [], FLOOR: [], ceilAt: () => 0, floorAt: () => 254, shots: [], enemies: [] }));
vi.mock('../../src/textures', () => ({ mkTex: () => null }));
vi.mock('../../src/audio', () => ({ sfx: {}, sample: () => {} }));
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
  const k = ['banner', 'behindWave', 'butcher', 'corpse', 'crawler', 'crossT', 'eyeT', 'flayer', 'formation', 'hatch', 'hookE', 'logLine', 'maw', 'midboss', 'miniWarn', 'womb', 'crux', 'mutant', 'slime'];
  return Object.fromEntries(k.map((n) => [n, rec(n)]));
});

const L = await import('../../src/layout');
const { BIOMES, biomeScript, logPick, remix, secondKind } = await import('../../src/biomes');

const ENEMY = /^(behindWave|corpse|crawler|crossT|eyeT|flayer|formation|hatch|hookE|womb|mutant|slime)$/;
/** build a slot's script, sorted by x as insertScript does, and fire each entry, recording what it called */
function build(seg: number, b: string, from: number, v = 0, loop = 0) {
  $.G = { loop, pend: [], rank: 0 };
  seed = 7 + seg * 31 + v;
  return biomeScript(seg, b, from, v).sort((p: { x: number }, q: { x: number }) => p.x - q.x).map((e: { x: number; f: () => void }) => { calls.length = 0; e.f(); return { x: e.x, k: [...calls] }; });
}

describe('beat template v2 on long4', () => {
  beforeAll(() => L.setLayout('long4'));
  afterAll(() => L.setLayout('short'));
  beforeEach(() => { calls.length = 0; });

  const cases = Object.keys(BIOMES).flatMap((b) => [0, 1].flatMap((seg) => [0, 1].flatMap((v) => [0, 1].map((loop) => ({ b, seg, v, loop })))));

  it.each(cases)('$b slot $seg visit $v descent $loop: no enemy spawns inside either breath or the arena run-up', ({ b, seg, v, loop }) => {
    const r = L.slotRow(seg), from = r.gateLate!, P = L.beatPlan(r, from, !!v), S = build(seg, b, from, v, loop);
    for (const e of S) if (e.k.some((k) => ENEMY.test(k))) {
      for (const br of P.breaths) expect(e.x >= br.a && e.x < br.z, `${e.k} at ${e.x} in breath ${br.a}-${br.z}`).toBe(false);
      expect(e.x, `${e.k} at ${e.x} after the run-up`).toBeLessThan(P.runup!);
    }
  });

  it.each(cases)('$b slot $seg visit $v descent $loop: one midboss WARNING (breath 1), the boss WARNING at bossX, three log lines', ({ b, seg, v, loop }) => {
    const r = L.slotRow(seg), P = L.beatPlan(r, r.gateLate!, !!v), S = build(seg, b, r.gateLate!, v, loop);
    const warns = S.filter((e) => e.k.includes('miniWarn'));
    expect(warns.map((e) => e.x)).toEqual([P.warn, r.bossX]);
    const logs = S.filter((e) => e.k.includes('logLine')).map((e) => e.x);
    expect(logs).toEqual([P.a - 40, P.breaths[0].z, P.runup]); // entrance, release, run-up
  });

  it.each(cases)('$b slot $seg visit $v descent $loop: the release is a pod formation right at breath 1s end', ({ b, seg, v, loop }) => {
    const r = L.slotRow(seg), P = L.beatPlan(r, r.gateLate!, !!v), S = build(seg, b, r.gateLate!, v, loop);
    const at = S.filter((e) => e.x === P.breaths[0].z);
    expect(at.some((e) => e.k.includes('formation'))).toBe(true);
  });

  it('opens on the signature alone, then gives the second-ranked kind its own first slot in intro B', () => {
    const r = L.slotRow(0), P = L.beatPlan(r, r.gateLate!, false);
    for (const b of Object.keys(BIOMES)) {
      const X = remix(b, 0, 0), S = build(0, b, r.gateLate!).filter((e) => e.k.some((k) => ENEMY.test(k)));
      expect(S[0].x).toBe(P.a);
      const introB = S.find((e) => e.x >= P.P(.12));
      expect(introB && introB.x).toBeLessThan(P.P(.22));
      // the lead slot is alone: nothing else spawns until the next slot
      expect(S.filter((e) => e.x === introB!.x)).toHaveLength(1);
      expect(secondKind(X)).not.toBe(X.sig);
    }
  });

  it('places three set pieces, at the first-visit or remix fractions', () => {
    const r = L.slotRow(1);
    for (const v of [0, 1]) {
      const P = L.beatPlan(r, r.gateLate!, !!v), S = build(1, 'fire', r.gateLate!, v);
      // fire's pincer (first visit) is flayer, flayer, behindWave; its kiln (remix) opens on mutant + hookE
      const first = v ? 'mutant' : 'flayer', sets = S.filter((e) => e.k[0] === first && e.k.length > 1);
      expect(sets).toHaveLength(3);
      sets.forEach((e, i) => expect(Math.abs(e.x - P.sets[i])).toBeLessThan(BIOMES.fire.gap * 1.4));
    }
  });

  it('rotates the log pool by visit without drawing the RNG', () => {
    const B = BIOMES.ice;
    expect(B.logs.length).toBeGreaterThanOrEqual(3);
    expect(logPick(B, 0)).toEqual(B.logs.slice(0, 3));
    expect(logPick(B, 1)[0]).toBe(B.logs[3 % B.logs.length]);
    for (const b of Object.values(BIOMES)) expect(new Set(logPick(b, 0)).size).toBe(3);
  });

  it('builds the same script twice from the same seed (the B2 per-stage stream will own the seed)', () => {
    const r = L.slotRow(0), a = build(0, 'acid', r.gateLate!, 1, 1), b = build(0, 'acid', r.gateLate!, 1, 1);
    expect(a).toEqual(b);
  });
});

describe('the second-ranked mix kind', () => {
  it('is the heaviest non-signature kind, first listed on a tie', () => {
    expect(secondKind({ sig: 'hatch', mix: [['slime', 5], ['hatch', 3], ['womb', 3]] })).toBe('slime');
    expect(secondKind({ sig: 'flayer', mix: [['flayer', 3], ['hook', 3], ['mutant', 2.5]] })).toBe('hook');
  });
});
