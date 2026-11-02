// LS1 row E: the cell picker and filler generator (src/cellpick.ts), the long Orbit / Drive cell pools
// (src/enemies/scripts.ts) and long4's Orbit and Drive row plans (src/layout.ts). design/content-expansion.md §3.4.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';
import { INTERIOR_MIX, ORBIT_MIX, genFiller, mixPick, noteCells, pickCells, type CellDef, type CellMem } from '../../src/cellpick';
import { LONG4_ORBIT, long4Drive, type StageRow } from '../../src/layout';

// scripts.ts pulls in canvas/audio modules through spawn.ts; stub them and record what each cell spawns
const calls: string[] = [];
const rec = (k: string) => (..._a: unknown[]) => { calls.push(k); };
const simR = vi.hoisted(() => ({ n: 0 })); // counts sim R() draws made through scripts.ts
vi.mock('../../src/core', () => ({ PH: 254, W: 480, R: () => (simR.n++, 0), ri: (a: number) => (simR.n++, a) }));
vi.mock('../../src/audio', () => ({ sfx: { dread: () => {}, siren: () => {} } }));
vi.mock('../../src/boss/update', () => ({ startBoss: () => {} }));
vi.mock('../../src/enemies/ufo', () => ({ ufoWarn: () => {} }));
vi.mock('../../src/enemies/spawn', () => Object.fromEntries(
  ['banner', 'behindWave', 'corpse', 'crawler', 'eyeT', 'flayer', 'formation', 'hatch', 'logLine', 'maw', 'mutant', 'sentry', 'womb'].map((k) => [k, (...a: unknown[]) => rec(k)(...a)]),
));
const { ORBIT_CELLS, ORBIT_OPENER, DRIVE_CELLS, pickPlanned, placePlanned } = await import('../../src/enemies/scripts');

/** a seeded uniform stream (xorshift32), the shape of the tools' seeded Math.random */
const stream = (seed: number) => { let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) >>> 0 || 1; return () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296); };
const fresh = (): CellMem => ({ used: [], last: [] });
const defs = (cells: any[]): CellDef[] => cells.map((c) => ({ id: c.id, tags: c.tags, min: c.min }));
const tags = (r: StageRow) => r.plan!.slots.map((s) => s.tag);
const DRIVE = long4Drive(8300, 11000);

describe('pickCells rules', () => {
  const pool: CellDef[] = [
    { id: 'a', tags: ['build'], min: 0 }, { id: 'b', tags: ['build'], min: 0 }, { id: 'c', tags: ['build'], min: 0 },
    { id: 'late', tags: ['build'], min: 2 },
  ];

  it('plays the opener verbatim in Descent 1 whatever the stream gives', () => {
    // Arrange
    const op = ['c', 'a'];
    // Act
    const picks = [1, 2, 3].map((s) => pickCells(pool, ['build', 'build', 'build'], 0, fresh(), stream(s), op).ids);
    // Assert: the opener slots are fixed, the third slot draws (only b is left)
    for (const ids of picks) expect(ids).toEqual(['c', 'a', 'b']);
  });

  it('ignores the opener from Descent 2 on', () => {
    const { ids } = pickCells(pool, ['build'], 1, fresh(), () => 0, ['c']);
    expect(ids).toEqual(['a']);
  });

  it('never places a cell twice in a descent: a slot with no candidate stays empty instead', () => {
    const { ids } = pickCells(pool, ['build', 'build', 'build', 'build'], 0, fresh(), stream(9));
    expect(ids.filter(Boolean).sort()).toEqual(['a', 'b', 'c']);
    expect(ids[3]).toBeNull();
  });

  it('keeps cells below their descent gate out', () => {
    for (let s = 1; s <= 30; s++) expect(pickCells(pool, ['build', 'build', 'build'], 1, fresh(), stream(s)).ids).not.toContain('late');
    expect(pickCells(pool, ['build', 'build', 'build', 'build'], 2, fresh(), stream(1)).ids).toContain('late');
  });

  it("prefers cells outside last descent's set over cells not seen this run", () => {
    // a and b were seen; a was last descent's; c is fresh. Tier order: fresh and not last (c), then not last (b)
    const mem: CellMem = { used: ['a', 'b'], last: ['a'] };
    for (let s = 1; s <= 30; s++) expect(pickCells(pool, ['build', 'build'], 1, mem, stream(s)).ids).toEqual(['c', 'b']);
  });

  it("falls back to last descent's cells only when nothing else is left, and counts it", () => {
    const mem: CellMem = { used: ['a', 'b', 'c'], last: ['a', 'b'] };
    const r = pickCells(pool, ['build', 'build'], 1, mem, () => 0);
    expect(r.ids).toEqual(['c', 'a']);
    expect(r.relaxed).toBe(1);
  });

  it('noteCells makes the picks last descent and adds them to the run once', () => {
    const mem: CellMem = { used: ['a'], last: ['a'] };
    noteCells(mem, ['b', null, 'a']);
    expect(mem).toEqual({ used: ['a', 'b'], last: ['b', 'a'] });
  });
});

