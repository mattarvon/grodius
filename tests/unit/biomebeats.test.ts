// Beat template v2 (build plan sprint 2 item D; spec §3.2): biomeScript's output on the long4 entry. The short entry's
// script is proved byte-identical by tools/layout-parity.mjs and the harness, not here.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// a seeded sim RNG (mulberry32) for the spawn-time rolls the mocks never make; build rolls draw the stage stream (G.seed)
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
/** the terrain the rearY tests set: ceiling and floor by world x (open, 0..254, everywhere else) */
const terrain = vi.hoisted(() => ({ ce: (_x: number) => 0, fl: (_x: number) => 254 }));
vi.mock('../../src/world', () => ({ CEIL: [], FLOOR: [], ceilAt: (x: number) => terrain.ce(x), floorAt: (x: number) => terrain.fl(x), shots: [], enemies: [] }));
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
  // behindWave lands its wave REAR_LEAD f after the call (spawn.ts rearWarn's telegraph, 100 f, a literal there), so
  // the mock records it from G.pend that many frames later, as the real one does
  return { ...Object.fromEntries(k.map((n) => [n, rec(n)])), behindWave: () => { $.G.pend.push({ t: 100, f: rec('behindWave') }); } };
});

const L = await import('../../src/layout');
const { BIOMES, biomeScript, logPick, rearY, remix, secondKind } = await import('../../src/biomes');
const { CATALOG } = await import('../../src/setdraw');

/** a stage's midboss pair as biomeStage passes it on long4 (G.mb[stage], picked by stageMids) */
const PAIR = ['choir', 'cyst'];
const ENEMY = /^(behindWave|corpse|crawler|crossT|eyeT|flayer|formation|hatch|hookE|womb|mutant|slime)$/;
/** build a slot's script, sorted by x as insertScript does, and fire each entry, recording what it called */
function build(seg: number, b: string, from: number, v = 0, loop = 0, mids: string[] | null = PAIR, setIds: string[] | null = null) {
  $.G = { loop, pend: [], rank: 0, seed: 7 + seg * 31 + v }; // the run seed: build rolls draw its stage stream (src/rng.ts)
  seed = 7 + seg * 31 + v;
  return biomeScript(seg, b, from, v, undefined, mids, setIds).sort((p: { x: number }, q: { x: number }) => p.x - q.x).map((e: { x: number; f: () => void }) => { calls.length = 0; e.f(); return { x: e.x, k: [...calls] }; });
}
/** px the level scrolls a frame while nothing holds it (step.ts eases G.scrollSpeed to 1; flow.ts newGame starts it at 1) */
const PX_F = 1;
/** as build, but every entry's G.pend is drained on a frame clock (step.ts stepWorld: runScript fires the entry, then the
 *  same frame's pend loop counts each wait down), so a later() or a rear wave's telegraph lands at its real scroll x */
