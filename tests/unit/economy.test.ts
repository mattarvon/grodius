import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// stages.ts, perks.ts and mutations.ts pull in canvas/audio/DOM modules at import time; stub them so the live tables
// load in node and the `short` entry can be pinned against today's code rather than against copied numbers.
// The pins rely on today's grading, seals and stage XP being plain arithmetic: if they ever route through a stubbed
// core helper (clamp etc.), the live side of the comparison runs on the stub and these mocks need real implementations
vi.mock('../../src/core', () => ({ FIRE: 0, PH: 270, R: () => 0, TAU: Math.PI * 2, W: 480, clamp: (v: number) => v, ctx: {}, dist2: () => 0, lerp: (a: number) => a, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0, swapRm: () => {} }));
vi.mock('../../src/audio', () => ({ sample: () => {}, sfx: { power: () => {}, alarm: () => {} } }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/input', () => ({ I: {}, PR: {}, touch: {} }));
vi.mock('../../src/save', () => ({ SET: {}, save: () => {}, lv: () => 0 }));
vi.mock('../../src/world', () => ({ arcs: [], caps: [], ceilAt: () => 0, enemies: [], eshots: [], floorAt: () => 0, orbs: [], shots: [] }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, gib: () => {}, gore: () => {}, mist: () => {}, pop: () => {}, spark: () => {} }));
vi.mock('../../src/enemies/update', () => ({ POD: {}, hurt: () => {} }));
vi.mock('../../src/enemies/spawn', () => ({ banner: () => {} }));
vi.mock('../../src/biomes', () => ({ BIOMES: {}, openFork: () => {}, holdForFork: () => {}, biomeExit: () => {} }));
vi.mock('../../src/stagebuild', () => ({ buildStage: () => {} })); // startStage builds Open Orbit / the Drive on entry (LS1 C/B2)
vi.mock('../../src/boss/update', () => ({ bossHitByShot: () => {} }));
vi.mock('../../src/render/util', () => ({ drawChain: () => {}, drawHookTip: () => {}, light: () => {} }));

const econ = await import('../../src/economy');
const { ECON, HPM_TOL, d1EliteChance, descDepth, gluttonyN, gradeOf, gradePts, hpmCol, hpmTarget, killBio, killXP, livesAfterDrive, sealAt, stageXP } = econ;
const { clearStage } = await import('../../src/stages');
const perks = await import('../../src/perks');
const { GM } = await import('../../src/mutations');

/** spec §8, copied from design/content-expansion.md as a literal: rows D1..D3 per column */
const SPEC_HPM = {
  orbit: [.5, 1.0, 1.3],
  biome0: [.8, 1.3, 1.6],
  interior: [.8, 1.2, 1.5],
  biome1: [1.1, 1.6, 1.9],
  drive: [1.3, 1.8, 2.0],
};
const COLS = [['orbit', 0, 'orbit'], ['biome', 0, 'biome0'], ['interior', 0, 'interior'], ['biome', 1, 'biome1'], ['drive', 0, 'drive']] as const;

type St = { kills: number; spawned: number; hits: number; deaths: number };
const st = (kills: number, spawned: number, hits = 0, deaths = 0): St => ({ kills, spawned, hits, deaths });
/** a spread of stage results crossing every grade boundary, for grade parity checks */
const CASES: St[] = [];
for (const [k, s] of [[0, 0], [0, 10], [3, 10], [5, 10], [7, 10], [8, 10], [10, 10], [69, 100], [70, 100], [100, 100]])
  for (const h of [0, 1, 2, 4]) for (const d of [0, 1]) CASES.push(st(k, s, h, d));

/** run today's clearStage on the Gravity Drive (no fork) with `cleared` clears before this one */
function liveClear(s: St, escaped = false, cleared = 0, seal = 0) {
  $.meta = { bio: 0, best: {} };
  $.G = { loop: 0, stage: 3, route: [], pend: [], t: 600, score: 0, bio: 0, cleared, seal, st: { ...s, chain: 0, t0: 0 } };
  const broke = clearStage(escaped);
  return { g: $.G.tally.g, broke };
}

describe('short entry reproduces today exactly', () => {
  it('grades every stage result the same as stages.ts clearStage', () => {
    for (const s of CASES) {
      expect(gradeOf('short', s), JSON.stringify(s)).toBe(liveClear(s).g);
      expect(gradeOf('short', s, undefined, true)).toBe(liveClear(s, true).g);
    }
  });

  it('ignores stage length: grading is absolute', () => {
    for (const s of CASES) expect(gradePts('short', s, 120)).toBe(gradePts('short', s));
  });

  it('breaks seals on the same clears as stages.ts SEAL_AT', () => {
    for (let c = 0; c < 10; c++) expect(sealAt('short', c + 1), `clear ${c + 1}`).toBe(liveClear(st(10, 10), false, c, 0).broke);
  });

  it('pays the same stage XP lump as perks.ts stageXP', () => {
    for (let loop = 0; loop < 5; loop++) for (let ord = 0; ord < 4; ord++) expect(stageXP('short', ord, loop)).toBe(perks.stageXP(ord, loop));
  });

  it('leaves kill XP and kill biomass untouched', () => {
    for (const v of [0, 1, 1.7, 30, 250]) {
      expect(killXP('short', v)).toBe(v);
      expect(killBio('short', v)).toBe(v);
    }
  });

  it('uses the GLUTTONY thresholds in mutations.ts', () => {
    expect(gluttonyN('short')).toEqual(GM.find((m: any) => m.id === 'over').n);
    expect(gluttonyN('short')).toEqual([2, 4]); // the value itself, so a change to GM is noticed here too
  });

  it("matches a frozen golden copy of today's outputs, so the pins survive item G wiring the live code to ECON", () => {
    // once stages.ts / perks.ts read ECON, the live-code pins above compare ECON with itself: these literals do not
    expect([0, 1, 2].map((loop) => [0, 1, 2, 3].map((ord) => stageXP('short', ord, loop)))).toEqual([[30, 75, 120, 165], [70, 115, 160, 205], [110, 155, 200, 245]]);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((c) => sealAt('short', c))).toEqual([0, 1, 0, 2, 0, 3, 0, 0]);
    expect([st(10, 10), st(10, 10, 1), st(8, 10, 1), st(7, 10), st(6, 10, 1), st(3, 10), st(2, 10), st(10, 10, 0, 1)].map((s) => gradeOf('short', s))).toEqual(['S', 'A', 'A', 'S', 'A', 'B', 'C', 'A']);
  });

  it('keeps depth per descent only', () => {
    for (let loop = 0; loop < 4; loop++) for (let ord = 0; ord < 4; ord++) expect(descDepth('short', loop, ord)).toBe(loop);
  });

  it('has no Descent 1 elites, no Drive lives and no per-kind hits/min targets', () => {
    for (let ord = 0; ord < 4; ord++) expect(d1EliteChance('short', ord)).toBe(0);
    expect(livesAfterDrive('short', 2)).toBe(2);
    expect(hpmTarget('short', 'biome', 0, 1)).toBeNull();
    expect(ECON.short.n).toBe(4);
  });
});