describe('the real cell pools', () => {
  const cases: [string, any[], string[], StageRow][] = [['orbit', ORBIT_CELLS, ORBIT_OPENER, LONG4_ORBIT], ['drive', DRIVE_CELLS, [], DRIVE]];

  it('has 13 Orbit cells (spec target 10-12, plus one for the long Orbit\'s second build slot) and 12+ Drive cells', () => {
    expect(ORBIT_CELLS.length).toBe(13);
    expect(DRIVE_CELLS.length).toBeGreaterThanOrEqual(12);
  });

  for (const [kind, cells, opener, row] of cases) {
    it(`${kind}: ids are unique and every cell fits its ~300 px slot with 3-6 beats (x 0..280)`, () => {
      expect(new Set(cells.map((c) => c.id)).size).toBe(cells.length);
      for (const c of cells) {
        const xs: number[] = [];
        c((x: number) => xs.push(x));
        expect(xs.length, c.id).toBeGreaterThanOrEqual(3);
        expect(Math.min(...xs), c.id).toBeGreaterThanOrEqual(0);
        expect(Math.max(...xs), c.id).toBeLessThanOrEqual(280);
        expect(new Set(xs).size, c.id).toBeGreaterThanOrEqual(3); // 3+ distinct beats (the 4-6 spawns of spec §3.4)
      }
    });

    it(`${kind}: over 8 descents and 200 seeds, never a repeat in a descent, never last descent's cell, never an empty slot`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const mem = fresh(), rnd = stream(seed);
        for (let L = 0; L < 8; L++) {
          const { ids, relaxed } = pickCells(defs(cells), tags(row), L, mem, rnd, opener);
          expect(ids).not.toContain(null);
          expect(new Set(ids).size).toBe(ids.length);
          expect(relaxed).toBe(0);
          expect(ids.filter((id) => mem.last.includes(id!))).toEqual([]);
          noteCells(mem, ids);
        }
      }
    });
  }

  it('Descent 1 Orbit opens on the same three cells on every seed, and the rest of the stage differs across seeds', () => {
    const runs = Array.from({ length: 20 }, (_, i) => pickCells(defs(ORBIT_CELLS), tags(LONG4_ORBIT), 0, fresh(), stream(i + 1), ORBIT_OPENER).ids);
    for (const ids of runs) expect(ids.slice(0, 3)).toEqual(ORBIT_OPENER);
    expect(new Set(runs.map((ids) => ids.slice(3).join())).size).toBeGreaterThan(1);
  });

  it('every opener cell is an intro cell gated to Descent 3, so it returns only as an ordinary cell', () => {
    for (const id of ORBIT_OPENER) { const c = ORBIT_CELLS.find((x) => x.id === id)!; expect({ tags: c.tags, min: c.min }).toEqual({ tags: ['intro'], min: 2 }); }
  });

  it('only floor cells use the corridor-floor kinds in the Drive (mutant, crawler, womb)', () => {
    for (const c of DRIVE_CELLS) {
      calls.length = 0;
      c((_x: number, f: () => void) => f());
      const terrain = calls.some((k) => k === 'mutant' || k === 'crawler' || k === 'womb');
      expect(terrain, c.id).toBe(c.tags.includes('floor'));
    }
  });
});