function flown(seg: number, b: string, from: number, v = 0, loop = 0, mids: string[] | null = PAIR, setIds: string[] | null = null) {
  $.G = { loop, pend: [], rank: 0, seed: 7 + seg * 31 + v };
  seed = 7 + seg * 31 + v;
  const out: { x: number; k: string[]; src: string }[] = [];
  for (const e of biomeScript(seg, b, from, v, undefined, mids, setIds).sort((p: { x: number }, q: { x: number }) => p.x - q.x) as { x: number; k: string; f: () => void }[]) {
    $.G.pend = []; calls.length = 0; e.f();
    if (calls.length) out.push({ x: e.x, k: [...calls], src: e.k });
    for (let t = 0; $.G.pend.length && t < 1000; t++) {
      calls.length = 0;
      for (let i = $.G.pend.length - 1; i >= 0; i--) { const p = $.G.pend[i]; if (--p.t <= 0) { $.G.pend.splice(i, 1); p.f(); } }
      if (calls.length) out.push({ x: e.x + t * PX_F, k: [...calls], src: e.k });
    }
  }
  return out;
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

  // LS2-mv: the drawn set pieces (setIds), every catalogue piece in every set slot. D20: a set piece's entry is >= 300 px
  // from both edges of every breath, and none of its spawns lands in a breath or past the run-up
  it.each(cases)('$b slot $seg visit $v descent $loop: every drawn set piece keeps out of the breaths (D20) and the run-up', ({ b, seg, v, loop }) => {
    const r = L.slotRow(seg), from = r.gateLate!, P = L.beatPlan(r, from, !!v), ids = CATALOG[b];
    for (let k = 0; k < ids.length; k++) {
      const pick = [0, 1, 2].map((j) => ids[(k + j) % ids.length]), S = build(seg, b, from, v, loop, PAIR, pick);
      $.G = { loop, pend: [], rank: 0, seed: 7 + seg * 31 + v };
      const sets = biomeScript(seg, b, from, v, undefined, PAIR, pick).filter((e: { k: string }) => /^set:/.test(e.k));
      expect(sets.map((e: { k: string }) => e.k), `${pick}`).toEqual(pick.map((id) => 'set:' + id));
      // D20 on the piece as placed: long layouts drop each set piece at its planned x (biomeScript), which the layout
      // keeps >= 300 px from every breath edge (layout.test.ts), so no placed piece comes nearer
      sets.forEach((e: { x: number; k: string }, i: number) => {
        expect(e.x, `${e.k}`).toBe(P.sets[i]);
        for (const br of P.breaths) {
          expect(e.x >= br.a && e.x < br.z, `${e.k} at ${e.x} in breath ${br.a}-${br.z}`).toBe(false);
          expect(Math.min(Math.abs(e.x - br.a), Math.abs(e.x - br.z)), `${e.k} at ${e.x} vs breath ${br.a}-${br.z}`).toBeGreaterThanOrEqual(300);
        }
      });
      for (const e of S) if (e.k.some((n) => ENEMY.test(n))) {
        for (const br of P.breaths) expect(e.x >= br.a && e.x < br.z, `${pick} ${e.k} at ${e.x} in breath ${br.a}-${br.z}`).toBe(false);
        expect(e.x, `${pick} ${e.k} at ${e.x} after the run-up`).toBeLessThan(P.runup!);
      }
      // the piece's own spawns where they really land: G.pend drained on the frame clock, so a later() and a rear wave's
      // 100 f telegraph count
      for (const e of flown(seg, b, from, v, loop, PAIR, pick)) if (/^set:/.test(e.src) && e.k.some((n) => ENEMY.test(n))) {
        for (const br of P.breaths) expect(e.x >= br.a && e.x < br.z, `${pick} ${e.src} ${e.k} lands at ${e.x} in breath ${br.a}-${br.z}`).toBe(false);
        expect(e.x, `${pick} ${e.src} ${e.k} lands at ${e.x} after the run-up`).toBeLessThan(P.runup!);
      }
    }
  });

  /** every enemy spawn (drained) from entries matching src that lands in a breath or past the run-up, over every case */
  const strays = (src: RegExp, setsFor: (b: string) => string[][]) => {
    const out: string[] = [];
    for (const { b, seg, v, loop } of cases) for (const pick of setsFor(b)) {
      const r = L.slotRow(seg), P = L.beatPlan(r, r.gateLate!, !!v);
      for (const e of flown(seg, b, r.gateLate!, v, loop, PAIR, pick)) if (src.test(e.src) && e.k.some((n) => ENEMY.test(n))) {
        const br = P.breaths.find((q) => e.x >= q.a && e.x < q.z);
        if (br || e.x >= P.runup!) out.push(`${b} slot ${seg} visit ${v} descent ${loop}: ${e.src} ${e.k} at ${e.x} (${br ? `breath ${br.a}-${br.z}` : `run-up ${P.runup}`})`);
      }
    }
    return [...new Set(out)];
  };
  const rotations = (b: string) => CATALOG[b].map((_: string, k: number) => [0, 1, 2].map((j) => CATALOG[b][(k + j) % CATALOG[b].length]));

  // game-designer decision, ls1-audit: backdraft's second rear wave was called 40 f after the piece (40 + 100 f to spawn)
  // and, drawn as a first visit's S3 (126 px before the run-up), landed 13 px into it. It is called at 20 f now: S3 + 119
  it('lands backdraft\'s second rear wave before the run-up when it is drawn as S3', () => {
    expect(strays(/^set:backdraft$/, rotations)).toEqual([]);
  });

  // game-designer decision, ls1-audit: fire's `behind` filler (behindWave) lands 100 f, 100 px, after its entry, which
  // used to put it in breath 1 or the run-up on some fire builds. On long layouts biomeScript checks it at its landing x
  // (lands()) and drops it if that is quiet
  it('lands every filler rear wave outside the breaths and the run-up', () => {
    expect(strays(/^behind$/, () => [null as unknown as string[]])).toEqual([]);
  });

  it.each(cases)('$b slot $seg visit $v descent $loop: two midboss WARNINGs (breaths 1 and 2), the boss WARNING at bossX, three log lines', ({ b, seg, v, loop }) => {
    const r = L.slotRow(seg), P = L.beatPlan(r, r.gateLate!, !!v), S = build(seg, b, r.gateLate!, v, loop);
    const warns = S.filter((e) => e.k.includes('miniWarn'));
    expect(warns.map((e) => e.x)).toEqual([...P.warns, r.bossX]);
    // with no picks (a direct call, as on short) it is the biome's own midboss alone
    expect(build(seg, b, r.gateLate!, v, loop, null).filter((e) => e.k.includes('miniWarn')).map((e) => e.x)).toEqual([P.warn, r.bossX]);
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

  it('builds the same script twice from the same run seed (the per-stage build stream, src/rng.ts)', () => {
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

// S2 (ls1-audit): a set piece's rear wave crosses the whole screen at one y, so biomes.ts rearY clamps it into the
// opening over that whole span. The terrain here is open (0..254) except where a test raises a spire
describe('rearY, the set pieces\' rear-wave lane', () => {
  const SCROLL = 6000, SPIRE = 150, PAD = 16; // PAD: biomes.ts REAR.pad, written out so a change to it can't pass its own test
  /** a spire floor at SPIRE over screen x [a, z) */
  const spire = (a: number, z: number) => { terrain.fl = (x: number) => (x >= SCROLL + a && x < SCROLL + z ? SPIRE : 254); };
  beforeEach(() => { $.G = { scroll: SCROLL, pend: [] }; terrain.ce = () => 0; terrain.fl = () => 254; L.setLayout('long4'); });
  afterAll(() => { terrain.ce = () => 0; terrain.fl = () => 254; L.setLayout('short'); });

  it('clamps a wave entering over a spire mid-screen to the spire top less the pad', () => {
    spire(200, 260);
    expect(rearY(254 * .7)).toBe(SPIRE - PAD);
  });

  it('clamps to the ceiling plus the pad under a low ceiling at the left edge', () => {
    terrain.ce = (x: number) => (x < SCROLL + 20 ? 60 : 0);
    expect(rearY(30)).toBe(60 + PAD);
  });

  it('leaves y alone when the spire is past the right edge, outside the flight', () => {
    spire(500, 560);
    expect(rearY(254 * .7)).toBe(254 * .7);
  });

  it('takes the middle of the tightest opening when no lane is open end to end', () => {
    terrain.ce = (x: number) => (x < SCROLL + 100 ? 130 : 0);
    spire(300, 340);
    expect(rearY(254 * .7)).toBe((130 + SPIRE) / 2);
  });

  it('is the identity on short (no arena run-up), even over a spire', () => {
    L.setLayout('short');
    spire(200, 260);
    expect(rearY(254 * .7)).toBe(254 * .7);
  });
});