describe('long4 matches spec §7 (LS1)', () => {
  it("keeps today's seal schedule {2, 4, 6}", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((c) => sealAt('long4', c))).toEqual([0, 1, 0, 2, 0, 3, 0]);
  });

  it('normalises the hit penalty to 35 s of scroll', () => {
    const s = st(10, 10, 2);
    expect(gradePts('long4', s, 35)).toBe(gradePts('short', s)); // a 35 s stage grades as today
    expect(gradePts('long4', s, 70)).toBeCloseTo(100 - 10); // twice the exposure, half the penalty per hit
    expect(gradePts('long4', st(10, 10, 0, 1), 70)).toBe(70); // deaths stay absolute
  });

  it('allows an S with one hit but not with a death', () => {
    expect(gradeOf('long4', st(10, 10, 1), 60)).toBe('S');
    expect(gradeOf('long4', st(10, 10, 2), 60)).toBe('A');
    expect(gradeOf('long4', st(10, 10, 0, 1), 60)).toBe('A');
    expect(gradeOf('long4', st(10, 10), 60, true)).toBe('C');
  });

  it("pays today's stage XP lump and cuts kill XP and kill biomass to x0.75", () => {
    for (let loop = 0; loop < 3; loop++) for (let ord = 0; ord < 4; ord++) expect(stageXP('long4', ord, loop)).toBe(perks.stageXP(ord, loop));
    expect(killXP('long4', 30)).toBe(22.5);
    expect(killBio('long4', 100)).toBe(75);
  });

  it('adds .35 of a descent of depth across 4 stages', () => {
    expect([0, 1, 2, 3].map((o) => descDepth('long4', 0, o))).toEqual([0, .35 / 3, .7 / 3, .35].map((v) => expect.closeTo(v)));
    expect(descDepth('long4', 0, 0)).toBe(0); // Open Orbit in Descent 1 stays at 1x
    expect(descDepth('long4', 2, 3)).toBeCloseTo(2.35);
  });

  it('uses GLUTTONY [3, 6]', () => expect(gluttonyN('long4')).toEqual([3, 6]));

  it('changes neither Descent 1 elites nor lives', () => {
    for (let ord = 0; ord < 4; ord++) expect(d1EliteChance('long4', ord)).toBe(0);
    expect(livesAfterDrive('long4', 3)).toBe(3);
  });

  it('sets every §8 hits/min cell except the interior column it does not have', () => {
    for (const [kind, slot, col] of COLS) for (let loop = 0; loop < 3; loop++) {
      const h = hpmTarget('long4', kind, slot, loop);
      if (col === 'interior') expect(h).toBeNull();
      else expect(h?.t, `${col} D${loop + 1}`).toBe(SPEC_HPM[col][loop]);
    }
  });

  it('grades the 70 / 50 / 30 point boundaries with a normalised hit weight', () => {
    // Ts = 35: the weight is 1, so 80% kills with 1 hit is exactly 70 points and still an S under the 1-hit rule
    expect(gradePts('long4', st(8, 10, 1), 35)).toBe(70);
    expect(gradeOf('long4', st(8, 10, 1), 35)).toBe('S');
    expect(gradeOf('long4', st(79, 100, 1), 35)).toBe('A'); // 69 points
    // Ts = 105: each hit costs 10/3 points, so 60% kills with 3 hits is exactly 50 and 40% with 3 hits exactly 30
    expect(gradePts('long4', st(6, 10, 3), 105)).toBeCloseTo(50);
    expect(gradeOf('long4', st(6, 10, 3), 105)).toBe('A');
    expect(gradeOf('long4', st(40, 100, 3), 105)).toBe('B');
    expect(gradeOf('long4', st(39, 100, 3), 105)).toBe('C');
  });

  it('grades a stage shorter than 35 s harder per hit, as the spec formula does', () => {
    expect(gradePts('long4', st(10, 10, 1), 17.5)).toBe(80);
  });

  it('bands only the biome slots in LS1, measuring Orbit and the Drive', () => {
    expect(hpmTarget('long4', 'biome', 0, 0)).toMatchObject({ t: .8, banded: true });
    expect(hpmTarget('long4', 'biome', 1, 1)).toMatchObject({ t: 1.6, banded: true });
    expect(hpmTarget('long4', 'orbit', 0, 2)).toMatchObject({ t: 1.3, banded: false });
    expect(hpmTarget('long4', 'drive', 0, 0)).toMatchObject({ t: 1.3, banded: false });
  });

  it('targets LV 13±1 and D1 biomass 1.3-1.5k', () => {
    expect(ECON.long4.targets!.lvD1).toEqual([12, 14]);
    expect(ECON.long4.targets!.bio[0]).toEqual([1300, 1500]);
  });
});