describe('filler generator', () => {
  it('places one beat per gap inside the window, jittered by at most 15% of the gap', () => {
    const b = genFiller(1000, 2000, 80, ORBIT_MIX, stream(3));
    expect(b.length).toBe(13);
    b.forEach((x, i) => { expect(x.x).toBeGreaterThanOrEqual(1000); expect(x.x).toBeLessThan(2000); expect(Math.abs(x.x - (1000 + i * 80))).toBeLessThanOrEqual(12); });
  });

  it('draws drones about 30% of the time from both mixes, and no terrain kinds in Open Orbit', () => {
    for (const mix of [ORBIT_MIX, INTERIOR_MIX]) {
      const ks = genFiller(0, 200000, 50, mix, stream(5)).map((b) => b.k), share = ks.filter((k) => k === 'drones').length / ks.length;
      expect(share).toBeGreaterThan(.27);
      expect(share).toBeLessThan(.33);
    }
    expect(Object.keys(ORBIT_MIX).filter((k) => ['mutant', 'crawler', 'womb', 'eyes'].includes(k))).toEqual([]);
  });

  it('mixPick walks the table in order: the lowest u gives the first kind, the highest the last', () => {
    expect(mixPick(INTERIOR_MIX, 0)).toBe('drones');
    expect(mixPick(INTERIOR_MIX, .9999)).toBe('eyes');
  });
});

describe('long4 Orbit and Drive rows', () => {
  beforeEach(() => { $.G = { loop: 0 }; calls.length = 0; });

  it('forces the Saucer out at least 300 px before the Maw banner, the next WARNING in LS1 (D20 rule 1)', () => {
    const d = LONG4_ORBIT.drift![0], exit = d.gapEnd - d.exitLead;
    expect(d.at).toBe(1100);
    expect(LONG4_ORBIT.warnX! - exit).toBeGreaterThanOrEqual(300);
  });

  it('puts the Drive startBoss 2700 px into the approach, after its WARNING', () => {
    expect(DRIVE.bossX - DRIVE.x0).toBe(2700);
    expect(DRIVE.warnX!).toBeLessThan(DRIVE.bossX);
  });

  for (const row of [LONG4_ORBIT, DRIVE]) {
    it(`${row.kind}: cell slots and filler windows never overlap, and all content ends 60+ px before the WARNING`, () => {
      const P = row.plan!, spans = [...P.slots.map((s) => [s.x, s.x + 280]), ...P.fill.map((f) => [f.a, f.b - 1])].sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < spans.length; i++) expect(spans[i][0], `span ${spans[i]}`).toBeGreaterThan(spans[i - 1][1]);
      expect(spans[spans.length - 1][1]).toBeLessThanOrEqual(row.warnX! - row.x0 - 60);
    });
  }

  it("no Orbit cell sits inside the Saucer's filler window (cells always play; only generator filler is eaten)", () => {
    const d = LONG4_ORBIT.drift![0];
    for (const s of LONG4_ORBIT.plan!.slots) expect(s.x + 280 < d.at || s.x >= d.gapEnd, `slot ${s.x}`).toBe(true);
  });

  it('pickPlanned opens Descent 1 on the opener and keeps cell memory per stage kind in G.remixV', () => {
    const { ids } = pickPlanned(LONG4_ORBIT, ORBIT_CELLS, ORBIT_OPENER, 0, stream(1));
    expect(ids.slice(0, 3)).toEqual(ORBIT_OPENER);
    expect($.G.remixV['c:orbit'].last).toEqual(ids);
    // Descent 2 on the same run: none of Descent 1's cells
    const ids2 = pickPlanned(LONG4_ORBIT, ORBIT_CELLS, ORBIT_OPENER, 1, stream(2)).ids;
    expect(ids2.filter((id: string) => ids.includes(id))).toEqual([]);
  });

  it('placePlanned draws nothing and places the same entries for the same pick (a stage can be rebuilt)', () => {
    const pick = pickPlanned(LONG4_ORBIT, ORBIT_CELLS, ORBIT_OPENER, 0, stream(4));
    const xs1: number[] = [], xs2: number[] = [];
    simR.n = 0;
    placePlanned(LONG4_ORBIT, ORBIT_CELLS, pick, (x: number) => xs1.push(x));
    placePlanned(LONG4_ORBIT, ORBIT_CELLS, pick, (x: number) => xs2.push(x));
    expect(xs1).toEqual(xs2);
    expect(simR.n).toBe(0);
    pickPlanned(LONG4_ORBIT, ORBIT_CELLS, ORBIT_OPENER, 1); // the counter does count: picking draws the sim R()
    expect(simR.n).toBeGreaterThan(0);
    expect(Math.min(...xs1)).toBe(200);
    expect(Math.max(...xs1)).toBeLessThanOrEqual(LONG4_ORBIT.warnX! - 60);
  });
});