describe('long5 matches spec §7 (LS3-0)', () => {
  it('breaks seals on clears 1, 3 and 5', () => {
    expect([1, 2, 3, 4, 5, 6].map((c) => sealAt('long5', c))).toEqual([1, 0, 2, 0, 3, 0]);
  });

  it('pays 40 + 35 x ord + 40 x loop at a stage clear', () => {
    expect([0, 1, 2, 3, 4].map((o) => stageXP('long5', o, 0))).toEqual([40, 75, 110, 145, 180]);
    expect(stageXP('long5', 0, 2)).toBe(120);
    expect(killXP('long5', 4)).toBe(3);
  });

  it('cuts kill biomass to x0.6', () => expect(killBio('long5', 50)).toBe(30));

  it('adds .35 of a descent of depth across 5 stages', () => {
    expect(descDepth('long5', 1, 0)).toBe(1);
    expect(descDepth('long5', 1, 2)).toBeCloseTo(1.175);
    expect(descDepth('long5', 1, 4)).toBeCloseTo(1.35);
  });

  it('uses GLUTTONY [3, 7]', () => expect(gluttonyN('long5')).toEqual([3, 7]));

  it('rolls .05 elites from Descent 1 stage 4', () => {
    expect([0, 1, 2, 3, 4].map((o) => d1EliteChance('long5', o))).toEqual([0, 0, 0, .05, .05]);
  });

  it('gives a ship per Drive kill up to 5, never taking one away', () => {
    expect(livesAfterDrive('long5', 2)).toBe(3);
    expect(livesAfterDrive('long5', 5)).toBe(5);
    expect(livesAfterDrive('long5', 6)).toBe(6);
  });

  it('sets every §8 hits/min cell, the interior included', () => {
    for (const [kind, slot, col] of COLS) for (let loop = 0; loop < 3; loop++)
      expect(hpmTarget('long5', kind, slot, loop)?.t, `${col} D${loop + 1}`).toBe(SPEC_HPM[col][loop]);
  });

  it('bands every column, the interior included', () => {
    expect(hpmTarget('long5', 'interior', 0, 0)).toMatchObject({ t: .8, banded: true });
    expect(hpmTarget('long5', 'orbit', 0, 1)).toMatchObject({ t: 1.0, banded: true });
  });

  it('targets LV 4 / 8 after stages 1 / 2 and LV 14±1 at the end of Descent 1', () => {
    expect(ECON.long5.targets!.lvStage).toEqual({ 0: 4, 1: 8 });
    expect(ECON.long5.targets!.lvD1).toEqual([13, 15]);
  });
});

describe('edge cases', () => {
  it('reads the D1 hits/min row for a negative descent', () => {
    expect(hpmTarget('long5', 'orbit', 0, -1)!.t).toBe(.5);
  });

  it('breaks no seal on a zero or negative clear count', () => {
    for (const id of ['short', 'long4', 'long5'] as const) {
      expect(sealAt(id, 0)).toBe(0);
      expect(sealAt(id, -1)).toBe(0);
    }
  });

  it('keeps the long5 Descent 1 elite chance past the last stage', () => {
    expect(d1EliteChance('long5', 9)).toBe(.05);
  });

  it('reads the D3 hits/min row for Descent 4 and later, with a ±30% band', () => {
    const h = hpmTarget('long5', 'drive', 0, 7)!;
    expect(h.t).toBe(2.0);
    expect(h.lo).toBeCloseTo(2 * (1 - HPM_TOL));
    expect(h.hi).toBeCloseTo(2 * (1 + HPM_TOL));
  });

  it('maps stage kinds to hits/min columns by biome slot', () => {
    expect(hpmCol('biome', 0)).toBe('biome0');
    expect(hpmCol('biome', 1)).toBe('biome1');
    expect(hpmCol('drive', 1)).toBe('drive');
  });

  it('treats a missing, zero, negative or NaN stage length as a reference-length stage', () => {
    const s = st(9, 10, 1);
    for (const Ts of [undefined, 0, -5, NaN]) expect(gradePts('long4', s, Ts), String(Ts)).toBe(gradePts('short', s));
  });

  it('grades a stage with nothing spawned on hits and deaths alone', () => {
    expect(gradeOf('long4', st(0, 0), 60)).toBe('C');
  });

  it('clamps intra-descent depth to the descent', () => {
    expect(descDepth('long4', 0, 9)).toBeCloseTo(.35);
    expect(descDepth('long4', 0, -1)).toBe(0);
  });

  it('has as many stages per descent as its layout (4, 4, 5) until layout.ts owns the count', () => {
    expect([ECON.short.n, ECON.long4.n, ECON.long5.n]).toEqual([4, 4, 5]);
  });

  it('every long entry sets every value the spec column has', () => {
    for (const id of ['long4', 'long5'] as const) {
      const e = ECON[id];
      expect(Object.keys(e.seals)).toHaveLength(3);
      expect(e.gradeRef).toBe(35);
      expect(e.sHits).toBe(1);
      expect(e.intra).toBe(.35);
      expect(e.targets!.bio).toEqual([[1300, 1500], [2100, 2400], [2600, 3600]]);
    }
  });
});

describe('purity', () => {
  beforeEach(() => { $.G = { loop: 3, stage: 2, seal: 3, cleared: 9 }; });

  it('ignores the run state: the same arguments give the same answer whatever $.G holds', () => {
    // Arrange: a run deep in Descent 4 (beforeEach). Act + Assert: the functions answer from their arguments alone
    expect(descDepth('long4', 0, 0)).toBe(0);
    expect(stageXP('long5', 0, 0)).toBe(40);
    expect(sealAt('long5', 1)).toBe(1);
  });
});
